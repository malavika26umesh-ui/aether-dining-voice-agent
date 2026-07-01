import { groqChatJSON } from './groqChat';

export interface SlotExtractionResult {
  occasion: string | null;
  date: string | null;       // YYYY-MM-DD
  time: string | null;       // HH:MM
  partySize: number | null;
}

/**
 * Extracts slot values (occasion, date, time, partySize) from the user utterance using Groq.
 * Performs relative date parsing to absolute YYYY-MM-DD using the reference date.
 */
export async function fillSlots(
  utterance: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  referenceDateStr: string = '2026-06-14'
): Promise<SlotExtractionResult> {
  const contextStr = history
    .slice(-4)
    .map((m) => `${m.role === 'assistant' ? 'Agent' : 'User'}: ${m.content}`)
    .join('\n');

  const refDate = new Date(referenceDateStr);
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const refDayName = weekdays[refDate.getDay()];

  const system = `You are a slot extraction assistant for "Aether Dining" table reservations.
Analyze the user's latest utterance and the recent conversation history to extract booking details.

Reference current date context:
- Today is: ${refDayName}, ${referenceDateStr}

Extraction Rules:
1. "occasion": Must be exactly one of: "Standard Dining", "Large Group (6+)", "Outdoor/Patio", "Special Occasion/Anniversary", "Bar/Lounge".
   Map user terms:
   - "anniversary", "birthday", "celebration", "special occasion" -> "Special Occasion/Anniversary"
   - "patio", "outdoor", "outside", "garden" -> "Outdoor/Patio"
   - "bar", "lounge", "counter", "drinks" -> "Bar/Lounge"
   - "group", "family reservation", "gathering" (and size is 6 or more) -> "Large Group (6+)"
   - "default", "table", "dinner", "lunch", "standard" -> "Standard Dining"
2. "date": Convert relative date descriptions (e.g. "today", "tomorrow", "this Saturday", "next week Monday") into absolute YYYY-MM-DD format using the reference date ${referenceDateStr}.
   Examples:
   - If today is Sunday, 2026-06-14:
     - "today" -> "2026-06-14"
     - "tomorrow" -> "2026-06-15"
     - "this Saturday" -> "2026-06-20"
     - "next Sunday" -> "2026-06-21"
3. "time": Convert time descriptions to 24-hour HH:MM format (e.g., "7 PM" -> "19:00", "8:30 in the evening" -> "20:30", "1:30 PM" -> "13:30").
4. "partySize": The number of guests as an integer.

If a slot is missing or not mentioned, return null for that field.

Respond ONLY with a JSON object of the exact shape:
{"occasion": string|null, "date": "YYYY-MM-DD"|null, "time": "HH:MM"|null, "partySize": integer|null}`;

  const user = `Conversation Context:
${contextStr}

User's Latest Utterance: "${utterance}"`;

  try {
    const parsed = await groqChatJSON<SlotExtractionResult>({ system, user });
    return {
      occasion: parsed.occasion ?? null,
      date: parsed.date ?? null,
      time: parsed.time ?? null,
      partySize: parsed.partySize ?? null,
    };
  } catch (error) {
    console.error('Error in slot filler:', error);
    return { occasion: null, date: null, time: null, partySize: null };
  }
}
