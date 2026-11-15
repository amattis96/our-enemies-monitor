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
| CI / CD | GitHub Actions | `check` (`pnpm check`, build, links) and `evidence-diff` on every PR; `check` on every push to `main`; deploy of the tip of `main` to Pages. Actions pinned to commit SHAs, kept current by Dependabot |
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
    translations.ts    Localized-text traversal, source and target hashes, translation checks
    diff.ts            Evidence diff between two versions of data/ (strict by default, waivable errors)
    article-diff.ts    Evidence diff of content/articles/ (review gates, reviewed articles frozen)
    policy.ts          Path policy by branch prefix, immutable sources, waiver label rule
    changes.ts         Changed paths from Git (raw -z, no renames, merge-base anchored)
    articles.ts        Article file loading, front matter parsing, schema and reference checks
    ingest/            M6 sidecar reconciliation (plan.ts), matching (match.ts),
                       archive order and checks (archive.ts), validation/writing
                       of the plan (apply.ts), reports (report.ts)
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
.github/workflows/     ci.yml (check, deploy) and evidence-diff.yml; no LLM API job
.github/dependabot.yml Weekly updates of the SHA-pinned GitHub Actions
.github/agent/         Legacy agent prompt pointer; M6 rules live in docs/
.github/ISSUE_TEMPLATE/ Correction and new-evidence forms
CONTRIBUTING.md        Contribution and evidence rules (EN/IT)
```

## M5 publication policy

`src/site/publication.ts` builds a **public projection** without changing canonical
records or immutable sources. Both the HTML read model and `data/v1/` exports
apply this projection. `needs_review` records, `pending_integration` events and
named-person relationships with a missing or unregistered `primary_url` are excluded. An `imported_unreviewed` record must have provenance under `sources/original/`, checked against the original by validation. Related edges
whose endpoints would become dangling are also omitted. Hypotheses with withheld endpoints are omitted; links to existing withheld events are filtered. For imported unreviewed hypotheses, publication additionally requires the matching Fonte_07 original row and unchanged Italian text and semantic fields. Only original citations still present are retained, and all review notes are omitted. Changed legacy hypotheses remain withheld. Reviewed hypotheses retain their approved content, subject to the same endpoint and event gates.
Supporting source metadata is retained when a visible record cites it, with
its real review state, including `needs_review`; an invalid imported baseline source and claims citing it are withheld. Historical `imported_unreviewed` baseline records remain
visible as **provisional** research, not editorially verified findings.
`reviewed` does not waive the person-primary-source requirement. The shared pure
`src/pipeline/evidence-policy.ts` uses exact URL equality against a source cited
by that relationship, the M5 matched reference for the same relationship ID,
or the same relationship's original row and URL. The last is a provisional
legacy compatibility rule, not source authentication or human approval. The
M5 loader fails on a missing or invalid registry; it is server-side only.

The [M5 evidence audit register](M5_EVIDENCE_AUDIT.md) and the structured
[26-source / 36-relationship / 30-decision / 20-claim file](audit/M5_2026-11-12.json)
document the first review pass. `src/editorial/m5.ts` validates its schema and
cross-checks source URLs, claim references, source completeness and pending
editorial approvals against canonical JSON. `pnpm audit:m5` runs in CI, without
marking unapproved claims as reviewed or modifying original provenance.

`publicationReport` derives the public dataset and a complete minimal withheld registry from validated canonical data; server exports reuse that report rather than calculating omissions from an already filtered dataset. `data/v1/withheld.json` exposes only ID, collection and generic reason codes, including withheld person IDs; the manifest includes per-collection withheld counts and the registry path. Withheld detail pages remain 404. The local audit also reports omitted hypothesis event/source IDs and note counts, without note text.

`pnpm audit:publication` lists canonical/public counts, states per collection and
named-person links missing a primary reference or carrying an unregistered URL in separate lists. This is an audit work queue,
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
| Hypothesis | `H00`–`H99`, `H100`–`H999` | Fonte_07 hypotheses (`H01`–`H22`) / Fonte_09 (`H23`–`H32`) |
| Source | `S00`–`S99`, `S100`–`S999`; `F01`–`F30`, `P01`–`P11`, `WEB`, `WEB-EXT-001`… | Corpus documents and cited references (`S09`, `WEB-EXT-005`–`054`: Fonte_09) |
| Exposure | `X-001` … | Fonte_08 §12.2 exposure matrix (one row each) |

Later incremental sources ingested with `pnpm ingest` get the next free
`EXT-NNN`, `G-NNNN`, `H##`/`H###` and `WEB-EXT-NNN` (highest existing + 1, gaps never
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
  `{ status: machine | reviewed, source_hash, target_hash }`, where the hashes
  fingerprint the Italian source and English target texts respectively.

### Editorial articles (M6)

Articles are authored analyses that **cite** canonical records; they are not
canonical records, so they live in `content/articles/`, not in `data/`. They
are Markdown because they are long prose reviewed in pull requests (a JSON
string body would make every diff one line), and because ChatGPT Task B writes
Markdown natively. `data/` keeps its one-JSON-record-per-file contract, and
`pnpm format:data`, `pnpm data:diff` and the M5 audit are unaffected.

- **Files:** `<ID>.it.md` (canonical, all metadata in its YAML front matter)
  and an optional `<ID>.en.md` (title, summary, body and `translation:
  { status, source_hash, target_hash }`). `src/model/article.ts` defines both front
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
  `src/pipeline/translations.ts`); `target_hash` hashes the English title, summary and trimmed body in the same way. `pnpm articles:hash [ID ...]` prints both; `--write ID ...` updates selected machine translations only. Stale reviewed translations require human review. Hashes detect changes, not semantic fidelity or reviewer identity.

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
machine|reviewed` applies `{ it: en }` only to records whose every text has a non-empty dictionary entry; partial matches are reported and unchanged. Empty imports do nothing. Both hashes are recorded. `pnpm i18n:migrate-hashes [--write]` preflights the legacy metadata migration, dry run by default; it never renews a stale source hash. The baseline's 1,087 unique texts were machine-translated
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

New incremental sources are a pair: the Markdown report
and a structured sidecar `sources/incremental/Fonte_XX.proposals.json`
(contract: `src/model/proposals.ts`, `schemas/proposals.schema.json`; full
field-by-field description and example in
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
  (an existing source is reused, not duplicated). It deduplicates **only
  against `data/`**; an event `url` quoted in an archived Markdown that has no
  sidecar and is not registered as a corpus document (today Fonte_10 and
  Fonte_11) is a `conflict`;
- a duplicate `create_event` that brings new material (citations, claims,
  contrary evidence, notes, a different description, themes or places) never
  drops it silently: it is an `enrichment` of a `needs_review` record (sources
  with the publisher of each added one, claim notes, the differing fields as
  "not applied" notes), otherwise a `conflict` whose `unapplied` field lists
  the material not written. A near-duplicate or legacy-URL `conflict` lists
  the whole proposal. Its `@ref` resolves to the existing event, so dependent
  relationships are not rejected; when the event is published, an attention
  point names those dependents;
- classifies each operation as `new`, `enrichment`, `duplicate`,
  `already_applied`, `conflict` or `rejected` (e.g. a relationship touching a
  person without `primary_url` and legal/procedural status with date);
- allocates IDs deterministically and writes only `needs_review` candidates
  with empty `provenance`. It enriches only records that are already
  `needs_review`, so the public M5 projection does not change (tested);
- marks each written record with an `[ingest <code> <ref>]` review note, so a
  rerun is `already_applied` and writes nothing (idempotent). Notes copied
  from the sidecar are prefixed `Sidecar note:`, so only the importer writes
  notes that start with a marker; a marker counts only on a record that cites
  the code (entities excepted), otherwise it is an attention point.

Sidecars are ingested in one total order (`src/pipeline/ingest/archive.ts`:
source number, then `created_at`, then file name). A sidecar is *ingested*
when `data/sources` holds its corpus document with the sidecar's Markdown in
`files`. While an earlier archived sidecar is not ingested, the run is blocked
("ingest S12 first"); so is another archived sidecar declaring the same
code. Later archived sidecars and `--compare` files (open PRs) only add "also
proposed by" attention points. `--skip-pending S<NN>` is a **human-only**
escape for an earlier sidecar whose plan can never be ingested: it is a
report warning and a note on the new corpus document; agents must ask the
maintainer instead of using it. The corpus document also records the outcome
(counts per classification, operations with evidence not applied, conflicts,
rejections), and `--write` writes it last, so a crash cannot mark a partial
import as ingested. An invalid archived or
`--compare` sidecar is a warning in the report; an invalid input sidecar
stops the run with a readable message.

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
- `pnpm check` = lint + typecheck + tests + validate + sidecar check +
  article validation + schema freshness + M5 audit + contrast.
- `pnpm validate:sidecars` checks every archived
  `sources/incremental/*.proposals.json` (see Validation rules, 12) and lists
  the sidecars not yet ingested, in ingest order (part of `pnpm check`).
- `pnpm build` builds the site into `web/dist/` and indexes it with Pagefind;
  `pnpm dev` / `pnpm preview` serve it locally (search works only on a build).
- `pnpm check:links` verifies every internal link and `#anchor` of the built
  site (CI runs it after the build).
- `pnpm data:diff` writes the strict evidence and path-policy diff of a branch
  against its merge base with a Git ref (see Editorial workflow); `pnpm check:pr`
  is its CI companion that decides the maintainer waiver.
- `pnpm ingest <Fonte_XX.proposals.json> [--write] [--json] [--report f]
  [--compare f] [--skip-pending S<NN>]` plans (dry run) or writes the candidates of an M6 sidecar
  (see Incremental ingest).
- `pnpm validate:articles` validates `content/articles/` and lists which
  articles the publication gate shows or withholds, and why (part of
  `pnpm check`); `pnpm articles:hash [ID ...] [--write]` computes both hashes, and requires IDs for writes.

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
7. Every `provenance` entry still equals its referenced row/line; `imported_unreviewed` requires at least one entry under `sources/original/`.
8. Event places and state countries are real ISO 3166-1 codes; only states
   have a country.
9. Translations: English texts require a `review.translations.en` state, must
   be complete for the record, and the `source_hash` must match the current
   Italian and `target_hash` must match the English (changes make the translation stale → error). See [translation glossary](TRANSLATION_GLOSSARY.md).
10. Warning: person relationships with missing or unregistered `primary_url` are
   withheld. A separate Unicode name/domain heuristic warns once per non-person
   entity with relationships; it has false positives and negatives and does not
   classify or block entities. Relationship evidence pairs E1/documented,
   E2/institutional_attribution, E3/corroborated and E4/allegation are enforced
   as errors provisionally, pending ADR-04/B18, not as a ranking of truth.
11. Articles (`pnpm validate:articles`): front matter schema, file name = ID,
   Italian file present, every linked event/entity/relationship/hypothesis
   and source code exists in `data/`, no duplicate links, `updated >= date`,
   fixture rules, English source hash, and a Markdown body without raw HTML
   or level-1 headings. A fixture that links a withheld record is an error.
12. Archived sidecars (`pnpm validate:sidecars`): each passes the
   `ProposalFile` contract (new sidecars 1.1, legacy 1.0 retains two-digit typed S/H fields); it is named `Fonte_NN.proposals.json` with
   `source.code` `SNN`; its `source.file` is in `sources/incremental/` with the
   same number; at most one Markdown and one sidecar per `Fonte_NN`; code and
   file unique among sidecars; S/H use two digits or 100–999 (no leading-zero aliases), while F/P remain two digits;
   the code is not registered in `data/sources` for another file. Warnings:
   Markdown from Fonte_12 on without a sidecar, sidecars not yet ingested.
   Files that are neither `*.proposals.json` nor `Fonte_*` Markdown (e.g. a
   README) are ignored.

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
| `/network/` | Evidence board island over `/data/v1/graph.json` with a build-time layout (`src/site/board-layout.ts`): filter by relation group and evidence level (E1 double, E2 solid, E3 dashed, E4 dotted thread); participation off by default; semantic zoom; drag; case-file drawer enters from the bottom below 760 px and from the right at wider widths, with internal scrolling for long content; drawer and List view show full localized caveats under each relationship, also included in SVG thread titles; `?focus=<ID>` deep link |
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
`hypotheses-graph.json`, `withheld.json`, one file per collection, `all.json`,
`schemas/<collection>.schema.json` (plus `schemas/proposals.schema.json`, the
M6 sidecar contract) and `manifest.json` (export version,
commit, commit date, counts, size and SHA-256 of every file; no build
timestamp, so a mirror built from the same commit publishes identical files). Both graphs are generated by the same export catalog and generic JSON route as the collection files; their manifest hashes cover the exact served bytes. Each evidence edge carries the relationship’s complete bilingual `caveat` or `null`; hypothesis edges remain separate and do not gain this field. The additive graph field retains export version `v1`. Visual group overrides place only `G-0419`, `G-0420` and `G-0421` in neutral `context`, without changing their canonical `infrastructure` class.

Public-facing rules implemented in the read model and tested:

- **Restriction:** a relationship touching a `person` with a missing or
  unregistered `primary_url` is withheld from public pages, graphs, atlas roles
  and exports. The historical M5 intake identified 36 such links; after the
  first source-matching pass, `G-0230` remains withheld in the current dataset.
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

**Concurrency (`ci.yml`):** the group is per pull request (a new push cancels
the older run) and per commit SHA on `main`, without cancellation, so no run
on `main` ever cancels another and every merged commit ends with a conclusive
run. Because several runs for `main` may then run side by side, the `deploy`
job first checks that its SHA is still the tip of `main` and otherwise skips
the publication (noted in the job summary); deploys are also serialized in a
`pages-deploy` group. A green commit that is superseded by a tip whose `check`
fails is therefore not deployed: the site catches up at the next green tip. (`cancel-in-progress: false` alone is not enough: GitHub
keeps one pending run per group and replaces it with a newer one.)

**Required checks and workflow contract:** the job names `check` (`ci.yml`)
and `evidence-diff` (`evidence-diff.yml`) are the status check contexts the adopted `main` ruleset is intended to require; application and live configuration remain pending maintainer verification. The job names are set explicitly and guarded by
`test/workflows.test.ts` (which also asserts no path filters, the concurrency
rule and SHA pinning). `evidence-diff` runs on every PR (`opened`,
`synchronize`, `reopened`, `labeled`, `unlabeled`) and checks out the PR head
commit, not the merge ref. It is added to the ruleset only after one run
under its final name has succeeded. A `pull_request` workflow runs the
version of the workflow and scripts in the PR, so the gate executes
PR-controlled code and a PR that edits them can make its own check pass. It is
a **review aid**, not a barrier. The intended barrier is required CODEOWNERS
review under the B01 ruleset with a machine account unable to bypass it; this protection is not established by these workflow definitions. Running
the gate from the base commit or under `pull_request_target` is deferred
(D-B02-6). For the same reason the `evidence-diff` job, which runs that code,
holds read scopes only (`contents`, `issues`, `pull-requests`, `actions`); the
only write scope (`issues: write`) belongs to the separate `expire-waiver` job,
which checks out and runs no repository code.

## Editorial workflow and AI agents

```text
contributor / research agent          maintainer
        |                                  |
  branch + edits in data/                  |
        |                                  |
  pull request ──► CI: check, build, check:links
                   evidence-diff job (job summary): strict rules on every
                   branch, path policy by branch prefix, maintainer waiver
        |                                  |
        └──────────────► maintainer approval ─► squash merge to main ─► deploy
```

- **Contributions:** `CONTRIBUTING.md` (EN/IT), issue forms for corrections
  and new evidence (`.github/ISSUE_TEMPLATE/`), and a pull request template
  with the evidentiary checklist.
- **Evidence diff:** `pnpm data:diff [--base <ref>] [--branch <head_ref>]
  [--relaxed [--waived-by <login>]] [--out file]` compares the working tree with
  the **merge base** of the ref (not its moving tip) and writes a Markdown
  report. Changed paths come from `git diff --raw -z --no-renames`, so a rename
  out of `data/` shows as a deletion; it exits 2 when Git fails (fail closed).
  The rules are **strict on every branch** (`src/pipeline/diff.ts`,
  `article-diff.ts`, `policy.ts`) and are errors (exit 1): record deletion,
  provenance changes, edits to `reviewed` records, setting `reviewed` or a
  reviewed translation, hypothesis promotion, new records not `needs_review`,
  new records claiming corpus provenance, new relationships without
  `primary_url`; on records already visible (not `needs_review`) a rewritten
  predicate, a removed or halved caveat or a changed evidence status at the
  same level; for articles, new articles not `needs_review`, `reviewed` set on
  an article or its translation, any change or deletion of a reviewed article,
  fixture mismatches. *Attention* flags (listed, not failing): named persons,
  raised evidence levels, new control/financing relationships, hypotheses,
  replaced sources, changed dates/URLs, English-only edits, links removed or
  added to unreviewed records, fewer references. The report prints flags even
  when `data/` is unchanged.
  - **Path policy by branch prefix** (`--branch`, from `head_ref`; errors, never
    waivable): `research/**` may only add under `sources/incremental/` and
    `sources/thematic/` and add or edit (not delete) under `content/articles/`;
    `agent/ingest-*` only `data/`; `dependabot/github_actions/**` only the
    workflows and `dependabot.yml`; every other branch (other `agent/**`,
    maintainer branches, forks) is unrestricted but gets the strict diff. On
    every branch, any change to `sources/original/`, any change but an
    addition under `sources/incremental/`, symbolic links, submodules and
    escaping paths are errors.
  - **Maintainer waiver:** the label `evidence-waiver` lowers the *waivable*
    errors to attention flags that stay listed under "Waived by the
    maintainer". `pnpm check:pr` (`src/cli/pr-policy.ts`) decides in CI, from
    live GitHub data and never from the event payload: the label must be
    present, its last event must be a `labeled` by the repository owner and
    later than the latest `ci.yml` run of this PR for the head commit and than
    the head commit's committer date (so a force push back to an older SHA, or
    the same SHA in another PR, cannot revive a label); `synchronize` runs
    ignore it, and the `expire-waiver` job removes it (404 = already absent).
    The accepted actor is the repository variable `MAINTAINER_LOGIN` when set,
    otherwise the repository owner. Provenance changes, immutable sources, symbolic
    links and path-policy violations cannot be waived. If GitHub cannot be read
    the job fails; it never assumes a waiver. Until agents use a separate
    account (see Protection), the owner check cannot tell the maintainer from
    agents acting with the maintainer's token.
  - `--agent` is a deprecated no-op (strict is the default).

  The CI `evidence-diff` job runs it on every pull request and publishes the
  report in the job summary.
- **M6 research design:** the paid Anthropic workflow is retired. The 14 November task snapshot records unattended source and article runs, including Fonte_12 with a sidecar in PR #18. This checkout archives Fonte_09–11; Fonte_10 and Fonte_11 lack sidecars and their recovery is deferred. Manual deterministic ingestion and bilingual article pages are implemented. [Run logging](automation/TASK_RUN_LOG.md) and [replacement prompts](automation/CHATGPT_TASK_PROMPTS.md) are procedures pending external configuration, not an implemented logger. See the [M6 workflow](M6_CHATGPT_OSINT_WORKFLOW.md) for contracts. GitHub Actions performs CI and deployment, not LLM inference.
- **Protection (14 November snapshot; not live verified):** `.github/CODEOWNERS` assigns every path to
  the maintainer. Classic branch protection on `main` requires the `check`
  status and a code-owner review, forbids force pushes and deletion, but has
  `enforce_admins` off, so the maintainer (admin) can push directly and merge
  without the required review; merges so far have done so. ChatGPT tasks act
  through the maintainer's own account via the ChatGPT Codex Connector app and
  the local Claude Code uses the maintainer's `gh` token: the separation
  between agents and maintainer is a convention, not a control.
- **Protection (adopted target, to be applied by the maintainer):** agents use
  a separate machine account with the Write role (conditional on verifying
  that the ChatGPT connector accepts it). A ruleset on `main` requires a
  pull request, one code-owner approval, the `check` status on an up-to-date
  branch (`evidence-diff` after maintainer verification and configuration), linear history and squash merges,
  and forbids force pushes and deletion; only the maintainer may bypass, and
  only through a pull request. A second ruleset limits the machine account to
  `research/**` and `agent/**`. Workflows cannot approve PRs and merged
  branches are deleted. Task C reviews but does not merge, and no agent
  pushes to `main`. Settings procedure and decisions D1-D7:
  [B01 analysis](audit/fable-2026-11/blocks/B01_ANALYSIS.md).
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
| **M6** ChatGPT source and article workflow | Source and article research, deterministic ingest and bilingual pages | Repository contracts and pages implemented; runs recorded in the dated snapshot. External prompt, identity and logging application remains pending; ingestion and editorial approval remain manual |
| **M7** Dossier design system | Concept, foundations, icon set, logo, illustrations, motion, component and page specs, UI/UX audit (`docs/design/`); implementation in the portal | Done (2026-11-12): themes, shell, evidence stamps, newest-first timeline, evidence board, interactive atlas; deferred items listed in `docs/design/IMPLEMENTATION_PLAN.md` |

### Article editorial approval and link diagnostics

`pnpm check:article-review` is a read-only CI check in the required
`evidence-diff` job, independent of the B02 waiver and strict diff. It compares
article changes against the same merge base and checks the live PR HEAD before
and after paginated reviews. A distinct human maintainer's latest decisive
review must approve the exact HEAD and contain `Publication-Approval: ART-0001`
with every affected ID. Promotion or modification of reviewed English requires
`Translation-Approval: ART-0001` as well. API errors, malformed data and stale
HEAD fail closed; generic approval and front-matter claims do not count. The
owner cannot approve their own PR. This check runs PR code with read-only
permissions; identity separation and repository protection remain operational
dependencies, and the maintainer must run the live canary. Marker lines must be at the top level, outside Markdown code fences and quotations.

`validateArticleFiles` emits a warning when no event, relationship or
hypothesis is linked and a complete IT/EN entity name or unambiguous ID occurs
in the text, for entities structurally associated with a public event. It does
not infer a role, add links, or block publication. The static publication gate
checks declared links; it does not establish semantic completeness.

The proposals schema publishes both 1.0 and 1.1 branches at one URL. Corpus code and Markdown filename must match fully with an underscore before the title; formerly accepted malformed prefix matches are rejected. Ingest allocates hypothesis IDs with two-digit minimum and three-digit maximum; exhaustion of any namespace makes the whole plan fatal with no writes. Git history probes the checkout before reading: source archives without a Git checkout warn and show no history; Git operational errors, including buffer exhaustion, fail the build.
