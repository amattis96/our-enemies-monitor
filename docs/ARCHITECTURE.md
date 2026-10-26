# Technical architecture

**Status:** adopted 2026-10-26. M1 (data foundation), M2 (Italian MVP portal) and
M3 (English, atlas, dependencies, open data) implemented; M4 planned.
This document describes the architecture as it is built. Keep it in sync
with the code (see [AGENTS.md](../AGENTS.md)).

## Principles

1. **Git is the database.** The repository alone must be sufficient to rebuild
   the public portal and every published claim. No hosted database, paid API
   or private account is needed to build, view or mirror the project.
2. **Original sources are immutable.** `sources/original/` keeps the 15
   historical files byte-for-byte. Corrections live in the canonical data,
   never in the originals.
3. **Canonical data is the single editable truth.** After the one-time
   baseline import, humans and agents edit `data/`, not the source files.
4. **Facts, attributions and hypotheses stay separate.** E5 hypotheses never
   enter the relationship graph; event participation is never shown as
   control or financing.
5. **No false precision.** Unknown dates, places, figures and causal links
   stay unknown (`null` or empty). Free-text original values are preserved
   verbatim until an editor classifies them.
6. **One language, one toolchain.** TypeScript end to end, so the schemas
   are written once and shared by the pipeline and the website.
7. **Size-appropriate technology.** The corpus has hundreds of records, not
   millions: everything is computed in memory at build time.

## Stack

| Concern | Choice | Notes |
| --- | --- | --- |
| Runtime | Node.js 26 (native TypeScript type stripping) | No transpile step for scripts; erasable TS syntax only |
| Package manager | pnpm 12 | Exact versions pinned in `package.json` |
| Language / types | TypeScript 7 | `tsc --noEmit` as type checker |
| Schemas | Zod 4 | Source of truth for types, validation and exported JSON Schema |
| Tests | Vitest 5 | Importer, validator and read-model suites |
| Lint / format | Biome 2 | Code and Astro formatting/lint; data formatting is done by the pipeline |
| CI / CD | GitHub Actions | `pnpm check` and `pnpm build` on every push and PR; deploy to Pages from `main` |
| Website | Astro 7 + React 19 islands | Static HTML pages; React only for timeline and network |
| Styling | Tailwind CSS 4 | Functional MVP styling with native form controls; a dedicated UI/UX design study will replace it (React Aria Components to be evaluated then) |
| Network graph | Cytoscape.js | Edge styles per relation group, hypotheses on a separate layer |
| Search | Pagefind | Static, multilingual index built from the generated pages |
| Atlas | d3-geo + world-atlas (Natural Earth), static SVG rendered at build time | Country level only; no client JavaScript, no tile server |
| i18n | Astro rest-param routes (`[...lang]`) | Italian at the root, English under `/en/`, same IDs in URLs |
| Hosting | GitHub Pages | Portable static output, works on any static host |

Deliberately **not** used: Next.js (static export loses i18n routing and adds
RSC runtime for a content site), Python in the build (would duplicate the
schemas), SQLite/PostgreSQL (unnecessary at this scale), graph or vector
databases, map tile servers. Reconsider only with measured need.

**Known tooling gap:** `@astrojs/check` does not support TypeScript 7 yet
(peer range `^5 || ^6`), so `.astro` templates are not type-checked. Keep
logic in `.ts`/`.tsx` modules (checked by `tsc`) and templates thin; adopt
`astro check` when it supports TypeScript 7. Biome cannot see template usage
in `.astro` files, so its unused-import/variable rules are off for them.

## Repository layout

```text
sources/original/      Immutable historical corpus (Fonte_00–Fonte_08)
data/                  Canonical records, one JSON file per record
  events/              TL-*.json (timeline) and EXT-*.json (pending integration)
  entities/            <ENTITY_ID>.json (states, persons, organizations, ...)
  relationships/       G-*.json (typed, sourced graph edges)
  hypotheses/          H*.json (open questions, never graph edges)
  sources/             S*/F*/P*/WEB*.json (corpus documents and external references)
  exposures/           X-*.json (quantified strategic dependencies)
schemas/               JSON Schema generated from the Zod model (do not edit)
src/
  model/               Zod schemas, controlled vocabularies, types
  pipeline/            Loading (load.ts), source reading (sources.ts),
                       canonical serialization (serialize.ts), validation (validate.ts)
    baseline/          One-time importer, file registry, known-issue registry
    baseline/themes.ts    Editorial category → theme classification
    baseline/places.ts    Editorial geography token → ISO country classification
    baseline/exposures.ts Transcription of the Fonte_08 §12.2 exposure matrix
    translations.ts    Localized-text traversal, source hash, translation checks
  site/                Read model (indexes, restriction rule, graph, timeline and
                       atlas projections), i18n strings, formatting, data exports
  cli/                 Entry points used by package scripts
test/                  Vitest suites
web/                   Astro portal
  astro.config.ts      SITE_URL / BASE_PATH configurable for mirrors
  src/pages/[...lang]/ Page routes, generated for `it` (root) and `en`
  src/pages/data/v1/   Language-neutral JSON endpoints (graph, exports, manifest, schemas)
  src/components/      Shared .astro components
  src/islands/         React islands: TimelineExplorer, NetworkExplorer
  src/lib/             Base-path/language links, cached read model, SVG map rendering
docs/                  Architecture and project documentation
.github/workflows/     CI and Pages deployment
```

## Data model

All records are validated by the Zod schemas in `src/model/`. Every file is
stored at `data/<collection>/<id>.json` and must equal its canonical
serialization (schema key order, 2-space indent, trailing newline), so diffs
are minimal and deterministic. Free text is a localized object
`{ "it": "...", "en"?: "..." }`: **Italian is the canonical language** of the
corpus; other languages are translations.

### Identifiers

| Collection | Pattern | Origin |
| --- | --- | --- |
| Event | `TL-0001` … / `EXT-001` … | Fonte_06 timeline / Fonte_07 new evidence |
| Entity | `RU`, `GRU`, `VOE`, `RU_PRESS` (uppercase code) | Fonte_07 nodes (non-event) |
| Relationship | `G-0001` … (gaps allowed) | Fonte_07 edges |
| Hypothesis | `H01` … | Fonte_07 hypotheses |
| Source | `S00`–`S08`, `F01`–`F30`, `P01`–`P11`, `WEB`, `WEB-EXT-001`… | Corpus documents and cited references |
| Exposure | `X-001` … | Fonte_08 §12.2 exposure matrix (one row each) |

Original IDs are never renumbered. Fonte_07 duplicates every timeline event
as a graph node (`EV_TL-0001`, `EV_EXT-001`); the importer merges them into
the single event record and rewrites edge endpoints to the event ID. ID
namespaces are disjoint, so a relationship endpoint is resolved by its ID.

### Records

- **Event:** dated record with `date {start, end, precision}` (partial ISO
  `YYYY`, `YYYY-MM`, `YYYY-MM-DD`), `record_type` (`event` or
  `dataset_metadata`), `timeline_status` (`integrated` or
  `pending_integration`), title, description, original category, editorial
  `themes` (18 codes, at least one), original evidence note, original
  geography, editorial `places` (ISO country codes, possibly empty), source
  references, optional publisher, URL and evidence level (EXT records),
  `known_issues`.
- **Entity:** `kind` (`state`, `institution`, `person`, `organization`,
  `company`, `asset`), name, original domain, `country` (ISO code, set for
  states only).
- **Relationship:** `subject`, `object`, original `predicate`,
  `relation_class` (controlled vocabulary of the 30 observed classes, each
  mapped to a display `relation group`), `evidence_level` E1–E4 (E5 is
  rejected by the schema), `evidence_status`, sources, linked events,
  validity dates, primary URL, caveat.
- **Hypothesis:** subject, object, type, verification question, current
  limit, priority, evidence needed, sources, linked events, status.
- **Source:** corpus document (with its file path) or external reference
  (title, URLs, citing documents).
- **Exposure:** sector, original indicator, `measures[]` (label, value, unit
  `percent`/`eur_billion`/`count`/`year`, qualifier `exact`/`approx`/
  `more_than`/`less_than`/`nearly`, optional `out_of` and `period` only when
  the source states them), scope (what the value measures), consequence,
  `status` (`observed` or `target` for planned values such as IRIS² 2030).

Every record also carries:

- `provenance[]`: for each source row it was built from, the file, the
  1-based CSV data row (or Markdown `line`) and the verbatim `original`
  values, so provenance can be re-checked forever and nothing is lost by
  normalization. Events have two entries (timeline row and graph node row).
  Records added later by editors may have an empty list;
- `review`: `{ status, notes, translations? }` with status
  `imported_unreviewed`, `needs_review` or `reviewed`. `translations.en` =
  `{ status: machine | reviewed, source_hash }`, where `source_hash`
  fingerprints the Italian texts the translation was made from.

### Not yet modeled (by design)

Claims, evidence documents with snapshots/hashes, assessments and
corrections as separate collections are introduced when real data exists
for them. The baseline has no claim-level data, and inventing
that structure would be false precision. Until then each relationship is the
claim, its sources are the evidence, and Git history plus `review.notes`
record corrections. Canonical predicates (from 290 original predicates) and
the event/attribution/impact status split (from free-text evidence notes)
are **editorial classifications** not yet done; the original values remain
the reference. Predicates are shown in the original Italian in both
languages, so a translation cannot change their meaning.

**Themes (M2):** each of the 123 original categories is mapped explicitly to
one or more of 18 themes in `src/pipeline/baseline/themes.ts` (the importer
fails on an unmapped category; a test fails on stale entries). Per-event
overrides apply the reclassifications reported by the corpus (TL-0035,
TL-0048) and classify the EXT records, which have no category; each override
is explained in `review.notes`.

**Places (M3):** event geography is split on `/` and each of the 66 tokens is
mapped explicitly in `src/pipeline/baseline/places.ts` to ISO country codes
(a place within a country maps to that country, e.g. Ceuta → ES) or to
nothing (supranational areas, seas, institutions, platforms). The importer
fails on an unmapped token; the validator checks codes against ISO.

**Exposures (M3):** the 14 rows of the Fonte_08 §12.2 matrix, transcribed in
`src/pipeline/baseline/exposures.ts`; the importer checks each row's line in
the source file and keeps it as provenance.

**Translations (M3):** `pnpm i18n:export <file>` writes the unique Italian
texts lacking (or with stale) English; `pnpm i18n:import <file> --status
machine|reviewed` applies `{ it: en }` to every matching text and records the
translation state. The baseline's 1,087 unique texts were machine-translated
(status `machine`); English pages say so.

## Baseline in numbers

After import (`pnpm validate`): 151 events (147 timeline + 4 pending
integration), 202 entities, 444 relationships (291 event participation, 153
direct), 22 hypotheses, 55 sources (S00–S08, WEB, 4 WEB-EXT, F01–F30,
P01–P11), 14 exposures. The GraphML export is verified by tests to be identical to the node
and edge CSV files, so it is not imported.

## Pipeline

```text
sources/original/*  --(one-time)-->  pnpm import:baseline  -->  data/**/*.json
                                                                    |
                                    pnpm validate  <----------------+
                                         |
                    schema, canonical form, unique IDs, references,
                    temporal rules, provenance vs. original files,
                    sensitive-person report
                                         |
                    src/site read model --> Astro static site + Pagefind --> Pages
```

- `pnpm import:baseline` refuses to overwrite an existing `data/` unless
  `--force` is passed. After M1 it is only a reproducibility tool.
- `pnpm validate` fails on errors and prints warnings (e.g. relationships
  involving a named person without a primary URL: 36 in the baseline).
- `pnpm schemas` regenerates `schemas/*.schema.json`; `pnpm check` fails if
  they are stale.
- `pnpm format:data` rewrites data files in canonical form.
- `pnpm check` = lint + typecheck + tests + validate + schema freshness.
- `pnpm build` builds the site into `web/dist/` and indexes it with Pagefind;
  `pnpm dev` / `pnpm preview` serve it locally (search works only on a build).
- `pnpm check:links` verifies every internal link and `#anchor` of the built
  site (CI runs it after the build).

### Validation rules

1. Each file parses against its schema; file name equals record ID.
2. Each file is in canonical serialization.
3. IDs are unique across collections.
4. All references resolve: relationship endpoints, hypothesis subject/object,
   linked events, source codes.
5. No E5 relationships (schema); hypotheses live only in `data/hypotheses/`.
   An `event_participation` relationship must have an event endpoint;
   subject and object differ.
6. Dates are real calendar dates, match their precision, and `end >= start`.
7. Every `provenance` entry still equals its row/line in `sources/original/`.
8. Event places and state countries are real ISO 3166-1 codes; only states
   have a country.
9. Translations: English texts require a `review.translations.en` state, must
   be complete for the record, and the `source_hash` must match the current
   Italian (a changed Italian text makes the translation stale → error).
10. Warning: relationships touching a `person` entity without a `primary_url`
   (they will be restricted on the public site until reviewed).

## Website

Static Astro site (`web/`) in Italian (root, canonical) and English
(`/en/`). It loads `data/` through `src/site/read-model.ts`, which re-runs
validation and fails the build on any error, so invalid data is never
published. Build output is ~885 static pages; Pagefind builds a separate
index per language from `<html lang>`.

| Route (also under `/en/`) | Content |
| --- | --- |
| `/` | Purpose, disclaimer, counts, entry points |
| `/timeline/` | React island: filter by theme (`?tema=` / `?theme=` deep link), period, text; EXT records flagged; `dataset_metadata` hidden by default; `<noscript>` list |
| `/events/<id>/` | Date with precision, known issues, evidence note, themes, original category, countries, actors and roles, direct relationships citing the event, linked hypotheses, provenance |
| `/entities/`, `/entities/<id>/` | Index by kind; profile with direct relationships, event participations, hypotheses, person notice |
| `/network/` | React island (Cytoscape.js) over `/data/v1/graph.json`: filter by relation group and evidence level (E1–E2 solid, E3 dashed, E4 dotted); participation off by default; node selection panel; text list of visible links as accessible alternative |
| `/network/hypotheses/` | Separate exploratory graph over `/data/v1/hypotheses-graph.json`, labeled as non-factual |
| `/atlas/` | Static SVG maps (Europe, world) of events by country of location; country table separating events located in the country from the literal roles of the state in events |
| `/dependencies/` | Exposure cards: measures with qualifier and period, what each value measures, consequence; no cross-comparison chart and no index |
| `/hypotheses/`, `/hypotheses/<id>/` | Register by priority, detail with limits and evidence needed |
| `/sources/`, `/sources/<id>/` | Corpus documents and references, URLs, repository files, citing records |
| `/methodology/` | Evidence levels, principles, relation groups, person rule, dates, classifications, languages, limits |
| `/data/` | Open-data downloads with size and SHA-256, format notes, rebuild instructions |
| `/search/` | Pagefind UI over pages marked `data-pagefind-body`, per language |

Language-neutral endpoints under `/data/v1/`: `graph.json`,
`hypotheses-graph.json`, one file per collection, `all.json`,
`schemas/<collection>.schema.json` and `manifest.json` (export version,
commit, commit date, counts, size and SHA-256 of every file; no build
timestamp, so a mirror built from the same commit publishes identical files).

Public-facing rules implemented in the read model and tested:

- **Restriction:** a relationship touching a `person` without `primary_url`
  is shown only as "restricted, pending primary source" (no predicate or
  caveat) and is excluded from the graph JSON and atlas roles (36 in the
  baseline).
- **Separation:** the evidence graph contains only `G-*` relationships; the
  hypothesis graph only `H*`. Nothing infers paths or transitive edges. The
  atlas never derives responsibility from location.
- **Ordering:** timeline sorted by start date; year-precision entries come
  first within a year (technical ordering, stated on the page).
- **Languages:** missing English falls back to Italian marked `lang="it"`;
  machine-translated records show a notice on English pages.

**Accessibility and mobile (M3 pass):** axe-core reports no WCAG 2.1 A/AA
violations on the main page types; no horizontal overflow at 375 px (tables
scroll inside positioned containers); maps are labeled groups with per-country
titles and a full data table; the network has a text alternative. UI/UX will
be redesigned in a dedicated study.

**Deployment:** the CI job builds on every push and PR; on `main` it uploads
`web/dist` and the `deploy` job publishes it to GitHub Pages (the repository
must have Pages enabled with source "GitHub Actions"). Mirrors set
`SITE_URL` and `BASE_PATH` and serve `web/dist` from any static host.

## Editorial workflow and AI agents (M4)

Agents work on dedicated branches and open pull requests; they never push to
`main`. CI validation is required but does not replace editorial review.
Serious allegations about identifiable people, contested attributions and
promotion of a hypothesis to a relationship require human approval. Agent
output must not modify CI workflows, schemas, validation rules or review
statuses of sensitive records; CODEOWNERS and branch protection enforce this.

## Milestones

| Milestone | Scope | Status |
| --- | --- | --- |
| **M1** Data foundation | Toolchain, Zod model, baseline import, validators, tests, CI, AGENTS.md | Done |
| **M2** Italian MVP portal | Astro site: timeline, event/entity pages, network, hypotheses, sources, methodology, Pagefind search, GitHub Pages; theme classification | Done |
| **M3** English, atlas, dependencies | EN translations with review status, country atlas, exposure dataset, a11y/mobile pass, downloadable data and schemas, link checking | Done |
| **M4** Editorial workflow and agents | Contribution templates, PR evidence diff, CODEOWNERS/branch protection, scheduled research agent PRs, changes/corrections page | Planned |
