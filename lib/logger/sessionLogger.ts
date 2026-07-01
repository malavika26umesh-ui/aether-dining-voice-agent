/**
 * Structured per-session JSONL logger.
 * Each session gets its own file: logs/sessions/<sessionId>.jsonl
 * Every event is a JSON object on its own line — easy to tail, grep, and parse.
 *
 * Usage:
 *   const log = createSessionLogger(sessionId);
 *   log.sessionStart({ resumed: false });
 *   log.userTurn({ transcript, confidence, audioBytes, vadMs });
 *   log.agentTurn({ intent, slots, responseText, latencyMs });
 *   log.guardrailFired({ rule, input });
 *   log.mcpCall({ operation, success, latencyMs, error });
 *   log.error({ stage, message, stack });
 *   log.sessionEnd({ reason, turns });
 */

import fs from 'fs';
import path from 'path';

export type LogEventType =
  | 'session_start'
  | 'session_end'
  | 'user_turn'
  | 'agent_turn'
  | 'guardrail_fired'
  | 'mcp_call'
  | 'stt_result'
  | 'tts_sent'
  | 'intent_detected'
  | 'slot_filled'
  | 'availability_checked'
  | 'confirmation_check'
  | 'error'
  | 'silence_nudge'
  | 'silence_timeout'
  | 'low_confidence'
  | 'audio_too_short'
  | 'barge_in'
  | 'code_issued'
  | 'session_resumed';

export interface LogEvent {
  ts: string;           // ISO timestamp
  sessionId: string;
  event: LogEventType;
  data: Record<string, unknown>;
}

function logsDir(): string {
  return path.join(process.cwd(), 'logs', 'sessions');
}

function ensureDir() {
  try {
    fs.mkdirSync(logsDir(), { recursive: true });
  } catch (_) {}
}

function append(sessionId: string, entry: LogEvent) {
  try {
    ensureDir();
    const file = path.join(logsDir(), `${sessionId}.jsonl`);
    fs.appendFileSync(file, JSON.stringify(entry) + '\n', 'utf8');
  } catch (err) {
    // Never let logging break the voice session
    console.error('[Logger] Failed to write log:', err);
  }
}

function now() {
  return new Date().toISOString();
}

export function createSessionLogger(sessionId: string) {
  function write(event: LogEventType, data: Record<string, unknown> = {}) {
    append(sessionId, { ts: now(), sessionId, event, data });
  }

  return {
    sessionStart(data: { resumed: boolean; userAgent?: string }) {
      write('session_start', data);
    },

    sessionResumed(data: { lastActiveMs: number }) {
      write('session_resumed', data);
    },

    sessionEnd(data: { reason: 'silence_timeout' | 'user_closed' | 'error' | 'booking_complete'; turns: number; durationMs: number }) {
      write('session_end', data);
    },

    /** Raw STT output from Gemini */
    sttResult(data: { audioBytes: number; transcript: string; confidence: number; latencyMs: number }) {
      write('stt_result', data);
      if (data.confidence < 0.7 || !data.transcript) {
        write('low_confidence', { transcript: data.transcript, confidence: data.confidence });
      }
    },

    /** Audio submitted was too short — skipped STT */
    audioTooShort(data: { bytes: number }) {
      write('audio_too_short', data);
    },

    /** Intent classification result */
    intentDetected(data: { utterance: string; intent: string; confidence: number; latencyMs: number }) {
      write('intent_detected', data);
    },

    /** Slot extraction result */
    slotFilled(data: { utterance: string; slots: Record<string, unknown>; latencyMs: number }) {
      write('slot_filled', data);
    },

    /** Availability query result */
    availabilityChecked(data: { date: string; occasion: string; slots: string[]; alternativeDates?: unknown[] }) {
      write('availability_checked', data);
    },

    /** Confirmation classifier result */
    confirmationCheck(data: { utterance: string; result: boolean | null; method: 'regex' | 'gemini' | 'fallback'; latencyMs: number }) {
      write('confirmation_check', data);
    },

    /** Full user turn (transcript → LLM response) */
    userTurn(data: { turnNum: number; transcript: string; confidence: number; intent: string; slots: Record<string, unknown> }) {
      write('user_turn', data);
    },

    /** Full agent response */
    agentTurn(data: { turnNum: number; responseText: string; ttsBytesEstimate?: number; totalLatencyMs: number }) {
      write('agent_turn', data);
    },

    /** TTS sent to client */
    ttsSent(data: { text: string; charCount: number; latencyMs: number }) {
      write('tts_sent', data);
    },

    /** A guardrail rule was activated */
    guardrailFired(data: { rule: string; input: string; response: string }) {
      write('guardrail_fired', { ...data });
      console.warn(`[Guardrail][${sessionId}] Rule: ${data.rule} | Input: "${data.input.slice(0, 80)}"`);
    },

    /** Google Calendar or Sheets MCP call */
    mcpCall(data: { operation: 'calendar_hold' | 'calendar_delete' | 'calendar_update' | 'sheets_append' | 'sheets_lookup' | 'sheets_update_status' | 'sheets_get_all'; success: boolean; latencyMs: number; attempt: number; error?: string }) {
      write('mcp_call', data);
      if (!data.success) {
        console.error(`[MCP][${sessionId}] ${data.operation} FAILED (attempt ${data.attempt}): ${data.error}`);
      }
    },

    /** Reservation code issued */
    codeIssued(data: { code: string; occasion: string; date: string; time: string; partySize?: number }) {
      write('code_issued', data);
      console.log(`[Code][${sessionId}] Issued: ${data.code} for ${data.occasion} on ${data.date} at ${data.time}`);
    },

    /** Silence nudge sent */
    silenceNudge(data: { elapsedMs: number }) {
      write('silence_nudge', data);
    },

    /** Session closed due to 20s silence */
    silenceTimeout(data: { elapsedMs: number }) {
      write('silence_timeout', data);
    },

    /** User spoke while agent was speaking (barge-in) */
    bargeIn(data: { agentWasSaying: string; userSaid?: string }) {
      write('barge_in', data);
    },

    /** Any unexpected error in the voice pipeline */
    error(data: { stage: string; message: string; stack?: string }) {
      write('error', data);
      console.error(`[Error][${sessionId}][${data.stage}] ${data.message}`);
    },
  };
}

export type SessionLogger = ReturnType<typeof createSessionLogger>;
