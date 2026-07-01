import { google } from 'googleapis';
import { TABLE_SEED, type TableDef } from '../restaurant/config';

export interface ReservationRowParams {
  date: string;
  time: string;
  occasion: string;
  partySize?: number;
  code: string;
  notes?: string;
  sessionId: string;
  calendarEventId?: string;
  tableCode?: string;   // K — assigned physical table (AE-T##)
  service?: string;     // L — Lunch | Dinner
  slotStart?: string;   // M — normalized start slot (HH:MM)
}

export interface ReservationRecord {
  timestamp: string;
  code: string;
  date: string;
  time: string;
  occasion: string;
  partySize: number;
  status: 'CONFIRMED' | 'CANCELLED' | 'RESCHEDULED';
  notes: string;
  sessionId: string;
  calendarEventId?: string;
  tableCode?: string;
  service?: string;
  slotStart?: string;
  rowIndex: number; // 1-indexed sheet row
}

function getSheetsClient() {
  const b64Json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!b64Json) throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_JSON');
  
  let credentials;
  try {
    const jsonStr = Buffer.from(b64Json, 'base64').toString('utf8');
    credentials = JSON.parse(jsonStr);
  } catch (e) {
    throw new Error('Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON (must be base64 encoded)');
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return google.sheets({ version: 'v4', auth });
}

export async function appendReservation(params: ReservationRowParams): Promise<{ rowIndex: number }> {
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
  if (!spreadsheetId) throw new Error('Missing GOOGLE_SHEETS_ID');

  const sheets = getSheetsClient();
  const timestamp = new Date().toISOString();
  
  // Columns: A=Timestamp B=Code C=Date D=Time E=Occasion F=PartySize G=Status H=Notes I=SessionId J=CalendarEventId K=TableCode L=Service M=SlotStart
  const values = [
    [
      timestamp,
      params.code,
      params.date,
      params.time,
      params.occasion,
      params.partySize || 2,
      'CONFIRMED',
      params.notes || '',
      params.sessionId,
      params.calendarEventId || '',
      params.tableCode || '',
      params.service || '',
      params.slotStart || params.time
    ]
  ];

  const res = await sheets.spreadsheets.values.append({
    spreadsheetId,
    // Columns: A=Timestamp B=Code C=Date D=Time E=Occasion F=PartySize G=Status H=Notes I=SessionId J=CalendarEventId K=TableCode L=Service M=SlotStart
    range: 'Daily Reservation Log!A:M',
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values },
  });

  // Example updatedRange format: "Daily Reservation Log!A12:J12"
  const updatedRange = res.data.updates?.updatedRange || '';
  const match = updatedRange.match(/!A(\d+):/);
  const rowIndex = match ? parseInt(match[1], 10) : -1;

  return { rowIndex };
}

export async function updateReservationStatus(code: string, status: 'CONFIRMED' | 'CANCELLED' | 'RESCHEDULED'): Promise<void> {
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
  if (!spreadsheetId) throw new Error('Missing GOOGLE_SHEETS_ID');

  const sheets = getSheetsClient();
  
  // To update a row by code, we first need to read the sheet to find the row index.
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Daily Reservation Log!A:B', // Timestamp is A, Code is B
  });
  
  const rows = res.data.values;
  if (!rows || rows.length === 0) {
    throw new Error('No data found in sheet');
  }

  let targetRowIndex = -1;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][1] === code) {
      targetRowIndex = i + 1; // 1-indexed
      break;
    }
  }

  if (targetRowIndex === -1) {
    throw new Error(`Reservation code ${code} not found in sheet`);
  }

  // Column G is Status (7th column)
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `Daily Reservation Log!G${targetRowIndex}:G${targetRowIndex}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[status]],
    },
  });
}

/**
 * Returns all reservations from the sheet, sorted by timestamp descending.
 * Optional dateFilter (YYYY-MM-DD) limits results to a single date.
 */
export async function getAllReservations(dateFilter?: string): Promise<ReservationRecord[]> {
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
  if (!spreadsheetId) throw new Error('Missing GOOGLE_SHEETS_ID');

  const sheets = getSheetsClient();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Daily Reservation Log!A:M',
  });

  const rows = res.data.values;
  if (!rows || rows.length === 0) return [];

  const records: ReservationRecord[] = [];

  // Skip header row (row index 0 if it's a header; detect by checking if col B looks like a code)
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const code = (row[1] || '').toString().trim();
    // Skip header row or empty rows
    if (!code || !code.startsWith('TABLE-')) continue;

    const date = row[2] || '';
    if (dateFilter && date !== dateFilter) continue;

    records.push({
      rowIndex: i + 1,
      timestamp: row[0] || '',
      code,
      date,
      time: row[3] || '',
      occasion: row[4] || '',
      partySize: parseInt(row[5] || '2', 10),
      status: (row[6] || 'CONFIRMED') as ReservationRecord['status'],
      notes: row[7] || '',
      sessionId: row[8] || '',
      calendarEventId: row[9] || undefined,
      tableCode: row[10] || undefined,
      service: row[11] || undefined,
      slotStart: row[12] || undefined,
    });
  }

  // Sort by timestamp descending (most recent first)
  records.sort((a, b) => {
    const ta = new Date(a.timestamp).getTime();
    const tb = new Date(b.timestamp).getTime();
    return tb - ta;
  });

  return records;
}

/**
 * Looks up a reservation by code. Returns null if not found or already CANCELLED.
 * Columns: A=Timestamp B=Code C=Date D=Time E=Occasion F=PartySize G=Status H=Notes I=SessionId J=CalendarEventId
 */
export async function lookupReservation(code: string): Promise<ReservationRecord | null> {
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
  if (!spreadsheetId) throw new Error('Missing GOOGLE_SHEETS_ID');

  const sheets = getSheetsClient();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Daily Reservation Log!A:M',
  });

  const rows = res.data.values;
  if (!rows || rows.length === 0) return null;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowCode = (row[1] || '').toString().trim().toUpperCase();
    if (rowCode === code.toUpperCase()) {
      const status = (row[6] || 'CONFIRMED') as ReservationRecord['status'];
      if (status === 'CANCELLED') return null; // treat cancelled as not found
      return {
        rowIndex: i + 1, // 1-indexed
        timestamp: row[0] || '',
        code: row[1] || '',
        date: row[2] || '',
        time: row[3] || '',
        occasion: row[4] || '',
        partySize: parseInt(row[5] || '2', 10),
        status,
        notes: row[7] || '',
        sessionId: row[8] || '',
        calendarEventId: row[9] || undefined,
        tableCode: row[10] || undefined,
        service: row[11] || undefined,
        slotStart: row[12] || undefined,
      };
    }
  }

  return null;
}

/**
 * Reads the Tables master tab (the per-table booking codes). Falls back to the
 * seeded registry when Sheets is unreachable / not yet configured, so availability
 * still works offline. Columns: A=TableCode B=Seats C=Zone D=LunchOK E=DinnerOK.
 */
export async function getTables(): Promise<TableDef[]> {
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
  if (!spreadsheetId) return TABLE_SEED;

  try {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Tables!A:E',
    });
    const rows = res.data.values;
    if (!rows || rows.length === 0) return TABLE_SEED;

    const truthy = (v: unknown) => /^(true|yes|1)$/i.test(String(v ?? '').trim());
    const tables: TableDef[] = [];
    for (const row of rows) {
      const code = (row[0] || '').toString().trim();
      if (!code || !/^AE-T\d+/i.test(code)) continue; // skip header / junk
      tables.push({
        code: code.toUpperCase(),
        seats: parseInt(row[1] || '2', 10),
        zone: (row[2] || 'Standard').toString().trim(),
        lunch: truthy(row[3]),
        dinner: truthy(row[4]),
      });
    }
    return tables.length ? tables : TABLE_SEED;
  } catch (err) {
    console.warn('[Sheets] getTables failed — using seeded registry:', (err as Error).message);
    return TABLE_SEED;
  }
}

/** Active reservations for one date (CONFIRMED only occupy a table). Safe on error → []. */
export async function getReservationsForDate(date: string): Promise<ReservationRecord[]> {
  try {
    const all = await getAllReservations(date);
    return all.filter(r => r.status === 'CONFIRMED');
  } catch (err) {
    console.warn('[Sheets] getReservationsForDate failed — assuming empty:', (err as Error).message);
    return [];
  }
}
