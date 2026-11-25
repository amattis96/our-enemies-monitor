# Snapshot Transition Events

Append-only lifecycle transition events for dataset snapshots (`PK-05`).

Each JSON file in this directory represents a single immutable transition:
- `snapshot.accepted`
- `deployment.failed`
- `snapshot.published`
- `snapshot.superseded`
- `snapshot.withdrawn`

Do not edit or delete existing event files. To rebuild the aggregate index (`docs/snapshots/index.json`), run:

```sh
node src/cli/snapshot.ts index
```
