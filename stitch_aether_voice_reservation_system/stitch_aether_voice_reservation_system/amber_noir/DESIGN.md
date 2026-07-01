---
name: Amber Noir
colors:
  surface: '#16130b'
  surface-dim: '#16130b'
  surface-bright: '#3d392f'
  surface-container-lowest: '#110e07'
  surface-container-low: '#1f1b13'
  surface-container: '#231f17'
  surface-container-high: '#2d2a21'
  surface-container-highest: '#38342b'
  on-surface: '#eae1d4'
  on-surface-variant: '#d0c5af'
  inverse-surface: '#eae1d4'
  inverse-on-surface: '#343027'
  outline: '#99907c'
  outline-variant: '#4d4635'
  surface-tint: '#e9c349'
  primary: '#f2ca50'
  on-primary: '#3c2f00'
  primary-container: '#d4af37'
  on-primary-container: '#554300'
  inverse-primary: '#735c00'
  secondary: '#c8c6c5'
  on-secondary: '#313030'
  secondary-container: '#4a4949'
  on-secondary-container: '#bab8b7'
  tertiary: '#d0cecb'
  on-tertiary: '#30312e'
  tertiary-container: '#b4b3af'
  on-tertiary-container: '#454543'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffe088'
  primary-fixed-dim: '#e9c349'
  on-primary-fixed: '#241a00'
  on-primary-fixed-variant: '#574500'
  secondary-fixed: '#e5e2e1'
  secondary-fixed-dim: '#c8c6c5'
  on-secondary-fixed: '#1c1b1b'
  on-secondary-fixed-variant: '#474646'
  tertiary-fixed: '#e4e2de'
  tertiary-fixed-dim: '#c8c6c3'
  on-tertiary-fixed: '#1b1c1a'
  on-tertiary-fixed-variant: '#474744'
  background: '#16130b'
  on-background: '#eae1d4'
  surface-variant: '#38342b'
  obsidian: '#121212'
  charcoal: '#1A1A1A'
  soft-ivory: '#FDFBF7'
  brushed-gold: '#D4AF37'
  warm-amber: '#E5A93B'
  success: '#34C759'
  warning: '#FF9500'
  danger: '#FF3B30'
typography:
  display-lg:
    fontFamily: Playfair Display
    fontSize: 64px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Playfair Display
    fontSize: 40px
    fontWeight: '700'
    lineHeight: '1.2'
  headline-xl:
    fontFamily: Playfair Display
    fontSize: 48px
    fontWeight: '600'
    lineHeight: '1.2'
  headline-lg:
    fontFamily: Playfair Display
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.3'
  headline-md:
    fontFamily: Playfair Display
    fontSize: 24px
    fontWeight: '500'
    lineHeight: '1.4'
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  label-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1'
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  container-max: 1280px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 64px
  section-gap: 120px
---

# Design System: Amber Noir

This system defines the visual language for the Aether Dining platform, characterized by luxury, high contrast, and glassmorphism.

## 1. Visual Identity
- **Personality:** Premium, Mysterious, Artisanal, Elegant.
- **Aesthetic:** Dark "Obsidian" themes for customer-facing screens; Light "Soft Ivory" theme for admin interfaces. High-end glassmorphism, brushed gold accents, and generous whitespace.

## 2. Color Palette
- **Primary (Obsidian):** `#121212` (Main background for dark theme)
- **Surface (Charcoal):** `#1A1A1A` (Cards and containers for dark theme)
- **Secondary (Soft Ivory):** `#FDFBF7` (Main background for light theme, body text for dark theme)
- **Accent (Brushed Gold):** `#D4AF37` (Interactive elements, highlights)
- **Accent Hover (Warm Amber):** `#E5A93B` (Interactive hover states)
- **Status (Success/Warning/Danger):** `#34C759`, `#FF9500`, `#FF3B30`

## 3. Typography
- **Headings & Display:** `Playfair Display`, serif.
- **Body & UI:** `Inter`, sans-serif.

## 4. Components & Styling
- **Glassmorphism:** `backdrop-filter: blur(12px); background: rgba(26, 26, 26, 0.75); border: 1px solid rgba(212, 175, 55, 0.2);`
- **Buttons:**
  - *Primary (Gold):* Background gradient `#D4AF37` to `#B89025`, text `#121212`, bold Inter.
  - *Secondary (Outlined):* Transparent background, `1px solid #D4AF37`, text `#D4AF37`.
- **Corners:** 4px subtle rounding or sharp minimalist corners.
- **Shadows:** Soft amber glow shadows for interactive elements.
