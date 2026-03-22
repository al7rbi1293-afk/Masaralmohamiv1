# Design System Specification: Masar Al-Muhami (مسار المحامي)

## 1. Overview & Creative North Star: "The Digital Diwan"

The creative North Star for this design system is **"The Digital Diwan."** In Saudi culture, the Diwan represents a space of authority, high-level council, and structured elegance. This system moves away from the "SaaS dashboard" aesthetic toward a "Digital Executive Suite." 

We break the generic grid through **Intentional Asymmetry**. By utilizing a luxurious Spacing Scale and high-contrast typography, we create an editorial feel. Layouts should prioritize large, breathable margins and overlapping elements (e.g., a card bleeding into a header background) to convey a sense of bespoke craftsmanship rather than a rigid template.

---

## 2. Colors: Tonal Authority

The palette is rooted in Deep Emerald and Dark Teal, accented by the warmth of Sand and Gold. This creates a psychological environment of trust and heritage.

### Core Token Strategy
*   **Primary (`#003527`):** Use for high-authority actions and deep semantic meaning.
*   **Primary Container (`#064E3B`):** The signature Emerald. Use for large header blocks and key navigation elements.
*   **Tertiary/Gold (`#D4AF37` / `tertiary`):** Reserved strictly for "Success" states, premium features, or subtle calligraphic accents.
*   **The "No-Line" Rule:** 1px solid borders are strictly prohibited for sectioning. Boundaries must be defined solely through background color shifts. For example, a `surface-container-low` side-panel must sit against a `surface` main content area without a line separating them.
*   **Signature Textures:** Apply subtle linear gradients (Primary to Primary-Container) on major CTA buttons and card backgrounds to provide a sense of depth and "soul" that flat colors lack.

---

## 3. Typography: Editorial Hierarchy

For Masar Al-Muhami, typography is the primary vehicle for authority. The system uses **Manrope** for numbers and English headings, and **IBM Plex Sans Arabic** for all Arabic text.

*   **Display-LG (3.5rem):** Used for large executive summaries and "Hero" welcome states.
*   **Headline-MD (1.75rem):** Used for legal case titles. Bold, authoritative, and spacious.
*   **Title-SM (1rem):** The workhorse for list headers and card titles.
*   **Body-MD (0.875rem):** Primary reading size. Line height should be generous (1.6x) to ensure legibility in complex legal texts.
*   **RTL Optimization:** Typography must be perfectly balanced. In Arabic, ensure that "leading" is slightly increased compared to Latin counterparts to accommodate long ascenders and descenders in the script.

---

## 4. Elevation & Depth: Tonal Layering

We move away from the "shadow-heavy" look of 2010s UI. Hierarchy is achieved through the **Layering Principle**.

*   **Surface Hierarchy:** 
    *   `surface` (Base Layer)
    *   `surface-container-low` (Secondary sections/sidebars)
    *   `surface-container-lowest` (Interactive cards)
*   **The "Ghost Border" Fallback:** If a border is required for accessibility, use the `outline-variant` token at **15% opacity**. Never use 100% opaque borders.
*   **Ambient Shadows:** For floating elements (Modals, Popovers), use a multi-layered shadow:
    *   `0px 4px 20px rgba(31, 41, 55, 0.04)` (Charcoal tinted)
    *   `0px 12px 40px rgba(31, 41, 55, 0.08)`
*   **Glassmorphism:** For top navigation bars or mobile action sheets, use a semi-transparent `surface-container-lowest` with a `backdrop-blur` of 12px. This creates a "frosted glass" effect that allows brand colors to bleed through.

---

## 5. Components: Executive Refinement

### Buttons
*   **Primary:** Background: `primary-container`, Text: `on-primary`. Corner radius: `lg` (0.5rem). Use a subtle top-to-bottom gradient.
*   **Tertiary (Gold):** Background: Transparent, Border: None, Text: `tertiary`. Used for "Add New" or "Upgrade" actions.

### Elegant Cards
*   **Style:** No borders. Background: `surface-container-lowest`. 
*   **Padding:** Use `spacing-6` (2rem) for internal content to maintain the "Editorial" feel.
*   **Interactions:** On hover, the card should lift using an ambient shadow rather than changing color.

### Refined Status Chips
*   Instead of high-contrast "Traffic Light" colors, use tonal variants:
    *   *Active:* `primary-fixed` background with `on-primary-fixed` text.
    *   *Pending:* `tertiary-fixed` background with `on-tertiary-fixed` text.
*   **Shape:** `full` (9999px) for a soft, modern pill shape.

### Input Fields
*   **Visual Style:** Understated. Background: `surface-container-low`. Label: `label-md` in `on-surface-variant`.
*   **Interaction:** On focus, the bottom border animates to `primary` color. Avoid boxing the entire input in a high-contrast border.

---

## 6. Do’s and Don’ts

### Do:
*   **Use White Space as a Separator:** Leverage the Spacing Scale (e.g., `spacing-8` or `spacing-12`) to separate major functional blocks.
*   **RTL First:** Always design from right-to-left. Ensure that icons (like "Chevron-Left" for "Next") are mirrored to point right-to-left.
*   **Incorporate the Logo Geometry:** Use the arch and column motifs from the logo (IMAGE_1) as subtle watermark backgrounds or as inspiration for icon framing.

### Don’t:
*   **Don't Use Divider Lines:** Never use a 1px line to separate cases in a list. Use `surface-container` shifts or vertical padding.
*   **Don't Use Generic Icons:** Avoid "gavel" or "scales" icons for every action. Use abstract, high-end iconography that focuses on "Process" and "Pathways" (Masar).
*   **Don't Overuse Gold:** Gold is for prestige, not for utility. Overusing `#D4AF37` will cheapen the brand; keep it for highlights and accents only.