# Foundations

All values are defined in [tokens.css](tokens.css). This document explains
why they are what they are and how to use them.

## Typography

| Role | Family | Why | Licence | Package (self-hosted) |
| --- | --- | --- | --- | --- |
| Editorial voice (titles, decks, article body) | **Newsreader** (Production Type) | A contemporary newspaper serif with an optical-size axis (6–72): sharp display cuts for headlines, sturdy text cuts for long reading | OFL 1.1 | `@fontsource-variable/newsreader` |
| Interface, console, tables | **IBM Plex Sans** | Institutional, engineered, excellent at small sizes and in dense UI; true italics; wide language coverage | OFL 1.1 | `@fontsource-variable/ibm-plex-sans` |
| Codes, IDs, dates, figures, board labels | **IBM Plex Mono** | Same skeleton as Plex Sans, so console and prose mix without friction; reads as "typewritten" on board cards | OFL 1.1 | `@fontsource/ibm-plex-mono` (400, 500, 600) |

Rules:

- Load only Latin + Latin Extended subsets (Italian and English need no
  more). Preload the Newsreader display cut and Plex Sans regular;
  `font-display: swap`. Never request fonts from a third-party CDN.
- **Optical size:** set `font-variation-settings: "opsz"` to 60–72 for
  display and H1, 16–24 for article text (the specimen shows both).
- **Figures:** `font-variant-numeric: tabular-nums` in tables, timeline
  dates, counts and KPI tiles; proportional old-style figures are allowed only
  in article prose.
- **Caps:** uppercase only for `--text-micro` mono kickers, with
  `--tracking-caps`. Never uppercase serif or full sentences.
- **Measure:** article and narrative text max `--measure` (66ch); console
  descriptions max 80ch.
- **Italian quotes and apostrophes:** typographic `’ « »` in Italian copy,
  `’ “ ”` in English (data text is rendered as stored).

### Scale

Fluid, 1.25 at 360 px to about 1.333 at 1440 px.

| Token | Size | Use |
| --- | --- | --- |
| `--text-display` | 40 → 76 px | Home lead headline only |
| `--text-3xl` | 32 → 54 px | Page H1 (Press) |
| `--text-2xl` | 26 → 38 px | Section H2, KPI figures |
| `--text-xl` | 21 → 28 px | Card titles, year markers, decks |
| `--text-lg` | 18 → 21 px | Ledes, H3 |
| `--text-read` | 17 → 19 px | Article body (serif) |
| `--text-base` | 16 px | UI body (sans) |
| `--text-sm` | 14 px | Tables, controls, nav |
| `--text-xs` | 12 px | Meta, captions, stamps |
| `--text-micro` | 11 px | Uppercase mono kickers only (never body text) |

Console H1 uses Plex Sans 600 at `--text-2xl`; Press H1 uses Newsreader 600
at `--text-3xl`. That single switch is what tells the reader which register
they are in.

## Colour

### Concept

- **Light = "Press":** warm newsprint (`#f7f4ee`), near-black ink, a
  ministry blue for links and actions, one brand red ("signal") for the
  masthead dot, live indicators, the active nav underline, drop caps and the
  hypothesis thread.
- **Dark = "Console":** blue-graphite night room (`#0f1217`), soft white ink,
  a lighter steel blue for actions, a warmer red for the signal. Not pure
  black: the room has light in it.
- **Red is scarce.** It is the colour of the red string and of attention. It
  is never used for an entity, a country, a relation group or "enemy".

### Semantic tokens

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--paper` | `#f7f4ee` | `#0f1217` | Page background |
| `--paper-raised` | `#fffdf9` | `#161b22` | Cards, panels, inputs |
| `--paper-sunken` | `#eee9df` | `#0a0d11` | Wells, segmented controls, map sea |
| `--ink` | `#15171b` | `#e8eaee` | Primary text, heavy rules, E1–E4 glyphs |
| `--ink-2` | `#3f444d` | `#b7bdc8` | Secondary text, decks |
| `--ink-3` | `#5c626c` | `#8d96a3` | Meta, captions, kickers |
| `--rule` | `#ddd6c9` | `#262d37` | Hairlines, borders |
| `--rule-strong` | `= ink` | `= ink` | Masthead and section rules |
| `--accent` | `#1f4e8f` | `#8db4ff` | Links, focus ring, primary buttons, selection |
| `--signal` | `#b3261e` | `#ff7366` | Brand red, live dot, E5 hypotheses |
| `--caution` / `-wash` | `#845400` / `#fbf0d9` | `#f2ba55` / `#33260e` | Needs review, notices |
| `--ok` / `-wash` | `#1e6b45` / `#e2f1e8` | `#5acb8e` / `#10291c` | Reviewed |
| `--fixture` / `-wash` | `#8b1a6b` / `#f7e6f2` | `#f08ad4` / `#331429` | DEMO / TEST fixtures only |

Measured contrast (run `node docs/design/scripts/check-contrast.mjs`):

| Pair | Light | Dark |
| --- | --- | --- |
| ink / paper | 16.35 | 15.58 |
| ink-2 / paper | 8.92 | 9.94 |
| ink-3 / paper (meta) | 5.60 | 6.28 |
| ink-3 / paper-sunken | 5.08 | 6.51 |
| accent / paper | 7.52 | 9.03 |
| signal / paper | 5.95 | 7.06 |
| caution / caution-wash | 5.71 | 8.38 |
| ok / ok-wash | 5.54 | 7.65 |
| fixture / fixture-wash | 7.14 | 7.30 |
| card-ink / card (board) | 15.09 | 12.75 |

### Data palettes

**Categorical — relation groups.** Fixed order, never cycled, never
reassigned by rank or by filter:

| Slot | Group | Light | Dark | Icon |
| --- | --- | --- | --- | --- |
| 1 | Security and intelligence | `#2a6fc9` | `#4f8be6` | `rel-security` |
| 2 | Control and direction | `#d2552b` | `#e0643a` | `rel-control` |
| 3 | Economy and dependencies | `#13996b` | `#1fa372` | `rel-economic` |
| 4 | Financing | `#c08000` | `#bf850c` | `rel-financial` |
| 5 | Influence and information | `#c8457e` | `#d4608f` | `rel-influence` |
| 6 | Institutional and regulatory | `#6250d6` | `#8a7fea` | `rel-institutional` |
| — | Event participation, context | `#8a8478` | `#7d8592` | `rel-participation`, `rel-context` |

Validation (dataviz validator, OKLab ΔE): all inside the lightness band,
chroma ≥ 0.1, worst adjacent CVD separation 8.0 (light) / 8.7 (dark),
normal-vision floor ≥ 18, all ≥ 3:1 on paper and on the dark board. On the
*light* cork the threads fall below 3:1, so every thread is drawn over a
dark translucent casing (`--thread-casing`) and the relation group is always
also given by icon + label in the legend and the case-file drawer.

Entity kinds deliberately get **no colour**: on the board they are distinct
card forms with an icon; elsewhere they are an icon + label. This keeps the
single categorical palette for relation groups and avoids two colour codes
competing in one view.

**Sequential — atlas.** One hue (ministry blue), `--seq-0` (zero, sits on
paper) to `--seq-5`; dark mode has its own steps, lighter = more. Buckets
stay as today (0, 1, 2–3, 4–7, 8+), with numeric labels in the legend.

**Status.** Reviewed (ok), needs review (caution), imported unreviewed and
pending integration (neutral), fixture (magenta, dashed). Status colours
always ship with icon + label and are never reused as data colours.

### Forbidden

- Red/green as the only distinction; colour as the only carrier of evidence,
  group or status.
- Country colours by "side" or hostility. Choropleths count events located in
  a country, nothing else.
- Raw hex values in components.

## Layout

- **Page widths:** `--page-max` 80 rem for Press pages, `--page-wide` 96 rem
  for console views (timeline, atlas, board use the full width below the
  masthead).
- **Grid:** 12 columns, gutter `--gutter` (16 → 32 px). Press article:
  centred 8-column text with a 3-column margin rail for "In the file" notes
  (collapses inline below 1180 px). Console: 3-column filter rail + 9-column
  canvas on desktop; filters become a bottom sheet below 900 px.
- **Breakpoints:** 480 (large phone), 760 (tablet), 1024 (laptop), 1280
  (desktop), 1536 (wide). Design mobile first; test at 320 px.
- **Touch targets:** at least 44 × 44 px on touch, 32 × 32 px with pointer.
- **Rules as structure.** Press uses rules instead of boxes: heavy 3 px rule
  above section titles, double rule under the masthead, hairlines between
  items. Console uses boxes (panels) and hairline dividers.

## Space, shape, elevation, texture

- **Space:** 4 px base scale `--space-1`…`--space-9` (4 → 96 px).
- **Radius:** 0 for editorial surfaces, 2 px for stamps and tags, 4 px for
  console controls and panels, 8 px for drawers and popovers, pill for
  segmented controls and chips.
- **Elevation is paper, not glow:** `--shadow-1` (resting), `--shadow-2`
  (hover/popover), `--shadow-card` and `--shadow-lifted` for board cards.
  Dark mode deepens shadows instead of adding light halos.
- **Texture:** only on the board (cork grain via CSS gradients, paper cards
  via SVG shapes). No noise or grain on Press or Console pages.

## Theming

- `data-theme="light" | "dark"` on `<html>`; absent means *system*.
  Choice persisted in `localStorage("oem-theme")`, applied by an inline
  script in `<head>` before first paint (no flash).
- `color-scheme: light dark` so form controls and scrollbars follow.
- `<meta name="theme-color">` for both schemes.
- Islands (Cytoscape/board, maps) read tokens with `getComputedStyle` and
  re-render on a `themechange` event dispatched by the theme switch, never
  from hard-coded hex.
- **Print:** Press styles print as a newspaper page: no nav, URLs after
  links in source lists, evidence stamps kept, board replaced by its list.

## Accessibility baseline (WCAG 2.2 AA)

- Contrast as measured above; focus ring 2 px `--accent` with 3 px offset,
  never removed.
- Landmarks (`header`, `nav`, `main`, `footer`), one H1, skip link styled and
  visible on focus.
- Every interactive canvas (board, maps) has a keyboard path and a text
  twin; `role="img"` only for non-interactive pictures.
- Icons are `aria-hidden` next to text; icon-only buttons have an accessible
  name and a tooltip.
- Respect `prefers-reduced-motion`, `prefers-contrast: more` (thicker rules,
  no washes) and `forced-colors` (patterns kept, hues dropped).
- `lang` on mixed-language fragments (Italian predicates on English pages).
- Target size 24 × 24 minimum (2.5.8), 44 on touch.
