# PRD: Restaurant Table Reservation Voice Agent & Web Application

**Document Version:** 1.0  
**Date:** June 2026  
**Status:** Draft for Review  
**Owner:** Product Team

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Why This Product Works](#2-why-this-product-works)
3. [Market Landscape & Competitive Analysis](#3-market-landscape--competitive-analysis)
4. [User Pain Points & Anecdotes](#4-user-pain-points--anecdotes)
5. [Product Goals & Success Metrics](#5-product-goals--success-metrics)
6. [Technical Architecture Overview](#6-technical-architecture-overview)
7. [Feature Specifications](#7-feature-specifications)
8. [Conversation Design & Flows](#8-conversation-design--flows)
9. [Edge Cases & Guardrails](#9-edge-cases--guardrails)
10. [Phases of Implementation](#10-phases-of-implementation)
11. [Go-To-Market Plan](#11-go-to-market-plan)
12. [Open Questions & Risks](#12-open-questions--risks)

---

## 1. Executive Summary

**Product Name:** TableVoice — AI-Powered Restaurant Table Reservation Assistant

**One-liner:** A voice-first, privacy-safe table reservation assistant embedded in any restaurant website, letting diners book, reschedule, or cancel reservations in under 60 seconds — without filling a form, waiting on hold, or disclosing any PII.

**Core Stack:**
| Layer | Technology |
|---|---|
| Speech-to-Text (STT) | Gemini 2.5 Flash Lite (Multimodal) |
| Language Model (LLM) | Gemini 2.5 Flash Lite |
| Text-to-Speech (TTS) | Sarvam AI Streaming TTS |
| Calendar Integration | Google Calendar via MCP |
| Reservation Log | Google Sheets via MCP |
| Hosting | Web Application (embedded widget + standalone page) |

**Target Users:**
- **Primary:** Restaurant diners who want frictionless, fast table reservations
- **Secondary:** Restaurant managers/owners who need automated, accurate booking capture without manual entry overhead

---

## 2. Why This Product Works

### 2.1 The Behavioural Shift

Voice interaction is no longer futuristic — it is the *expected* modality for quick, transactional tasks. Studies show that **72% of users prefer voice for simple service tasks** (Juniper Research, 2024) when the interaction is short, clear, and immediate. A table booking is exactly that: a 4–6 turn transaction with a predictable happy path.

### 2.2 The Restaurant Technology Gap

Despite the proliferation of online reservation platforms (OpenTable, Dineout, etc.), **independent and mid-tier restaurants remain largely unserved**. They cannot afford per-cover commissions (OpenTable charges $1–$7.50/cover), don't have developer resources to maintain complex integrations, and lose bookings every night to phone queues and voicemail.

A lightweight, embeddable voice agent solves this gap at a fraction of the cost.

### 2.3 Why Voice Over Form

Forms create anxiety. Users abandon multi-field booking forms at rates exceeding **68%** (Baymard Institute, 2024). A voice interaction mimics the natural way humans already book tables — "Hey, do you have a table for two on Saturday evening?" — reducing cognitive load and time-to-confirm dramatically.

### 2.4 Why Gemini 2.5 Flash Lite + Sarvam

- **Gemini 2.5 Flash Lite** offers sub-300ms STT latency with excellent Hindi-English code-switching, critical for the Indian restaurant market. Its multimodal reasoning handles ambiguous intents ("sometime next week, maybe evening") gracefully.
- **Sarvam Streaming TTS** produces natural-sounding Indian-accented English and regional language output with real-time streaming — meaning the agent starts speaking within ~150ms of generating text, eliminating the "dead air" that kills voice UX.
- Together, they deliver a **sub-800ms total round-trip latency** on average — comparable to human response speed in a phone call.

### 2.5 Privacy-First as a Differentiator

In a post-DPDP (India's Digital Personal Data Protection Act, 2023) environment, restaurants collecting PII over call recordings face compliance exposure. By explicitly designing **zero PII collection** — no names, no phone numbers, no email addresses — TableVoice becomes the only safe-harbour voice booking option for compliant operators.

---

## 3. Market Landscape & Competitive Analysis

### 3.1 Existing Alternatives

| Competitor | Model | Strengths | Weaknesses |
|---|---|---|---|
| **OpenTable** | SaaS, per-cover fee | Large inventory, network effects | $1–$7.50/cover, no voice, expensive for independent restaurants |
| **Dineout (India)** | SaaS, subscription + commission | India-focused, loyalty programs | No voice, no API for independents, heavy UI |
| **Resy** | SaaS, subscription | Premium restaurant branding | No voice, US-centric |
| **ElevenLabs + Retell AI** | Dev platform for voice agents | Flexible voice quality | No restaurant-specific logic, US-accent TTS, no MCP integrations |
| **Google Business Booking** | Free via Google Search | Zero cost, Google-native | No customization, restricted to Google partners |
| **Phone answering services** | Human staff | Relationship feel | Expensive, inconsistent, limited hours |
| **Simple chatbots (Tidio, etc.)** | Text widget | Easy to set up | No voice, no real availability logic, no calendar hold |

### 3.2 Our Differentiation

| Capability | TableVoice | OpenTable | Dineout | Voice Platforms |
|---|---|---|---|---|
| Voice-first (no typing) | ✅ | ❌ | ❌ | ✅ |
| Zero PII required | ✅ | ❌ | ❌ | ❌ |
| Real-time calendar hold | ✅ | ✅ | ✅ | ❌ |
| Kitchen notes (Sheets) | ✅ | ❌ | ❌ | ❌ |
| India-accent TTS | ✅ | ❌ | ❌ | Partial |
| Per-cover commission | ❌ (flat SaaS) | ✅ (eats margin) | ✅ | — |
| Embeddable widget | ✅ | ❌ | ❌ | ❌ |
| Unique reservation code | ✅ | ✅ | ✅ | ❌ |

---

## 4. User Pain Points & Anecdotes

### 4.1 The Diner's Side

**Anecdote 1 — The Lost Saturday Night**
> *Priya is trying to book a table for her anniversary at a popular restaurant in Bandra. She calls the restaurant at 7 PM on Thursday. It rings 14 times. No answer. She goes to their website — there's a "Book a Table" link that opens a Google Form asking for full name, phone number, email, party size, date, and a long field for "any dietary restrictions." She fills it out, submits, and gets an auto-reply saying "We'll confirm within 24 hours." She never hears back. She ends up booking elsewhere.*

**Pain points extracted:**
- Phone lines are constantly busy during peak discovery hours (evenings, weekends)
- Web forms require PII and feel impersonal
- Confirmation latency (24hrs) kills momentum
- No real-time slot availability shown

**Anecdote 2 — The Group Coordinator's Nightmare**
> *Rajan is coordinating a farewell dinner for 12 colleagues. He's been tasked with booking. He calls the restaurant, gets through, but the staff member who answers isn't sure if they can accommodate 12 and says she'll "check with the manager and call back." Two days later, no callback. The group ends up at a place nobody actually wanted to go to.*

**Pain points extracted:**
- Large group bookings require human judgment calls that don't scale
- Callback promises often fall through
- No confirmation = no commitment on either side

**Anecdote 3 — The Last-Minute Reschedule**
> *Aditya booked a table for Friday but his meeting ran late. He tries to call to push it 45 minutes. The phone is busy. He texts on Instagram DMs — no reply. He just shows up 45 minutes late, the table was given away, and he's embarrassed in front of his client.*

**Pain points extracted:**
- Reschedule/cancel flows don't exist outside of calling
- Social media DMs are unreliable
- No self-serve modification path

### 4.2 The Restaurant Manager's Side

**Anecdote 4 — The No-Show Problem**
> *Chef Meera runs a 40-cover restaurant in Koramangala. She has 3 phone bookings on a Saturday evening and 2 are no-shows. She had turned away walk-ins earlier because "the table was reserved." She loses ₹4,000+ in revenue and has no record of what name or number the original booker used because her staff wrote it on a sticky note that got lost.*

**Pain points extracted:**
- No centralised, persistent booking record
- Staff notes are ephemeral and error-prone
- No-show management requires PII tracking (which is cumbersome)
- Manual coordination between front-of-house and kitchen is lossy

**Anecdote 5 — The Special Occasion Setup**
> *A restaurant gets a call for "a birthday dinner, please make sure there's a cake." The hostess scribbles this. The kitchen never gets the note. Guests arrive, no cake, bad review online.*

**Pain points extracted:**
- Occasion context doesn't reach the kitchen reliably
- No structured "notes" pipeline between booking and kitchen
- Special requests are verbally relayed and frequently lost

---

## 5. Product Goals & Success Metrics

### 5.1 Goals

| # | Goal | Rationale |
|---|---|---|
| G1 | Reduce booking abandonment to <10% | Current form-based abandonment is 68%+ |
| G2 | Complete a booking in under 90 seconds | Match or beat phone booking speed |
| G3 | Zero PII stored in any system | DPDP compliance, trust signal |
| G4 | 95%+ calendar hold accuracy | Kitchen and FOH coordination depends on it |
| G5 | Support 5 distinct dining occasions and 3 intents (book/reschedule/cancel) | Cover 80%+ of real booking scenarios |
| G6 | Restaurant manager dashboard requires zero manual data entry | Core value proposition for B2B |

### 5.2 Success Metrics (OKR Format)

#### Objective 1: Diners complete bookings faster and with less friction

| Key Result | Target | Measurement |
|---|---|---|
| Booking completion rate (voice session → confirmation code) | ≥ 75% | Session logs |
| Median time-to-code (session start → code issued) | ≤ 75 seconds | Session timestamps |
| User satisfaction (post-session CSAT, optional 1-question survey) | ≥ 4.2 / 5 | In-app rating |
| Repeat booking rate (same code prefix detected within 30 days) | ≥ 30% | Sheets log analysis |

#### Objective 2: Restaurants reduce operational burden

| Key Result | Target | Measurement |
|---|---|---|
| % of bookings captured in Google Sheets without staff intervention | ≥ 95% | Sheet row count vs. human entries |
| Calendar hold accuracy (slot in calendar matches sheet) | ≥ 98% | Automated reconciliation |
| Average time staff spends on phone bookings per evening | Reduced by 70% | Manager self-report survey |

#### Objective 3: Technical performance targets

| Key Result | Target | Measurement |
|---|---|---|
| End-to-end STT → LLM → TTS round trip (P95) | ≤ 1200ms | Latency instrumentation |
| TTS first-byte latency (streaming) | ≤ 200ms | Sarvam streaming metrics |
| System uptime | ≥ 99.5% | Infrastructure monitoring |
| MCP Calendar/Sheets operation success rate | ≥ 99% | MCP call logs |

---

## 6. Technical Architecture Overview

### 6.1 System Components

```
┌──────────────────────────────────────────────────────────────────┐
│                     Web Application (Restaurant Website)          │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │               Voice Agent Widget (Embedded JS)              │ │
│  │  [🎤 Microphone] → [WebAudio API] → [MediaRecorder API]    │ │
│  └────────────────────────┬────────────────────────────────────┘ │
└───────────────────────────┼──────────────────────────────────────┘
                            │ WebSocket / HTTP Streaming
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│                    TableVoice Backend (Node.js / Python)          │
│                                                                    │
│  ┌──────────────┐   ┌─────────────────┐   ┌──────────────────┐  │
│  │  STT Module  │   │   LLM Module    │   │   TTS Module     │  │
│  │  Gemini 2.5  │──▶│  Gemini 2.5    │──▶│  Sarvam Stream   │  │
│  │  Flash Lite  │   │  Flash Lite    │   │  TTS API         │  │
│  │  (Audio →   │   │  (Intent +     │   │  (Text → Audio   │  │
│  │   Text)      │   │   Slot Fill +  │   │   Streaming)     │  │
│  └──────────────┘   │   Dialogue Mgmt)│   └──────────────────┘  │
│                      └────────┬────────┘                         │
│                               │                                   │
│  ┌────────────────────────────▼───────────────────────────────┐  │
│  │                 Dialogue State Manager                      │  │
│  │  Session Store: { intent, occasion, date, slot, code, ...} │  │
│  └─────────────────┬────────────────────────┬─────────────────┘  │
│                    │                        │                     │
│         ┌──────────▼───────┐    ┌──────────▼─────────┐          │
│         │  MCP: Google     │    │  MCP: Google        │          │
│         │  Calendar        │    │  Sheets             │          │
│         │  (Calendar Hold) │    │  (Reservation Log)  │          │
│         └──────────────────┘    └─────────────────────┘          │
└──────────────────────────────────────────────────────────────────┘
```

### 6.2 Data Flow

1. **User opens chat widget** on restaurant website and clicks "Start Voice Booking"
2. **Browser captures microphone** audio via WebAudio API, streams to backend
3. **Gemini 2.5 Flash Lite (STT)** transcribes speech to text in real-time
4. **Gemini 2.5 Flash Lite (LLM)** processes transcript with system prompt:
   - Identifies intent (book_new / reschedule / cancel / check_availability)
   - Fills slots: occasion, date, time, party size (no PII)
   - Generates response text
5. **Sarvam Streaming TTS** converts response text to audio, streams first bytes back within 150ms
6. **Browser plays audio** while TTS continues streaming
7. On **booking confirmation**, LLM triggers:
   - `mcp_calendar_create_event()` → tentative hold on Google Calendar
   - `mcp_sheets_append_row()` → row added to Daily Reservation Log
8. **Reservation Code** (e.g., `TABLE-B99`) is generated and spoken to user

### 6.3 Reservation Code Format

```
TABLE-[A-Z][0-9][0-9]
```
- **Prefix:** `TABLE-` — identifies the system
- **Letter:** Random A–Z (avoids I, O to prevent confusion)
- **Digits:** 00–99 — daily rolling number
- **Example:** `TABLE-B47`, `TABLE-R12`
- Code is repeated back to the user **twice** during confirmation
- Code is also displayed visually in the web widget chat transcript

### 6.4 Mock Availability Inventory

For Phase 1, availability is managed via a configurable JSON file (or Google Sheet) that the restaurant updates:

```json
{
  "2026-06-15": {
    "Standard Dining": ["12:00", "13:30", "19:00", "20:30"],
    "Large Group 6+": ["19:00"],
    "Outdoor/Patio": ["12:30", "19:30"],
    "Special Occasion": ["19:00", "20:30"],
    "Bar/Lounge": ["18:00", "19:30", "21:00"]
  }
}
```

---

## 7. Feature Specifications

### 7.1 Intents

#### `book_new`
- **Trigger phrases:** "I'd like to book a table", "Reserve a table", "Do you have availability", "Book for tonight"
- **Slots to collect:**
  - `dining_occasion` (required): One of 5 categories
  - `preferred_date` (required): Natural language date parsed to ISO
  - `preferred_time` (required): Natural language time parsed to HH:MM IST
  - `party_size` (conditional, required for Large Group): Integer 1–20
- **Output:** Reservation Code, Calendar hold, Sheet entry

#### `reschedule_reservation`
- **Trigger phrases:** "Change my reservation", "Move my booking", "Reschedule TABLE-B47"
- **Slots to collect:**
  - `reservation_code` (required): Existing code
  - `new_date` (required)
  - `new_time` (required)
- **Output:** Old calendar event cancelled, new hold created, updated sheet row, new or same code confirmed

#### `cancel_reservation`
- **Trigger phrases:** "Cancel my booking", "I can't make it", "Cancel TABLE-B47"
- **Slots to collect:**
  - `reservation_code` (required)
- **Output:** Calendar event deleted, sheet row updated with status "CANCELLED", verbal confirmation

#### `check_availability`
- **Trigger phrases:** "What slots do you have", "Are you free on Sunday", "Do you have outdoor seating on Friday"
- **Slots to collect:**
  - `preferred_date` (required)
  - `dining_occasion` (optional)
- **Output:** Lists up to 3 available slots verbally; no booking made

#### `small_talk / out_of_scope`
- Handles greetings, thanks, and gracefully refuses out-of-scope requests (see Edge Cases)

### 7.2 Dining Occasions

| Occasion | Key Constraints | Notes |
|---|---|---|
| Standard Dining | Standard tables, max 5 | Default option |
| Large Group (6+) | Requires party size, special section | Ask party size explicitly |
| Outdoor / Patio | Weather-dependent | Add disclaimer in response |
| Special Occasion / Anniversary | Decoration note in kitchen log | Agent mentions "we'll note this for the team" |
| Bar / Lounge | Standing/high-top, max 4 | No full-service menu |

### 7.3 Web Application

#### Standalone Reservation Page
- Full-screen, branded reservation experience
- Displays: restaurant name, logo, operating hours, voice widget
- Shows live transcript of conversation (accessibility)
- Visual confirmation card with Reservation Code at end

#### Embedded Chat Widget
- Floating button (bottom-right) on any restaurant webpage
- Expands to 360×600px panel
- Microphone permission request on first use
- Falls back to text input if microphone denied

#### Restaurant Admin Panel (Phase 2)
- View today's reservations from Sheets (read-only dashboard)
- Availability management: toggle slots on/off per date per occasion
- Analytics: booking volume, most popular occasions, peak hours

### 7.4 MCP Integrations

#### Google Calendar (via MCP)
- **Event title format:** `Dining Hold — {Occasion} — {Code}`
- **Duration:** 2 hours (default), 3 hours for Large Group
- **Status:** Tentative
- **Description:** `Party of {N} | Slot: {Date} {Time} IST | Code: {Code}`
- **Calendar:** Restaurant's designated "Reservations" calendar

#### Google Sheets (via MCP)
- **Sheet name:** `Daily Reservation Log`
- **Columns:** `Date | Time (IST) | Occasion | Party Size | Code | Status | Timestamp`
- **Status values:** `CONFIRMED`, `CANCELLED`, `RESCHEDULED`, `NO_SHOW` (manual)
- **Append on book, update on cancel/reschedule**

---

## 8. Conversation Design & Flows

### 8.1 Happy Path — New Booking

```
AGENT: "Welcome to [Restaurant Name]! I'm here to help you reserve a table.
        Would you like to make a new booking, reschedule, or cancel an 
        existing reservation?"

USER: "I'd like to book a table for Saturday evening."

AGENT: "Great! To find the perfect spot for you, could you tell me what 
        type of dining experience you're looking for? We have:
        Standard Dining, a Large Group of six or more, Outdoor or Patio 
        seating, a Special Occasion like an anniversary, or Bar and Lounge. 
        Which suits you best?"

USER: "It's our anniversary, so something special."

AGENT: "How lovely! For your anniversary this Saturday. We have two slots 
        available: 7 PM IST and 8:30 PM IST on Saturday, the fourteenth 
        of June. Which works better for you?"

USER: "7 PM works."

AGENT: "Perfect. Let me confirm: a Special Occasion table for two on 
        Saturday, the fourteenth of June, at 7 PM IST. Shall I lock 
        that in?"

USER: "Yes, please."

AGENT: "Wonderful! Your reservation is confirmed. Your unique Reservation 
        Code is TABLE-R07 — that's TABLE-R07. Simply share this code when 
        you arrive. We'll note this as a special occasion for our team. 
        Please note: we hold tables for fifteen minutes past your booking 
        time. We hope you have a beautiful anniversary dinner. Have a 
        great day!"
```

### 8.2 Reschedule Flow

```
AGENT: "Of course! Please share your existing Reservation Code."

USER: "It's TABLE-R07."

AGENT: "Found it! You have a Special Occasion booking for Saturday the 
        fourteenth at 7 PM IST. What date and time would you like to 
        move it to?"

USER: "Can we do Sunday, same time?"

AGENT: "We have 7 PM IST available on Sunday, the fifteenth of June. 
        Shall I move your booking to Sunday the fifteenth at 7 PM IST? 
        Your code TABLE-R07 stays the same."

USER: "Yes."

AGENT: "Done! Your Special Occasion table is now rescheduled to Sunday, 
        the fifteenth of June at 7 PM IST. Your code remains TABLE-R07. 
        See you then — have a great day!"
```

### 8.3 Cancellation Flow

```
AGENT: "I'm sorry to hear you need to cancel. Please share your 
        Reservation Code."

USER: "TABLE-R07."

AGENT: "Found your booking: Special Occasion table, Sunday the fifteenth 
        at 7 PM IST. Are you sure you'd like to cancel this reservation?"

USER: "Yes."

AGENT: "Your reservation TABLE-R07 has been cancelled. We hope to see 
        you another time. Have a great day!"
```

### 8.4 No Availability Flow

```
AGENT: "I checked our availability for Friday evening for a Large Group, 
        and unfortunately we're fully booked. Would you like me to check 
        Saturday or Sunday instead?"

USER: "Saturday."

AGENT: "On Saturday, the fifteenth, for a Large Group of six or more, 
        we have 6:30 PM IST available. Would you like to book that slot?"
```

### 8.5 Turn Design Principles

- Maximum **3 slots offered** at once (cognitive load limit)
- Always state **full date (day name + date + month) and time with IST timezone**
- **Repeat the Reservation Code twice** on confirmation
- Keep agent turns under **25 words** for non-confirmation turns
- Use **confirmation questions** before any write operation (MCP calls)

---

## 9. Edge Cases & Guardrails

### 9.1 Input Edge Cases

| Scenario | Handling |
|---|---|
| Ambiguous date ("next week sometime") | Agent asks: "Which day works best — would you prefer a weekday or weekend?" |
| Past date requested | "I'm sorry, I can only book future dates. What upcoming date works for you?" |
| Time outside operating hours | "Our kitchen closes at 10 PM. The latest slot I can offer is 8:30 PM." |
| Party size >20 | "For very large events, please contact us directly at [email/number shown in widget]. I can handle groups up to 20." |
| Duplicate code lookup failure | "I couldn't find that code in our system. Could you double-check? It should look like TABLE followed by a letter and two numbers." |
| User says code incorrectly (e.g., "table bee 47") | STT + LLM normalises phonetic to alphanumeric. Fuzzy match attempted. |

### 9.2 Out-of-Scope Requests

| Request Type | Response |
|---|---|
| Menu inquiries | "I'm only able to help with table reservations today. Our menu is available on the website." |
| Pricing / bill queries | "For billing questions, our team would be happy to assist when you visit." |
| Medical / allergy advice ("Is it safe for my severe nut allergy?") | "For severe allergies, I strongly recommend speaking directly with our chef before your visit. I'm not able to provide medical or nutritional safety advice. Would you still like to make a reservation?" |
| Delivery / takeaway | "I handle table reservations only. For delivery, please visit [link shown in widget]." |
| Complaints about past visits | "I'm sorry to hear that. For feedback, please reach out to [email shown in widget]. I'm here to help with reservations." |

### 9.3 Technical Edge Cases

| Scenario | Handling |
|---|---|
| MCP Calendar call fails | Retry once; if still fails, still issue code and log to Sheets; inform user "Your slot is held — there may be a brief delay updating our calendar." |
| MCP Sheets call fails | Retry once; log locally; alert restaurant admin email |
| STT confidence low (<0.7) | Agent asks: "I didn't quite catch that — could you repeat?" (max 2 retries then designation) |
| User silent for >8 seconds | "Still there? Take your time — I'm ready whenever you are." |
| User silent for >20 seconds | "It seems like you may have stepped away. I'll close this session now. Feel free to start again anytime. Goodbye!" |
| Microphone permission denied | Fallback to text chat input mode automatically, no error shown to user |
| Network drop mid-session | Session state persists for 5 minutes; user can reconnect and resume |

### 9.4 Privacy Guardrails

- **No PII collection enforced at LLM prompt level:** System prompt explicitly instructs model to refuse and redirect if user offers name, phone, email, or national ID.
- **Audio not stored:** Raw audio is transcribed and immediately discarded. Only the text transcript is retained for session duration (TTL: 24 hours).
- **Session transcript auto-purged** after 24 hours from all servers.
- **Reservation Code is the only identifier:** Designed to be a non-PII reference token.
- **Google Calendar/Sheets:** Entries contain Code, Occasion, Slot — no PII.

---

## 10. Phases of Implementation

### Phase 0 — Foundation (Weeks 1–3)

> Goal: Working voice pipeline end-to-end with a single happy-path booking flow.

**Deliverables:**
- [ ] Backend: Gemini 2.5 Flash Lite STT endpoint accepting WebSocket audio stream
- [ ] Backend: Gemini 2.5 Flash Lite LLM dialogue manager (system prompt + state machine)
- [ ] Backend: Sarvam Streaming TTS integration (text-in → audio-stream-out)
- [ ] Frontend: Basic web page with microphone capture and audio playback
- [ ] MCP: Google Calendar tentative hold creation
- [ ] MCP: Google Sheets row append
- [ ] Reservation Code generator (TABLE-[A-Z][0-9][0-9])
- [ ] Mock availability JSON with one week of data
- [ ] Manual QA of full happy path (book_new, Standard Dining)

**Success gate:** Complete booking → code issued → Calendar event → Sheet row, in a single voice session, in <90 seconds.

---

### Phase 1 — Full Intent Coverage (Weeks 4–7)

> Goal: All 5 intents working, all 5 dining occasions, and production-grade web widget.

**Deliverables:**
- [ ] LLM: `reschedule_reservation` intent + flow
- [ ] LLM: `cancel_reservation` intent + flow
- [ ] LLM: `check_availability` intent (read-only)
- [ ] LLM: All 5 dining occasion branches with correct slot constraints
- [ ] LLM: Out-of-scope refusals (allergy, menu, etc.)
- [ ] LLM: Overflow handling (no slots → offer alternate day)
- [ ] Frontend: Polished embedded chat widget (floating button, panel)
- [ ] Frontend: Visual transcript display with accessibility support
- [ ] Frontend: Visual Reservation Code card at session end
- [ ] Frontend: Text input fallback if mic blocked
- [ ] Privacy: PII guardrail in system prompt validated
- [ ] Latency: End-to-end P95 ≤ 1200ms validated
- [ ] Unit + integration tests for all intent flows

**Success gate:** All intent paths pass QA; widget embeds cleanly on a demo restaurant page; latency targets met.

---

### Phase 2 — Restaurant Admin Panel (Weeks 8–11)

> Goal: Restaurant managers can self-serve availability and view bookings.

**Deliverables:**
- [ ] Admin Portal: Login (Google OAuth, restaurant-specific)
- [ ] Admin Portal: Today's reservations dashboard (pulls from Sheets)
- [ ] Admin Portal: Availability manager (toggle slots on/off per date per occasion)
- [ ] Admin Portal: Weekly calendar view of bookings
- [ ] Availability: Dynamic slot fetch from admin-managed config (replaces static JSON)
- [ ] Notifications: Email/WhatsApp digest to restaurant manager at 5 PM daily (optional)
- [ ] Analytics: Booking volume, occasion breakdown, peak time heatmap

**Success gate:** Restaurant manager can update availability, and the voice agent reflects changes in real-time without a developer.

---

### Phase 3 — Multi-Restaurant & Scale (Weeks 12–16)

> Goal: Platform-ready: multiple restaurants, billing, onboarding flow.

**Deliverables:**
- [ ] Multi-tenancy: Isolated config, calendar, and sheet per restaurant
- [ ] Onboarding: Self-serve sign-up for restaurant owners
- [ ] Billing: Subscription tier management (Stripe or Razorpay)
- [ ] Widget customization: Brand colours, logo, restaurant name
- [ ] Multi-language TTS: Hindi, Tamil, Telugu via Sarvam (based on browser locale)
- [ ] Analytics: Cross-restaurant aggregate dashboard for platform team
- [ ] SLA monitoring: Uptime, latency, error rate per restaurant
- [ ] Public API: Restaurant CMS integration webhook (POS systems)

**Success gate:** 5 pilot restaurants onboarded independently, each with distinct config and isolated data.

---

### Phase 4 — Intelligence & Retention (Weeks 17–22)

> Goal: Agent gets smarter over time; diners get a reason to return.

**Deliverables:**
- [ ] Slot prediction: ML model suggests best alternative slots (based on historical booking patterns)
- [ ] Session analytics: Dropout analysis — where in the conversation do users abandon?
- [ ] Agent fine-tuning: Use anonymised transcripts (consent-gated) to improve intent accuracy
- [ ] Waitlist feature: If no slots available, user can request a waitlist ping (email/WhatsApp, opt-in)
- [ ] Post-visit feedback: Optional 1-question rating link in Sheets "Confirmation" row
- [ ] Loyalty hooks: Repeat-booker detection via code pattern (same device + 3+ bookings)

---

## 11. Go-To-Market Plan

### 11.1 Target Segments (Prioritised)

| Segment | Description | Why First |
|---|---|---|
| **Tier 1** | Independent fine-dining & casual restaurants (20–80 covers) in metro India (Mumbai, Bangalore, Delhi, Hyderabad) | High pain, no IT team, high willingness to pay |
| **Tier 2** | Mid-size restaurant chains (2–10 locations) | More budget, need centralised reporting |
| **Tier 3** | Hotel F&B departments | Long sales cycle but high ACV |
| **Future** | International (SEA, Middle East) | Sarvam supports regional languages |

### 11.2 Pricing Strategy

| Plan | Price | Limits | Target |
|---|---|---|---|
| **Starter** | ₹2,999/month | 1 location, 200 bookings/month | Independent restaurants |
| **Growth** | ₹6,999/month | 1 location, unlimited bookings, admin panel | Busy independents |
| **Pro** | ₹14,999/month | Up to 5 locations, multi-language, analytics | Small chains |
| **Enterprise** | Custom | Unlimited, API, SLA, dedicated support | Hotel F&B, large chains |

*Compared to OpenTable's ₹500–₹600/cover, a restaurant doing 30 covers/week breaks even on Starter in 1–2 covers.*

### 11.3 Go-To-Market Phases

#### Phase 1 — Lighthouse (Months 1–3)
- **Goal:** 5 design-partner restaurants, deeply engaged
- **Tactic:** Direct outreach to restaurant owners in Bangalore/Mumbai via founder network
- **Offer:** 3 months free in exchange for weekly feedback sessions and a testimonial
- **Metrics:** Booking completion rate, manager NPS, time-saved-per-evening

#### Phase 2 — Community-Led Growth (Months 3–6)
- **Goal:** 25 paying restaurants
- **Tactics:**
  - Partner with restaurant industry groups (NRAI — National Restaurant Association of India)
  - Host free "AI for Restaurants" webinars with demo
  - Case study video from lighthouse restaurants ("We saved 2 hours per evening")
  - App listing on Google Workspace Marketplace (MCP integrations visible)
- **Content:** Blog: "Why Indian restaurants lose 30% of Saturday bookings to unanswered phones"

#### Phase 3 — Paid Acquisition (Months 6–12)
- **Goal:** 100+ paying restaurants
- **Channels:**
  - Google Search Ads ("restaurant booking software India")
  - Instagram/LinkedIn Ads targeting restaurant owners and F&B managers
  - Referral program: Existing restaurants get 1 month free per referral
- **Partnerships:**
  - POS systems (Petpooja, Posist) — embed widget in their dashboard
  - Food delivery aggregators as a complementary "dine-in" option
  - Web design agencies that build restaurant websites

#### Phase 4 — International Expansion (Month 12+)
- **Goal:** SEA expansion (Singapore, Malaysia, Indonesia)
- **Tactic:** Leverage Sarvam's multilingual TTS for Malay, Tamil (SG), Bahasa
- **Partner:** Local digital agencies and hospitality tech resellers

### 11.4 Launch Narrative

**Press angle:** "Indian startup lets restaurants run fully automated bookings — without collecting a single customer name or phone number."

This speaks to two hot topics simultaneously:
1. AI-native operations for SMBs
2. Privacy-by-design in the age of DPDP

**Demo strategy:** Live demo videos showing a booking completed in under 60 seconds, contrasted with a time-lapse of someone struggling with a reservation form or waiting on hold.

### 11.5 Success at 12 Months

| Metric | Target |
|---|---|
| Paying restaurants | 100 |
| Monthly bookings processed | 15,000+ |
| Monthly Recurring Revenue (MRR) | ₹35–50 Lakhs |
| NPS from restaurant managers | ≥ 50 |
| Booking completion rate (platform avg) | ≥ 72% |

---

## 12. Open Questions & Risks

### 12.1 Open Questions

| # | Question | Impact | Owner |
|---|---|---|---|
| Q1 | Should `party_size` be collected for Standard Dining (for seating purposes)? | UX vs. simplicity | Product |
| Q2 | What is the retention period for voice session transcripts? (24hr proposed) | Privacy compliance | Legal |
| Q3 | Should the system issue a new code on reschedule or preserve original? (preserve proposed) | UX consistency | Product |
| Q4 | Sarvam TTS language default — English (Indian) or auto-detect from STT language? | Localization | Engineering |
| Q5 | Should the web widget appear on all pages or only the "Reservations" page? | Conversion vs. UX noise | Product |
| Q6 | What happens if Google Calendar/Sheets OAuth tokens expire during a session? | Reliability | Engineering |

### 12.2 Risks

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Gemini 2.5 Flash Lite STT accuracy for accented/noisy audio | Medium | High | Noise suppression pre-processing; fallback to text input |
| MCP calls fail during peak booking hours | Low | High | Queue with retry; graceful degradation message to user |
| Restaurant staff ignore the Sheets log and revert to manual | Medium | Medium | Mandatory admin panel as primary UX; remove paper incentive |
| Diners lose Reservation Code before arrival | Medium | Low | Display code in widget UI; encourage screenshot; code lookup via `check_availability` flow |
| DPDP / data residency concerns from enterprise hotels | Low | High | Data residency option (GCP India region) in enterprise tier |
| Competitor (e.g., Google, Zomato) launches similar feature | Medium | High | Speed to market + PII-free positioning is unique moat |

---

## Appendix A — System Prompt (Abbreviated)

```
You are TableVoice, a friendly and efficient table reservation assistant for {RESTAURANT_NAME}. 

Your ONLY job is to help users:
1. Book a new table (book_new)
2. Reschedule an existing reservation (reschedule_reservation)  
3. Cancel an existing reservation (cancel_reservation)
4. Check availability (check_availability)

CRITICAL RULES:
- NEVER ask for or accept any personally identifiable information (name, phone, email, national ID, address).
- If a user offers their name or contact info, politely decline: "To keep things private, I only need your dining preferences — no personal details required!"
- ALWAYS state dates as: [Day Name], [DD] [Month] [YYYY] (e.g., "Saturday, the 14th of June 2026").
- ALWAYS state times as [HH:MM] IST.
- ALWAYS repeat the Reservation Code TWICE on confirmation.
- REFUSE any requests for medical advice, nutritional safety assessments, or allergy medical guidance.
- Offer a MAXIMUM of 3 available slots when presenting options.
- If no slots match → state clearly and offer an alternative day.
- Keep responses concise. Target 2-3 sentences per turn (except confirmation turns).

AVAILABLE DINING OCCASIONS: Standard Dining | Large Group (6+) | Outdoor/Patio | Special Occasion/Anniversary | Bar/Lounge

CURRENT TIMEZONE: IST (Asia/Kolkata, UTC+5:30)

RESTAURANT OPERATING HOURS: {OPERATING_HOURS}
```

---

## Appendix B — Google Sheets Log Schema

| Column | Type | Example |
|---|---|---|
| `timestamp` | ISO DateTime | `2026-06-14T19:15:32+05:30` |
| `reservation_code` | String | `TABLE-R07` |
| `date` | Date | `2026-06-14` |
| `time_ist` | Time | `19:00` |
| `occasion` | Enum | `Special Occasion` |
| `party_size` | Integer | `2` |
| `status` | Enum | `CONFIRMED` |
| `notes` | String | `Special Occasion noted` |
| `session_id` | UUID | `sess_abc123` (auto-purged after 24h) |

---

## Appendix C — Glossary

| Term | Definition |
|---|---|
| **STT** | Speech-to-Text: Converts spoken audio to text |
| **TTS** | Text-to-Speech: Converts generated text to spoken audio |
| **LLM** | Large Language Model: AI model managing dialogue and intent |
| **MCP** | Model Context Protocol: Standardised way for LLMs to call external tools/APIs |
| **PII** | Personally Identifiable Information: Name, phone, email, etc. |
| **DPDP** | Digital Personal Data Protection Act, 2023 (India) |
| **IST** | Indian Standard Time (UTC+5:30) |
| **Reservation Code** | Anonymous alphanumeric token (e.g., TABLE-B99) used as the only booking identifier |
| **Slot** | A specific date + time combination for a dining occasion |
| **Tentative Hold** | A calendar event with "Tentative" status, indicating the slot is reserved but not confirmed by the restaurant kitchen |

---

*Document prepared for internal review. All metrics are targets and subject to revision after pilot data collection.*
