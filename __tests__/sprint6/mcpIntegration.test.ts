/**
 * Sprint 6 — MCP Integration: Google Calendar & Sheets
 * Tests with googleapis mocked to verify correct API call construction.
 */

// ---------------------------------------------------------------------------
// Mock googleapis
// ---------------------------------------------------------------------------
const mockEventsInsert = jest.fn();
const mockEventsDelete = jest.fn();
const mockEventsGet = jest.fn();
const mockEventsUpdate = jest.fn();
const mockSheetsAppend = jest.fn();
const mockSheetsGet = jest.fn();
const mockSheetsUpdate = jest.fn();

jest.mock('googleapis', () => ({
  google: {
    auth: {
      GoogleAuth: jest.fn().mockImplementation(() => ({})),
    },
    calendar: jest.fn().mockReturnValue({
      events: {
        insert: mockEventsInsert,
        delete: mockEventsDelete,
        get: mockEventsGet,
        update: mockEventsUpdate,
      },
    }),
    sheets: jest.fn().mockReturnValue({
      spreadsheets: {
        values: {
          append: mockSheetsAppend,
          get: mockSheetsGet,
          update: mockSheetsUpdate,
        },
      },
    }),
  },
}));

const FAKE_SA_JSON = Buffer.from(JSON.stringify({ type: 'service_account', project_id: 'test' })).toString('base64');

// ---------------------------------------------------------------------------
// calendar.ts
// ---------------------------------------------------------------------------
describe('Sprint 6 – calendar.createTentativeHold', () => {
  let createTentativeHold: (params: any) => Promise<{ eventId: string }>;
  let deleteHold: (eventId: string) => Promise<void>;
  let updateHold: (eventId: string, params: any) => Promise<void>;

  beforeAll(async () => {
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = FAKE_SA_JSON;
    process.env.GOOGLE_CALENDAR_ID = 'test-calendar@group.calendar.google.com';
    ({ createTentativeHold, deleteHold, updateHold } = await import('@/lib/mcp/calendar'));
  });

  beforeEach(() => {
    mockEventsInsert.mockReset();
    mockEventsDelete.mockReset();
    mockEventsGet.mockReset();
    mockEventsUpdate.mockReset();
  });

  it('calls calendar.events.insert with correct title format', async () => {
    mockEventsInsert.mockResolvedValueOnce({ data: { id: 'evt_001' } });
    await createTentativeHold({
      occasion: 'Special Occasion/Anniversary',
      date: '2026-06-28',
      time: '19:00',
      partySize: 2,
      code: 'TABLE-R07',
    });
    expect(mockEventsInsert).toHaveBeenCalledTimes(1);
    const callArg = mockEventsInsert.mock.calls[0][0];
    expect(callArg.requestBody.summary).toBe('Dining Hold — Special Occasion/Anniversary — TABLE-R07');
  });

  it('sets event status to tentative', async () => {
    mockEventsInsert.mockResolvedValueOnce({ data: { id: 'evt_002' } });
    await createTentativeHold({
      occasion: 'Standard Dining',
      date: '2026-06-28',
      time: '19:00',
      code: 'TABLE-A01',
    });
    const callArg = mockEventsInsert.mock.calls[0][0];
    expect(callArg.requestBody.status).toBe('tentative');
  });

  it('sets 2-hour duration for standard occasions', async () => {
    mockEventsInsert.mockResolvedValueOnce({ data: { id: 'evt_003' } });
    await createTentativeHold({
      occasion: 'Standard Dining',
      date: '2026-06-28',
      time: '19:00',
      code: 'TABLE-A01',
    });
    const callArg = mockEventsInsert.mock.calls[0][0];
    const start = new Date(callArg.requestBody.start.dateTime).getTime();
    const end = new Date(callArg.requestBody.end.dateTime).getTime();
    expect((end - start) / 3600000).toBe(2);
  });

  it('sets 3-hour duration for Large Group (6+)', async () => {
    mockEventsInsert.mockResolvedValueOnce({ data: { id: 'evt_004' } });
    await createTentativeHold({
      occasion: 'Large Group (6+)',
      date: '2026-06-28',
      time: '19:00',
      partySize: 8,
      code: 'TABLE-G05',
    });
    const callArg = mockEventsInsert.mock.calls[0][0];
    const start = new Date(callArg.requestBody.start.dateTime).getTime();
    const end = new Date(callArg.requestBody.end.dateTime).getTime();
    expect((end - start) / 3600000).toBe(3);
  });

  it('returns the eventId from the API response', async () => {
    mockEventsInsert.mockResolvedValueOnce({ data: { id: 'evt_expected' } });
    const result = await createTentativeHold({
      occasion: 'Bar/Lounge',
      date: '2026-06-28',
      time: '18:00',
      code: 'TABLE-B10',
    });
    expect(result.eventId).toBe('evt_expected');
  });

  it('throws when GOOGLE_CALENDAR_ID is missing', async () => {
    delete process.env.GOOGLE_CALENDAR_ID;
    jest.resetModules();
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = FAKE_SA_JSON;
    const { createTentativeHold: freshFn } = await import('@/lib/mcp/calendar');
    await expect(freshFn({ occasion: 'Standard Dining', date: '2026-06-28', time: '19:00', code: 'TABLE-X00' }))
      .rejects.toThrow(/GOOGLE_CALENDAR_ID/);
    process.env.GOOGLE_CALENDAR_ID = 'test-calendar@group.calendar.google.com';
  });

  it('deleteHold calls events.delete with correct eventId', async () => {
    mockEventsDelete.mockResolvedValueOnce({});
    await deleteHold('evt_to_delete');
    expect(mockEventsDelete).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: 'evt_to_delete' }),
    );
  });

  it('updateHold calls events.update', async () => {
    mockEventsGet.mockResolvedValueOnce({
      data: {
        summary: 'Dining Hold — Standard Dining — TABLE-A01',
        description: 'Party of 2 | Slot: 2026-06-28 19:00 IST | Code: TABLE-A01',
        start: { dateTime: '2026-06-28T13:30:00.000Z', timeZone: 'Asia/Kolkata' },
        end: { dateTime: '2026-06-28T15:30:00.000Z', timeZone: 'Asia/Kolkata' },
      },
    });
    mockEventsUpdate.mockResolvedValueOnce({ data: {} });
    await updateHold('evt_to_update', { date: '2026-06-29', time: '20:00' });
    expect(mockEventsUpdate).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// sheets.ts
// ---------------------------------------------------------------------------
describe('Sprint 6 – sheets.appendReservation', () => {
  let appendReservation: (params: any) => Promise<{ rowIndex: number }>;
  let updateReservationStatus: (code: string, status: string) => Promise<void>;

  beforeAll(async () => {
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = FAKE_SA_JSON;
    process.env.GOOGLE_SHEETS_ID = 'test-sheet-id';
    ({ appendReservation, updateReservationStatus } = await import('@/lib/mcp/sheets'));
  });

  beforeEach(() => {
    mockSheetsAppend.mockReset();
    mockSheetsGet.mockReset();
    mockSheetsUpdate.mockReset();
  });

  it('calls spreadsheets.values.append on the correct range', async () => {
    mockSheetsAppend.mockResolvedValueOnce({
      data: { updates: { updatedRange: 'Daily Reservation Log!A12:I12' } },
    });
    await appendReservation({
      date: '2026-06-28',
      time: '19:00',
      occasion: 'Standard Dining',
      partySize: 2,
      code: 'TABLE-A01',
      sessionId: 'sess_001',
    });
    const callArg = mockSheetsAppend.mock.calls[0][0];
    expect(callArg.range).toContain('Daily Reservation Log');
  });

  it('includes CONFIRMED as the initial status', async () => {
    mockSheetsAppend.mockResolvedValueOnce({
      data: { updates: { updatedRange: 'Daily Reservation Log!A5:I5' } },
    });
    await appendReservation({
      date: '2026-06-28',
      time: '19:00',
      occasion: 'Standard Dining',
      partySize: 2,
      code: 'TABLE-A02',
      sessionId: 'sess_002',
    });
    const callArg = mockSheetsAppend.mock.calls[0][0];
    const values = callArg.requestBody.values[0];
    expect(values).toContain('CONFIRMED');
  });

  it('returns the parsed row index', async () => {
    mockSheetsAppend.mockResolvedValueOnce({
      data: { updates: { updatedRange: 'Daily Reservation Log!A7:I7' } },
    });
    const result = await appendReservation({
      date: '2026-06-28',
      time: '20:30',
      occasion: 'Bar/Lounge',
      code: 'TABLE-B03',
      sessionId: 'sess_003',
    });
    expect(result.rowIndex).toBe(7);
  });

  it('throws when GOOGLE_SHEETS_ID is missing', async () => {
    delete process.env.GOOGLE_SHEETS_ID;
    jest.resetModules();
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = FAKE_SA_JSON;
    const { appendReservation: freshFn } = await import('@/lib/mcp/sheets');
    await expect(freshFn({ date: '2026-06-28', time: '19:00', occasion: 'Standard Dining', code: 'TABLE-X00', sessionId: 'x' }))
      .rejects.toThrow(/GOOGLE_SHEETS_ID/);
    process.env.GOOGLE_SHEETS_ID = 'test-sheet-id';
  });

  it('updateReservationStatus sets CANCELLED on the correct row', async () => {
    mockSheetsGet.mockResolvedValueOnce({
      data: {
        values: [
          ['2026-06-28T10:00:00Z', 'TABLE-R07'],
          ['2026-06-28T11:00:00Z', 'TABLE-A01'],
        ],
      },
    });
    mockSheetsUpdate.mockResolvedValueOnce({});
    await updateReservationStatus('TABLE-A01', 'CANCELLED');
    const updateArg = mockSheetsUpdate.mock.calls[0][0];
    expect(updateArg.requestBody.values).toEqual([['CANCELLED']]);
  });

  it('updateReservationStatus throws when code not found', async () => {
    mockSheetsGet.mockResolvedValueOnce({
      data: { values: [['2026-06-28T10:00:00Z', 'TABLE-R07']] },
    });
    await expect(updateReservationStatus('TABLE-NOTEXIST', 'CANCELLED'))
      .rejects.toThrow(/not found/i);
  });
});
