/**
 * Golden evaluation dataset for the Aether Dining voice agent's "brain":
 * intent classification + slot extraction. All date-relative cases are graded
 * against a fixed reference date (Sunday, 2026-06-14) so grading is deterministic.
 *
 * Cases are hand-labelled. The `noisy` flag marks colloquial / ASR-style phrasings
 * used to measure robustness to imperfect speech-to-text output.
 */

export const REFERENCE_DATE = '2026-06-14'; // Sunday

export type IntentLabel =
  | 'book_new'
  | 'reschedule'
  | 'cancel'
  | 'check_availability'
  | 'unknown';

export interface IntentCase {
  id: string;
  utterance: string;
  history?: { role: 'user' | 'assistant'; content: string }[];
  expected: IntentLabel;
  noisy?: boolean;
}

export interface SlotCase {
  id: string;
  utterance: string;
  history?: { role: 'user' | 'assistant'; content: string }[];
  expected: {
    occasion: string | null;
    date: string | null; // YYYY-MM-DD
    time: string | null; // HH:MM
    partySize: number | null;
  };
  noisy?: boolean;
}

// ---------------------------------------------------------------------------
// Intent classification cases
// ---------------------------------------------------------------------------
export const INTENT_CASES: IntentCase[] = [
  { id: 'int-01', utterance: "I'd like to reserve a table for two this Saturday", expected: 'book_new' },
  { id: 'int-02', utterance: 'Can we get a table for dinner tonight?', expected: 'book_new' },
  { id: 'int-03', utterance: "We'd love to dine at your restaurant tomorrow evening", expected: 'book_new' },
  { id: 'int-04', utterance: 'Book us a patio table for four', expected: 'book_new' },
  { id: 'int-05', utterance: 'I need to move my reservation to Friday instead', expected: 'reschedule' },
  { id: 'int-06', utterance: 'Can I change the time on my booking?', expected: 'reschedule' },
  { id: 'int-07', utterance: 'I want to cancel my reservation', expected: 'cancel' },
  { id: 'int-08', utterance: 'Please cancel the booking under my name', expected: 'cancel' },
  { id: 'int-09', utterance: 'Do you have any tables open on Friday night?', expected: 'check_availability' },
  { id: 'int-10', utterance: 'What times are still available this weekend?', expected: 'check_availability' },
  { id: 'int-11', utterance: 'Hi there, how are you today?', expected: 'unknown' },
  { id: 'int-12', utterance: 'Do you guys have valet parking?', expected: 'unknown' },
  // Context-dependent: mid-booking clarification should stay book_new
  {
    id: 'int-13',
    utterance: 'Make it the patio actually',
    history: [
      { role: 'user', content: 'I want to book a table for four tomorrow' },
      { role: 'assistant', content: 'Sure! What kind of seating would you like?' },
    ],
    expected: 'book_new',
  },
  // Noisy / ASR-style phrasings
  { id: 'int-14', utterance: 'yeah um can u book a table for like 6 people saturday', expected: 'book_new', noisy: true },
  { id: 'int-15', utterance: 'i wanna cancel that booking i made', expected: 'cancel', noisy: true },
  { id: 'int-16', utterance: 'is there anything open friday for dinner', expected: 'check_availability', noisy: true },
];

// ---------------------------------------------------------------------------
// Slot extraction cases (reference: Sunday, 2026-06-14)
// ---------------------------------------------------------------------------
export const SLOT_CASES: SlotCase[] = [
  {
    id: 'slot-01',
    utterance: "I'd like a table for two this Saturday at 7 PM",
    expected: { occasion: 'Standard Dining', date: '2026-06-20', time: '19:00', partySize: 2 },
  },
  {
    id: 'slot-02',
    utterance: 'Can we book a patio table for four tomorrow at 1:30 in the afternoon',
    expected: { occasion: 'Outdoor/Patio', date: '2026-06-15', time: '13:30', partySize: 4 },
  },
  {
    id: 'slot-03',
    utterance: "It's our anniversary — a table for 2 today at 8pm",
    expected: { occasion: 'Special Occasion/Anniversary', date: '2026-06-14', time: '20:00', partySize: 2 },
  },
  {
    id: 'slot-04',
    utterance: 'We need seating for a group of six this Friday at 7:30 pm',
    expected: { occasion: 'Large Group (6+)', date: '2026-06-19', time: '19:30', partySize: 6 },
  },
  {
    id: 'slot-05',
    utterance: 'A spot at the bar for two tomorrow at 9 PM',
    expected: { occasion: 'Bar/Lounge', date: '2026-06-15', time: '21:00', partySize: 2 },
  },
  {
    id: 'slot-06',
    utterance: 'Table for three tomorrow evening at 7',
    expected: { occasion: 'Standard Dining', date: '2026-06-15', time: '19:00', partySize: 3 },
  },
  {
    id: 'slot-07',
    utterance: 'Dinner for two this Saturday', // no time given
    expected: { occasion: 'Standard Dining', date: '2026-06-20', time: null, partySize: 2 },
  },
  {
    id: 'slot-08',
    utterance: 'Just the two of us, today at half past six in the evening', // colloquial time
    expected: { occasion: 'Standard Dining', date: '2026-06-14', time: '18:30', partySize: 2 },
    noisy: true,
  },
  {
    id: 'slot-09',
    utterance: 'party of 5 tmrw at 8', // ASR shorthand, evening implied by dinner service
    expected: { occasion: 'Standard Dining', date: '2026-06-15', time: '20:00', partySize: 5 },
    noisy: true,
  },
  {
    id: 'slot-10',
    // multi-turn: occasion + size from history, this utterance adds date + time
    utterance: 'this Saturday at 7:30 in the evening',
    history: [
      { role: 'user', content: 'We want an outdoor table for four' },
      { role: 'assistant', content: 'Wonderful — what date and time works for you?' },
    ],
    expected: { occasion: 'Outdoor/Patio', date: '2026-06-20', time: '19:30', partySize: 4 },
  },
];
