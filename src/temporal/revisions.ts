import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { COLLECTION_NAMES, type CollectionName } from "../model/index.ts";
import { repoPath } from "../pipeline/paths.ts";
import { canonicalizeJson, hashCanonical } from "./hash.ts";
import {
  SNAPSHOT_TIMESTAMP_PRECISIONS,
  type SnapshotTimestampPrecision,
  UtcTimestamp,
} from "./snapshots.ts";

export const KNOWLEDGE_STAGES = ["acquired", "verified"] as const;
export type KnowledgeStage = (typeof KNOWLEDGE_STAGES)[number];

export const ACCESS_SURFACES = ["cli", "private", "public", "portal", "mcp"] as const;
export type AccessSurface = (typeof ACCESS_SURFACES)[number];

export class PrivateDomainAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PrivateDomainAccessError";
  }
}

/**
 * Guard private-domain knowledge-time revisions (`acquired` and `verified`)
 * against exposure on public portal or public MCP surfaces.
 */
export function assertPrivateDomainAccess(surface: AccessSurface = "cli"): void {
  if (surface === "public" || surface === "portal" || surface === "mcp") {
    throw new PrivateDomainAccessError(
      `Private-domain knowledge-time revisions cannot be exposed on ${surface} surface`,
    );
  }
  if (process.env.OEM_PUBLIC_SURFACE === "1" || process.env.OEM_MCP_PUBLIC === "1") {
    throw new PrivateDomainAccessError(
      "Private-domain knowledge-time revisions are blocked while public/MCP exposure guard is active",
    );
  }
}

export const RecordRevisionSchema = z.strictObject({
  revision_id: z.string().min(1).describe("Unique identifier of this knowledge-time revision."),
  stage: z.enum(KNOWLEDGE_STAGES).describe("Private-domain knowledge stage: acquired or verified."),
  collection: z.enum(COLLECTION_NAMES).describe("Canonical collection name of the record."),
  record_id: z.string().min(1).describe("Stable identifier of the record."),
  recorded_at: UtcTimestamp.describe("UTC timestamp when this revision was acquired or verified."),
  precision: z
    .enum(SNAPSHOT_TIMESTAMP_PRECISIONS)
    .describe("Declared precision of the recorded_at UTC timestamp."),
  record: z
    .record(z.string(), z.unknown())
    .describe("Full immutable snapshot of the record at this knowledge time."),
  record_hash: z
    .string()
    .regex(/^[0-9a-f]{64}$/)
    .describe("SHA-256 hash of the canonicalized record payload."),
  supersedes_revision_id: z
    .string()
    .min(1)
    .nullable()
    .optional()
    .describe("Previous revision_id in the same stage for this record, if any."),
  note: z
    .string()
    .min(1)
    .nullable()
    .optional()
    .describe("Optional private-domain acquisition or verification note."),
});
export type RecordRevision = z.infer<typeof RecordRevisionSchema>;

export const DEFAULT_REVISIONS_DIR = repoPath(".private/revisions");

export type RecordRevisionInput = {
  stage: KnowledgeStage;
  collection: CollectionName;
  record_id: string;
  recorded_at?: string;
  precision?: SnapshotTimestampPrecision;
  record: Record<string, unknown>;
  supersedes_revision_id?: string | null;
  note?: string | null;
  revision_id?: string;
};

function stageDirOf(revisionsDir: string, stage: KnowledgeStage): string {
  return path.join(revisionsDir, stage);
}

function sanitizePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-");
}

/**
 * Read all append-only revisions for a single private-domain stage (`acquired`
 * or `verified`), ordered chronologically.
 */
export function readStageRevisions(
  stage: KnowledgeStage,
  revisionsDir = DEFAULT_REVISIONS_DIR,
  surface: AccessSurface = "cli",
): RecordRevision[] {
  assertPrivateDomainAccess(surface);
  const dir = stageDirOf(revisionsDir, stage);
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }

  const revisions = names
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => {
      const raw = JSON.parse(readFileSync(path.join(dir, name), "utf8")) as unknown;
      return RecordRevisionSchema.parse(raw);
    });

  revisions.sort((a, b) => {
    const timeCmp = a.recorded_at.localeCompare(b.recorded_at);
    if (timeCmp !== 0) return timeCmp;
    return a.revision_id.localeCompare(b.revision_id);
  });

  return revisions;
}

/**
 * Append an immutable record revision to the private-domain stage store
 * (`acquired/` or `verified/`). Idempotent if the exact same
 * (stage, collection, record_id, recorded_at, record_hash) already exists.
 */
export function recordKnowledgeRevision(
  input: RecordRevisionInput,
  revisionsDir = DEFAULT_REVISIONS_DIR,
  surface: AccessSurface = "cli",
): { created: boolean; revision: RecordRevision; filePath: string } {
  assertPrivateDomainAccess(surface);

  const stageDir = stageDirOf(revisionsDir, input.stage);
  mkdirSync(stageDir, { recursive: true });

  const recordedAt = input.recorded_at ?? new Date().toISOString();
  const recordHash = hashCanonical(input.record);
  const existing = readStageRevisions(input.stage, revisionsDir, surface);

  const duplicate = existing.find(
    (rev) =>
      rev.collection === input.collection &&
      rev.record_id === input.record_id &&
      rev.recorded_at === recordedAt &&
      rev.record_hash === recordHash,
  );

  if (duplicate) {
    const fileName = `${duplicate.revision_id}.json`;
    return {
      created: false,
      revision: duplicate,
      filePath: path.join(stageDir, fileName),
    };
  }

  const previousForRecord = existing
    .filter((rev) => rev.collection === input.collection && rev.record_id === input.record_id)
    .at(-1);

  const seq = String(existing.length + 1).padStart(4, "0");
  const revisionId =
    input.revision_id ??
    `rev-${seq}-${input.stage}-${sanitizePart(input.collection)}-${sanitizePart(input.record_id)}`;

  const revision = RecordRevisionSchema.parse({
    revision_id: revisionId,
    stage: input.stage,
    collection: input.collection,
    record_id: input.record_id,
    recorded_at: recordedAt,
    precision: input.precision ?? "second",
    record: structuredClone(input.record),
    record_hash: recordHash,
    supersedes_revision_id:
      input.supersedes_revision_id !== undefined
        ? input.supersedes_revision_id
        : (previousForRecord?.revision_id ?? null),
    ...(input.note !== undefined ? { note: input.note } : {}),
  });

  const filePath = path.join(stageDir, `${revisionId}.json`);
  writeFileSync(filePath, canonicalizeJson(revision), "utf8");

  return {
    created: true,
    revision,
    filePath,
  };
}

/**
 * Reconstruct the latest state of each record in `stage` whose `recorded_at`
 * is at or before `asofEndIso`, ensuring later corrections never leak into
 * earlier reconstructions.
 */
export function reconstructStageAsOf(
  stage: KnowledgeStage,
  asofEndIso: string,
  revisionsDir = DEFAULT_REVISIONS_DIR,
  surface: AccessSurface = "cli",
): RecordRevision[] {
  assertPrivateDomainAccess(surface);
  const all = readStageRevisions(stage, revisionsDir, surface);
  const latestByKey = new Map<string, RecordRevision>();

  for (const rev of all) {
    if (rev.recorded_at > asofEndIso) continue;
    const key = `${rev.collection}:${rev.record_id}`;
    latestByKey.set(key, rev);
  }

  return [...latestByKey.values()].map((rev) => structuredClone(rev));
}
