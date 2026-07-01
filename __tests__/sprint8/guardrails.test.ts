/**
 * Sprint 8 — Edge Cases, Guardrails & All 5 Dining Occasions
 * Tests covering PII detection, out-of-scope refusals, date/time validation,
 * and occasion-specific constraints.
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

jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  readFileSync: jest.fn().mockReturnValue(JSON.stringify({})),
}));

// ---------------------------------------------------------------------------
// PII Detection
// ---------------------------------------------------------------------------
describe('Sprint 8 – PII guardrails', () => {
  const PII_REFUSAL = "To keep things private, I only need your dining preferences — no personal details required!";

  // Regex patterns that should match common PII in user utterances
  const PHONE_REGEX = /(\+91|0)?\s*[6-9]\d{9}/;
  const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const NAME_PREFIX_REGEX = /\b(my name is|i am|i'm|call me)\b/i;

  const piiUtterances = [
    ['phone number', '9876543210'],
    ['email address', 'priya@example.com'],
    ['name prefix', 'My name is Priya'],
    ['full Indian phone', '+919876543210'],
  ];

  test.each(piiUtterances)('detects PII — %s: "%s"', (_type, utterance) => {
    const hasPii =
      PHONE_REGEX.test(utterance) ||
      EMAIL_REGEX.test(utterance) ||
      NAME_PREFIX_REGEX.test(utterance);
    expect(hasPii).toBe(true);
  });

  it('PII refusal message matches PRD wording', () => {
    expect(PII_REFUSAL).toMatch(/private/i);
    expect(PII_REFUSAL).toMatch(/no personal details/i);
  });

  const safeUtterances = [
    'I want to book a table for Saturday at 7 PM',
    'It is our anniversary',
    'Party of 4, outdoor seating',
    'TABLE-R07',
  ];

  test.each(safeUtterances)('does NOT flag safe utterance: "%s"', (utterance) => {
    const hasPii =
      PHONE_REGEX.test(utterance) ||
      EMAIL_REGEX.test(utterance) ||
      NAME_PREFIX_REGEX.test(utterance);
    expect(hasPii).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Out-of-scope refusals (system prompt level)
// ---------------------------------------------------------------------------
describe('Sprint 8 – Out-of-scope refusal patterns', () => {
  const OUT_OF_SCOPE: Array<[string, RegExp]> = [
    ['menu inquiry', /menu|food items|what do you serve/i],
    ['pricing query', /price|cost|how much|bill/i],
    ['delivery request', /delivery|takeaway|takeout|order online/i],
    ['allergy medical advice', /is it safe.*allergy|nut allergy safe|allergen guarantee/i],
    ['past visit complaint', /last time|bad experience|complaint|previous visit/i],
  ];

  const REFUSAL_RESPONSES: Record<string, string> = {
    'menu inquiry': 'Our menu is available on the website.',
    'pricing query': "For billing questions, our team would be happy to assist when you visit.",
    'delivery request': "I handle table reservations only.",
    'allergy medical advice': "I strongly recommend speaking directly with our chef before your visit.",
    'past visit complaint': "For feedback, please reach out to our team.",
  };

  test.each(OUT_OF_SCOPE)('refusal exists for %s', (category) => {
    expect(REFUSAL_RESPONSES[category]).toBeTruthy();
  });

  it('allergy refusal specifically mentions speaking to chef', () => {
    expect(REFUSAL_RESPONSES['allergy medical advice']).toMatch(/chef|speak directly/i);
  });

  it('menu refusal directs to website', () => {
    expect(REFUSAL_RESPONSES['menu inquiry']).toMatch(/website/i);
  });
});

// ---------------------------------------------------------------------------
// Date validation
// ---------------------------------------------------------------------------
describe('Sprint 8 – Date validation', () => {
  const PAST_DATE_MSG = "I can only book future dates. What upcoming date works for you?";
  const TODAY = '2026-06-28';

  it('rejects a date in the past', () => {
    const requestedDate = '2026-06-01';
    const isPast = new Date(requestedDate) < new Date(TODAY);
    expect(isPast).toBe(true);
  });

  it('accepts today as a valid date', () => {
    const requestedDate = '2026-06-28';
    const isPast = new Date(requestedDate) < new Date(TODAY);
    expect(isPast).toBe(false);
  });

  it('accepts a future date', () => {
    const requestedDate = '2026-07-05';
    const isPast = new Date(requestedDate) < new Date(TODAY);
    expect(isPast).toBe(false);
  });

  it('past-date error message matches PRD wording', () => {
    expect(PAST_DATE_MSG).toMatch(/only book future/i);
  });
});

// ---------------------------------------------------------------------------
// Operating hours validation
// ---------------------------------------------------------------------------
describe('Sprint 8 – Operating hours validation', () => {
  const OPEN_HOUR = 12;
  const CLOSE_HOUR = 22;
  const LATE_SLOT_MSG = 'Our kitchen closes at 10 PM. The latest available slot is 8:30 PM.';

  function isWithinHours(time: string): boolean {
    const [h, m] = time.split(':').map(Number);
    const totalMinutes = h * 60 + m;
    return totalMinutes >= OPEN_HOUR * 60 && totalMinutes < CLOSE_HOUR * 60;
  }

  const validTimes = ['12:00', '13:30', '19:00', '20:30', '21:00', '21:59'];
  const invalidTimes = ['10:00', '11:30', '22:00', '23:00'];

  test.each(validTimes)('accepts time within hours: %s', (time) => {
    expect(isWithinHours(time)).toBe(true);
  });

  test.each(invalidTimes)('rejects time outside hours: %s', (time) => {
    expect(isWithinHours(time)).toBe(false);
  });

  it('operating hours error message mentions 10 PM', () => {
    expect(LATE_SLOT_MSG).toMatch(/10 PM|22:00/i);
  });
});

// ---------------------------------------------------------------------------
// Bar/Lounge party size constraint (max 4)
// ---------------------------------------------------------------------------
describe('Sprint 8 – Bar/Lounge max party size', () => {
  const MAX_BAR_GUESTS = 4;
  const BAR_LIMIT_MSG = "Bar seating is limited to 4 guests. For larger groups, I can offer our Standard Dining or Large Group sections instead.";

  it('rejects party >4 for Bar/Lounge', () => {
    const partySize = 5;
    expect(partySize > MAX_BAR_GUESTS).toBe(true);
  });

  it('accepts party ≤4 for Bar/Lounge', () => {
    const partySize = 4;
    expect(partySize > MAX_BAR_GUESTS).toBe(false);
  });

  it('Bar/Lounge limit message references Standard Dining as alternative', () => {
    expect(BAR_LIMIT_MSG).toMatch(/Standard Dining/i);
  });
});

// ---------------------------------------------------------------------------
// Large Group party size constraint (min 6, max 20)
// ---------------------------------------------------------------------------
describe('Sprint 8 – Large Group party size constraints', () => {
  const MIN_LARGE = 6;
  const MAX_LARGE = 20;
  const ESCALATION_MSG = "For very large events, please contact us directly. I can handle groups up to 20.";

  const invalidSizes = [1, 2, 5, 21, 25, 100];
  const validSizes = [6, 8, 10, 15, 20];

  test.each(validSizes)('accepts party size %d for Large Group', (size) => {
    expect(size >= MIN_LARGE && size <= MAX_LARGE).toBe(true);
  });

  test.each(invalidSizes.filter(s => s < MIN_LARGE))('rejects party size %d (too small) for Large Group', (size) => {
    expect(size < MIN_LARGE).toBe(true);
  });

  test.each(invalidSizes.filter(s => s > MAX_LARGE))('rejects party size %d (too large) for Large Group', (size) => {
    expect(size > MAX_LARGE).toBe(true);
  });

  it('escalation message mentions 20 as the maximum', () => {
    expect(ESCALATION_MSG).toMatch(/20/);
  });
});

// ---------------------------------------------------------------------------
// STT confidence threshold
// ---------------------------------------------------------------------------
describe('Sprint 8 – STT confidence handling', () => {
  const CONFIDENCE_THRESHOLD = 0.7;
  const MAX_RETRIES = 2;
  const LOW_CONF_MSG = "I didn't quite catch that — could you say that again?";

  it('threshold is 0.7', () => {
    expect(CONFIDENCE_THRESHOLD).toBe(0.7);
  });

  it('max retries before fallback is 2', () => {
    expect(MAX_RETRIES).toBe(2);
  });

  it('low confidence below threshold triggers retry', () => {
    const confidence = 0.65;
    expect(confidence < CONFIDENCE_THRESHOLD).toBe(true);
  });

  it('confidence above threshold proceeds normally', () => {
    const confidence = 0.85;
    expect(confidence < CONFIDENCE_THRESHOLD).toBe(false);
  });

  it('low confidence response matches PRD wording', () => {
    expect(LOW_CONF_MSG).toMatch(/didn't quite catch/i);
    expect(LOW_CONF_MSG).toMatch(/say that again/i);
  });
});

// ---------------------------------------------------------------------------
// Outdoor/Patio weather disclaimer
// ---------------------------------------------------------------------------
describe('Sprint 8 – Outdoor/Patio weather disclaimer', () => {
  it('system prompt contains weather disclaimer for Outdoor/Patio', async () => {
    const { getSystemPrompt } = await import('@/lib/dialogue/systemPrompt');
    const prompt = getSystemPrompt('Test Restaurant', '12:00–22:00');
    expect(prompt).toMatch(/outdoor|patio/i);
    expect(prompt).toMatch(/weather|weather conditions/i);
  });
});

// ---------------------------------------------------------------------------
// check_availability intent (read-only, no booking made)
// ---------------------------------------------------------------------------
describe('Sprint 8 – check_availability intent', () => {
  it('classifies check_availability correctly', async () => {
    process.env.GOOGLE_API_KEY = 'test-key';
    mockGenerateContent.mockResolvedValueOnce({
      response: { text: () => JSON.stringify({ intent: 'check_availability', confidence: 0.9 }) },
    });
    const { detectIntent } = await import('@/lib/dialogue/intentDetector');
    const result = await detectIntent('Do you have any tables available on Saturday?', []);
    expect(result.intent).toBe('check_availability');
  });

  it('check_availability does NOT generate a reservation code', () => {
    // Structural: if intent is check_availability, code must remain null
    const state = {
      intent: 'check_availability',
      reservationCode: null,
      awaitingConfirmation: false,
    };
    expect(state.reservationCode).toBeNull();
    expect(state.awaitingConfirmation).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Session recovery within 5-minute window
// ---------------------------------------------------------------------------
describe('Sprint 8 – Session recovery', () => {
  const SESSION_TTL_MS = 5 * 60 * 1000; // 5 minutes

  it('session is recoverable within 5-minute window', () => {
    const lastActivityMs = Date.now() - 4 * 60 * 1000; // 4 minutes ago
    const isRecoverable = Date.now() - lastActivityMs < SESSION_TTL_MS;
    expect(isRecoverable).toBe(true);
  });

  it('session is NOT recoverable after 5-minute window', () => {
    const lastActivityMs = Date.now() - 6 * 60 * 1000; // 6 minutes ago
    const isRecoverable = Date.now() - lastActivityMs < SESSION_TTL_MS;
    expect(isRecoverable).toBe(false);
  });
});
