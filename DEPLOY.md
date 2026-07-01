# Deploying to Render (single service)

This app is one Next.js 16 application whose voice pipeline runs over a **WebSocket**
attached to the Next.js Node server (`app/api/voice/route.ts`). A WebSocket needs a
long-lived process, which **Vercel's serverless model cannot provide** — so the whole
app is deployed to **Render** as a single persistent Web Service. (Vercel is not used.)

## 1. Prerequisites
- Code pushed to GitHub (done): `malavika26umesh-ui/aether-dining-voice-agent`
- A [Render](https://render.com) account
- Your real API keys / Google service-account (same values as local `.env`)

## 2. Create the service (Blueprint — easiest)
1. Render Dashboard → **New → Blueprint**.
2. Connect the GitHub repo. Render reads `render.yaml` and proposes the service.
3. Click **Apply**. The first build runs `npm ci && npm run build`.

*(Manual alternative: New → Web Service → pick repo → Build `npm ci && npm run build`,
Start `npm run start`, Runtime Node, add env vars from the list below.)*

## 3. Set environment variables
In the service's **Environment** tab, add (values from your local `.env`):

| Key | Notes |
|---|---|
| `GROQ_API_KEY` | Groq Whisper STT |
| `SARVAM_API_KEY` | Sarvam TTS |
| `GOOGLE_API_KEY` | Gemini dialogue |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | **base64 of the whole key file** (the long string in `.env`) |
| `GOOGLE_SHEETS_ID` | spreadsheet ID |
| `GOOGLE_CALENDAR_ID` | calendar ID |
| `NODE_VERSION` | `22` (already in render.yaml / `.node-version`) |

Optional — only if you enable the `/admin` dashboard:

| Key | Notes |
|---|---|
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `AUTH_TRUST_HOST` | `true` (required off-Vercel) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth (still placeholders today) |

> Tip: paste the base64 `GOOGLE_SERVICE_ACCOUNT_JSON` exactly — one line, no wraps.

## 4. Deploy & verify
1. Save env vars → Render redeploys automatically.
2. Open `https://<your-app>.onrender.com` — the landing page loads over HTTPS
   (required for mic access).
3. Go to `/reserve`, allow the microphone, and speak. The WebSocket connects to
   `wss://<your-app>.onrender.com/api/voice`. Confirm a booking and check that a row
   lands in the `Daily Reservation Log` sheet and a tentative hold appears on the calendar.

## 4a. Keep the free instance awake (recommended)
`render.yaml` uses **`plan: free`** ($0). Render **sleeps a free service after 15 min of
inactivity**, so the first visitor after a quiet spell waits ~30–50s for a cold start and
any idle WebSocket drops. For a voice demo that's rough — prevent it with a free uptime
pinger:

1. Sign up at [UptimeRobot](https://uptimerobot.com) (or [cron-job.org](https://cron-job.org)).
2. Add a new **HTTP(s)** monitor → URL `https://<your-app>.onrender.com/` → interval **10 minutes**.
3. Save. The periodic hit keeps the service warm.

A single always-on free service uses ~730 instance-hours/month, just under Render's ~750-hr
free allowance, so this stays free. If the app ever gets real traffic and you want zero cold
starts guaranteed, flip `plan: free` → `plan: starter` in `render.yaml` (one line, ~$7/mo).

## 5. Things to know
- **Single instance only.** The WebSocket and the in-memory `sessionCache` live in
  one process, so do **not** scale to >1 instance (sessions won't be shared).
- **Free tier sleeps on idle** unless kept warm (see §4a) → cold start on the first hit,
  and any active WS drops when it sleeps.
- **`next start` binds to `$PORT`** automatically (Render sets it) — no change needed.
- **Admin login (`/admin`)** needs `AUTH_SECRET` + `AUTH_TRUST_HOST=true`, and the Google
  OAuth redirect URI `https://<your-app>.onrender.com/api/auth/callback/google` added in
  Google Cloud → Credentials. Until the Google client vars are real, admin login is disabled;
  the public booking flow works without them.
- **Secrets are not in the repo** (`.env*` and the `*.json` key are git-ignored). Render
  holds them in its own encrypted env store.

## Why not split Vercel + Render?
The "backend" here isn't a standalone service — it's a WebSocket fused into the Next.js
server. Splitting would require extracting a standalone `ws` server and making the client
WS URL configurable (`NEXT_PUBLIC_VOICE_WS_URL`). That's a real refactor with no benefit
for a demo, so everything runs on Render.
