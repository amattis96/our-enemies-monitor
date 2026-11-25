import { z } from "zod";

export const RETRACTION_LEVELS = [
  "marginal_correction",
  "secondary_source_retracted",
  "primary_evidence_contested",
  "sole_decisive_evidence_withdrawn",
  "severe_person_error",
] as const;

export const RetractionLevelSchema = z
  .enum(RETRACTION_LEVELS)
  .describe("Severity tier of a source retraction or evidence correction.");

export type RetractionLevel = z.infer<typeof RetractionLevelSchema>;

export const RESPONSE_ACTIONS = [
  "ordinary_review",
  "flag_dependents",
  "public_review_notice",
  "precautionary_suspension",
  "priority_human_verification",
] as const;

export const ResponseActionSchema = z
  .enum(RESPONSE_ACTIONS)
  .describe("Automated or editorial response action triggered by a retraction level.");

export type ResponseAction = z.infer<typeof ResponseActionSchema>;

/**
 * Every projection under OEM's direct operational control.
 * Any future projection added to OEM must implement this containment policy
 * before activation.
 */
export const CONTROLLED_PROJECTIONS = [
  "pages",
  "translations",
  "markdown",
  "jsonld",
  "exports",
  "rss",
  "mcp",
  "indexes_caches",
] as const;

export const ControlledProjectionSchema = z
  .enum(CONTROLLED_PROJECTIONS)
  .describe("OEM-controlled public or local projection surface.");

export type ControlledProjection = z.infer<typeof ControlledProjectionSchema>;

export const EXTERNAL_WITHDRAWAL_TARGETS = ["release", "external_archive", "doi"] as const;

export const ExternalWithdrawalTargetSchema = z
  .enum(EXTERNAL_WITHDRAWAL_TARGETS)
  .describe("Kind of external or immutable publication surface.");

export type ExternalWithdrawalTarget = z.infer<typeof ExternalWithdrawalTargetSchema>;

export const EXTERNAL_WITHDRAWAL_STATUSES = [
  "initiated",
  "logged",
  "completed",
  "not_applicable",
] as const;

export const ExternalWithdrawalStatusSchema = z
  .enum(EXTERNAL_WITHDRAWAL_STATUSES)
  .describe("Lifecycle status of an external withdrawal or rectification procedure.");

export type ExternalWithdrawalStatus = z.infer<typeof ExternalWithdrawalStatusSchema>;

export const ExternalWithdrawalEntrySchema = z.strictObject({
  target_kind: ExternalWithdrawalTargetSchema.describe(
    "External surface kind (release, external_archive, or doi).",
  ),
  identifier: z
    .string()
    .min(1)
    .describe("Release tag, archive URL, or DOI identifier targeted for rectification."),
  status: ExternalWithdrawalStatusSchema.describe(
    "Current status of the external rectification or withdrawal procedure.",
  ),
  initiated_at: z
    .string()
    .min(1)
    .describe("ISO-8601 date or timestamp when the external procedure was initiated."),
  completed_at: z
    .string()
    .min(1)
    .optional()
    .describe("Optional ISO-8601 date or timestamp when the procedure completed."),
  note: z
    .string()
    .min(1)
    .optional()
    .describe("Optional operational note on the external rectification step."),
});

export type ExternalWithdrawalEntry = z.infer<typeof ExternalWithdrawalEntrySchema>;

export const DEFAULT_UNCONTROLLABLE_COPIES_NOTICE =
  "OEM guarantees containment and suspension only across OEM-controlled projections. " +
  "Immutable releases, external archives, DOIs, downloaded copies, forks, third-party caches, " +
  "and third-party citations remain outside OEM's direct control and cannot be recalled.";

export const DEFAULT_MAX_STALENESS_SECONDS = 86_400; // 24 hours

export type TieredPolicyRule = {
  level: RetractionLevel;
  action: ResponseAction;
  suspend_controlled_projections: boolean;
  public_notice_required: boolean;
  flag_dependents: boolean;
  priority_human_verification: boolean;
  description: string;
};

export const TIERED_RESPONSE_POLICY: Record<RetractionLevel, TieredPolicyRule> = {
  marginal_correction: {
    level: "marginal_correction",
    action: "ordinary_review",
    suspend_controlled_projections: false,
    public_notice_required: false,
    flag_dependents: false,
    priority_human_verification: false,
    description: "Marginal correction routed to ordinary editorial review without suspension.",
  },
  secondary_source_retracted: {
    level: "secondary_source_retracted",
    action: "flag_dependents",
    suspend_controlled_projections: false,
    public_notice_required: false,
    flag_dependents: true,
    priority_human_verification: false,
    description: "Secondary source retracted: flag dependent records for review.",
  },
  primary_evidence_contested: {
    level: "primary_evidence_contested",
    action: "public_review_notice",
    suspend_controlled_projections: false,
    public_notice_required: true,
    flag_dependents: true,
    priority_human_verification: false,
    description:
      "Primary evidence contested: attach public review-in-progress notice across projections.",
  },
  sole_decisive_evidence_withdrawn: {
    level: "sole_decisive_evidence_withdrawn",
    action: "precautionary_suspension",
    suspend_controlled_projections: true,
    public_notice_required: true,
    flag_dependents: true,
    priority_human_verification: false,
    description:
      "Sole decisive evidence withdrawn: precautionary suspension from all OEM-controlled projections without mutating historical canonical facts.",
  },
  severe_person_error: {
    level: "severe_person_error",
    action: "priority_human_verification",
    suspend_controlled_projections: true,
    public_notice_required: true,
    flag_dependents: true,
    priority_human_verification: true,
    description:
      "Severe error concerning a named person: immediate precautionary suspension and priority human verification.",
  },
};

/** Resolve the tiered response rule for a given retraction level. */
export function responseForLevel(level: RetractionLevel): TieredPolicyRule {
  return TIERED_RESPONSE_POLICY[level];
}

export type ExternalWithdrawalLog = {
  entries: ExternalWithdrawalEntry[];
  uncontrollable_copies_notice: string;
};

/**
 * Build a validated external/immutable publication withdrawal tracker record
 * with the mandatory uncontrollable-copies declaration.
 */
export function logExternalWithdrawal(
  entries: readonly ExternalWithdrawalEntry[],
  uncontrollableCopiesNotice: string = DEFAULT_UNCONTROLLABLE_COPIES_NOTICE,
): ExternalWithdrawalLog {
  if (uncontrollableCopiesNotice.trim().length === 0) {
    throw new Error("uncontrollable_copies_notice must be a non-empty declaration.");
  }
  const parsed = entries.map((entry) => ExternalWithdrawalEntrySchema.parse(entry));
  return {
    entries: parsed,
    uncontrollable_copies_notice: uncontrollableCopiesNotice,
  };
}

export type StalenessCheckInput = {
  projection: ControlledProjection;
  generatedAt: string | Date;
  now?: string | Date;
  maxStalenessSeconds?: number;
};

export type StalenessCheckResult = {
  projection: ControlledProjection;
  stale: boolean;
  age_seconds: number;
  max_staleness_seconds: number;
  warning: string | null;
};

/**
 * Evaluate whether a local projection (such as the MCP server or local cache)
 * exceeds the maximum allowed staleness threshold.
 */
export function checkProjectionStaleness(input: StalenessCheckInput): StalenessCheckResult {
  const maxStalenessSeconds = input.maxStalenessSeconds ?? DEFAULT_MAX_STALENESS_SECONDS;
  if (!Number.isFinite(maxStalenessSeconds) || maxStalenessSeconds <= 0) {
    throw new Error(`Invalid maxStalenessSeconds: ${maxStalenessSeconds}`);
  }
  const generatedMs =
    input.generatedAt instanceof Date ? input.generatedAt.getTime() : Date.parse(input.generatedAt);
  const nowDate = input.now ?? new Date();
  const nowMs = nowDate instanceof Date ? nowDate.getTime() : Date.parse(nowDate);

  if (!Number.isFinite(generatedMs) || !Number.isFinite(nowMs)) {
    return {
      projection: input.projection,
      stale: true,
      age_seconds: Number.POSITIVE_INFINITY,
      max_staleness_seconds: maxStalenessSeconds,
      warning: `Local projection "${input.projection}" has an invalid timestamp; data may not be current.`,
    };
  }

  const ageSeconds = Math.max(0, Math.floor((nowMs - generatedMs) / 1000));
  const stale = ageSeconds > maxStalenessSeconds;
  return {
    projection: input.projection,
    stale,
    age_seconds: ageSeconds,
    max_staleness_seconds: maxStalenessSeconds,
    warning: stale
      ? `Local projection "${input.projection}" is stale (${ageSeconds}s > ${maxStalenessSeconds}s): data may not be current.`
      : null,
  };
}

/**
 * Filter a list of records for an OEM-controlled projection, removing any
 * suspended IDs without mutating the original array or record objects.
 */
export function filterControlledProjection<T extends { id: string }>(
  projection: ControlledProjection,
  records: readonly T[],
  suspendedIds: ReadonlySet<string>,
): { projection: ControlledProjection; visible: T[]; suspended: string[] } {
  const visible: T[] = [];
  const suspended: string[] = [];
  for (const record of records) {
    if (suspendedIds.has(record.id)) {
      suspended.push(record.id);
    } else {
      visible.push(record);
    }
  }
  return { projection, visible, suspended };
}
