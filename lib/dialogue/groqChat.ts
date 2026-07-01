/**
 * Groq chat helper — OpenAI-compatible JSON-mode completion.
 *
 * The dialogue pipeline (intent detection, slot filling, response generation,
 * confirmation) runs on Groq rather than Gemini. Groq's free tier has far higher
 * request limits than Gemini's free tier (which caps gemini-2.5-flash at ~20
 * requests/day), so the voice agent can run daily without hitting a quota wall.
 *
 * Groq exposes the same `/openai/v1/chat/completions` shape used for Whisper STT
 * in app/api/voice/route.ts, so we reuse GROQ_API_KEY and a plain fetch — no SDK.
 */

// Fast, capable model with JSON-mode support and a generous free tier.
const DIALOGUE_MODEL = 'llama-3.3-70b-versatile';

interface GroqChatOptions {
  /** System instruction (role/task framing). */
  system: string;
  /** User content (the actual utterance + context). */
  user: string;
  /** When true, force valid-JSON output via response_format. Default true. */
  json?: boolean;
  /** Sampling temperature. Default 0.2 for deterministic extraction/classification. */
  temperature?: number;
  /** Cap output length. */
  maxTokens?: number;
}

/**
 * Runs a single-shot chat completion on Groq and returns the raw assistant text.
 * Throws on missing key or non-2xx response so callers can fall back.
 */
export async function groqChat(opts: GroqChatOptions): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('Missing GROQ_API_KEY');

  const body: Record<string, unknown> = {
    model: DIALOGUE_MODEL,
    messages: [
      { role: 'system', content: opts.system },
      { role: 'user', content: opts.user },
    ],
    temperature: opts.temperature ?? 0.2,
  };
  if (opts.json !== false) {
    body.response_format = { type: 'json_object' };
    // Groq requires the literal word "json" somewhere in the messages when
    // json_object mode is on, else it 400s. Guarantee it defensively.
    const hasJsonWord = /json/i.test(opts.system) || /json/i.test(opts.user);
    if (!hasJsonWord) {
      (body.messages as Array<{ role: string; content: string }>).push({
        role: 'system',
        content: 'Respond with valid JSON only.',
      });
    }
  }
  if (opts.maxTokens) body.max_tokens = opts.maxTokens;

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Groq chat ${res.status}: ${errText}`);
  }

  const data = await res.json();
  return (data?.choices?.[0]?.message?.content ?? '').trim();
}

/**
 * Convenience wrapper: run a JSON-mode completion and parse the result.
 * Strips accidental ```json fences before parsing.
 */
export async function groqChatJSON<T>(opts: GroqChatOptions): Promise<T> {
  const text = await groqChat({ ...opts, json: true });
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  return JSON.parse(cleaned) as T;
}
