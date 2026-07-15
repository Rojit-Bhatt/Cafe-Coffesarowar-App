---
name: Stampd Core
colors:
  surface: '#fff8f6'
  surface-dim: '#e2d8d4'
  surface-bright: '#fff8f6'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#fcf1ed'
  surface-container: '#f6ece8'
  surface-container-high: '#f0e6e2'
  surface-container-highest: '#ebe0dc'
  on-surface: '#1f1b18'
  on-surface-variant: '#51443e'
  inverse-surface: '#352f2d'
  inverse-on-surface: '#f9efeb'
  outline: '#83746d'
  outline-variant: '#d5c3ba'
  surface-tint: '#80543c'
  primary: '#71472f'
  on-primary: '#ffffff'
  primary-container: '#8c5e45'
  on-primary-container: '#ffe4d7'
  inverse-primary: '#f4ba9c'
  secondary: '#5f5e5c'
  on-secondary: '#ffffff'
  secondary-container: '#e2dfdc'
  on-secondary-container: '#636260'
  tertiary: '#55504c'
  on-tertiary: '#ffffff'
  tertiary-container: '#6e6864'
  on-tertiary-container: '#f0e8e3'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdbca'
  primary-fixed-dim: '#f4ba9c'
  on-primary-fixed: '#311302'
  on-primary-fixed-variant: '#653d26'
  secondary-fixed: '#e5e2df'
  secondary-fixed-dim: '#c8c6c3'
  on-secondary-fixed: '#1c1c1a'
  on-secondary-fixed-variant: '#474745'
  tertiary-fixed: '#e9e1dc'
  tertiary-fixed-dim: '#cdc5c0'
  on-tertiary-fixed: '#1e1b18'
  on-tertiary-fixed-variant: '#4b4642'
  background: '#fff8f6'
  on-background: '#1f1b18'
  surface-variant: '#ebe0dc'
typography:
  display-lg:
    fontFamily: Libre Caslon Text
    fontSize: 48px
    fontWeight: '400'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  display-md:
    fontFamily: Libre Caslon Text
    fontSize: 36px
    fontWeight: '400'
    lineHeight: '1.2'
  headline-lg:
    fontFamily: Libre Caslon Text
    fontSize: 32px
    fontWeight: '400'
    lineHeight: '1.3'
  headline-lg-mobile:
    fontFamily: Libre Caslon Text
    fontSize: 28px
    fontWeight: '400'
    lineHeight: '1.3'
  headline-sm:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: '1.4'
    letterSpacing: -0.01em
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
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1.4'
    letterSpacing: 0.02em
  caption:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: '1.4'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 8px
  sm: 16px
  md: 24px
  lg: 48px
  xl: 80px
  container-max: 1280px
  gutter: 24px
---

## Brand & Style

The design system is a high-fidelity, white-label framework designed to balance editorial sophistication with functional utility. It targets high-end service providers and merchants who require a platform that feels bespoke yet systematically robust. 

The aesthetic is **Modern Minimalist with Tactile Editorial influences**. It avoids clinical coldness by using organic shapes, generous whitespace, and a high-contrast typographic hierarchy. The motion language is central to the identity, utilizing "stamp-claim" physics—interactions should feel weighted, energetic, and celebratory, featuring subtle squash-and-stretch transitions to reward user actions.

## Colors

This design system employs a white-label color strategy. The foundation is built on a neutral spectrum of warm whites, architectural grays, and deep charcoal. 

- **Primary Accent:** A single token (initially `#8C5E45`) is reserved for critical brand-specific highlights. This should be used for primary call-to-actions, active navigation states, and progress indicators.
- **Neutral Palette:** High-end grays with a slight warmth to prevent a "dead" screen feel. 
- **Functional Colors:** Success, warning, and error states should maintain low saturation to stay consistent with the premium aesthetic, relying on iconography as much as color.

## Typography

The typographic system relies on a deliberate contrast between the classic, authoritative **Libre Caslon Text** for headings and the neutral, systematic **Inter** for utility and body text.

- **Headlines:** Use Serif for all display and large headings to evoke a sense of tradition and high-end craft.
- **Body & UI:** Use Sans-serif for readability and density management in admin consoles and customer data lists.
- **Rhythm:** Maintain a strict 4px baseline grid to ensure vertical rhythm across both serif and sans-serif pairings.

## Layout & Spacing

This design system uses a **Fluid Grid** model for mobile customers and a **Fixed Sidebar / Fluid Content** model for desktop admin views.

- **Customer App (Mobile):** 4-column grid with 16px margins. Use generous vertical padding (`spacing.lg`) between sections to create an editorial feel.
- **Admin Console (Desktop):** 12-column grid. The sidebar is fixed at 280px, while the main content area utilizes a max-width of 1280px for readability.
- **Spacing Rhythm:** Use the 8pt scale for internal component spacing, but lean toward larger increments (`spacing.xl`) for layout transitions to maintain the premium, airy aesthetic.

## Elevation & Depth

Hierarchy is established through **Ambient Shadows** and **Tonal Layering** rather than heavy lines.

- **Surfaces:** Use subtle shifts in background color (e.g., White to Soft Gray) to define content areas.
- **Shadows:** Shadows are extremely diffused with a low-opacity primary-tinted color (e.g., `rgba(140, 94, 69, 0.08)`). This keeps the UI feeling light and integrated with the brand.
- **The "Stamp" Effect:** When a user interacts with a card or button, it should visually "lift" on hover (increased shadow spread) and "press" on click (shadow removal and slight scale down).

## Shapes

The shape language is **Organic and Rounded**. 

- **Primary Radius:** Use `0.5rem` (8px) for standard components like input fields and buttons.
- **Large Components:** Use `1.5rem` (24px) for main containers and cards to create a softer, more approachable feel.
- **Celebratory Elements:** Reward badges or "stamps" should be fully circular to distinguish them from standard UI components.

## Components

### Buttons
- **Primary:** Solid background using the primary accent color. Use high-contrast white or near-black text. Motion: Subtle squash-and-stretch on click.
- **Secondary:** Transparent background with a 1px soft-gray border. 
- **Shape:** Softly rounded (8px) or pill-shaped depending on the context of the container.

### Cards
- **Style:** Background white, 24px corner radius, and a very soft ambient shadow.
- **Padding:** Minimum 24px internal padding to maintain the editorial feel.

### Input Fields
- **Style:** Minimalist. Use a subtle background fill instead of a heavy border. Labels should use the `label-md` token (uppercase Inter) for a professional look.

### Chips & Badges
- **Style:** Low-profile, using the secondary neutral color for backgrounds. 
- **Typography:** Bold `caption` style to ensure legibility at small sizes.

### Celebration (The Stamp)
- A specialized component used for "claim" events. This component must utilize an energetic animation—scaling from 0 to 1.1 then settling at 1.0 with a soft bounce, mimicking a physical stamp being pressed onto paper.