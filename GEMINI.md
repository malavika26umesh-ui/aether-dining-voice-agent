# GEMINI.md — TableVoice / Aether Dining

## What This Project Is
An AI voice reservation system for restaurant "Aether Dining". Customers book/reschedule/cancel tables by speaking to a voice agent embedded on the restaurant website. No PII is ever collected.

## Key Files to Read First
- `ImplementationPlan.md` — Sprint tasks, current progress, and Handover Notes. **Always read this before doing anything.**
- `PRD.md` — Full product spec, conversation flows, edge cases, and system prompt (Appendix A).

## Tech Stack
| Layer | Technology |
|---|---|
| Framework | Next.js 15, App Router, TypeScript |
| Styling | Tailwind CSS — token source is `stitch_aether_voice_reservation_system/amber_noir/DESIGN.md` |
| STT + LLM | Gemini 2.5 Flash Lite (`GOOGLE_API_KEY`) |
| TTS | Sarvam AI Streaming (`SARVAM_API_KEY`) |
| Real-time | WebSocket (`app/api/voice/route.ts`) |
| Integrations | Google Calendar + Google Sheets via MCP (`googleapis` npm package) |
| Admin Auth | NextAuth.js + Google OAuth |

## Dev Commands
```bash
npm run dev      # Start local server (port 3000)
npm run build    # Production build
npm run lint     # ESLint check
```

## Critical Conventions
- **Reservation Code format:** `TABLE-[A-Z][0-9][0-9]` — exclude letters I and O.
- **Dates always spoken as:** "Saturday, 14th June 2026" + "IST" suffix on times.
- **Reservation Code is always repeated TWICE** in the confirmation response.
- **Never collect PII** (no names, phone, email). Reject gracefully if offered.
- **Max 3 slots offered** per availability query.
- **MCP failures:** retry once, then issue code anyway with a graceful notice to the user.

## Design Assets
All Stitch designs live in `stitch_aether_voice_reservation_system/`. Each subfolder has `code.html` (source of truth for markup + Tailwind config) and `screen.png` (visual reference). Custom CSS classes from Stitch: `.glass-panel`, `.amber-glow`, `.audio-wave`.

| Route | Stitch Source Folder |
|---|---|
| `/` | `aether_dining_landing_page/` |
| `/reserve` | `aether_dining_voice_reservation/` |
| `/confirmation` | `aether_dining_confirmation/` |
| `/admin/dashboard` | `aether_dining_admin_dashboard_refined/` |
| `/admin/login` | `aether_dining_admin_login/` |

## Environment Variables (`.env.local`)
```
GOOGLE_API_KEY=
SARVAM_API_KEY=
GOOGLE_CALENDAR_ID=
GOOGLE_SHEETS_ID=
GOOGLE_SERVICE_ACCOUNT_JSON=   # base64-encoded service account JSON
NEXTAUTH_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

## Sprint Handover Rule
At the end of every session, **update `ImplementationPlan.md`**: check off completed tasks `[x]` and append a Handover Note summarising decisions made, files changed, and any open issues for the next sprint.
