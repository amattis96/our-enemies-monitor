import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { repoPath } from "../pipeline/paths.ts";
import { canonicalizeJson } from "./hash.ts";

export const SNAPSHOT_TRANSITION_TYPES = [
  "snapshot.accepted",
  "deployment.failed",
  "snapshot.published",
  "snapshot.superseded",
  "snapshot.withdrawn",
] as const;
export type SnapshotTransitionType = (typeof SNAPSHOT_TRANSITION_TYPES)[number];

export const SNAPSHOT_TIMESTAMP_PRECISIONS = ["second", "minute", "hour", "day"] as const;
export type SnapshotTimestampPrecision = (typeof SNAPSHOT_TIMESTAMP_PRECISIONS)[number];

export const SNAPSHOT_STATUSES = [
  "accepted",
  "deployment_failed",
  "published",
  "superseded",
  "withdrawn",
] as const;
export type SnapshotStatus = (typeof SNAPSHOT_STATUSES)[number];

export const UtcTimestamp = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/,
    "must be a UTC ISO-8601 timestamp ending in Z",
  );

export const SnapshotVersionsSchema = z.strictObject({
  dataset: z.string().min(1).describe("Dataset version identifier."),
  portal: z.string().min(1).describe("Portal build version identifier."),
  schema: z.string().min(1).describe("Canonical schema version identifier."),
  engine: z.string().min(1).describe("Temporal/pipeline engine version identifier."),
});
export type SnapshotVersions = z.infer<typeof SnapshotVersionsSchema>;

export const SnapshotTransitionEventSchema = z.strictObject({
  event_id: z.string().min(1).describe("Unique identifier of this transition event."),
  snapshot_id: z.string().min(1).describe("Identifier of the snapshot whose state transitions."),
  transition: z.enum(SNAPSHOT_TRANSITION_TYPES).describe("Append-only lifecycle transition kind."),
  commit: z
    .string()
    .regex(/^[0-9a-f]{7,40}$/)
    .describe("Git commit SHA associated with this snapshot transition."),
  recorded_at: UtcTimestamp.describe("UTC timestamp when the transition was recorded."),
  precision: z
    .enum(SNAPSHOT_TIMESTAMP_PRECISIONS)
    .describe("Declared precision of the recorded_at UTC timestamp."),
  versions: SnapshotVersionsSchema.describe(
    "Dataset, portal, schema, and engine versions at this transition.",
  ),
  dataset_hash: z
    .string()
    .regex(/^[0-9a-f]{64}$/)
    .describe("Deterministic SHA-256 hash of the dataset excluding snapshots and manifests."),
  idempotency_key: z
    .string()
    .min(1)
    .describe("Key preventing duplicate transition events on retry."),
  supersedes: z
    .string()
    .min(1)
    .nullable()
    .optional()
    .describe("Optional snapshot ID superseded by this transition."),
  reason: z
    .string()
    .min(1)
    .nullable()
    .optional()
    .describe("Optional reason for failure or withdrawal."),
});
export type SnapshotTransitionEvent = z.infer<typeof SnapshotTransitionEventSchema>;

export const SnapshotSummaryTransitionSchema = z.strictObject({
  event_id: z.string().min(1).describe("Transition event ID."),
  transition: z.enum(SNAPSHOT_TRANSITION_TYPES).describe("Transition kind."),
  recorded_at: UtcTimestamp.describe("UTC timestamp of the transition."),
  precision: z.enum(SNAPSHOT_TIMESTAMP_PRECISIONS).describe("Declared timestamp precision."),
  reason: z.string().min(1).nullable().optional().describe("Optional failure or withdrawal note."),
});

export const SnapshotSummarySchema = z.strictObject({
  snapshot_id: z.string().min(1).describe("Snapshot identifier."),
  status: z.enum(SNAPSHOT_STATUSES).describe("Current derived lifecycle status of the snapshot."),
  accepted_at: UtcTimestamp.nullable().describe("UTC timestamp when accepted, or null."),
  published_at: UtcTimestamp.nullable().describe("UTC timestamp when published, or null."),
  superseded_at: UtcTimestamp.nullable().describe("UTC timestamp when superseded, or null."),
  withdrawn_at: UtcTimestamp.nullable().describe("UTC timestamp when withdrawn, or null."),
  commit: z
    .string()
    .regex(/^[0-9a-f]{7,40}$/)
    .describe("Git commit SHA for the snapshot."),
  dataset_hash: z
    .string()
    .regex(/^[0-9a-f]{64}$/)
    .describe("Deterministic dataset SHA-256 hash."),
  versions: SnapshotVersionsSchema.describe("Versions associated with the snapshot."),
  transitions: z
    .array(SnapshotSummaryTransitionSchema)
    .describe("Ordered list of transitions applied to this snapshot."),
});
export type SnapshotSummary = z.infer<typeof SnapshotSummarySchema>;

export const SnapshotIndexSchema = z.strictObject({
  schema_version: z.literal("1.0.0").describe("Snapshot index format version."),
  generated_at: UtcTimestamp.describe("UTC timestamp when this index was generated."),
  inception_at: UtcTimestamp.nullable().describe(
    "Earliest accepted/published timestamp in the registry, or null if empty.",
  ),
  event_count: z.number().int().nonnegative().describe("Total transition events in the registry."),
  latest_accepted_snapshot_id: z
    .string()
    .min(1)
    .nullable()
    .describe("Most recent non-withdrawn accepted/published/superseded snapshot ID."),
  latest_published_snapshot_id: z
    .string()
    .min(1)
    .nullable()
    .describe("Most recent currently published snapshot ID."),
  snapshots: z
    .array(SnapshotSummarySchema)
    .describe("Aggregated snapshot summaries in chronological order."),
});
export type SnapshotIndex = z.infer<typeof SnapshotIndexSchema>;

export const DEFAULT_SNAPSHOTS_DIR = repoPath("docs/snapshots");

export type RecordTransitionInput = {
  snapshot_id: string;
  transition: SnapshotTransitionType;
  commit: string;
  recorded_at?: string;
  precision?: SnapshotTimestampPrecision;
  versions: SnapshotVersions;
  dataset_hash: string;
  idempotency_key?: string;
  event_id?: string;
  supersedes?: string | null;
  reason?: string | null;
};

export type StoredTransitionRecord = {
  filePath: string;
  event: SnapshotTransitionEvent;
};

export function eventsDirOf(snapshotsDir = DEFAULT_SNAPSHOTS_DIR): string {
  return path.join(snapshotsDir, "events");
}

export function indexPathOf(snapshotsDir = DEFAULT_SNAPSHOTS_DIR): string {
  return path.join(snapshotsDir, "index.json");
}

export function defaultIdempotencyKey(
  input: Pick<RecordTransitionInput, "snapshot_id" | "transition" | "commit" | "dataset_hash">,
): string {
  return `${input.snapshot_id}:${input.transition}:${input.commit}:${input.dataset_hash}`;
}

/** Read all append-only transition events from `docs/snapshots/events/`. */
export function readSnapshotEventFiles(
  snapshotsDir = DEFAULT_SNAPSHOTS_DIR,
): StoredTransitionRecord[] {
  const dir = eventsDirOf(snapshotsDir);
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }

  const records = names
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => {
      const filePath = path.join(dir, name);
      const raw = JSON.parse(readFileSync(filePath, "utf8")) as unknown;
      return {
        filePath,
        event: SnapshotTransitionEventSchema.parse(raw),
      };
    });

  records.sort((a, b) => {
    const timeCmp = a.event.recorded_at.localeCompare(b.event.recorded_at);
    if (timeCmp !== 0) return timeCmp;
    return a.filePath.localeCompare(b.filePath);
  });

  return records;
}

export function readSnapshotEvents(
  snapshotsDir = DEFAULT_SNAPSHOTS_DIR,
): SnapshotTransitionEvent[] {
  return readSnapshotEventFiles(snapshotsDir).map((item) => item.event);
}

/** Aggregate ordered transition events into the snapshot registry index. */
export function buildSnapshotIndex(
  events: readonly SnapshotTransitionEvent[],
  generatedAt = new Date().toISOString(),
): SnapshotIndex {
  const ordered = [...events].sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
  const bySnapshot = new Map<string, SnapshotSummary>();
  const order: string[] = [];

  for (const event of ordered) {
    let summary = bySnapshot.get(event.snapshot_id);
    if (!summary) {
      summary = {
        snapshot_id: event.snapshot_id,
        status: "accepted",
        accepted_at: null,
        published_at: null,
        superseded_at: null,
        withdrawn_at: null,
        commit: event.commit,
        dataset_hash: event.dataset_hash,
        versions: event.versions,
        transitions: [],
      };
      bySnapshot.set(event.snapshot_id, summary);
      order.push(event.snapshot_id);
    }

    summary.commit = event.commit;
    summary.dataset_hash = event.dataset_hash;
    summary.versions = event.versions;
    summary.transitions.push({
      event_id: event.event_id,
      transition: event.transition,
      recorded_at: event.recorded_at,
      precision: event.precision,
      ...(event.reason !== undefined ? { reason: event.reason } : {}),
    });

    switch (event.transition) {
      case "snapshot.accepted":
        if (summary.accepted_at === null) summary.accepted_at = event.recorded_at;
        if (summary.status !== "withdrawn" && summary.status !== "superseded") {
          summary.status = "accepted";
        }
        break;
      case "deployment.failed":
        if (summary.status !== "published" && summary.status !== "withdrawn") {
          summary.status = "deployment_failed";
        }
        break;
      case "snapshot.published":
        if (summary.withdrawn_at === null) {
          summary.published_at = event.recorded_at;
          summary.status = "published";
        }
        break;
      case "snapshot.superseded":
        if (summary.withdrawn_at === null) {
          summary.superseded_at = event.recorded_at;
          summary.status = "superseded";
        }
        break;
      case "snapshot.withdrawn":
        summary.withdrawn_at = event.recorded_at;
        summary.status = "withdrawn";
        break;
    }
  }

  const snapshots = order
    .map((id) => bySnapshot.get(id))
    .filter((item): item is SnapshotSummary => item !== undefined);

  const inceptionCandidates = ordered
    .filter((e) => e.transition === "snapshot.accepted" || e.transition === "snapshot.published")
    .map((e) => e.recorded_at);
  const inceptionAt = inceptionCandidates[0] ?? ordered[0]?.recorded_at ?? null;

  const nonWithdrawnAccepted = snapshots.filter(
    (s) => s.status === "accepted" || s.status === "published" || s.status === "superseded",
  );
  const published = snapshots.filter((s) => s.status === "published");

  const index: SnapshotIndex = {
    schema_version: "1.0.0",
    generated_at: generatedAt,
    inception_at: inceptionAt,
    event_count: ordered.length,
    latest_accepted_snapshot_id: nonWithdrawnAccepted.at(-1)?.snapshot_id ?? null,
    latest_published_snapshot_id: published.at(-1)?.snapshot_id ?? null,
    snapshots,
  };

  return SnapshotIndexSchema.parse(index);
}

/** Rebuild and write `docs/snapshots/index.json` from `docs/snapshots/events/`. */
export function writeSnapshotIndex(
  snapshotsDir = DEFAULT_SNAPSHOTS_DIR,
  generatedAt?: string,
): SnapshotIndex {
  const events = readSnapshotEvents(snapshotsDir);
  const index = buildSnapshotIndex(events, generatedAt);
  mkdirSync(snapshotsDir, { recursive: true });
  writeFileSync(indexPathOf(snapshotsDir), canonicalizeJson(index), "utf8");
  return index;
}

function sanitizeFilenamePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-");
}

/**
 * Append a transition event to `docs/snapshots/events/` and rebuild `index.json`.
 * Idempotent on retry: if an event with the same `idempotency_key` (or same
 * snapshot_id + transition + commit + dataset_hash) already exists, no duplicate
 * file is written.
 */
export function recordSnapshotTransition(
  input: RecordTransitionInput,
  snapshotsDir = DEFAULT_SNAPSHOTS_DIR,
): {
  created: boolean;
  event: SnapshotTransitionEvent;
  filePath: string;
  index: SnapshotIndex;
} {
  const eventsDir = eventsDirOf(snapshotsDir);
  mkdirSync(eventsDir, { recursive: true });

  const idempotencyKey = input.idempotency_key ?? defaultIdempotencyKey(input);
  const existing = readSnapshotEventFiles(snapshotsDir);

  const duplicate = existing.find(
    (item) =>
      item.event.idempotency_key === idempotencyKey ||
      (item.event.snapshot_id === input.snapshot_id &&
        item.event.transition === input.transition &&
        item.event.commit === input.commit &&
        item.event.dataset_hash === input.dataset_hash),
  );

  if (duplicate) {
    const index = writeSnapshotIndex(snapshotsDir);
    return {
      created: false,
      event: duplicate.event,
      filePath: duplicate.filePath,
      index,
    };
  }

  const seq = String(existing.length + 1).padStart(4, "0");
  const recordedAt = input.recorded_at ?? new Date().toISOString();
  const eventId =
    input.event_id ??
    `evt-${seq}-${sanitizeFilenamePart(input.snapshot_id)}-${sanitizeFilenamePart(input.transition)}`;

  const event = SnapshotTransitionEventSchema.parse({
    event_id: eventId,
    snapshot_id: input.snapshot_id,
    transition: input.transition,
    commit: input.commit,
    recorded_at: recordedAt,
    precision: input.precision ?? "second",
    versions: input.versions,
    dataset_hash: input.dataset_hash,
    idempotency_key: idempotencyKey,
    ...(input.supersedes !== undefined ? { supersedes: input.supersedes } : {}),
    ...(input.reason !== undefined ? { reason: input.reason } : {}),
  });

  const fileName = `${seq}_${sanitizeFilenamePart(input.snapshot_id)}_${sanitizeFilenamePart(input.transition)}.json`;
  const filePath = path.join(eventsDir, fileName);
  writeFileSync(filePath, canonicalizeJson(event), "utf8");

  const index = writeSnapshotIndex(snapshotsDir);
  return {
    created: true,
    event,
    filePath,
    index,
  };
}
