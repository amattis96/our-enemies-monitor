# UI/UX audit — 2026-11-12

Audit of the portal as built from `main` at `e7bfd96` (M2–M6 MVP styling),
inspected in the browser at 1280 px and 375 px, plus a read of
`web/src/` (layout, pages, islands, `global.css`). Measurements were taken
with scripts in the browser, not estimated.

Severity: **S1** blocks a core task or fails WCAG AA · **S2** significant
friction or inconsistency · **S3** polish.

## Summary

The MVP is honest, fast, static and structurally sound: semantic HTML, a
skip link, `aria-current`, `hreflang` alternates, text twins for the graph
and maps, a publication gate. Its weaknesses are presentation and
navigation: no visual identity, a flat 12-item navigation that dominates
mobile screens, a graph that is hard to read, two small static maps,
an oldest-first timeline, no dark mode, and evidence levels rendered as
indistinct grey badges. The evidentiary discipline exists in the data and
copy but is not *visible* as a design language.

## Findings

### Identity and visual language

| # | Sev | Finding | Recommendation |
| --- | --- | --- | --- |
| A1 | S2 | No identity: system font, generic blue links, plain bordered cards; `global.css` itself says "Functional MVP styling". | Adopt Dossier ([FOUNDATIONS.md](FOUNDATIONS.md)). |
| A2 | S2 | The favicon (three dots in a triangle on blue) is the only brand element; no wordmark, masthead, social image or `theme-color`. | Lens mark, favicon set, masthead, OG images ([BRAND_AND_ICONS.md](BRAND_AND_ICONS.md)). |
| A3 | S2 | No iconography: sections, entity kinds, relation groups and themes are text-only, so long lists are hard to scan. | Project icon set (`icons.svg`), paired with labels. |
| A4 | S3 | Typographic hierarchy is shallow (H1 28 px, H2 20 px, same face everywhere); editorial and data pages feel identical. | Press (serif) vs Console (sans/mono) registers. |

### Navigation and information architecture

| # | Sev | Finding | Recommendation |
| --- | --- | --- | --- |
| N1 | S1 | On a 375 px phone the header is **312 px tall** (38 % of the viewport): 12 links stack in a column before any content. | Compact header + menu sheet; console tab bar ([COMPONENTS.md](COMPONENTS.md#3-masthead-and-navigation)). |
| N2 | S1 | Header links are **17 px tall** on mobile, below the WCAG 2.2 target size of 24 × 24 (2.5.8) and far from 44 px touch guidance. | 44 px rows in the sheet; 32 px+ targets in the bar. |
| N3 | S2 | Flat list of 12 equal-weight items mixes reading, exploring and project-maintenance pages (Data, Changes). | Three areas: Observatory, Investigations, Explore (+ Method secondary) ([CONCEPT.md](CONCEPT.md#information-architecture)). |
| N4 | S2 | The language switch is a bare "English"/"Italiano" link at the far right, easy to miss, and not an obvious toggle. | `IT | EN` segmented `LanguagePicker`. |
| N5 | S2 | Search is a separate page with the default Pagefind UI; no global shortcut, no search field in the header. | ⌘K command palette via the Pagefind API; header trigger. |
| N6 | S3 | Home is ten identical cards; no editorial entry point, no "latest", no explanation of how to read evidence. | Front-page home ([PAGES.md](PAGES.md#home--osservatorio-press)). |

### Timeline

| # | Sev | Finding | Recommendation |
| --- | --- | --- | --- |
| T1 | S2 | Ordered **oldest first** (first section 2007); recent events — the most relevant to an observatory — are at the bottom of a 147-item page. | Newest first by default, toggle for oldest first. |
| T2 | S2 | Period filter is two `<select>`s; no overview of where events concentrate. | Density bar as scrubber and range filter. |
| T3 | S3 | Date precision is only in a `title` attribute (hover-only, invisible on touch and to many screen readers). | `DateWithPrecision` with visible cue + text. |
| T4 | S3 | No evidence level or theme icon on items; pending (EXT) items differ only by a grey badge. | Stamp + theme chips; dashed pending items. |
| T5 | S3 | Filters are not reflected in the URL beyond `?tema=`. | Sync all filters to the query string. |

### Network graph

| # | Sev | Finding | Recommendation |
| --- | --- | --- | --- |
| G1 | S1 | Node labels are **9 px** and edge labels absent; at the default zoom the graph is an unreadable hairball (desktop) and starts **1,253 px down the page** on mobile (after the filter rail). | Board with semantic zoom; canvas first on mobile, filters in a sheet ([PAGES.md](PAGES.md#evidence-board--bacheca-network-evidence-mode)). |
| G2 | S2 | Evidence level is encoded by line style at 1.5 px, practically indistinguishable; relation group and entity kind both use colour in the same view (two competing colour codes, some hues shared). | Thread patterns at 2–3 px with casing; kinds by card form + icon, colour only for relation groups. |
| G3 | S2 | Colours are hard-coded hex in `NetworkExplorer.tsx` (`GROUP_COLORS`, `KIND_COLORS`) and a white canvas: impossible to theme. | Read tokens; re-render on `themechange`. |
| G4 | S2 | Layout is recomputed on every filter change (`cose`, random), so the picture jumps and is never the same twice. | Build-time seeded layout; filters hide/show without relayout. |
| G5 | S3 | Selection opens a small card in the left rail, far from the clicked node; the text list is collapsed in a `<details>`. | Case-file drawer next to the board; List view as an equal toggle. |

### Atlas

| # | Sev | Finding | Recommendation |
| --- | --- | --- | --- |
| M1 | S2 | Two small static maps side by side; no zoom, no labels, no country selection besides hash links; Europe is cramped at half width. | One map, Europe ↔ World, zoom, selection panel ([PAGES.md](PAGES.md#atlas--atlante-console)). |
| M2 | S2 | Map colours hard-coded (`#f7f9fc`, white strokes, bucket colours in `lib/map.ts`). | Sequential tokens per theme. |
| M3 | S3 | The 45 supranational/maritime events appear only as a number in the intro. | "Outside the map" tray with counts. |
| M4 | S3 | The country table is long and unsorted beyond name; details hidden in `<details>`. | Sortable, searchable `DataTable`; panel for details. |

### Content pages and components

| # | Sev | Finding | Recommendation |
| --- | --- | --- | --- |
| C1 | S2 | Evidence badges are grey mono boxes (`EvidenceBadge`) indistinguishable across levels except by the code; the label is only in a `title`. | `EvidenceStamp` with glyph, code and short label. |
| C2 | S2 | Tables overflow on mobile: on an event page the two relationship tables are **430 and 466 px wide in a 343 px column** (horizontal scroll, columns of 1–2 words). | Stacked-row tables below 760 px. |
| C3 | S3 | Notices (disclaimer, limits, translation) share one amber box style, so warnings, explanations and status look alike. | `Callout` variants + `LimitsNote` with illustrations. |
| C4 | S3 | Dependencies cards are text-dense; the bar is small and the denominator is in small meta text. | `ExposureMeter` with value and denominator in words. |
| C5 | S3 | Record footers and source references are plain lists; no copy/cite affordances. | `RecordFooter`, `Citation`, copy buttons. |

### Theming, accessibility, responsiveness

| # | Sev | Finding | Recommendation |
| --- | --- | --- | --- |
| X1 | S2 | No dark theme and no `color-scheme`; nothing follows the system preference. | Light / dark / system with no-flash bootstrap. |
| X2 | S2 | Skip link becomes `focus:bg-white` without padding/contrast rules suited to a future dark theme. | Styled skip link from tokens. |
| X3 | S3 | No reduced-motion or forced-colors handling (little motion today, but required once motion is added). | Tokens collapse under reduced motion; patterns survive forced colours. |
| X4 | S3 | Text contrast is fine today (ink 16:1, muted ≈ 6:1); keep it measurable as palettes change. | `check-contrast.mjs` in the design toolchain; consider wiring into CI at implementation. |
| X5 | S3 | No print stylesheet for articles and record pages. | Print rules ([FOUNDATIONS.md](FOUNDATIONS.md#theming)). |

## What must not regress

- Static HTML first: every page readable without JavaScript.
- Publication gate behaviour, fixture marking, translation notices and
  Italian-literal predicates.
- Text twins for graph and maps; `hreflang`, sitemap, Pagefind indexing
  (`data-pagefind-body`), link checking.
- Existing URLs and anchors (`#IT`, `?tema=`).
