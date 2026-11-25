import { z } from "zod";

export const READINESS_CRITERIA = [
  "completeness",
  "denominator",
  "volume",
  "seasonality",
  "stability",
  "validability",
] as const;

export type ReadinessCriterion = (typeof READINESS_CRITERIA)[number];

export const STATISTICAL_METHODS = [
  "pk32_incident_campaign",
  "pk34_poisson_nb_baseline",
  "pk34_cusum_ewma",
  "pk35_kulldorff_scan",
  "pk36_aalen_johansen",
  "pk36_capture_recapture",
  "pk36_cooccurrence_null",
  "pk36_hawkes_process",
] as const;

export type StatisticalMethodId = (typeof STATISTICAL_METHODS)[number];

export const GATE_OUTCOMES = ["activated", "blocked", "unsuitable"] as const;
export type GateOutcome = (typeof GATE_OUTCOMES)[number];

export const ReadinessThresholdsSchema = z
  .strictObject({
    max_missing_period_ratio: z
      .number()
      .min(0)
      .max(1)
      .describe("Maximum allowed fraction of missing periods before failing completeness."),
    max_source_discontinuities: z
      .number()
      .int()
      .nonnegative()
      .describe("Maximum allowed unmitigated source discontinuities."),
    min_usable_observations: z
      .number()
      .int()
      .positive()
      .describe("Minimum number of usable observations required for volume."),
    min_observed_cycles: z
      .number()
      .int()
      .nonnegative()
      .describe("Minimum number of full seasonal cycles observed."),
    max_collection_criteria_changes: z
      .number()
      .int()
      .nonnegative()
      .describe("Maximum allowed undocumented or breaking changes in collection criteria."),
    min_test_observations: z
      .number()
      .int()
      .positive()
      .describe("Minimum observations required in an independent validation period."),
  })
  .describe("Quantitative thresholds for the 6-criterion Data Readiness Gate.");

export type ReadinessThresholds = z.infer<typeof ReadinessThresholdsSchema>;

export const DEFAULT_READINESS_THRESHOLDS: ReadinessThresholds = {
  max_missing_period_ratio: 0.1,
  max_source_discontinuities: 1,
  min_usable_observations: 30,
  min_observed_cycles: 2,
  max_collection_criteria_changes: 0,
  min_test_observations: 12,
};

export const ReadinessGateInputSchema = z
  .strictObject({
    method: z.enum(STATISTICAL_METHODS).describe("Target statistical method identifier."),
    elapsed_months: z
      .number()
      .nonnegative()
      .describe(
        "Elapsed administrative months of collection. Tracked for governance only; NEVER activates a method alone.",
      ),
    missing_period_ratio: z
      .number()
      .min(0)
      .max(1)
      .describe("Observed fraction of missing time periods."),
    source_discontinuities: z
      .number()
      .int()
      .nonnegative()
      .describe("Count of source discontinuities affecting comparability."),
    denominator_present: z
      .boolean()
      .describe("Whether a public/systematic denominator is present."),
    denominator_coherent: z
      .boolean()
      .describe("Whether the denominator is methodologically coherent with the phenomenon."),
    usable_observations: z
      .number()
      .int()
      .nonnegative()
      .describe("Number of actually usable observations after deduplication and filtering."),
    observed_cycles: z
      .number()
      .int()
      .nonnegative()
      .describe("Number of complete seasonal cycles observed."),
    collection_criteria_changes: z
      .number()
      .int()
      .nonnegative()
      .describe("Count of changes in collection criteria during the window."),
    independent_test_period_available: z
      .boolean()
      .describe("Whether an independent out-of-sample test period is available."),
    independent_test_observations: z
      .number()
      .int()
      .nonnegative()
      .describe("Number of usable observations in the independent test period."),
    permanent_data_limitation: z
      .boolean()
      .optional()
      .describe("True when structural data limits make the method permanently unsuitable."),
    limitation_reason: z
      .string()
      .min(1)
      .optional()
      .describe("Documented explanation if permanent_data_limitation is true."),
  })
  .describe("Input telemetry evaluated by the 6-criterion Data Readiness Gate.");

export type ReadinessGateInput = z.infer<typeof ReadinessGateInputSchema>;

export const CriterionCheckSchema = z
  .strictObject({
    criterion: z.enum(READINESS_CRITERIA).describe("Name of the readiness criterion."),
    passed: z.boolean().describe("Whether this criterion passed."),
    detail: z.string().min(1).describe("Diagnostic explanation of the check result."),
  })
  .describe("Evaluation result for a single readiness criterion.");

export type CriterionCheck = z.infer<typeof CriterionCheckSchema>;

export const UnsuitabilityReportSchema = z
  .strictObject({
    report_type: z
      .literal("unsuitability_report")
      .describe("Formal closing outcome marker for unsuitable statistical methods."),
    method: z.enum(STATISTICAL_METHODS).describe("Method closed as unsuitable."),
    generated_at: z.string().min(1).describe("ISO-8601 timestamp when the report was generated."),
    elapsed_months: z
      .number()
      .nonnegative()
      .describe("Elapsed months at time of closure (recorded as non-activating metadata)."),
    failed_criteria: z
      .array(z.enum(READINESS_CRITERIA))
      .describe("Readiness criteria that failed."),
    rationale: z
      .string()
      .min(1)
      .describe("Technical explanation of why the method is unsuitable for the available data."),
    valid_closing_outcome: z
      .literal(true)
      .describe("Confirms that closing without activation is a valid M13 outcome."),
  })
  .describe("Formal unsuitability report closing a statistical method without activation.");

export type UnsuitabilityReport = z.infer<typeof UnsuitabilityReportSchema>;

export const ReadinessGateDecisionSchema = z
  .strictObject({
    method: z.enum(STATISTICAL_METHODS).describe("Evaluated statistical method."),
    outcome: z.enum(GATE_OUTCOMES).describe("Gate outcome: activated, blocked, or unsuitable."),
    activated: z.boolean().describe("True only when all 6 statistical criteria pass."),
    administrative_minimum_met: z
      .boolean()
      .describe("Whether elapsed_months >= 12 (administrative only, never sufficient)."),
    elapsed_months_sufficient_alone: z
      .literal(false)
      .describe("Invariant guarantee that elapsed time alone never activates a method."),
    criteria: z
      .array(CriterionCheckSchema)
      .length(6)
      .describe("Results for all 6 readiness criteria."),
    failed_criteria: z.array(z.enum(READINESS_CRITERIA)).describe("List of criteria that failed."),
    unsuitability_report: UnsuitabilityReportSchema.nullable().describe(
      "Formal unsuitability report when outcome is unsuitable, otherwise null.",
    ),
  })
  .describe("Complete Data Readiness Gate decision for a statistical method.");

export type ReadinessGateDecision = z.infer<typeof ReadinessGateDecisionSchema>;

/**
 * Build a formal unsuitability report as a valid closing outcome when a method
 * cannot be activated on available data.
 */
export function buildUnsuitabilityReport(params: {
  method: StatisticalMethodId;
  elapsed_months: number;
  failed_criteria: ReadinessCriterion[];
  rationale: string;
  generated_at?: string;
}): UnsuitabilityReport {
  return UnsuitabilityReportSchema.parse({
    report_type: "unsuitability_report",
    method: params.method,
    generated_at: params.generated_at ?? new Date().toISOString(),
    elapsed_months: params.elapsed_months,
    failed_criteria: params.failed_criteria,
    rationale: params.rationale,
    valid_closing_outcome: true,
  });
}

/**
 * Evaluate the 6-criterion Data Readiness Gate for a statistical method.
 * Elapsed time (even >= 12 months) NEVER activates a method on its own.
 */
export function evaluateReadinessGate(
  rawInput: ReadinessGateInput,
  thresholds: ReadinessThresholds = DEFAULT_READINESS_THRESHOLDS,
): ReadinessGateDecision {
  const input = ReadinessGateInputSchema.parse(rawInput);
  const t = ReadinessThresholdsSchema.parse(thresholds);

  const completenessPassed =
    input.missing_period_ratio <= t.max_missing_period_ratio &&
    input.source_discontinuities <= t.max_source_discontinuities;

  const denominatorPassed = input.denominator_present && input.denominator_coherent;
  const volumePassed = input.usable_observations >= t.min_usable_observations;
  const seasonalityPassed = input.observed_cycles >= t.min_observed_cycles;
  const stabilityPassed = input.collection_criteria_changes <= t.max_collection_criteria_changes;
  const validabilityPassed =
    input.independent_test_period_available &&
    input.independent_test_observations >= t.min_test_observations;

  const criteria: CriterionCheck[] = [
    {
      criterion: "completeness",
      passed: completenessPassed,
      detail: completenessPassed
        ? `Missing ratio ${input.missing_period_ratio.toFixed(3)} <= ${t.max_missing_period_ratio} and discontinuities ${input.source_discontinuities} <= ${t.max_source_discontinuities}.`
        : `Failed completeness: missing_period_ratio=${input.missing_period_ratio.toFixed(3)} (max ${t.max_missing_period_ratio}), source_discontinuities=${input.source_discontinuities} (max ${t.max_source_discontinuities}).`,
    },
    {
      criterion: "denominator",
      passed: denominatorPassed,
      detail: denominatorPassed
        ? "Public/systematic denominator present and coherent with analyzed phenomenon."
        : `Failed denominator: present=${String(input.denominator_present)}, coherent=${String(input.denominator_coherent)}.`,
    },
    {
      criterion: "volume",
      passed: volumePassed,
      detail: volumePassed
        ? `Usable observations ${input.usable_observations} >= ${t.min_usable_observations}.`
        : `Failed volume: usable_observations=${input.usable_observations} < ${t.min_usable_observations}.`,
    },
    {
      criterion: "seasonality",
      passed: seasonalityPassed,
      detail: seasonalityPassed
        ? `Observed cycles ${input.observed_cycles} >= ${t.min_observed_cycles}.`
        : `Failed seasonality: observed_cycles=${input.observed_cycles} < ${t.min_observed_cycles}.`,
    },
    {
      criterion: "stability",
      passed: stabilityPassed,
      detail: stabilityPassed
        ? `Collection criteria changes ${input.collection_criteria_changes} <= ${t.max_collection_criteria_changes}.`
        : `Failed stability: collection_criteria_changes=${input.collection_criteria_changes} > ${t.max_collection_criteria_changes}.`,
    },
    {
      criterion: "validability",
      passed: validabilityPassed,
      detail: validabilityPassed
        ? `Independent test period available with ${input.independent_test_observations} >= ${t.min_test_observations} observations.`
        : `Failed validability: available=${String(input.independent_test_period_available)}, test_observations=${input.independent_test_observations} (min ${t.min_test_observations}).`,
    },
  ];

  const failedCriteria = criteria.filter((c) => !c.passed).map((c) => c.criterion);
  const allPassed = failedCriteria.length === 0 && input.permanent_data_limitation !== true;

  let outcome: GateOutcome = "activated";
  let unsuitabilityReport: UnsuitabilityReport | null = null;

  if (!allPassed) {
    if (input.permanent_data_limitation === true) {
      outcome = "unsuitable";
      unsuitabilityReport = buildUnsuitabilityReport({
        method: input.method,
        elapsed_months: input.elapsed_months,
        failed_criteria: failedCriteria,
        rationale:
          input.limitation_reason ??
          `Permanent data limitation prevents activation of ${input.method}.`,
      });
    } else {
      outcome = "blocked";
    }
  }

  return ReadinessGateDecisionSchema.parse({
    method: input.method,
    outcome,
    activated: allPassed,
    administrative_minimum_met: input.elapsed_months >= 12,
    elapsed_months_sufficient_alone: false,
    criteria,
    failed_criteria: failedCriteria,
    unsuitability_report: unsuitabilityReport,
  });
}
