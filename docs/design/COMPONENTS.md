# Components

Specifications for the shared components. Names are the planned Astro
component (or React island) names. All copy exists in IT and EN; all
components work in both themes, from 320 px, with keyboard and with reduced
motion.

## 1. Evidence grammar (the heart of the system)

### `EvidenceStamp`

Replaces today's `EvidenceBadge`. A small rubber-stamp label:

```
[■ E1 Atto primario]   [▲ E2 Attribuzione]   [◐ E3 Corroborato]   [○ E4 Accusa]   [◇ E5 Ipotesi]
```

| Level | Glyph (`ev-*`) | Short label IT / EN | Board thread | Notes |
| --- | --- | --- | --- | --- |
| E1 | filled square | Atto primario / Primary act | double solid | |
| E2 | filled triangle | Attribuzione / Attribution | solid, heavier | Attribution is not conviction: label never says "proven" |
| E3 | half circle | Corroborato / Corroborated | dashed 9/5 | |
| E4 | ring | Accusa / Allegation | dotted | |
| E5 | dashed diamond | Ipotesi / Hypothesis | dash-dot, **signal red only** | Only on hypotheses; dashed border + signal wash |

- Variants: `compact` (glyph + code, for tables and dense rows), `default`
  (glyph + code + short label), `full` (adds the definition from
  `EVIDENCE_LEVEL_LABELS`, used in legends and tooltips).
- Ink colour for E1–E4; no colour difference between levels. The glyph,
  code and label carry the level; the optional 4-segment **ordinal meter**
  (E1 = 4 … E4 = 1, E5 = 0) may appear in legends only, captioned "ordinal
  scale, not a score".
- Interaction: focusable when it has a tooltip; popover shows the full
  definition and a link to the methodology anchor.
- Accessibility: text is real text; the glyph is `aria-hidden`.

### `ThreadSwatch`

A 96 × 12 SVG showing the board line style for a level (legend use).

### `RelationChip`

Relation group chip: colour dot (`--series-n`) + `rel-*` icon + label. Used
in legends, filters and the case-file drawer. Filters use the same chip as a
toggle (`aria-pressed`).

### `ClaimLink` (articles)

*Deferred (needs a Markdown extension in the article contract).* Inline
claim in article prose: underline-highlight in accent wash + dotted
underline, followed by an `EvidenceStamp compact` that links to the record.

### `LimitsNote`

Standard "what this does not prove" block: small illustration (left on
desktop, top on mobile), kicker "Limiti di lettura / Reading limits", 1–3
sentences. Replaces the ad hoc `.notice` boxes on network, atlas and
dependencies.

## 2. Provenance and status

### `StatusLabel`

Icon + text label, 2 px radius, wash background:

| Status | Icon | Tone |
| --- | --- | --- |
| `reviewed` | `st-reviewed` | ok |
| `imported_unreviewed` | `st-unreviewed` | neutral |
| `needs_review` | `st-needs-review` | caution |
| pending integration (EXT) | `st-pending` | neutral, dashed item outline |
| machine translation | `st-machine` | neutral |
| primary source available | `st-primary` | neutral |
| person link restricted by M5 gate | `st-restricted` | neutral |
| DEMO / TEST fixture | `st-fixture` | fixture magenta, dashed outline, always with the word "DEMO / TEST" |

### `RecordFooter` (restyled)

Bottom of every record page, Console register: record ID (mono, copy
button), review status, translation status, sources count, "View history on
GitHub", "Report a correction" (prefilled issue), permalink copy, "Cite"
popover (record ID + title + URL + access date).

### `FixtureBanner` (restyled)

Full-width dashed magenta tape across the top of fixture articles with the
`st-fixture` icon; unchanged semantics.

## 3. Masthead and navigation

### `Masthead` (Press pages)

Dateline row → lockup → tagline → double rule (see
[BRAND_AND_ICONS.md](BRAND_AND_ICONS.md#wordmark-and-masthead)). Collapses
on scroll into `NavBar`.

### `NavBar`

Sticky, translucent paper (`color-mix` 88 % + backdrop blur). Left: small
mark + wordmark (when the masthead is collapsed or on console pages). Centre:
primary items with `nav-*` icons; active item gets a 3 px signal underline
and `aria-current="page"`. Right: `SearchTrigger`, `LanguagePicker`,
`ThemeSwitch`.

- **Desktop (≥ 1180 px):** seven direct items — Investigations, Timeline,
  Board, Atlas, Dependencies, Archive (entities, hypotheses, sources,
  events), Method (methodology, data, changes); the home is the brand link.
  *Deferred:* an Explore disclosure menu.
- **Below 1180 px:** mark + wordmark, search button, menu button (language
  and theme controls also stay in the bar from 760 px).
  Menu = full-height sheet with the three areas as large rows with icons,
  then Method links, then language and theme controls. Native `<dialog>`
  (`showModal`): focus trapped, `Esc` closes, focus returns to the button.
  *Deferred:* a bottom console tab bar on phones.

### `ThemeSwitch`

Segmented control with three icon buttons: Light (`ui-sun`), System
(`ui-system`), Dark (`ui-moon`); `role="group"` with label "Tema / Theme",
each button `aria-pressed`, tooltip and visually hidden text. Default is
System. Persisted in `localStorage`; inline head script prevents flash;
dispatches `themechange` for islands. In the mobile sheet it shows labels.

### `LanguagePicker`

Two languages today, so a **segmented toggle `IT | EN`** (mono, 600) rather
than a dropdown: both options visible, current pressed. Each option is a
link to the alternate page (`alternatePath`) with `hreflang` and `lang`
attributes and an accessible name in its own language ("Italiano",
"English"). If a page has no translation, the other option is disabled with
a tooltip. When a third language arrives, the same component becomes a
popover listbox (globe `ui-language` + current code + chevron) with native
names and a check on the current one.

### `SearchTrigger` and `CommandPalette`

Button styled as a search field ("Cerca nel monitor", `⌘K` / `Ctrl K`
hint). Opens a modal command palette using the Pagefind JS API (not the
default UI) with `kind-*` / `nav-*` icons per result type,
keyboard navigation (↑ ↓ Enter Esc, `/` also opens it), "Go to" section
shortcuts when the query is empty, top 8 results with a type icon and a
two-line excerpt. `/search/` stays as the full page. *Deferred:* grouping
by type and recent searches.

## 4. Content components

> Implemented: kicker, section titles, `KpiTile`, stacked `DataTable`
> (sortable on the atlas), `Callout`, `LimitsNote`, `EmptyState`, `Button`,
> `Tabs`, chips, `StatusLabel`, `RecordFooter` (copy ID, report a
> correction). *Deferred:* `Citation` popovers, `Pagination`, story-card
> variants beyond the home and investigations grids, `Sparkline`.

| Component | Spec |
| --- | --- |
| `Kicker` | Mono 11 px uppercase, `--ink-3`; signal red only for the article section kicker |
| `SectionHeader` | Heavy rule + kicker + serif H2 + optional "see all" link with `ui-arrow-right` |
| `StoryCard` (Press) | Kicker (theme), serif title, deck, meta (date, reading time, status). Variants: lead (display title, 2/3 width), standard, compact list row. Square corners, rule separators, no shadows |
| `RecordCard` (Console) | Icon of kind, title, mono ID, counts (relationships, events), status; 4 px radius panel, hover `--shadow-2` |
| `KpiTile` | Serif tabular figure, mono uppercase caption, optional sparkline; tile grid with 1 px rule gaps |
| `DataTable` | Sticky header, mono IDs, tabular numbers, zebra-free with hairlines, sortable headers (`aria-sort`), row hover, horizontal scroll inside a labelled region with shadow cues; on < 760 px rows collapse into stacked cards via `display: grid` per row |
| `FilterBar` | Console: sticky under the nav; segmented controls, chips, selects, search field; active filters summarised as removable chips + "Reset"; result count in `aria-live` |
| `Drawer` | Right-side panel (bottom sheet on mobile), 8 px radius, scrim, focus trap, close button and Esc, deep-linkable via URL hash |
| `Popover / Tooltip` | Popover API + CSS anchor positioning with fallback; tooltip only for supplementary text, never essential |
| `Tabs` | Underline tabs (signal underline on active) for Archive and entity pages |
| `Callout` | Variants: info (accent wash), caution (caution wash), limits (`LimitsNote`), fixture |
| `EmptyState` | Illustration + one sentence + action ("Reset filters") |
| `Button` | Primary (ink fill), secondary (outline), ghost, icon-only (with name); 40 px tall (44 on touch) |
| `Pagination / LoadMore` | Console lists: "Show 50 more", with count, never infinite scroll |
| `DateWithPrecision` | Date text + precision cue: day = plain, month = short fuzzy band, year = longer fuzzy band; `title`/tooltip states the precision in words; ranges as "apr 2007 – mag 2007" |
| `PlaceLabel` | Country name with flag-free `kind-state` icon; supranational places with `ui-no-location` |
| `Citation` | Footnote-style source reference: superscript code (`S06`) opening a popover with title, publisher, date, primary URL |
| `Footer` | Three columns (project, explore, method & data) + licences + disclaimer + last build commit/date |

## 5. Data-visualisation components

| Component | Spec |
| --- | --- |
| `DensityBar` | Events per year as thin bars (newest left), 2 px gaps, selected year in signal; hover tooltip with count; acts as year scrubber |
| `Sparkline` | 2 px line, no axes, end dot; in KPI tiles |
| `ExposureMeter` | Dependencies: horizontal bar with value label always visible, denominator stated under it in words; target values drawn hatched; never a combined index |
| `Choropleth` | Atlas: sequential tokens, 0.5 px paper borders, selected country ink outline 2 px, hover outline accent |
| `Legend` | Always present for ≥ 2 series; uses `RelationChip`, `ThreadSwatch`, sequential ramp with numeric labels |

All charts follow the dataviz rules in [FOUNDATIONS.md](FOUNDATIONS.md#data-palettes):
text in ink tokens (never series colours), legends always, a table or list
twin always.
