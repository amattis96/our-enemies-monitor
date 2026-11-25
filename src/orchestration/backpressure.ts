import { z } from "zod";
import { UtcTimestamp } from "../temporal/snapshots.ts";

export const OPERATIONAL_PRIORITIES = ["P0", "P1", "P2", "P3", "P4"] as const;
export type OperationalPriority = (typeof OPERATIONAL_PRIORITIES)[number];

export const BACKPRESSURE_LEVELS = ["normal", "elevated", "saturated"] as const;
export type BackpressureLevel = (typeof BACKPRESSURE_LEVELS)[number];

export const RESOURCE_KINDS = [
  "api_cost_usd",
  "subscription_units",
  "agent_runtime_minutes",
  "review_capacity_items",
] as const;
export type ResourceKind = (typeof RESOURCE_KINDS)[number];

export const BackpressureMetricsSchema = z
  .strictObject({
    open_prs: z.number().int().nonnegative().describe("Current number of open pull requests."),
    review_queue: z
      .number()
      .int()
      .nonnegative()
      .describe("Number of items awaiting editorial or critic review."),
    avg_wait_minutes: z.number().nonnegative().describe("Average queue wait time in minutes."),
  })
  .describe("Live queue and PR saturation metrics.");
export type BackpressureMetrics = z.infer<typeof BackpressureMetricsSchema>;

export const BackpressureThresholdsSchema = z
  .strictObject({
    max_open_prs: z.number().int().positive().default(6).describe("Open PR saturation limit."),
    max_review_queue: z
      .number()
      .int()
      .positive()
      .default(15)
      .describe("Review queue saturation limit."),
    max_wait_minutes: z
      .number()
      .positive()
      .default(180)
      .describe("Maximum average wait time in minutes before throttling."),
  })
  .describe("Configurable backpressure saturation thresholds.");
export type BackpressureThresholds = z.infer<typeof BackpressureThresholdsSchema>;

export const BackpressureStateSchema = z
  .strictObject({
    level: z.enum(BACKPRESSURE_LEVELS).describe("Computed backpressure level."),
    throttled_priorities: z
      .array(z.enum(OPERATIONAL_PRIORITIES))
      .describe("Priorities currently throttled (never includes P0 or P1)."),
    allowed_priorities: z
      .array(z.enum(OPERATIONAL_PRIORITIES))
      .describe("Priorities permitted to run without throttling."),
    reasons: z.array(z.string().min(1)).describe("Triggered saturation reasons."),
  })
  .describe("Backpressure evaluation result.");
export type BackpressureState = z.infer<typeof BackpressureStateSchema>;

export const ResourceBucketSchema = z
  .strictObject({
    total_limit: z.number().positive().describe("Hard ceiling for this resource."),
    used: z.number().nonnegative().describe("Amount consumed in the current window."),
    p0_p1_reserve: z
      .number()
      .nonnegative()
      .describe("Capacity reserved exclusively for P0 and P1 operations."),
    soft_quota: z
      .number()
      .nonnegative()
      .describe("Soft quota above which a motivated exception is required."),
  })
  .describe("Budget bucket for one of the four tracked operational resources.");
export type ResourceBucket = z.infer<typeof ResourceBucketSchema>;

export const BudgetExceptionSchema = z
  .strictObject({
    resource: z.enum(RESOURCE_KINDS).describe("Resource whose soft quota was exceeded."),
    priority: z.enum(OPERATIONAL_PRIORITIES).describe("Priority of the requesting operation."),
    amount: z.number().positive().describe("Requested resource amount."),
    reason: z
      .string()
      .min(1)
      .describe("Motivated exception explaining why soft quota was crossed."),
    recorded_at: UtcTimestamp.describe("UTC timestamp when the exception was logged."),
  })
  .describe("Logged soft-quota exception.");
export type BudgetException = z.infer<typeof BudgetExceptionSchema>;

export const FourResourceBudgetSchema = z
  .strictObject({
    window_label: z.string().min(1).describe("Budget period label (e.g., 2026-W47)."),
    resources: z
      .strictObject({
        api_cost_usd: ResourceBucketSchema.describe("API monetary cost budget in USD."),
        subscription_units: ResourceBucketSchema.describe("Subscription quota units."),
        agent_runtime_minutes: ResourceBucketSchema.describe("Agent execution runtime in minutes."),
        review_capacity_items: ResourceBucketSchema.describe("Human/critic review capacity."),
      })
      .describe("The four tracked operational resource budgets."),
    exceptions: z
      .array(BudgetExceptionSchema)
      .default([])
      .describe("Motivated exceptions recorded when crossing soft quotas."),
  })
  .describe("Four-resource operational budget with P0/P1 reserve and soft quotas.");
export type FourResourceBudget = z.infer<typeof FourResourceBudgetSchema>;

export const CoverageObservationSchema = z
  .strictObject({
    country: z.string().min(1).describe("Target country or jurisdiction."),
    language: z.string().min(1).describe("Source or working language code."),
    actor_type: z.string().min(1).describe("Actor category (e.g., state, proxy, corporate)."),
    source_type: z.string().min(1).describe("Source category (e.g., official, osint, court)."),
  })
  .describe("Single observation contributing to weekly coverage-bias telemetry.");
export type CoverageObservation = z.infer<typeof CoverageObservationSchema>;

export const CoverageBiasReportSchema = z
  .strictObject({
    week: z.string().min(1).describe("ISO week label for the report."),
    total_observations: z.number().int().nonnegative().describe("Total items analyzed."),
    by_country: z
      .record(z.string(), z.number().int().nonnegative())
      .describe("Counts per country."),
    by_language: z
      .record(z.string(), z.number().int().nonnegative())
      .describe("Counts per language."),
    by_actor_type: z
      .record(z.string(), z.number().int().nonnegative())
      .describe("Counts per actor type."),
    by_source_type: z
      .record(z.string(), z.number().int().nonnegative())
      .describe("Counts per source type."),
    top_country_share: z
      .number()
      .min(0)
      .max(1)
      .describe("Share of observations concentrated in the single most-covered country."),
    warnings: z
      .array(z.string().min(1))
      .describe("Coverage concentration or language-blindness warnings."),
  })
  .describe("Weekly coverage-bias report surfacing geographic, linguistic, and source skew.");
export type CoverageBiasReport = z.infer<typeof CoverageBiasReportSchema>;

export const M9TelemetrySnapshotSchema = z
  .strictObject({
    timestamp: UtcTimestamp.describe("UTC timestamp of the telemetry snapshot."),
    backpressure_level: z.enum(BACKPRESSURE_LEVELS).describe("Active backpressure level."),
    queue_depths: BackpressureMetricsSchema.describe("Observed queue depths."),
    budget_utilization: z
      .record(z.enum(RESOURCE_KINDS), z.number().min(0))
      .describe("Used / total_limit ratio for each of the four resources."),
    throttled_counts_by_priority: z
      .record(z.enum(OPERATIONAL_PRIORITIES), z.number().int().nonnegative())
      .describe("Count of throttled dispatches per priority."),
    active_exceptions: z
      .number()
      .int()
      .nonnegative()
      .describe("Number of soft-quota exceptions in the current window."),
    coverage_bias_summary: CoverageBiasReportSchema.describe(
      "Latest weekly coverage-bias summary.",
    ),
  })
  .describe("M9 operational telemetry schema.");
export type M9TelemetrySnapshot = z.infer<typeof M9TelemetrySnapshotSchema>;

const DEFAULT_THRESHOLDS: BackpressureThresholds = {
  max_open_prs: 6,
  max_review_queue: 15,
  max_wait_minutes: 180,
};

/**
 * Evaluate queue and PR metrics against thresholds. When saturated, P3 and P4
 * are throttled while P0 and P1 remain untouched.
 */
export function evaluateBackpressure(
  metrics: BackpressureMetrics,
  thresholds: Partial<BackpressureThresholds> = {},
): BackpressureState {
  const m = BackpressureMetricsSchema.parse(metrics);
  const t = BackpressureThresholdsSchema.parse({ ...DEFAULT_THRESHOLDS, ...thresholds });
  const reasons: string[] = [];

  if (m.open_prs > t.max_open_prs) {
    reasons.push(`open_prs (${m.open_prs}) exceeds threshold (${t.max_open_prs})`);
  }
  if (m.review_queue > t.max_review_queue) {
    reasons.push(`review_queue (${m.review_queue}) exceeds threshold (${t.max_review_queue})`);
  }
  if (m.avg_wait_minutes > t.max_wait_minutes) {
    reasons.push(
      `avg_wait_minutes (${m.avg_wait_minutes}) exceeds threshold (${t.max_wait_minutes})`,
    );
  }

  if (reasons.length > 0) {
    return {
      level: "saturated",
      throttled_priorities: ["P3", "P4"],
      allowed_priorities: ["P0", "P1", "P2"],
      reasons,
    };
  }

  const nearPr = m.open_prs >= Math.ceil(t.max_open_prs * 0.8);
  const nearQueue = m.review_queue >= Math.ceil(t.max_review_queue * 0.8);
  const nearWait = m.avg_wait_minutes >= Math.ceil(t.max_wait_minutes * 0.8);
  if (nearPr || nearQueue || nearWait) {
    return {
      level: "elevated",
      throttled_priorities: ["P4"],
      allowed_priorities: ["P0", "P1", "P2", "P3"],
      reasons: ["Queue utilization is >= 80% of saturation threshold; throttling P4."],
    };
  }

  return {
    level: "normal",
    throttled_priorities: [],
    allowed_priorities: ["P0", "P1", "P2", "P3", "P4"],
    reasons: [],
  };
}

export function shouldThrottleTask(
  priority: OperationalPriority,
  state: BackpressureState,
): { throttled: boolean; reason?: string } {
  if (priority === "P0" || priority === "P1") {
    return { throttled: false };
  }
  if (state.throttled_priorities.includes(priority)) {
    return {
      throttled: true,
      reason: `Priority ${priority} throttled under ${state.level} backpressure: ${state.reasons.join("; ")}`,
    };
  }
  return { throttled: false };
}

/**
 * Attempt to allocate capacity from one of the 4 operational resources.
 * Enforces P0/P1 reserve protection and requires a motivated exception
 * when crossing soft_quota.
 */
export function allocateBudget(
  budget: FourResourceBudget,
  request: {
    resource: ResourceKind;
    priority: OperationalPriority;
    amount: number;
    exceptionReason?: string;
    timestamp?: string;
  },
): {
  granted: boolean;
  budget: FourResourceBudget;
  reason?: string;
} {
  const next = structuredClone(FourResourceBudgetSchema.parse(budget));
  const bucket = next.resources[request.resource];
  const projected = bucket.used + request.amount;
  const isCritical = request.priority === "P0" || request.priority === "P1";
  const effectiveCap = isCritical
    ? bucket.total_limit
    : Math.max(0, bucket.total_limit - bucket.p0_p1_reserve);

  if (projected > effectiveCap) {
    return {
      granted: false,
      budget,
      reason: isCritical
        ? `Insufficient ${request.resource} total_limit (${projected} > ${effectiveCap}).`
        : `Insufficient ${request.resource} non-reserve capacity for ${request.priority} (${projected} > ${effectiveCap}; ${bucket.p0_p1_reserve} reserved for P0/P1).`,
    };
  }

  if (projected > bucket.soft_quota && !request.exceptionReason?.trim()) {
    return {
      granted: false,
      budget,
      reason: `${request.resource} allocation (${projected}) crosses soft_quota (${bucket.soft_quota}) and requires a motivated exceptionReason.`,
    };
  }

  bucket.used = projected;
  if (projected > bucket.soft_quota && request.exceptionReason?.trim()) {
    next.exceptions.push({
      resource: request.resource,
      priority: request.priority,
      amount: request.amount,
      reason: request.exceptionReason.trim(),
      recorded_at: request.timestamp ?? new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    });
  }

  return { granted: true, budget: next };
}

function incrementCount(map: Record<string, number>, key: string): void {
  map[key] = (map[key] ?? 0) + 1;
}

/**
 * Generate a weekly coverage-bias report across country, language, actor_type,
 * and source_type dimensions.
 */
export function generateCoverageBiasReport(
  week: string,
  observations: readonly CoverageObservation[],
): CoverageBiasReport {
  const byCountry: Record<string, number> = {};
  const byLanguage: Record<string, number> = {};
  const byActorType: Record<string, number> = {};
  const bySourceType: Record<string, number> = {};

  for (const raw of observations) {
    const obs = CoverageObservationSchema.parse(raw);
    incrementCount(byCountry, obs.country);
    incrementCount(byLanguage, obs.language);
    incrementCount(byActorType, obs.actor_type);
    incrementCount(bySourceType, obs.source_type);
  }

  const total = observations.length;
  const maxCountryCount = Math.max(0, ...Object.values(byCountry));
  const topCountryShare = total > 0 ? Number((maxCountryCount / total).toFixed(4)) : 0;
  const warnings: string[] = [];

  if (total > 0 && topCountryShare > 0.5) {
    warnings.push(
      `Geographic concentration warning: top country represents ${(topCountryShare * 100).toFixed(1)}% of observations.`,
    );
  }
  const languageCount = Object.keys(byLanguage).length;
  if (total >= 5 && languageCount <= 1) {
    warnings.push("Linguistic diversity warning: observations come from a single language.");
  }

  return CoverageBiasReportSchema.parse({
    week,
    total_observations: total,
    by_country: byCountry,
    by_language: byLanguage,
    by_actor_type: byActorType,
    by_source_type: bySourceType,
    top_country_share: topCountryShare,
    warnings,
  });
}

export function buildM9TelemetrySnapshot(input: {
  timestamp: string;
  metrics: BackpressureMetrics;
  thresholds?: Partial<BackpressureThresholds>;
  budget: FourResourceBudget;
  throttledCountsByPriority: Record<OperationalPriority, number>;
  coverageBias: CoverageBiasReport;
}): M9TelemetrySnapshot {
  const bp = evaluateBackpressure(input.metrics, input.thresholds);
  const utilization = {
    api_cost_usd: Number(
      (
        input.budget.resources.api_cost_usd.used / input.budget.resources.api_cost_usd.total_limit
      ).toFixed(4),
    ),
    subscription_units: Number(
      (
        input.budget.resources.subscription_units.used /
        input.budget.resources.subscription_units.total_limit
      ).toFixed(4),
    ),
    agent_runtime_minutes: Number(
      (
        input.budget.resources.agent_runtime_minutes.used /
        input.budget.resources.agent_runtime_minutes.total_limit
      ).toFixed(4),
    ),
    review_capacity_items: Number(
      (
        input.budget.resources.review_capacity_items.used /
        input.budget.resources.review_capacity_items.total_limit
      ).toFixed(4),
    ),
  };

  return M9TelemetrySnapshotSchema.parse({
    timestamp: input.timestamp,
    backpressure_level: bp.level,
    queue_depths: input.metrics,
    budget_utilization: utilization,
    throttled_counts_by_priority: input.throttledCountsByPriority,
    active_exceptions: input.budget.exceptions.length,
    coverage_bias_summary: input.coverageBias,
  });
}
