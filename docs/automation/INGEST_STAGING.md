# Deterministic OSINT ingest staging runbook

**Scope:** staging unreviewed canonical candidates only. This workflow cannot publish records or merge pull requests.

## Problem this solves

ChatGPT Task A can research and open source/sidecar pull requests through the connected GitHub app, but its scheduled runtime may not have a checkout, DNS access or Node/pnpm. Consequently the earliest merged sidecar (S12 on 18 November 2026) remains pending even when source PRs and GitHub Pages builds succeed. No change to the ChatGPT subscription or a paid model API is required to run a deterministic importer on GitHub Actions.

The `.github/workflows/stage-ingest.yml` workflow is the **execution bridge**, not a review bypass:

1. After a successful `CI` workflow on a `main` push, it runs on the **current trusted main tip**, skipping stale triggering commits. It is also manually dispatchable.
2. It chooses the first archived sidecar in source-number order for which the corresponding `data/sources/SNN.json` corpus document is absent or does not reference that source Markdown.
3. If any `agent/ingest-*` PR is already open or the intended `agent/ingest-fonte-NN` branch already exists, it stops without creating duplicate work.
4. It runs `pnpm ingest <sidecar> --json` (dry run) and **stops** on any unresolved `conflict`, `rejected`, fatal issue or validation error. No `--skip-pending`, manual sidecar edit, force import or automatic correction is allowed.
5. For an eligible plan it runs the deterministic write, `pnpm format:data`, `pnpm check`, and strict `pnpm data:diff`. It checks that only `data/` changed and that the branch still descends from the latest `main`.
6. It prepares a verified Git bundle in a read-only job, transfers it as a short-lived workflow artifact, and uses an isolated write-only job that executes no repository code to push `agent/ingest-fonte-NN` with `contents:write` permission. **It does not open a PR**, because GitHub Actions triggered by its own `GITHUB_TOKEN` would not start the normal PR workflows. It does not merge or publish.
7. On its next daily run, **ChatGPT Task A** retrieves the staging run and branch through its GitHub connection. It must verify the successful run on the correct `main` commit, the latest head, candidate review statuses and the exact `data/` diff, then open a regular PR from the prepared branch to `main`. This GitHub-app-created PR triggers ordinary `check` and `evidence-diff` CI. If `main` moved, A leaves the branch unsubmitted and reports `STAGING_STALE`: the new staging workflow must rebuild the branch safely; no blind rebase of canonical data.
8. Task C performs the same independent substantive review as for other `agent/ingest-*` PRs. Task D can merge after a corresponding current-head handoff and both required checks, with no administrator bypass. New canonical records remain `needs_review` and **are excluded from the public timeline and graph until separately authorized**.

## Failure handling and observability

- **No pending sidecar:** successful no-op.
- **Earlier sidecar blocked:** the workflow fails with the source number, reconciliation classifications, and validation errors in its logs. It cannot skip S12 to ingest S13 or later.
- **Existing prepared branch:** successful no-op; Task A must inspect and either open its PR or document why it cannot.
- **Existing ingest PR:** successful no-op; the PR must complete review/merge first.
- **Branch lacks evidence of a successful staging run:** Task A must not create an ingest PR on its own.
- **CI on the staged PR fails:** C repairs only justified faults; never weakens schemas, review rules or ignores rejections.
- **Actions lacks push permissions:** the workflow fails visibly, and a maintainer must inspect repository Actions permission settings. Never add long-lived tokens or expose secrets to work around this blindly.
- **GitHub Pages:** the existing main CI/deploy continues unchanged. Successful staging or merging an unreviewed ingest PR must not claim that proposed facts became public.

## One-time activation and expected backlog

This is a control-plane change and is **not eligible for autonomous Task D merge**. The maintainer must check and merge the workflow PR after its `check` and `evidence-diff` checks pass. Its first successful execution should stage the oldest archived sidecar, initially S12. It may reveal real sidecar conflicts; these must be resolved through a separately reviewed data or sidecar-policy process, not bypassed.

No additional paid API, GitHub App secret, personal access token or third-party secret is necessary for staging: GitHub Actions can push a candidate branch via an isolated publisher job, while the existing ChatGPT GitHub connector opens the subsequent PR.

Task C and D now run daily, with two passes at 03:30/04:30 and 05:00/06:00 Europe/Rome respectively. Those retries handle a one-minute post-merge CI, but do not guarantee that unlimited queued PRs clear in the same night; source and ingest queues must be monitored for backlog growth.
