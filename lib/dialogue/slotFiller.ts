import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

export interface SlotExtractionResult {
  occasion: string | null;
  date: string | null;       // YYYY-MM-DD
  time: string | null;       // HH:MM
  partySize: number | null;
}

/**
 * Extracts slot values (occasion, date, time, partySize) from the user utterance using Gemini.
 * Performs relative date parsing to absolute YYYY-MM-DD using the reference date.
 */
export async function fillSlots(
  utterance: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  referenceDateStr: string = '2026-06-14'
): Promise<SlotExtractionResult> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_API_KEY is not defined in environment variables');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    // thinkingConfig is supported by the API but not yet in the SDK's TS types.
    generationConfig: {
      thinkingConfig: { thinkingBudget: 0 },
      responseMimeType: 'application/json',
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          occasion: {
            type: SchemaType.STRING,
            enum: [
              'Standard Dining',
              'Large Group (6+)',
              'Outdoor/Patio',
              'Special Occasion/Anniversary',
              'Bar/Lounge',
            ],
            nullable: true,
          },
          date: { type: SchemaType.STRING, nullable: true },
          time: { type: SchemaType.STRING, nullable: true },
          partySize: { type: SchemaType.INTEGER, nullable: true },
        },
      } as any,
    } as any,
  });

  const contextStr = history
    .slice(-4)
    .map((m) => `${m.role === 'assistant' ? 'Agent' : 'User'}: ${m.content}`)
    .join('\n');

  const refDate = new Date(referenceDateStr);
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const refDayName = weekdays[refDate.getDay()];

  const prompt = `You are a slot extraction assistant for "Aether Dining" table reservations.
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

Conversation Context:
${contextStr}

User's Latest Utterance: "${utterance}"

Return JSON:`;

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();
    const parsed = JSON.parse(responseText) as SlotExtractionResult;
    return parsed;
  } catch (error) {
    console.error('Error in slot filler:', error);
    return { occasion: null, date: null, time: null, partySize: null };
  }
}
