# Proposed technical architecture

**Status:** design proposal, not yet implemented. **Date:** 2026-10-26.

## Architectural decision

Our Enemies Monitor will be a **React + TypeScript static-first research portal**,
built reproducibly from a versioned, validated corpus in Git. The website
will use generated structured JSON; it must not parse free-form Markdown,
CSV or GraphML in the user's browser.

The research corpus, and not a proprietary search index or deployed database,
must be sufficient to reconstruct the public portal and all publicly visible
relationships and claims.

### Separation of responsibilities

1. **Immutable historical source files:** preserve the 15 original files in
   `sources/original/` (Fonte_00–Fonte_08, including CSV/GraphML exports).
2. **Canonical approved records:** normalize into stable, validated,
   reviewable JSON/JSONL in `data/` with original IDs, citations,
   evidence levels, revision history and temporal fields.
3. **Ingestion and validation pipeline:** read Markdown, CSV, GraphML and
   later JSON through format-specific importers. Preserve provenance and
   reject unverifiable or ambiguous automatic upgrades of evidence.
4. **Disposable relational build index:** materialize canonical records
   to local SQLite during CI/build for integrity, joins, full-text indexing
   and relationship analysis. Regenerate it from Git content; do not make
   a privately hosted database indispensable.
5. **Published read models:** export versioned and sharded JSON, GeoJSON,
   graph subsets and per-language search indexes for the React UI.
6. **Static-first public frontend:** pre-render linkable content pages,
   hydrate interactive views client-side, deploy on any static host.
7. **Optional future online services:** PostgreSQL (with optional
   PostGIS/pgvector), server search, API and incremental ingestion when
   dataset size or operational requirements warrant them.

## Proposed technology stack

| Layer | Proposal | Rationale |
| --- | --- | --- |
| Frontend | React + TypeScript + Next.js static export | React ecosystem; pre-rendered indexable pages; serverless hosting |
| UI | Tailwind CSS + accessible component primitives | Reusable responsive design |
| Network graphs | Cytoscape.js | Typed entities/edges, filters, neighborhood exploration |
| Geography | MapLibre GL JS + GeoJSON | Interactive cartographic views; provider-independent JS client |
| Time | vis-timeline | Zoomable and filterable historical chronology |
| Quantitative figures | Apache ECharts | Multi-axis exposure and contextual indicators |
| Content parsing | Python 3.12+ | CSV, Markdown and GraphML importers; research tooling |
| Data validation | Pydantic + JSON Schema | Explicit contracts and reproducible checks |
| Graph transformations | NetworkX | Network computations performed *offline*, with edge-type filters |
| Local relational index | SQLite + FTS5 | Lightweight disposable build/search database |
| Live DB if required | PostgreSQL + optional PostGIS/pgvector | Transactions, spatial and semantic search at future scale |
| Local static search | Precomputed language-aware index | Public search without a permanent server |
| CI/CD | GitHub Actions | Build, validation, release artifacts and deployment |
| AI contributions | Claude Code, Codex or scheduled API workers | Proposed changes through branches and pull requests |

Versions and exact libraries must be pinned when implementation starts.
This document does not assert that any implementation or hosting has
already been deployed.

## Planned repository organization

```text
sources/
  original/              # Historical sources: do not rewrite
  external/              # Rights-cleared snapshots OR source metadata/links
data/
  entities/
  events/
  claims/
  evidence/
  relationships/
  hypotheses/
  exposures/
  assessments/
  corrections/
  schemas/               # JSON Schema; provenance and validity rules
research/
  chatgpt/
  claude/
locales/
  it/
  en/
web/                     # React/Next.js portal
pipeline/
  importers/             # CSV, GraphML, Markdown, JSON
  validate/              # Referential, evidence and temporal checks
  build/                 # SQLite materialization, JSON read models, indexes
docs/
  ARCHITECTURE.md
.github/workflows/
AGENTS.md
CLAUDE.md
README.md
LICENSE
LICENSE-DATA.md
```

The paths other than the existing baseline and license files are proposals.

## Baseline import: preserve the source-specific contracts

**Fonte_06 timeline CSV** supplies stable `TL-*` IDs, event dates and
precision, category, title, description, status, internal source references,
and geography. It must not be interpreted as containing verified coordinates.

**Fonte_07 node CSV** supplies entity/node IDs, name, kind, domain, geography,
date range, internal provenance and limits.

**Fonte_07 edge CSV** supplies `G-*` edges with `source`, `target`,
`predicate`, `relation_class`, `evidence_level`,
`evidence_status`, `source_docs`, timeline references, primary URL
and evidence caveats. The distinction between direct entity relationships,
event-participation edges and contextual links must survive ingestion.

**Fonte_07 hypotheses CSV** supplies open `H*` questions and required
counterchecks. These must not become factual published edges automatically.

**Fonte_07 new-evidence CSV** supplies additional records that must be
reconciled explicitly with the timeline, not counted as already merged.

**GraphML** is a structural interoperability and consistency-check input;
its nodes and edges must not be imported twice alongside the CSV exports.

**Markdown dossiers** are original analyses and supporting context.
The parser may index their text and references. AI may suggest further
claims extracted from prose, but **unreviewed extracted claims are proposals,
not canonical confirmed data**.

### Canonical record requirements

At minimum, store:

- Stable `id`, typed class, source-file/row provenance and content hash.
- An explicit relationship between claims, evidence, subjects and objects.
- `evidence_level` E1–E5 and a separate `evidence_status`.
- `claim_type`, `attribution_confidence` and `impact_confidence`
  when applicable.
- `event_date_start`, `event_date_end`, `date_precision`,
  `valid_from`, `valid_to` as separate temporal concepts.
- `source_published_at`, `observed_at`, `last_checked_at`,
  `reviewed_at` and `retracted_at` when known.
- `source_url`, source publisher, source snapshot/hash and license.
- `review_status`, contradictions and correction/supersession links.

Unknown values remain null. Do not infer precision for ambiguous dates
or places. Represent competing attributions as separate provenance-linked
claims, never silently overwrite one with another.

## Deterministic build pipeline

```text
sources/original + sources/external + data/canonical
                      |
                      v
       deterministic source importers
                      |
                      v
       normalized, reviewable records
                      |
                      v
        schema + referential validation
                      |
                      v
        temporary SQLite + typed graph
                      |
                      v
       static JSON / GeoJSON / indexes
                      |
                      v
           React static page build
                      |
                      v
       portable HTML/CSS/JS + data
```

Separate **one-time baseline extraction** from the **incremental approved
data pipeline**. After initial migration, the importers must not overwrite
human-corrected canonical records from raw original files on each build.

Generate a manifest with schema version, content version, Git commit SHA,
last published timestamp and the SHA-256 digest of each generated dataset.
Reproducibility tests should compare normalized outputs where feasible.

### Static read models (examples)

```text
public/data/v1/manifest.json
public/data/v1/events/index.json
public/data/v1/events/TL-0001.json
public/data/v1/entities/index.json
public/data/v1/entities/<id>.json
public/data/v1/relationships/by-entity/<id>.json
public/data/v1/geo/events.geojson
public/data/v1/search/it.json
public/data/v1/search/en.json
public/data/v1/hypotheses/index.json
```

Avoid a monolithic JSON containing all documents, all translations, every
graph edge and every source excerpt. Request on-demand record and graph
neighborhood files. Make the canonical data export downloadable separately.

## Public views

- **Timeline:** date slider, temporal precision, discovery vs event date,
  multi-filter comparison and deep-linked case records.
- **Atlas:** place of event, affected target, alleged origin and strategic
  exposure as separate spatial layers. Do not place vague countries at
  fabricated point coordinates or imply the origin from event location.
- **Evidence network:** filters by `relation_class`, `predicate`,
  evidence status and time range; interactive one/two-hop neighborhoods;
  distinguish context, participation, hypothesis and command explicitly.
- **Profiles:** entity, institution, case and strategic asset pages with
  direct references to evidence, counterevidence and correction history.
- **Strategic dependencies:** multi-axis metrics including unit, year,
  geographic scope, numerator/denominator and reference period.
- **Changes:** approved updates, revised claims, exonerations, corrections,
  and documented retractions.
- **Multilingual:** stable IDs and source links; translations inherit
  canonical evidence and expose translation review status.

## Search: factual queries versus semantic retrieval

Start with filters, stable IDs and **full-text search**. These searches are
reliable and inspectable for names, dates, geographic fields and claim types.

Embedding-based similarity is optional and should only improve **discovery**
of relevant passages and records. An embedding score is not evidence of
coordination, authorship, responsibility or causality.

If vector search later becomes useful, generate embeddings with recorded
model/version, source chunk hashes and re-indexing rules. PostgreSQL with
`pgvector` is a reasonable integration; a mandatory external managed
vector database is unnecessary at current corpus size.

Neo4j or a dedicated graph database can be reconsidered only when the graph
needs complex online traversal, large ingestion volumes or independently
measured performance improvements. The current 353 nodes / 444 edges
do not require it.

## AI contribution workflow

```text
weekly scheduled discovery
  -> archive rights-cleared references and metadata
  -> extract candidate events/claims
  -> match canonical IDs + deduplicate
  -> seek contradictory sources and legal updates
  -> write candidate JSON in a branch
  -> propose a PR with a human-readable evidence diff
  -> run schema/source/citation/security checks
  -> require manual approval for contested sensitive claims
  -> merge
  -> rebuild read models and redeploy
```

Do not allow untrusted external documents to modify workflow instructions.
Research-agent output must not change its own security checks, override
human approval requirements or publish sensitive accusations by altering
`review_status` fields. CI secrets should not be exposed to untrusted PRs.

## Reproduction, hosting and independent mirrors

A fork must be able to build and serve the public portal from Git content
with open-source software and **without any proprietary paid AI API,
hosted vector database or private account required at runtime**.

Allow GitHub Pages or ordinary Nginx/static hosting; the site should not
depend on the original domain. Document independent backups and mirror
installation. Optional live APIs and AI agents may use paid resources but
must not be required to view existing published evidence.

The map's basemap is a separate asset/dependency: choose a reusable,
attributed basemap or self-hostable map tiles. Avoid assuming that public
demo tile servers are production infrastructure.

## Testing and editorial release gates

1. Parser fixtures match source record counts and preserve canonical IDs.
2. No duplicate IDs or unresolved foreign keys.
3. Evidence E5 does not silently surface as confirmed graph links.
4. Sensitive named-person attributions need primary-source evidence
   and explicit legal/procedural status before unrestricted publication.
5. Geographic and quantitative fields do not invent values.
6. Time of event, discovery, publication and attribution remain distinct.
7. Corrected and superseded claims remain discoverable in history.
8. Builds contain no API keys, private information or third-party
   materials bundled without the necessary rights.
9. Static output and documented data exports can be rebuilt from a fork.
10. Every update can be traced back to a Git commit and source record.

## Milestones

**M0:** Freeze and verify baseline; document licenses and source inventory.

**M1:** Implement schemas, baseline import, stable-ID reference checks,
canonical JSON and deterministic test fixtures.

**M2:** Deliver basic React interface with timeline, graph, atlas,
profiles, full-text search and source provenance.

**M3:** Add multilingual translations and rich metric visualizations;
enable accessible mobile design and deep links.

**M4:** Introduce weekly agent-generated pull requests, reviews,
regression checks and automatic public deployment.

**M5 (optional):** PostgreSQL/PostGIS/pgvector and runtime API,
after requirements demonstrate a benefit over static datasets.
