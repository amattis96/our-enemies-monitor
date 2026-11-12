# Page blueprints

> **Status:** implemented in M7 except where a section says *Deferred*;
> the summary is in [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md#status-after-m7).

Wireframe-level specifications. Every page keeps its current URL, data and
publication-gate behaviour (`src/site/publication.ts`); only presentation and
interaction change. ASCII sketches are desktop; mobile notes follow.

## Home — "Osservatorio" (Press)

```
┌ dateline: date · edition · data cut-off ● · counts ───────────────────────┐
│                    (mark)  Our Enemies Monitor                            │
│        Osservatorio indipendente su interferenze, minacce ibride…         │
╞═══════════════════════════════════════════════════════════════════════════╡
│ LEAD INVESTIGATION (2/3)                 │ LATEST IN THE TIMELINE (1/3)   │
│ kicker · display title · deck · meta     │ 5 most recent events, stamps   │
│                                          │ → Cronologia                   │
├───────────────────────────────────────────────────────────────────────────┤
│ THE CONSOLE  KPI tiles: events · relationships · entities · hypotheses ·  │
│ sources · exposures (published counts, count-up once on view)            │
├───────────────────────────────────────────────────────────────────────────┤
│ EXPLORE  4 large tiles with illustration-icon: Timeline · Board · Atlas · │
│ Dependencies  + Archive row (Entities · Hypotheses · Sources)             │
├───────────────────────────────────────────────────────────────────────────┤
│ HOW TO READ THIS MONITOR  evidence ladder illustration + 5 stamps +       │
│ "Enemies is the name of the project…" disclaimer (kept verbatim)          │
├───────────────────────────────────────────────────────────────────────────┤
│ MORE INVESTIGATIONS (non-fixture only) · THEMES (chips with th- icons)    │
└───────────────────────────────────────────────────────────────────────────┘
```

- Until Task B publishes reviewed articles, the lead slot shows the most
  recent integrated timeline event as a "dispatch" with an explicit
  "Dalla cronologia / From the timeline" kicker; fixture articles never
  appear on the home page.
- The baseline/cut-off paragraph stays in the How-to-read block; the
  dateline shows edition, data cut-off and counts (no build date, which
  would go stale on a static site).
- Mobile: masthead compresses, sections stack, KPI tiles 2 × 3.

## Investigations index (Press)

- Grid of story cards, newest first. *Deferred:* filter chips (theme,
  region, actor) until there are enough real articles.
- Fixture articles shown only with the magenta DEMO/TEST styling and grouped
  at the end (current gate rules unchanged).

## Article (Press)

```
kicker (section · theme, signal red)
H1 serif display · deck italic
byline row: date · reading time · translation status · review status · ↓ .md
────────────────────────────────────────────────────────
body (66ch, serif 17–19 px, drop cap)        │ "In the file" rail:
  ClaimLink + EvidenceStamp inline           │ entities cited (kind icons),
  Citation superscripts → source popovers    │ evidence mix (count by level),
  pull quotes, figures with captions         │ "Open on the board" link,
                                             │ "Events on the timeline"
────────────────────────────────────────────────────────
Sources (numbered, primary first) · Linked records (ArticleBacklinks) ·
Limits of this article · Record footer
```

- Rail collapses below the deck on < 1180 px as a horizontal "In the file"
  strip.
- Reading progress: 2 px signal bar under the nav (scroll-driven, optional).

*Implemented:* kicker, display title, italic deck, mono byline, serif body
with drop cap, references and linked records. *Deferred:* the "In the file"
rail, inline `ClaimLink` stamps (needs a Markdown extension), citation
popovers and the reading-progress bar.

## Timeline — "Cronologia" (Console)

Goal: **from today going back**, scannable by year, honest about date
precision, fast to filter.

```
┌ FilterBar (sticky) ──────────────────────────────────────────────────────┐
│ [search ID/text/place] [Theme ▾]  [Newest | Oldest]                      │
│ [☐ pending EXT] [☐ dataset metadata]   146 of 147 · Reset                │
├──────────────────────────────────────────────────────────────────────────┤
│ DensityBar 2026 ▮▮▮▮▮▮▯▯▯▯▯▯▯▯▯▯▯▯▯▯ 2007   (click = jump, drag = range)    │
├──────┬───────────────────────────────────────────────────────────────────┤
│ 2026 │ ◆ ott 2026 ~~~ · Paese · TL-xxxx                                  │
│(stky)│   Title (serif)                                                   │
│      │   [▲ E2] (theme chip)(theme chip) · roles: autore/bersaglio…      │
│      │ ◇ (dashed) pending item…                                          │
│ 2025 │ …                                                                 │
└──────┴───────────────────────────────────────────────────────────────────┘
```

- **Order:** newest first by default (reverse chronological), with a
  "Più vecchi prima / Oldest first" toggle; within a year, by start date
  descending; undated-day items after dated ones of the same month.
- **Spine:** vertical rule with sticky year labels (serif) and a diamond per
  event; month separators as small mono labels when ≥ 3 events share a
  month.
- **Date precision:** `DateWithPrecision` (fuzzy band for month/year
  precision), never a fake day.
- **Item:** date + place + mono ID meta row, serif title link, evidence stamp
  where the record has a level (today only the EXT records pending
  integration; integrated events carry the corpus assessment as text, so
  the timeline offers **no evidence-level filter**: it would silently hide
  every integrated event), theme chips with `th-` icons,
  review/pending status. Pending (EXT) items: dashed outline, transparent
  background. Metadata records: hidden by default as today.
- **Density bar:** years as columns (newest left), selected years in
  signal; it doubles as the period filter (replaces the two selects).
- **Filters:** URL-synced (`?tema=…&da=…&a=…&q=…&ext=0&meta=1&ordine=asc`), keeping
  the existing `?tema=` / `?theme=` deep links.
- **Performance:** the island is server-rendered (`client:load`), so the full
  list is static HTML for no-JS readers and search engines.
- **Mobile:** filters stack above the list (not sticky); year labels become
  sticky section headers. *Deferred:* a "Filtri (n)" bottom sheet.

## Evidence board — "Bacheca" (network, evidence mode)

The current Cytoscape graph becomes a **skeuomorphic investigation board**:
a cork board in a wooden frame, records pinned as paper, relationships as
yarn.

### Cards (entity kind → paper form)

| Kind / record | Paper form | Details |
| --- | --- | --- |
| State | Index card with ruled lines and a red margin line | `kind-state` icon, name |
| Institution | Letterhead sheet (double rule header) | `kind-institution` |
| Person | Polaroid **without photo**: neutral silhouette | Name + status chip; restricted links follow the M5 gate exactly as today |
| Organization | Manila folder with tab | `kind-organization` |
| Company | Business card with coloured edge | `kind-company` |
| Asset / programme | Blueprint card (grid on blue-grey paper) | `kind-asset` |
| Event | Newspaper clipping with torn edges and date in red mono | Brass pin (events are context, not actors) |

Cards rest at small random angles (−3°…+3°, seeded by record ID so they are
stable between visits), with `--shadow-card`. Text uses `--card-ink` on
`--card` (contrast 15:1 light, 12.7:1 dark).

### Threads

- **Colour** = relation group (`--series-1…6`, neutral for participation
  and context); **pattern** = evidence level (E1 double, E2 solid, E3
  dashed, E4 dotted); **direction** = a small paper arrow tag at 60 % of the
  thread with the literal Italian predicate on hover/focus.
- Threads sag (quadratic curve with sag ∝ length), drawn over a dark
  translucent casing for contrast on cork.
- Participation is excluded by default, as today.

### Interaction

- Pan (drag the background), zoom (⌘/Ctrl + wheel, pinch, + / − buttons,
  `fit`); the plain wheel keeps scrolling the page. The initial view fits the
  visible cards but never starts below 30 % scale, so phones open on part of
  the board.
- **Semantic zoom:** < 38 % shows blank paper cards, pins and threads;
  38–80 % adds titles; > 80 % adds kind label and record ID.
- Drag a card to rearrange (positions kept until reload); click opens
  the **case file drawer** (manila folder styling): title, kind, ID, every
  visible relationship with predicate, family and level stamp, a link to the
  full profile and a button that isolates the neighbourhood. Neighbours in
  the drawer are buttons that move the selection.
- `?focus=<ID>` (used by entity pages) opens the board on that card.
- Keyboard: every card is a focusable button (Tab), `Enter`/`Space` opens
  the drawer, `Esc` clears. *Deferred:* arrow-key travel along threads.
- **Board / List toggle** (`ui-board` / `ui-list`): the list view is the
  full accessible twin (current "text list of visible links", upgraded to a
  sortable `DataTable`).
- Legend panel (collapsible): relation chips (toggle filters), thread
  swatches per level (toggle filters), card forms per kind, plus the
  `LimitsNote` with *not-transitive.svg*.
- Empty state: *empty-board.svg* + "Reset filters".

### Rendering (implemented)

Custom SVG renderer (`web/src/islands/EvidenceBoard.tsx`) with `d3-zoom`
for pan/zoom. The layout is computed at build time by
`src/site/board-layout.ts` (`d3-force`, fixed-seed, two passes: the
default-visible relationships first, then the participation-only nodes
around them) and passed to the island as props, so `graph.json` stays a
pure data export and the board is identical on every visit. If the corpus
grows beyond ~1,500 visible cards, move the thread layer to Canvas.

## Hypotheses board (network/hypotheses)

Same board, different material, so it can never be mistaken for evidence:

- A strip of masking tape across the top: "IPOTESI E5 — NON SONO FATTI
  DOCUMENTATI / HYPOTHESES E5 — NOT DOCUMENTED FACTS".
- Each hypothesis is a **red dash-dot thread** with a yellow tag carrying its
  H-ID; nodes are the same paper cards as on the evidence board, on a
  slightly desaturated cork. No relation-group colours.
- Priority is in the List view. *Deferred:* sticky-note cards per
  hypothesis and priority shown as pins.

## Atlas — "Atlante" (Console)

Goal: one navigable, beautiful map instead of two static ones.

```
┌───────────────────────────────────────────────┬──────────────────────────┐
│ [Europa | Mondo]  [search country]  [⊕ ⊖ ⤢]   │ COUNTRY PANEL            │
│                                               │ Country (serif H2)       │
│        choropleth (sequential blue)           │ KPI: events · direct rel.│
│        graticule, sea in paper-sunken         │ Roles of the state       │
│        labels for countries with events       │ (literal predicates, it) │
│                                               │ Events list (date, stamp)│
│ legend 0 · 1 · 2–3 · 4–7 · 8+                 │ → open state entity      │
│ OUTSIDE THE MAP tray: Unione europea · 21 …   │ → timeline filtered      │
└───────────────────────────────────────────────┴──────────────────────────┘
│ Countries table (sortable, searchable): country · events · roles · direct │
```

- **Single map** with a Europe ↔ World switch (two build-time projections,
  World at 110m resolution), zoom by buttons or ⌘/Ctrl + wheel, drag to pan
  (viewBox), hover outline + native tooltip (name, count), click/Enter
  selects and fills the panel (below the map on narrow screens).
- **Keyboard:** coloured countries are links (Tab, Enter); the table rows
  have a button that selects the country; the table is the full twin.
- **Labels:** ISO codes at the projected centroid of countries with events
  (World: only 4+ events), mono 11 px with paper halo.
  *Deferred:* animated projection interpolation, collision avoidance.
- **Outside the map tray** lists supranational/maritime/generic geographies
  as chips with counts (no invented coordinates); clicking filters the
  timeline.
- `LimitsNote` with *location-not-responsibility.svg*: the map counts where
  events took place, not who did them.
- Deep link: `#IT`-style hash selects a country (keeps current anchors).
- Map geometry stays build-time (`d3-geo` + `world-atlas`), inline SVG for
  no-JS; a small page script adds the switch, zoom, selection and table
  sorting.

## Dependencies (Console)

- Grid of exposure cards: title, `ExposureMeter` with the value always
  labelled and the denominator in words, observed vs target (hatched),
  "what it measures / consequence and caution" in two short blocks, sources.
- Order and notice as in the data (values are not comparable across cards;
  no composite index). *Deferred:* grouping by domain.

## Archive (Console)

- Three tabs over the existing indexes (`/entities/`, `/hypotheses/`,
  `/sources/`) with counts. Entities: jump chips per kind with `kind-`
  icons, rows with name, mono ID and relationship count.
  *Deferred:* in-page search, sorting and the alphabet bar.

## Entity page (Press head, Console body)

```
kicker: Archive / kind icon + kind · ID · domain · country (→ atlas)
H1 serif name
KPI strip: direct relationships · events · open on the board · hypotheses
person notice (real person: literal reading, restricted links)
Direct relationships (DataTable, stamps, family chip, sources)
Events it appears in (date, role predicate, stamp)
Open hypotheses · Articles citing the record
RecordFooter (ID copy, review status, provenance, report a correction)
```
*Deferred:* tabs, mini-board, summary text (the model has none yet).

## Event page

- Header: date with precision, place (atlas or "no location" icon), ID,
  evidence stamp when the record has a level, pending status.
- A `LimitsNote` with *separate-claims.svg* explains that event,
  perpetrator, sponsor, motive and impact are separate claims (the data does
  not yet model them as five fields, so no five-row block is shown). Participation rows keep the
  current wording ("presence or role, not command, financing or
  coordination").
- Actors and roles table → `DataTable`; related events (same theme ±1 year).

## Source page

- Page head with type and code kicker and serif title; body as before
  (URLs, repository files, citing records). *Deferred:* paper-sheet card.

## Methodology (Press)

- Evidence ladder as hero, the full `EvidenceStamp` legend with a thread
  swatch per level, *not-transitive* and *separate-claims* illustrations,
  relation groups with colour dot and icon. *Deferred:* sticky table of
  contents.

## Data, changes

- Restyled through the shared components (kicker, tables, callouts).
  *Deferred:* download cards and a timeline-style change log.

## Search

- Pagefind UI themed with the Dossier tokens; the ⌘K palette (every page)
  uses the Pagefind JS API with type icons. *Deferred:* grouped results and
  type filters.

## 404

- *not-found.svg*, one sentence in both languages, links to the home page
  and to search.
