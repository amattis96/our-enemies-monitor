# Technical architecture

**Status (13 November 2026):** M1–M7 built. M5 retains claim-level verification and publication quarantine. M6 provides deterministic sidecar ingestion and bilingual editorial articles. M7 implements the Dossier design system. Three ChatGPT tasks handle incremental OSINT, weekly investigations and PR review, while deterministic GitHub Actions performs CI and Pages deploy. Research Markdown merged under `sources/incremental/` and `sources/thematic/` appears automatically in the website's documentary archive, **without** advancing canonical timeline/graph counts or claim approval. Approved real articles replace the former demonstration fixtures.
This document describes the implemented code; see [AGENTS.md](../AGENTS.md) for agent rules.

## Principles

1. **Git is the database.** The repository alone must be sufficient to rebuild
   the public portal and every published claim. No hosted database, paid API
   or private account is needed to build, view or mirror the project.
2. **Original sources are immutable.** `sources/original/` keeps the 15
   historical files byte-for-byte. Corrections live in the canonical data,
   never in the originals. Later incremental sources (Fonte_09 onwards) are
   archived unchanged in `sources/incremental/`.
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
| Website | Astro 7 + React 19 islands | Static HTML pages; React only for the timeline and the evidence boards |
| Styling | Tailwind CSS 4 + *Dossier* design system | Tokens, icon sprite, logo, favicon and illustrations live in `docs/design/` (single source) and are imported by the site: `web/src/styles/global.css` imports `docs/design/tokens.css`; `/icons.svg` and `/favicon.svg` are endpoints serving `docs/design/assets/`. Light/dark/system themes; fonts self-hosted via Fontsource (Newsreader, IBM Plex Sans, IBM Plex Mono) |
| Evidence board | Custom SVG React island + d3-force (build-time layout) + d3-zoom | Paper cards per entity kind, thread colour = relation group, thread pattern = evidence level; hypotheses on a separate board |
| Search | Pagefind | Static, multilingual index built from the generated pages |
| Articles | YAML front matter (`yaml`) + micromark with GFM | Markdown rendered at build time; raw HTML escaped, unsafe URL schemes dropped |
| Atlas | d3-geo + world-atlas (Natural Earth), static SVG rendered at build time | Country level only, no tile server; a small script adds Europe/World switch, zoom/pan, country panel and table sorting |
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
sources/incremental/   Later incremental sources, archived as received (Fonte_09), with
                       their M6 proposals sidecars (Fonte_XX.proposals.json) when present
data/                  Canonical records, one JSON file per record
  events/              TL-*.json (timeline) and EXT-*.json (pending integration)
  entities/            <ENTITY_ID>.json (states, persons, organizations, ...)
  relationships/       G-*.json (typed, sourced graph edges)
  hypotheses/          H*.json (open questions, never graph edges)
  sources/             S*/F*/P*/WEB*.json (corpus documents and external references)
  exposures/           X-*.json (quantified strategic dependencies)
content/articles/      Editorial articles: <ID>.it.md (canonical) + optional <ID>.en.md
schemas/               JSON Schema generated from the Zod model, one per collection plus
                       article front matter and proposals.schema.json (M6 sidecar
                       contract) (do not edit)
src/
  model/               Zod schemas, controlled vocabularies, types (article.ts: articles;
                       proposals.ts: M6 proposals sidecar contract)
  pipeline/            Loading (load.ts), source reading (sources.ts),
                       canonical serialization (serialize.ts), validation (validate.ts)
    baseline/          One-time importer, file registry, known-issue registry
    baseline/themes.ts    Editorial category → theme classification
    baseline/places.ts    Editorial geography token → ISO country classification
    baseline/exposures.ts Transcription of the Fonte_08 §12.2 exposure matrix
    translations.ts    Localized-text traversal, source hash, translation checks
    diff.ts            Evidence diff between two versions of data/
    articles.ts        Article file loading, front matter parsing, schema and reference checks
    ingest/            M6 sidecar reconciliation (plan.ts), matching (match.ts),
                       validation/writing of the plan (apply.ts), reports (report.ts)
  site/                Read model (indexes, restriction rule, graph, timeline and
                       atlas projections), i18n strings, formatting, data exports,
                       articles.ts (article publication gate, back-links, HTML and
                       Markdown rendering)
  cli/                 Entry points used by package scripts
test/                  Vitest suites; fixtures/ holds hand-authored test inputs
                       (Fonte_10.proposals.json, a faithful subset of PR #3)
web/                   Astro portal
  astro.config.ts      SITE_URL / BASE_PATH configurable for mirrors
  src/pages/[...lang]/ Page routes, generated for `it` (root) and `en`
  src/pages/data/v1/   Language-neutral JSON endpoints (graph, exports, manifest, schemas)
  src/components/      Shared .astro components
  src/islands/         React islands: TimelineExplorer, EvidenceBoard
  src/styles/          global.css (Tailwind + Dossier tokens/components), shell.css, board.css
  src/lib/             Base-path/language links, cached read model, SVG map rendering
docs/                  Architecture and project documentation
  design/              Dossier design system v1: concept, foundations, components, page blueprints,
                       UI/UX audit, M7 plan, tokens.css, SVG assets, specimen.html (not yet used by web/)
.github/workflows/     CI (evidence diff, Pages deployment); no LLM API job
.github/agent/         Legacy agent prompt pointer; M6 rules live in docs/
.github/ISSUE_TEMPLATE/ Correction and new-evidence forms
CONTRIBUTING.md        Contribution and evidence rules (EN/IT)
```

## M5 publication policy

`src/site/publication.ts` builds a **public projection** without changing canonical
records or immutable sources. Both the HTML read model and `data/v1/` exports
apply this projection. `needs_review` records, `pending_integration` events and
named-person relationships without `primary_url` are excluded. Related edges
and hypotheses whose endpoints would become dangling are also omitted.
Supporting source metadata is retained when a visible record cites it, with
its real review state. Historical `imported_unreviewed` baseline records remain
visible as **provisional** research, not editorially verified findings.
`reviewed` does not waive the person-primary-source requirement.

The [M5 evidence audit register](M5_EVIDENCE_AUDIT.md) and the structured
[26-source / 36-relationship / 30-decision / 20-claim file](audit/M5_2026-11-12.json)
document the first review pass. `src/editorial/m5.ts` validates its schema and
cross-checks source URLs, claim references, source completeness and pending
editorial approvals against canonical JSON. `pnpm audit:m5` runs in CI, without
marking unapproved claims as reviewed or modifying original provenance.

`pnpm audit:publication` lists canonical/public counts, states per collection and
named-person links missing a primary reference. This is an audit work queue,
not a declaration that source URLs or all baseline claims are verified.
Canonical Git history remains public: this is an editorial publication policy,
not a confidentiality boundary.

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
| Event | `TL-0001` … / `EXT-001` … | Fonte_06 timeline / Fonte_07 new evidence (`EXT-001`–`004`) / Fonte_09 (`EXT-005`–`034`) |
| Entity | `RU`, `GRU`, `VOE`, `RU_PRESS` (uppercase code) | Fonte_07 nodes (non-event) |
| Relationship | `G-0001` … (gaps allowed) | Fonte_07 edges |
| Hypothesis | `H01` … | Fonte_07 hypotheses (`H01`–`H22`) / Fonte_09 (`H23`–`H32`) |
| Source | `S00`–`S09`, `F01`–`F30`, `P01`–`P11`, `WEB`, `WEB-EXT-001`… | Corpus documents and cited references (`S09`, `WEB-EXT-005`–`054`: Fonte_09) |
| Exposure | `X-001` … | Fonte_08 §12.2 exposure matrix (one row each) |

Later incremental sources ingested with `pnpm ingest` get the next free
`EXT-NNN`, `G-NNNN`, `H##` and `WEB-EXT-NNN` (highest existing + 1, gaps never
filled), and register their document as corpus source `S10`, `S11`, ….
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

### Editorial articles (M6)

Articles are authored analyses that **cite** canonical records; they are not
canonical records, so they live in `content/articles/`, not in `data/`. They
are Markdown because they are long prose reviewed in pull requests (a JSON
string body would make every diff one line), and because ChatGPT Task B writes
Markdown natively. `data/` keeps its one-JSON-record-per-file contract, and
`pnpm format:data`, `pnpm data:diff` and the M5 audit are unaffected.

- **Files:** `<ID>.it.md` (canonical, all metadata in its YAML front matter)
  and an optional `<ID>.en.md` (title, summary, body and `translation:
  { status, source_hash }`). `src/model/article.ts` defines both front
  matters and the assembled `Article` (localized `title`, `summary`, `body`);
  `pnpm schemas` writes `article-it-front-matter`, `article-en-front-matter`
  and `articles` JSON Schemas next to the collection schemas.
- **IDs:** `ART-0001`… for real articles, `ART-DEMO-001`… for demo/test
  fixtures. The ID is also the URL slug (`/articles/<ID>/`), like every other
  record page.
- **Fields:** `fixture` (mandatory boolean), `date` and `updated` (full
  days), `generated_by { kind: human | ai | fixture, tool, run_date }`,
  `links { events, entities, relationships, hypotheses }` (canonical IDs),
  `references` (at least one: `{ source: <code>, note }` or `{ url, title,
  publisher, published, accessed }`), `review { status: needs_review |
  reviewed, notes }`. Articles are never `imported_unreviewed`.
- **Fixtures are unmistakable:** `fixture: true` exactly for `ART-DEMO-NNN`
  IDs, titles start with `DEMO / TEST` in every language, `generated_by.kind:
  fixture`, never `reviewed`. Pages show a dashed **DEMO / TEST** banner and
  badge; the Markdown export carries it too. Delete the fixtures when the first
  real article is published.
- **Translation:** `source_hash` is `sha256(JSON.stringify([title, summary,
  body]))` of the Italian texts, first 16 hex digits (the record convention of
  `src/pipeline/translations.ts`); `pnpm articles:hash [--write]` prints or
  sets it. A changed Italian text makes the English file stale (error).

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

After the baseline import (`pnpm import:baseline`): 151 events (147 timeline +
4 pending integration), 202 entities, 444 relationships (291 event
participation, 153 direct), 22 hypotheses, 55 sources (S00–S08, WEB, 4
WEB-EXT, F01–F30, P01–P11), 14 exposures.

After the Fonte_09 update (`pnpm validate`, current `data/`): 181 events (147
timeline + 34 pending integration), 220 entities, 458 relationships (291 event
participation, 167 direct), 32 hypotheses, 106 sources (adds S09 and
WEB-EXT-005–054), 14 exposures. The GraphML export is verified by tests to be identical to the node
and edge CSV files, so it is not imported.

### Incremental sources (Fonte_09)

Fonte_09 (OSINT update 22 October–11 November 2026, 30 proposed items
`OEM26-001`…`030`, 50 references `SRC-01`…`050`, hypotheses `H23`–`H32`) is
**not** part of the baseline and is not read by the baseline importer. It was
imported by hand as ordinary editorial records:

- the document is archived byte-for-byte in `sources/incremental/` and
  registered as corpus document `S09`;
- `OEM26-n` → event `EXT-(n+4)` (`pending_integration`, `needs_review`, empty
  `provenance`), `SRC-n` → `WEB-EXT-(n+4)`; the original identifiers are kept
  in each record's `review.notes`. The 30 items are *candidate items*, not 30
  independent attacks: several are later phases of one case, and none has been
  merged into the 147 timeline events;
- every event states its update type (NEW_ATTRIBUTION, NEW_JUDICIAL, …) and,
  where it exists, the denial or right of reply in `review.notes`; where the
  document gives two evidence levels for one item (e.g. "E1 act / E2
  attribution") the lower one is the record's single `evidence_level` and the
  original wording is kept in `evidence_note`;
- the 10 candidate relationship rows of Fonte_09 §8.2 became `G-0447`–`G-0460`
  (the ten forbidden links of §8.3 are not recorded, and a test guards
  them); the new hypotheses are in `data/hypotheses/` with a provisional
  `medium` priority, since the document gives none;
- existing hypotheses touched by §7 only gained event/source links and a
  `review.notes` entry; their Italian texts and provenance are unchanged.

### Incremental ingest (M6, `pnpm ingest`)

From Fonte_10 onwards an incremental source is a pair: the Markdown report
and a structured sidecar `sources/incremental/Fonte_XX.proposals.json`
(contract: `src/model/proposals.ts`, `schemas/proposals.schema.json`; full
field-by-field description, example and the Task A prompt change in
[M6 ChatGPT OSINT workflow §4](M6_CHATGPT_OSINT_WORKFLOW.md)). The sidecar
lists typed operations: `create_event`, `create_entity`,
`create_relationship`, `create_hypothesis` (E5 only), `add_citation` and
`propose_correction`, each with its evidence level, citations and Italian
text. Event descriptions carry only the documented conduct; perpetrator,
sponsor, motive and impact are separate claims with their own level.

`src/pipeline/ingest/plan.ts` reconciles the operations with `data/`, without
touching disk:

- matches by ID, normalized entity names/aliases, event URL and date overlap
  plus title similarity, relationship triple, hypothesis type, and source URL
  (an existing source is reused, not duplicated). It also matches against the
  other archived sidecars, `--compare` files (open PRs) and URLs already quoted in
  other incremental Markdown;
- classifies each operation as `new`, `enrichment`, `duplicate`,
  `already_applied`, `conflict` or `rejected` (e.g. a relationship touching a
  person without `primary_url` and legal/procedural status with date);
- allocates IDs deterministically and writes only `needs_review` candidates
  with empty `provenance`. It enriches only records that are already
  `needs_review`, so the public M5 projection does not change (tested);
- marks each written record with an `[ingest <code> <ref>]` review note, so a
  rerun is `already_applied` and writes nothing (idempotent).

`apply.ts` validates `data/` as it would be after the plan with the full
validator. `src/cli/ingest.ts` prints the text or JSON report and, with
`--write`, writes the planned files in canonical form. It never runs in CI or
on merge, and never touches `sources/` or any provenance. The Markdown source
must be merged before `--write`.

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
  involving a named person without a primary URL: 36, all from the baseline).
- `pnpm schemas` regenerates `schemas/*.schema.json` (collections and the
  proposals sidecar); `pnpm check` fails if they are stale.
- `pnpm format:data` rewrites data files in canonical form.
- `pnpm check` = lint + typecheck + tests + validate + schema freshness.
- `pnpm build` builds the site into `web/dist/` and indexes it with Pagefind;
  `pnpm dev` / `pnpm preview` serve it locally (search works only on a build).
- `pnpm check:links` verifies every internal link and `#anchor` of the built
  site (CI runs it after the build).
- `pnpm data:diff` writes the evidence diff of `data/` against a Git ref
  (see Editorial workflow).
- `pnpm ingest <Fonte_XX.proposals.json> [--write] [--json] [--report f]
  [--compare f]` plans (dry run) or writes the candidates of an M6 sidecar
  (see Incremental ingest).
- `pnpm validate:articles` validates `content/articles/` and lists which
  articles the publication gate shows or withholds, and why (part of
  `pnpm check`); `pnpm articles:hash [--write]` computes English source hashes.

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
11. Articles (`pnpm validate:articles`): front matter schema, file name = ID,
   Italian file present, every linked event/entity/relationship/hypothesis
   and source code exists in `data/`, no duplicate links, `updated >= date`,
   fixture rules, English source hash, and a Markdown body without raw HTML
   or level-1 headings. A fixture that links a withheld record is an error.

## Website

Static Astro site (`web/`) in Italian (root, canonical) and English
(`/en/`). It loads `data/` through `src/site/read-model.ts`, which re-runs
validation and fails the build on any error, so invalid data is never
published. Build output is ~1,100 static pages; Pagefind builds a separate
index per language from `<html lang>`.

| Route (also under `/en/`) | Content |
| --- | --- |
| `/` | Front page: masthead, latest integrated event, latest entries, counts, explore tiles, how to read evidence (ladder illustration, stamps, disclaimer), themes |
| `/timeline/` | React island, server-rendered: newest first (toggle), year density bar as period filter, theme and text filters synced to the URL (`?tema=`, `?theme=`, `da`, `a`, `q`, `ext`, `meta`, `ordine`); EXT records dashed; `dataset_metadata` hidden by default; date precision shown visually |
| `/events/<id>/` | Date with precision, known issues, evidence note, themes, original category, countries, actors and roles, direct relationships citing the event, linked hypotheses, provenance |
| `/entities/`, `/entities/<id>/` | Index by kind; profile with direct relationships, event participations, hypotheses, person notice |
| `/network/` | Evidence board island over `/data/v1/graph.json` with a build-time layout (`src/site/board-layout.ts`): filter by relation group and evidence level (E1 double, E2 solid, E3 dashed, E4 dotted thread); participation off by default; semantic zoom; drag; case-file drawer; `?focus=<ID>` deep link; List view as the accessible equivalent |
| `/network/hypotheses/` | Separate hypotheses board over `/data/v1/hypotheses-graph.json`, red dash-dot threads only, labeled as non-factual |
| `/atlas/` | One map with Europe/World switch, zoom and pan, country panel (`#CODE` deep link), "outside the map" tray of supranational geographies; sortable country table separating events located in the country from the literal roles of the state in events |
| `/dependencies/` | Exposure cards: measures with qualifier and period, what each value measures, consequence; no cross-comparison chart and no index |
| `/hypotheses/`, `/hypotheses/<id>/` | Register by priority, detail with limits and evidence needed |
| `/sources/`, `/sources/<id>/` | Corpus documents and references, URLs, repository files, citing records |
| `/methodology/` | Evidence levels, principles, relation groups, person rule, dates, classifications, languages, limits |
| `/data/` | Open-data downloads with size and SHA-256, format notes, rebuild instructions |
| `/changes/` | Known anomalies, review notes and the Git history of data changes |
| `/search/` | Pagefind UI over pages marked `data-pagefind-body`, per language; every page also has a ⌘K / Ctrl K palette on the Pagefind JS API |
| `/articles/`, `/articles/<id>/` | Public articles, newest first; detail with test banner (fixtures), review and translation notices, Markdown body, numbered references, linked records grouped by collection, downloads and Git links; indexed by Pagefind. Event, entity and hypothesis pages list the public articles that link them |

Language-neutral article downloads: `/articles/<ID>.it.md` and, when
translated, `/articles/<ID>.en.md` (front matter with ID, language, dates,
fixture flag, review and translation status and canonical URL; notices; body;
references and linked records with absolute URLs).

Language-neutral endpoints under `/data/v1/`: `graph.json`,
`hypotheses-graph.json`, one file per collection, `all.json`,
`schemas/<collection>.schema.json` (plus `schemas/proposals.schema.json`, the
M6 sidecar contract) and `manifest.json` (export version,
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
- **Articles:** an article is public only when `reviewed` and every linked
  record and cited source is in the M5 public projection, so an article can
  never surface a withheld record (a `needs_review` Fonte_09 candidate, a
  restricted person relationship). `needs_review` articles stay in Git only;
  demo fixtures are the single exception and always show the test banner.
  Back-links come only from public articles.

**Accessibility and mobile (M3 pass):** axe-core reports no WCAG 2.1 A/AA
violations on the main page types; no horizontal overflow at 375 px (tables
scroll inside positioned containers); maps are labeled groups with per-country
titles and a full data table; the network has a text alternative. UI/UX will
be redesigned in a dedicated study.

**Deployment:** the CI job builds on every push and PR; on `main` it uploads
`web/dist` and the `deploy` job publishes it to GitHub Pages (the repository
must have Pages enabled with source "GitHub Actions"). Mirrors set
`SITE_URL` and `BASE_PATH` and serve `web/dist` from any static host.

## Editorial workflow and AI agents

```text
contributor / research agent          maintainer
        |                                  |
  branch + edits in data/                  |
        |                                  |
  pull request ──► CI: check, build, check:links
                   evidence-diff job (job summary)
                   agent/* branches: agent rules are errors
        |                                  |
        └──────────────► CODEOWNERS review ─► merge to main ─► deploy
```

- **Contributions:** `CONTRIBUTING.md` (EN/IT), issue forms for corrections
  and new evidence (`.github/ISSUE_TEMPLATE/`), and a pull request template
  with the evidentiary checklist.
- **Evidence diff:** `pnpm data:diff --base <ref> [--agent] [--out file]`
  (`src/pipeline/diff.ts`) compares `data/` with a Git ref and writes a
  Markdown report: added/modified/removed records with field-level before and
  after, and flags. *Attention* flags (any author): relationships concerning a
  named person, raised evidence levels, new control/financing relationships,
  new hypotheses, hypothesis status changes, deletions. In `--agent` mode
  these are **errors**: any change outside `data/`, record deletion,
  provenance changes, edits to `reviewed` records, setting `reviewed` or a
  reviewed translation, hypothesis promotion, new records not
  `needs_review`, new records claiming corpus provenance, new relationships
  without `primary_url`. The CI `evidence-diff` job runs it on every pull
  request (agent rules on `agent/*` branches) and publishes the report in the
  job summary.
- **M6 research design:** the paid Anthropic API weekly research workflow has
  been retired. Regular ChatGPT scheduled task **Our Enemies Monitor OSINT**
  runs daily at 01:00 Europe/Rome, performs independent OSINT research and
  proposes a new immutable `sources/incremental/Fonte_XX*.md` on a dedicated
  branch and PR. The first manual proof-of-concept produced PR #3; the first
  unattended execution (2026-11-13) and its permissions are still unverified.
  Deterministic source-to-data ingestion from a structured sidecar is
  implemented (`pnpm ingest`, run manually on an `agent/*` branch; see
  Incremental ingest); the Task A prompt still has to be updated to emit the
  sidecar. The multilingual article section and its file contract are
  implemented (demo fixtures only); the complementary ChatGPT thematic/article
  task (Task B) is planned but not configured.
  Read [M6 ChatGPT OSINT workflow](M6_CHATGPT_OSINT_WORKFLOW.md) for exact
  contracts, state and instructions. GitHub Actions remains responsible for
  CI, evidence checks, build and deployment, **not LLM inference**.
- **Protection:** `.github/CODEOWNERS` assigns every path to the maintainer.
  Branch protection on `main` requires the `check` status and a code-owner
  review for pull requests, forbids force pushes and deletion; the
  maintainer (admin) can still push directly. Agent pull requests are
  authored by a bot and therefore need the maintainer's approval.
- **Changes page:** `/changes/` lists the known baseline anomalies, every
  record's review notes and the history of data commits read from Git at
  build time (`src/site/history.ts`); each record page links to its own Git
  history.

## Milestones

| Milestone | Scope | Status |
| --- | --- | --- |
| **M1** Data foundation | Toolchain, Zod model, baseline import, validators, tests, CI, AGENTS.md | Done |
| **M2** Italian MVP portal | Astro site: timeline, event/entity pages, network, hypotheses, sources, methodology, Pagefind search, GitHub Pages; theme classification | Done |
| **M3** English, atlas, dependencies | EN translations with review status, country atlas, exposure dataset, a11y/mobile pass, downloadable data and schemas, link checking | Done |
| **M4** Editorial workflow and agents | Contribution templates, PR evidence diff, CODEOWNERS/branch protection, scheduled research agent PRs, changes/corrections page | Done |
| **Fonte_09** Incremental update | First incremental source (cut-off 2026-11-11): 30 candidate events, 50 references, 18 entities, 14 relationships, hypotheses H23–H32; English machine-translated, editorial review pending | Imported (needs review) |

| **M5** Evidence gate | Publication projection, evidence/source matching, Fonte_09 reconciliation, audit checks | Technically complete; outstanding evidence review tracked |
| **M6** ChatGPT source and article workflow | Daily ChatGPT incremental OSINT source PR, planned thematic research task, deterministic ingest and bilingual article pages | Task A configured and manual POC succeeded; sidecar contract and `pnpm ingest` implemented; article model, validation, gate and pages done (demo fixtures only); Task A sidecar prompt, unattended run and Task B pending |
| **M7** Dossier design system | Concept, foundations, icon set, logo, illustrations, motion, component and page specs, UI/UX audit (`docs/design/`); implementation in the portal | Done (2026-11-12): themes, shell, evidence stamps, newest-first timeline, evidence board, interactive atlas; deferred items listed in `docs/design/IMPLEMENTATION_PLAN.md` |
