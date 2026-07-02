/**
 * Voice-agent evaluation runner.
 *
 * Runs the golden dataset (evals/dataset.ts) against the LIVE dialogue brain
 * (Groq-backed detectIntent + fillSlots), grades every case, measures real
 * per-call latency, and writes evals/results.json + a console summary.
 *
 * This is NOT part of `npm test` — it makes real API calls. Run it explicitly:
 *   npm run eval
 */
import fs from 'fs';
import path from 'path';
import { detectIntent } from '@/lib/dialogue/intentDetector';
import { fillSlots } from '@/lib/dialogue/slotFiller';
import { INTENT_CASES, SLOT_CASES, REFERENCE_DATE } from './dataset';
import {
  summarizeLatency,
  gradeIntent,
  gradeSlots,
  pct,
  type LatencyStats,
} from './harness';

// --- Load GROQ_API_KEY from .env (jest does not auto-load it) ---
function loadEnv() {
  if (process.env.GROQ_API_KEY) return;
  try {
    const env = fs.readFileSync(path.join(process.cwd(), '.env'), 'utf8');
    const m = env.match(/^GROQ_API_KEY=(.*)$/m);
    if (m) process.env.GROQ_API_KEY = m[1].trim().replace(/^["']|["']$/g, '');
  } catch {
    /* no .env — will fail loudly below */
  }
}

async function timed<T>(fn: () => Promise<T>): Promise<{ result: T; ms: number }> {
  const start = Date.now();
  const result = await fn();
  return { result, ms: Date.now() - start };
}

describe('Aether Dining — Voice Agent Evals', () => {
  it(
    'runs the golden dataset against the live dialogue brain',
    async () => {
      loadEnv();
      if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY missing — cannot run evals');

      const intentLatencies: number[] = [];
      const slotLatencies: number[] = [];

      // ---- Intent classification ----
      let intentCorrect = 0;
      let intentNoisyTotal = 0;
      let intentNoisyCorrect = 0;
      const intentDetails: any[] = [];
      const confidences: number[] = [];

      for (const c of INTENT_CASES) {
        const { result, ms } = await timed(() => detectIntent(c.utterance, c.history || []));
        intentLatencies.push(ms);
        confidences.push(result.confidence ?? 0);
        const ok = gradeIntent(c.expected, result.intent);
        if (ok) intentCorrect++;
        if (c.noisy) {
          intentNoisyTotal++;
          if (ok) intentNoisyCorrect++;
        }
        intentDetails.push({ id: c.id, expected: c.expected, got: result.intent, ok, ms, noisy: !!c.noisy });
      }

      // ---- Slot extraction ----
      let slotAllCorrect = 0;
      const fieldHits = { occasion: 0, date: 0, time: 0, partySize: 0 };
      const slotDetails: any[] = [];

      for (const c of SLOT_CASES) {
        const { result, ms } = await timed(() => fillSlots(c.utterance, c.history || [], REFERENCE_DATE));
        slotLatencies.push(ms);
        const grade = gradeSlots(c.expected, result);
        if (grade.allCorrect) slotAllCorrect++;
        for (const k of ['occasion', 'date', 'time', 'partySize'] as const) {
          if (grade.fields[k]) fieldHits[k]++;
        }
        slotDetails.push({ id: c.id, expected: c.expected, got: result, grade: grade.fields, allCorrect: grade.allCorrect, ms });
      }

      const nSlots = SLOT_CASES.length;
      const intentLat: LatencyStats = summarizeLatency(intentLatencies);
      const slotLat: LatencyStats = summarizeLatency(slotLatencies);
      const combinedLat: LatencyStats = summarizeLatency([...intentLatencies, ...slotLatencies]);
      const avgConfidence = confidences.length
        ? Math.round((confidences.reduce((a, b) => a + b, 0) / confidences.length) * 100) / 100
        : 0;

      const results = {
        generatedAt: new Date().toISOString(),
        model: 'groq/llama-3.3-70b-versatile',
        referenceDate: REFERENCE_DATE,
        summary: {
          intentAccuracyPct: pct(intentCorrect, INTENT_CASES.length),
          intentCases: INTENT_CASES.length,
          intentNoisyAccuracyPct: pct(intentNoisyCorrect, intentNoisyTotal),
          avgIntentConfidence: avgConfidence,
          slotExactMatchPct: pct(slotAllCorrect, nSlots),
          slotFieldAccuracyPct: {
            occasion: pct(fieldHits.occasion, nSlots),
            date: pct(fieldHits.date, nSlots),
            time: pct(fieldHits.time, nSlots),
            partySize: pct(fieldHits.partySize, nSlots),
          },
          latencyMs: { intent: intentLat, slot: slotLat, combined: combinedLat },
        },
        intentDetails,
        slotDetails,
      };

      const outPath = path.join(process.cwd(), 'evals', 'results.json');
      fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');

      // ---- Console summary ----
      const s = results.summary;
      /* eslint-disable no-console */
      console.log('\n================ AETHER DINING — VOICE AGENT EVALS ================');
      console.log(`Model: ${results.model}   |   Cases: ${INTENT_CASES.length} intent + ${nSlots} slot`);
      console.log('------------------------------------------------------------------');
      console.log(`Intent accuracy .................. ${s.intentAccuracyPct}%  (${intentCorrect}/${INTENT_CASES.length})`);
      console.log(`  └ noisy/ASR subset ............. ${s.intentNoisyAccuracyPct}%  (${intentNoisyCorrect}/${intentNoisyTotal})`);
      console.log(`  └ avg confidence .............. ${s.avgIntentConfidence}`);
      console.log(`Slot exact-match (all 4 fields) .. ${s.slotExactMatchPct}%  (${slotAllCorrect}/${nSlots})`);
      console.log(`  └ occasion .................... ${s.slotFieldAccuracyPct.occasion}%`);
      console.log(`  └ date ........................ ${s.slotFieldAccuracyPct.date}%`);
      console.log(`  └ time ........................ ${s.slotFieldAccuracyPct.time}%`);
      console.log(`  └ partySize ................... ${s.slotFieldAccuracyPct.partySize}%`);
      console.log('------------------------------------------------------------------');
      console.log(`Latency (LLM reasoning only, ms):`);
      console.log(`  intent  mean ${intentLat.mean}  p50 ${intentLat.p50}  p95 ${intentLat.p95}`);
      console.log(`  slots   mean ${slotLat.mean}  p50 ${slotLat.p50}  p95 ${slotLat.p95}`);
      console.log(`  combined mean ${combinedLat.mean}  p50 ${combinedLat.p50}  p95 ${combinedLat.p95}`);
      console.log('==================================================================\n');
      // Log misses for inspection
      const missedIntents = intentDetails.filter((d) => !d.ok);
      const missedSlots = slotDetails.filter((d) => !d.allCorrect);
      if (missedIntents.length) console.log('Intent misses:', JSON.stringify(missedIntents, null, 2));
      if (missedSlots.length) console.log('Slot misses:', JSON.stringify(missedSlots.map((m) => ({ id: m.id, expected: m.expected, got: m.got, grade: m.grade })), null, 2));
      /* eslint-enable no-console */

      // Sanity floor so a totally broken run fails loudly (not a quality gate).
      expect(s.intentAccuracyPct).toBeGreaterThan(0);
      expect(intentLat.n).toBe(INTENT_CASES.length);
    },
    600000,
  );
});
