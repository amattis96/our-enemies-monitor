# Technical architecture

**Status (13 November 2026):** M1–M7 built. M5 retains claim-level verification and publication quarantine. M6 provides deterministic sidecar ingestion and bilingual editorial articles. M7 implements the Dossier design system. Four scheduled ChatGPT tasks handle incremental OSINT plus separate ingest PRs, investigations, review/fixes and controlled merge, while deterministic GitHub Actions performs CI and Pages deploy. Research Markdown merged under `sources/incremental/` and `sources/thematic/` appears automatically in the website's documentary archive, **without** advancing canonical timeline/graph counts or claim approval. Approved real articles replace the former demonstration fixtures.
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
    exposure-groups.ts Structural checks on the exposure `group` field (B19)
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
                       Markdown rendering), dependencies.ts and roles.ts (B19
                       Filiera, before/after and role matrix), packages.ts,
                       jsonld.ts, sitemap.ts and surface.ts (B20 per-record
                       packages, articles index, changes feed, JSON-LD,
                       sitemap lastmod, withheld-ID leak guard)
  audit/               Read-only measurement baseline (baseline.ts: FABLE A E1–E7,
                       D T1–T11), question-benchmark scorer (benchmark.ts) and the
                       text–graph mention queue (mentions.ts, shared matcher with E6),
                       cadence measures K1–K5 (cadence.ts, B21/ADR-08)
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
  audit/baseline/      Dated measurement baselines, benchmark case file and answers template
  audit/mentions/      Text–graph queue inputs (exclusions.v1.json, review.v1.json) and dated reports
  audit/cases/         B18 Case/Claim pilot (pilot.v1.json, needs_review, not exported)
  audit/fable-2026-11/ FABLE audit reports, block analyses and ADRs (adr/ADR-04, ADR-06, ADR-10)
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

## Measurement baseline and benchmark (B12)

`pnpm benchmark:measure [--out <file>] [--pages web/dist]` is read-only and
reproduces the measurable parts of FABLE A §11 (E1–E7: source-chain depth,
level/status pairs, withheld baseline records, counter-inference paths,
co-participation against a seeded degree-preserving null model, mentions
without an edge, independent roots behind `EXT` events computed only from
`derived_from`/`relies_on`, never from `publisher` text; E7 was added by B17
and is absent from the archived 85c92c5 baseline) and FABLE D §9.1 (T1–T11, computed from the in-memory public
exports, plus context sizes). Output is JSON keyed by commit and commit date;
the same commit yields byte-identical output (no wall-clock time, mulberry32
seed 7). T9 (live search) is not measured offline; T11 counts structured-data
markers only when `--pages` points at a build of the same commit. Heuristics
(negative-caveat regex, simplified name matcher) are stated in the output.

`docs/audit/baseline/benchmark-cases.v1.json` holds the FABLE D §9.3 battery
B1–B20 (question in IT/EN, expected answer, supporting IDs, required and
forbidden phrases). `pnpm benchmark:score <answers.json>` grades an answers
file shaped like `answers.template.json`: supporting-ID completeness, missing
required phrases, forbidden phrases (negation-guarded), and structured IDs that
do not exist in the repository. It is a first filter for a human grader, not a
factual verdict. Running an external model is a maintainer action; no model API
is called by the repository. Dated outputs live in `docs/audit/baseline/` and
are the reference for blocks B13, B16 and B19; `baseline-*.json` files are
excluded from Biome so they stay byte-identical to the command output. Case expected answers describe
the data at `as_of_commit`; a data change that alters them requires a new case
file version.

## Cadence measures (B21, ADR-08 proposed)

`pnpm cadence:measure --prs <prs.json> --runs <runs.json> [--since <ISO>]
[--until <ISO>] [--now <ISO>] [--ref main] [--out <file>]` computes the
ADR-08 entry measures from two `gh` JSON exports the maintainer makes
(`gh pr list --state all --json number,state,headRefName,createdAt,mergedAt,files`,
`gh run list --json workflowName,event,headBranch,conclusion,createdAt`) and
the first-parent Git history of `--ref`. It never calls the network and never
changes a schedule. K1 cutoff lag (hours since the last merged incremental
source PR, at each new one), K2 PR → merge per category (`sources`,
`articles`, `ingest`, `other`), K3 merge → ingest (sidecar added on the ref →
first addition of its `data/sources/<code>.json` corpus document), K4 CI
success share (completed runs, push on `main` vs pull requests), K5 backlog
at `--now` (open PRs per category, sidecars not ingested). One window is one
cycle; `now` defaults to `--until` or the latest input timestamp, so the same
inputs give the same output. The cadence options and the decision rule are in
[ADR-08](audit/fable-2026-11/adr/ADR-08_cadenze_abc.md) (proposed, not
applied): schedules and external prompts are unchanged, and no workflow runs
ingest on merge.

## Text–graph mention queue (B14)

`pnpm audit:mentions [--format md|json] [--out <file>]` is read-only and lists
entity names that appear in the Italian title/description of an event without a
participation edge (FABLE A §4.6). The matcher lives in `src/audit/mentions.ts`
and is the same one the B12 baseline uses for E6 (name segments of at least five
characters, folded, whole word), so the raw count is identical (111 at the
time of writing). The queue is that list minus a versioned lexicon exclusion
list (`docs/audit/mentions/exclusions.v1.json`: generic segments such as
«collegati» or a composite entity that duplicates two states); every excluded
mention stays listed in the report with its reason. Each row carries the matched
segment, the excerpt, the entity kind, how many relationships the entity has and
which of them already cite the event in `events`.

Outcomes `documented-role` / `context-only` / `false-positive` / `needs-evidence`
are recorded in `docs/audit/mentions/review.v1.json`, one entry per
(event, entity), with `state: proposta` (an unreviewed suggestion) or
`state: revisionata` (requires `reviewer` and `reviewed_on`, a named human).
The report states the sampled precision with a Wilson 95 % interval and the
review state of every row; stale exclusions or entries for pairs no longer in
the queue make the command exit non-zero. The command never writes under
`data/`, `sources/` or `schemas/` (`--out` refuses those paths): turning a
mention into a relationship is a separate, human-approved data change under the
usual evidence rules. A mention is a candidate for review, not a missing edge.
Dated Markdown reports are kept in `docs/audit/mentions/`.

## Forbidden inferences and counter-inference audit (B15)

`docs/audit/inferences/registry.v1.json` (schema and checks in
`src/editorial/inferences.ts`) is a versioned editorial registry, not a data
collection. It holds two lists:

- `forbidden_inferences` (`FI-###`): an inference the corpus explicitly does not
  support, with the canonical node pairs it concerns (empty when the source names
  no canonical node), a bilingual statement, who declared it (`declared_by`:
  a cited `source` record and/or the canonical `record` whose text carries the
  declaration, or the `maintainer`), linked hypotheses and an optional `lifted`
  block. It transcribes the ten lines of Fonte_09 §8.3 (nine node pairs) and the
  chain forbidden by `H06`.
- `caveat_classifications`: one entry per relationship whose Italian caveat
  contains a negation (the lexical detector shared with the B12 E4 measure),
  with one or more categories — `claim_negation`, `transitivity_limit`,
  `denial`, `not_established`, `reported_position` (CONSOLIDATED_FINDINGS
  §3.5) or `scope_precision` — and a separate per-relationship
  `interrupts_composition` judgement. A negation does not by itself make an
  edge non-traversable; the criterion is in
  `docs/audit/fable-2026-11/blocks/B15_ANALYSIS.md` §3.

Authority rule: an inference is forbidden only when a cited source or the
maintainer declares it; nothing expires automatically; an entry lapses only
through `lifted` (maintainer, with the new source). Agents add `state:
proposta` entries only; `revisionata` requires `reviewer` and `reviewed_on`.
`pnpm validate` checks the registry against the canonical data: unknown IDs,
duplicates, review-state consistency, maintainer declarations and lifts that
are not `revisionata`, and — as an error — any relationship that directly joins
a pair forbidden by a `revisionata` entry still in force (lift the entry or drop
the relationship); the same edge on a `proposta` entry, and a negative caveat
without a classification, are warnings.

At build time `counterInferenceAudit` (`src/site/inferences.ts`) takes the
public evidence graph (`graph.json` edges, undirected, participation included),
computes the deterministic shortest path for every public hypothesis pair and
every public forbidden pair, and flags the path when it crosses an interrupting
relationship or joins a forbidden pair. Flagged paths are annotated on the
hypothesis pages (both languages, «Limiti di inferenza» / «Inference limits»)
and published in `data/v1/inferences.json` with the categories, the rules and
the public part of the registry. Entries that reference a withheld record
(including every Fonte_09 entry, whose source `S09` is `needs_review`) are
counted in `forbidden_inferences_not_public`, never listed. Unreviewed
(`proposta`) entries are also kept private when they name no canonical node or
when their pairs or linked hypotheses touch a `person` entity; the page marks
each remaining proposal and step classification «proposta non rivista».
`forbidden_inferences_not_public` and the reviewed count in `review_note` are
computed over the full registry and exposed as counts only, as in
`withheld.json`.

## Case/Claim pilot (B18, ADR-06 proposed)

`src/model/cases.ts` adds two record shapes, additive and not yet canonical
collections: `Case` (`CASE-####`: events grouped as phases of one case, with a
`grouping_basis` written from the records; two phases count once) and `Claim`
(`CL-####`: one atomic proposition with `kind` fact/attribution/denial/judgment,
`aspect` occurrence/perpetrator/sponsor/motive/impact, `asserted_by`,
`asserted_on`, `responds_to`, `supersedes`, `evidence_level`, `relationships`,
`transcribed_from`, `person_status`, `sources`, `review`, empty `provenance`).
`pnpm schemas` emits `schemas/cases.schema.json` and `schemas/claims.schema.json`;
`vocabulary.json` gains `claim_kinds`, `claim_aspects` and `procedural_statuses`.

The pilot `docs/audit/cases/pilot.v1.json` reconstructs two cases by hand from
existing records: Gill (`TL-0015`, `TL-0092`: fact and judgment) and Marywilska
(`TL-0059`: fact, Polish attribution, Russian denial). `pnpm validate`
(`validateCasePilot` in `src/editorial/cases.ts`) checks it against `data/`:
known IDs, claims only about records of their case, an asserter for
attributions and denials, a reply target for denials (same case), a level only
when a listed relationship carries it (ADR-04), non-empty transcribed fields,
and for every person subject or asserter an exact procedural status, date and
registered primary `external_reference` cited by the claim (AGENTS.md rule 7).
`queryClaims`, `caseLanes` (empty lanes mean "not recorded"), `denialsOf` and
`casesOf` are the structured queries. All pilot records are `needs_review`;
the file is not loaded by the site or the exports (ADR-10, tested). Moving cases
and claims into `data/cases/` and `data/claims/` with the M5 gate and additive
exports waits for the maintainer to confirm ADR-06.

## Trace (B16)

`/trace/` and `/trace/<ID>/` (both languages) show the shortest path between
the two ends of a sensitive pair as an ordered list, following FABLE C §5.1.
Pairs and paths are not recomputed: `buildTraces` (`src/site/trace.ts`) takes
`auditedPairs` of the B15 audit (`src/site/inferences.ts`), i.e. the
deterministic shortest path in the public evidence graph (`graph.json` edges,
restricted person relationships excluded) for every public hypothesis pair and
every public forbidden pair, together with the B15 caveat classifications. One
static page per pair, keyed by the hypothesis (or forbidden inference) ID; a
pair with no public path still gets a page that says so. No island: the page is
a plain `<ol>` readable by a screen reader and printable.

Each step shows subject, literal Italian predicate, object, evidence stamp,
relationship ID and the full caveat. A step whose caveat interrupts composition
(B15 `interrupts_composition`) is preceded by «Qui la catena si interrompe» with
its categories and, while the classification is a `proposta`, the label
«proposta non rivista». The closing block «Che cosa questo tracciato non dice»
is generated from the structure of the trace (`notSaid`): n documented
relationships in a row are not a documented relationship between the ends; each
interruption; the evidentiary make-up of the path (how many steps carry each
level, never a single "weakest link": E1-E4 are kinds of basis, not a ranking,
ADR-04); the participation-is-not-control rule when the path crosses an event; every
open hypothesis (E5) and public forbidden inference on the pair; and the
reminder that it is the shortest public path, not the only one.
The wording lives in `src/site/trace.ts` with tests (`test/trace.test.ts`), not
in the template. Hypothesis pages and the hypotheses index link to the trace.

Limits: only pairs of the audit have a page (there is no arbitrary
actor-to-actor search); a pair appears when a hypothesis or a public forbidden
inference names it. Traces are not exported as JSON.

## Investigative views (B19)

FABLE C §§5.3–5.4, 8.3, built only on data and vocabularies that already exist.

- **Filiera and before/after** (`/dependencies/`, `src/site/dependencies.ts`).
  Exposures carry an optional editorial `group` `{ id, position }` (see Data
  model). `rare_earth_magnets` (`supply_chain`) orders X-004 extraction →
  X-002 refining → X-003 magnets → X-001 EU magnet demand; `eu_gas`
  (`before_after`) groups X-011 and X-012, whose two measures are the same
  quantity before and after. Each stage or pair shows value with qualifier,
  period (or «period not stated by the source»), what it measures and its
  sources. Stages are compared only when they measure the same quantity (same
  unit and same Italian label) with exact values: the «most concentrated
  stage» flag names the highest of those and its denominator (3 stages); a
  change of quantity between consecutive stages is stated instead of compared.
  No difference, ratio, index or scenario is computed. The 14 single cards
  stay below.
- **Role matrix** (entity pages with ≥ 3 public relationships,
  `src/site/roles.ts`). Public relationships of the entity counted by existing
  relation group (rows) × evidence level (columns), with the denominator,
  the period spanned by the start dates of linked events (and how many have no
  linked event) and the source (`data/v1/relationships.json`). No role class
  is invented: the participation row is expanded into its literal predicates.
  Restricted person relationships would be counted by level only, never by
  group or predicate.
- **Deferred.** Fascicolo del caso (C §§5.2, 8.2) waits for the confirmation of
  ADR-06 and for reviewed case data (the B18 pilot is `needs_review` and not in
  `data/`). Domande strutturate (C §5.5) need a query island or many static
  question pages and the date of attribution as data; not built.

## Data model

All records are validated by the Zod schemas in `src/model/`. Every file is
stored at `data/<collection>/<id>.json` and must equal its canonical
serialization (schema key order, 2-space indent, trailing newline), so diffs
are minimal and deterministic. Free text is a localized object
`{ "it": "...", "en"?: "..." }`: **Italian is the canonical language** of the
corpus; other languages are translations.

Every property of the collection models carries a `description` (Zod
`.describe()`), emitted into `schemas/*.schema.json` by `pnpm schemas`; a new
field needs one (tested). Enumerated fields reference their section of the
public `vocabulary.json`, where each value is defined.

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
  (title, URLs, citing documents). Optional genealogy (ADR-05, B17):
  `origin_type` (`primary_document`, `official_statement`, `wire`,
  `original_reporting`, `republication`, `synthesis`, `corpus_synthesis`;
  definitions in `vocabulary.json#/origin_types`), `derived_from` (sources
  it copies, relays or consolidates) and `relies_on` (the act or statement it
  reports). Absent means "not determined", never "primary"; values are set
  only when the repository itself establishes them. Today S00–S09 are
  `corpus_synthesis` and S06/S07/S08 declare `derived_from` from their own
  headers; external references carry no genealogy yet (see
  `docs/audit/sources/pilot.v1.json`, state `proposta`).
- **Exposure:** sector, original indicator, `measures[]` (label, value, unit
  `percent`/`eur_billion`/`count`/`year`, qualifier `exact`/`approx`/
  `more_than`/`less_than`/`nearly`, optional `out_of` and `period` only when
  the source states them), scope (what the value measures), consequence,
  `status` (`observed` or `target` for planned values such as IRIS² 2030),
  optional `group` `{ id, position }` (B19): an editorial grouping into a
  supply chain (`supply_chain`, position 1 = upstream, one measure per stage)
  or a before/after comparison (`before_after`, exactly two measures with the
  same unit, before then after); definitions in
  `vocabulary.json#/exposure_groups`. It adds no value, period or causal link.

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
for them (claims and cases: hand-written pilot only, see "Case/Claim pilot"). The baseline has no claim-level data, and inventing
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
   as errors, not as a ranking of truth: ADR-04 (proposed, B18) keeps
   `evidence_status` as a Fonte_07 compatibility code with no meaning of its own.
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
13. Forbidden-inference registry (`pnpm validate`, B15): schema, known IDs,
   review states, and no relationship directly joining a forbidden pair still
   in force (error); a negative caveat without a classification is a warning.
14. Source genealogy (B17, `src/pipeline/genealogy.ts`): `derived_from` and
   `relies_on` resolve, never cite the source itself and form no cycle
   (circular citation → error); `corpus_synthesis` only on corpus documents
   and corpus documents only `corpus_synthesis` (error); a `republication`
   without `derived_from` is a warning (counted as its own root). ADR-05: one
   warning per collection lists the E1 events/relationships whose sources are
   all corpus syntheses (a synthesis alone is not enough for E1); a warning,
   not an error, pending the source pilot. `independentRoots()` gives, at
   build time, the references and the independent roots behind a claim
   (republications and corpus syntheses add none); it is not yet shown on
   pages.
15. Case/Claim pilot (`pnpm validate`, B18): see "Case/Claim pilot"; errors for
   unknown IDs, claims outside their case, missing asserter or reply, invented
   levels, empty transcribed fields and person claims without status, date and
   registered primary source; a case without claims is a warning.
16. Exposure groups (B19, `src/pipeline/exposure-groups.ts`): a group has at
   least two members with positions 1..n, a supply-chain stage has exactly one
   measure, a before/after record exactly two with the same unit (errors).

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
| `/entities/`, `/entities/<id>/` | Index by kind; profile with role matrix (relation group × evidence level with base, period and source; literal participation roles, B19), direct relationships, event participations, hypotheses, person notice |
| `/network/` | Evidence board island over `/data/v1/graph.json` with a build-time layout (`src/site/board-layout.ts`): filter by relation group and evidence level (E1 double, E2 solid, E3 dashed, E4 dotted thread); participation off by default; semantic zoom; drag; case-file drawer enters from the bottom below 760 px and from the right at wider widths, with internal scrolling for long content; drawer and List view show full localized caveats under each relationship, also included in SVG thread titles; `?focus=<ID>` deep link |
| `/network/hypotheses/` | Separate hypotheses board over `/data/v1/hypotheses-graph.json`, red dash-dot threads only, labeled as non-factual |
| `/atlas/` | One map with Europe/World switch, zoom and pan (zoom anchored on the pointer or pinch centre, proportional ⌘/Ctrl + wheel and trackpad pinch, animated button and `+`/`-`/`0` key steps, one-finger page scroll until zoomed then one-finger pan, two-finger pinch on touch; country codes keep their on-screen size and hide when the map is drawn too small to read them), country panel (`#CODE` deep link), "outside the map" tray of supranational geographies; sortable country table separating events located in the country from the literal roles of the state in events |
| `/dependencies/` | Filiera of rare-earth magnets and gas before/after (B19), then exposure cards: measures with qualifier and period, what each value measures, consequence; no cross-comparison chart and no index |
| `/hypotheses/`, `/hypotheses/<id>/` | Register by priority, detail with limits and evidence needed; «Inference limits» section with the flagged shortest public path(s) and linked forbidden inferences (B15) |
| `/trace/`, `/trace/<ID>/` | Ordered shortest public path between the ends of each hypothesis pair, with caveats, interruptions, open hypotheses and «what this trace does not say» (B16) |
| `/sources/`, `/sources/<id>/` | Corpus documents and references, URLs, repository files, citing records |
| `/methodology/` | Evidence levels, principles, relation groups, person rule, dates, classifications, languages, limits |
| `/data/` | Open-data downloads with size and SHA-256, format notes, rebuild instructions |
| `/changes/` | Known anomalies, review notes and the Git history of data changes |
| `/search/` | Pagefind UI over pages marked `data-pagefind-body`, per language; every page also has a ⌘K / Ctrl K palette on the Pagefind JS API (the header hint shows ⌘ on Apple platforms and Ctrl elsewhere, from `data-platform` set on `<html>` before paint) |
| `/articles/`, `/articles/<id>/` | Public articles, newest first; detail with test banner (fixtures), review and translation notices, Markdown body, numbered references, linked records grouped by collection, downloads and Git links; indexed by Pagefind. Event, entity and hypothesis pages list the public articles that link them |

Language-neutral article downloads: `/articles/<ID>.it.md` and, when
translated, `/articles/<ID>.en.md` (front matter with ID, language, dates,
fixture flag, review and translation status and canonical URL; notices; body;
references and linked records with absolute URLs).

Language-neutral endpoints under `/data/v1/`: `graph.json`,
`hypotheses-graph.json`, `withheld.json`, `index.json` (catalog), `vocabulary.json`
(reading contract), `inferences.json` (B15 counter-inference audit), `articles.json` and `changes.feed.json` (B20), `records/<ID>.json` (B20, one per published record), one file per collection, `all.json`,
`schemas/<collection>.schema.json` (plus `schemas/proposals.schema.json`, the
M6 sidecar contract), spreadsheet copies `events.csv`, `entities.csv`,
`relationships.csv`, `hypotheses.csv` and `sources.csv` (`src/site/csv.ts`:
RFC 4180, UTF-8 with BOM, CRLF, lists joined with `;`, `_it`/`_en` text
columns, cells that a spreadsheet would run as formulas prefixed with `'`;
a relationship the site shows as restricted keeps its row but not its
predicate or caveat) and `manifest.json` (export version,
commit, commit date, counts, size and SHA-256 of every file; no build
timestamp, so a mirror built from the same commit publishes identical files). Both graphs are generated by the same export catalog and generic JSON route as the collection files; their manifest hashes cover the exact served bytes. Each evidence edge carries the relationship’s complete bilingual `caveat` or `null`; hypothesis edges remain separate and do not gain this field. The additive graph field retains export version `v1`. Visual group overrides place only `G-0419`, `G-0420` and `G-0421` in neutral `context`, without changing their canonical `infrastructure` class.

Export menus: pages with data offer an «Esporta / Export» disclosure (`web/src/components/ExportMenu.astro` for static pages, `web/src/islands/ExportMenu.tsx` inside islands, same markup and classes, styles in `global.css`). Items either link to a published file under `/data/v1/` (collection CSV/JSON, record package, graph, articles index) or build a file in the browser from what is on screen: the timeline exports the visible entries (current filters and order) and the boards the visible cards and threads, as CSV or JSON, with `src/site/csv.ts` (literal predicates, hypotheses marked E5); an entity page exports its relationships and event participations as listed on the page, generated at build time from the public projection. Article pages offer the existing Markdown files (IT/EN, with references and linked records) and print/save as PDF through the print stylesheet. File names follow `oem-<view>-<lang>.<ext>`. The `pnpm check:links` leak guard also reads every CSV under `data/v1/` (`leakedInCsv` in `src/site/surface.ts`).

Timeline sticky offsets: `TimelineExplorer` measures the site header and the filter bar with a `ResizeObserver` and sets `--tl-top` and `--tl-filters`, so the sticky filter bar and year labels never slide under each other whatever the wrapping, font or platform.

Reading contract (B13, additive, export version `v1`): `vocabulary.json` (`src/site/vocabulary.ts`) defines every controlled value used in the public data — evidence levels with basis and `must_not_read_as`, the `scale_note` that E1–E4 are kinds of basis and not a ranking, level-paired evidence statuses, relation groups and classes (participation and context are not control or financing), entity kinds and domains, review/translation/timeline statuses, record types, hypothesis statuses and priorities (not probabilities), source types, exposure statuses and groups, measure units and qualifiers, date precisions, themes, known-issue codes and withheld reasons, and (B18, ahead of any public claim data) claim kinds, claim aspects and procedural statuses — plus reading rules R1–R5 and a structured subset of the translation glossary. Rules are declarations about the data, not instructions. `index.json` (`buildCatalog` in `src/site/exports.ts`) is the catalog: license, canonical language, translation rule, published and withheld counts from the same publication report, the dataset/schema list, and freshness at three distinct dates — `commit_date` (Git commit date, as in the manifest), `latest_public_event_date` (latest `date.start` of a published `event` record; `dataset_metadata` excluded) and `latest_archived_source` (newest committed incremental source, with `in_public_sources`). No wall-clock time is used, so builds stay reproducible. Every property of the six collection schemas carries a `description` (Zod `.describe()`), and enumerated fields point to their `vocabulary.json` section; tests enforce both and that every controlled value in the public data has a vocabulary entry.

Per-record packages, JSON-LD and feeds (B20, additive, `v1`): `src/site/packages.ts` derives, from the same public projection as the pages and the collection files, `records/<ID>.json` (one compact package per published record: the public-projection record, `cite_as` citing that projection — `cites: public_projection`, export version, commit, `package_path` and `record_sha256` (SHA-256 of the `record` member as compact JSON; the whole file is hashed in the manifest, so no circular hash) — and `canonical_source` with the Git permalink for provenance only, marked `relation: filtered` when the canonical file differs from the projection (`PublicationReport.transformed`, e.g. `H08`) or `identical`, site-relative page paths, and the IDs of the published records it points to or is pointed at by), `articles.json` (only articles that pass the publication gate; demo fixtures excluded as a further conservative rule) and `changes.feed.json` (JSON Feed 1.1 of the newest 50 commits that add or modify published records, same filter as `/changes/`; removed or unpublished records are never listed). All are served by generic routes (`web/src/pages/data/v1/`), built once per build (`getExports()` in `web/src/lib/model.ts`) and hashed per file in the manifest; the `/data/` page summarises the 873 packages in one row and `index.json` carries `record_packages`. Event, entity, hypothesis and source pages link their package with `<link rel="alternate" type="application/json">`; every page (except 404) has `<link rel="canonical">`; dates are `<time datetime>` (`DateRange.astro`). Minimal JSON-LD is built in `src/site/jsonld.ts`: `Dataset` on `/data/` (CC0, absolute downloads, commit as version) and `Article` on non-fixture article pages; `serializeJsonLd` escapes `<`, `>`, `&` and U+2028/2029 so text can never close the script element. The sitemap (`@astrojs/sitemap`) gets `lastmod` from `src/site/sitemap.ts`: the newest Git commit that touched the record, the article's `updated`/`date`, else the exported commit date; no wall clock. Leak guard (`src/site/surface.ts`, FABLE D A15): `test/packages.test.ts` asserts against the withheld registry that no withheld ID appears in structural positions (ID-bearing keys, path-like strings) of any export file, and `pnpm check:links` repeats the check on the built packages, articles index, feed, catalog, sitemap and every page's JSON-LD.

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

**Required checks and workflow contract (settings verified 15 November 2026):**
the contexts `check` (`ci.yml`) and `evidence-diff`
(`evidence-diff.yml`) are both required in the classic `main`
branch protection, with `strict: true`. The maintainer also set zero
required approving reviews and disabled mandatory CODEOWNERS approval,
allowing the same GitHub account to open and merge a compliant PR.
`test/workflows.test.ts` guards the stable job names; do not rename
them. `evidence-diff` runs on every PR and evaluates the submitted
head commit. Article review is a separate check for transitions to
human `reviewed` status.

**Control-plane limitation:** workflow/script changes in a PR can
alter the checks that examine that same PR. The tripwire reports those
paths, but this is **attention, not an enforcement boundary**. In
single-account mode there is no enforced code-owner review and no
ruleset, so Task D's explicit policy **forbids automatic merge of
control-plane changes** pending a maintainer decision. Identity
separation and base-branch enforcement remain future hardening work.
`evidence-diff` runs with read-only repository permissions; the
separate `expire-waiver` job removes the label after new commits.

**Deterministic ingest staging (proposed operational path):** `.github/workflows/stage-ingest.yml` is triggered after successful `main` CI or by manual dispatch. It checks out only the current trusted `main` tip, chooses the earliest archived sidecar absent from `data/sources/`, runs dry-run and write-mode `pnpm ingest` with fail-closed classification checks, formats and validates data, then emits a Git bundle. An isolated job with write permission but no repository-code execution verifies the bundle and pushes one `agent/ingest-fonte-*` **candidate branch only**. A pending ingest PR/branch suppresses duplicate staging. It never creates a PR, touches `main`, bypasses evidence checks or promotes content. A separate ChatGPT Task A execution checks the branch and creates its PR through the connected GitHub app, allowing standard PR CI to run. C and D remain the evidence-review and controlled-merge gates; `needs_review` records remain excluded from public canonical views. This is not automatic publication. See [ingest staging runbook](automation/INGEST_STAGING.md).

## Editorial workflow and AI agents

```text
ChatGPT A (daily OSINT) ---------> source Markdown + sidecar PR
      |                                         |
      +--> merged pending sidecar --> agent/ingest data-only PR
ChatGPT B (IT/EN investigation) --> article draft PR
                                                |
                                  ChatGPT C: review + fixes
                                                |
                               READY_FOR_D at exact PR HEAD
                                                |
                              ChatGPT D: independent recheck
                                   check + evidence-diff
                                                |
                               sequential squash merge to main
                                                |
                                main CI + GitHub Pages deploy
```

**Stale branch handling:** on a strict-protected `main`, each merge can
make other PRs stale. Task D may synchronize only **additions-only
research PRs** by preserving exactly the blob SHA of each C-reviewed
new regular file and using a content-preserving Git merge commit
against the current main tree (or native GitHub update-branch).
It must verify no path/ID/cross-PR collisions, recheck changed files
and CI for the new HEAD, then use expected_head_sha for the ordinary
squash merge. C's factual review of the original blobs is not
misrepresented as review of the technical merge commit. Mutating
existing data, editing articles, changing control-plane code,
deletions and unverifiable dependencies return to C. `strict: true`
is retained. See AGENTS.md.

**Waiver cleanup:** the optional nonrequired `expire-waiver` job runs
on synchronize only when an actual evidence-waiver label is present,
avoiding 403 DELETE failures on unlabeled PRs. The separately
implemented `waiverStatus` invalidates waivers predating a push, even
if a GitHub token cannot remove the label. A genuine denied cleanup
remains visible and is not treated as approval.

**Publication boundary:** merging a source archives it; a separate
ingest PR creates needs_review candidates. An article remains hidden
while needs_review. An investigation is published automatically **only**
when C has completed a substantive AI verification, recorded the
`AI-Verification` provenance and changed article status to
`ai_verified`, D has independently checked the current HEAD and both
required GitHub statuses, and the main Pages deployment has passed.
This AI-only status is distinctly labelled on the site; it is **not**
human editorial authorization. An older draft may be promoted using
a one-file `agent/publish-ART-*` status-and-notes-only PR.
Only authorized humans can promote `reviewed`, `human_approved` or
translation `reviewed`. C and D share a GitHub identity today; their
two passes are not separate GitHub approvals or cryptographic signatures.

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
  changed evidence levels (any direction: levels are not a ranking), new control/financing relationships, hypotheses,
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
  - **Control-plane tripwire** (`controlPlaneFlags`, every branch, attention
    only): one flag per changed file under `CONTROL_PLANE` (workflows,
    CODEOWNERS, check/diff/validate CLIs, policy, diff, article gate,
    validation, publication gate, leak guard, `package.json`, lockfile,
    `AGENTS.md`). It takes no branch name, so renaming a branch cannot avoid
    it, but the job runs the PR head's own code: it makes the change visible,
    it is not a barrier. No such ruleset or code-owner review is currently
    enforced; Task D's prompt-level prohibition on merging control-plane
    changes is an operational policy, not a technical access restriction.
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
- **M6 research design (verified 15 November 2026):** The retired paid
  Anthropic workflow is not reactivated. Four active ChatGPT tasks A/B/C/D
  implement daily OSINT and post-merge ingest PR preparation, three
  investigations per week, active PR fixes, and final conditional merge.
  [Recorded live prompts](automation/CHATGPT_TASK_PROMPTS.md) and
  [run logging](automation/TASK_RUN_LOG.md) specify the exact contracts.
  A central GitHub log issue is not yet configured. CI and Pages deployment
  remain deterministic GitHub Actions operations, not LLM inference.
- **Protection, current:** the maintainer's 15 November CLI output confirms
  classic protection on `main` requires an up-to-date branch
  (`strict: true`), `check` and `evidence-diff`; required PR approval
  count is zero, code-owner and last-push approval are disabled.
  Repository rulesets were absent in the API snapshot. ChatGPT and local
  agents use `amattis96`, so separate task roles are not separate
  identities. Task D may merge ordinary compliant research/data PRs
  after Task C verification; no agent may admin-bypass, waive checks,
  directly push main or merge changes to the control plane.
  Humans retain publication approvals and governance changes.
- **Protection, deferred hardening:** a separate machine identity and
  ruleset-backed owner approval/base-branch check for control-plane
  paths are still advisable. Earlier B01 settings proposals are
  historical, not the live configuration. See
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
| **M6** ChatGPT source and article workflow | Four ChatGPT tasks, deterministic ingest and bilingual pages | A/B/C/D configured 15 November 2026; active prompts archived, ingest PR generation authorized for Task A when executable, first autonomous D merge not yet verified; human editorial approval retained |
| **M7** Dossier design system | Concept, foundations, icon set, logo, illustrations, motion, component and page specs, UI/UX audit (`docs/design/`); implementation in the portal | Done (2026-11-12): themes, shell, evidence stamps, newest-first timeline, evidence board, interactive atlas; deferred items listed in `docs/design/IMPLEMENTATION_PLAN.md` |

### Article editorial approval and link diagnostics

`pnpm check:article-review` is a read-only CI check in the required
`evidence-diff` job, independent of the B02 waiver and strict diff. It compares
article changes against the same merge base and checks the live PR HEAD before
and after paginated reviews. The latest decisive review of a distinct human
reviewer listed in the repository variable `ARTICLE_REVIEWERS` (comma-separated;
unset falls back to `MAINTAINER_LOGIN`, then the repository owner; independent
of the waiver identity) must approve the exact HEAD and contain
`Publication-Approval: ART-0001` with every affected ID; a listed reviewer's
latest `CHANGES_REQUESTED` blocks, and the PR author is never accepted even if
listed. Promotion or modification of reviewed English requires
`Translation-Approval: ART-0001` as well. API errors, malformed data and stale
HEAD fail closed; generic approval and front-matter claims do not count. Because the PR author
cannot self-approve and agents often author PRs from the owner account, a
second human reviewer account must be listed in `ARTICLE_REVIEWERS`. This check
runs the PR head's own code with read-only permissions (inherited B02 limit):
code-owner or ruleset review of `.github/**`, `src/cli/check-*.ts`,
`src/pipeline/article-*.ts` and `package.json` is a maintainer prerequisite
(`.github/CODEOWNERS` already assigns `.github/`, `src/` and `package.json` to
the maintainer; no ruleset is created here). Identity separation and repository
protection remain operational dependencies, and the maintainer must run the
live canary. Marker lines must be at the top level, outside Markdown code fences and quotations.

`validateArticleFiles` emits a warning when no event, relationship or
hypothesis is linked and a complete IT/EN entity name or unambiguous ID occurs
in the text, for entities structurally associated with a public event. It does
not infer a role, add links, or block publication. The static publication gate
checks declared links; it does not establish semantic completeness.

The proposals schema publishes both 1.0 and 1.1 branches at one URL. Corpus code and Markdown filename must match fully with an underscore before the title; formerly accepted malformed prefix matches are rejected. Ingest allocates hypothesis IDs with two-digit minimum and three-digit maximum; exhaustion of any namespace makes the whole plan fatal with no writes. Git history probes the checkout before reading: source archives without a Git checkout warn and show no history; Git operational errors, including buffer exhaustion, fail the build.
