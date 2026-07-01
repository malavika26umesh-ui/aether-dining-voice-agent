import { groqChatJSON } from './groqChat';

export type IntentType = 'unknown' | 'book_new' | 'reschedule' | 'cancel' | 'check_availability';

export interface IntentDetectionResult {
  intent: IntentType;
  confidence: number;
}

/**
 * Detects the user's intent from their latest utterance and context using Groq.
 */
export async function detectIntent(
  utterance: string,
  history: { role: 'user' | 'assistant'; content: string }[]
): Promise<IntentDetectionResult> {
  const contextStr = history
    .slice(-4)
    .map((m) => `${m.role === 'assistant' ? 'Agent' : 'User'}: ${m.content}`)
    .join('\n');

  const system = `You are a conversation intent classifier for "Aether Dining" voice reservation assistant.
Analyze the user's latest utterance and the recent conversation history to identify the primary intent:

- 'book_new': user wants to make a new table reservation (e.g. "Reserve a table", "Book a table for Saturday", "We want to dine here").
- 'reschedule': user wants to modify, change, move or reschedule an existing reservation.
- 'cancel': user wants to cancel an existing reservation.
- 'check_availability': user is asking about availability, open timings, or if we have tables on a date without explicitly booking yet (e.g. "What timings are open on Friday?", "Do you have tables left?").
- 'unknown': small talk, greetings, unrelated questions, or out-of-scope requests.

Respond ONLY with a JSON object of the exact shape:
{"intent": one of "unknown"|"book_new"|"reschedule"|"cancel"|"check_availability", "confidence": number between 0 and 1}`;

  const user = `Conversation Context:
${contextStr}

User's Latest Utterance: "${utterance}"`;

  try {
    const parsed = await groqChatJSON<IntentDetectionResult>({ system, user });
    return parsed;
  } catch (error) {
    console.error('Error detecting intent:', error);
    return { intent: 'unknown', confidence: 0 };
  }
}
