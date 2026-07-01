import { groqChat, groqChatJSON } from './groqChat';
import { detectIntent } from './intentDetector';
import { fillSlots } from './slotFiller';
import { generateReservationCode } from './codeGenerator';
import { getSystemPrompt } from './systemPrompt';
import { getAvailableSlots, assignTable } from '../availability/service';
import { serviceForTime } from '../restaurant/config';
import { createTentativeHold, deleteHold, updateHold } from '../mcp/calendar';
import { appendReservation, lookupReservation, updateReservationStatus } from '../mcp/sheets';
import { SessionState } from './types';
export type { SessionState };

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
export function initSessionState(sessionId: string): SessionState {
  return {
    sessionId,
    intent: 'unknown',
    occasion: null,
    date: null,
    time: null,
    partySize: null,
    offeredSlots: [],
    confirmedSlot: null,
    reservationCode: null,
    tableCode: null,
    turnCount: 0,
    awaitingConfirmation: false,
    conversationHistory: [],
    calendarEventId: null,
    sheetsRowIndex: null,
    // Sprint 7
    intentPhase: null,
    existingCode: null,
    existingDate: null,
    existingTime: null,
    existingOccasion: null,
    newDate: null,
    newTime: null,
    existingCalendarEventId: null,
    // End-of-session flow
    awaitingAnythingElse: false,
    closeSession: false,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Retry wrapper for MCP calls (1 retry after 1s). */
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.warn('[MCP Retry] First attempt failed. Retrying in 1s…', err);
    await new Promise((r) => setTimeout(r, 1000));
    return await fn();
  }
}

/**
 * Normalises a phonetically spoken reservation code to TABLE-X99 format.
 * E.g. "table bee four seven" → "TABLE-B47"
 *      "TABLE-B47"            → "TABLE-B47"
 *      "table r zero seven"   → "TABLE-R07"
 */
function normalizeCode(raw: string): string | null {
  if (!raw) return null;

  // If already looks like TABLE-X99, return as-is (case-insensitive)
  const direct = raw.toUpperCase().replace(/\s+/g, '');
  const directMatch = direct.match(/^TABLE[-–]?([A-HJ-NP-Z])(\d{2})$/);
  if (directMatch) return `TABLE-${directMatch[1]}${directMatch[2]}`;

  // Phonetic word-to-char maps
  const letterMap: Record<string, string> = {
    alpha: 'A', bravo: 'B', bee: 'B', charlie: 'C', delta: 'D',
    echo: 'E', foxtrot: 'F', golf: 'G', hotel: 'H', juliet: 'J',
    kilo: 'K', lima: 'L', mike: 'M', november: 'N', oscar: 'P',
    papa: 'P', quebec: 'Q', romeo: 'R', sierra: 'S', tango: 'T',
    uniform: 'U', victor: 'V', whiskey: 'W', xray: 'X', yankee: 'Y',
    zulu: 'Z',
  };
  const digitMap: Record<string, string> = {
    zero: '0', oh: '0', one: '1', two: '2', three: '3', four: '4',
    five: '5', six: '6', seven: '7', eight: '8', nine: '9',
  };

  const tokens = raw.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim().split(/\s+/);
  // Drop the word "table" from the start
  const filtered = tokens.filter((t) => t !== 'table' && t !== 'dash');

  let letter = '';
  const digits: string[] = [];

  for (const tok of filtered) {
    if (!letter) {
      if (letterMap[tok]) { letter = letterMap[tok]; continue; }
      if (/^[a-z]$/.test(tok)) { letter = tok.toUpperCase(); continue; }
    } else {
      if (digitMap[tok] !== undefined) { digits.push(digitMap[tok]); continue; }
      if (/^\d$/.test(tok)) { digits.push(tok); continue; }
    }
  }

  if (letter && digits.length === 2) {
    // Exclude I and O per convention
    const validLetter = letter.replace(/[IO]/g, '');
    if (validLetter) return `TABLE-${validLetter}${digits.join('')}`;
  }
  return null;
}

/** Extract a potential reservation code string from a user utterance. */
function extractCodeFromUtterance(utterance: string): string | null {
  // Match literal TABLE-X99 pattern (with optional spaces or dashes)
  const literal = utterance.toUpperCase().match(/TABLE[-\s]?([A-HJ-NP-Z]\d{2})/);
  if (literal) return `TABLE-${literal[1]}`;
  // Try full phonetic normalisation
  return normalizeCode(utterance);
}

/**
 * Yes/No confirmation classifier.
 */
async function checkConfirmation(
  utterance: string,
  history: { role: 'user' | 'assistant'; content: string }[]
): Promise<boolean | null> {
  const text = utterance.trim().toLowerCase();

  // Fast keyword path — no LLM round-trip needed for clear affirmatives/negatives
  const YES = /\b(yes|yeah|yep|yup|sure|ok|okay|please|correct|confirm|go ahead|lock it in|do it|absolutely|definitely|great|perfect|sounds good|that works|let's do it|book it)\b/i;
  const NO  = /\b(no|nope|nah|cancel|stop|don't|change|different|wrong|incorrect|not that|wait|hold on)\b/i;

  if (YES.test(text) && !NO.test(text)) return true;
  if (NO.test(text) && !YES.test(text)) return false;

  // Fallback to the LLM for ambiguous utterances
  const lastAgentMsg = history.filter((h) => h.role === 'assistant').slice(-1)[0]?.content || '';
  const system = `You classify whether a user's reply is an affirmative confirmation.
Respond ONLY with JSON of the exact shape {"confirmed": true|false|null}:
- yes/agree/confirm/please → {"confirmed": true}
- no/cancel/change/disagree → {"confirmed": false}
- ambiguous/neutral → {"confirmed": null}`;
  const user = `The assistant asked: "${lastAgentMsg}"
The user replied: "${utterance}"`;

  try {
    const parsed = await groqChatJSON<{ confirmed: boolean | null }>({ system, user });
    // If the model is still uncertain, lean towards true when the text is short
    // (single-word replies to a yes/no question are almost always affirmative)
    if (parsed.confirmed === null && text.split(' ').length <= 3) return true;
    return parsed.confirmed;
  } catch {
    // On any error, treat short utterances as confirmation
    return text.split(' ').length <= 3 ? true : null;
  }
}

/** Build IST date string from today for context. */
function getISTDate() {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const ist = new Date(utc + 3600000 * 5.5);
  const yyyy = ist.getFullYear();
  const mm = String(ist.getMonth() + 1).padStart(2, '0');
  const dd = String(ist.getDate()).padStart(2, '0');
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return { currentDateIST: `${yyyy}-${mm}-${dd}`, currentDayName: weekdays[ist.getDay()] };
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------
export async function processDialogueTurn(
  userInput: string,
  state: SessionState
): Promise<{ responseText: string; updatedState: SessionState }> {
  if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY is not defined in environment variables');

  const { currentDateIST, currentDayName } = getISTDate();

  // Update history and turn count
  state.turnCount += 1;
  state.conversationHistory.push({ role: 'user', content: userInput });

  // --- 8.1 PII Guardrails ---
  const piiRegex = /(\b\d{10}\b|\b\d{3}[-\s]?\d{3}[-\s]?\d{4}\b|[\w.-]+@[\w.-]+\.\w+)/i;
  if (piiRegex.test(userInput)) {
    const piiMsg = "To keep things private, I only need your dining preferences — no personal details required!";
    state.conversationHistory.push({ role: 'assistant', content: piiMsg });
    return { responseText: piiMsg, updatedState: state };
  }

  // --- End-of-session: "anything else?" handling ---
  // After a booking/reschedule/cancel completes we ask "anything else?".
  // Here we interpret the answer BEFORE re-running intent detection.
  if (state.awaitingAnythingElse) {
    state.awaitingAnythingElse = false;
    const DECLINE = /\b(no|nope|nah|nothing|that'?s (it|all)|that would be all|i'?m good|all good|we'?re good|thank(s| you)?|bye|goodbye|see you|that'?s everything)\b/i;
    const WANTS_MORE = /\b(yes|yeah|yep|actually|also|another|one more|change|reschedule|cancel|book|question|help)\b/i;
    if (DECLINE.test(userInput) && !WANTS_MORE.test(userInput)) {
      const closing = state.reservationCode
        ? `You're all set — enjoy your visit to Aether Dining. Goodbye!`
        : `Thank you for calling Aether Dining. Goodbye!`;
      state.closeSession = true;
      state.conversationHistory.push({ role: 'assistant', content: closing });
      return { responseText: closing, updatedState: state };
    }
    // Otherwise the user wants something else — fall through to normal handling.
  }

  // --- Intent detection ---
  // Re-detect on turn 1, or when intent is still unknown, or when we see
  // strong signals the user is switching intents (reschedule/cancel keywords).
  const rescheduleKeywords = /\b(reschedule|change|move|modify|update).*(reservation|booking|table)\b/i;
  const cancelKeywords = /\b(cancel|remove|delete|drop).*(reservation|booking|table)\b/i;
  // NOTE: availability phrasing ("check the availability") is deliberately NOT a
  // redetect trigger. During a booking it's part of the booking, not a new intent —
  // treating it as one used to silently switch book_new → check_availability and
  // abandon the flow (Session 3: hijack at turn 5 → hallucinated code, no close).
  const forceRedetect =
    state.intent === 'unknown' ||
    state.turnCount === 1 ||
    rescheduleKeywords.test(userInput) ||
    cancelKeywords.test(userInput);

  // Slots extracted speculatively alongside intent detection (see below). fillSlots
  // reads only the utterance + history, so it's independent of the detected intent —
  // running the two concurrently saves one Gemini round-trip on redetect turns.
  let prefetchedSlots: Awaited<ReturnType<typeof fillSlots>> | null = null;

  if (forceRedetect) {
    // detectIntent and fillSlots are independent for a given utterance — run them
    // in parallel instead of serially (stage-5 latency optimization).
    const [detected, slots] = await Promise.all([
      detectIntent(userInput, state.conversationHistory),
      fillSlots(userInput, state.conversationHistory, currentDateIST),
    ]);
    prefetchedSlots = slots;
    if (detected.confidence > 0.55) {
      // Guard: never abandon an in-progress booking just because the user said
      // something that looks like an availability query. Only explicit
      // reschedule/cancel (matched above) may switch away mid-booking.
      const bookingInProgress =
        state.intent === 'book_new' &&
        (state.awaitingConfirmation || !!state.occasion || !!state.date || !!state.time || !!state.partySize);
      const abandonsBooking = bookingInProgress && detected.intent === 'check_availability';

      if (!abandonsBooking) {
        // If user switches to a new intent mid-session, reset flow-specific state
        if (detected.intent !== state.intent && state.intent !== 'unknown') {
          state.intentPhase = null;
          state.existingCode = null;
          state.existingDate = null;
          state.existingTime = null;
          state.existingOccasion = null;
          state.existingCalendarEventId = null;
          state.newDate = null;
          state.newTime = null;
          state.awaitingConfirmation = false;
        }
        state.intent = detected.intent;
      }
    }
  }

  // -------------------------------------------------------------------------
  // Intent: book_new
  // -------------------------------------------------------------------------
  let codeGeneratedThisTurn = false;
  let rescheduleCompletedThisTurn = false;
  let cancelCompletedThisTurn = false;
  let lookupFailedThisTurn = false;

  if (state.intent === 'book_new') {
    if (state.awaitingConfirmation) {
      const isConfirmed = await checkConfirmation(userInput, state.conversationHistory);
      if (isConfirmed === true) {
        const code = generateReservationCode();
        state.reservationCode = code;
        state.confirmedSlot = state.time;
        state.awaitingConfirmation = false;
        codeGeneratedThisTurn = true;

        // Assign a physical table (AE-T##) and tag the service window.
        const service = serviceForTime(state.time!) || undefined;
        const tableCode = (await assignTable(state.date!, state.occasion!, state.time!)) || undefined;
        state.tableCode = tableCode || null;

        try {
          const holdResult = await withRetry(() =>
            createTentativeHold({
              occasion: state.occasion!,
              date: state.date!,
              time: state.time!,
              partySize: state.partySize || undefined,
              code,
            })
          );
          state.calendarEventId = holdResult.eventId;

          const sheetResult = await withRetry(() =>
            appendReservation({
              occasion: state.occasion!,
              date: state.date!,
              time: state.time!,
              partySize: state.partySize || undefined,
              code,
              sessionId: state.sessionId,
              calendarEventId: holdResult.eventId,
              tableCode,
              service,
              slotStart: state.time!,
            })
          );
          state.sheetsRowIndex = sheetResult.rowIndex;
        } catch (error) {
          console.error('[MCP Error] Both attempts failed. Proceeding anyway.', error);
        }
      } else if (isConfirmed === false) {
        state.time = null;
        state.awaitingConfirmation = false;
      }
    } else if (!state.reservationCode) {
      const extractedSlots = prefetchedSlots ?? await fillSlots(userInput, state.conversationHistory, currentDateIST);

      // --- 8.7 Past-date handling ---
      if (extractedSlots.date && extractedSlots.date < currentDateIST) {
        const msg = "I can only book future dates. What upcoming date works for you?";
        state.conversationHistory.push({ role: 'assistant', content: msg });
        return { responseText: msg, updatedState: state };
      }

      // --- 8.8 Time outside operating hours (12:00-22:00) ---
      if (extractedSlots.time) {
        const timeVal = parseInt(extractedSlots.time.replace(':', ''), 10);
        if (timeVal < 1200 || timeVal > 2200) {
           const msg = "Our kitchen closes at 10 PM and opens at 12 PM. The latest available slot is 8:30 PM.";
           state.conversationHistory.push({ role: 'assistant', content: msg });
           return { responseText: msg, updatedState: state };
        }
      }

      const checkOccasion = extractedSlots.occasion || state.occasion;
      const checkPartySize = extractedSlots.partySize || state.partySize;

      // --- 8.4 Bar/Lounge constraints ---
      if (checkOccasion === 'Bar/Lounge' && checkPartySize && checkPartySize > 4) {
        const msg = "Bar seating is limited to 4 guests. For larger groups, I can offer our Standard Dining or Large Group sections instead.";
        state.conversationHistory.push({ role: 'assistant', content: msg });
        return { responseText: msg, updatedState: state };
      }

      // --- 8.5 Large Group constraints ---
      if (checkOccasion === 'Large Group (6+)' && checkPartySize) {
         if (checkPartySize > 20) {
            const msg = "For parties larger than 20, please contact our events team directly so we can best accommodate you.";
            state.conversationHistory.push({ role: 'assistant', content: msg });
            return { responseText: msg, updatedState: state };
         }
         if (checkPartySize < 6) {
            extractedSlots.occasion = 'Standard Dining'; // auto downgrade
         }
      }

      if (extractedSlots.occasion) state.occasion = extractedSlots.occasion;
      if (extractedSlots.date) state.date = extractedSlots.date;
      if (extractedSlots.time) state.time = extractedSlots.time;
      if (extractedSlots.partySize) state.partySize = extractedSlots.partySize;

      if (state.date && state.occasion) {
        if (state.occasion === 'Large Group (6+)' && !state.partySize) {
          state.offeredSlots = [];
        } else {
          const availability = await getAvailableSlots(state.date, state.occasion);
          state.offeredSlots = availability.slots;
          state.alternativeDates = availability.alternativeDates;
        }
      }

      if (state.occasion && state.date && state.time) {
        state.awaitingConfirmation = true;
      }
    }
  }

  // -------------------------------------------------------------------------
  // Intent: cancel
  // -------------------------------------------------------------------------
  else if (state.intent === 'cancel') {
    if (!state.intentPhase) {
      state.intentPhase = 'collecting_code';
    }

    if (state.intentPhase === 'collecting_code') {
      // Try to extract a code from the utterance
      const rawCode = extractCodeFromUtterance(userInput);
      if (rawCode) {
        // Look it up in the sheet
        let record = null;
        try {
          record = await withRetry(() => lookupReservation(rawCode));
        } catch (err) {
          console.error('[Sheets] lookupReservation error:', err);
        }

        if (!record) {
          lookupFailedThisTurn = true;
        } else {
          state.existingCode = record.code;
          state.existingDate = record.date;
          state.existingTime = record.time;
          state.existingOccasion = record.occasion;
          state.existingCalendarEventId = record.calendarEventId || null;
          state.intentPhase = 'awaiting_cancel_confirm';
        }
      }
      // else: no code found in utterance yet — stay in collecting_code
    } else if (state.intentPhase === 'awaiting_cancel_confirm') {
      const isConfirmed = await checkConfirmation(userInput, state.conversationHistory);
      if (isConfirmed === true) {
        // Perform cancel
        try {
          if (state.existingCalendarEventId) {
            await withRetry(() => deleteHold(state.existingCalendarEventId!));
          }
          await withRetry(() =>
            updateReservationStatus(state.existingCode!, 'CANCELLED')
          );
          cancelCompletedThisTurn = true;
          state.intentPhase = null;
        } catch (err) {
          console.error('[MCP Error] Cancel MCP calls failed:', err);
        }
      } else if (isConfirmed === false) {
        // User changed mind — reset cancel flow
        state.intentPhase = null;
        state.existingCode = null;
        state.existingDate = null;
        state.existingTime = null;
        state.existingOccasion = null;
        state.existingCalendarEventId = null;
        state.intent = 'unknown';
      }
    }
  }

  // -------------------------------------------------------------------------
  // Intent: reschedule
  // -------------------------------------------------------------------------
  else if (state.intent === 'reschedule') {
    if (!state.intentPhase) {
      state.intentPhase = 'collecting_code';
    }

    if (state.intentPhase === 'collecting_code') {
      const rawCode = extractCodeFromUtterance(userInput);
      if (rawCode) {
        let record = null;
        try {
          record = await withRetry(() => lookupReservation(rawCode));
        } catch (err) {
          console.error('[Sheets] lookupReservation error:', err);
        }

        if (!record) {
          lookupFailedThisTurn = true;
        } else {
          state.existingCode = record.code;
          state.existingDate = record.date;
          state.existingTime = record.time;
          state.existingOccasion = record.occasion;
          state.existingCalendarEventId = record.calendarEventId || null;
          state.intentPhase = 'awaiting_new_slot';
        }
      }
    } else if (state.intentPhase === 'awaiting_new_slot') {
      // Extract new date + time from the utterance
      const extractedSlots = prefetchedSlots ?? await fillSlots(userInput, state.conversationHistory, currentDateIST);
      if (extractedSlots.date) state.newDate = extractedSlots.date;
      if (extractedSlots.time) state.newTime = extractedSlots.time;

      // Check availability for the new slot
      if (state.newDate && state.existingOccasion) {
        const availability = await getAvailableSlots(state.newDate, state.existingOccasion);
        state.offeredSlots = availability.slots;
        state.alternativeDates = availability.alternativeDates;
      }

      if (state.newDate && state.newTime) {
        state.intentPhase = 'awaiting_reschedule_confirm';
      }
    } else if (state.intentPhase === 'awaiting_reschedule_confirm') {
      const isConfirmed = await checkConfirmation(userInput, state.conversationHistory);
      if (isConfirmed === true) {
        // Perform reschedule MCP calls
        try {
          if (state.existingCalendarEventId) {
            await withRetry(() =>
              updateHold(state.existingCalendarEventId!, {
                occasion: state.existingOccasion || undefined,
                date: state.newDate!,
                time: state.newTime!,
                code: state.existingCode!,
              })
            );
          }
          await withRetry(() =>
            updateReservationStatus(state.existingCode!, 'RESCHEDULED')
          );
          // Append a new row for the rescheduled booking (same code), re-assigning
          // a physical table for the new slot.
          const rescheduleService = serviceForTime(state.newTime!) || undefined;
          const rescheduleTable =
            (await assignTable(state.newDate!, state.existingOccasion!, state.newTime!)) || undefined;
          await withRetry(() =>
            appendReservation({
              occasion: state.existingOccasion!,
              date: state.newDate!,
              time: state.newTime!,
              code: state.existingCode!,
              sessionId: state.sessionId,
              calendarEventId: state.existingCalendarEventId || undefined,
              notes: `Rescheduled from ${state.existingDate} ${state.existingTime}`,
              tableCode: rescheduleTable,
              service: rescheduleService,
              slotStart: state.newTime!,
            })
          );
          rescheduleCompletedThisTurn = true;
          state.intentPhase = null;
        } catch (err) {
          console.error('[MCP Error] Reschedule MCP calls failed:', err);
        }
      } else if (isConfirmed === false) {
        // User wants different slot — go back to collecting new slot
        state.newDate = null;
        state.newTime = null;
        state.offeredSlots = [];
        state.intentPhase = 'awaiting_new_slot';
      }
    }
  }

  // -------------------------------------------------------------------------
  // Intent: check_availability
  // -------------------------------------------------------------------------
  else if (state.intent === 'check_availability') {
     const extractedSlots = prefetchedSlots ?? await fillSlots(userInput, state.conversationHistory, currentDateIST);

     if (extractedSlots.date && extractedSlots.date < currentDateIST) {
        const msg = "I can only check future dates. What upcoming date works for you?";
        state.conversationHistory.push({ role: 'assistant', content: msg });
        return { responseText: msg, updatedState: state };
     }

     if (extractedSlots.date) state.date = extractedSlots.date;
     if (extractedSlots.occasion) state.occasion = extractedSlots.occasion;

     if (state.date) {
        const availability = await getAvailableSlots(state.date, state.occasion || 'Standard Dining');
        state.offeredSlots = availability.slots;
        state.alternativeDates = availability.alternativeDates;
     }
  }

  // -------------------------------------------------------------------------
  // Build response via LLM
  // -------------------------------------------------------------------------
  const systemPrompt = getSystemPrompt();

  // Compose a rich context string to guide the LLM's response
  const rescheduleContext = state.intent === 'reschedule'
    ? `
Reschedule State:
- Phase: ${state.intentPhase || 'none'}
- Existing Code: ${state.existingCode || 'not yet provided'}
- Existing Booking: ${state.existingOccasion || '?'} on ${state.existingDate || '?'} at ${state.existingTime || '?'} IST
- New Date Requested: ${state.newDate || 'not yet provided'}
- New Time Requested: ${state.newTime || 'not yet provided'}
- Available New Slots: ${state.offeredSlots.length > 0 ? state.offeredSlots.join(', ') : 'none'}
- Reschedule Completed This Turn: ${rescheduleCompletedThisTurn}
- Lookup Failed: ${lookupFailedThisTurn}`
    : '';

  const cancelContext = state.intent === 'cancel'
    ? `
Cancel State:
- Phase: ${state.intentPhase || 'none'}
- Existing Code: ${state.existingCode || 'not yet provided'}
- Existing Booking: ${state.existingOccasion || '?'} on ${state.existingDate || '?'} at ${state.existingTime || '?'} IST
- Cancel Completed This Turn: ${cancelCompletedThisTurn}
- Lookup Failed: ${lookupFailedThisTurn}`
    : '';

  const contextPrompt = `${systemPrompt}

Current Session State:
- Intent: ${state.intent}
- Occasion: ${state.occasion || 'Not specified'}
- Date: ${state.date || 'Not specified'}
- Time: ${state.time || 'Not specified'}
- Party Size: ${state.partySize || 'Not specified (default 2)'}
- Awaiting Confirmation: ${state.awaitingConfirmation}
- Offered Slots: ${state.offeredSlots.length > 0 ? state.offeredSlots.join(', ') : 'None'}
- Alternative Dates: ${state.alternativeDates ? JSON.stringify(state.alternativeDates) : 'None'}
- Reservation Code (new booking): ${state.reservationCode || 'None'}
${rescheduleContext}
${cancelContext}

Current Date Info:
- Today is: ${currentDayName}, ${currentDateIST} IST

Response Instructions:
1. Respond warmly and efficiently as TableVoice.
2. BOOK_NEW:
   - Code just generated (${codeGeneratedThisTurn ? 'YES' : 'NO'}): if YES, announce success and repeat the code TWICE: "Your Reservation Code is ${state.reservationCode} — that's ${state.reservationCode}." Then ask "Is there anything else I can help you with?"
   - If awaitingConfirmation: read back occasion + date (formatted) + time (IST) and ask "Shall I lock that in?"
   - REQUIRED — Occasion: if Occasion is "Not specified", you MUST ask which dining occasion they'd like before anything else — offer the options: Standard Dining, Outdoor/Patio, Special Occasion/Anniversary, Bar/Lounge, or Large Group (6+). Do NOT read back a booking, check availability, or assume "Standard Dining" until the guest has chosen. Ask this first, before date/time/party size.
   - If other slots missing (date, time, party size) and Occasion IS specified: ask for the missing one(s), ONE question per turn.
3. RESCHEDULE:
   - Phase 'collecting_code': ask user to provide their existing reservation code (e.g. TABLE-R07).
   - Phase 'awaiting_new_slot': confirm you found their ${state.existingOccasion} booking on ${state.existingDate} at ${state.existingTime} IST and ask what new date/time they'd like.
   - Phase 'awaiting_reschedule_confirm': read back the new slot (formatted date + time IST) and ask "Shall I move your reservation to that slot?" Remind them the code stays the same.
   - RESCHEDULE COMPLETED (${rescheduleCompletedThisTurn ? 'YES' : 'NO'}): if YES, confirm rescheduled and state "Your code remains ${state.existingCode}." Then ask "Is there anything else I can help you with?"
   - LOOKUP FAILED (${lookupFailedThisTurn ? 'YES' : 'NO'}): if YES, say "I couldn't find that code. It should look like TABLE followed by a letter and two numbers, for example TABLE-R07. Could you double-check?"
4. CANCEL:
   - Phase 'collecting_code': ask user to provide their existing reservation code.
   - Phase 'awaiting_cancel_confirm': read back the booking (occasion, date, time IST) and ask "Are you sure you'd like to cancel your reservation?"
   - CANCEL COMPLETED (${cancelCompletedThisTurn ? 'YES' : 'NO'}): if YES, confirm the cancellation warmly. Then ask "Is there anything else I can help you with?"
   - LOOKUP FAILED (${lookupFailedThisTurn ? 'YES' : 'NO'}): if YES, say "I couldn't find that code. It should look like TABLE followed by a letter and two numbers, for example TABLE-R07. Could you double-check?"
5. CHECK_AVAILABILITY:
   - If date is missing, ask what date they are checking for.
   - If date is present, read the Offered Slots (max 3) or alternative dates. Do NOT ask them to confirm a booking, just state the availability and ask if they'd like to book one.
6. Always format dates as "[Day Name], the [DD] of [Month] [YYYY]" and times with "IST" suffix.
7. Keep responses under 2–3 sentences. Never collect PII.

Recent Conversation History:
${state.conversationHistory.slice(-6).map((h) => `${h.role === 'assistant' ? 'Agent' : 'User'}: ${h.content}`).join('\n')}

Generate the next assistant turn response:`;

  const responseText = (
    await groqChat({
      system:
        'You are the voice reservation assistant for Aether Dining. Follow the instructions in the user message precisely and reply with ONLY the assistant\'s next spoken turn (no JSON, no labels).',
      user: contextPrompt,
      json: false,
      temperature: 0.7,
      maxTokens: 300,
    })
  ).trim();
  state.conversationHistory.push({ role: 'assistant', content: responseText });

  // If a flow just completed this turn, the agent has now asked "anything else?"
  // (per the response instructions) — arm the decline handler for the next turn.
  if (codeGeneratedThisTurn || rescheduleCompletedThisTurn || cancelCompletedThisTurn) {
    state.awaitingAnythingElse = true;
  }

  return { responseText, updatedState: state };
}
