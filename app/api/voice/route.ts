import { NextRequest, NextResponse } from 'next/server';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { parse } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { initSessionState, processDialogueTurn, SessionState } from '@/lib/dialogue/stateMachine';
import { createSessionLogger } from '@/lib/logger/sessionLogger';

const sessionCache = new Map<string, { state: SessionState; lastActive: number }>();

// Cleanup stale sessions every minute
setInterval(() => {
  const now = Date.now();
  for (const [sid, data] of sessionCache.entries()) {
    if (now - data.lastActive > 5 * 60 * 1000) sessionCache.delete(sid);
  }
}, 60_000);

let wss: WebSocketServer | null = null;
let serverAttached = false;

// ---------------------------------------------------------------------------
// TTS helper — streams Sarvam audio chunks back over WebSocket
// ---------------------------------------------------------------------------
async function streamTts(text: string, ws: WebSocket, log: ReturnType<typeof createSessionLogger>) {
  const t0 = Date.now();
  try {
    const apiKey = process.env.SARVAM_API_KEY;
    if (!apiKey) {
      ws.send(JSON.stringify({ type: 'error', message: 'Missing SARVAM_API_KEY' }));
      log.error({ stage: 'TTS', message: 'Missing SARVAM_API_KEY' });
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch('https://api.sarvam.ai/text-to-speech/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-subscription-key': apiKey },
      body: JSON.stringify({ text, target_language_code: 'en-IN', speaker: 'shubh', model: 'bulbul:v3' }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      ws.send(JSON.stringify({ type: 'error', message: `TTS failed: ${errText}` }));
      log.error({ stage: 'TTS', message: `Sarvam API error: ${errText}` });
      return;
    }

    if (!response.body) return;

    const reader = response.body.getReader();
    ws.send(JSON.stringify({ type: 'audio_start' }));

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) ws.send(JSON.stringify({ type: 'audio_chunk', data: Buffer.from(value).toString('base64') }));
    }

    ws.send(JSON.stringify({ type: 'audio_end' }));
    log.ttsSent({ text, charCount: text.length, latencyMs: Date.now() - t0 });
  } catch (err: any) {
    log.error({ stage: 'TTS', message: err.message, stack: err.stack });
    ws.send(JSON.stringify({ type: 'error', message: err.message || 'TTS streaming failed' }));
  }
}

// ---------------------------------------------------------------------------
// Speech-to-Text providers
// ---------------------------------------------------------------------------

/**
 * Groq Whisper STT — OpenAI-compatible multipart endpoint. Primary provider:
 * ~1–2s for short clips (vs Gemini's 7–11s) and no 20-req/day quota wall.
 * Returns empty transcript on detected silence.
 */
async function transcribeGroq(audioBuffer: Buffer): Promise<{ transcript: string; confidence: number }> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('Missing GROQ_API_KEY');

  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(audioBuffer)], { type: 'audio/webm' }), 'audio.webm');
  form.append('model', 'whisper-large-v3-turbo');
  form.append('response_format', 'verbose_json');   // gives per-segment no_speech_prob
  form.append('language', 'en');
  form.append('temperature', '0');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  let res: Response;
  try {
    res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: form,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq STT ${res.status}: ${errText}`);
  }

  const data: any = await res.json();
  const transcript = (data.text || '').trim();

  // Derive a rough confidence from no_speech_prob so the downstream
  // low-confidence retry path (<0.7) and silence gate still work.
  const segs = Array.isArray(data.segments) ? data.segments : [];
  if (segs.length) {
    const avgNoSpeech = segs.reduce((s: number, seg: any) => s + (seg.no_speech_prob ?? 0), 0) / segs.length;
    if (avgNoSpeech > 0.6) return { transcript: '', confidence: 0 };   // mostly silence
    const confidence = Math.max(0, Math.min(1, 1 - avgNoSpeech));
    return { transcript: transcript || '', confidence: transcript ? confidence : 0 };
  }

  return { transcript, confidence: transcript ? 0.95 : 0 };
}

/**
 * Gemini STT — fallback provider (used only if Groq is unavailable). Retries
 * transient 503/429 with backoff, then escalates flash-lite → flash. Throws if
 * all attempts fail so the caller can mark a service error.
 */
async function transcribeGemini(audioBuffer: Buffer, apiKey: string): Promise<{ transcript: string; confidence: number }> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const sttSystemInstruction = `You are an expert audio transcription assistant.
CRITICAL RULES:
1. If the audio is mostly silence, background noise, or unintelligible, return: { "transcript": "[NO_SPEECH_DETECTED]", "confidence": 0.0 }
2. DO NOT hallucinate speech. DO NOT invent words.
3. Return ONLY: { "transcript": string, "confidence": number 0.0-1.0 }`;
  const makeSttModel = (modelName: string) => genAI.getGenerativeModel({
    model: modelName,
    generationConfig: { responseMimeType: 'application/json' },
    systemInstruction: sttSystemInstruction,
  });

  const STT_MODELS = ['gemini-2.5-flash-lite', 'gemini-2.5-flash'];
  const MAX_ATTEMPTS_PER_MODEL = 2;
  let transcript = '';
  let confidence = 1.0;
  let lastErr: any = null;

  outer:
  for (let m = 0; m < STT_MODELS.length; m++) {
    const sttModel = makeSttModel(STT_MODELS[m]);
    for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_MODEL; attempt++) {
      try {
        const sttResult = await sttModel.generateContent([
          { inlineData: { data: audioBuffer.toString('base64'), mimeType: 'audio/webm' } },
          'Transcribe the audio.',
        ]);
        const parsed = JSON.parse(sttResult.response.text().trim());
        transcript = parsed.transcript || '';
        confidence = parsed.confidence ?? 1.0;
        return { transcript, confidence };
      } catch (e: any) {
        lastErr = e;
        const msg = String(e?.message || '');
        const retriable = /\b(503|429)\b/.test(msg) || /high demand|overloaded|unavailable|rate limit/i.test(msg);
        if (!retriable) break outer;
        if (attempt < MAX_ATTEMPTS_PER_MODEL) await new Promise(r => setTimeout(r, 400 * attempt));
      }
    }
  }
  throw lastErr || new Error('Gemini STT failed');
}

// ---------------------------------------------------------------------------
// WebSocket server attachment
// ---------------------------------------------------------------------------
function attachWss() {
  if (serverAttached) return true;

  const handles = (process as any)._getActiveHandles();
  let server: http.Server | null = null;

  for (const h of handles) {
    if (h && h.listen && h.on && h instanceof http.Server) { server = h; break; }
  }
  if (!server) {
    for (const h of handles) {
      if (h?._events?.upgrade) { server = h; break; }
    }
  }

  if (!server) {
    console.log('--- COULD NOT FIND HTTP SERVER IN ACTIVE HANDLES ---');
    return false;
  }

  console.log('--- FOUND HTTP SERVER, ATTACHING WEBSOCKET ---');
  serverAttached = true;
  wss = new WebSocketServer({ noServer: true });

  const existingListeners = server.listeners('upgrade').slice(0);
  server.removeAllListeners('upgrade');

  server.on('upgrade', (request, socket, head) => {
    const { pathname, query } = parse(request.url || '', true);
    if (pathname === '/api/voice') {
      wss!.handleUpgrade(request, socket, head, (ws) => wss!.emit('connection', ws, request, query));
    } else {
      for (const l of existingListeners) l(request, socket, head);
    }
  });

  // ── Per-connection handler ────────────────────────────────────────────────
  wss.on('connection', (ws: WebSocket, _request: any, query: any) => {
    const sessionId = query?.sessionId || ('session_' + Math.random().toString(36).substring(2, 11));
    const log = createSessionLogger(sessionId);
    const sessionStartMs = Date.now();

    console.log(`[WS] Connected: ${sessionId}`);

    // Session state
    let state: SessionState;
    let isResumed = false;
    const cached = sessionCache.get(sessionId);
    if (cached && Date.now() - cached.lastActive <= 5 * 60 * 1000) {
      state = cached.state;
      isResumed = true;
      log.sessionResumed({ lastActiveMs: Date.now() - cached.lastActive });
    } else {
      state = initSessionState(sessionId);
      sessionCache.set(sessionId, { state, lastActive: Date.now() });
      log.sessionStart({ resumed: false });
    }

    // Per-turn tracking
    let audioChunks: Buffer[] = [];
    let silenceTimer: NodeJS.Timeout | null = null;
    let lowConfRetries = 0;
    let lastActivityTime = Date.now();
    let nudgeSent = false;
    let status: 'listening' | 'speaking' | 'processing' = 'speaking';
    let currentTtsText = '';   // what agent is saying — used for barge-in log
    let bargeInPending = false;
    let sessionEnded = false;  // guards against double session_end logging / double close

    function updateCache() {
      const c = sessionCache.get(sessionId);
      if (c) { c.lastActive = Date.now(); c.state = state; }
    }

    // Deterministic end-of-session: fires after a booking/reschedule/cancel is
    // done and the user declines further help. Sends an explicit signal (with
    // booking details for navigation) so the client doesn't rely on TTS timing.
    function endSession(reason: 'booking_complete' | 'user_closed') {
      if (sessionEnded) return;
      sessionEnded = true;
      if (silenceTimer) { clearInterval(silenceTimer); silenceTimer = null; }
      const navigate = !!state.reservationCode;
      ws.send(JSON.stringify({
        type: 'session_complete',
        navigate,
        booking: navigate ? {
          code: state.reservationCode,
          occasion: state.occasion || 'Standard Dining',
          date: state.date || '',
          time: state.confirmedSlot || state.time || '',
          table: state.tableCode || '',
        } : null,
      }));
      log.sessionEnd({ reason, turns: state.turnCount, durationMs: Date.now() - sessionStartMs });
      // Give the goodbye TTS time to play before tearing down the socket.
      setTimeout(() => { try { ws.close(); } catch {} }, 3000);
    }

    function resetSilenceTimer() {
      if (silenceTimer) clearInterval(silenceTimer);
      silenceTimer = setInterval(async () => {
        if (status !== 'listening') return;
        const elapsed = Date.now() - lastActivityTime;

        if (elapsed > 8000 && !nudgeSent) {
          nudgeSent = true;
          status = 'speaking';
          log.silenceNudge({ elapsedMs: elapsed });
          const text = "Still there? Take your time — I'm ready whenever you are.";
          state.conversationHistory.push({ role: 'assistant', content: text });
          ws.send(JSON.stringify({ type: 'state_update', state }));
          ws.send(JSON.stringify({ type: 'llm_response', text }));
          await streamTts(text, ws, log);
        } else if (elapsed > 20000) {
          clearInterval(silenceTimer!);
          silenceTimer = null;
          status = 'speaking';
          log.silenceTimeout({ elapsedMs: elapsed });
          const text = "It seems like you may have stepped away. I'll close this session now. Feel free to start again anytime. Goodbye!";
          state.conversationHistory.push({ role: 'assistant', content: text });
          ws.send(JSON.stringify({ type: 'state_update', state }));
          ws.send(JSON.stringify({ type: 'llm_response', text }));
          await streamTts(text, ws, log);
          if (!sessionEnded) {
            sessionEnded = true;
            log.sessionEnd({ reason: 'silence_timeout', turns: state.turnCount, durationMs: Date.now() - sessionStartMs });
          }
          setTimeout(() => ws.close(), 2000);
        }
      }, 1000);
    }

    resetSilenceTimer();

    // ── Greeting ─────────────────────────────────────────────────────────────
    if (!isResumed) {
      const greeting = "Welcome to Aether Dining! I'm here to help you reserve a table. Would you like to make a new booking, reschedule, or cancel?";
      state.conversationHistory.push({ role: 'assistant', content: greeting });
      currentTtsText = greeting;
      updateCache();
      ws.send(JSON.stringify({ type: 'state_update', state }));
      ws.send(JSON.stringify({ type: 'llm_response', text: greeting }));
      streamTts(greeting, ws, log);
    } else {
      ws.send(JSON.stringify({ type: 'state_update', state }));
      const resumeMsg = "Welcome back — shall we continue with your reservation?";
      ws.send(JSON.stringify({ type: 'llm_response', text: resumeMsg }));
    }

    // ── Message handler ───────────────────────────────────────────────────────
    ws.on('message', async (message, isBinary) => {
      lastActivityTime = Date.now();
      updateCache();

      // ── Binary: audio chunk from client ──────────────────────────────────
      if (isBinary) {
        audioChunks.push(Buffer.from(message as ArrayBuffer));
        return;
      }

      // ── JSON control messages ─────────────────────────────────────────────
      let msg: any;
      try { msg = JSON.parse(message.toString()); }
      catch { return; }

      console.log(`[WS][${sessionId}] msg.type=${msg.type}`);

      // ── start_listening ───────────────────────────────────────────────────
      if (msg.type === 'start_listening') {
        status = 'listening';
        audioChunks = [];          // fresh buffer for this turn
        lastActivityTime = Date.now();
        nudgeSent = false;
        bargeInPending = false;
        return;
      }

      // ── barge_in — user spoke while agent was speaking ────────────────────
      if (msg.type === 'barge_in') {
        log.bargeIn({ agentWasSaying: currentTtsText });
        console.log(`[BageIn][${sessionId}] User interrupted agent`);
        // Server acknowledges — client has already stopped TTS and started recording
        // The next stop_speech will carry the user's new input
        status = 'listening';
        audioChunks = [];
        bargeInPending = true;
        return;
      }

      // ── stop_speech — user finished speaking ──────────────────────────────
      if (msg.type === 'stop_speech') {
        status = 'processing';
        const audioBuffer = Buffer.concat(audioChunks);
        audioChunks = [];

        // Too short — skip STT, reopen mic
        if (audioBuffer.length < 2000) {
          log.audioTooShort({ bytes: audioBuffer.length });
          status = 'listening';
          ws.send(JSON.stringify({ type: 'start_listening' }));
          return;
        }

        // ── STT ────────────────────────────────────────────────────────────
        const apiKey = process.env.GOOGLE_API_KEY;
        if (!apiKey) {
          ws.send(JSON.stringify({ type: 'error', message: 'Missing GOOGLE_API_KEY' }));
          log.error({ stage: 'STT', message: 'Missing GOOGLE_API_KEY' });
          return;
        }

        const t0Stt = Date.now();
        let transcript = '';
        let confidence = 1.0;
        let sttServiceError = false;   // true = STT service failed, NOT silence
        let sttProvider = 'groq';      // logged so we can see fallbacks in the monitor

        // Primary: Groq Whisper (fast, no daily quota). Fallback: Gemini.
        try {
          const r = await transcribeGroq(audioBuffer);
          transcript = r.transcript;
          confidence = r.confidence;
        } catch (groqErr: any) {
          log.error({ stage: 'STT', message: `Groq failed, falling back to Gemini: ${groqErr.message}`, stack: groqErr.stack });
          sttProvider = 'gemini-fallback';
          try {
            const r = await transcribeGemini(audioBuffer, apiKey);
            transcript = r.transcript;
            confidence = r.confidence;
          } catch (gemErr: any) {
            log.error({ stage: 'STT', message: `Gemini fallback failed: ${gemErr.message}`, stack: gemErr.stack });
            transcript = '';
            confidence = 0;
            sttServiceError = true;
          }
        }

        const sttLatency = Date.now() - t0Stt;
        console.log(`[STT][${sessionId}] provider=${sttProvider} latency=${sttLatency}ms conf=${confidence}`);

        // Filter hallucinations
        const lower = transcript.toLowerCase();
        if (
          transcript.includes('[NO_SPEECH_DETECTED]') ||
          lower.includes('quick brown fox') ||
          lower.includes('subtitles by') ||
          lower.includes('routine to follow') ||
          lower.includes('amara.org')
        ) { transcript = ''; }

        log.sttResult({ audioBytes: audioBuffer.length, transcript, confidence, latencyMs: sttLatency });

        // Low confidence
        if (transcript && confidence < 0.7) {
          lowConfRetries++;
          if (lowConfRetries >= 2) {
            const text = "I'm having a lot of trouble with the audio. Could you try typing instead?";
            ws.send(JSON.stringify({ type: 'llm_response', text }));
            await streamTts(text, ws, log);
          } else {
            ws.send(JSON.stringify({ type: 'low_confidence', transcript }));
            const text = "I didn't quite catch that — could you say that again?";
            ws.send(JSON.stringify({ type: 'llm_response', text }));
            await streamTts(text, ws, log);
          }
          return;
        }
        if (transcript && confidence >= 0.7) lowConfRetries = 0;

        // Empty transcript
        if (!transcript) {
          const text = sttServiceError
            ? "Sorry, my speech service is briefly overloaded. Please give me a moment and try again."
            : "I didn't catch that. Could you please say that again?";
          ws.send(JSON.stringify({ type: 'llm_response', text }));
          await streamTts(text, ws, log);
          return;
        }

        ws.send(JSON.stringify({ type: 'transcript', text: transcript }));
        log.userTurn({
          turnNum: state.turnCount + 1,
          transcript,
          confidence,
          intent: state.intent,
          slots: { occasion: state.occasion, date: state.date, time: state.time, partySize: state.partySize },
        });

        // ── Dialogue Manager ────────────────────────────────────────────────
        const t0Dialogue = Date.now();
        let responseText = '';
        try {
          const result = await processDialogueTurn(transcript, state);
          responseText = result.responseText;
          state = result.updatedState;
          updateCache();
        } catch (e: any) {
          log.error({ stage: 'DialogueManager', message: e.message, stack: e.stack });
          responseText = "I'm sorry, I encountered an issue. Please try again.";
        }

        const totalLatency = Date.now() - t0Dialogue + sttLatency;
        log.agentTurn({ turnNum: state.turnCount, responseText, totalLatencyMs: totalLatency });

        // If a code was just issued, log it
        if (state.reservationCode && !sessionCache.get(sessionId)?.state.reservationCode) {
          log.codeIssued({
            code: state.reservationCode,
            occasion: state.occasion || '',
            date: state.date || '',
            time: state.time || '',
            partySize: state.partySize || undefined,
          });
        }

        currentTtsText = responseText;
        ws.send(JSON.stringify({ type: 'state_update', state }));
        ws.send(JSON.stringify({ type: 'llm_response', text: responseText }));
        await streamTts(responseText, ws, log);
        if (state.closeSession) endSession('booking_complete');
        return;
      }

      // ── text_input — typed fallback ───────────────────────────────────────
      if (msg.type === 'text_input') {
        status = 'processing';
        const text = msg.text as string;
        ws.send(JSON.stringify({ type: 'transcript', text }));

        log.userTurn({
          turnNum: state.turnCount + 1,
          transcript: text,
          confidence: 1.0,
          intent: state.intent,
          slots: { occasion: state.occasion, date: state.date, time: state.time, partySize: state.partySize },
        });

        const t0 = Date.now();
        let responseText = '';
        try {
          const result = await processDialogueTurn(text, state);
          responseText = result.responseText;
          state = result.updatedState;
          updateCache();
        } catch (e: any) {
          log.error({ stage: 'TextInput/DialogueManager', message: e.message, stack: e.stack });
          responseText = "I'm sorry, I encountered an issue. Please try again.";
        }

        log.agentTurn({ turnNum: state.turnCount, responseText, totalLatencyMs: Date.now() - t0 });
        currentTtsText = responseText;
        ws.send(JSON.stringify({ type: 'state_update', state }));
        ws.send(JSON.stringify({ type: 'llm_response', text: responseText }));
        await streamTts(responseText, ws, log);
        if (state.closeSession) endSession('booking_complete');
      }
    });

    ws.on('error', (err) => {
      log.error({ stage: 'WebSocket', message: err.message, stack: err.stack });
    });

    ws.on('close', () => {
      if (silenceTimer) clearInterval(silenceTimer);
      if (!sessionEnded) {
        sessionEnded = true;
        log.sessionEnd({ reason: 'user_closed', turns: state.turnCount, durationMs: Date.now() - sessionStartMs });
      }
      console.log(`[WS] Closed: ${sessionId}`);
    });
  });

  return true;
}

export async function GET(_req: NextRequest) {
  const success = attachWss();
  return NextResponse.json({ success, message: success ? 'WSS attached' : 'Failed to find HTTP server' });
}
