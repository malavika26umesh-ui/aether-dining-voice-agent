/**
 * Sprint 4 — Dialogue Manager & Happy Path Booking
 * Unit tests for codeGenerator, intentDetector, slotFiller, and stateMachine.
 */

// ---------------------------------------------------------------------------
// Mocks — must be at the top before any imports
// ---------------------------------------------------------------------------
const mockGenerateContent = jest.fn();
jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn().mockReturnValue({ generateContent: mockGenerateContent }),
  })),
  SchemaType: { OBJECT: 'OBJECT', STRING: 'STRING', NUMBER: 'NUMBER', INTEGER: 'INTEGER' },
}));

// googleapis is an indirect dep (stateMachine → calendar.ts)
jest.mock('googleapis', () => ({
  google: {
    auth: { GoogleAuth: jest.fn() },
    calendar: jest.fn().mockReturnValue({
      events: { insert: jest.fn(), delete: jest.fn(), get: jest.fn(), update: jest.fn() },
    }),
    sheets: jest.fn().mockReturnValue({
      spreadsheets: { values: { append: jest.fn(), get: jest.fn(), update: jest.fn() } },
    }),
  },
}));

const MOCK_INVENTORY = {
  '2026-06-28': {
    'Standard Dining': ['12:00', '13:30', '19:00', '20:30'],
    'Large Group (6+)': ['19:00'],
    'Outdoor/Patio': ['12:30', '19:30'],
    'Special Occasion/Anniversary': ['19:00', '20:30'],
    'Bar/Lounge': ['18:00', '19:30', '21:00'],
  },
};

jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  readFileSync: jest.fn().mockImplementation((p: string) => {
    if (typeof p === 'string' && p.includes('mockInventory')) {
      return JSON.stringify(MOCK_INVENTORY);
    }
    // For types.ts file content check — delegate to actual fs
    const realFs = jest.requireActual('fs') as typeof import('fs');
    return realFs.readFileSync(p, 'utf8');
  }),
}));

// ---------------------------------------------------------------------------
// codeGenerator
// ---------------------------------------------------------------------------
describe('Sprint 4 – codeGenerator', () => {
  let generateReservationCode: () => string;

  beforeAll(async () => {
    ({ generateReservationCode } = await import('@/lib/dialogue/codeGenerator'));
  });

  it('generates a code matching TABLE-[A-Z][0-9][0-9]', () => {
    const code = generateReservationCode();
    expect(code).toMatch(/^TABLE-[A-Z]\d{2}$/);
  });

  it('does not include the letter I in the random letter', () => {
    const codes = Array.from({ length: 100 }, () => generateReservationCode());
    const letters = codes.map((c) => c[6]);
    expect(letters).not.toContain('I');
  });

  it('does not include the letter O in the random letter', () => {
    const codes = Array.from({ length: 100 }, () => generateReservationCode());
    const letters = codes.map((c) => c[6]);
    expect(letters).not.toContain('O');
  });

  it('generates codes with a 2-digit suffix', () => {
    const code = generateReservationCode();
    const suffix = code.slice(7);
    expect(suffix).toMatch(/^\d{2}$/);
  });

  it('increments the daily counter sequentially', () => {
    let freshGen: () => string;
    jest.isolateModules(() => {
      ({ generateReservationCode: freshGen } = require('@/lib/dialogue/codeGenerator'));
    });
    const c1 = freshGen!();
    const c2 = freshGen!();
    const n1 = parseInt(c1.slice(7), 10);
    const n2 = parseInt(c2.slice(7), 10);
    expect(n2).toBe(n1 + 1);
  });

  it('counter rolls over at 100 (00 after 99)', () => {
    let freshGen: () => string;
    jest.isolateModules(() => {
      ({ generateReservationCode: freshGen } = require('@/lib/dialogue/codeGenerator'));
    });
    let last = '';
    for (let i = 0; i < 100; i++) last = freshGen!();
    expect(last.slice(7)).toBe('99');
    const wrapped = freshGen!();
    expect(wrapped.slice(7)).toBe('00');
  });
});

// ---------------------------------------------------------------------------
// intentDetector
// ---------------------------------------------------------------------------
describe('Sprint 4 – intentDetector', () => {
  let detectIntent: (utterance: string, history: any[]) => Promise<{ intent: string; confidence: number }>;

  beforeAll(async () => {
    process.env.GOOGLE_API_KEY = 'test-key';
    ({ detectIntent } = await import('@/lib/dialogue/intentDetector'));
  });

  beforeEach(() => mockGenerateContent.mockReset());

  const intentCases: Array<[string, string]> = [
    ['book_new', 'I want to book a table for Saturday evening'],
    ['cancel', 'Please cancel my reservation TABLE-R07'],
    ['reschedule', 'I need to reschedule my booking'],
    ['check_availability', 'Do you have tables available on Friday?'],
    ['unknown', 'What is the weather today?'],
  ];

  test.each(intentCases)('classifies "%s" intent correctly', async (expectedIntent, utterance) => {
    mockGenerateContent.mockResolvedValueOnce({
      response: { text: () => JSON.stringify({ intent: expectedIntent, confidence: 0.95 }) },
    });
    const result = await detectIntent(utterance, []);
    expect(result.intent).toBe(expectedIntent);
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('returns unknown intent when Gemini call fails', async () => {
    mockGenerateContent.mockRejectedValueOnce(new Error('Network error'));
    const result = await detectIntent('hello', []);
    expect(result.intent).toBe('unknown');
    expect(result.confidence).toBe(0);
  });

  it('throws when GOOGLE_API_KEY is not set', async () => {
    const savedKey = process.env.GOOGLE_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    // detectIntent checks the env var at call time, not at import time
    const { detectIntent: freshDetect } = await import('@/lib/dialogue/intentDetector');
    await expect(freshDetect('hello', [])).rejects.toThrow(/GOOGLE_API_KEY/);
    process.env.GOOGLE_API_KEY = savedKey;
  });
});

// ---------------------------------------------------------------------------
// slotFiller
// ---------------------------------------------------------------------------
describe('Sprint 4 – slotFiller', () => {
  let fillSlots: (utterance: string, history: any[], refDate?: string) => Promise<any>;

  beforeAll(async () => {
    process.env.GOOGLE_API_KEY = 'test-key';
    ({ fillSlots } = await import('@/lib/dialogue/slotFiller'));
  });

  beforeEach(() => mockGenerateContent.mockReset());

  it('extracts occasion correctly', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      response: { text: () => JSON.stringify({ occasion: 'Special Occasion/Anniversary', date: '2026-06-28', time: '19:00', partySize: 2 }) },
    });
    const result = await fillSlots("It's our anniversary, table for 2 on Sunday at 7 PM", [], '2026-06-28');
    expect(result.occasion).toBe('Special Occasion/Anniversary');
  });

  it('converts relative date "tomorrow" to absolute ISO date', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      response: { text: () => JSON.stringify({ occasion: null, date: '2026-06-29', time: null, partySize: null }) },
    });
    const result = await fillSlots('Book a table for tomorrow', [], '2026-06-28');
    expect(result.date).toBe('2026-06-29');
  });

  it('converts "7 PM" to "19:00"', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      response: { text: () => JSON.stringify({ occasion: null, date: null, time: '19:00', partySize: null }) },
    });
    const result = await fillSlots('At 7 PM please', [], '2026-06-28');
    expect(result.time).toBe('19:00');
  });

  it('returns nulls for slots not mentioned', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      response: { text: () => JSON.stringify({ occasion: null, date: null, time: null, partySize: null }) },
    });
    const result = await fillSlots('Yes', [], '2026-06-28');
    expect(result.occasion).toBeNull();
    expect(result.date).toBeNull();
    expect(result.time).toBeNull();
    expect(result.partySize).toBeNull();
  });

  it('returns all-null result on Gemini failure', async () => {
    mockGenerateContent.mockRejectedValueOnce(new Error('API error'));
    const result = await fillSlots('Book table', [], '2026-06-28');
    expect(result).toEqual({ occasion: null, date: null, time: null, partySize: null });
  });

  it('extracts party size as integer', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      response: { text: () => JSON.stringify({ occasion: 'Large Group (6+)', date: '2026-06-28', time: '19:00', partySize: 8 }) },
    });
    const result = await fillSlots('We are a group of 8 for Saturday at 7 PM', [], '2026-06-28');
    expect(result.partySize).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// stateMachine — processDialogueTurn (happy path)
// ---------------------------------------------------------------------------
describe('Sprint 4 – stateMachine (happy path)', () => {
  let processDialogueTurn: (state: any, utterance: string) => Promise<any>;

  beforeAll(async () => {
    process.env.GOOGLE_API_KEY = 'test-key';
    const mod = await import('@/lib/dialogue/stateMachine');
    processDialogueTurn = mod.processDialogueTurn;
  });

  it('exports processDialogueTurn', () => {
    expect(typeof processDialogueTurn).toBe('function');
  });

  it('transitions from unknown to book_new intent', async () => {
    mockGenerateContent
      .mockResolvedValueOnce({ response: { text: () => JSON.stringify({ intent: 'book_new', confidence: 0.97 }) } })
      .mockResolvedValueOnce({ response: { text: () => JSON.stringify({ occasion: 'Standard Dining', date: null, time: null, partySize: null }) } })
      .mockResolvedValueOnce({ response: { text: () => 'Welcome! What type of dining occasion are you looking for?' } });

    const initialState = {
      sessionId: 'sess_test_001', intent: 'unknown', occasion: null, date: null, time: null,
      partySize: null, offeredSlots: [], confirmedSlot: null, reservationCode: null,
      turnCount: 0, awaitingConfirmation: false, conversationHistory: [],
      calendarEventId: null, sheetsRowIndex: null,
      intentPhase: null, existingCode: null, existingDate: null, existingTime: null,
      existingOccasion: null, newDate: null, newTime: null, existingCalendarEventId: null,
    };

    const result = await processDialogueTurn('I want to book a table', initialState);
    expect(result.updatedState.intent).toBe('book_new');
    expect(result.responseText).toBeTruthy();
  });

  it('offers up to 3 available slots', async () => {
    mockGenerateContent
      .mockResolvedValueOnce({ response: { text: () => JSON.stringify({ intent: 'book_new', confidence: 0.95 }) } })
      .mockResolvedValueOnce({ response: { text: () => JSON.stringify({ occasion: 'Standard Dining', date: '2026-06-28', time: null, partySize: null }) } })
      .mockResolvedValueOnce({ response: { text: () => 'We have 12:00, 13:30, and 19:00 IST available.' } });

    const state = {
      sessionId: 'sess_test_002', intent: 'book_new', occasion: null, date: null, time: null,
      partySize: null, offeredSlots: [], confirmedSlot: null, reservationCode: null,
      turnCount: 1, awaitingConfirmation: false, conversationHistory: [],
      calendarEventId: null, sheetsRowIndex: null,
      intentPhase: null, existingCode: null, existingDate: null, existingTime: null,
      existingOccasion: null, newDate: null, newTime: null, existingCalendarEventId: null,
    };

    const result = await processDialogueTurn('Standard dining this Sunday', state);
    expect(result.updatedState.offeredSlots.length).toBeLessThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// SessionState interface shape
// ---------------------------------------------------------------------------
describe('Sprint 4 – SessionState type completeness', () => {
  it('types.ts exports SessionState with all required fields', async () => {
    const realFs = jest.requireActual('fs') as typeof import('fs');
    const path = await import('path');
    const typesPath = path.join(process.cwd(), 'lib/dialogue/types.ts');
    expect(realFs.existsSync(typesPath)).toBe(true);
    const content = realFs.readFileSync(typesPath, 'utf8');
    expect(content).toMatch(/sessionId/);
    expect(content).toMatch(/intent/);
    expect(content).toMatch(/occasion/);
    expect(content).toMatch(/date/);
    expect(content).toMatch(/time/);
    expect(content).toMatch(/partySize/);
    expect(content).toMatch(/reservationCode/);
    expect(content).toMatch(/awaitingConfirmation/);
    expect(content).toMatch(/conversationHistory/);
  });
});
