# Ohio Real Estate Market Intelligence Platform — Design Ideas

<response>
<probability>0.07</probability>
<text>
## Idea A: "Data Terminal" — Industrial Dark Analytics

**Design Movement:** Brutalist Data Visualization meets Bloomberg Terminal

**Core Principles:**
1. Information density over decoration — every pixel earns its place
2. Monochrome base with single accent color (electric amber) for critical data
3. Grid-first layout with visible structure — data tables and charts as primary UI
4. Typography as hierarchy — numbers are the heroes

**Color Philosophy:**
- Background: near-black `#0D0F12` (not pure black — avoids harshness)
- Surface: `#161A1F` for cards
- Accent: `#F59E0B` (amber-500) for active states, KPIs, and CTAs
- Data positive: `#10B981` (emerald), negative: `#EF4444` (red)
- Text: `#E2E8F0` primary, `#64748B` secondary

**Layout Paradigm:**
- Full-width sidebar (240px) with icon+label nav
- Main content area with dense grid of metric cards
- Charts fill 60% of viewport — data is the hero
- Sticky header with live "last updated" timestamp

**Signature Elements:**
1. Monospace font for all numbers (JetBrains Mono)
2. Subtle scanline texture on hero sections
3. Amber glow on active chart elements

**Interaction Philosophy:** Click reveals more data, not animations. Hover shows exact values. Everything is filterable.

**Animation:** Minimal — only chart draw-on animations and number count-up transitions.

**Typography System:**
- Display: `Space Grotesk` 700 for headings
- Body: `Inter` 400/500 for labels
- Data: `JetBrains Mono` for all numeric values
</text>
</response>

<response>
<probability>0.08</probability>
<text>
## Idea B: "Ohio Blueprint" — Engineering Precision (CHOSEN)

**Design Movement:** Technical Blueprint meets Modern Data Science Dashboard

**Core Principles:**
1. Structured asymmetry — sidebar + main canvas, never centered hero
2. Blueprint grid as subtle background texture
3. Data visualizations as the primary visual language
4. Professional credibility through precision typography

**Color Philosophy:**
- Background: `#F8FAFC` (slate-50) — clean white with warmth
- Sidebar: `#0F172A` (slate-900) — deep navy for contrast
- Primary accent: `#1D4ED8` (blue-700) — Ohio state blue
- Secondary: `#0EA5E9` (sky-500) for charts and highlights
- Positive: `#059669`, Negative: `#DC2626`
- Card backgrounds: pure white with `shadow-sm`

**Layout Paradigm:**
- Fixed left sidebar (260px) with dark background — navigation hub
- Top metric bar with 4-6 KPI cards
- Main content: 2-3 column responsive grid
- Charts span full width in dedicated sections
- Map takes 50% of county explorer view

**Signature Elements:**
1. Blueprint-style grid lines as subtle page texture
2. County outline SVG as hero graphic
3. Data badges with color-coded market health indicators

**Interaction Philosophy:** Progressive disclosure — overview → drill-down → detail. Filters update all charts simultaneously.

**Animation:** Framer Motion slide-in for sidebar items, chart transitions on filter change, number animations on KPI load.

**Typography System:**
- Display: `DM Sans` 700/800 for headings
- Body: `DM Sans` 400/500 for UI text
- Data: `IBM Plex Mono` for all numeric values and codes
</text>
</response>

<response>
<probability>0.05</probability>
<text>
## Idea C: "Market Pulse" — Warm Editorial

**Design Movement:** Financial Times meets Airbnb — editorial warmth with data precision

**Core Principles:**
1. Warm neutrals as base — feels approachable, not cold
2. Large typographic hierarchy — section titles are editorial
3. Cards with generous padding and subtle borders
4. Charts integrated into narrative flow

**Color Philosophy:**
- Background: `#FAFAF8` (warm white)
- Accent: `#B45309` (amber-700) — warm authority
- Charts: Earthy palette (terracotta, sage, slate)
- Text: `#1C1917` (stone-900)

**Layout Paradigm:**
- Top navigation bar (no sidebar)
- Full-width hero with Ohio map
- Scrollable dashboard sections
- Editorial-style section breaks

**Signature Elements:**
1. Large pull-quote statistics
2. Newspaper-style column layouts for market summaries
3. Warm gradient overlays on map

**Typography System:**
- Display: `Playfair Display` for editorial headings
- Body: `Source Sans 3` for data and UI
- Data: `Roboto Mono` for numbers
</text>
</response>

---

## Selected Design: **Idea B — "Ohio Blueprint"**

The Blueprint design is chosen because it best serves a data science portfolio:
- The dark sidebar + light main canvas is the industry standard for analytics tools (Tableau, Looker, Grafana)
- Ohio state blue creates immediate geographic identity
- IBM Plex Mono for numbers signals technical credibility
- The asymmetric layout prevents the "AI slop" centered-layout trap
- Blueprint grid texture adds craft without distracting from data
