# TableVoice — Product Walkthrough

**Product:** Aether Dining — AI Voice Reservation System  
**Version:** 1.0 (Sprint 10 Complete)  
**Stack:** Next.js 16 · Gemini 2.5 Flash Lite · Sarvam AI TTS · Google Calendar & Sheets MCP · NextAuth v5

---

## What Was Built

TableVoice is a voice-first, privacy-safe table reservation assistant embedded in the Aether Dining restaurant website. Diners speak naturally to book, reschedule, or cancel reservations — no forms, no phone queues, no PII collected.

### System Architecture

```
Browser (WebAudio/MediaRecorder)
        │  WebSocket binary audio
        ▼
Next.js API: /api/voice (WebSocket upgrade)
        │
        ├─► /api/stt  — Gemini 2.5 Flash Lite (audio → transcript)
        ├─► /api/llm  — Gemini 2.5 Flash Lite (dialogue state machine)
        │     └── lib/dialogue/stateMachine.ts
        │           ├── intentDetector.ts
        │           ├── slotFiller.ts
        │           ├── codeGenerator.ts  → TABLE-[A-Z][0-9][0-9]
        │           └── lib/availability/service.ts
        ├─► /api/tts  — Sarvam AI Streaming TTS (text → audio stream)
        │
        └── On booking confirmed:
              ├── lib/mcp/calendar.ts → Google Calendar (tentative hold)
              └── lib/mcp/sheets.ts  → Google Sheets (reservation log)

Admin Portal (/admin/*)
        ├── NextAuth v5 Google OAuth (middleware.ts guards /admin/dashboard)
        ├── /api/admin/reservations — reads Sheets log
        └── /api/admin/availability — reads/writes lib/availability/occasionConfig.json
```

---

## Running Locally

### Prerequisites

- Node.js 20+
- A Google Cloud project with:
  - Gemini API enabled
  - Google Calendar API enabled
  - Google Sheets API enabled
  - A Service Account with Calendar + Sheets access
  - OAuth 2.0 credentials (for admin portal)
- A Sarvam AI account

### 1. Clone and Install

```bash
git clone <repo-url>
cd VoiceAgentDemo
npm install
```

### 2. Configure Environment Variables

Copy `.env.local` and fill in all values:

```bash
# AI APIs
GOOGLE_API_KEY=             # Gemini API key (from Google AI Studio or Cloud Console)
SARVAM_API_KEY=             # Sarvam AI key (from console.sarvam.ai)

# Google Calendar & Sheets (via Service Account)
GOOGLE_CALENDAR_ID=         # e.g. your-calendar@group.calendar.google.com
GOOGLE_SHEETS_ID=           # The Spreadsheet ID from the URL
GOOGLE_SERVICE_ACCOUNT_JSON= # Base64-encoded service account JSON
                             # To encode: base64 -i service-account.json | tr -d '\n'

# NextAuth (Admin Portal)
NEXTAUTH_SECRET=             # Random 32+ char string: openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=            # OAuth 2.0 client ID (Web application type)
GOOGLE_CLIENT_SECRET=        # OAuth 2.0 client secret
```

**Google Service Account Setup:**
1. Go to Google Cloud Console → IAM → Service Accounts
2. Create a service account, download the JSON key
3. Share your Google Calendar and Google Sheet with the service account email
4. Encode the JSON: `base64 -i service-account.json | tr -d '\n'`

**Google Sheets Setup:**
- Create a spreadsheet named "Daily Reservation Log"
- Add a header row: `Timestamp | Code | Date | Time | Occasion | PartySize | Status | Notes | SessionId | CalendarEventId`
- Share with your service account email

**Google OAuth Setup:**
1. Go to Cloud Console → APIs → OAuth Consent Screen (configure)
2. Create OAuth 2.0 credentials (Web application)
3. Add `http://localhost:3000/api/auth/callback/google` as an authorised redirect URI

### 3. Start the Dev Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Application Routes

| Route | Description |
|---|---|
| `/` | Landing page with embedded floating voice widget |
| `/reserve` | Full-screen voice reservation experience |
| `/confirmation` | Booking confirmation ticket with code |
| `/admin/login` | Admin portal login (Google OAuth) |
| `/admin/dashboard` | Restaurant manager dashboard |

---

## How to Configure the Restaurant

Edit these files to customise for any restaurant:

### Restaurant Name & Hours
In `lib/dialogue/systemPrompt.ts`, the `getSystemPrompt(restaurantName, operatingHours)` function is called from `app/api/llm/route.ts`. Update the call there:
```typescript
getSystemPrompt('Your Restaurant Name', '12:00–22:00 IST')
```

### Slot Availability
`lib/availability/mockInventory.json` — Add dates and time slots per occasion:
```json
{
  "2026-07-01": {
    "Standard Dining": ["12:00", "13:30", "19:00", "20:30"],
    "Large Group (6+)": ["19:00"],
    "Outdoor/Patio": ["12:30", "19:30"],
    "Special Occasion/Anniversary": ["19:00", "20:30"],
    "Bar/Lounge": ["18:00", "19:30", "21:00"]
  }
}
```

### Toggle Occasions On/Off
Admins can toggle availability in real-time from the admin dashboard (`/admin/dashboard`). Toggles persist to `lib/availability/occasionConfig.json` and are immediately reflected in voice agent responses.

---

## Demo Script

### Demo 1: Happy Path Booking (~45 seconds)

1. Open [http://localhost:3000](http://localhost:3000)
2. Click the **gold microphone FAB** (bottom right)
3. Say: *"I'd like to book a table for Saturday evening."*
4. Agent asks for dining occasion. Say: *"It's our anniversary."*
5. Agent offers available slots. Say: *"The 7 PM slot please."*
6. Agent reads back details. Say: *"Yes, please confirm."*
7. Agent issues code: `TABLE-R07` (spoken twice, shown on screen)
8. Page redirects to `/confirmation` — show the notched gold ticket

**What to point out:**
- No name, phone, or email asked — zero PII
- Total time: under 60 seconds
- Calendar event created in Google Calendar (tentative hold)
- Row appears in Google Sheets log

### Demo 2: Reschedule

1. Click the voice widget
2. Say: *"I need to reschedule my booking."*
3. Agent asks for code. Say: *"TABLE-R07"*
4. Agent reads back current booking. Say: *"Can we move it to Sunday?"*
5. Confirm. Agent updates Calendar and Sheet status to RESCHEDULED.

### Demo 3: Admin Dashboard

1. Navigate to `/admin/login`
2. Click **Sign in with Google** → authenticates via OAuth
3. Dashboard shows live bookings from Google Sheets
4. Toggle **Bar/Lounge** OFF in the right sidebar
5. Try a voice booking for Bar/Lounge — agent says unavailable
6. Toggle back ON — agent offers Bar/Lounge slots again

### Demo 4: Edge Cases

| Scenario | What to say | Expected response |
|---|---|---|
| PII refusal | "My name is Priya" | "To keep things private, I only need your dining preferences…" |
| Allergy question | "Is it safe for my nut allergy?" | "I strongly recommend speaking directly with our chef…" |
| Past date | "Book a table for last Friday" | "I can only book future dates…" |
| No slots | Request a fully-booked date | Agent offers next 2 available dates |
| Large group | "Party of 25" | Agent escalates to human contact for groups >20 |

---

## Running Tests

```bash
# All tests (Sprints 1–10)
npm test

# Server-side only (dialogue, MCP, availability)
npm run test:server

# Client-side only (UI components)
npm run test:client

# Specific sprint
npx jest --testPathPatterns="sprint8"
```

**Test coverage:** 172+ tests across 10 sprints covering:
- Dialogue state machine (all 5 intents, all 5 occasions)
- Reservation code format and daily counter
- Slot availability and overflow logic
- MCP calendar/sheets API calls (mocked googleapis)
- PII guardrails, out-of-scope refusals, edge cases
- Admin UI components (StatsCard, BookingsTable, AvailabilityToggle)

---

## Architecture Decisions

| Decision | Choice | Reason |
|---|---|---|
| Auth library | NextAuth v5 (beta) | App Router native, Google OAuth built-in |
| Session store | In-memory Map | Sufficient for MVP; swap to Redis for multi-instance |
| Availability config | JSON file on disk | Simple, zero DB for MVP; admin PATCH updates it live |
| MCP integrations | Direct googleapis calls | Explicit, typed, easy to test with mocks |
| TTS | Sarvam AI streaming | Sub-200ms first-byte, Indian-accent English |
| Privacy | Zero PII at LLM level | System prompt enforces; regex secondary guard |
| Reservation code | `TABLE-[A-Z][0-9][0-9]` | Anonymous, daily-rolling, easy to speak |

---

## Known Limitations (Next Steps)

| Limitation | Suggested Fix |
|---|---|
| Availability JSON file (not DB) | Move to a dedicated Google Sheet or Firestore for multi-server deployments |
| In-memory session state | Replace with Redis for horizontal scaling |
| Static slot inventory | Add a Sheet-backed slot management UI in the admin portal |
| No automated latency monitoring | Integrate Datadog / Cloud Monitoring on the WebSocket route |
| Admin shows all historical rows | Add date-range filtering to `/api/admin/reservations` |

---

*Built with TableVoice — AI-powered, privacy-first restaurant reservations.*
