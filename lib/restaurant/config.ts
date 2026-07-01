// Aether Dining — physical restaurant model.
// 20 tables, two services (Lunch / Dinner), fixed 30-min start slots,
// each booking holds a table for 90 minutes.

export type Service = 'Lunch' | 'Dinner';

export const RESTAURANT_NAME = 'Aether Dining';
export const TABLE_COUNT = 20;
export const SLOT_MINUTES = 30;    // start-time granularity
export const SEATING_MINUTES = 90; // how long a table stays occupied per booking

// Service windows. Dinner's last *reservation* is 22:30 (kitchen/last-order at 22:30,
// service ends ~23:00). Lunch runs 12:00–16:00, last start 15:30.
export const SERVICE_WINDOWS: Record<Service, { firstSlot: string; lastSlot: string }> = {
  Lunch:  { firstSlot: '12:00', lastSlot: '15:30' },
  Dinner: { firstSlot: '19:30', lastSlot: '22:30' },
};

// Occasion (from the voice picker) → physical table Zone.
export const OCCASION_ZONE: Record<string, string> = {
  'Standard Dining': 'Standard',
  'Large Group (6+)': 'Standard', // seated at the 6-seat standard tables
  'Outdoor/Patio': 'Patio',
  'Special Occasion/Anniversary': 'Special',
  'Bar/Lounge': 'Bar-Lounge',
};

// Minimum seats an occasion needs (Large Group must land on a 6-top).
export const OCCASION_MIN_SEATS: Record<string, number> = {
  'Large Group (6+)': 6,
};

export interface TableDef {
  code: string;   // AE-T01 .. AE-T20
  seats: number;
  zone: string;   // Standard | Patio | Bar-Lounge | Special
  lunch: boolean;
  dinner: boolean;
}

// Master registry — the "booking code for each table". Seeded into the Tables tab
// via scripts/seedTables.ts and used as the offline fallback when Sheets is unreachable.
export const TABLE_SEED: TableDef[] = [
  { code: 'AE-T01', seats: 2, zone: 'Standard',   lunch: true,  dinner: true },
  { code: 'AE-T02', seats: 2, zone: 'Standard',   lunch: true,  dinner: true },
  { code: 'AE-T03', seats: 2, zone: 'Standard',   lunch: true,  dinner: true },
  { code: 'AE-T04', seats: 2, zone: 'Standard',   lunch: true,  dinner: true },
  { code: 'AE-T05', seats: 4, zone: 'Standard',   lunch: true,  dinner: true },
  { code: 'AE-T06', seats: 4, zone: 'Standard',   lunch: true,  dinner: true },
  { code: 'AE-T07', seats: 4, zone: 'Standard',   lunch: true,  dinner: true },
  { code: 'AE-T08', seats: 4, zone: 'Standard',   lunch: true,  dinner: true },
  { code: 'AE-T09', seats: 4, zone: 'Standard',   lunch: true,  dinner: true },
  { code: 'AE-T10', seats: 4, zone: 'Standard',   lunch: true,  dinner: true },
  { code: 'AE-T11', seats: 4, zone: 'Standard',   lunch: true,  dinner: true },
  { code: 'AE-T12', seats: 4, zone: 'Standard',   lunch: true,  dinner: true },
  { code: 'AE-T13', seats: 6, zone: 'Standard',   lunch: true,  dinner: true },
  { code: 'AE-T14', seats: 6, zone: 'Standard',   lunch: true,  dinner: true },
  { code: 'AE-T15', seats: 6, zone: 'Standard',   lunch: true,  dinner: true },
  { code: 'AE-T16', seats: 4, zone: 'Patio',      lunch: true,  dinner: true },
  { code: 'AE-T17', seats: 4, zone: 'Patio',      lunch: true,  dinner: true },
  { code: 'AE-T18', seats: 2, zone: 'Bar-Lounge', lunch: true,  dinner: true },
  { code: 'AE-T19', seats: 2, zone: 'Bar-Lounge', lunch: true,  dinner: true },
  { code: 'AE-T20', seats: 4, zone: 'Special',    lunch: true,  dinner: true },
];

// ── time helpers ──────────────────────────────────────────────────────────
export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
}
export function toHHMM(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Which service a start time belongs to, or null if outside both windows. */
export function serviceForTime(hhmm: string): Service | null {
  const t = toMinutes(hhmm);
  for (const svc of ['Lunch', 'Dinner'] as Service[]) {
    const w = SERVICE_WINDOWS[svc];
    if (t >= toMinutes(w.firstSlot) && t <= toMinutes(w.lastSlot)) return svc;
  }
  return null;
}

/** All valid start slots for a service, e.g. ['12:00','12:30',...]. */
export function generateSlots(service: Service): string[] {
  const { firstSlot, lastSlot } = SERVICE_WINDOWS[service];
  const out: string[] = [];
  for (let t = toMinutes(firstSlot); t <= toMinutes(lastSlot); t += SLOT_MINUTES) {
    out.push(toHHMM(t));
  }
  return out;
}

/** Both services' slots for a day, Lunch first. */
export function allSlots(): string[] {
  return [...generateSlots('Lunch'), ...generateSlots('Dinner')];
}

/** Do two 90-min holds starting at these times overlap on the same table? */
export function holdsOverlap(startA: string, startB: string): boolean {
  return Math.abs(toMinutes(startA) - toMinutes(startB)) < SEATING_MINUTES;
}

/** Tables eligible for an occasion (zone + min-seats), sorted by seats ascending
 *  so smaller parties take smaller tables first. */
export function eligibleTables(tables: TableDef[], occasion: string, service: Service): TableDef[] {
  const zone = OCCASION_ZONE[occasion] || 'Standard';
  const minSeats = OCCASION_MIN_SEATS[occasion] || 0;
  return tables
    .filter(t => t.zone === zone)
    .filter(t => (service === 'Lunch' ? t.lunch : t.dinner))
    .filter(t => t.seats >= minSeats)
    .sort((a, b) => a.seats - b.seats);
}
