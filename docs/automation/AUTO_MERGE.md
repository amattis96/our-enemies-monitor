# Automated integration gate (`auto-merge.yml`)

**Introduced 21 November 2026 by maintainer decision.** Replaces the merge
step of ChatGPT Task D. Task D failed every run because its GitHub connector
returns only pull-request workflow runs: it could never see the push CI and
Pages deploy of `main`, so its own gate ("stop if main CI is unverifiable")
closed every time. GitHub branch protection never blocked those merges.

## What runs

| Job | Token | Code | Does |
| --- | --- | --- | --- |
| `decide` | `GITHUB_TOKEN`, read scopes | `node src/cli/auto-merge.ts` from `main` | Collects facts, picks at most one action |
| `act` | `AUTOMERGE_TOKEN` secret, else `GITHUB_TOKEN` | none (fixed `gh api` calls) | Squash merge pinned to the HEAD SHA, branch update, or CI dispatch |

Triggers: every 30 minutes, after each `CI` / `Evidence diff` run, on a new or
edited `OEM Task C` PR comment, and manual dispatch. Runs are serialized.

## Merge conditions (all required)

Implemented and tested in `src/pipeline/auto-merge.ts`:

1. Base `main`, head branch in this repository, not draft.
2. Branch and paths: `research/*` (add under `sources/incremental/`,
   `sources/thematic/`; add or edit `content/articles/`), `agent/ingest-*`
   (add or edit `data/`), `agent/publish-ART-*` (edit `content/articles/`).
   Anything else, including the control plane, is never auto-merged.
3. No `evidence-waiver` or `automerge:hold` label.
4. The **latest** comment starting `OEM Task C | Review & Fix` written by the
   maintainer login contains `READY_FOR_D`, no negative token
   (`NOT READY_FOR_D`, `BLOCKED_*`, `PENDING_CHECKS`, `PENDING_C`, `STALE`)
   and names a commit of the PR. If the PR moved since that commit, the
   changed-file inventory (path, status, blob SHA) must be identical.
5. `check` and `evidence-diff` succeeded on the current HEAD.
6. The latest CI run (push or dispatch) of the current `main` succeeded,
   which includes the Pages deploy job.

One action per run, oldest PR first: a merge moves `main`, and the next merge
waits for its CI. Evidence, publication (`ai_verified` vs human `reviewed`)
and article-review rules are unchanged: they are enforced by Task C and by
the required checks.

## Maintainer settings

- **Recommended:** secret `AUTOMERGE_TOKEN`, a fine-grained personal access
  token limited to this repository with *Contents*, *Pull requests* and
  *Actions* read/write. Merges and branch updates made with `GITHUB_TOKEN`
  do not trigger other workflows; with the PAT, stale PRs are updated
  automatically (`strict: true` stays) and push CI runs on merge.
- Without the secret: merges still work, CI on `main` is dispatched
  explicitly, but PRs that fall behind `main` are reported, not updated.
- Kill switch: repository variable `AUTOMERGE_ENABLED=false`.
- Per-PR hold: label `automerge:hold`.

The run summary of each `Auto-merge` run lists every open PR with its
decision and reason.
