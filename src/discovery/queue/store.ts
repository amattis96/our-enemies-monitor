import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { repoPath } from "../../pipeline/paths.ts";
import {
  type DiscoveryQueue,
  DiscoveryQueueSchema,
  type NegativeVerificationRecord,
  NegativeVerificationRecordSchema,
  type QueueItem,
  QueueItemSchema,
} from "./schema.ts";

/**
 * File store of the discovery queue in the single public repository (PK-09,
 * D1, 26 November 2026). Layout under `docs/discovery/`:
 *
 * - `queue/<item id>.json`: one file per item (status, lease, outcome,
 *   transitions, late outputs);
 * - `negative/<sha256(dedup_key)>.json`: permanent negative-verification memory;
 * - `meta.json`: `{ schema_version, updated_at }`.
 *
 * Integrity: items and negative records are never deleted; an item is
 * rewritten only when the file on disk still holds the revision the caller
 * started from (optimistic concurrency on top of the state machine's own
 * revision and lease checks), so a stale or concurrent run cannot overwrite
 * a newer result. Storage in the repository is not publication: the public
 * Laboratory shows only `visibility: "publishable"` items through
 * `projectPublicQueue` and its own moderation rules.
 */
export const DEFAULT_DISCOVERY_DIR = repoPath("docs/discovery");

export class QueueStoreConflict extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QueueStoreConflict";
  }
}

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/;

function itemFile(dir: string, id: string): string {
  if (!SAFE_ID.test(id)) throw new Error(`queue item id "${id}" is not a safe file name`);
  return path.join(dir, "queue", `${id}.json`);
}

export function negativeKey(dedupKey: string): string {
  return createHash("sha256").update(dedupKey, "utf8").digest("hex");
}

function negativeFile(dir: string, dedupKey: string): string {
  return path.join(dir, "negative", `${negativeKey(dedupKey)}.json`);
}

const serialize = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

function readJsonDir(dir: string): { name: string; text: string }[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => ({ name, text: readFileSync(path.join(dir, name), "utf8") }));
}

export type QueueStoreIssue = { file: string; message: string };

/** Load the stored queue and report every contract violation (never throws). */
export function loadDiscoveryQueue(dir: string = DEFAULT_DISCOVERY_DIR): {
  queue: DiscoveryQueue;
  issues: QueueStoreIssue[];
} {
  const issues: QueueStoreIssue[] = [];
  const items: QueueItem[] = [];
  const negative: NegativeVerificationRecord[] = [];
  const dedup = new Map<string, string>();

  for (const { name, text } of readJsonDir(path.join(dir, "queue"))) {
    const parsed = QueueItemSchema.safeParse(safeJson(text));
    if (!parsed.success) {
      issues.push({ file: `queue/${name}`, message: parsed.error.issues[0]?.message ?? "invalid" });
      continue;
    }
    const item = parsed.data;
    if (name !== `${item.id}.json`) {
      issues.push({ file: `queue/${name}`, message: `file name must be ${item.id}.json` });
    }
    const other = dedup.get(item.dedup_key);
    if (other !== undefined) {
      issues.push({ file: `queue/${name}`, message: `duplicate dedup_key with ${other}` });
    }
    dedup.set(item.dedup_key, item.id);
    items.push(item);
  }
  for (const { name, text } of readJsonDir(path.join(dir, "negative"))) {
    const parsed = NegativeVerificationRecordSchema.safeParse(safeJson(text));
    if (!parsed.success) {
      issues.push({
        file: `negative/${name}`,
        message: parsed.error.issues[0]?.message ?? "invalid",
      });
      continue;
    }
    if (name !== `${negativeKey(parsed.data.dedup_key)}.json`) {
      issues.push({
        file: `negative/${name}`,
        message: "file name must be sha256(dedup_key).json",
      });
    }
    negative.push(parsed.data);
  }
  const metaPath = path.join(dir, "meta.json");
  const meta = existsSync(metaPath)
    ? (safeJson(readFileSync(metaPath, "utf8")) as { updated_at?: string })
    : null;
  const queue = DiscoveryQueueSchema.parse({
    schema_version: "1.0.0",
    updated_at: meta?.updated_at ?? "1970-01-01T00:00:00Z",
    items,
    negative_memory: negative,
  });
  return { queue, issues };
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Persist `next`, derived by the state machine from `base` (the queue as
 * loaded). Refuses deletions and any write whose on-disk file differs from
 * `base`: reload and re-apply the transition instead.
 */
export function saveDiscoveryQueue(
  next: DiscoveryQueue,
  base: DiscoveryQueue,
  dir: string = DEFAULT_DISCOVERY_DIR,
): { written: string[] } {
  const parsedNext = DiscoveryQueueSchema.parse(next);
  const baseItems = new Map(base.items.map((i) => [i.id, i]));
  const nextIds = new Set(parsedNext.items.map((i) => i.id));
  for (const id of baseItems.keys()) {
    if (!nextIds.has(id)) throw new QueueStoreConflict(`queue item ${id} cannot be deleted`);
  }
  const baseNegative = new Map(base.negative_memory.map((n) => [n.dedup_key, n]));
  const nextNegative = new Set(parsedNext.negative_memory.map((n) => n.dedup_key));
  for (const key of baseNegative.keys()) {
    if (!nextNegative.has(key)) {
      throw new QueueStoreConflict("negative-verification memory is permanent: no deletions");
    }
  }

  const writes: { file: string; text: string }[] = [];
  const expect = (file: string, previous: unknown) => {
    const onDisk = existsSync(file) ? readFileSync(file, "utf8") : null;
    const expected = previous === undefined ? null : serialize(previous);
    if (onDisk !== expected) {
      throw new QueueStoreConflict(
        `${path.relative(dir, file)} changed since it was loaded (concurrent or stale run); reload and retry`,
      );
    }
  };
  for (const item of parsedNext.items) {
    const previous = baseItems.get(item.id);
    if (previous !== undefined && serialize(previous) === serialize(item)) continue;
    if (previous !== undefined && item.revision <= previous.revision) {
      throw new QueueStoreConflict(`queue item ${item.id} changed without a new revision`);
    }
    const file = itemFile(dir, item.id);
    expect(file, previous);
    writes.push({ file, text: serialize(item) });
  }
  for (const record of parsedNext.negative_memory) {
    const previous = baseNegative.get(record.dedup_key);
    if (previous !== undefined && serialize(previous) === serialize(record)) continue;
    const file = negativeFile(dir, record.dedup_key);
    expect(file, previous);
    writes.push({ file, text: serialize(record) });
  }
  for (const { file, text } of writes) {
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, text, "utf8");
  }
  if (writes.length > 0) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      path.join(dir, "meta.json"),
      serialize({ schema_version: "1.0.0", updated_at: parsedNext.updated_at }),
      "utf8",
    );
  }
  return { written: writes.map((w) => path.relative(dir, w.file)) };
}
