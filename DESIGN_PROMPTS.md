# Stitch by Google: Screen Design Prompts

This document contains detailed prompts for **Stitch by Google** to generate the UI designs for **TableVoice** (the voice agent) and its hosting website, **Aether Dining** (a luxury modern bistro). 

The visual style is designed to feel premium, sensory, and highly polished, using an **Amber Noir** design system.

---

## Design System Configuration Reference

Before running the screen prompts, ensure Stitch uses these tokens:
- **Fonts:** `Playfair Display` (Headings, elegant serif) and `Inter` (Body, UI, Clean sans-serif).
- **Color Palette:**
  - `Dark / Background`: `#121212` (Rich Obsidian), `#1A1A1A` (Charcoal)
  - `Accent / Interactive`: `#D4AF37` (Brushed Gold), `#E5A93B` (Warm Amber)
  - `Light / Surfaces`: `#FDFBF7` (Soft Ivory), `#F5F2EB` (Warm Cream)
  - `Text`: Light on Dark (`#FDFBF7`), Dark on Light (`#121212`)
- **Theme Aesthetics:** High contrast, glassmorphism (`backdrop-filter: blur`), subtle gold accents, thin borders, generous whitespace.

---

## Screen 1: Restaurant Landing Page with Embedded Agent Widget

### Prompt for Stitch:
```text
Create a premium, elegant landing page for a modern luxury bistro named "Aether Dining". 
The design should use the Amber Noir theme: deep obsidian charcoal background (#121212), soft ivory body text (#FDFBF7), and brushed gold accents (#D4AF37).

Layout Sections:
1. Navigation Bar: Transparent header with minimalist logo "AETHER", links (Menu, Experience, About), and a gold outlined button "Reserve Table".
2. Hero Section: Elegant typography reading "Artisanal Cuisine, Crafted for the Senses" in Playfair Display. Background is a dark, moody, blurred image of a candle-lit dining table. A call-to-action button "Explore the Menu" (brushed gold background) is centered.
3. Embedded Voice Agent Floating Widget (Bottom Right):
   - Positioned fixed in the bottom right corner of the page.
   - Initial state: A floating gold-gradient circular button with a glowing microphone icon and a small tooltip bubble that reads: "Reserve with Voice (No Forms)".
   - Open state: A compact, modern glassmorphic chat card (360x600px) with backdrop blur, thin gold border, and gold-tinted title "TableVoice Assistant".
   - Inside the widget: A large pulsating gold audio wave visualization in the center, a text sub-label "Listening... Speak now", a live transcript bubble showing: "User: I'd like a table for two this Saturday," and a text-input fallback field at the bottom.
```

---

## Screen 2: Standalone Voice Reservation Page (Full Screen)

### Prompt for Stitch:
```text
Design a full-screen, highly immersive standalone reservation experience for a customer booking via voice. 

Layout Sections:
1. Left Panel (2/3 width) - Voice Interface:
   - Centered giant voice activity sphere: A morphing, glowing amber-and-gold gradient organic orb that animates to represent voice activity.
   - Text prompts in elegant Playfair Display typography: "Where would you like to sit? Standard, Outdoor, or Bar?"
   - Live transcription stream showing the conversation history as text bubbles:
     * Agent: "Hello! Welcome to Aether Dining. What occasion are we celebrating?" (White text, dark grey bubble)
     * User: "It's my wedding anniversary." (Amber text, transparent bubble with gold outline)
   - Visual controls: Large mute/unmute microphone button, a "Keyboard Fallback" toggle, and a "Exit to Homepage" link.
2. Right Panel (1/3 width) - Real-time Hold Summary:
   - A dark charcoal card with a gold border that displays the reservation details as the voice agent captures them in real time.
   - Fields: 
     * Occasion: "Anniversary / Special Occasion" (with an elegant ring/candle icon)
     * Date: "Saturday, June 14, 2026"
     * Time: "7:00 PM IST"
     * Status: "Tentative Hold (15m remaining)"
   - Footer note: "Privacy-Safe Booking: No personal details or contact info collected."
```

---

## Screen 3: Booking Confirmation Screen (Success State)

### Prompt for Stitch:
```text
Design the Booking Confirmation screen that is shown when the user completes their voice reservation. This should look like a premium digital ticket.

Layout Components:
1. Centered Glassmorphic Ticket / Card:
   - Backdrop blur on a dark charcoal surface, surrounded by a thin golden border with notched corners (ticket style).
   - Top Header: A sleek, animated gold checkmark inside a gold circular outline. Elegant text: "Your Table is Held".
   - Large Reservation Code Display: "TABLE-R07" rendered in a bold, stylized monospace font (brushed gold color) with a copy icon next to it.
   - Ticket Details Grid:
     * Occasion: Special Occasion
     * Date: Saturday, June 14, 2026
     * Time: 7:00 PM IST (Table held until 7:15 PM)
     * Seating Area: Special Section
   - Action Buttons:
     * "Add to Google Calendar" (Elegant gold-border button)
     * "Return to Website" (Minimal link)
   - Bottom Notice: "Simply show this code to the host upon arrival. No name or phone number needed. We look forward to welcoming you."
```

---

## Screen 4: Restaurant Admin Reservation Dashboard

### Prompt for Stitch:
```text
Create a modern, clean Web Admin Dashboard for the restaurant managers of "Aether Dining" to view voice bookings. The theme should be a clean, high-contrast light theme variant: cream/soft ivory background (#FDFBF7) with dark charcoal text (#121212) and amber/gold details.

Layout Components:
1. Left Navigation Sidebar: Links for Dashboard, Calendar, Sheet Log, Availability Rules, and Settings.
2. Main Content Area:
   - Header: "Aether Dining Manager Portal" with date selector showing "Today: June 14, 2026" and a quick search bar.
   - Top Stat Cards (3 grid items):
     * Total Bookings: "42" (with "+12 today" in green text)
     * Occupancy Rate: "84%"
     * Average Booking Time: "64 seconds"
   - Active Bookings Table: Columns for [Timestamp, Reservation Code, Date, Time (IST), Occasion, Party Size, Status (Confirmed / Cancelled / Rescheduled), Actions].
     * Example Row 1: "19:15 | TABLE-R07 | 2026-06-14 | 19:00 | Special Occasion | 2 | CONFIRMED"
     * Example Row 2: "18:45 | TABLE-B12 | 2026-06-14 | 20:30 | Outdoor/Patio | 4 | CONFIRMED"
   - Availability Controller Panel: A sidebar widget displaying toggles for the 5 Dining Occasions to quickly open/close slots for the day (e.g. toggle "Outdoor/Patio" slots to Closed due to weather).
```
