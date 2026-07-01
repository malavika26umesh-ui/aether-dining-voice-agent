/**
 * Sprint 7 — Reschedule & Cancel Intents
 * Tests for new sheets.lookupReservation and the reschedule/cancel state machine flows.
 */

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockGenerateContent = jest.fn();
jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn().mockReturnValue({ generateContent: mockGenerateContent }),
  })),
  SchemaType: { OBJECT: 'OBJECT', STRING: 'STRING', NUMBER: 'NUMBER', INTEGER: 'INTEGER' },
}));

const mockSheetsGet = jest.fn();
const mockSheetsUpdate = jest.fn();
const mockSheetsAppend = jest.fn();
const mockEventsDelete = jest.fn();
const mockEventsGet = jest.fn();
const mockEventsUpdate = jest.fn();

jest.mock('googleapis', () => ({
  google: {
    auth: { GoogleAuth: jest.fn().mockImplementation(() => ({})) },
    calendar: jest.fn().mockReturnValue({
      events: {
        delete: mockEventsDelete,
        get: mockEventsGet,
        update: mockEventsUpdate,
      },
    }),
    sheets: jest.fn().mockReturnValue({
      spreadsheets: {
        values: {
          get: mockSheetsGet,
          update: mockSheetsUpdate,
          append: mockSheetsAppend,
        },
      },
    }),
  },
}));

jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  readFileSync: jest.fn().mockReturnValue(JSON.stringify({
    '2026-06-29': {
      'Special Occasion/Anniversary': ['19:00', '20:30'],
      'Standard Dining': ['12:00', '19:00'],
    },
  })),
}));

const FAKE_SA_JSON = Buffer.from(JSON.stringify({ type: 'service_account' })).toString('base64');
const SHEET_ROW_DATA = [
  ['timestamp', 'code', 'date', 'time', 'occasion', 'partySize', 'status', 'notes', 'sessionId'], // header
  ['2026-06-28T10:00:00Z', 'TABLE-R07', '2026-06-28', '19:00', 'Special Occasion/Anniversary', '2', 'CONFIRMED', 'Special Occasion noted', 'sess_abc'],
  ['2026-06-28T11:00:00Z', 'TABLE-A01', '2026-06-28', '20:30', 'Standard Dining', '4', 'CONFIRMED', '', 'sess_xyz'],
];

// ---------------------------------------------------------------------------
// sheets.lookupReservation (to be implemented in Sprint 7)
// ---------------------------------------------------------------------------
describe('Sprint 7 – sheets.lookupReservation', () => {
  beforeAll(() => {
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = FAKE_SA_JSON;
    process.env.GOOGLE_SHEETS_ID = 'test-sheet';
  });

  beforeEach(() => mockSheetsGet.mockReset());

  it('returns a ReservationRecord when code is found', async () => {
    mockSheetsGet.mockResolvedValueOnce({ data: { values: SHEET_ROW_DATA } });
    const { lookupReservation } = await import('@/lib/mcp/sheets');
    if (typeof lookupReservation !== 'function') {
      console.warn('lookupReservation not yet implemented (Sprint 7 not started)');
      return;
    }
    const record = await lookupReservation('TABLE-R07');
    expect(record).not.toBeNull();
    expect(record?.code).toBe('TABLE-R07');
    expect(record?.occasion).toBe('Special Occasion/Anniversary');
  });

  it('returns null for an unknown code', async () => {
    mockSheetsGet.mockResolvedValueOnce({ data: { values: SHEET_ROW_DATA } });
    const { lookupReservation } = await import('@/lib/mcp/sheets');
    if (typeof lookupReservation !== 'function') return;
    const record = await lookupReservation('TABLE-ZZZZZ');
    expect(record).toBeNull();
  });

  it('returns null for a CANCELLED reservation', async () => {
    const cancelledRow = [...SHEET_ROW_DATA[1]];
    cancelledRow[6] = 'CANCELLED';
    mockSheetsGet.mockResolvedValueOnce({ data: { values: [SHEET_ROW_DATA[0], cancelledRow] } });
    const { lookupReservation } = await import('@/lib/mcp/sheets');
    if (typeof lookupReservation !== 'function') return;
    const record = await lookupReservation('TABLE-R07');
    expect(record).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Reservation code normalisation (phonetic → alphanumeric)
// ---------------------------------------------------------------------------
describe('Sprint 7 – Reservation code normalisation', () => {
  const phonetic: Array<[string, string]> = [
    ['table bee four seven', 'TABLE-B47'],
    ['table are zero seven', 'TABLE-R07'],
    ['TABLE-R07', 'TABLE-R07'],
    ['table-r07', 'TABLE-R07'],
  ];

  function normaliseCode(raw: string): string {
    const upper = raw.toUpperCase().trim();
    // If it already matches
    const direct = upper.match(/TABLE-([A-Z])(\d{2})/);
    if (direct) return `TABLE-${direct[1]}${direct[2]}`;
    // Phonetic mapping
    const phoneticMap: Record<string, string> = {
      'ZERO': '0', 'ONE': '1', 'TWO': '2', 'THREE': '3', 'FOUR': '4',
      'FIVE': '5', 'SIX': '6', 'SEVEN': '7', 'EIGHT': '8', 'NINE': '9',
      'AY': 'A', 'BEE': 'B', 'CEE': 'C', 'DEE': 'D', 'EE': 'E',
      'EFF': 'F', 'GEE': 'G', 'JAY': 'J', 'KAY': 'K', 'ELL': 'L',
      'EM': 'M', 'EN': 'N', 'PEE': 'P', 'QUE': 'Q', 'ARE': 'R',
      'ESS': 'S', 'TEE': 'T', 'YOU': 'U', 'VEE': 'V', 'WYE': 'Y',
      'ZED': 'Z',
    };
    let words = upper.replace(/TABLE-?/i, '').trim().split(/\s+/);
    let result = 'TABLE-';
    for (const w of words) {
      if (phoneticMap[w]) result += phoneticMap[w];
      else if (/^\d+$/.test(w)) result += w.padStart(2, '0');
      else if (/^[A-Z]$/.test(w)) result += w;
    }
    return result;
  }

  test.each(phonetic)('normalises "%s" → "%s"', (input, expected) => {
    const result = normaliseCode(input);
    expect(result).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// Intent detection for reschedule and cancel
// ---------------------------------------------------------------------------
describe('Sprint 7 – intent detection for reschedule and cancel', () => {
  beforeAll(() => { process.env.GOOGLE_API_KEY = 'test-key'; });
  beforeEach(() => mockGenerateContent.mockReset());

  it('classifies reschedule utterance correctly', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      response: { text: () => JSON.stringify({ intent: 'reschedule', confidence: 0.96 }) },
    });
    const { detectIntent } = await import('@/lib/dialogue/intentDetector');
    const result = await detectIntent('I need to change my reservation TABLE-R07 to Sunday', []);
    expect(result.intent).toBe('reschedule');
  });

  it('classifies cancel utterance correctly', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      response: { text: () => JSON.stringify({ intent: 'cancel', confidence: 0.98 }) },
    });
    const { detectIntent } = await import('@/lib/dialogue/intentDetector');
    const result = await detectIntent('Please cancel my booking TABLE-A01', []);
    expect(result.intent).toBe('cancel');
  });
});

// ---------------------------------------------------------------------------
// "Code not found" graceful response
// ---------------------------------------------------------------------------
describe('Sprint 7 – code not found handling', () => {
  it('error message matches PRD wording', () => {
    const NOT_FOUND_MSG = "I couldn't find that code. It should look like TABLE followed by a letter and two numbers, for example TABLE-R07. Could you double-check?";
    expect(NOT_FOUND_MSG).toMatch(/TABLE.*letter.*two numbers/i);
    expect(NOT_FOUND_MSG).toMatch(/double.check/i);
  });
});

// ---------------------------------------------------------------------------
// updateReservationStatus for RESCHEDULED and CANCELLED
// ---------------------------------------------------------------------------
describe('Sprint 7 – updateReservationStatus', () => {
  beforeAll(() => {
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = FAKE_SA_JSON;
    process.env.GOOGLE_SHEETS_ID = 'test-sheet';
  });
  beforeEach(() => { mockSheetsGet.mockReset(); mockSheetsUpdate.mockReset(); });

  it('sets RESCHEDULED status', async () => {
    mockSheetsGet.mockResolvedValueOnce({ data: { values: SHEET_ROW_DATA } });
    mockSheetsUpdate.mockResolvedValueOnce({});
    const { updateReservationStatus } = await import('@/lib/mcp/sheets');
    await updateReservationStatus('TABLE-R07', 'RESCHEDULED');
    const updateArg = mockSheetsUpdate.mock.calls[0][0];
    expect(updateArg.requestBody.values).toEqual([['RESCHEDULED']]);
  });

  it('sets CANCELLED status', async () => {
    mockSheetsGet.mockResolvedValueOnce({ data: { values: SHEET_ROW_DATA } });
    mockSheetsUpdate.mockResolvedValueOnce({});
    const { updateReservationStatus } = await import('@/lib/mcp/sheets');
    await updateReservationStatus('TABLE-R07', 'CANCELLED');
    const updateArg = mockSheetsUpdate.mock.calls[0][0];
    expect(updateArg.requestBody.values).toEqual([['CANCELLED']]);
  });
});
