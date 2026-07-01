# TableVoice — Live Testing Log

Each section = one test session. After each session:
1. Raw events are pasted from the monitor
2. Bugs are identified from logs + user input
3. Fixes are applied and verified
4. Next session begins only when the previous session's bugs are resolved

---

## Session 1 — `session_8ukeg2s99` (2026-06-30 10:02–10:04 UTC, 1m55s, 1 turn)

### Raw event timeline
| Time (UTC) | Event | Detail |
|---|---|---|
| 10:02:52 | session_start | resumed=false |
| 10:02:55 | tts_sent | Welcome greeting (latency 2937ms) |
| 10:03:19 | stt_result ✅ | "I want to make a new booking" — **conf 0.97**, 129055 audioBytes, latency 10357ms |
| 10:03:19 | user_turn | turn 1, intent=unknown |
| 10:03:27 | agent_turn | "Great! ...what date...?" (total latency 17735ms) |
| 10:03:30 | tts_sent | date prompt |
| 10:03:54 | **error (STT)** | **Gemini 503 Service Unavailable** — model overloaded |
| 10:03:54 | stt_result ❌ | transcript="", conf 0, **129055 audioBytes** (audio WAS captured) |
| 10:03:56 | tts_sent | "I didn't catch that..." |
| 10:04:14 | **error (STT)** | **Gemini 503** again |
| 10:04:14 | stt_result ❌ | transcript="", conf 0, 129055 audioBytes |
| 10:04:42 | **error (STT)** | **Gemini 503** again |
| 10:04:42 | stt_result ❌ | transcript="", conf 0, 129055 audioBytes |
| 10:04:47 | session_end | user_closed, 1 turn, 115259ms |

### Bugs identified
| # | Bug | Severity | Root cause | Status |
|---|---|---|---|---|
| 1 | "Agent can't hear me" — 3 turns failed | **High** | **Misdiagnosis.** Mic works (129055 audioBytes captured every turn; turn 1 transcribed at 0.97). Real cause = **Gemini STT returning 503 Service Unavailable** (model `gemini-2.5-flash-lite` overloaded). | **RESOLVED** via #2 — not a mic/threshold issue. |
| 2 | No retry / backoff on 503 | **High** | A single 503 surfaces straight to user as "I didn't catch that" — no retry, no fallback model. | **FIXED** — `route.ts` STT now retries 503/429 up to 3× with exponential backoff (400ms→800ms). tsc clean. |
| 3 | Misleading user-facing message | Medium | On STT API failure it says "I didn't catch that" (implies audio problem) instead of signalling a service error. | **FIXED** — distinct message on `sttServiceError`: "my speech service is briefly overloaded…". |
| 4 | High latency | Medium | STT 10–16s, total turn 17.7s. Partly 503 retries upstream. | **FIXED (pending verify)** — see below. |

### Latency fixes applied (before Session 2)
Per-turn cost was ~20s = STT (~10.4s) + dialogue 3 sequential LLM calls (~7.4s) + TTS (~2.7s).
- **Disabled Gemini "thinking"** on the response model (`stateMachine.ts`, `gemini-2.5-flash`) — was defaulting to a thinking budget, adding seconds per turn for short conversational replies. Set `thinkingConfig.thinkingBudget = 0` + `maxOutputTokens = 300`.
- **Disabled thinking** on the slot filler (`slotFiller.ts`, `gemini-2.5-flash`, structured JSON output — no benefit from thinking).
- **STT fallback model** (`route.ts`): primary `gemini-2.5-flash-lite` → on 503/429 retry once w/ backoff → **fall back to `gemini-2.5-flash`** (separate capacity pool). Also fixes Bug #1/#2 tail latency. No new API key needed — reuses `GOOGLE_API_KEY`.
- **Not yet done (future):** parallelize `detectIntent` + `fillSlots` (independent calls) — deferred as it touches state-machine routing and needs test coverage first.
- All changes tsc-clean. **Verify in Session 2** that per-turn latency drops and 503s recover silently.

---

## Session 2 — `session_3svajo7iy` (2026-06-30 10:29–10:35 UTC, 5m31s, 10 turns)

### Outcome: ✅ Full new-booking flow completed end-to-end. Code **TABLE-R07** issued (Standard Dining, Thu 2 Jul 2026, 8:30 PM IST, 2 guests).

### Verification of Session 1 fixes
| Fix | Verified? | Evidence |
|---|---|---|
| #1/#2 STT fallback model | ✅ **WORKING** | Turn 1: `flash-lite` 503 → fell back to `flash` → transcript "I'm here to make a new booking" @0.98. No "I didn't catch that" surfaced to user. Later 429s also recovered via fallback (turns 7–10 all transcribed). |
| #4 Dialogue latency (thinking off) | ✅ **IMPROVED** | Dialogue portion dropped ~7.4s → ~2.4s (turn 3: total 9416ms − STT 7050ms = 2366ms dialogue). |

### Bugs identified
| # | Bug | Severity | Root cause | Status |
|---|---|---|---|---|
| 5 | **Gemini free-tier daily quota exhausted (429)** | **CRITICAL** | `gemini-2.5-flash-lite` free tier = **20 requests/day/model**. From turn 6 onward every flash-lite call 429s. Fallback to `flash` masked it this session, but `flash` has its own daily cap — this is a hard wall, not transient. | OPEN — needs billing/key decision |
| 6 | **Booking confirmation screen never appeared** | **High** | Navigation to `/confirmation` relies on the confirmation TTS firing `el.onended` → `afterAudio()` → `onConfirmed()`. Fragile: any barge-in, audio error, or interrupted playback skips navigation, and the mic re-opens instead. In this run nav never fired; session continued to turns 8–10. | OPEN — fix: server-driven explicit `booking_complete` signal |
| 7 | **Wrong closing message on explicit "no"** | Medium | Turn 9 user said "No, that's it" (declining further help) but agent replied with the **silence-timeout** message: "It seems you may have stepped away…". Decline-further-help is being misrouted to the idle/timeout path instead of a graceful goodbye. | OPEN — tied to end-of-session flow redesign |
| 8 | Latency still high overall (17–20s/turn) | Medium | Now dominated by **STT** (Gemini 7–11s + 429 retry backoff), not dialogue. | OPEN — STT is the remaining bottleneck |
| 9 | Duplicate `agent_turn` + closing fired twice | Low | Turn 10 closing logged twice (10:35:01 and 10:35:29), session_end in between. Race between silence-timeout close and user "Bye". | OPEN |
| 10 | `code_issued` event never logged | Low | In `route.ts` the codeIssued log is gated by `!cache.state.reservationCode`, but `updateCache()` already wrote reservationCode to the same state ref earlier in the turn → condition always false. Logging gap only. | OPEN |


### Fixes applied before Session 3 (end-of-booking flow redesign)
The user's required flow: *once a booking is confirmed, the agent asks if there's anything else; if not, the voice session closes AND the confirmation screen is shown.*

| Bug | Fix | Where |
|---|---|---|
| **#6** Confirmation screen never appeared (fragile TTS-onended nav) | **Server-driven close.** New `session_complete` WS message carries `{navigate, booking:{code,occasion,date,time}}`. Server sends it via `endSession()` after the goodbye TTS; client navigates deterministically on receipt (after goodbye plays) with a **9s fallback timer** so navigation fires even if `onended` never does. Removed the old "navigate as soon as reservationCode appears" logic — nav now only happens at genuine session close. | `route.ts` `endSession()`; `useVoiceSession.ts` `finishClose()` + `session_complete` case; nav still routed by `VoiceWidget.tsx onConfirmed`. |
| **#7** Wrong "stepped away" message on explicit "No" | **Two fixes.** (1) New post-completion phase: after a booking/reschedule/cancel completes, `state.awaitingAnythingElse=true`; the agent now explicitly asks "anything else?"; a decline (`no/that's it/nothing/thanks/bye…`) triggers a **graceful goodbye** ("You're all set — enjoy your visit…") + `closeSession`. (2) **Removed the silence/timeout lines from `systemPrompt.ts`** so the LLM can never speak the "stepped away" message in response to real speech — that message is now server-only (silence timer). | `stateMachine.ts` (decline handler + completion flags + response prompt "anything else?"); `systemPrompt.ts` SILENCE HANDLING; `types.ts` (`awaitingAnythingElse`, `closeSession`). |
| **#9** Duplicate `agent_turn` / double close | Added `sessionEnded` guard in `route.ts`; all `sessionEnd` paths (endSession, silence-timeout, ws close) now log at most once. | `route.ts` |

**Status:** #6, #7, #9 fixed & tsc-clean (production files). Dev server restarted clean on 3001 (HTTP 200) to load the WS/server changes. **To verify in Session 3:** book a table → agent asks "anything else?" → say "no, that's it" → hear a graceful goodbye (NOT "stepped away") → land on the `/confirmation` screen with the correct code/occasion/date/time.

**Still open:** #10 (`code_issued` logging gap — cosmetic).

### STT provider swap → Groq Whisper (addresses #5 + #8 for the STT stage)
Replaced Gemini as the **primary** STT with **Groq `whisper-large-v3-turbo`** (`route.ts` `transcribeGroq`), keeping **Gemini as automatic fallback** (`transcribeGemini`) if Groq is unavailable.
- **Why:** Gemini STT was the pipeline bottleneck (7–11s) AND hit the free-tier 20-req/day wall (Bug #5). Groq is ~1–2s for short clips and free with generous limits.
- **How:** OpenAI-compatible multipart endpoint, `response_format: verbose_json`; confidence derived from `no_speech_prob` (avg > 0.6 → treated as silence) so the existing `<0.7` low-confidence retry + silence gate still work. Downstream vars (`transcript`/`confidence`/`sttServiceError`) unchanged. New `[STT] provider=… latency=…` console line + `sttProvider` tracking to spot fallbacks.
- **Env:** `GROQ_API_KEY` (in `.env`, `gsk_…`). Dev server restarted on 3001 (HTTP 200) to load it. tsc-clean (production files).
- **To verify in Session 3:** monitor shows STT latency ~1–2s and no 429 on the STT stage. Note: dialogue/LLM calls (`detectIntent`/`fillSlots`/`responseModel`) **still use Gemini**, so the 20/day quota can still bite there — watch for it.

See `latency.md` for the full pipeline breakdown and remaining levers (client-side TTS streaming, parallelizing dialogue calls, trimming the silence window).

**Bug #5 status:** RESOLVED for the STT stage (Groq has no such wall); still theoretically open for the Gemini dialogue calls until those are also moved off free tier or billing is enabled.
**Bug #8 status:** Expected to drop sharply once verified in Session 3.

---

## Session 3 — `session_2ueq9fo8t` (2026-07-01 17:24–17:28 UTC, 4m09s, 11 turns)

### Outcome: ⚠️ Flow appeared to complete but the booking was **fake** — no real code, no close, no confirmation screen.

### Verification of pre-Session-3 fixes
| Fix | Verified? | Evidence |
|---|---|---|
| **Groq Whisper STT** | ✅ **HUGE WIN** | Every STT call **0.3–0.7s** (531, 421, 514, 325, 363, 592, 384, 728, 353, 348, 361 ms) vs Gemini's 7–11s. **Zero 429s.** Bug #8 (STT latency) + Bug #5 (STT quota) resolved. |
| End-of-booking close/nav (#6/#7) | ❌ **Could not trigger** — see Bug #11 below; the real booking path never ran, so the close flow was never reached. Not a regression of the fix itself; it was starved of its precondition. |

### Bugs identified
| # | Bug | Severity | Root cause | Status |
|---|---|---|---|---|
| 11 | **Intent hijack: `book_new` → `check_availability` mid-booking** | **CRITICAL** | Turn 5 "Yeah, you can check the availability" matched the `availabilityKeywords` redetect trigger → `detectIntent` returned `check_availability` (>0.55) → intent silently switched and **stuck** (turns 6–11 all `check_availability`). The real book_new confirmation branch (which calls `generateReservationCode()`, sets `awaitingAnythingElse`, writes Calendar/Sheets) never ran again. | **FIXED** — removed `availabilityKeywords` from `forceRedetect`; added `bookingInProgress` guard so an in-progress booking is never abandoned for `check_availability`. Only explicit reschedule/cancel may switch. |
| 12 | **Hallucinated reservation code** | **High** | Consequence of #11: under `check_availability` the response LLM invented "TABLE-R07" (the system-prompt *example* code) and faked a full confirmation. `state.reservationCode` stayed null → no Calendar/Sheets, no `code_issued`. | **FIXED via #11** — with intent staying `book_new`, only the real confirmation branch can issue a code. |
| 13 | **No session close / no confirmation screen** | **High** | Consequence of #11/#12: `reservationCode` null → `codeGeneratedThisTurn` never true → `awaitingAnythingElse` never armed → turn 10 "No, nothing else" didn't hit the decline handler → no `session_complete` → no navigation. Session stayed open to turn 11. | **FIXED via #11** — real code issuance now arms the close flow built pre-Session-3. |
| 14 | **Agent never asks for dining occasion** | **High** (user-reported) | Response instructions only said "ask for missing slot(s)"; occasion was never explicitly required, so the LLM asked date/time/guests and skipped it (occasion stayed null, later auto-inferred as "Standard Dining"). | **FIXED** — BOOK_NEW instructions now REQUIRE asking the occasion first (offering the 5 options) before date/time/party size, and forbid assuming "Standard Dining". |

### Notes
- STT swap is a clear success — the pipeline bottleneck is gone. Remaining latency is now dialogue (Gemini, ~2–8s) + TTS.
- Turn 5's 8198ms `agent_turn` and a couple of 4s+ dialogue turns are Gemini-side; see `latency.md` levers (parallelize dialogue calls, client-side TTS streaming).
- All fixes tsc-clean (production files); dev server restarted on 3001 (HTTP 200).
- **To verify in Session 4:** (a) agent asks occasion first; (b) saying "check the availability" mid-booking does NOT derail the flow; (c) a REAL code is issued (not TABLE-R07 unless genuinely generated); (d) "No, nothing else" → goodbye → session closes → `/confirmation` screen shows the actual booking details.

### VAD / threshold settings (as requested)
- **No energy/RMS threshold** — VAD is **chunk-size based**, not amplitude based.
- `SPEECH_BYTES = 800` bytes — MediaRecorder chunk above this counts as speech.
- `SILENCE_MS = 1500` — post-speech quiet before auto-submit.
- `MAX_MS = 8000` — hard ceiling per turn.
- `BARGE_IN_BYTES = 5000`, `BARGE_IN_CONSEC = 4`, `BARGE_IN_STARTUP_MS = 600`.
- **Conclusion:** thresholds are fine — audio captured 129055 bytes/turn consistently. Threshold is NOT the bug.

---

## Latency optimizations (implemented before Session 4) — 2026-07-01

Implemented latency.md levers #2 and #3 (both need no billing decision, no new vendor).

### (2) Streaming TTS playback — client-side, stage 7
- **File:** `components/VoiceWidget/useVoiceSession.ts`.
- **Before:** every `audio_chunk` was pushed into `chunksRef`; playback only started on `audio_end` (`new Blob(chunks) → Audio(url)`). The server was already streaming, but the client added the *entire* TTS duration (~2.7s) to first-audio.
- **After:** on `audio_start` the client opens a **MediaSource** (`audio/mpeg`) and appends each chunk to a `SourceBuffer` as it arrives via a serialized append queue (`pumpMse` drains on `updateend`). `el.play()` fires on the **first** buffered chunk → perceived TTS latency drops from full-synthesis to **time-to-first-chunk** (a few hundred ms).
- **Fallback:** `mseCanStream()` gates it (`MediaSource.isTypeSupported('audio/mpeg')`). Where unsupported (e.g. Safari), it transparently falls back to the old blob-buffering path — `mediaSourceRef` being null selects the path in each case.
- **Preserved hooks:** barge-in (`stopAudio` now tears down MediaSource + nulls `el.onended/onerror` so teardown can't fire a stray `afterAudio`), `finishClose()`/`afterAudio()` on end (via `el.onended` → `finishStream`, guarded once by `streamDoneCalledRef`), echo-settle mic reopen, empty-synthesis short-circuit.

### (3) Parallelize dialogue calls — stage 5
- **File:** `lib/dialogue/stateMachine.ts`.
- **Before:** on redetect turns, `detectIntent` ran, *then* `fillSlots` ran inside the intent branch — two serial Gemini round-trips.
- **After:** inside `forceRedetect`, `detectIntent` and `fillSlots` run concurrently via `Promise.all`; the extracted slots are stashed in `prefetchedSlots` and consumed at all three branch call sites (`book_new`, `reschedule`, `check_availability`) as `prefetchedSlots ?? await fillSlots(...)`. `fillSlots` only reads the utterance+history, so it's independent of the detected intent — safe to run speculatively. Saves ~0.6–1.2s on redetect turns; non-redetect slot turns are unchanged (fall back to the in-branch `fillSlots`).

### Status
- tsc-clean on both production files (pre-existing `__tests__` errors unrelated).
- Dev server restarted on 3001 (HTTP 200).
- **To verify in Session 4:** (a) agent's voice starts noticeably sooner after it "thinks" (first TTS chunk plays immediately); (b) barge-in still cuts off the agent cleanly; (c) end-of-booking goodbye still plays fully and navigates to `/confirmation`; (d) no audio glitches/gaps from chunked MSE playback; (e) turn-1 / intent-switch turns feel a touch faster (parallel dialogue calls).

---

## Restaurant model rework — 20 tables + table-based booking flow (2026-07-01)

### ⚠️ Critical finding: Google credentials are placeholders — Sheets/Calendar never persisted
All five Google vars in `.env.local` are still placeholder text (`GOOGLE_SERVICE_ACCOUNT_JSON`=`your_base64_...`, `GOOGLE_SHEETS_ID`/`GOOGLE_CALENDAR_ID`/`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`NEXTAUTH_SECRET` all placeholders). So **every booking/reschedule/cancel write to Sheets and every Calendar hold has been failing silently** — the state machine catches the error, logs `[MCP Error] ... Proceeding anyway`, and continues, so the voice flow looked fine while nothing was saved. **Cannot confirm the Sheets API is enabled** until real credentials exist (enabling it is part of creating the service account). Action item for user: populate real creds + share sheet + enable Sheets/Calendar APIs.

### What changed (Aether Dining: 20 tables, Lunch 12–16, Dinner 19:30–23, last reservation 22:30)
- **`lib/restaurant/config.ts`** (new): `TABLE_COUNT=20`, `SLOT_MINUTES=30`, `SEATING_MINUTES=90`, service windows, `TABLE_SEED` (AE-T01..AE-T20 with seats/zone), `serviceForTime`, `generateSlots`, `allSlots`, `holdsOverlap`, `eligibleTables`. Table mix: 4×2-seat + 8×4-seat + 3×6-seat Standard, 2 Patio(4), 2 Bar-Lounge(2), 1 Special(4).
- **`scripts/seedTables.cjs`** (new, one-time): creates a `Tables` tab and writes the 20-table registry. Run `node scripts/seedTables.cjs` after real creds are in. Idempotent.
- **`lib/mcp/sheets.ts`**: Reservation Log extended `A:J` → `A:M` (K=TableCode, L=Service, M=SlotStart); `appendReservation` writes them; `getAllReservations`/`lookupReservation` read them. Added `getTables()` (reads `Tables!A:E`, **falls back to `TABLE_SEED` when Sheets unreachable**) and `getReservationsForDate()` (CONFIRMED only, safe→[] on error).
- **`lib/availability/service.ts`**: `getAvailableSlots` is now **async and table-based** — a slot is offered only if ≥1 zone-eligible table has no overlapping CONFIRMED 90-min hold. Retired `mockInventory.json` for slot generation. Added `assignTable(date, occasion, time)` → picks the smallest free eligible table code (or null if full).
- **`lib/dialogue/stateMachine.ts`**: confirm branch assigns a table + service and logs them; reschedule branch re-assigns a table for the new slot; all 3 `getAvailableSlots` calls now awaited. New `state.tableCode`.
- **`lib/dialogue/types.ts`**: `SessionState.tableCode`. **`app/api/availability/route.ts`**: awaits the now-async call.

### Booking-code model (as chosen)
- **Per-table fixed codes** `AE-T01..AE-T20` live in the `Tables` tab (the "code per table").
- **Per-reservation guest code** (still `generateReservationCode()`, e.g. `TABLE-X07`) is what the guest quotes to reschedule/cancel. The Log row links guest code (col B) ↔ table code (col K).

### Verification
- tsc-clean on all production files (pre-existing `__tests__` errors unrelated).
- Dev server 3001 HTTP 200. `GET /api/availability?date=2026-07-05&occasion=Standard Dining` → `["12:00","12:30","13:00"]` (offline fallback: 20 tables all free → first 3 slots). Becomes real bookings-driven the moment creds are added.

### Still to do (user)
1. Create Google Cloud service account; **enable Google Sheets API + Google Calendar API**; download JSON key; base64 it into `GOOGLE_SERVICE_ACCOUNT_JSON`.
2. Set real `GOOGLE_SHEETS_ID` + `GOOGLE_CALENDAR_ID`; **share the spreadsheet + calendar with the service-account email as Editor**.
3. Run `node scripts/seedTables.cjs` to populate the `Tables` tab.
4. Then Session 4 can verify real end-to-end persistence (table assignment, no double-booking, reschedule/cancel free/re-take tables).

---

## Confirmation screen — show assigned table (2026-07-01)
- Threaded `tableCode` end-to-end to the ticket: `route.ts` session_complete `booking.table` = `state.tableCode`; `useVoiceSession` `confirmedRef`/`closeRef`/`onConfirmed` types carry `table`; `VoiceWidget.tsx` + `reserve/page.tsx` add `table` to the `/confirmation` query.
- `app/confirmation/page.tsx`: the hardcoded "Section: Main Dining Room" tile is now **Table: `<AE-T##>`** (mono), falling back to "Main Dining Room" when no table (offline). The guest **Reservation Code** was already shown prominently.
- tsc-clean; `/confirmation?...&table=AE-T07` → 200.
