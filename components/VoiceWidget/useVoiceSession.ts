'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { SessionState } from '@/lib/dialogue/types';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface UseVoiceSessionProps {
  onTranscript?: (text: string) => void;
  onLlmResponse?:  (text: string) => void;
  onError?: (error: string) => void;
  /** Fires after the confirmation TTS finishes so callers redirect AFTER the code is spoken */
  onConfirmed?: (state: { code: string; occasion: string; date: string; time: string; table: string }) => void;
}

// ---------------------------------------------------------------------------
// Silence / speech detection via chunk size (normal listening turns).
// The FIRST MediaRecorder chunk = WebM init header — always skipped.
// Silence ≈ 200-700 bytes, speech ≈ 900-8 000 bytes.
// ---------------------------------------------------------------------------
const SPEECH_BYTES   = 800;    // chunk size above which we count as speech
const SILENCE_MS     = 1500;   // ms of post-speech quiet before auto-submit
const MAX_MS         = 8000;   // hard ceiling per turn (via setTimeout)

// ---------------------------------------------------------------------------
// Barge-in (interruption) detection — runs WHILE agent TTS is playing.
//
// For LAPTOP SPEAKERS: speaker bleed saturates the mic signal throughout TTS,
// making chunk-size VAD unreliable for auto-detection.
// Solution: expose a manual interrupt() function so the UI can show a
// "Tap to Interrupt" button — zero false positives, works on any device.
//
// The automatic threshold is set very high (5000B) so it only catches cases
// where the user speaks extremely loudly (shouting into a laptop mic).
// For normal speech levels the button is the reliable path.
// ---------------------------------------------------------------------------
const BARGE_IN_BYTES        = 5000;  // very high — avoids speaker-bleed false positives
const BARGE_IN_CONSEC       = 4;     // require 4 consecutive huge chunks (≈1s of shouting)
const BARGE_IN_STARTUP_MS   = 600;   // wait for AEC to settle before analysing

// Streaming TTS is only used where MediaSource can play MP3 chunks incrementally.
// Sarvam returns audio/mpeg. Safari lacks MSE for audio/mpeg → blob fallback.
function mseCanStream(): boolean {
  return typeof MediaSource !== 'undefined' && MediaSource.isTypeSupported('audio/mpeg');
}

// Tiny silent WAV. iOS Safari only lets an <audio> element play programmatically
// (i.e. not inside a tap) once it has been "unlocked" by a play() call that DID
// originate from a user gesture. We play this muted during the Start tap so the
// element is primed for the real TTS that arrives later over the WebSocket.
const SILENT_WAV =
  'data:audio/wav;base64,UklGRjIAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YQoAAAAAAAAAAAAAAAAAAAAAAAA=';

export function useVoiceSession({
  onTranscript,
  onLlmResponse,
  onError,
  onConfirmed,
}: UseVoiceSessionProps = {}) {

  const [isConnected, setIsConnected]         = useState(false);
  const [isListening, setIsListening]         = useState(false);
  const [isSpeaking,  setIsSpeaking]          = useState(false);
  const [messages,    setMessages]            = useState<Message[]>([]);
  const [error,       setError]               = useState<string | null>(null);
  const [inputVolume, setInputVolume]         = useState(0);
  const [micPermissionDenied, setMicDenied]  = useState(false);
  const [sessionState, setSessionState]       = useState<SessionState | null>(null);

  // ── Stable refs (never change across renders) ────────────────────────────
  const wsRef            = useRef<WebSocket | null>(null);
  const recorderRef      = useRef<MediaRecorder | null>(null);
  const bargeRecorderRef = useRef<MediaRecorder | null>(null); // runs during TTS
  const micStreamRef     = useRef<MediaStream | null>(null);
  const audioCtxRef      = useRef<AudioContext | null>(null);
  const analyserRef      = useRef<AnalyserNode | null>(null);
  const rAFRef           = useRef<number | null>(null);
  const abortRef         = useRef(false);

  // TTS playback
  const chunksRef        = useRef<Uint8Array[]>([]);   // blob fallback buffer
  const audioElRef       = useRef<HTMLAudioElement | null>(null);  // persistent, iOS-unlocked
  const primedRef        = useRef(false);              // el unlocked in a user gesture
  const blobUrlRef       = useRef<string | null>(null);

  // TTS streaming (MediaSource) — play the first chunk as it arrives instead of
  // buffering the whole synthesis, cutting perceived latency to time-to-first-chunk.
  const mediaSourceRef      = useRef<MediaSource | null>(null);
  const sourceBufferRef     = useRef<SourceBuffer | null>(null);
  const appendQueueRef      = useRef<Uint8Array[]>([]);
  const streamEndedRef      = useRef(false);   // audio_end received
  const streamDoneCalledRef = useRef(false);   // afterAudio fired once
  const playStartedRef      = useRef(false);   // el.play() kicked off

  // Listening-state ref kept in sync with React state so callbacks see it immediately
  const listeningRef     = useRef(false);
  const micDeniedRef     = useRef(false);
  const speakingRef      = useRef(false);   // true while TTS is playing

  // Barge-in detection state
  const bargeConsecRef   = useRef(0);       // consecutive large chunks during TTS

  // Silence-detection state (used inside ondataavailable — no React needed)
  const speechSeenRef    = useRef(false);
  const lastSpeechMsRef  = useRef(0);
  const recordStartMsRef = useRef(0);
  const submitOnceRef    = useRef(false); // guard double-submit

  // Confirmed booking details (set by state_update; used as fallback at close)
  const confirmedRef     = useRef<{ code: string; occasion: string; date: string; time: string; table: string } | null>(null);
  // Explicit server-driven session close (set by `session_complete`, read by afterAudio)
  const closeRef         = useRef<{ navigate: boolean; booking: { code: string; occasion: string; date: string; time: string; table: string } | null } | null>(null);
  const closeFallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Callback refs — updated every render so closures always call the latest version
  const onTranscriptRef  = useRef(onTranscript);
  const onLlmResponseRef = useRef(onLlmResponse);
  const onErrorRef       = useRef(onError);
  const onConfirmedRef   = useRef(onConfirmed);
  useEffect(() => { onTranscriptRef.current  = onTranscript;  }, [onTranscript]);
  useEffect(() => { onLlmResponseRef.current = onLlmResponse; }, [onLlmResponse]);
  useEffect(() => { onErrorRef.current       = onError;       }, [onError]);
  useEffect(() => { onConfirmedRef.current   = onConfirmed;   }, [onConfirmed]);

  // Sync helpers
  const setListening = useCallback((v: boolean) => { listeningRef.current = v; setIsListening(v); }, []);
  const setMicDeniedFn = useCallback((v: boolean) => { micDeniedRef.current = v; setMicDenied(v); }, []);

  useEffect(() => () => { doCleanup(); }, []);

  // ── Cleanup ───────────────────────────────────────────────────────────────
  const doCleanup = useCallback(() => {
    abortRef.current = true;
    if (rAFRef.current) { cancelAnimationFrame(rAFRef.current); rAFRef.current = null; }
    if (maxTimerRef.current) { clearTimeout(maxTimerRef.current); maxTimerRef.current = null; }
    if (closeFallbackRef.current) { clearTimeout(closeFallbackRef.current); closeFallbackRef.current = null; }
    stopRecorder();
    stopBargeInRecorder();
    stopAudio();
    // Fully release the persistent audio element on teardown (stopAudio keeps it
    // alive for reuse across turns; here the whole session is ending).
    if (audioElRef.current) {
      const el = audioElRef.current;
      try { el.pause(); el.removeAttribute('src'); el.load(); } catch { /* noop */ }
      audioElRef.current = null;
    }
    primedRef.current = false;
    wsRef.current?.close();
    wsRef.current = null;
    if (audioCtxRef.current?.state !== 'closed') audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    micStreamRef.current?.getTracks().forEach(t => t.stop());
    micStreamRef.current = null;
    listeningRef.current = false;
    speakingRef.current = false;
    setIsConnected(false);
    setIsListening(false);
    setIsSpeaking(false);
    setInputVolume(0);
    setSessionState(null);
  }, []);

  // ── Audio playback ────────────────────────────────────────────────────────
  const stopAudio = useCallback(() => {
    // Tear down any in-flight MediaSource stream first
    const ms = mediaSourceRef.current;
    if (ms && ms.readyState === 'open') { try { ms.endOfStream(); } catch { /* noop */ } }
    sourceBufferRef.current = null;
    mediaSourceRef.current = null;
    appendQueueRef.current = [];
    if (audioElRef.current) {
      const el = audioElRef.current;
      el.onended = null; el.onerror = null;   // prevent stray finishStream on teardown
      el.pause();
      try { el.removeAttribute('src'); el.load(); } catch { /* noop */ }
      // NOTE: keep audioElRef.current alive. Nulling it would force a new
      // (iOS-locked) element next turn; reusing the primed one keeps playback
      // working on mobile Safari. It's fully released in doCleanup().
    }
    if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null; }
  }, []);

  // Return the single persistent audio element, creating it once.
  const ensureAudioEl = useCallback((): HTMLAudioElement => {
    let el = audioElRef.current;
    if (!el) {
      el = new Audio();
      el.setAttribute('playsinline', '');   // iOS: don't hijack into fullscreen
      el.preload = 'auto';
      audioElRef.current = el;
    }
    return el;
  }, []);

  // Unlock the audio element from within a user gesture (the Start tap). Plays a
  // muted silent clip so later programmatic play() calls are allowed on iOS.
  const primeAudioEl = useCallback(() => {
    if (primedRef.current) return;
    const el = ensureAudioEl();
    try {
      el.muted = true;
      el.src = SILENT_WAV;
      const settle = () => {
        try { el.pause(); el.currentTime = 0; } catch { /* noop */ }
        el.muted = false;
        primedRef.current = true;
      };
      const p = el.play();
      if (p && typeof p.then === 'function') p.then(settle).catch(() => { el.muted = false; });
      else settle();
    } catch { el.muted = false; }
  }, [ensureAudioEl]);

  // Executes the pending server-driven close (navigate to confirmation, or just
  // end). Returns true if a close was pending and handled. Idempotent.
  const finishClose = useCallback(() => {
    const close = closeRef.current;
    if (!close) return false;
    closeRef.current = null;
    if (closeFallbackRef.current) { clearTimeout(closeFallbackRef.current); closeFallbackRef.current = null; }
    speakingRef.current = false;
    setIsSpeaking(false);
    const booking = close.booking || confirmedRef.current;
    if (close.navigate && booking) {
      onConfirmedRef.current?.(booking);   // navigates + stops session
    } else {
      doCleanup();                         // no booking — just end the session
    }
    return true;
  }, [doCleanup]);

  const afterAudio = useCallback(() => {
    if (abortRef.current) return;
    speakingRef.current = false;
    setIsSpeaking(false);
    stopBargeInRecorder();

    // Server signalled the session is over (booking done + user declined more help).
    // Navigate to the confirmation screen now that the goodbye has finished playing.
    if (finishClose()) return;

    // 300 ms echo-settle pause, then open mic
    setTimeout(() => {
      if (abortRef.current) return;
      setListening(true);
      wsRef.current?.send(JSON.stringify({ type: 'start_listening' }));
      if (!micDeniedRef.current) startRecorder();
    }, 300);
  }, [setListening, finishClose]);

  // ── Streaming TTS playback (MediaSource) ──────────────────────────────────
  // Play audio_chunks as they arrive instead of buffering to audio_end, so the
  // user hears the first chunk within a few hundred ms of synthesis starting.
  const finishStream = useCallback(() => {
    if (streamDoneCalledRef.current) return;
    streamDoneCalledRef.current = true;
    afterAudio();
  }, [afterAudio]);

  const pumpMse = useCallback(() => {
    const sb = sourceBufferRef.current;
    const ms = mediaSourceRef.current;
    if (!sb || sb.updating) return;

    if (appendQueueRef.current.length > 0) {
      const chunk = appendQueueRef.current.shift()!;
      try { sb.appendBuffer(chunk as BufferSource); } catch { /* removed/quota — will error out via el.onerror */ return; }

      // Start playback as soon as the first bytes are buffered
      if (!playStartedRef.current) {
        playStartedRef.current = true;
        speakingRef.current = true;
        setIsSpeaking(true);
        audioElRef.current?.play()
          .then(() => { if (!micDeniedRef.current) startBargeInRecorder(); })
          .catch(() => { /* play blocked — onerror/onended will settle */ });
      }
    } else if (streamEndedRef.current && ms && ms.readyState === 'open') {
      try { ms.endOfStream(); } catch { /* noop */ }
    }
  }, []);

  const startMseStream = useCallback(() => {
    stopAudio();
    appendQueueRef.current      = [];
    streamEndedRef.current      = false;
    streamDoneCalledRef.current = false;
    playStartedRef.current      = false;
    if (audioCtxRef.current?.state === 'suspended') audioCtxRef.current.resume().catch(() => {});

    const ms  = new MediaSource();
    mediaSourceRef.current = ms;
    const url = URL.createObjectURL(ms);
    blobUrlRef.current = url;
    const el  = ensureAudioEl();   // reuse the iOS-unlocked element
    el.src = url;

    el.onended = finishStream;
    el.onerror = () => { console.warn('TTS stream error'); finishStream(); };

    ms.addEventListener('sourceopen', () => {
      if (mediaSourceRef.current !== ms) return; // superseded
      try {
        const sb = ms.addSourceBuffer('audio/mpeg');
        sourceBufferRef.current = sb;
        sb.addEventListener('updateend', pumpMse);
        pumpMse();
      } catch (e) { console.warn('addSourceBuffer failed', e); finishStream(); }
    }, { once: true });
  }, [stopAudio, finishStream, pumpMse, ensureAudioEl]);

  const appendMseChunk = useCallback((bytes: Uint8Array) => {
    // Copy into a standalone buffer (the decoded view may be reused/detached)
    appendQueueRef.current.push(new Uint8Array(bytes));
    pumpMse();
  }, [pumpMse]);

  const endMseStream = useCallback(() => {
    streamEndedRef.current = true;
    // Nothing ever buffered (empty synthesis) — just move on
    if (!playStartedRef.current && appendQueueRef.current.length === 0) { finishStream(); return; }
    pumpMse();
  }, [pumpMse, finishStream]);

  const playTts = useCallback(() => {
    const chunks = chunksRef.current;
    chunksRef.current = [];
    if (!chunks.length) { afterAudio(); return; }

    stopAudio();
    if (audioCtxRef.current?.state === 'suspended') audioCtxRef.current.resume().catch(() => {});

    const blob = new Blob(chunks as BlobPart[], { type: 'audio/mpeg' });
    const url  = URL.createObjectURL(blob);
    blobUrlRef.current = url;

    const el = ensureAudioEl();   // reuse the iOS-unlocked element
    el.src = url;

    speakingRef.current = true;
    setIsSpeaking(true);

    let called = false;
    const done = () => {
      if (called) return; called = true;
      if (blobUrlRef.current === url) { URL.revokeObjectURL(url); blobUrlRef.current = null; }
      afterAudio();
    };
    el.onended = done;
    el.onerror = () => { console.warn('TTS audio error'); done(); };
    el.play()
      .then(() => {
        // Start barge-in recorder once playback actually begins
        if (!micDeniedRef.current) startBargeInRecorder();
      })
      .catch(() => { console.warn('play() blocked'); done(); });
  }, [afterAudio, stopAudio, ensureAudioEl]);

  // ── Recording with chunk-size silence detection ───────────────────────────
  const doSubmit = useCallback(() => {
    if (submitOnceRef.current) return;
    submitOnceRef.current = true;
    if (maxTimerRef.current) { clearTimeout(maxTimerRef.current); maxTimerRef.current = null; }
    setListening(false);

    const rec = recorderRef.current;
    recorderRef.current = null;

    if (!rec || rec.state === 'inactive') {
      wsRef.current?.send(JSON.stringify({ type: 'stop_speech' }));
      return;
    }

    // Send stop_speech AFTER the final dataavailable chunk is flushed
    const onStop = () => wsRef.current?.send(JSON.stringify({ type: 'stop_speech' }));
    rec.addEventListener('stop', onStop, { once: true });
    try { rec.stop(); } catch { onStop(); }
  }, [setListening]);

  // Ref for the max-time timer so stopRecorder can clear it
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startRecorder = useCallback(() => {
    if (!micStreamRef.current || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    if (recorderRef.current?.state === 'recording') return;

    submitOnceRef.current    = false;
    speechSeenRef.current    = false;
    lastSpeechMsRef.current  = 0;
    recordStartMsRef.current = Date.now();

    // ── Guaranteed ceiling: always submit after MAX_MS ───────────────────────
    // This fires regardless of whether ondataavailable detects silence.
    if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
    maxTimerRef.current = setTimeout(() => { doSubmit(); }, MAX_MS);

    try {
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus' : 'audio/webm';
      const rec = new MediaRecorder(micStreamRef.current, { mimeType: mime });
      recorderRef.current = rec;

      let isFirstChunk = true; // first chunk = WebM header, skip from speech detection

      rec.ondataavailable = (e) => {
        // Always forward audio bytes to server
        if (e.data.size > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(e.data);
        }

        // Skip first chunk (WebM init segment — always large, misleads speech detector)
        if (isFirstChunk) { isFirstChunk = false; return; }

        // After doSubmit() sets listening=false, stop analysing (data still forwarded above)
        if (!listeningRef.current) return;

        const now      = Date.now();
        const isSpeech = e.data.size >= SPEECH_BYTES;

        if (isSpeech) {
          speechSeenRef.current   = true;
          lastSpeechMsRef.current = now; // keep moving the last-speech timestamp
        }

        // Early submit: speech was heard AND has been silent for SILENCE_MS
        if (speechSeenRef.current && lastSpeechMsRef.current > 0 &&
            (now - lastSpeechMsRef.current) >= SILENCE_MS) {
          doSubmit();
        }
      };

      rec.start(250);
    } catch (err) {
      console.error('MediaRecorder start error:', err);
      // If recorder fails to start, still submit after timeout so session recovers
    }
  }, [doSubmit]);

  const stopRecorder = useCallback(() => {
    if (maxTimerRef.current) { clearTimeout(maxTimerRef.current); maxTimerRef.current = null; }
    const rec = recorderRef.current;
    recorderRef.current = null;
    if (rec && rec.state !== 'inactive') {
      try { rec.stop(); } catch (_) {}
    }
  }, []);

  // ── Barge-in recorder (runs silently during TTS playback) ──────────────────
  // Uses the same mic stream but a SEPARATE MediaRecorder instance.
  // Chunks are NOT forwarded to server — only used for detection.
  // When barge-in confirmed: stop TTS, signal server, hand off to normal recorder.
  const startBargeInRecorder = useCallback(() => {
    if (!micStreamRef.current) return;
    if (bargeRecorderRef.current?.state === 'recording') return;

    bargeConsecRef.current = 0;
    let isFirstChunk = true;
    // Delay analysis start — gives AEC time to settle and prevents the initial
    // speaker burst from triggering false positives
    let analysisArmed = false;
    setTimeout(() => { analysisArmed = true; }, BARGE_IN_STARTUP_MS);

    try {
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus' : 'audio/webm';
      const rec = new MediaRecorder(micStreamRef.current, { mimeType: mime });
      bargeRecorderRef.current = rec;

      rec.ondataavailable = (e) => {
        if (!speakingRef.current) return; // TTS already ended
        if (isFirstChunk) { isFirstChunk = false; return; } // skip WebM header
        if (!analysisArmed) return;       // still in AEC settle window

        if (e.data.size >= BARGE_IN_BYTES) {
          bargeConsecRef.current++;
          if (bargeConsecRef.current >= BARGE_IN_CONSEC) {
            console.log('[Barge-in] Auto-detected (very loud speech)');
            handleBargeIn();
          }
        } else {
          bargeConsecRef.current = 0;
        }
      };

      rec.start(250);
    } catch (err) {
      console.warn('[Barge-in] Could not start barge-in recorder:', err);
    }
  }, []);

  const stopBargeInRecorder = useCallback(() => {
    const rec = bargeRecorderRef.current;
    bargeRecorderRef.current = null;
    bargeConsecRef.current = 0;
    if (rec && rec.state !== 'inactive') {
      try { rec.stop(); } catch (_) {}
    }
  }, []);

  const handleBargeIn = useCallback(() => {
    if (!speakingRef.current) return; // already handled
    speakingRef.current = false;

    // 1. Stop TTS audio immediately
    stopAudio();
    stopBargeInRecorder();
    setIsSpeaking(false);

    // 2. Notify server — server logs the barge-in and opens a new turn
    wsRef.current?.send(JSON.stringify({ type: 'barge_in' }));

    // 3. Brief pause then open mic for user's full input
    setTimeout(() => {
      if (abortRef.current) return;
      setListening(true);
      wsRef.current?.send(JSON.stringify({ type: 'start_listening' }));
      if (!micDeniedRef.current) startRecorder();
    }, 150);
  }, [setListening, stopAudio]);

  // ── Volume visualiser (AudioContext only for UI — not for speech detection) ─
  const startVolumeLoop = useCallback(() => {
    const data = new Uint8Array(128);
    const loop = () => {
      rAFRef.current = requestAnimationFrame(loop);
      if (!analyserRef.current) return;
      analyserRef.current.getByteTimeDomainData(data);
      let s = 0;
      for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; s += v * v; }
      setInputVolume(listeningRef.current ? Math.sqrt(s / data.length) : 0);
    };
    rAFRef.current = requestAnimationFrame(loop);
  }, []);

  // ── WebSocket message handler ─────────────────────────────────────────────
  // Uses refs for all callbacks so the closure is always current regardless
  // of which render captured it in ws.onmessage.
  const handleMsg = useCallback((msg: any) => {
    switch (msg.type) {
      case 'state_update':
        setSessionState(msg.state);
        if (msg.state?.reservationCode && !confirmedRef.current) {
          confirmedRef.current = {
            code:     msg.state.reservationCode,
            occasion: msg.state.occasion || 'Standard Dining',
            date:     msg.state.date     || '',
            time:     msg.state.time     || '',
            table:    msg.state.tableCode || '',
          };
        }
        break;

      case 'llm_response':
        setMessages(prev => [...prev, { role: 'assistant', content: msg.text }]);
        onLlmResponseRef.current?.(msg.text);
        break;

      case 'transcript':
        setMessages(prev => [...prev, { role: 'user', content: msg.text }]);
        onTranscriptRef.current?.(msg.text);
        break;

      case 'audio_start':
        stopRecorder();           // stop the normal listening recorder
        setListening(false);
        chunksRef.current = [];
        // Prefer streaming playback; fall back to blob buffering where MSE/MP3
        // isn't supported. mediaSourceRef!=null signals streaming mode downstream.
        if (mseCanStream()) startMseStream();
        break;

      case 'audio_chunk': {
        const bin = atob(msg.data);
        const buf = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
        if (mediaSourceRef.current) appendMseChunk(buf);
        else chunksRef.current.push(buf);
        break;
      }

      case 'audio_end':
        if (mediaSourceRef.current) endMseStream();
        else playTts();
        break;

      // Server ended the session (booking done + user declined further help).
      // Arm the close; afterAudio() runs it once the goodbye TTS finishes.
      // If we're not speaking (edge case), run it immediately.
      case 'session_complete':
        closeRef.current = { navigate: !!msg.navigate, booking: msg.booking || null };
        // Fallback: guarantee navigation even if the goodbye TTS never fires onended.
        if (closeFallbackRef.current) clearTimeout(closeFallbackRef.current);
        closeFallbackRef.current = setTimeout(() => finishClose(), 9000);
        if (!speakingRef.current) finishClose();
        break;

      case 'low_confidence':
        break; // server will send follow-up audio asking to repeat

      // Server sends this when submitted audio was too short / no speech detected.
      // Reopen the mic so the user can try again.
      case 'start_listening':
        if (!micDeniedRef.current) {
          setListening(true);
          startRecorder();
        }
        break;

      case 'error':
        console.error('Server error:', msg.message);
        setError(msg.message);
        setIsSpeaking(false);
        onErrorRef.current?.(msg.message);
        if (!micDeniedRef.current) {
          setListening(true);
          wsRef.current?.send(JSON.stringify({ type: 'start_listening' }));
          startRecorder();
        }
        break;
    }
  }, [setListening, stopRecorder, playTts, startMseStream, appendMseChunk, endMseStream, startRecorder, finishClose]);

  // ── Session start ─────────────────────────────────────────────────────────
  const startSession = useCallback(async () => {
    abortRef.current = false;
    setError(null);
    setMessages([]);
    confirmedRef.current = null;

    // Unlock the <audio> element within this tap so iOS Safari allows the TTS
    // playback that arrives asynchronously later. Must run before any await.
    primeAudioEl();

    // AudioContext for volume visualiser only
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx() as AudioContext;
    audioCtxRef.current = ctx;
    if (ctx.state === 'suspended') await ctx.resume().catch(() => {});

    const host     = window.location.host;
    const protocol = window.location.protocol;

    // Mic + WSS handshake in parallel
    const [micRes, wssRes] = await Promise.allSettled([
      navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,   // filters speaker output from mic — essential for barge-in
          noiseSuppression: true,   // reduces ambient background noise
          autoGainControl: true,    // normalises mic input level across devices
          channelCount: 1,          // mono — reduces chunk size
        },
        video: false,
      }),
      fetch(`${protocol}//${host}/api/voice`).then(r => r.json()),
    ]);

    if (abortRef.current) return;

    if (micRes.status === 'fulfilled') {
      const stream = micRes.value;
      micStreamRef.current = stream;
      setMicDeniedFn(false);

      // mic → analyser → zero-gain node → destination (keeps AudioContext alive, no echo)
      const src      = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      src.connect(analyser);
      analyser.connect(gain);
      gain.connect(ctx.destination);
      analyserRef.current = analyser;
    } else {
      console.warn('Mic denied:', (micRes as any).reason);
      setMicDeniedFn(true);
    }

    if (wssRes.status === 'rejected' || !(wssRes as any).value?.success) {
      setError('Failed to initialise voice server');
      onErrorRef.current?.('Failed to initialise voice server');
      doCleanup();
      return;
    }

    if (abortRef.current) return;

    const wsProto = protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${wsProto}//${host}/api/voice`);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      setIsSpeaking(true); // agent greets first
      startVolumeLoop();
    };

    // ws.onmessage uses a stable ref so it always calls the latest handleMsg
    // even though handleMsg itself is useCallback-memoised.
    const handleMsgRef = { current: handleMsg };
    ws.onmessage = (event) => {
      if (typeof event.data !== 'string') return;
      try { handleMsgRef.current(JSON.parse(event.data)); }
      catch (e) { console.error('WS parse error:', e); }
    };
    // Keep handleMsgRef current on every render
    // (We update it via a layout effect below — see handleMsgRefEffect)
    (ws as any).__handleMsgRef = handleMsgRef;

    ws.onerror = () => { setError('Connection error'); onErrorRef.current?.('Connection error'); };
    ws.onclose = () => { if (!abortRef.current) doCleanup(); };
  }, [setListening, setMicDeniedFn, doCleanup, handleMsg, startVolumeLoop, primeAudioEl]);

  // Keep the ws handleMsgRef current whenever handleMsg is recreated
  useEffect(() => {
    const ref = (wsRef.current as any)?.__handleMsgRef;
    if (ref) ref.current = handleMsg;
  }, [handleMsg]);

  const stopSession = useCallback(() => doCleanup(), [doCleanup]);

  const sendMessage = useCallback((text: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    stopRecorder();
    stopAudio();
    setListening(false);
    setIsSpeaking(true);
    wsRef.current.send(JSON.stringify({ type: 'text_input', text }));
  }, [stopRecorder, stopAudio, setListening]);

  return {
    isConnected,
    isListening,
    isSpeaking,
    messages,
    error,
    inputVolume,
    outputVolume: 0,
    micPermissionDenied,
    sessionState,
    startSession,
    stopSession,
    sendMessage,
    interrupt: handleBargeIn,  // call this from the UI "Tap to Interrupt" button
  };
}
