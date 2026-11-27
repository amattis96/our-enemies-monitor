# Discovery queue (PK-09, PK-10)

The authoritative discovery queue lives in this public repository (owner
decision D1, 26 November 2026). Storing an item here is **not** publishing
it: the portal's Laboratory shows only items with `visibility: "publishable"`,
through `projectPublicQueue` and its own moderation rules. Items are
candidates and questions, never facts.

## Layout

```text
docs/discovery/
  meta.json                     { schema_version, updated_at }
  queue/<item id>.json          one file per item (QueueItemSchema)
  negative/<sha256(dedup_key)>.json   permanent negative-verification memory
```

## Integrity guarantees (`src/discovery/queue/`)

- **Deduplication**: `dedup_key` against existing items and the permanent
  negative memory; a refuted or insufficient lead is not re-proposed without
  material novelty.
- **Concurrency**: the state machine checks `revision` and `lease_generation`
  on lease, start and finalize; the store (`store.ts`) rewrites a file only if
  it still holds the revision the run started from, otherwise it refuses.
- **Late outputs**: a result from an expired or superseded lease never
  overwrites the authoritative outcome; it is kept in `late_outputs`.
- **No deletion**: items and negative records are never deleted.
- **Separate fields**: `status`, `disposition` and `epistemic_outcome`
  (`confirmed`, `contradicted`, `insufficient_evidence`, `undeterminable`).
- **Validation**: `pnpm validate:discovery` (part of `pnpm check`).

## Commands

```bash
pnpm discovery:shadow                      # read-only generator run, counts only
pnpm discovery:queue list
pnpm discovery:queue enqueue --run <run_id>
pnpm discovery:queue lease <id> --run <run_id> [--seconds 7200]
pnpm discovery:queue start <id> --run <run_id>
pnpm discovery:queue finalize <id> --run <run_id> --status in_review|closed|failed_technical \
  [--disposition ...] [--outcome ...] [--refs ID,ID] [--reason text]
```

`enqueue` adds only candidates of generators whose activation is not
`shadow` or `disabled`. **Today every generator is `shadow`**, so the stored
queue stays empty: Task E works read-only and reports its outcomes in its Run
Manifest. Promoting a generator out of `shadow` is a recorded owner decision
after the ex-ante/ex-post gate (plan §5.13).

## Authorized persistence path

Changes reach `main` only on `agent/discovery-<YYYYMMDD>[-suffix]` branches
that add or modify files under `docs/discovery/` (never delete, never touch
`data/`), through a non-draft PR reviewed by Task C and merged by
`auto-merge.yml` after `READY_FOR_D`.
