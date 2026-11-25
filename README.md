# Our Enemies Monitor

**Evidence-based mapping of foreign interference, hybrid threats, geopolitical pressure and strategic dependencies affecting Europe.**

Our Enemies Monitor is an independent, open-source and open-data OSINT (open-source intelligence) research and visualization project. Its purpose is to make complex events and relationships easier to explore through a chronological timeline, interactive network graphs, geographic views, actor profiles, and traceable documentary evidence.

The project is being designed as a **multilingual, continuously maintained knowledge base**, with GitHub as the versioned source of truth and AI-assisted research workflows contributing proposed updates.

> **Important distinction:** "Enemies" is the name of the research project, not a legal or investigative designation applied to everyone it mentions. An appearance in the database does not imply wrongdoing, hostile intent, foreign control or complicity. A commercial dependency, political disagreement, shared interest or network connection does not by itself demonstrate an illicit operation or coordination.

## Status

**Phase: M1–M7 implemented; M8–M13 investigative engine implemented across Waves 1–5 (with external acceptance and Data Readiness Gates tracked in `docs/roadmap/progress/`).** Four ChatGPT tasks A/B/C/D handle daily OSINT, investigations, review and controlled merge. Both human-reviewed and separately labelled AI-verified articles are published on the site; incremental and thematic documentary sources are preserved under `sources/` and listed on the homepage and source archive. **Source acquisition does not imply ingestion into canonical `data/`**: the public timeline and graphs remain at their last reviewed canonical baseline until proposals are imported and approved. GitHub Actions validates and deploys on main. Deterministic ingest staging may generate a candidate data-only branch, but a separate PR, Task C/D review and an appropriate public review status are still required before any canonical record appears on the site.

**Live site:** https://amattis96.github.io/our-enemies-monitor/ (Italian) · https://amattis96.github.io/our-enemies-monitor/en/ (English, machine-translated, not yet reviewed).

The initial research corpus has a cutoff of **21 October 2026** and covers **2007–2026**, with earlier context where relevant. These are curated records, not an exhaustive census of all incidents in Europe.

| Baseline component | Records |
| --- | ---: |
| Distinct timeline entries | 147 |
| Graph nodes | 353 |
| Graph edges (all types) | 444 |
| Direct entity-to-entity relationships | 153 |
| Open investigative hypotheses | 22 |
| Additional externally verified records pending timeline integration | 4 |

**Update of 11 November 2026 (Fonte_09):** a first incremental source adds 30 candidate events and 50 web references (22 October–11 November 2026), 10 new hypotheses (H23–H32), 18 entities and 14 sourced relationships. They are pending timeline integration and editorial review, are not part of the baseline counts above, and the 30 items are not 30 independent attacks. Current totals in `data/`: 183 events (147 timeline, 36 pending), 220 entities, 458 relationships (291 event participation, 167 direct), 32 hypotheses, 113 sources, 14 exposures.

The graph includes contextual and event-participation edges. **Not every edge represents financing, operational control or attribution.** These counts describe the structure of the current research corpus and must not be used as a quantitative measure of hostility.

## Documentary archive versus canonical timeline

Merged research sources, including Fonte_09–Fonte_11 and thematic AI/industrial dossiers, are automatically listed in the Observatory homepage and the source archive at build time. This makes source acquisition visible without implying that every proposed event, allegation or hypothesis has been approved. The canonical timeline and graph are built exclusively from validated records in `data/`, under the M5 publication gate. Historical imported records require original provenance and remain provisional. Person relationships require an exact URL match to a directly cited source, their M5 reference, or their own historical original; a match does not certify the claim. Use the M6 sidecar ingestion workflow to propose structured updates, then review records before publication. The source archive date and the last timeline event date are displayed separately.

Real editorial articles were introduced on 13 November 2026; the demo fixture files were removed. The Observatory homepage leads with the latest publishable investigation when available and falls back to the latest published timeline event. Editorials are either `reviewed` by a human or `ai_verified` after C/D automated checks, with visibly distinct labels. A merely `needs_review` article remains withheld. The timeline and graph retain their separate M5 publication gate.

## Research scope

The research examines both **documented hostile activities** and **non-hostile strategic exposures** relevant to European security and autonomy:

- Military aggression, sabotage, cyber operations and intelligence activities.
- Foreign information manipulation and interference (FIMI), elections and political influence.
- Financial networks, intermediaries, lobbying, sanctions and covert funding.
- Critical infrastructure, energy, logistics, satellites, cloud services and industrial supply chains.
- Critical raw materials, semiconductors, dependencies and economic coercion.
- Cross-border consequences of geopolitical crises and European institutional responses.

The geographic scope includes EU member states, other European countries, Ukraine and Europe's strategic neighbourhood, together with relevant connections to the wider world.

## Planned ways to explore the data

| View | Purpose |
| --- | --- |
| **Timeline** | Browse events by date, period, category and evidence status. |
| **Geographic atlas** | Explore affected locations, targets and attributed origins without conflating them. |
| **Network graph** | Follow typed relationships between people, organizations, companies, states and events. |
| **Actor and case profiles** | Examine claims, source documents, dates, disputed details and subsequent developments. |
| **Strategic dependencies** | Trace relevant supply chains, chokepoints and infrastructure exposure. |
| **Updates and corrections** | See newly added material and changes to existing assessments. |

**Internationalization:** English and Italian are intended as initial interface languages, followed by major European languages and progressively broader EU-language coverage. Translations will not alter canonical entity IDs or the meaning and provenance of an attribution. Italian and English texts carry separate change-detection hashes; these do not establish semantic fidelity or reviewer identity. Imports apply only to records fully covered by the supplied dictionary. See the [translation glossary](docs/TRANSLATION_GLOSSARY.md).

## Research corpus

The initial corpus consists of **Fonte_00–Fonte_08**. These source documents are the historical and analytical foundation of the project; they are **not** substitutes for primary-source verification of each individual claim.

| Source | Role |
| --- | --- |
| `Fonte_00` | Initial consolidated dossier and evidentiary vocabulary. |
| `Fonte_01` | Actors, political influence, financing and intermediary networks. |
| `Fonte_02` | Information manipulation, elections and society. |
| `Fonte_03` | Hybrid warfare, sabotage, cyber and security. |
| `Fonte_04` | Industry, energy, technology and strategic dependencies. |
| `Fonte_05` | Global strategies, geopolitical convergence and consequences for Europe. |
| `Fonte_06` | Deduplicated chronology, available as Markdown and CSV with `TL-*` identifiers. |
| `Fonte_07` | Relationship graph, hypotheses and additional evidence, available as Markdown, CSV and GraphML with `G-*` / `H*` identifiers. |
| `Fonte_08` | Strategic consolidation, methodological constraints and requirements for the future portal. |

The baseline currently includes machine-readable CSV files for timeline entries, nodes, edges, hypotheses and additional evidence, as well as a GraphML export. Preserve their identifiers and original files when importing them into a normalized model.

**Source provenance:** some research-document citations refer to search-session IDs rather than permanent public URLs. Before publishing sensitive allegations or identifying a person's responsibility, the relevant original document must be recovered, checked and linked explicitly.

## Evidence and attribution policy

The baseline defines five **evidence levels**. These describe the support for a *specific statement or relationship*, not an entity's overall reputation.

| Level | Meaning | Publication rule |
| --- | --- | --- |
| **E1** | Primary act, judgment, official decision, directly verified fact or technical observation. | Describe exactly what the source establishes. |
| **E2** | Formal attribution by a government, intelligence service or institution. | Attribute explicitly to the issuing authority; do not present it as a criminal conviction. |
| **E3** | Strong independent forensic research, original investigation or corroborated analysis. | Preserve methodology, scope and unresolved issues. |
| **E4** | Allegation, complaint or interested-party statement not publicly corroborated. | Label as an allegation, with source and limits. |
| **E5** | Hypothesis, correlation or scenario. | Keep separate from factual graph edges; never render as an established link. |

Separately, each claim or relationship should record its **evidence status** (such as established, corroborated, disputed, unverified or refuted) and, where appropriate, independent assessments of **attribution confidence** and **impact confidence**.

Guiding principles:

1. **Connection is not causation.** Shared narratives, proximity in a graph and coinciding interests do not establish operational coordination.
2. **Event, perpetrator, sponsor and impact are distinct claims.** Each needs its own evidence.
3. **Institutional attribution is not a court verdict.** Record the exact decision or statement and its date.
4. **A finding may change.** Corrections, acquittals, new evidence and retractions must remain visible and versioned.
5. **The public graph must not imply guilt by association.** Context and participation edges must be distinguishable from control and financing edges.
6. **No false precision.** Unknown dates, figures, ownership shares and causal links should remain unknown.
7. **Counterevidence matters.** Actively seek credible alternative explanations and contradictory findings.

## Technical architecture

The repository is the durable source of truth. A **static-first portal** is built by a deterministic TypeScript pipeline from validated canonical records in `data/`. The historical files under `sources/original/` stay unchanged; the canonical layer preserves their exact IDs, provenance and original values.

| Component | Technology |
| --- | --- |
| Runtime and tooling | Node.js 26, pnpm 12, TypeScript 7, Biome 2, Vitest 5 |
| Data model and validation | Zod 4 schemas, exported as JSON Schema |
| Canonical data | One JSON file per record in `data/`, versioned in Git |
| Public web app | Astro 7 static site with React 19 islands, Tailwind CSS 4, [Dossier design system](docs/design/README.md) |
| Evidence board | Custom SVG island, d3-force build-time layout, d3-zoom; full relationship caveats in the case file and List; case file enters from below on screens narrower than 760 px and scrolls internally |
| Search | Pagefind static index |
| Atlas | Static country-level SVG maps (d3-geo, Natural Earth) |
| Languages | Italian (canonical) and English, translation status tracked per record |
| Publishing | GitHub Actions, GitHub Pages, portable static output |

No database, graph database, map tile server or paid service is needed to build or mirror the site.

**Working with the data:**

```bash
pnpm install
pnpm check        # lint, typecheck, tests, data validation, schema freshness, contrast
pnpm validate     # validate data/ only
pnpm validate:sidecars  # check the archived M6 proposals sidecars and the ingest queue
pnpm validate:articles  # validate content/articles/ and show the publication gate
pnpm build        # build the static site into web/dist (with search index)
pnpm preview      # serve the built site locally
pnpm check:links  # verify every internal link of the built site
pnpm ingest <Fonte_XX.proposals.json>  # dry run of an M6 sidecar ingest (--write to create candidates)
pnpm benchmark:measure  # read-only measurement baseline (audit metrics) as JSON
pnpm benchmark:score <answers.json>  # grade model answers to the B1–B20 benchmark
pnpm cadence:measure --prs <prs.json> --runs <runs.json>  # read-only A/B/C cadence measures (B21) from gh exports and git
pnpm audit:mentions     # read-only queue of entity mentions without an edge (Markdown, or --format json)
```

Read `data/v1/vocabulary.json` first: it defines evidence levels (kinds of basis, not a ranking), classes, statuses and reading rules R1–R5. `data/v1/index.json` is the catalog, with canonical language, published and withheld counts and three distinct freshness dates (commit, latest public event, latest archived source). The manifest lists public and withheld counts and hashes the minimal `withheld.json` registry (ID, collection and generic reasons); withheld detail pages remain 404. Unchanged provisional legacy hypotheses omit unreviewed notes and non-original citations, and link only public events. Both graph downloads are listed with byte sizes and SHA-256 hashes in the data catalog. Evidence graph edges retain the complete bilingual caveat or `null`; hypotheses remain in a separate graph. `data/v1/records/<ID>.json` is the package of one published record (record, citation bound to the commit, IDs of the published records it is linked to; a withheld ID has no package), `data/v1/articles.json` lists the publishable articles and `data/v1/changes.feed.json` is a JSON Feed of the data changes. `data/v1/{events,entities,relationships,hypotheses,sources}.csv` are spreadsheet copies of the same projection (UTF-8 with BOM, Italian and English text columns). On the site, the «Esporta» menu of the timeline, boards, archive and article pages downloads the current filtered view (CSV/JSON), the full collection, a record package, or an article as Markdown or PDF. `data/v1/inferences.json` lists the public forbidden inferences, how each negative caveat is classified and the shortest graph paths between sensitive pairs that cross a composition limit; hypothesis pages show the same annotation (classifications proposed, pending maintainer review), and `/trace/<ID>/` lays each path out step by step with its caveats, interruptions and a «what this trace does not say» summary.

**Full design, data model, validation rules and milestones:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Contributor and agent rules: [AGENTS.md](AGENTS.md).

## M6: four active ChatGPT research and integration tasks

**Verified 15 November 2026:** four ChatGPT product automations are enabled,
independently of repository GitHub Actions, in the `Europe/Rome` timezone:

| Task | Schedule | Responsibility |
| --- | --- | --- |
| **A: OSINT & Ingest** | **Daily 00:30** | Research with 72-hour overlap, immutable `Fonte_XX` Markdown + schema 1.1 sidecar PR; separately prepare a data-only `agent/ingest-*` PR for an earlier **merged** pending sidecar when an executable environment is available |
| **B: Editorial** | **Mon/Wed/Fri 02:00** | Independently research one substantial European case and propose a sourced IT/EN article pair with real translation hashes; editorial status remains `needs_review` |
| **C: Review & Fix** | **Mon/Wed/Fri 03:30** | Independently review evidence and CI, correct supported problems, optionally mark a qualifying article `ai_verified` with provenance or create a status-only publication PR for an older draft, and leave an exact-HEAD handoff |
| **D: Approval & Merge** | **Mon/Wed/Fri 05:00** | Recheck C handoff, diff, risk, freshness, `check` and `evidence-diff`; sequentially squash-merge eligible PRs and verify CI/Pages on the new main HEAD |

See the [scheduled task register](docs/CHATGPT_SCHEDULED_TASKS.md),
[verbatim active prompts](docs/automation/CHATGPT_TASK_PROMPTS.md) and
[run log contract](docs/automation/TASK_RUN_LOG.md).
The tasks run in ChatGPT; neither the prompts nor the schedule in these
Markdown files automatically configure the ChatGPT scheduler.

**Autonomy is gated:** since 21 November 2026 the `auto-merge.yml` GitHub
workflow is the only merger ([details](docs/automation/AUTO_MERGE.md)): it
merges a C-handed-off PR once its checks and `main` CI are green. Task D (retired) was the only agent allowed to merge, and it
cannot use admin bypass, `evidence-waiver`, direct pushes, human APPROVE
reviews or automatic promotion to `reviewed`. C and D use the same GitHub
account today, so their separate reviews are **not independent GitHub
identities**. D can update a stale additions-only research PR by
carrying forward **identical reviewed Git blobs** to the current main
and running fresh CI; content changes or ingest-data edits still
require C to review again. Code-owner review is not required by the current classic
protection; control-plane changes therefore remain maintainer-only.
The mandatory GitHub Actions contexts are `check` and `evidence-diff`
on an up-to-date PR. The next task never assumes its predecessor has finished.
**Ready for review is now automatic:** A/B submit complete research PRs
as non-draft even when local pnpm is unavailable; GitHub CI validates
the committed files and C independently verifies factual claims. C
actively reviews eligible drafts and, after full checks, converts them
to Ready for review before issuing its final handoff. D never merges
drafts. A source PR requires schema/CI, **not** a local dry-run of
the separate later canonical ingest step. Missing evidence still
blocks publication; this workflow does not weaken the M5 gate.

Merging a source adds it to the documentary archive, not `data/`. The
separate deterministic `pnpm ingest` step creates `needs_review`
candidates on an ingest PR, not in CI and not on merge. Merging a `needs_review` article archives a withheld draft; merging an
`ai_verified` article after C/D checks publishes an explicitly identified
**AI-verified investigation**. The site retains evidence-source filtering
and machine-translation notices. Human editorial approval remains required
only to mark an article or translation `reviewed` or set
`human_approved`.

~~~mermaid
flowchart TD
    A["A: OSINT (daily)"] --> S["Source MD + sidecar PR"]
    A --> I["Archived sidecar → data-only ingest PR"]
    B["B: investigations (Mon/Wed/Fri)"] --> R["IT/EN article PR"]
    S --> C["C: review + fixes"]
    I --> C
    R --> C
    C --> H{"Current HEAD ready?"}
    H -->|No| Hold["Fix / further evidence / human decision"]
    H -->|Yes| D["D: independent recheck + mandatory CI"]
    D -->|Pass| M["Sequential squash merge → main"]
    D -->|Fail / pending| Hold
    M --> P["Main CI + Pages deploy"]
    P --> Gate["Article gate: human reviewed or explicitly AI-verified; canonical M5 gate unchanged"]
~~~

## Data model and temporal integrity

The planned normalized data model separates:

- **Entity:** a person, government, agency, company, institution or strategic asset.
- **Event:** a dated incident or decision, potentially spanning a period.
- **Claim:** a precise statement made or supported by one or more sources.
- **Evidence:** the underlying document, investigation or technical observation.
- **Relationship:** a typed and sourced connection between entities or events.
- **Hypothesis:** an open research question, not an established relationship.
- **Exposure:** a measured strategic or economic dependency.
- **Assessment:** a dated analytical judgment with explicit limitations.
- **Correction:** a later amendment, refutation, judgment or retraction.

At minimum, distinguish **when an event happened** from **when it was reported, attributed or entered into the dataset**. Retroactive attribution must not rewrite the date of the underlying event.

## Development roadmap

- [x] Establish the initial research baseline and consolidated analysis.
- [x] Produce timeline CSV, graph CSV/GraphML and hypothesis register.
- [x] Import the 15 original source files into GitHub without losing identifiers or provenance.
- [x] Publish permissive licenses for code and original project data.
- [x] Define and validate normalized schemas and import the baseline into canonical data (M1).
- [x] Add an M5 publication gate for candidates and unsourced named-person relationships (site and exports).
- [x] Add a reproducible publication audit command (`pnpm audit:publication`) and [M5 evidence work queue](docs/M5_EVIDENCE_AUDIT.md).
- [x] First-pass source matching on 36 sensitive relationships (35 referenced, 1 restricted) and 30 Fonte_09 case/reconciliation decisions.
- [x] Stage 20 atomic claims and 26 durable source metadata entries, guarded by `pnpm audit:m5`.
- [x] Record a dated, reproducible measurement baseline and a B1–B20 question benchmark with scorer (`docs/audit/baseline/`).
- [ ] Run the B1–B20 benchmark on at least one pinned external model and archive the scored result.
- [x] Produce a read-only, reviewable queue of text–graph mentions without an edge (`pnpm audit:mentions`, `docs/audit/mentions/`).
- [ ] Human review of the mention queue (outcomes `documented-role` / `context-only` / `false-positive` / `needs-evidence`).
- [x] Register forbidden inferences and annotate graph paths that cross a negative caveat (`docs/audit/inferences/registry.v1.json`, `data/v1/inferences.json`).
- [ ] Human review of the forbidden-inference registry and of the 62 caveat classifications.
- [x] Add the Tracciato page (`/trace/<ID>/`): shortest public path between hypothesis ends with caveats, interruptions and what it does not say.
- [x] Add the rare-earth Filiera and gas before/after on `/dependencies/` and a role matrix on entity pages (B19).
- [x] Publish per-record JSON packages (`data/v1/records/<ID>.json`), an articles index, a changes feed (JSON Feed), minimal JSON-LD, `canonical`/`<time>` markup and a sitemap with `lastmod` — withheld records excluded and tested (B20).
- [x] Add read-only cadence measures for the A/B/C automations (`pnpm cadence:measure`) and propose ADR-08 (B21).
- [ ] Measure 2–4 cycles under the 15 November A/B/C/D schedule, recalibrate K1–K5 and revisit ADR-08 (its original schedule proposal is historical).
- [ ] Case file (Fascicolo del caso) and structured questions, after ADR-06 and reviewed case data.
- [ ] Complete human evidentiary sign-off and integrate/reject Fonte_09 proposals in controlled reviewed changesets.
- [x] Build the interactive timeline, graph and profile pages (M2, Italian MVP).
- [x] Build the geographic atlas and strategic-dependency views (M3).
- [x] Introduce multilingual navigation (Italian/English) with tracked translation status (M3).
- [ ] Review the English machine translations.
- [x] Set up agent-specific research branches, CI checks, evidence diffs and pull requests (M4).
- [x] Implement the M4 contribution/review/CI mechanism and GitHub Pages deployment; retire its legacy paid Anthropic research job in favor of the M6 design.
- [x] Configure daily ChatGPT OSINT Task A (rescheduled to 00:30 Europe/Rome on 15 November) and prove manual source PR write (Fonte_10, PR #3).
- [x] Verify unattended daily ChatGPT-to-GitHub source PR creation (Fonte_12 + sidecar, PR #18; complete CI/ingest validation remains a separate check).
- [x] Implement deterministic, validated and idempotent source-to-canonical ingestion without model API calls (M6: `pnpm ingest` + proposals sidecar contract).
- [x] Require and produce a `Fonte_XX.proposals.json` sidecar in unattended Task A (observed with Fonte_12, PR #18).
- [ ] Run and review canonical ingestion of merged incremental sidecars in separate controlled PRs.
- [x] Implement the article contract, validation, publication gate and IT/EN article pages with Markdown downloads (M6; real approved articles published, demo fixtures removed).
- [x] Reschedule ChatGPT Task B to Mon/Wed/Fri 02:00 Europe/Rome and record its complete active editorial prompt.
- [x] Reschedule ChatGPT Task C to Mon/Wed/Fri 03:30 Europe/Rome with active PR review and repair.
- [x] Create ChatGPT Task D, Mon/Wed/Fri 05:00 Europe/Rome, with exact-HEAD handoff verification, sequential merge and main CI monitoring.
- [x] Configure classic `main` branch protection with zero required PR approvals, `strict: true`, and required `check` plus `evidence-diff` (maintainer output, 15 November 2026).
- [ ] Implement separate agent identity and a hardened control-plane ruleset (B01; intentionally deferred in single-account mode).
- [ ] Verify at least one complete unattended C → D merge and resulting main deploy under the new governance.
- [x] Publish first real bilingual reviewed investigations (ART-0001 and ART-0002); retain human editorial approval for future articles.
- [x] Publish the public portal and its correction policy (changes page, contribution rules).
- [x] Add export menus (filtered timeline and board views, collections as CSV/JSON, entity relationships, articles as Markdown/PDF).
- [x] Design the *Dossier* design system and audit the portal UI/UX ([docs/design/](docs/design/README.md), M7 design).
- [x] Implement the Dossier design in the portal: themes, navigation, evidence stamps, newest-first timeline, investigation board, interactive atlas (M7).
- [x] Import the first incremental source, Fonte_09 (cut-off 11 November 2026), as pending records.
- [ ] Final editorial approval of the 36 person-link assessments (35 now referenced, one still restricted) and of all contested Fonte_09 claims. No record is automatically promoted to reviewed.

## Contributing and corrections

The project welcomes **documented additions, competing interpretations, corrections and technical contributions**. See [CONTRIBUTING.md](CONTRIBUTING.md): use the correction or new-evidence issue forms, or open a pull request; every data pull request gets an automatic evidence diff and a substantive C → D review; control-plane changes and publication approvals still require the maintainer. Proposed updates should include the primary sources, the precise affected records, what is known versus inferred, and any conflicting evidence.

Please do not submit unsupported allegations, personal data without a legitimate research basis, or speculative links as confirmed relationships. Preserve an individual's legal or procedural status accurately. Publication and republication of third-party materials must respect their licenses and applicable law.

## Independence and limitations

This project is an analytical and research tool, **not an official EU, NATO, intelligence, judicial or fact-checking body**. It does not certify the truth of every underlying research document. Its evidence levels are editorial classifications, not judicial findings or scientifically calibrated probabilities.

The corpus is selective, may contain inaccuracies, and requires primary-source auditing before unqualified public presentation of sensitive claims. A missing relationship is not proof of absence, and an unverified hypothesis is not an established fact.

## Licensing: software and open research data

Our Enemies Monitor is intended to be **freely reproducible, forkable, redistributable, self-hostable and reusable for independent research**, including commercial uses.

- **Software:** [MIT License](LICENSE) (`SPDX: MIT`). Covers project-owned executable code, scripts, web app and automation workflows. Redistributors must retain the MIT copyright and license notices.
- **Original research, datasets and documentation:** [CC0 1.0 Universal Public Domain Dedication](LICENSE-DATA.md) (`SPDX: CC0-1.0`). To the extent the project's contributors hold the relevant rights, original analytical text, project-created structured records, compilations, annotations, original translations and documentation are dedicated to the public domain worldwide, with no mandatory attribution or share-alike condition.

CC0 covers the project's own rights only. **Third-party newspaper articles, source excerpts, images, external datasets, basemaps and other externally authored materials are not automatically relicensed.** Their original copyrights, licenses, privacy rights and other legal restrictions remain applicable. See [LICENSE-DATA.md](LICENSE-DATA.md) for the scope and exclusions.

Anyone may fork the repository, publish an independently hosted mirror, and build new analyses on project-created data. Retaining provenance, citations, warnings, corrections and modification history is **strongly encouraged for research integrity**, without adding restrictions to the CC0-dedicated material.

This project does not guarantee that an external mirror is accurate, current or endorsed by its original authors.

---

*Our Enemies Monitor: investigate the links, preserve the evidence, distinguish what is known from what is inferred.*

Article publication requires human editorial authorization. CI checks an
independent maintainer review on the exact PR HEAD with explicit article IDs;
reviewed English translations require a separate marker. This does not replace
the evidence diff or its waiver rules, and the PR author cannot approve their
own work. Article validation also reports possible missing case links as
editorial warnings, without inferring relationships. See the
[article instructions](content/articles/README.md).

The [15 November task register](docs/CHATGPT_SCHEDULED_TASKS.md) records four active automations and their schedules. Their [full, verified prompt snapshot](docs/automation/CHATGPT_TASK_PROMPTS.md) and [run log contract](docs/automation/TASK_RUN_LOG.md) document the operational workflow; a central log issue is not yet configured. Repository documents do not themselves update ChatGPT automations.

New M6 proposals use schema version 1.1; existing 1.0 sidecars remain readable. Corpus source (S) and hypothesis (H) IDs support two digits or 100–999 without leading-zero aliases. See the [M6 contract](docs/M6_CHATGPT_OSINT_WORKFLOW.md) for compatibility and ingest rules. A source archive without a Git checkout builds with a history warning; Git failures in a checkout fail the build.
