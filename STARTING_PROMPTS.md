# Starting Prompts for Antigravity Sessions

Below are the exact, detailed starting prompts to initialize each of the 10 Antigravity sessions (sprints). These prompts are designed to give the agent full context, boundaries, and clear success criteria.

**Workflow for the Human User:**
1. Start a fresh Antigravity session.
2. Copy and paste the prompt for the current Sprint.
3. Once the agent finishes the Sprint, review their work, ensure `ImplementationPlan.md` has been updated with the Handover Notes, and close the session.
4. Repeat for the next Sprint.

---

### Sprint 1: Project Setup & Foundational Web App
**Prompt:**
> "Hello! You are executing Sprint 1 of the TableVoice Implementation Plan. 
> 
> **Context:** You are building the static frontend for an AI voice reservation system.
> **Required Reading:** Read the `PRD.md`, `DESIGN.md`, and `ImplementationPlan.md` files thoroughly.
> **Goal:** Initialize the Next.js frontend, configure the Amber Noir styling, and build the static structure for the Landing Page, Voice Reservation page, and Confirmation page using components from the `stitch_aether_voice_reservation_system` folder. 
> **Constraints:** Do NOT build the backend yet. Stick strictly to the UI layer. 
> **Execution:** Go to `ImplementationPlan.md`, find the 'Sprint 1' tasks section, and execute them sequentially. 
> **Completion:** When finished, verify the layout visually, check off the completed Sprint 1 tasks in `ImplementationPlan.md` with `[x]`, and add a detailed summary to the Handover Notes log at the bottom of the plan."

---

### Sprint 2: Voice Agent Backend Setup (STT/LLM/TTS)
**Prompt:**
> "Hello! You are executing Sprint 2 of the TableVoice Implementation Plan. 
> 
> **Context:** You are setting up the backend API routes for STT (Gemini 2.5 Flash Lite), LLM, and TTS (Sarvam AI).
> **Required Reading:** Read the 'Handover Notes' at the bottom of `ImplementationPlan.md` to understand what was completed in Sprint 1. Review the 'Sprint 2' tasks.
> **Goal:** Create independent Next.js API routes for the voice pipeline and a test script to verify them.
> **Constraints:** Do NOT integrate the frontend audio stream yet. No WebSocket. API routes only. No complex dialogue state machine yet.
> **Execution:** Execute the tasks in Sprint 2 of the `ImplementationPlan.md`. Create the required `.env.local` placeholders, the API routes, and a `scripts/test-pipeline.ts` script to test text-in/audio-out.
> **Completion:** When finished, verify the test script works, check off the completed Sprint 2 tasks in `ImplementationPlan.md`, and append a detailed summary to the Handover Notes log."

---

### Sprint 3: Voice Widget Frontend & Audio Streaming
**Prompt:**
> "Hello! You are executing Sprint 3 of the TableVoice Implementation Plan. 
> 
> **Context:** You are connecting the frontend WebAudio/MediaRecorder pipeline to a backend WebSocket for real-time audio streaming.
> **Required Reading:** Check the Handover Notes in `ImplementationPlan.md`. Review the 'Sprint 3' tasks.
> **Goal:** Wire the frontend microphone capture to stream to the backend via WebSocket, and handle incoming audio chunks from the TTS. Animate the Voice Visualizer Orb.
> **Constraints:** Keep the LLM conversation logic simple (echoing or simple greetings). Do not build the full dialogue manager yet.
> **Execution:** Implement the WebSocket handler in `app/api/voice/route.ts` and the frontend hook `useVoiceSession.ts` as specified in the plan. Ensure smooth bidirectional data flow.
> **Completion:** Test that audio can be streamed back and forth. Check off the Sprint 3 tasks in `ImplementationPlan.md` and append your Handover Notes."

---

### Sprint 4: Dialogue Manager & Happy Path Booking Flow
**Prompt:**
> "Hello! You are executing Sprint 4 of the TableVoice Implementation Plan.
> 
> **Context:** You are building the core Dialogue State Manager to handle the `book_new` intent for the standard happy path.
> **Required Reading:** Check the Handover Notes in `ImplementationPlan.md`. Read the PRD Appendix A for the System Prompt. Review 'Sprint 4' tasks.
> **Goal:** Implement intent detection, slot filling (Occasion, Date, Time), reservation code generation (`TABLE-[A-Z][0-9][0-9]`), and context-aware LLM responses.
> **Constraints:** Only handle the `book_new` intent for now. Do not build mock slot availability logic yet (just assume requested slots are available). Use simple console.log stubs for MCP integrations.
> **Execution:** Create the state machine, intent detector, and code generator as specified in Sprint 4. Integrate them into the LLM route and WebSocket flow.
> **Completion:** Test the happy path. Update `ImplementationPlan.md` by checking off tasks and adding your Handover Notes."

---

### Sprint 5: Mock Availability & Slot Logic
**Prompt:**
> "Hello! You are executing Sprint 5 of the TableVoice Implementation Plan.
> 
> **Context:** You are implementing realistic slot availability offering and overflow handling based on mock JSON data.
> **Required Reading:** Check the Handover Notes in `ImplementationPlan.md`. Review 'Sprint 5' tasks.
> **Goal:** Create a mock JSON inventory, implement slot offering logic (max 3 slots offered), and handle overflow situations (suggesting alternate dates).
> **Constraints:** Still no real MCP integrations. Focus on robust slot query logic across all 5 occasion types.
> **Execution:** Build `mockInventory.json` and the availability API route. Hook it into the slot filler and LLM prompt. Ensure the Large Group and Outdoor constraints are accurately applied.
> **Completion:** Verify the agent offers appropriate slots and alternative dates if full. Check off Sprint 5 tasks in `ImplementationPlan.md` and update Handover Notes."

---

### Sprint 6: MCP Integration (Calendar & Sheets)
**Prompt:**
> "Hello! You are executing Sprint 6 of the TableVoice Implementation Plan.
> 
> **Context:** You are replacing stubs with real Model Context Protocol (MCP) calls to Google Calendar and Google Sheets APIs.
> **Required Reading:** Check the Handover Notes in `ImplementationPlan.md`. Review 'Sprint 6' tasks.
> **Goal:** Integrate `mcp_calendar_create_event` and `mcp_sheets_append_row` upon booking confirmation. Implement basic error handling and retries.
> **Constraints:** Only handle `book_new` MCP calls for now. Focus on reliability and proper error handling.
> **Execution:** Implement `lib/mcp/calendar.ts` and `lib/mcp/sheets.ts` using the `googleapis` package. Update the LLM route to perform real calls and handle failures gracefully.
> **Completion:** Verify bookings appear in Google Calendar and Sheets. Check off Sprint 6 tasks in `ImplementationPlan.md` and append to Handover Notes."

---

### Sprint 7: Reschedule & Cancel Intents
**Prompt:**
> "Hello! You are executing Sprint 7 of the TableVoice Implementation Plan.
> 
> **Context:** You are expanding the Dialogue Manager to handle the `reschedule_reservation` and `cancel_reservation` intents.
> **Required Reading:** Check the Handover Notes in `ImplementationPlan.md`. Review 'Sprint 7' tasks.
> **Goal:** Implement lookup logic for Reservation Codes and wire up corresponding MCP calls to update or delete Calendar events and Sheet rows.
> **Constraints:** Use the Google Sheet as the source of truth for looking up existing codes. Do not build a separate database.
> **Execution:** Update intent detection, state machine, and MCP helpers to support reschedule and cancel flows. Ensure "code not found" and fuzzy matches are handled gracefully.
> **Completion:** Verify reschedule and cancel operations correctly update Calendar and Sheets. Check off Sprint 7 tasks in `ImplementationPlan.md` and update Handover Notes."

---

### Sprint 8: Full Occasion Coverage & Edge Cases
**Prompt:**
> "Hello! You are executing Sprint 8 of the TableVoice Implementation Plan.
> 
> **Context:** You are hardening the voice agent against edge cases and enforcing strict guardrails.
> **Required Reading:** Check the Handover Notes in `ImplementationPlan.md`. Review 'Sprint 8' tasks and PRD Section 9 (Edge Cases & Guardrails).
> **Goal:** Implement the `check_availability` intent, out-of-scope refusals, strict PII guardrails, and low-confidence STT handling.
> **Constraints:** Focus entirely on robustness, privacy compliance, and handling unexpected user input.
> **Execution:** Update the system prompt, state machine, and WebSocket handler to gracefully manage low-confidence STT, silence, out-of-bounds dates/times, and explicitly refuse to collect PII.
> **Completion:** Test all guardrails thoroughly. Check off Sprint 8 tasks in `ImplementationPlan.md` and write your Handover Notes."

---

### Sprint 9: Restaurant Admin Dashboard Frontend
**Prompt:**
> "Hello! You are executing Sprint 9 of the TableVoice Implementation Plan.
> 
> **Context:** You are shifting focus to the Admin portal and building its frontend UI.
> **Required Reading:** Check the Handover Notes in `ImplementationPlan.md`. Review 'Sprint 9' tasks.
> **Goal:** Build the Admin Dashboard UI (Top Stat Cards, Active Bookings Data Table, Availability Controller sidebar) using static mock data.
> **Constraints:** Frontend only. Do not connect to live Google Sheets data or implement NextAuth yet.
> **Execution:** Translate the Stitch HTML designs into React/Next.js components (`StatsCard.tsx`, `BookingsTable.tsx`, `AvailabilityToggle.tsx`). Ensure responsive design.
> **Completion:** Visually verify the admin dashboard matches the original Stitch designs. Check off Sprint 9 tasks in `ImplementationPlan.md` and update Handover Notes."

---

### Sprint 10: Admin Dashboard Backend & End-to-End Polish
**Prompt:**
> "Hello! You are executing the final Sprint 10 of the TableVoice Implementation Plan.
> 
> **Context:** You are connecting the Admin Dashboard to live data, adding auth, and performing final end-to-end testing.
> **Required Reading:** Check the Handover Notes in `ImplementationPlan.md`. Review 'Sprint 10' tasks.
> **Goal:** Implement NextAuth.js for Google OAuth, connect the dashboard table to the Google Sheet (via MCP reads), make availability toggles functional, and test the entire system end-to-end.
> **Constraints:** Ensure all components are production-ready.
> **Execution:** Set up NextAuth, build the GET/POST routes for reservations and availability, and compose them in the dashboard. Execute the full E2E test suite defined in Sprint 10 tasks.
> **Completion:** Fix any final bugs, measure latency, and create a `WALKTHROUGH.md` artifact. Check off Sprint 10 tasks in `ImplementationPlan.md` and add your final Handover Notes."
