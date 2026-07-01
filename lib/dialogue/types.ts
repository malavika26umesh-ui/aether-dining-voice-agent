export type IntentPhase =
  | 'collecting_code'       // waiting for user to provide their existing code
  | 'awaiting_new_slot'     // reschedule: have code, waiting for new date/time
  | 'awaiting_cancel_confirm' // cancel: have booking details, waiting yes/no
  | 'awaiting_reschedule_confirm'; // reschedule: have new slot, waiting yes/no

export interface SessionState {
  sessionId: string;
  intent: 'unknown' | 'book_new' | 'reschedule' | 'cancel' | 'check_availability';
  occasion: string | null;
  date: string | null;         // ISO format YYYY-MM-DD
  time: string | null;         // HH:MM format
  partySize: number | null;
  offeredSlots: string[];
  confirmedSlot: string | null;
  reservationCode: string | null;
  tableCode: string | null;   // assigned physical table (AE-T##)
  turnCount: number;
  awaitingConfirmation: boolean;
  conversationHistory: { role: 'user' | 'assistant'; content: string }[];
  alternativeDates?: { date: string; slots: string[] }[];
  calendarEventId: string | null;
  sheetsRowIndex: number | null;

  // --- Sprint 7 additions ---
  /** Sub-phase within reschedule or cancel flows */
  intentPhase: IntentPhase | null;
  /** The reservation code the user provided (for reschedule/cancel) */
  existingCode: string | null;
  /** Date/time details of the existing booking (loaded from sheet) */
  existingDate: string | null;
  existingTime: string | null;
  existingOccasion: string | null;
  /** New date/time the user wants (reschedule only) */
  newDate: string | null;
  newTime: string | null;
  /** Calendar event ID from the looked-up booking */
  existingCalendarEventId: string | null;

  // --- End-of-session flow ---
  /** True after a booking/reschedule/cancel completes and we've asked "anything else?" */
  awaitingAnythingElse: boolean;
  /** Transient: set when the user declines further help — tells the server to close the session. */
  closeSession: boolean;
}

