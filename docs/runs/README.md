# Run Manifests & Missed-Run Detection (PK-08)

Every scheduled task (A, B, C, E, F), GitHub Action and code agent run records
a `RunManifest` validated by `RunManifestSchema` (`src/runs/schema.ts`), also
when the run has no results, is partial or fails.

## Storage in the single repository (D1, 26 November 2026)

Manifests live in this public repository, one file per run:

```text
docs/runs/manifests/<run_id>.json
```

- **run_id**: `<task>-<YYYYMMDD>T<hhmmss>Z` (actual UTC start), only letters,
  digits, `.`, `_`, `-`. The file name must equal the run_id.
- **Append-only**: a run is recorded once; `recordRunManifest`
  (`src/runs/store.ts`) refuses to overwrite an existing manifest with
  different content, so concurrent writers never overwrite each other.
- **Minimized, not hidden** (`src/runs/minimize.ts`): OSINT queries and public
  source URLs are kept. Removed: credentials and tokens, URL userinfo and
  authentication parameters, messages of errors flagged `sensitive: true`.
  Ordinary investigative terms, public URLs and source paths are not sensitive.
- **Validation**: `pnpm validate:runs` (part of `pnpm check`) checks schema,
  file name, uniqueness, absence of secrets and minimized canonical form.

## Authorized persistence path

So that source, ingest, article and queue PR contracts stay unchanged, a
manifest never travels inside those PRs. It reaches `main` on its own branch:

1. Branch `agent/runs-<task>-<YYYY>-W<ww>` (one per task and ISO week), created
   from `main` if missing.
2. Add only `docs/runs/manifests/<run_id>.json` (status A); with a shell use
   `pnpm runs:record <file.json>`, which minimizes and validates.
3. One non-draft PR per branch, `chore(runs): <task> <YYYY>-W<ww> run manifests`.
4. The path policy (`src/pipeline/policy.ts`) allows only additions under
   `docs/runs/manifests/` and `docs/audit/ai-benchmarks/runs/` on these
   branches; Task C reviews them like any `agent/*` PR and `auto-merge.yml`
   merges after `READY_FOR_D`.

Without GitHub write access the task reports the manifest JSON in its run
report and records that persistence was not available.

## Public summary

`/stato` shows a compact summary of each stored manifest (status, timing,
provider/model, versions, cost, non-sensitive errors) via
`loadPublicRunManifests` (`src/engine/manifest.ts`).

## Independent Missed-Run Detection

A run that never starts cannot report its own failure. `detectMissedRuns`
(`src/runs/missed.ts`) reconciles expected `ScheduledSlot` entries against
recorded `RunManifest` entries and emits `status: "missed"` manifests once the
slot's grace window has elapsed. A started run is never `missed`.

```bash
node src/cli/check-missed-runs.ts --dry-run
```

## Cycle Prevention

No workflow writes manifests to `main`: they arrive through ordinary PRs, so
no commit made with a token can retrigger the pipeline. Merging a manifest PR
runs CI and deploy once, like any other PR.
