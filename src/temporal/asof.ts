import { PartialDate, precisionOf } from "../model/schemas.ts";
import {
  type AccessSurface,
  assertPrivateDomainAccess,
  DEFAULT_REVISIONS_DIR,
  type KnowledgeStage,
  type RecordRevision,
  readStageRevisions,
  reconstructStageAsOf,
} from "./revisions.ts";
import {
  buildSnapshotIndex,
  DEFAULT_SNAPSHOTS_DIR,
  readSnapshotEvents,
  type SnapshotSummary,
} from "./snapshots.ts";

export const ASOF_MODES = ["canonical", "published", "acquired", "verified"] as const;
export type AsofMode = (typeof ASOF_MODES)[number];

export type AsofPrecision = "year" | "month" | "day" | "second";

export type ParsedAsofDate = {
  input: string;
  precision: AsofPrecision;
  comparisonEndIso: string;
};

const UTC_TS_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Parse an `asof` query date (`YYYY`, `YYYY-MM`, `YYYY-MM-DD`, or UTC ISO
 * timestamp) while preserving its declared precision and never inventing a day.
 */
export function parseAsofDate(raw: string): ParsedAsofDate {
  if (UTC_TS_RE.test(raw)) {
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error(`Invalid UTC timestamp: ${raw}`);
    }
    return {
      input: raw,
      precision: "second",
      comparisonEndIso: parsed.toISOString(),
    };
  }

  const partial = PartialDate.safeParse(raw);
  if (!partial.success) {
    throw new Error(
      `Invalid as-of date "${raw}": expected YYYY, YYYY-MM, YYYY-MM-DD, or UTC ISO timestamp`,
    );
  }

  const precision = precisionOf(partial.data);
  const parts = partial.data.split("-").map(Number);
  const year = parts[0] ?? 0;

  if (precision === "year") {
    return {
      input: partial.data,
      precision: "year",
      comparisonEndIso: `${String(year).padStart(4, "0")}-12-31T23:59:59.999Z`,
    };
  }

  if (precision === "month") {
    const month = parts[1] ?? 1;
    const lastDay = daysInMonth(year, month);
    return {
      input: partial.data,
      precision: "month",
      comparisonEndIso: `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}T23:59:59.999Z`,
    };
  }

  const month = parts[1] ?? 1;
  const day = parts[2] ?? 1;
  if (day > daysInMonth(year, month)) {
    throw new Error(`Invalid calendar date: ${raw}`);
  }
  return {
    input: partial.data,
    precision: "day",
    comparisonEndIso: `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T23:59:59.999Z`,
  };
}

export type PublicAsofResult = {
  domain: "public";
  mode: "canonical" | "published";
  as_of: ParsedAsofDate;
  retrospective_partial: boolean;
  registry_inception_at: string | null;
  active_snapshot: SnapshotSummary | null;
  snapshots_as_of: SnapshotSummary[];
  withdrawn_snapshots: SnapshotSummary[];
  failed_deployments: SnapshotSummary[];
};

export type PrivateAsofResult = {
  domain: "private";
  mode: KnowledgeStage;
  as_of: ParsedAsofDate;
  retrospective_partial: boolean;
  registry_inception_at: string | null;
  record_count: number;
  revisions: RecordRevision[];
};

export type AsofResult = PublicAsofResult | PrivateAsofResult;

export type AsofOptions = {
  date: string;
  mode: AsofMode;
  snapshotsDir?: string;
  revisionsDir?: string;
  surface?: AccessSurface;
};

export function isPrivateMode(mode: AsofMode): mode is KnowledgeStage {
  return mode === "acquired" || mode === "verified";
}

/**
 * Reconstruct the dataset state as of `date` in the requested `mode`:
 * - `canonical` / `published`: public domain, reconstructed from append-only snapshot transitions.
 * - `acquired` / `verified`: private domain only, guarded against public/MCP exposure.
 */
export function resolveAsOf(options: AsofOptions): AsofResult {
  const parsedDate = parseAsofDate(options.date);
  const snapshotsDir = options.snapshotsDir ?? DEFAULT_SNAPSHOTS_DIR;
  const revisionsDir = options.revisionsDir ?? DEFAULT_REVISIONS_DIR;
  const surface = options.surface ?? "cli";

  if (isPrivateMode(options.mode)) {
    assertPrivateDomainAccess(surface);
    const allStageRevisions = readStageRevisions(options.mode, revisionsDir, surface);
    const stageInception = allStageRevisions[0]?.recorded_at ?? null;
    const revisions = reconstructStageAsOf(
      options.mode,
      parsedDate.comparisonEndIso,
      revisionsDir,
      surface,
    );
    const retrospectivePartial =
      stageInception === null || parsedDate.comparisonEndIso < stageInception;

    return {
      domain: "private",
      mode: options.mode,
      as_of: parsedDate,
      retrospective_partial: retrospectivePartial,
      registry_inception_at: stageInception,
      record_count: revisions.length,
      revisions,
    };
  }

  const allEvents = readSnapshotEvents(snapshotsDir);
  const fullIndex = buildSnapshotIndex(allEvents, parsedDate.comparisonEndIso);
  const eventsAsOf = allEvents.filter((e) => e.recorded_at <= parsedDate.comparisonEndIso);
  const indexAsOf = buildSnapshotIndex(eventsAsOf, parsedDate.comparisonEndIso);

  const retrospectivePartial =
    fullIndex.inception_at === null || parsedDate.comparisonEndIso < fullIndex.inception_at;

  const withdrawnSnapshots = indexAsOf.snapshots.filter((s) => s.status === "withdrawn");
  const failedDeployments = indexAsOf.snapshots.filter((s) => s.status === "deployment_failed");

  let activeSnapshot: SnapshotSummary | null = null;
  if (options.mode === "canonical") {
    const eligible = indexAsOf.snapshots.filter(
      (s) => s.status === "accepted" || s.status === "published" || s.status === "superseded",
    );
    activeSnapshot = eligible.at(-1) ?? null;
  } else {
    const eligible = indexAsOf.snapshots.filter((s) => s.status === "published");
    activeSnapshot = eligible.at(-1) ?? null;
  }

  return {
    domain: "public",
    mode: options.mode,
    as_of: parsedDate,
    retrospective_partial: retrospectivePartial,
    registry_inception_at: fullIndex.inception_at,
    active_snapshot: activeSnapshot,
    snapshots_as_of: indexAsOf.snapshots,
    withdrawn_snapshots: withdrawnSnapshots,
    failed_deployments: failedDeployments,
  };
}
