# TableVoice — Latency Analysis

Purpose: map every stage in the voice pipeline that adds to the round-trip delay
(user stops speaking → agent starts speaking back), rank the contributors, and
list the concrete levers to cut each one.

Measured baselines (from `logs.md`):
- Session 1: STT **10,357 ms**, total turn **17,735 ms**.
- Session 2 (after "thinking" disabled): STT **7,050 ms**, dialogue **2,366 ms**, total turn **9,416 ms**; TTS ~2,700 ms.

---

## The pipeline, stage by stage

A single turn flows: **capture → upload → STT → dialogue → TTS → playback.**

| # | Stage | Where | Typical cost | Why it costs | Blocking? |
|---|-------|-------|-------------|--------------|-----------|
| 1 | **End-of-speech wait** | `useVoiceSession.ts` `SILENCE_MS=1500` (or `MAX_MS=8000` ceiling) | **~1.5 s fixed** | We wait for 1.5 s of trailing silence before we even submit the audio. Pure dead time on every turn. | Yes |
| 2 | Audio upload (WS) | binary chunks → `stop_speech` | ~0 on localhost | ~129 KB over loopback is instant. Would matter over real network. | No |
| 3 | Base64 encode audio | `route.ts:316` `audioBuffer.toString('base64')` | ~5–20 ms | Whole clip base64'd into an inline Gemini request (+33% payload). Minor. | Yes |
| 4 | **STT (Gemini)** | `route.ts:315` `sttModel.generateContent` | **7,000–11,000 ms** ⚠️ | **Dominant cost.** Non-streaming: Gemini receives the full clip, transcribes, returns once. No partials. | Yes |
| 4b | STT retry / fallback | `route.ts:310-336` | +400 ms → **+7–11 s** on 503/429 | On overload/quota it retries once (400 ms) then re-sends the whole clip to a second model — doubling STT in the worst case. | Yes |
| 5 | **Dialogue manager** | `stateMachine.ts` `processDialogueTurn` | **2,000–4,000 ms** | **2–4 *sequential* Gemini calls per turn** (see below). Each is a separate network round-trip. | Yes |
| 6 | **TTS (Sarvam bulbul:v3)** | `route.ts:38` `streamTts` | **~2,700 ms** | Server streams chunks, but see stage 7 — the user doesn't hear them as they arrive. | Yes |
| 7 | **TTS playback buffering** | `useVoiceSession.ts` `playTts` | adds the *full* TTS duration to first-audio | ⚠️ The client pushes every `audio_chunk` into `chunksRef` and only builds the Blob + plays on `audio_end`. **Streaming on the server is wasted** — playback waits for the last byte. | Yes |
| 8 | Client playback assembly | Blob + object URL | ~0 | Negligible. | No |

**Per-turn total ≈ 1.5 (silence) + ~0 (upload) + 7–11 (STT) + 2–4 (dialogue) + 2.7 (TTS) ≈ 13–19 s**, matching the logs.

---

## Stage 5 detail — the sequential dialogue calls

`processDialogueTurn` fires these Gemini calls one after another (not in parallel):

| Call | Model | When | File |
|------|-------|------|------|
| `detectIntent` | flash-lite | turn 1, unknown intent, or reschedule/cancel/availability keywords | `stateMachine.ts:256` |
| `fillSlots` | flash | book_new / reschedule slot-collection turns | `stateMachine.ts:324, 478, 541` |
| `checkConfirmation` | flash-lite | confirmation turns — **has a keyword fast-path** that skips Gemini for clear yes/no | `stateMachine.ts:284, 419, 493` |
| `responseModel.generateContent` | flash | **every turn** (final NL reply) | `stateMachine.ts:634` |

A slot-collection turn = `detectIntent` **+** `fillSlots` **+** `responseModel` = 3 serial round-trips.
`getAvailableSlots` is local/in-memory (not a network call) — negligible.

**Already optimized:** "thinking" disabled on `responseModel` and `fillSlots` (`thinkingBudget: 0`), which cut dialogue ~7.4 s → ~2.4 s (verified Session 2). The keyword fast-path in `checkConfirmation` avoids a Gemini call for clear affirmatives.

---

## Ranked levers (biggest win first)

1. **STT is the bottleneck (~60–70% of the turn).** Nothing else matters as much.
   - Switch to a faster STT provider (see next section) — Groq Whisper is ~1–2 s for short clips vs Gemini's 7–11 s.
   - Or move to **streaming STT** (Deepgram/AssemblyAI real-time) so transcription overlaps with the user still talking — collapses stage 4 to near-zero perceived latency.

2. **Stream TTS playback (stage 7).** The server already streams; make the client play the first chunk immediately (Web Audio / MediaSource) instead of buffering to `audio_end`. Cuts perceived TTS latency from full-synthesis (~2.7 s) down to time-to-first-chunk (a few hundred ms). **Low-risk, big perceived win, no new vendor.**

3. **Parallelize the dialogue calls (stage 5).** `detectIntent` and `fillSlots` are independent for a given utterance — run them with `Promise.all` instead of serially. Saves ~0.6–1.2 s on slot turns. (Noted as deferred in `logs.md` — needs test coverage first.)

4. **Trim the end-of-speech wait (stage 1).** Drop `SILENCE_MS` 1500 → ~800–1000 ms. Saves ~0.5–0.7 s per turn at some risk of clipping slow speakers; tune with testing.

5. **Reduce STT retry tail (stage 4b).** The fallback re-uploads the whole clip. Once on a paid/faster STT tier the 503/429 retries mostly disappear, removing the worst-case doubling.

**Recommended order:** (2) client TTS streaming → (1) swap STT provider → (3) parallelize dialogue → (4) tune silence window. Items 2–4 need no billing decision; item 1 is the single largest cut.

---

## Alternate free STT providers to the Gemini free tier

The Gemini free tier's hard wall is **20 requests/day/model** (Bug #5), and it's slow (7–11 s). Better free options:

| Provider | Model | Free tier | Latency | Notes |
|----------|-------|-----------|---------|-------|
| **Groq** ⭐ *(top pick)* | `whisper-large-v3-turbo` / `distil-whisper` | Generous free API key, high daily limits | **~1–2 s** for short clips (Groq LPU is very fast) | Best speed-for-free. OpenAI-compatible audio endpoint — near drop-in. Recommended first swap. |
| **Sarvam** *(lowest friction)* | `saarika:v2` (STT) | Free tier | ~1–3 s | **We already hold `SARVAM_API_KEY`** (used for TTS). Single-vendor, native **en-IN** — matches our `target_language_code: 'en-IN'`. Least integration work. |
| **Deepgram** | Nova-2 / Nova-3 (streaming) | $200 free credit (not perpetual) | **Real-time streaming** — sub-second perceived | True WebSocket streaming STT → transcribe *while* the user speaks. Biggest architectural win but more rework. |
| **AssemblyAI** | Universal / streaming | Free credits | Real-time streaming available | Similar to Deepgram; good docs. |
| **Local faster-whisper** | Whisper (self-hosted) | Free, **no quota** | Depends on CPU/GPU | No rate limits and no per-call cost, but needs local compute and setup. Good for dev, heavier to run. |

**Recommendation:**
- **Quickest quality+speed win:** **Groq Whisper** — free, ~5× faster than Gemini STT, minimal code change (swap the `generateContent` inline-audio call for a Groq audio-transcription request).
- **Lowest integration friction:** **Sarvam `saarika:v2`** — reuse the existing key, one vendor, native en-IN.
- **Best end-state (more work):** **Deepgram streaming** — moves us off the "record fully, then transcribe" model entirely, which is the only way to truly eliminate stages 1 + 4.

---

## Summary

The turn is ~13–19 s and **STT alone is 7–11 s of it.** After that, the two cheapest wins are client-side TTS streaming (stage 7) and parallelizing the dialogue calls (stage 5) — neither needs a billing decision. Swapping Gemini STT for **Groq Whisper** (or **Sarvam saarika**, or **Deepgram streaming**) is the single biggest lever and also removes the 20-req/day quota wall (Bug #5).
