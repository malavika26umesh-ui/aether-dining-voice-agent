# Design System and Screen Specifications for Stitch

This document defines the **Amber Noir** design system and the target screens for Google's Stitch to create a high-fidelity visual prototype for the TableVoice Restaurant Reservation Web Application.

---

## 1. Design System & Theme

### Colors
- **Brand Colors:**
  - `primary`: `#121212` (Rich Obsidian / Dark Charcoal)
  - `primary-surface`: `#1A1A1A` (Charcoal surface for cards, boxes, fields)
  - `secondary`: `#FDFBF7` (Soft Ivory / Creamy White)
  - `accent`: `#D4AF37` (Brushed Gold / Satin Metallic Gold)
  - `accent-hover`: `#E5A93B` (Warm Amber Glow)
- **Status Colors:**
  - `success`: `#34C759` (Soft Green)
  - `warning`: `#FF9500` (Soft Orange)
  - `danger`: `#FF3B30` (Soft Red)

### Typography
- **Headings & Display:** `Playfair Display`, serif. (Used for elegant section titles, main hero message, and big prominent quotes).
- **Body & Controls:** `Inter`, sans-serif. (Used for chat text, dashboard tables, form elements, buttons, and system microcopy).

### Styling Aesthetics
- **Borders:** Thin, subtle borders (`1px solid rgba(212, 175, 55, 0.2)` or `rgba(253, 251, 247, 0.1)`).
- **Glassmorphism:** High backdrop blur (`backdrop-filter: blur(12px)`) with semi-transparent charcoal background (`rgba(26, 26, 26, 0.75)`).
- **Shadows:** Soft glow shadows around gold interactive elements rather than dark drop shadows.
- **Corners:** sharp minimalist corners or subtle 4px rounded edges to preserve the high-end premium aesthetic.

---

## 2. Component library

### Button Primary (Gold)
- **Background:** Gradient from `#D4AF37` to `#B89025`.
- **Text:** `#121212` (Dark Charcoal), bold, Inter font.
- **Hover:** Slight glow shadow with `#E5A93B`.

### Button Secondary (Outlined Gold)
- **Background:** Transparent.
- **Border:** `1px solid #D4AF37`.
- **Text:** `#D4AF37`, Inter font.

### Voice Visualizer Orb
- **Shape:** Soft circular organic blob with morphing animation.
- **Fill:** Radial gradient from `rgba(229, 169, 59, 0.4)` to `rgba(20, 20, 20, 0)`.
- **States:**
  - `Listening`: Pulsating slowly (radius 100px to 140px).
  - `Speaking`: Active ripple effect (multiple waves).
  - `Muted / Idle`: Static, thin outline.

---

## 3. Screen Inventory

### Screen 1: `landing_page`
**Description:** The customer-facing landing page of Aether Dining featuring an embedded voice booking widget.
- **Key Sections:**
  - **Header Navigation:** Sticky transparent nav containing logo ("AETHER"), page links, and "Book Table" CTA.
  - **Hero Hero:** High-contrast serif text over a dark background image of elegant table setting.
  - **TableVoice Widget (Floating, closed state):** Circular floating amber button at bottom right containing a microphone icon.
  - **TableVoice Widget (Open state overlay):** Glassmorphic chat box (360x600px) showing a simulated real-time booking conversation.

---

### Screen 2: `reservation_screen`
**Description:** Standalone full-screen reservation dashboard optimized for clean, hands-free voice booking.
- **Key Sections:**
  - **Left Half (Dialogue State):** Giant morphing Voice Orb indicator, current transcript bubbles, big question label: "Which dining occasion fits your visit?"
  - **Right Half (Real-time Hold Card):** Clear summaries of Occasion, Date, and Time. A 15-minute countdown clock showing table hold expiration.

---

### Screen 3: `confirmation_screen`
**Description:** A premium success screen designed to look like a digital dining pass containing the reservation code.
- **Key Elements:**
  - **Success Card:** Gold-notched glassmorphic ticket.
  - **Reservation Code:** Bold monospace `TABLE-R07` display.
  - **Instructions:** Bulleted list containing booking rules (e.g. 15-minute hold warning, check-in instructions).
  - **CTAs:** "Add to Google Calendar" button, "Return to Website" button.

---

### Screen 4: `admin_dashboard`
**Description:** Restaurant manager's web dashboard to check and modify bookings.
- **Key Sections:**
  - **Sidebar:** Navigation icons for Reservations, Table Map, Availability Settings.
  - **Header:** Today's date with stat indicators (e.g. 42 reservations, 84% capacity).
  - **Data Table:** Dynamic row table displaying the Sheets log columns.
  - **Availability Toggle Sidebar:** 5 switch toggles to instantly open/close availability per occasion group.
