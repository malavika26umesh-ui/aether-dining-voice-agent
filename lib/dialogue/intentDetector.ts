import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

export type IntentType = 'unknown' | 'book_new' | 'reschedule' | 'cancel' | 'check_availability';

export interface IntentDetectionResult {
  intent: IntentType;
  confidence: number;
}

/**
 * Detects the user's intent from their latest utterance and context using Gemini.
 */
export async function detectIntent(
  utterance: string,
  history: { role: 'user' | 'assistant'; content: string }[]
): Promise<IntentDetectionResult> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_API_KEY is not defined in environment variables');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash-lite',
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          intent: {
            type: SchemaType.STRING,
            enum: ['unknown', 'book_new', 'reschedule', 'cancel', 'check_availability'],
          },
          confidence: { type: SchemaType.NUMBER },
        },
        required: ['intent', 'confidence'],
      } as any,
    },
  });

  const contextStr = history
    .slice(-4)
    .map((m) => `${m.role === 'assistant' ? 'Agent' : 'User'}: ${m.content}`)
    .join('\n');

  const prompt = `You are a conversation intent classifier for "Aether Dining" voice reservation assistant.
Analyze the user's latest utterance and the recent conversation history to identify the primary intent:

- 'book_new': user wants to make a new table reservation (e.g. "Reserve a table", "Book a table for Saturday", "We want to dine here").
- 'reschedule': user wants to modify, change, move or reschedule an existing reservation.
- 'cancel': user wants to cancel an existing reservation.
- 'check_availability': user is asking about availability, open timings, or if we have tables on a date without explicitly booking yet (e.g. "What timings are open on Friday?", "Do you have tables left?").
- 'unknown': small talk, greetings, unrelated questions, or out-of-scope requests.

Conversation Context:
${contextStr}

User's Latest Utterance: "${utterance}"

Return a JSON object with fields "intent" and "confidence".`;

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();
    const parsed = JSON.parse(responseText) as IntentDetectionResult;
    return parsed;
  } catch (error) {
    console.error('Error detecting intent:', error);
    return { intent: 'unknown', confidence: 0 };
  }
}
