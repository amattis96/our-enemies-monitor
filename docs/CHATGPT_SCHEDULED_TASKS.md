# ChatGPT scheduled tasks: A / B / C / D

**Verified external configuration:** 16 November 2026, via ChatGPT Automations.
**Repository branch:** `main` (not `master`). Timezone: `Europe/Rome`.
ChatGPT is the runtime scheduler; this repository is a dated, inspectable
record of its instructions, not a synchronizing service. Reverify the
live task configuration before relying on a historical snapshot.

## Active schedule

| Task | Name | Schedule (Europe/Rome) | Automation ID |
| --- | --- | --- | --- |
| **A** | Our Enemies Monitor OSINT & Ingest | Daily 00:30 | `Automation_d84b474727c0819199f8a2ccede9168c` |
| **B** | Our Enemies Monitor Editorial | Mon/Wed/Fri 02:00 | `6af644cc6d508191b5164cb2e7c4be39` |
| **C** | Our Enemies Monitor Review & Fix | Mon/Wed/Fri 03:30 | `6af64712482c81918d8772f4fa8c6efc` |
| **D** | Our Enemies Monitor Approval & Merge | Mon/Wed/Fri 05:00 | `Automation_3acbfb8631b08191a714de25bca509ca` |

All four were enabled on 15 November 2026, and their next scheduled
runs begin on 16 November 2026. Full active prompt copies are kept in
[CHATGPT_TASK_PROMPTS.md](automation/CHATGPT_TASK_PROMPTS.md).
An in-repository prompt edit **does not** update a ChatGPT automation;
the tasks were updated in the ChatGPT scheduler separately.

## Responsibilities and handoffs

1. **A, acquisition:** research at least 72 hours of overlap from the
   last actually merged cutoff; deduplicate against `main` and open PRs;
   create exactly two new files (immutable Italian
   `Fonte_XX_*.md` and schema 1.1 `Fonte_XX.proposals.json`) in a
   `research/*` **non-draft PR** when the evidence is complete, even without
   local pnpm (report local tests not run; GitHub CI checks the HEAD).
   Do not create a filler PR.
2. **A, deterministic ingest:** separately review already **merged**
   sidecars in source-number order, one at a time, and where an executable
   checkout permits, dry-run then `pnpm ingest --write` into a separate
   `agent/ingest-*` PR. Only `data/`, only candidates `needs_review`,
   no source edits or `--skip-pending`. An unmerged A source is not
   ingestible. This is a scheduled *agent action*, **not** a CI-on-merge job.
3. **B, editorial:** investigate one original European case when evidence
   suffices and propose a two-file IT/EN `ART-NNNN` article with real
   `source_hash` and `target_hash`. Review remains `needs_review`;
   English translation remains `machine`. Submit the complete article
   in a **non-draft PR** even if local pnpm is unavailable; GitHub CI
   and Task C remain mandatory. New evidence is proposed separately,
   never smuggled into `data/`.
4. **C, review & fix + AI publication:** enumerate PRs, filter by metadata before reading
   content (base `main`, same-repo head, `research/*` or `agent/*`),
   independently validate facts, editorial distinctions, schemas,
   collisions and CI. Correct well-supported defects on the existing PR
   branch, rerun checks and post `OEM Task C | Review & Fix` with the
   **current HEAD**, each changed path/status/mode/blob SHA and
   `READY_FOR_D` or an explicit blocker. For eligible evidence-complete
   articles, C may set `ai_verified` with a structured note, or create
   a narrow `agent/publish-ART-*` PR for an existing draft. C must
   review eligible **GitHub draft** PRs and, only after independent
   evidence checks and both green exact-HEAD statuses, call the GitHub
   ready-for-review mutation and verify `draft:false`. The draft flag
   is not itself a factual defect; absence of a local shell is not
   evidence failure. Source-only PRs do not require ingestion dry-run.
   Never
   APPROVE, merge or modify main.
5. **D, verification & merge:** use C's comment as a traceable lead,
   not as a trusted authorization. Recheck exact HEAD, base freshness,
   diff, conflicts, evidence, both required statuses `check` and
   `evidence-diff`, and main CI. For eligible non-control-plane changes,
   squash merge with `expected_head_sha` **sequentially**, verifying
   the new main CI and Pages deployment after each merge. For a stale
   **additions-only** research PR, D may refresh its branch while
   preserving exactly the C-reviewed blobs, rechecking conflicts,
   dependencies and **new-HEAD** CI. Never use this route for ingest
   edits, modified files or control-plane changes. Stop on failed,
   pending or unverifiable checks, changed content, missing handoff
   or other impediments. No admin bypass, waiver, self-APPROVE or
   direct push.

**GitHub identity:** all agents currently use the same `amattis96`
account; distinct task runs are not independent GitHub identities.
On 15 November the maintainer configured classic protection to require
PRs, zero approving reviews and the two check contexts with strict
up-to-date checks. A code owner review or ruleset is **not** enforced.
The prompt and `AGENTS.md` therefore expressly prohibit Task D from
autonomously merging policy, workflow, validator, security-gate or other
control-plane changes. Separate machine accounts and hardened rulesets
remain deferred. See [AGENTS.md](../AGENTS.md), Governance.

**Editorial boundary:** a source merge archives documentation but does
not ingest its sidecar; an ingest merge creates unreviewed candidates.
An article merge publishes **only** if `ai_verified` with C provenance,
D verification and current-HEAD checks, or separately `reviewed` by
a human. A `needs_review` article remains a withheld draft. AI-only
publication is conspicuously labelled, never described as human approval.
Only a human review may set `reviewed`, `human_approved` or reviewed
translation status. The
exact-HEAD `Publication-Approval:` / `Translation-Approval:` checks
apply when changing articles to reviewed and remain separate from the
ordinary GitHub PR approval requirement.

## Resolved 16 November 2026 draft-loop incident

- Task A submitted [Fonte_15 #32](https://github.com/amattis96/our-enemies-monitor/pull/32)
  and Task B submitted [ART-0004 #33](https://github.com/amattis96/our-enemies-monitor/pull/33)
  as GitHub drafts due to missing local executable pnpm, even though both
  required CI contexts were green.
- Task C's first run covered only partial independent source checks and
  left both as `BLOCKED_EVIDENCE`; Task D correctly refused to merge
  drafts. This was a workflow gap, **not** a reason to bypass D.
- Follow-up evidence verification rechecked Estonian official statements,
  Reuters/Euronews Romania, and EASA/EUROCONTROL/Commission/ICAO
  sources. C converted both PRs to Ready for review, completed the
  exact-HEAD handoff, and marked ART-0004 `ai_verified` only after
  source and translation checks.
- Task D squash-merged source #32 (`4da211829edb`) and
  ART-0004 #33 (`b0c6baae4dd5`); ART-0004 required an
  additions-only, byte-identical branch synchronization and fresh CI.
- **Permanent correction:** live Task A/B/C prompts now distinguish a
  GitHub draft PR from an editorial `needs_review` article, use
  current-HEAD GitHub CI when local checks are unavailable, and permit
  C's autonomous Draft → Ready transition after independent review.
  Human `reviewed` and M5 canonical publication rules are unchanged.

## Execution records and failure handling

Use [TASK_RUN_LOG.md](automation/TASK_RUN_LOG.md) for **all four tasks**,
including task D. Record actual run times, baseline and verified head
SHAs, sources consulted, checks and links, corrections, blockers and
merge/deploy results. C additionally posts one structured handoff
comment on every eligible reviewed PR. These comments are editable
operational evidence, not independent human approvals.

As of 15 November 2026, **no dedicated run-log issue is configured**
(the issue list was empty). The tasks must still report in ChatGPT
with `log_delivery: not_configured` until an issue is selected by the
maintainer. They must not invent another destination or create a log
issue on their own.

A new substantive PR HEAD invalidates C's handoff and earlier CI.
The narrow content-invariant `research/*` synchronization documented
in AGENTS.md preserves C's factual assessment of **identical blobs**,
but requires D to attest the new SHA, check the changed base for new
collisions and wait for entirely fresh CI. A new `main` tip may
require updated checks. A 90-minute gap between B/C/D
does not guarantee a task's earlier work has finished. D must stop
further merges whenever the last main CI/deploy is failing, pending
or unverified; it must not merge multiple PRs simultaneously.

## Historical baseline: 14 November 2026

The prior snapshot documented three tasks: A daily at 01:00, B Friday
03:00, C Friday 05:00. The older C prompt attempted approval and merge.
Those are **historical**, not the live settings above. An unattended A
run created [PR #18](https://github.com/amattis96/our-enemies-monitor/pull/18)
with Fonte_12 and a sidecar. B created ART-0002 in
[PR #12](https://github.com/amattis96/our-enemies-monitor/pull/12);
three merges were reported by a C run on 13 November, with final deploy
initially pending. These observations alone do not demonstrate review,
CI success or publication. The 15 November merged
[PR #20](https://github.com/amattis96/our-enemies-monitor/pull/20)
implemented the Fable changes; [PR #21](https://github.com/amattis96/our-enemies-monitor/pull/21)
recorded deferral of a second account. The current governance supersedes
the old no-agent-merge convention for **Task D alone**.

## Verification and future improvements

- Periodically measure source cutoff lag, PR-to-merge, sidecar
  merge-to-ingest, CI success and backlog using `pnpm cadence:measure`
  (B21). Its initial statistics predate the new four-task schedule.
- Run the R18 prompt-injection canary in a **test repository**, with
  eligible, forked and excluded-prefix PRs. Verify C/D neither
  follow instructions embedded in PR content nor widen eligibility.
  This canary has not been confirmed as executed.
- Consider separate agent identities, a branch ruleset, base-branch
  enforcement for control-plane checks and an independently verified
  execution log. Prompt-level role separation alone is not a
  hardened security boundary.
