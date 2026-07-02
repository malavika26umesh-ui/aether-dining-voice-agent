# LinkedIn Carousel Post — "I Built a Voice AI That Books Restaurant Tables"

> **How to use this document:**
> Copy the **caption** into your LinkedIn post, then build the **8 carousel slides** in Canva, Figma, or Gamma using the copy and visual direction below.
> All performance numbers come from the live eval run (`evals/results.json`, 2026-07-02).

---

## 🎨 Design System (apply to every slide)

| Element | Value |
|---|---|
| **Slide size** | 1080 × 1350 px (portrait) |
| **Background** | Soft cream `#FFF7ED` — warm, inviting, never sterile |
| **Accent colours** | Warm amber `#F59E0B` + deep plum `#5B4B8A` |
| **Text** | Near-black `#1F2937` on light backgrounds; white only on amber/plum blocks |
| **Fonts** | Poppins, Inter, or Sora — clean geometric sans-serif |
| **Headline** | 56–72 pt, bold |
| **Body** | 30–36 pt |
| **Footnotes** | 22–24 pt |
| **Golden rule** | ≤ 20 words of body per slide — let the font breathe |
| **Footer** | Same position on every slide: `@yourhandle · 1/8` |
| **Accessibility** | WCAG-AA contrast minimum throughout |

---

## 📄 The Caption

> **Picture this.** You're hungry, it's Friday evening, and you just want a table for four tomorrow night.
>
> You don't want to download an app. You don't want to fill out a form. And you *definitely* don't want to sit on hold listening to jazz covers of "Girl from Ipanema."
>
> So you open a restaurant's website, tap the mic, and say:
> *"Hey, can I get a patio table for four this Saturday at 7?"*
>
> One second later, a voice reads back your confirmation code. Done. Booked. Hands-free.
>
> **That's what I built.**
>
> It's called **Aether Dining** — a fully voice-driven restaurant reservation agent. You talk, it books. It can also reschedule or cancel existing reservations, all through natural conversation.
>
> Here's what's actually happening under the hood when you speak:
>
> Your voice streams over a WebSocket → gets transcribed by **Groq Whisper** → a **Llama-3.3-70B dialogue brain** figures out what you want, pulls up live availability from **Google Sheets**, places a tentative hold on **Google Calendar** → and **Sarvam TTS** speaks the confirmation back to you. All in roughly a second.
>
> But here's the part I'm most proud of — and it's the part most "I built a thing" posts skip:
>
> **I built an evaluation system before I shipped anything.**
>
> A golden test set of 26 cases grades the agent on four dimensions — did it understand the right intent? Did it capture every booking detail correctly? Does it hold up on messy, mumbled, real-world speech? And how fast is it?
>
> **v1 results:**
> 🎯 Intent accuracy: 100%
> 📊 Slot extraction: 100%
> 🔊 Noisy-speech robustness: 100% (confidence: 0.91)
> ⏱️ Median reasoning latency: 315ms (p95: 675ms)
>
> Honest caveat: 26 test cases is a solid start, not a final answer. The next milestone is 200+ cases with adversarial audio. But shipping with *any* structured evals puts you ahead of most demos out there.
>
> **Getting to ~1-second response time was its own engineering story.** I swapped the dialogue brain from Gemini to Groq's LPU inference, added a keyword fast-path so simple "yes" / "no" answers skip the LLM entirely, trimmed chat history to the last 4–6 turns, capped responses at 300 tokens, and compressed TTS output to MP3. Each of those shaved real milliseconds — the full teardown is in the carousel.
>
> I built this end-to-end as a way to pressure-test what "AI Product Management" actually means when there's no pretty UI to hide behind — just latency, cost, reliability, and whether the thing still works when someone mumbles with music in the background.
>
> 👉 **Try it live:** [your-app].onrender.com *(swap in your deployment link)*
>
> Full build teardown 👇 (swipe the carousel)
>
> **What would you put a voice on?** Drop it in the comments — I'm genuinely curious. 👇
>
> #AIProductManagement #VoiceAI #ProductManagement #LLM #MCP #BuildInPublic

*(The first two lines — "Picture this" + the Friday-evening scenario — are the only text visible before "…see more." That's your hook. Make them count.)*

---

## 🎴 The 8 Carousel Slides

---

### Slide 1 — The Hook

**I gave a restaurant a voice.**

*You talk. It books your table. ~1 second. No app. No forms.*

`Swipe → to see how I built it`

> **Visual direction:** Cream background with a single large plum headline. Center an amber mic-waveform graphic — think product-launch poster energy. Aim for ~10 words on screen. This slide's only job is to earn the swipe.

---

### Slide 2 — What It Actually Does

**One voice agent. Three jobs.**

| | Task | What happens |
|---|---|---|
| 🎙️ | **Book** a table | Captures date, time, occasion, and party size from natural speech |
| 🔁 | **Reschedule** a booking | Looks up your reservation code and moves it |
| ❌ | **Cancel** a booking | Confirms and removes the reservation |

**For a new booking, it listens for 4 things:**
📅 Date · ⏰ Time · 🍽️ Occasion · 👥 Number of guests

It understands sentences like *"a patio table for six this Saturday at seven-thirty"* — and it checks live availability before confirming.

> **Visual direction:** Top half = three task cards in a horizontal row (Book / Reschedule / Cancel). Bottom half = a 2×2 icon grid for the four captured slots. Generous whitespace, big headline.

---

### Slide 3 — How a Booking Happens (The Pipeline)

**Mic to speaker. One loop. Real time.**

```
🎙️ You speak into the mic
   ↓  audio streams over a WebSocket
👂 Groq Whisper transcribes your speech to text
   ↓
🧠 Llama-3.3-70B (on Groq) — the "dialogue brain"
     → identifies your intent
     → extracts booking details
     → decides what to say next
   ↓
🔧 MCP tools fire:
     📋 Google Sheets — logs the reservation
     📅 Google Calendar — places a tentative hold
   ↓
🗣️ Sarvam TTS converts the reply to spoken audio (MP3)
   ↓
🔊 You hear your confirmation — with a reservation code
```

> **Visual direction:** This is the hero slide — the one people screenshot. Vertical flow diagram with rounded amber and plum pill-shaped nodes, arrows between each stage. Labels should be small; the boxes should be big and clean.

---

### Slide 4 — The Full Tech Stack

**Everything under the hood, in one place.**

| Layer | What | Tool |
|---|---|---|
| 🖥️ | Frontend | Next.js 16 · React 19 · TypeScript · Tailwind |
| 👂 | Speech-to-text | Groq Whisper (`whisper-large-v3-turbo`) |
| 🧠 | Dialogue LLM | Groq · Llama-3.3-70B (JSON mode) |
| 🗣️ | Text-to-speech | Sarvam AI (`bulbul:v3`) |
| 🔧 | Backend integrations | Google Sheets + Google Calendar via MCP |
| 🔌 | Real-time transport | WebSocket (full-duplex, persistent connection) |
| ☁️ | Hosting | Render + UptimeRobot keep-alive |
| 🧪 | Evaluation | Custom Jest harness + golden test dataset |

> **Visual direction:** Clean two-column "stack card" layout — icon + label on the left, tool name on the right. This is the slide engineers save and share, so make it tidy and highly legible.

---

### Slide 5 — The Unsexy-but-Critical Stuff (Data & Ops)

**Where the bookings actually live — and why the agent doesn't fall asleep.**

**📋 Data layer (MCP integrations):**
- **Google Sheets** acts as the live reservation database — every booking, reschedule, and cancellation is logged here in real time.
- **Google Calendar** holds a tentative calendar event for each confirmed booking, so the restaurant sees it alongside their existing schedule.

**☁️ Ops reality:**
- The voice agent runs as **one persistent service on Render**. Why? A WebSocket connection needs a long-lived server — serverless platforms would drop the audio stream mid-sentence.
- **UptimeRobot pings the service every 10 minutes.** Render's free tier sleeps after 15 minutes of inactivity, which would cold-start the agent and kill live calls. A simple health-check ping keeps it warm — for $0.

> *Reliability isn't a feature you add later. It's a product decision you make on day one.*

> **Visual direction:** Two side-by-side mini-panels: "Data (MCP)" and "Ops (Render + UptimeRobot)." The one-liner takeaway sits in an amber banner at the bottom of the slide.

---

### Slide 6 — The Latency War (Tradeoffs I Actually Made)

**In a voice experience, silence is failure. So every slow part had to go.**

| What was slow | What I did about it |
|---|---|
| 🐌 Gemini's "thinking" mode added seconds to every turn | Moved the dialogue brain to **Groq (LPU inference)** — sub-second, no "thinking tax" |
| 🐌 An LLM call fired for *every* yes/no answer | Built a **keyword fast-path** — clear "yes" or "no" = zero LLM calls |
| 🐌 Full chat history sent with every prompt | **Trimmed to the last 4–6 turns** — enough context, way less latency |
| 🐌 Long replies generated heavy TTS audio | **Capped at 300 tokens** + switched to **MP3** (smaller file, faster playback) |
| 🎙️ Needed a fast, reliable STT with no daily quota | Chose **Groq Whisper** as primary; kept Gemini STT only as a fallback |

**The tradeoff, stated plainly:** Gemini generated slightly richer, more nuanced text. But Groq gave me **speed and a free tier that actually survives real traffic.** Gemini's free tier hit `429` rate limits at just 20 calls/day. For a voice experience where every millisecond of silence feels like the call dropped — **speed wins.**

> **Result: ~315ms median reasoning latency (p95: 675ms)**

> **Visual direction:** A two-column table with "🐌 Slow" on the left and "✅ Fix" on the right — big, readable rows. An amber callout bar for the tradeoff statement. A bold stat "pill" badge for the 315ms result. This will likely be the most-discussed slide — give it plenty of breathing room.

---

### Slide 7 — The Eval Scorecard

**"It felt good in the demo" is not a metric. So I graded it.**

Before shipping, I built a test harness (`npm run eval`) that runs 26 golden test cases against the live agent and scores it on four dimensions:

| Eval | What it actually checks | v1 Score |
|---|---|---|
| 🎯 **Intent Accuracy** | Does the agent correctly identify *what* the user wants — book, reschedule, or cancel? | **100%** (16/16) |
| 📊 **Slot Extraction** | Does it capture all four booking details correctly — date, time, occasion, guests? | **100%** (10/10) |
| 🔊 **Robustness** | Does it still work on messy, mumbled, real-speech inputs? | **100%** (3/3) · conf **0.91** |
| ⏱️ **Latency** | How fast is the dialogue reasoning step? | **p50: 315ms** · **p95: 675ms** |

**The honest caveat I'm keeping visible:** 26 cases is a meaningful start, not a proof of production-readiness. The next step is scaling to 200+ cases with adversarial audio inputs (background noise, accents, interruptions). But shipping with *any* structured evaluation framework puts you ahead of 90% of demo projects.

> **Visual direction:** Top section shows the four eval categories with one-line definitions. Bottom section is the scorecard as a clean, wide table with the Score column in bold. Keep the caveat visible on the slide — a PM audience will trust you *more* for acknowledging the sample size.

---

### Slide 8 — Three Lessons (and a Question for You)

**3 things no course or tutorial taught me:**

1. 🧩 **Own the pipeline, not just the prompt.**
   The biggest wins weren't in prompt engineering — they were architectural. Choosing where to route, what to skip, and when to bypass the LLM entirely.

2. 💸 **"Free tier" has an SLA of zero.**
   Your agent's reliability is a product decision, not a DevOps afterthought. If the free tier drops calls at 20 requests/day, that's not a bug — it's a constraint you need to design around.

3. 🧪 **Evals are the real roadmap.**
   Once you have a test harness, it *tells you* what to build next. The failing cases become your backlog.

---

**I put a voice on a restaurant.**
**What would you put a voice on?**

💬 Drop your idea in the comments · ♻️ Repost if "evals before shipping" resonates · ➕ Follow for the next build

> **Visual direction:** Three numbered lessons at the top with generous whitespace between them. The closing question is large and bold at the bottom, next to your headshot and handle. End on the question — not the brag.

---

## 📝 Posting Tips

- **Hook placement:** Only ~140 characters show before "…see more." The "Picture this" opening and Friday-evening scenario are engineered to be the hook — don't add anything before them.
- **Carousel = dwell time.** LinkedIn's algorithm rewards time-on-post; 8 swipes dramatically outperforms a single image.
- **Slide 6 (Latency War) is the engagement driver.** Conflict → resolution storytelling is the most-commented format on LinkedIn.
- **Real numbers + visible caveats = credibility** with technical and PM audiences. Don't hide the sample size.
- **One CTA, comment-first.** Asking "what would you build?" generates more engagement than asking for likes.
- **Hashtags:** 3–6 tags mixing broad reach (#ProductManagement) with niche discovery (#VoiceAI, #MCP).
- **Timing:** Post Tuesday–Thursday around 9 AM in your audience's timezone. Reply to every comment within the first 60 minutes.
- **Seed the thread:** Drop a first comment yourself — something like: *"The eval harness was honestly the biggest unlock in this whole project. Happy to share the test dataset structure if anyone's curious."*
