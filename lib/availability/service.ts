import fs from 'fs';
import path from 'path';
import { getTables, getReservationsForDate, type ReservationRecord } from '../mcp/sheets';
import {
  allSlots,
  serviceForTime,
  eligibleTables,
  holdsOverlap,
  type TableDef,
} from '../restaurant/config';

export interface AvailabilityResult {
  slots: string[];
  alternativeDates?: { date: string; slots: string[] }[];
}

export function getInventory(): Record<string, Record<string, string[]>> {
  try {
    const inventoryPath = path.join(process.cwd(), 'lib/availability/mockInventory.json');
    if (fs.existsSync(inventoryPath)) {
      const data = fs.readFileSync(inventoryPath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error reading inventory:', error);
  }
  return {};
}

export function getOccasionConfig(): Record<string, boolean> {
  try {
    const configPath = path.join(process.cwd(), 'lib/availability/occasionConfig.json');
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  } catch {
    // Fall through to defaults
  }
  return {
    'Standard Dining': true,
    'Large Group (6+)': true,
    'Outdoor/Patio': true,
    'Special Occasion/Anniversary': true,
    'Bar/Lounge': true,
  };
}

export function setOccasionConfig(config: Record<string, boolean>): void {
  const configPath = path.join(process.cwd(), 'lib/availability/occasionConfig.json');
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
}

/** Is a specific physical table free at a given start slot on a date? */
function tableFree(table: TableDef, slot: string, reservations: ReservationRecord[]): boolean {
  return !reservations.some(
    r =>
      (r.tableCode || '').toUpperCase() === table.code.toUpperCase() &&
      holdsOverlap(r.slotStart || r.time, slot)
  );
}

/** Start slots (across both services) that still have ≥1 eligible free table. */
function freeSlotsFor(
  occasion: string,
  tables: TableDef[],
  reservations: ReservationRecord[]
): string[] {
  const out: string[] = [];
  for (const slot of allSlots()) {
    const service = serviceForTime(slot);
    if (!service) continue;
    const candidates = eligibleTables(tables, occasion, service);
    if (candidates.length === 0) continue;
    if (candidates.some(t => tableFree(t, slot, reservations))) out.push(slot);
  }
  return out;
}

/**
 * Real, table-based availability for Aether Dining's 20 tables.
 * A slot is offered when at least one zone-eligible table has no overlapping
 * CONFIRMED booking. Falls back to the seeded 20-table registry when Sheets is
 * unreachable (getTables/getReservationsForDate degrade gracefully).
 */
export async function getAvailableSlots(date: string, occasion: string): Promise<AvailabilityResult> {
  // Respect admin toggle — if occasion is disabled, return no slots
  const config = getOccasionConfig();
  if (config[occasion] === false) {
    return { slots: [], alternativeDates: [] };
  }

  const tables = await getTables(); // constant across dates — fetch once
  const reservations = await getReservationsForDate(date);
  const slots = freeSlotsFor(occasion, tables, reservations);

  if (slots.length > 0) {
    return { slots: slots.slice(0, 3) };
  }

  // Overflow logic: search forward up to 14 days for alternatives
  const alternatives: { date: string; slots: string[] }[] = [];
  const currentDate = new Date(date + 'T00:00:00');

  for (let i = 1; i <= 14; i++) {
    currentDate.setDate(currentDate.getDate() + 1);
    const nextDateStr = currentDate.toISOString().split('T')[0];
    const nextReservations = await getReservationsForDate(nextDateStr);
    const nextSlots = freeSlotsFor(occasion, tables, nextReservations);
    if (nextSlots.length > 0) {
      alternatives.push({ date: nextDateStr, slots: nextSlots.slice(0, 3) });
      if (alternatives.length >= 2) break;
    }
  }

  return { slots: [], alternativeDates: alternatives };
}

/**
 * Picks a free physical table for a confirmed booking. Returns the TableCode
 * (e.g. AE-T07), or null if every eligible table is taken for that slot.
 * Smaller tables are preferred first (see eligibleTables sort).
 */
export async function assignTable(date: string, occasion: string, time: string): Promise<string | null> {
  const service = serviceForTime(time);
  if (!service) return null;

  const tables = await getTables();
  const reservations = await getReservationsForDate(date);
  const candidates = eligibleTables(tables, occasion, service);

  for (const t of candidates) {
    if (tableFree(t, time, reservations)) return t.code;
  }
  return null;
}
