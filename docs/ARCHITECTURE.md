# Technical architecture

**Status:** adopted 2026-10-26. M1 (data foundation) implemented; M2–M4 planned.
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
| Tests | Vitest 5 | Importer and validator suites |
| Lint / format | Biome 2 | Code formatting and lint; data formatting is done by the pipeline |
| CI | GitHub Actions | `pnpm check` on every push and PR |
| Website (M2) | Astro 7 + React 19 islands | Static HTML pages; React only for interactive views |
| Styling (M2) | Tailwind CSS 4 + React Aria Components | Accessible primitives |
| Network graph (M2) | Cytoscape.js | Edge styles per relation group, hypotheses on a separate layer |
| Search (M2) | Pagefind | Static, multilingual index built from the generated pages |
| Atlas (M3) | Country-level SVG (d3-geo + Natural Earth) | No point coordinates exist in the data; no tile server |
| Hosting (M2) | GitHub Pages | Portable static output, works on any static host |

Deliberately **not** used: Next.js (static export loses i18n routing and adds
RSC runtime for a content site), Python in the build (would duplicate the
schemas), SQLite/PostgreSQL (unnecessary at this scale), graph or vector
databases, map tile servers. Reconsider only with measured need.

## Repository layout

```text
sources/original/      Immutable historical corpus (Fonte_00–Fonte_08)
data/                  Canonical records, one JSON file per record
  events/              TL-*.json (timeline) and EXT-*.json (pending integration)
  entities/            <ENTITY_ID>.json (states, persons, organizations, ...)
  relationships/       G-*.json (typed, sourced graph edges)
  hypotheses/          H*.json (open questions, never graph edges)
  sources/             S*/F*/P*/WEB*.json (corpus documents and external references)
schemas/               JSON Schema generated from the Zod model (do not edit)
src/
  model/               Zod schemas, controlled vocabularies, types
  pipeline/            Loading (load.ts), source reading (sources.ts),
                       canonical serialization (serialize.ts), validation (validate.ts)
    baseline/          One-time importer, file registry, known-issue registry
  cli/                 Entry points used by package scripts
test/                  Vitest suites
docs/                  Architecture and project documentation
.github/workflows/     CI
web/                   Astro portal (M2, not yet created)
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

Original IDs are never renumbered. Fonte_07 duplicates every timeline event
as a graph node (`EV_TL-0001`, `EV_EXT-001`); the importer merges them into
the single event record and rewrites edge endpoints to the event ID. ID
namespaces are disjoint, so a relationship endpoint is resolved by its ID.

### Records

- **Event:** dated record with `date {start, end, precision}` (partial ISO
  `YYYY`, `YYYY-MM`, `YYYY-MM-DD`), `record_type` (`event` or
  `dataset_metadata`), `timeline_status` (`integrated` or
  `pending_integration`), title, description, original category, original
  evidence note, original geography, source references, optional publisher,
  URL and evidence level (EXT records), `known_issues`.
- **Entity:** `kind` (`state`, `institution`, `person`, `organization`,
  `company`, `asset`), name, original domain.
- **Relationship:** `subject`, `object`, original `predicate`,
  `relation_class` (controlled vocabulary of the 30 observed classes, each
  mapped to a display `relation group`), `evidence_level` E1–E4 (E5 is
  rejected by the schema), `evidence_status`, sources, linked events,
  validity dates, primary URL, caveat.
- **Hypothesis:** subject, object, type, verification question, current
  limit, priority, evidence needed, sources, linked events, status.
- **Source:** corpus document (with its file path) or external reference
  (title, URLs, citing documents).

Every record also carries:

- `provenance[]`: for each source row it was built from, the file, the
  1-based CSV data row (or Markdown `line`) and the verbatim `original`
  values, so provenance can be re-checked forever and nothing is lost by
  normalization. Events have two entries (timeline row and graph node row).
  Records added later by editors may have an empty list;
- `review`: `{ status, notes }` with status `imported_unreviewed`,
  `needs_review` or `reviewed`.

### Not yet modeled (by design)

Claims, evidence documents with snapshots/hashes, exposures, assessments
and corrections as separate collections are introduced when real data
exists for them (M3–M4). The baseline has no claim-level data, and inventing
that structure would be false precision. Until then each relationship is the
claim, its sources are the evidence, and Git history plus `review.notes`
record corrections. Normalized themes (from the ~90 free-text categories),
places (from free-text geography), canonical predicates (from 290 original
predicates) and the event/attribution/impact status split (from free-text
evidence notes) are **editorial classifications** scheduled for M2/M3; the
original values remain the reference.

## Baseline in numbers

After import (`pnpm validate`): 151 events (147 timeline + 4 pending
integration), 202 entities, 444 relationships (291 event participation, 153
direct), 22 hypotheses, 55 sources (S00–S08, WEB, 4 WEB-EXT, F01–F30,
P01–P11). The GraphML export is verified by tests to be identical to the node
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
                    (M2) build read models --> Astro static site --> Pages
```

- `pnpm import:baseline` refuses to overwrite an existing `data/` unless
  `--force` is passed. After M1 it is only a reproducibility tool.
- `pnpm validate` fails on errors and prints warnings (e.g. relationships
  involving a named person without a primary URL: 36 in the baseline).
- `pnpm schemas` regenerates `schemas/*.schema.json`; `pnpm check` fails if
  they are stale.
- `pnpm format:data` rewrites data files in canonical form.
- `pnpm check` = lint + typecheck + tests + validate + schema freshness. It is
  what CI runs.

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
8. Warning: relationships touching a `person` entity without a `primary_url`
   (they will be restricted on the public site until reviewed).

## Website (M2–M3)

Static-first Astro site reading `data/` through the same model package.
Content pages (events, entities, hypotheses, sources, methodology) are plain
HTML; interactive views are React islands:

- **Timeline:** filter by period, theme, evidence; precision shown explicitly;
  `dataset_metadata` records hidden from the event list.
- **Network:** Cytoscape.js; filter by relation group and evidence level;
  event-participation edges visually distinct from direct relationships;
  hypotheses only in a separate, clearly labeled exploratory view; no
  automatic path inference or transitive edges.
- **Profiles:** entity and event pages with every relationship, its sources,
  caveats and review status. Named-person relationships without a primary
  source are shown in restricted form.
- **Atlas (M3):** country-level layers that keep event location, target and
  alleged origin separate.
- **Dependencies (M3):** exposure metrics with unit, denominator, year and
  scope (from Fonte_08 §12.2).
- **i18n:** Italian canonical; English in M3; stable IDs in URLs.

Read models are sharded per record and per neighborhood; no monolithic JSON.

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
| **M2** Italian MVP portal | Astro site: timeline, event/entity pages, network, hypotheses, sources, methodology, Pagefind search, GitHub Pages; theme classification | Planned |
| **M3** English, atlas, dependencies | EN translations with review status, country atlas, exposure dataset, a11y/mobile pass, downloadable data and schemas | Planned |
| **M4** Editorial workflow and agents | Contribution templates, PR evidence diff, CODEOWNERS/branch protection, scheduled research agent PRs, changes/corrections page | Planned |
