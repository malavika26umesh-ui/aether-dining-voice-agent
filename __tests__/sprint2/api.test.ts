/**
 * Sprint 2 — Backend API Routes (STT, LLM, TTS)
 * Tests for individual route handlers using mocked external services.
 */

// ---------------------------------------------------------------------------
// Shared fetch/Request/Response polyfills (Next.js routes use Web Fetch API)
// ---------------------------------------------------------------------------
import { TextEncoder, TextDecoder } from 'util';
global.TextEncoder = TextEncoder;
(global as any).TextDecoder = TextDecoder;

// ---------------------------------------------------------------------------
// Mock @google/generative-ai
// ---------------------------------------------------------------------------
const mockGenerateContent = jest.fn();
jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn().mockReturnValue({
      generateContent: mockGenerateContent,
    }),
  })),
  SchemaType: { OBJECT: 'OBJECT', STRING: 'STRING', NUMBER: 'NUMBER', INTEGER: 'INTEGER' },
}));

// Mock googleapis (indirect dep via stateMachine → calendar.ts → googleapis)
jest.mock('googleapis', () => ({
  google: {
    auth: { GoogleAuth: jest.fn() },
    calendar: jest.fn().mockReturnValue({ events: { insert: jest.fn(), delete: jest.fn(), get: jest.fn(), update: jest.fn() } }),
    sheets: jest.fn().mockReturnValue({ spreadsheets: { values: { append: jest.fn(), get: jest.fn(), update: jest.fn() } } }),
  },
}));

// Mock fs (indirect dep via stateMachine → service.ts)
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  readFileSync: jest.fn().mockReturnValue(JSON.stringify({
    '2026-06-28': { 'Standard Dining': ['12:00', '19:00'], 'Large Group (6+)': ['19:00'], 'Outdoor/Patio': ['12:30'], 'Special Occasion/Anniversary': ['19:00'], 'Bar/Lounge': ['18:00'] },
  })),
  writeFileSync: jest.fn(),
}));

// Mock Sarvam TTS HTTP call via global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------
describe('Sprint 2 – systemPrompt', () => {
  it('exports getSystemPrompt function', async () => {
    const mod = await import('@/lib/dialogue/systemPrompt');
    expect(typeof mod.getSystemPrompt).toBe('function');
  });

  it('returned prompt contains all 5 intents', async () => {
    const { getSystemPrompt } = await import('@/lib/dialogue/systemPrompt');
    const prompt = getSystemPrompt('Test Restaurant', '12:00–22:00');
    expect(prompt).toMatch(/book_new/i);
    expect(prompt).toMatch(/reschedule/i);
    expect(prompt).toMatch(/cancel/i);
    expect(prompt).toMatch(/check_availability/i);
  });

  it('returned prompt contains PII refusal instruction', async () => {
    const { getSystemPrompt } = await import('@/lib/dialogue/systemPrompt');
    const prompt = getSystemPrompt('Test Restaurant', '12:00–22:00');
    expect(prompt).toMatch(/PII|personally identifiable|personal details/i);
  });

  it('returned prompt references IST timezone', async () => {
    const { getSystemPrompt } = await import('@/lib/dialogue/systemPrompt');
    const prompt = getSystemPrompt('Test Restaurant', '12:00–22:00');
    expect(prompt).toMatch(/IST|Asia\/Kolkata|UTC\+5:30/i);
  });

  it('returned prompt mentions all 5 dining occasions', async () => {
    const { getSystemPrompt } = await import('@/lib/dialogue/systemPrompt');
    const prompt = getSystemPrompt('Test Restaurant', '12:00–22:00');
    expect(prompt).toMatch(/Standard Dining/i);
    expect(prompt).toMatch(/Large Group/i);
    expect(prompt).toMatch(/Outdoor|Patio/i);
    expect(prompt).toMatch(/Special Occasion|Anniversary/i);
    expect(prompt).toMatch(/Bar|Lounge/i);
  });

  it('returned prompt requires code to be repeated twice', async () => {
    const { getSystemPrompt } = await import('@/lib/dialogue/systemPrompt');
    const prompt = getSystemPrompt('Test Restaurant', '12:00–22:00');
    expect(prompt).toMatch(/twice|two times|repeat.*code/i);
  });
});

// ---------------------------------------------------------------------------
// STT route
// ---------------------------------------------------------------------------
describe('Sprint 2 – STT API route', () => {
  beforeEach(() => {
    process.env.GOOGLE_API_KEY = 'test-key';
    mockGenerateContent.mockReset();
  });

  it('exports a POST handler', async () => {
    const mod = await import('@/app/api/stt/route');
    expect(typeof mod.POST).toBe('function');
  });

  it('returns JSON with transcript and confidence on success', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      response: {
        text: () => JSON.stringify({ transcript: 'I want to book a table', confidence: 0.95 }),
      },
    });

    const { POST } = await import('@/app/api/stt/route');
    const audioBlob = new Blob(['fake-audio'], { type: 'audio/webm' });
    const req = new Request('http://localhost/api/stt', {
      method: 'POST',
      body: audioBlob,
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('transcript');
    expect(body).toHaveProperty('confidence');
  });

  it('returns 400 when no audio body provided', async () => {
    const { POST } = await import('@/app/api/stt/route');
    const req = new Request('http://localhost/api/stt', { method: 'POST' });
    const res = await POST(req);
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

// ---------------------------------------------------------------------------
// LLM route
// ---------------------------------------------------------------------------
describe('Sprint 2 – LLM API route', () => {
  beforeEach(() => {
    process.env.GOOGLE_API_KEY = 'test-key';
    mockGenerateContent.mockReset();
  });

  it('exports a POST handler', async () => {
    const mod = await import('@/app/api/llm/route');
    expect(typeof mod.POST).toBe('function');
  });

  it('returns responseText and updatedState on success', async () => {
    // The LLM route calls processDialogueTurn which makes multiple Gemini calls:
    // 1) intentDetector → JSON
    // 2) slotFiller → JSON
    // 3) LLM response → plain text
    mockGenerateContent
      .mockResolvedValueOnce({ response: { text: () => JSON.stringify({ intent: 'unknown', confidence: 0.8 }) } })
      .mockResolvedValueOnce({ response: { text: () => JSON.stringify({ occasion: null, date: null, time: null, partySize: null }) } })
      .mockResolvedValueOnce({ response: { text: () => 'Welcome to Aether Dining! Would you like to make a new booking?' } });

    const { POST } = await import('@/app/api/llm/route');
    const req = new Request('http://localhost/api/llm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Hello' }],
        sessionState: {
          sessionId: 'sess_001', intent: 'unknown', occasion: null, date: null, time: null,
          partySize: null, offeredSlots: [], confirmedSlot: null, reservationCode: null,
          turnCount: 0, awaitingConfirmation: false, conversationHistory: [],
          calendarEventId: null, sheetsRowIndex: null,
          intentPhase: null, existingCode: null, existingDate: null, existingTime: null,
          existingOccasion: null, newDate: null, newTime: null, existingCalendarEventId: null,
        },
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('responseText');
  });

  it('returns 400 for missing messages field', async () => {
    const { POST } = await import('@/app/api/llm/route');
    const req = new Request('http://localhost/api/llm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

// ---------------------------------------------------------------------------
// TTS route
// ---------------------------------------------------------------------------
describe('Sprint 2 – TTS API route', () => {
  beforeEach(() => {
    process.env.SARVAM_API_KEY = 'test-sarvam-key';
    mockFetch.mockReset();
  });

  it('exports a POST handler', async () => {
    const mod = await import('@/app/api/tts/route');
    expect(typeof mod.POST).toBe('function');
  });

  it('returns audio/mpeg stream on success', async () => {
    const fakeAudio = Buffer.from('fake-mp3-bytes');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(fakeAudio);
          controller.close();
        },
      }),
      headers: new Headers({ 'content-type': 'audio/mpeg' }),
    } as Response);

    const { POST } = await import('@/app/api/tts/route');
    const req = new Request('http://localhost/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Welcome to Aether Dining!' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/audio/i);
  });

  it('returns 400 when text is missing', async () => {
    const { POST } = await import('@/app/api/tts/route');
    const req = new Request('http://localhost/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('returns 502 when Sarvam API call fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      text: async () => 'Service Unavailable',
    } as Response);

    const { POST } = await import('@/app/api/tts/route');
    const req = new Request('http://localhost/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Hello' }),
    });
    const res = await POST(req);
    expect(res.status).toBeGreaterThanOrEqual(500);
  });
});
