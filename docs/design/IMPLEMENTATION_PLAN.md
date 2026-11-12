# M7 — Dossier implementation plan

Step 5 of the design brief: implement the design in the existing stack
(Astro 7, React 19 islands, Tailwind 4, Pagefind) **without regressions**.
No stack change; small, pinned additions only.

## Principles

- Ship in phases, each a separate branch + PR, each passing `pnpm check`,
  `pnpm build`, `pnpm check:links` and a browser pass (IT/EN, light/dark,
  375/768/1280 px, keyboard).
- Tokens first, then shell, then pages; islands last.
- Presentation rules that matter for evidence (stamp levels, thread styles,
  icon mapping, timeline order) are pure functions in `src/site/` with
  Vitest tests, not logic in templates (per AGENTS.md).

## New dependencies (latest, pinned exactly)

| Package | Why |
| --- | --- |
| `@fontsource-variable/newsreader`, `@fontsource-variable/ibm-plex-sans`, `@fontsource/ibm-plex-mono` | Self-hosted fonts |
| `d3-force`, `d3-zoom`, `d3-selection` (+ `@types/*`) | Board layout (build time) and pan/zoom; atlas zoom |

Cytoscape can be removed once the board ships (phase 5).

## Phases

| Phase | Scope | Main files | Done when |
| --- | --- | --- | --- |
| **7.1 Foundations** | Move `docs/design/tokens.css` to `web/src/styles/tokens.css`; map to Tailwind with `@theme inline` (`--color-ink: var(--ink)`…); fonts; base typography; `Icon` component + sprite in `web/public/`; theme bootstrap script, `ThemeSwitch`; favicon set, `theme-color`, OG defaults. Replace hard-coded colours in `global.css`. | `web/src/styles/*`, `web/src/layouts/Base.astro`, `web/src/components/Icon.astro`, `ThemeSwitch.astro`, `web/public/icons.svg`, `favicon.svg` | All pages render in both themes with no flash; contrast script passes; no hex in components |
| **7.2 Shell** | `Masthead`, `NavBar` (3 areas + Explore menu), mobile sheet, console tab bar, `LanguagePicker`, `SearchTrigger` + `CommandPalette` (Pagefind API), `Footer`, skip link, view transitions | `Base.astro`, new components, `src/site/i18n.ts` strings, `src/site/navigation.ts` (+ tests) | Mobile header ≤ 64 px; targets ≥ 44 px; ⌘K works; IT/EN toggle keeps the page |
| **7.3 Evidence grammar & content components** | `EvidenceStamp` (replaces `EvidenceBadge`), `StatusLabel`, `RelationChip`, `LimitsNote` + illustrations, `Callout`, `DataTable` (stacked on mobile), `DateWithPrecision`, `Citation`, `RecordFooter`, `KpiTile`, `StoryCard`, `RecordCard`; icon-mapping module with a test that every vocabulary value has a symbol | `web/src/components/*`, `src/site/evidence-style.ts`, `src/site/icons.ts`, `test/site/*` | Entity, event, source, hypothesis, dependency pages restyled; tables never overflow at 343 px |
| **7.4 Pages: home, investigations, article, methodology, archive** | Front-page home, investigations index, article layout with rail and claim links, methodology with TOC and illustrations, Archive landing with tabs, 404, data, changes, search page | `web/src/pages/[...lang]/*` | Visual pass matches [PAGES.md](PAGES.md); Pagefind still indexes the same bodies |
| **7.5 Timeline** | Newest-first default with toggle (pure sort function + test), spine with sticky years, density bar scrubber, URL-synced filters, filter sheet on mobile; static HTML list, island only filters | `TimelineExplorer.tsx`, `src/site/timeline.ts` (+ tests) | Existing `?tema=` links work; no-JS shows the full list newest first |
| **7.6 Evidence board** | Build-time `d3-force` layout (seeded, stable) emitted into `graph.json`; SVG board island with card forms per kind, sagging threads (colour = group, pattern = level), semantic zoom, drag, case-file drawer, neighbourhood focus, keyboard model, Board/List toggle, legend; hypotheses board variant | `web/src/islands/EvidenceBoard.tsx`, `src/site/board-layout.ts` (+ tests), `web/src/pages/data/v1/graph.json.ts` | Same nodes/edges as today's graph under the same gate; list view equivalent; 60 fps pan on a mid-range laptop |
| **7.7 Atlas** | Single map island: Europe ↔ World interpolation, zoom, labels, selection panel/drawer, keyboard path, outside-the-map tray, sortable country table; static SVG fallback | `web/src/pages/[...lang]/atlas.astro`, `web/src/islands/AtlasMap.tsx`, `web/src/lib/map.ts` | `#IT` anchors still select; tray counts equal today's "unplaced" count |
| **7.8 Motion & polish** | Reveal, drawer, pin drop, thread draw, counter tick, live dot; reduced-motion audit; print styles; OG image generation | CSS + small helpers | Reduced-motion run shows no travel; Lighthouse a11y ≥ 95 on key pages |

Phases 7.5, 7.6 and 7.7 are independent of each other once 7.1–7.3 are
merged and can run in parallel branches.

## Testing and verification per phase

- `pnpm check` (lint, typecheck, tests, validate, schemas, M5 audit).
- `pnpm build && pnpm check:links`.
- `node docs/design/scripts/check-contrast.mjs` (move to `src/cli/` and
  wire into `pnpm check` in phase 7.1, so palette changes stay verified).
- Browser pass with screenshots: home, article, timeline, board, atlas,
  entity, event — IT/EN × light/dark × 375/1280 px; keyboard-only run of
  nav, theme, language, search, board and atlas.
- Counts quoted in the UI come from the dataset summary, never hard-coded.

## Documentation to update during implementation

- `docs/ARCHITECTURE.md`: site section (styles, components, islands,
  build-time board layout), milestone table (M7 status).
- `README.md`: roadmap line for M7 and the site screenshots.
- `AGENTS.md`: "use semantic tokens and the `Icon`/`EvidenceStamp`
  components; never hard-code colours" once 7.1 lands.
