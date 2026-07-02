/**
 * Pure scoring + statistics helpers for the voice-agent evals.
 * Kept side-effect-free so they are trivially unit-testable and reusable.
 */

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.min(Math.max(idx, 0), sorted.length - 1)];
}

export interface LatencyStats {
  n: number;
  mean: number;
  p50: number;
  p95: number;
  min: number;
  max: number;
}

export function summarizeLatency(values: number[]): LatencyStats {
  if (values.length === 0) return { n: 0, mean: 0, p50: 0, p95: 0, min: 0, max: 0 };
  const sum = values.reduce((a, b) => a + b, 0);
  return {
    n: values.length,
    mean: Math.round(sum / values.length),
    p50: percentile(values, 50),
    p95: percentile(values, 95),
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

export function gradeIntent(expected: string, got: string): boolean {
  return expected === got;
}

export interface SlotFields {
  occasion: string | null;
  date: string | null;
  time: string | null;
  partySize: number | null;
}

export interface SlotGrade {
  fields: { occasion: boolean; date: boolean; time: boolean; partySize: boolean };
  allCorrect: boolean;
}

export function gradeSlots(expected: SlotFields, got: SlotFields): SlotGrade {
  const eq = (a: unknown, b: unknown) => a === b;
  const fields = {
    occasion: eq(expected.occasion, got.occasion),
    date: eq(expected.date, got.date),
    time: eq(expected.time, got.time),
    partySize: eq(expected.partySize, got.partySize),
  };
  return { fields, allCorrect: Object.values(fields).every(Boolean) };
}

export function pct(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10; // one decimal
}
