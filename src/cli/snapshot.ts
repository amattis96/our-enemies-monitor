import { execFileSync } from "node:child_process";
import { parseArgs } from "node:util";
import { REPO_ROOT } from "../pipeline/paths.ts";
import {
  computeDatasetHash,
  DEFAULT_SNAPSHOTS_DIR,
  hashDataset,
  recordSnapshotTransition,
  SNAPSHOT_TIMESTAMP_PRECISIONS,
  SNAPSHOT_TRANSITION_TYPES,
  type SnapshotTimestampPrecision,
  type SnapshotTransitionType,
  writeSnapshotIndex,
} from "../temporal/index.ts";

function usage(): string {
  return [
    "Usage: node src/cli/snapshot.ts <command> [options]",
    "",
    "Commands:",
    "  record   Append a snapshot transition event and rebuild docs/snapshots/index.json",
    "  index    Rebuild docs/snapshots/index.json from docs/snapshots/events/",
    "  hash     Compute deterministic SHA-256 hash of the canonical dataset",
    "",
    "Options for record:",
    "  --snapshot <id>           Snapshot identifier (required)",
    "  --transition <type>       Transition type (required)",
    "  --commit <sha>            Git commit SHA (defaults to HEAD)",
    "  --recorded-at <utc>       UTC ISO timestamp (defaults to now)",
    "  --precision <p>           second | minute | hour | day (default: second)",
    "  --dataset-version <v>     Dataset version (default: 0.1.0)",
    "  --portal-version <v>      Portal version (default: 0.1.0)",
    "  --schema-version <v>      Schema version (default: 1.0.0)",
    "  --engine-version <v>      Engine version (default: 1.0.0)",
    "  --dataset-hash <sha256>   Dataset SHA-256 hash (defaults to computed hash)",
    "  --idempotency-key <key>   Optional idempotency key",
    "  --supersedes <id>         Optional superseded snapshot ID",
    "  --reason <text>           Optional failure or withdrawal reason",
    "  --snapshots-dir <dir>     Override docs/snapshots directory",
  ].join("\n");
}

function currentHeadCommit(): string {
  return execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  }).trim();
}

function run(): void {
  const [subcommand, ...rest] = process.argv.slice(2);
  if (!subcommand || subcommand === "--help" || subcommand === "-h") {
    console.log(usage());
    process.exit(subcommand ? 0 : 1);
  }

  if (subcommand === "hash") {
    const { values } = parseArgs({
      args: rest,
      options: {
        "data-dir": { type: "string" },
      },
    });
    const result = computeDatasetHash(
      values["data-dir"] !== undefined ? { dataDir: values["data-dir"] } : undefined,
    );
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (subcommand === "index") {
    const { values } = parseArgs({
      args: rest,
      options: {
        "snapshots-dir": { type: "string", default: DEFAULT_SNAPSHOTS_DIR },
      },
    });
    const index = writeSnapshotIndex(values["snapshots-dir"]);
    console.log(
      `Rebuilt snapshot index (${index.event_count} event(s), ${index.snapshots.length} snapshot(s))`,
    );
    return;
  }

  if (subcommand === "record") {
    const { values } = parseArgs({
      args: rest,
      options: {
        snapshot: { type: "string" },
        transition: { type: "string" },
        commit: { type: "string" },
        "recorded-at": { type: "string" },
        precision: { type: "string", default: "second" },
        "dataset-version": { type: "string", default: "0.1.0" },
        "portal-version": { type: "string", default: "0.1.0" },
        "schema-version": { type: "string", default: "1.0.0" },
        "engine-version": { type: "string", default: "1.0.0" },
        "dataset-hash": { type: "string" },
        "idempotency-key": { type: "string" },
        supersedes: { type: "string" },
        reason: { type: "string" },
        "snapshots-dir": { type: "string", default: DEFAULT_SNAPSHOTS_DIR },
      },
    });

    if (!values.snapshot || !values.transition) {
      console.error("Missing required --snapshot and --transition options.\n");
      console.error(usage());
      process.exit(1);
    }

    const transition = values.transition as SnapshotTransitionType;
    if (!SNAPSHOT_TRANSITION_TYPES.includes(transition)) {
      console.error(
        `Invalid --transition "${values.transition}". Expected one of: ${SNAPSHOT_TRANSITION_TYPES.join(", ")}`,
      );
      process.exit(1);
    }

    const precision = values.precision as SnapshotTimestampPrecision;
    if (!SNAPSHOT_TIMESTAMP_PRECISIONS.includes(precision)) {
      console.error(
        `Invalid --precision "${values.precision}". Expected one of: ${SNAPSHOT_TIMESTAMP_PRECISIONS.join(", ")}`,
      );
      process.exit(1);
    }

    const commit = values.commit ?? currentHeadCommit();
    const datasetHash = values["dataset-hash"] ?? hashDataset();

    const result = recordSnapshotTransition(
      {
        snapshot_id: values.snapshot,
        transition,
        commit,
        precision,
        versions: {
          dataset: values["dataset-version"],
          portal: values["portal-version"],
          schema: values["schema-version"],
          engine: values["engine-version"],
        },
        dataset_hash: datasetHash,
        ...(values["recorded-at"] !== undefined ? { recorded_at: values["recorded-at"] } : {}),
        ...(values["idempotency-key"] !== undefined
          ? { idempotency_key: values["idempotency-key"] }
          : {}),
        ...(values.supersedes !== undefined ? { supersedes: values.supersedes } : {}),
        ...(values.reason !== undefined ? { reason: values.reason } : {}),
      },
      values["snapshots-dir"],
    );

    console.log(
      JSON.stringify(
        {
          created: result.created,
          event: result.event,
          filePath: result.filePath,
        },
        null,
        2,
      ),
    );
    return;
  }

  console.error(`Unknown command "${subcommand}".\n`);
  console.error(usage());
  process.exit(1);
}

run();
