# Run Manifests & Missed-Run Detection (PK-08)

Every scheduled task, GitHub Action, and code agent run records a `RunManifest` validated by `RunManifestSchema` (`src/runs/schema.ts`).

## Engine Version

`ENGINE_VERSION` (`src/engine/version.ts`) is stamped into every manifest so results can be traced back to the exact engine release.

## Public Sanitization

Authoritative manifests live in the private repository and include `queries`, `sources_consulted`, `notes`, and detailed `errors`.

Before crossing into the public repository, `sanitizeRunManifest` (`src/runs/sanitize.ts`):
- Removes `queries`, `sources_consulted`, and `notes`.
- Redacts any error marked `sensitive: true` or matching sensitive patterns (URLs, private source paths, tokens, investigative query terms).

## Independent Missed-Run Detection

A run that never starts cannot report its own failure. `detectMissedRuns` (`src/runs/missed.ts`) reconciles expected `ScheduledSlot` entries against recorded `RunManifest` entries and emits `status: "missed"` manifests once the slot's grace window has elapsed.

CLI usage:

```bash
node src/cli/check-missed-runs.ts --dry-run
```

## Cycle Prevention

Operational metadata commits (manifests, snapshots, generated docs) use `GITHUB_TOKEN` (which does not trigger downstream workflows), and workflows use path filters so they only run when their relevant inputs change.
