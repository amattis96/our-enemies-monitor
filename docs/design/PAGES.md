# Page blueprints

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
│ sources · exposures (counts from the dataset, sparkline per year)         │
├───────────────────────────────────────────────────────────────────────────┤
│ EXPLORE  4 large tiles with illustration-icon: Timeline · Board · Atlas · │
│ Dependencies  + Archive row (Entities · Hypotheses · Sources)             │
├───────────────────────────────────────────────────────────────────────────┤
│ HOW TO READ THIS MONITOR  evidence ladder illustration + 5 stamps +       │
│ "Enemies is the name of the project…" disclaimer (kept verbatim)          │
├───────────────────────────────────────────────────────────────────────────┤
│ MORE INVESTIGATIONS (3 cards)  ·  THEMES (18 theme chips with th- icons)  │
└───────────────────────────────────────────────────────────────────────────┘
```

- Until Task B publishes reviewed articles, the lead slot shows the most
  recent integrated timeline event as a "dispatch" with an explicit
  "Dalla cronologia / From the timeline" kicker; fixture articles never
  appear on the home page.
- The baseline/cut-off paragraph becomes the dateline plus a "Stato del
  corpus / Corpus status" note in the How-to-read block.
- Mobile: masthead compresses, sections stack, KPI tiles 2 × 3.

## Investigations index (Press)

- Lead + grid of `StoryCard`s; filters as chips: theme, region, actor
  (from article front matter); sort newest first.
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

## Timeline — "Cronologia" (Console)

Goal: **from today going back**, scannable by year, honest about date
precision, fast to filter.

```
┌ FilterBar (sticky) ──────────────────────────────────────────────────────┐
│ [search ID/text/place] [Themes ▾ multi] [Level E1..E4 chips]             │
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
  of the event assessment where available, theme chips with `th-` icons,
  review/pending status. Pending (EXT) items: dashed outline, transparent
  background. Metadata records: hidden by default as today.
- **Density bar:** years as columns (newest left), selected years in
  signal; it doubles as the period filter (replaces the two selects).
- **Filters:** URL-synced (`?tema=…&da=…&a=…&q=…&livello=…`), keeping
  the existing `?tema=` / `?theme=` deep links.
- **Performance:** 181 records render as static HTML at build (SEO, no-JS);
  the island only filters/hides, it does not re-render the whole list.
- **Mobile:** filters in a bottom sheet behind a "Filtri (2)" button; year
  labels become sticky section headers; density bar scrolls horizontally.

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

- Pan (drag background / arrows), zoom (wheel, pinch, + / − buttons, `fit`).
- **Semantic zoom:** < 45 % shows pins + threads only; 45–90 % shows cards
  with titles; > 90 % shows full cards with kind label and counts.
- Drag a card to rearrange (positions kept for the session); click opens
  the **case file drawer** (manila folder styling): title, kind, ID, all
  relationships grouped by group with predicate, level stamp, sources, links
  to entity page, timeline (filtered) and investigations citing it.
- Double-click (or `Enter` + `F`) isolates the neighbourhood; `Esc` clears.
- Keyboard: Tab moves across cards in reading order (top-left to
  bottom-right), arrow keys move to the nearest neighbour along threads,
  `Enter` opens the drawer.
- **Board / List toggle** (`ui-board` / `ui-list`): the list view is the
  full accessible twin (current "text list of visible links", upgraded to a
  sortable `DataTable`).
- Legend panel (collapsible): relation chips (toggle filters), thread
  swatches per level (toggle filters), card forms per kind, plus the
  `LimitsNote` with *not-transitive.svg*.
- Empty state: *empty-board.svg* + "Reset filters".

### Rendering decision for the implementation

Recommended: replace Cytoscape on this page with a **custom SVG renderer**
(React island) using `d3-force` for layout and `d3-zoom` for pan/zoom:
cards are rich SVG/HTML, which Cytoscape renders poorly (no rich labels, no
paper shapes, limited accessibility). ~400 nodes / ~170 direct edges are
well within SVG limits with semantic zoom. Layout is computed once at build
time (`d3-force` run in Node, positions emitted into `graph.json`) so the
board is stable and appears instantly; the client only refines on drag. If
the corpus grows beyond ~1,500 visible cards, switch the thread layer to
Canvas while keeping cards in SVG/HTML.

## Hypotheses board (network/hypotheses)

Same board, different material, so it can never be mistaken for evidence:

- A strip of masking tape across the top: "IPOTESI E5 — NON SONO FATTI
  DOCUMENTATI / HYPOTHESES E5 — NOT DOCUMENTED FACTS".
- Hypotheses are **yellow sticky notes** with the H-ID and question; nodes
  they mention are the same cards as on the evidence board, desaturated.
- Only **red dash-dot thread**; no relation-group colours.
- Priority shown as a number of pins (critical 3, high 2, medium 1, low 0)
  plus text; status as a stamp ("open", "under review", "refuted"…).

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

- **Single map** with animated switch Europe ↔ World (projection
  interpolation), zoom and pan (`d3-zoom`), hover outline + tooltip (name,
  count), click/Enter selects and opens the panel (drawer on mobile).
- **Keyboard:** the map is a `listbox`-like group: Tab enters, arrows move
  between countries with events (sorted west→east), Enter selects; the table
  below is the full twin.
- **Labels** only for countries with events, collision-avoided, in Plex Sans
  12 px with paper halo.
- **Outside the map tray** lists supranational/maritime/generic geographies
  as chips with counts (no invented coordinates); clicking filters the
  timeline.
- `LimitsNote` with *location-not-responsibility.svg*: the map counts where
  events took place, not who did them.
- Deep link: `#IT`-style hash selects a country (keeps current anchors).
- Map geometry stays build-time (`d3-geo` + `world-atlas`), shipped as one
  inline SVG for no-JS; the island adds zoom/selection.

## Dependencies (Console)

- Grid of exposure cards: title, `ExposureMeter` with the value always
  labelled and the denominator in words, observed vs target (hatched),
  "what it measures / consequence and caution" in two short blocks, sources.
- Group by domain (raw materials, energy, space, digital…), sort by value
  within a group. `LimitsNote`: values are not comparable across cards; no
  composite index (kept from today's notice).

## Archive (Console)

- Landing with three tabs: **Entities** (filter by kind with `kind-` icon
  chips, search, sort by name / number of relationships), **Hypotheses**
  (priority, status), **Sources** (type, publisher, year, primary-URL
  presence).
- Entity list rows: icon, name, mono ID, counts, status; on mobile a card
  list. Alphabet jump bar for long lists.

## Entity page (Press head, Console body)

```
kicker: kind icon + kind · domain          [Open on the board] [Timeline ⟶]
H1 serif name · aliases · country
summary (serif) + LimitsNote where relevant (persons: legal status + date)
KPI strip: relationships · events · sources · investigations
Tabs: Relationships (DataTable grouped by group, stamps, sources) ·
      Events (mini timeline, newest first) · Mini-board (1-hop, static SVG) ·
      Investigations · Sources
RecordFooter
```

## Event page

- Header: date with precision, place, ID, theme chips, assessment stamp.
- **Separate claims block** (event, perpetrator, sponsor, motive, impact)
  as five labelled rows with their own stamps and sources, using
  *separate-claims.svg* in the limits note. Participation rows keep the
  current wording ("presence or role, not command, financing or
  coordination").
- Actors and roles table → `DataTable`; related events (same theme ±1 year).

## Source page

- Document card styling (paper sheet): title, publisher, date, type,
  primary URL button (`ui-external`), corpus file link, "cited by" counts
  and lists (events, relationships, hypotheses, articles).

## Methodology (Press)

- Long-form article layout with a sticky table of contents, the evidence
  ladder illustration as hero, the full `EvidenceStamp` legend, and the four
  "limits" illustrations at their sections.

## Data, changes

- **Data:** download cards per file (format, size, SHA-256 short, licence
  CC0) with `ui-download`/`ui-copy`; manifest summary as KPI strip.
- **Changes:** vertical log (newest first) styled like the timeline but
  with commit IDs; known anomalies as `Callout caution`.

## Search

- Full page with grouped results and filters (type, language), same result
  rows as the command palette.

## 404

- *not-found.svg*, one sentence in both languages, search field, links to
  the three areas.
