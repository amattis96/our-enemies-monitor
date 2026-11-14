# ChatGPT scheduled agents: operating model and current cadence

**Project:** Our Enemies Monitor
**Configuration snapshot:** 14 November 2026 (Europe/Rome)
**Status:** Three enabled ChatGPT product automations; settings and run history inspected on this date.
**Scope:** Repository-updating research, editorial production, and pull-request review. This is operational documentation, **not** a request to change any schedule or an authorization for a new agent.

> **Where the configuration lives.** The schedules and full operational prompts are configured in the project owner's **ChatGPT scheduled tasks**, outside GitHub. Their current configuration is not executable from this repository. This file records a dated, human-readable snapshot; the actual ChatGPT task settings are authoritative if a cadence or prompt changes. The repository is the source of truth for versioned content, schemas, code, review status, and publication. These tasks are **not GitHub Actions running an LLM**, not a cron service deployed with the site, and not paid model API jobs.

## 1. Overview: three separate agents

| Agent | Actual ChatGPT task name | Schedule (Europe/Rome) | Main responsibility | GitHub output | May merge? |
| --- | --- | --- | --- | --- | --- |
| **A: Acquisition** | **Our Enemies Monitor OSINT** | **Daily, 01:00**, including weekends | Monitor new OSINT developments, verify and deduplicate them | A new `Fonte_XX` research Markdown **plus** `Fonte_XX.proposals.json`, submitted as one PR | **No** |
| **B: Investigation** | **Our Enemies Monitor Editorial** | **Friday, 03:00**, weekly | Independently investigate an original topic and write a complete bilingual article | `ART-NNNN.it.md` and `ART-NNNN.en.md`, submitted as one PR | **No** |
| **C: Review and integration** | **Our Enemies Monitor Review** | **Friday, 05:00**, weekly | Review the entire open-PR queue, validate evidence and CI, merge only eligible changes | Reviews, comments; narrowly scoped fix PRs if needed | **No** (adopted rule; the maintainer merges). The task prompt still has to be updated, see §4 |

All three tasks are enabled and configured with the `Europe/Rome` timezone and exact-time scheduling. Times describe *configured triggers*, not guaranteed execution or publication deadlines; platform latency, failures, authorization, and the required reviews may delay or prevent changes. Daylight saving is handled by the named timezone.

The Friday sequence is nominally **A at 01:00 → B at 03:00 → C at 05:00**, leaving two hours between scheduled starts. A still runs on every other day. There is **no separate daily PR merge, canonical ingestion, editorial approval, or publication automation** in the inspected ChatGPT task configuration.

## 2. Agent A: incremental OSINT acquisition

**Trigger:** once per day, at 01:00 local time.

**Mission:** detect *material, sourced changes* affecting Europe, including new incidents, later attributions to existing incidents, judicial outcomes, corrections, sanctions, FIMI, cyber/hybrid operations, and industrial or geopolitical dependencies. An absence of reliable new material is a valid no-PR outcome.

**Execution contract, as configured:**

1. **Refresh actual state.** Read the current `main` SHA, `AGENTS.md`, `docs/ARCHITECTURE.md`, `.github/agent/research-prompt.md`, relevant M6 instructions, `sources/incremental/`, canonical `data/` IDs, editorial audits, and **all open PRs and proposed files**. Never infer the latest source, allocated ID, or cutoff from a prior run or a saved prompt.
2. **Set a time window.** Read the last *merged* source's actual coverage cutoff and search through the present run with **at least 72 hours of overlap**. Include late reports and changes in assessment of older events. Material in open PRs is used for deduplication but does **not** advance the merged baseline.
3. **Research and corroborate.** Prefer primary institutional and judicial sources, technical/forensic findings, credible original investigations, and explicit competing evidence. Separate event, perpetrator, sponsor, motive and impact; distinguish E1–E5 and legal/procedural statuses.
4. **Reconcile candidates.** Compare against the original corpus, `data/`, archived incremental sources and pending PRs. Do not count several reports on one attack as several attacks, or shared interests as a proven command structure. Tag change types such as `NEW_EVENT`, `NEW_ATTRIBUTION`, `NEW_EVIDENCE`, `CORRECTION` and `STRATEGIC_UPDATE`.
5. **Create two synchronized files only when justified.** Choose a collision-free `Fonte_XX` number, branch from current `main` and produce:
   - `sources/incremental/Fonte_XX_Aggiornamento_OSINT_Eventi_Reti_Europa_YYYY-MM-DD.md` with source metadata, findings, evidence links, caveats, cases, possible connections, open questions, corrections and acquisition log.
   - `sources/incremental/Fonte_XX.proposals.json` with schema version `1.0`, matching metadata, bibliography keys and typed operations for **candidate** canonical changes.
6. **Validate as available.** Follow `docs/M6_CHATGPT_OSINT_WORKFLOW.md` ``4.2–4.7, `schemas/proposals.schema.json` and the sidecar fixture. Where execution is possible, run `pnpm ingest <sidecar>` **without** `--write` to dry-run. Distinguish syntactic/structural checks from a successful full ingest/CI check.
7. **Submit, do not integrate.** Create a dedicated research branch and a PR to `main` containing **exactly the new Markdown and its sidecar**. Do **not** alter `data/`, previously merged research, original sources, approval statuses, or unrelated code. Do **not** merge. Report the PR and any tests actually performed.

**If no sufficiently strong, nonduplicate evidence exists:** report the scan and rejected candidates; do not create empty files or PRs.

**Important distinction:** the Markdown is a human-readable source. The sidecar is a proposal for a *separate* deterministic ingest. Neither is a reviewed canonical record, a verified attribution by the project, or permission to publish an allegation.

## 3. Agent B: independent investigative and editorial research

**Trigger:** weekly on Friday at 03:00 local time.

**Mission:** choose **one original, evidentially supportable investigation** relevant to Europe and produce a substantive, source-linked article in Italian plus a full English translation. This work is different from A's daily incremental news scan.

**Execution contract, as configured:**

1. Refresh `main`, project rules, M6 article contracts, existing articles, hypotheses, canonical entities/events/relationships/sources, relevant primary and incremental source documents, thematic dossiers, and **open PRs**.
2. Select a topic autonomously based on substantive evidence and research opportunity. Avoid duplicate published or proposed investigations. Look beyond the existing corpus with independent up-to-date research.
3. Construct a traceable account of chronology, actors, documented relations, counterevidence, alternative interpretations, uncertainties and European consequences. Apply E1–E5 to individual claims; do not infer illicit coordination from topology or proximity.
4. Allocate the next unused `ART-NNNN` ID only after checking merged content **and open PRs**. Create exactly:
   - `content/articles/ART-NNNN.it.md`: canonical Italian article and complete metadata/references, with `review.status: needs_review`;
   - `content/articles/ART-NNNN.en.md`: faithful English translation, `translation.status: machine` and **actual** `source_hash` of the Italian source.
5. Open a dedicated article PR against `main`, without changing `data/` or previously merged documents. Record potential new canonical evidence as **proposals**, not silent changes to the graph.
6. Check `pnpm validate:articles`, `pnpm check`, PR CI and translation hashes where available; report **unexecuted or pending** checks accurately. Do not merge, self-approve editorially, or mark the translation reviewed.

**If there is no defensible original investigation:** report the evidence gaps instead of writing filler.

**Publication boundary:** merging an article file is not the same as publishing it. The existing article publication gate withholds `needs_review` articles until a human makes the appropriate editorial decision. GitHub PR approval and record-level editorial approval are distinct.

## 4. Agent C: PR reviewer and conditional integrator

**Trigger:** weekly on Friday at 05:00 local time.

**Mission:** review the **entire open-PR queue**, including A/B research PRs, sidecars, canonical ingest PRs, code changes and documentation. Under the adopted governance (decision D2, [B01 analysis](audit/fable-2026-11/blocks/B01_ANALYSIS.md)) C is **review-only and does not merge**; the maintainer approves and merges. The execution contract below is the *configured* prompt, which still describes conditional merging until the maintainer updates it in ChatGPT.

**Identity and permissions (as of 14 Nov 2026):** the tasks act through the ChatGPT Codex Connector GitHub App **as the maintainer's own account with admin role** (`performed_via_github_app` is set on 14 of 18 PRs). Classic branch protection has `enforce_admins` off and the 16 merges so far happened without the required review. Merges cannot be attributed to a task from the API. The target (machine account with Write role, rulesets on `main` and on agent branches) is adopted but **not yet applied**; until it is, none of the "no administrator bypass" or "insufficient permission" statements below is technically enforced.

**Execution contract, as configured:**

1. Read current `main` and the complete open-PR list. Inspect each PR's changed files, head SHA, comments and unresolved reviews, overlaps/conflicts, checks, and applicable M5/M6 publication rules.
2. Perform a **substantive review**, not only a lint or green-CI check: verify key research claims and URLs with appropriate primary/independent sources, dates, legal status, counterevidence and IT/EN correspondence; review software for security, regressions and guardrail preservation.
3. Merge only PRs that are non-draft, nonconflicting, with required current-SHA checks green, no blocking reviews, suitable verified evidence, and sufficient permission. A formal `APPROVE` review may be attempted when allowed; self-approval is not permitted. *Adopted rule: C does not merge or approve; it leaves a review comment with the checks it performed.*
4. Use an eligible **squash merge** to `main`, without force or administrator bypass (*adopted rule: this step is performed by the maintainer, not by C*). **Before merging**, check the latest CI on `main`. **After each merge**, refresh the HEAD and verify its CI, build, link checks and GitHub Pages deployment before proceeding to another merge. Stop further merges on failure or unresolved/pending verification.
5. When an integration reveals a narrowly scoped obsolete test or similar deterministic issue, C may prepare a **minimal fix PR**, without weakening validation or publication gates. Other uncertain/problematic PRs remain open with specific review notes.
6. Do not change `review.status` or `translation.status` to `reviewed`, do not set `human_approved: true`, do not promote E5 hypotheses to factual edges, and do not alter canonical evidence on the basis of an AI-only review.

**A source-only or `needs_review` article PR can be merged as a versioned archive/draft** once factually and technically sound *if no explicit human pre-merge approval is required* (configured prompt; under the adopted rule every merge requires the maintainer's approval). That merge does **not** itself confer editorial approval or publish the article. If a PR explicitly requires human sign-off, C leaves it open.

**Failure mode:** if CI, evidence, permissions, review status or current HEAD cannot be verified, C must report the blocker and leave the PR open, not assume success.

## 5. What happens after a PR is merged?

A and B **produce PRs**; C or a human reviewer **may merge them**. The subsequent behavior depends on the artifact.

| Artifact merged to `main` | Immediate consequence | **Not** automatic |
| --- | --- | --- |
| A: `sources/incremental/Fonte_XX*.md` and `Fonte_XX.proposals.json` | Immutable research source is versioned; the Markdown can appear in the site's documentary archive via the normal build | No automatic import of the sidecar; no addition of its candidate events to the public timeline |
| B: `content/articles/ART-*.it.md` + `.en.md` | Article files and metadata become part of Git history | No public article while `needs_review`; no automatic human editorial or translation approval |
| A later `agent/ingest-*` PR changing `data/` | After review/merge, validated canonical candidate records exist in Git | No automatic promotion of `needs_review` records to integrated/reviewed/public |
| An approved edit to `data/` | Validated, publication-eligible records may enter static exports/website on the next successful build | No implicit approval of unrelated records or speculative claims |
| Code, documentation or design PR | Repository change is versioned; the same CI/deployment flow applies | No guarantee of deploy if CI fails |

### Canonical ingest is a distinct, currently manual step

The `pnpm ingest` CLI is implemented but **not an enabled ChatGPT scheduled task** and is **not automatically run by GitHub Actions on merge**.

After a source/sidecar PR is merged, a maintainer or authorized coding agent can perform:

~~~bash
git switch main && git pull
git switch -c agent/ingest-fonte-XX
pnpm ingest sources/incremental/Fonte_XX.proposals.json
pnpm ingest sources/incremental/Fonte_XX.proposals.json --write
pnpm format:data && pnpm check
pnpm data:diff --base origin/main --agent
# Open a separate PR with the candidate changes under data/
~~~

The importer validates operations, allocates supported canonical IDs, checks lexical/URL matches and conflicts, and writes **`needs_review`** candidates. It does not apply speculative E5 relations as facts, override published records, or grant approval. See [the M6 ingest specification](M6_CHATGPT_OSINT_WORKFLOW.md#4-repository-driven-ingest-the-proposals-sidecar-and-pnpm-ingest).

The corpus/archive date therefore may be newer than the canonical timeline, graph and strategic indicators. That difference is intentional and **must be visible in analysis of freshness and automation performance**.

### Review and publication gates

- `src/site/publication.ts` determines the publishable projection of canonical `data/` records; unreviewed candidates and pending timeline events are withheld.
- `src/site/articles.ts` and the article validation contracts determine which articles are publicly visible.
- `docs/M5_EVIDENCE_AUDIT.md` describes unfinished claim-level verification and human sign-off.
- E1 acts, E2 institutional attributions, E3 independent evidence, E4 allegations and E5 hypotheses remain distinct. A successful pipeline, PR merge or institutional source citation is not automatic proof of guilt.

## 6. GitHub Actions: deterministic CI and deployment, not AI execution

The repository workflow is [`.github/workflows/ci.yml`](../.github/workflows/ci.yml).

| Trigger | Jobs / checks | Consequence |
| --- | --- | --- |
| Pull request | `check` executes `pnpm check`, `pnpm build` and `pnpm check:links`; `evidence-diff` checks record changes, including stricter checks for `agent/*` branches | Technical validation and review evidence; **not** an editorial verdict |
| Push to `main` | `check` validates and builds; `deploy` publishes a prepared artifact to GitHub Pages after the check job succeeds | Updates the static portal, subject to successful jobs and publication gates |

The workflow uses a concurrency group and cancellation for overlapping runs; sequential merges should verify each relevant run to avoid treating a cancelled or pending build as successful.

The site is **static-first** (Astro/TypeScript, `data/` JSON, versioned source documents); there is no hosted database behind these tasks, and the build does not call a paid LLM API.

## 7. Observed operation as of 14 November 2026

The **task settings were inspected directly**. The following is an observation of specific runs, not a claim of flawless recurring performance:

| Task | Last inspected run | Observable result |
| --- | --- | --- |
| A | **14 Nov 2026**, scheduled 01:00 | Opened [PR #18](https://github.com/amattis96/our-enemies-monitor/pull/18) with `Fonte_12` Markdown and M6 sidecar; full `pnpm ingest` / CI verification was **not** performed within that run. PR remained open at this snapshot. |
| B | **13 Nov 2026**, scheduled 03:00 | Produced [PR #12](https://github.com/amattis96/our-enemies-monitor/pull/12), bilingual investigation `ART-0002`, initially `needs_review`; no local `pnpm check` was run in that execution. Subsequent repository history may differ from the run report. |
| C | **13 Nov 2026**, scheduled 05:00 | Reported three merges, with two article PRs initially withheld for human editorial review. Its final GitHub Pages CI/deploy was **pending at the moment it reported**, not independently claimed successful here. Later commits on `main` show the articles were subsequently integrated. |

These examples establish that unattended ChatGPT-to-GitHub research PR creation and conditional PR merges have occurred, performed through the Codex Connector acting as the maintainer's account; **they do not establish** that every task reliably completes all checks, that C always clears the queue, or that any record was human-approved.

## 8. Evaluation questions for a future architecture / cadence review

These are **open questions**, not proposed changes already adopted:

1. **Freshness versus review lag:** Is daily acquisition + weekly integration enough for breaking attributions, corrections, sanctions and legal outcomes? Should urgency or materiality influence the review cadence?
2. **Friday timing:** Is a two-hour gap between A, B and C sufficient for research completion, GitHub CI, human review and sequential verification, or should the review run at a different time/day?
3. **Ingestion backlog:** Which reviewed sources never become canonical events or relations because the sidecar import remains manual? What measurable queue and age thresholds would justify a dedicated *candidate-ingest* workflow without bypassing editorial gates?
4. **Separation of duties:** Can Task C's independence, evidence verification, PR authorship conflicts and human sign-off be made more explicit or auditable?
5. **Data freshness indicators:** Should source acquisition, sidecar validation, ingest review, canonical integration, article review, and successful public deployment each expose independent dates/statuses?
6. **Quality metrics:** Track daily scan coverage, valid new findings, duplicates, source independence, false positive corrections, sidecar parse/ingest success, PR dwell time, CI failures and post-merge deploy success without rewarding volume for its own sake.
7. **Queue/race management:** How should an agent respond when A and B propose overlapping material or IDs, or C changes `main` while an agent is still researching?
8. **Recovery:** What should happen after missed runs, GitHub permissions failures, CI delays, broken source URLs or a failed deploy? When are reruns, escalation and human intervention appropriate?
9. **Threat-model alignment:** How can agents resist prompt injection, coordinated evidence laundering and source poisoning while preserving independent corroboration and counterevidence?
10. **Resource use:** Would variable cadence, batching, event-triggered rechecks or thematic rotations reduce duplicated work without creating blind spots?

Any recommendation must preserve the existing **M5 human editorial gate, M6 deterministic ingest, Git-versioned provenance, published/unpublished separation, and the prohibition on upgrading hypotheses into facts without evidence**.

## 9. References and maintenance

**Repository contracts**

- [AGENTS.md](../AGENTS.md), mandatory agent and contributor rules.
- [docs/ARCHITECTURE.md](ARCHITECTURE.md), implemented architecture and publication design.
- [docs/M6_CHATGPT_OSINT_WORKFLOW.md](M6_CHATGPT_OSINT_WORKFLOW.md), M6 source/sidecar and article specifications. Some historical planning/status prose in that document predates the three active task schedules; **use this dated file for the current task-cadence snapshot**, and the M6 document for the technical contracts.
- [docs/M5_EVIDENCE_AUDIT.md](M5_EVIDENCE_AUDIT.md), evidentiary review status and human sign-off requirements.
- [content/articles/README.md](../content/articles/README.md), bilingual article authoring contract.
- [`.github/workflows/ci.yml`](../.github/workflows/ci.yml), actual CI and GitHub Pages deploy jobs.
- [`src/site/publication.ts`](../src/site/publication.ts) and [`src/site/articles.ts`](../src/site/articles.ts), public projection gates.

**Maintenance rule:** When a ChatGPT task's schedule, prompt, permissions, identity, responsibilities or merge policy changes, update **this snapshot and the README link** in the same documentation change. GitHub alone cannot verify external ChatGPT task settings. Do not interpret a stale document as live task state.
