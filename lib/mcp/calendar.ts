import { google, calendar_v3 } from 'googleapis';

export interface HoldParams {
  occasion: string;
  date: string;
  time: string;
  partySize?: number;
  code: string;
}

function getCalendarClient() {
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
    scopes: ['https://www.googleapis.com/auth/calendar'],
  });

  return google.calendar({ version: 'v3', auth });
}

export async function createTentativeHold(params: HoldParams): Promise<{ eventId: string }> {
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  if (!calendarId) throw new Error('Missing GOOGLE_CALENDAR_ID');

  const calendar = getCalendarClient();

  const partySizeStr = params.partySize ? params.partySize.toString() : '2';
  const title = `Dining Hold — ${params.occasion} — ${params.code}`;
  const description = `Party of ${partySizeStr} | Slot: ${params.date} ${params.time} IST | Code: ${params.code}`;

  const startDate = new Date(`${params.date}T${params.time}:00+05:30`);
  const durationHours = params.occasion === 'Large Group (6+)' ? 3 : 2;
  const endDate = new Date(startDate.getTime() + durationHours * 3600000);

  const event: calendar_v3.Schema$Event = {
    summary: title,
    description: description,
    start: {
      dateTime: startDate.toISOString(),
      timeZone: 'Asia/Kolkata',
    },
    end: {
      dateTime: endDate.toISOString(),
      timeZone: 'Asia/Kolkata',
    },
    status: 'tentative',
  };

  const res = await calendar.events.insert({
    calendarId,
    requestBody: event,
  });

  if (!res.data.id) {
    throw new Error('Failed to create event: no ID returned');
  }

  return { eventId: res.data.id };
}

export async function deleteHold(eventId: string): Promise<void> {
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  if (!calendarId) throw new Error('Missing GOOGLE_CALENDAR_ID');

  const calendar = getCalendarClient();
  await calendar.events.delete({
    calendarId,
    eventId,
  });
}

export async function updateHold(eventId: string, params: Partial<HoldParams>): Promise<void> {
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  if (!calendarId) throw new Error('Missing GOOGLE_CALENDAR_ID');

  const calendar = getCalendarClient();
  
  // First, get the existing event to modify it
  const existingRes = await calendar.events.get({
    calendarId,
    eventId,
  });
  
  const event = existingRes.data;

  if (params.occasion || params.code) {
    const occasion = params.occasion || event.summary?.split(' — ')[1] || 'Standard Dining';
    const code = params.code || event.summary?.split(' — ')[2] || 'UNKNOWN';
    event.summary = `Dining Hold — ${occasion} — ${code}`;
  }

  if (params.date && params.time) {
    const startDate = new Date(`${params.date}T${params.time}:00+05:30`);
    const durationHours = params.occasion === 'Large Group (6+)' ? 3 : 2;
    const endDate = new Date(startDate.getTime() + durationHours * 3600000);
    
    event.start = { dateTime: startDate.toISOString(), timeZone: 'Asia/Kolkata' };
    event.end = { dateTime: endDate.toISOString(), timeZone: 'Asia/Kolkata' };
  }

  // Update description if needed
  if (params.partySize || params.date || params.time || params.code) {
    const pSize = params.partySize || event.description?.match(/Party of (\d+)/)?.[1] || '2';
    const dDate = params.date || event.description?.match(/Slot: ([\d-]+)/)?.[1] || 'YYYY-MM-DD';
    const dTime = params.time || event.description?.match(/Slot: [\d-]+ ([\d:]+)/)?.[1] || 'HH:MM';
    const dCode = params.code || event.description?.match(/Code: ([\w-]+)/)?.[1] || 'UNKNOWN';
    event.description = `Party of ${pSize} | Slot: ${dDate} ${dTime} IST | Code: ${dCode}`;
  }

  await calendar.events.update({
    calendarId,
    eventId,
    requestBody: event,
  });
}
