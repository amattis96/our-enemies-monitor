import { z } from "zod";
import {
  buildUnsuitabilityReport,
  type ReadinessGateDecision,
  type UnsuitabilityReport,
} from "./readiness-gate.ts";

// ---------------------------------------------------------------------------
// 1. Aalen-Johansen Competing Risks Attribution Timing
// ---------------------------------------------------------------------------

export const COMPETING_RISK_OUTCOMES = [
  "censored",
  "attributed",
  "retracted_or_non_hostile",
] as const;
export type CompetingRiskOutcome = (typeof COMPETING_RISK_OUTCOMES)[number];

export const CohortSubjectSchema = z
  .strictObject({
    case_id: z.string().min(1).describe("Cohort subject / case identifier."),
    time_days: z.number().nonnegative().describe("Observed follow-up duration in days."),
    outcome: z
      .enum(COMPETING_RISK_OUTCOMES)
      .describe("Observed competing-risk event or censoring."),
  })
  .describe("Subject in a strictly defined competing-risks attribution cohort.");

export type CohortSubject = z.infer<typeof CohortSubjectSchema>;

export const AalenJohansenInputSchema = z
  .strictObject({
    cohort_definition: z
      .string()
      .min(1)
      .describe("Explicit cohort inclusion criteria and time-zero definition."),
    gate_decision: z.custom<ReadinessGateDecision>().describe("Data Readiness Gate decision."),
    subjects: z.array(CohortSubjectSchema).min(1).describe("Cohort observations."),
  })
  .describe("Input for PK-36 Aalen-Johansen competing-risks estimator.");

export type AalenJohansenInput = z.infer<typeof AalenJohansenInputSchema>;

export const AalenJohansenResultSchema = z
  .strictObject({
    status: z.enum(["executed", "blocked"]).describe("Execution status."),
    estimator: z
      .literal("aalen_johansen_competing_risks")
      .describe("Always Aalen-Johansen; Kaplan-Meier is forbidden for competing risks."),
    cold_case_reopening_estimated: z
      .literal(false)
      .describe("Invariant: never estimates cold-case reopening statistically."),
    cohort_definition: z.string().min(1).describe("Declared cohort definition."),
    cumulative_incidence: z
      .array(
        z.strictObject({
          time_days: z.number().nonnegative().describe("Event time in days."),
          at_risk: z.number().int().positive().describe("Number at risk just before time_days."),
          cif_attributed: z
            .number()
            .min(0)
            .max(1)
            .describe("Cumulative incidence function for attribution."),
          cif_retracted_or_non_hostile: z
            .number()
            .min(0)
            .max(1)
            .describe("Cumulative incidence function for competing non-hostile/retracted outcome."),
        }),
      )
      .describe("Aalen-Johansen cumulative incidence trajectory."),
    unsuitability_report: z
      .custom<UnsuitabilityReport>()
      .nullable()
      .describe("Unsuitability report when gate blocks execution."),
  })
  .describe("PK-36 Aalen-Johansen competing-risks output.");

export type AalenJohansenResult = z.infer<typeof AalenJohansenResultSchema>;

/**
 * Compute Aalen-Johansen cumulative incidence functions for competing risks
 * (`attributed` vs `retracted_or_non_hostile`). Never uses Kaplan-Meier and
 * never estimates cold-case reopening.
 */
export function computeAalenJohansenAttributionTiming(
  rawInput: AalenJohansenInput,
): AalenJohansenResult {
  const input = AalenJohansenInputSchema.parse(rawInput);

  if (!input.gate_decision.activated) {
    return AalenJohansenResultSchema.parse({
      status: "blocked",
      estimator: "aalen_johansen_competing_risks",
      cold_case_reopening_estimated: false,
      cohort_definition: input.cohort_definition,
      cumulative_incidence: [],
      unsuitability_report:
        input.gate_decision.unsuitability_report ??
        buildUnsuitabilityReport({
          method: "pk36_aalen_johansen",
          elapsed_months: 0,
          failed_criteria: input.gate_decision.failed_criteria,
          rationale: "Aalen-Johansen competing-risks blocked by Data Readiness Gate.",
        }),
    });
  }

  const sorted = [...input.subjects].sort((a, b) => a.time_days - b.time_days);
  const eventTimes = [
    ...new Set(sorted.filter((s) => s.outcome !== "censored").map((s) => s.time_days)),
  ].sort((a, b) => a - b);

  let survivalOverall = 1;
  let cifAttributed = 0;
  let cifNonHostile = 0;
  const trajectory: AalenJohansenResult["cumulative_incidence"] = [];

  for (const t of eventTimes) {
    const atRisk = sorted.filter((s) => s.time_days >= t).length;
    if (atRisk <= 0) continue;

    const dAttr = sorted.filter((s) => s.time_days === t && s.outcome === "attributed").length;
    const dComp = sorted.filter(
      (s) => s.time_days === t && s.outcome === "retracted_or_non_hostile",
    ).length;

    const dTotal = dAttr + dComp;
    cifAttributed += survivalOverall * (dAttr / atRisk);
    cifNonHostile += survivalOverall * (dComp / atRisk);
    survivalOverall *= 1 - dTotal / atRisk;

    trajectory.push({
      time_days: t,
      at_risk: atRisk,
      cif_attributed: Number(Math.min(1, cifAttributed).toFixed(6)),
      cif_retracted_or_non_hostile: Number(Math.min(1, cifNonHostile).toFixed(6)),
    });
  }

  return AalenJohansenResultSchema.parse({
    status: "executed",
    estimator: "aalen_johansen_competing_risks",
    cold_case_reopening_estimated: false,
    cohort_definition: input.cohort_definition,
    cumulative_incidence: trajectory,
    unsuitability_report: null,
  });
}

// ---------------------------------------------------------------------------
// 2. Capture-Recapture (Chapman Estimator with Independence Caveat)
// ---------------------------------------------------------------------------

export const CaptureRecaptureInputSchema = z
  .strictObject({
    phenomenon: z.string().min(1).describe("Bounded phenomenon scope."),
    territory: z.string().min(1).describe("Bounded territory scope."),
    gate_decision: z.custom<ReadinessGateDecision>().describe("Data Readiness Gate decision."),
    list_a_count: z.number().int().nonnegative().describe("Count observed in source list A."),
    list_b_count: z.number().int().nonnegative().describe("Count observed in source list B."),
    overlap_count: z.number().int().nonnegative().describe("Count observed in both lists."),
    genealogically_independent: z
      .boolean()
      .describe("Whether sources A and B are genealogically independent."),
  })
  .describe("Input for PK-36 bounded capture-recapture estimator.");

export type CaptureRecaptureInput = z.infer<typeof CaptureRecaptureInputSchema>;

export const CaptureRecaptureResultSchema = z
  .strictObject({
    status: z.enum(["executed", "blocked"]).describe("Execution status."),
    phenomenon: z.string().min(1).describe("Bounded phenomenon."),
    territory: z.string().min(1).describe("Bounded territory."),
    chapman_estimate: z.number().nonnegative().nullable().describe("Chapman population estimate."),
    estimated_unobserved: z
      .number()
      .nonnegative()
      .nullable()
      .describe("Estimated unobserved cases."),
    genealogical_independence_not_statistical_independence: z
      .literal(true)
      .describe(
        "Explicit caveat: genealogical independence of sources does not guarantee statistical independence of detection probabilities.",
      ),
    caveat: z.string().min(1).describe("Documented methodological caveat."),
    unsuitability_report: z
      .custom<UnsuitabilityReport>()
      .nullable()
      .describe("Unsuitability report when gate blocks execution."),
  })
  .describe("PK-36 capture-recapture output.");

export type CaptureRecaptureResult = z.infer<typeof CaptureRecaptureResultSchema>;

/**
 * Estimate bounded capture-recapture population using Chapman's bias-corrected
 * estimator, always attaching the genealogical-vs-statistical independence caveat.
 */
export function estimateCaptureRecapture(rawInput: CaptureRecaptureInput): CaptureRecaptureResult {
  const input = CaptureRecaptureInputSchema.parse(rawInput);

  if (!input.gate_decision.activated) {
    return CaptureRecaptureResultSchema.parse({
      status: "blocked",
      phenomenon: input.phenomenon,
      territory: input.territory,
      chapman_estimate: null,
      estimated_unobserved: null,
      genealogical_independence_not_statistical_independence: true,
      caveat:
        "Genealogical independence of sources does not guarantee statistical independence of detection probabilities; execution blocked by gate.",
      unsuitability_report:
        input.gate_decision.unsuitability_report ??
        buildUnsuitabilityReport({
          method: "pk36_capture_recapture",
          elapsed_months: 0,
          failed_criteria: input.gate_decision.failed_criteria,
          rationale: "Capture-recapture blocked by Data Readiness Gate.",
        }),
    });
  }

  const totalObserved = input.list_a_count + input.list_b_count - input.overlap_count;
  const chapman =
    ((input.list_a_count + 1) * (input.list_b_count + 1)) / (input.overlap_count + 1) - 1;
  const unobserved = Math.max(0, chapman - totalObserved);

  return CaptureRecaptureResultSchema.parse({
    status: "executed",
    phenomenon: input.phenomenon,
    territory: input.territory,
    chapman_estimate: Number(chapman.toFixed(2)),
    estimated_unobserved: Number(unobserved.toFixed(2)),
    genealogical_independence_not_statistical_independence: true,
    caveat: input.genealogically_independent
      ? "Sources are genealogically independent, but shared salience/visibility may still induce positive statistical dependence (underestimating true total)."
      : "Sources are not genealogically independent; positive list dependence likely biases Chapman estimate downward.",
    unsuitability_report: null,
  });
}

// ---------------------------------------------------------------------------
// 3. Co-occurrence with Degree & Case-Structure Null Model
// ---------------------------------------------------------------------------

export const CoOccurrenceEdgeInputSchema = z
  .strictObject({
    entity_a: z.string().min(1).describe("First entity ID."),
    entity_b: z.string().min(1).describe("Second entity ID."),
    observed_cooccurrences: z.number().int().nonnegative().describe("Observed co-occurrences."),
    degree_a: z.number().int().positive().describe("Total case degree of entity A."),
    degree_b: z.number().int().positive().describe("Total case degree of entity B."),
    shared_case_structure_weight: z
      .number()
      .positive()
      .describe("Expected co-occurrence multiplier from shared case structure."),
  })
  .describe("Candidate co-occurrence pair for null-model testing.");

export type CoOccurrenceEdgeInput = z.infer<typeof CoOccurrenceEdgeInputSchema>;

export const CoOccurrenceInputSchema = z
  .strictObject({
    gate_decision: z.custom<ReadinessGateDecision>().describe("Data Readiness Gate decision."),
    total_cases: z.number().int().positive().describe("Total number of cases in the corpus."),
    edges: z.array(CoOccurrenceEdgeInputSchema).min(1).describe("Co-occurrence pairs."),
  })
  .describe("Input for PK-36 co-occurrence null-model analysis.");

export type CoOccurrenceInput = z.infer<typeof CoOccurrenceInputSchema>;

export const CoOccurrenceResultSchema = z
  .strictObject({
    status: z.enum(["executed", "blocked"]).describe("Execution status."),
    community_check_method: z
      .enum(["louvain", "leiden"])
      .describe("Internal-only community quality check algorithm."),
    internal_quality_check_only: z
      .literal(true)
      .describe("Louvain/Leiden is strictly an internal quality check."),
    public_export_forbidden: z
      .literal(true)
      .describe("Cluster colors and Louvain/Leiden partitions are excluded from public site."),
    scored_pairs: z
      .array(
        z.strictObject({
          entity_a: z.string().min(1).describe("First entity."),
          entity_b: z.string().min(1).describe("Second entity."),
          observed: z.number().int().nonnegative().describe("Observed co-occurrences."),
          expected_null: z
            .number()
            .nonnegative()
            .describe("Expected co-occurrences under degree & case-structure null model."),
          excess_z_score: z.number().describe("Standardized excess over null model."),
          significant_beyond_hub_degree: z
            .boolean()
            .describe("True when z-score >= 2.0 after adjusting for hub degree & case structure."),
        }),
      )
      .describe("Scored entity pairs."),
    unsuitability_report: z
      .custom<UnsuitabilityReport>()
      .nullable()
      .describe("Unsuitability report when gate blocks execution."),
  })
  .describe("PK-36 co-occurrence null-model output.");

export type CoOccurrenceResult = z.infer<typeof CoOccurrenceResultSchema>;

/**
 * Evaluate entity co-occurrences against a degree- and case-structure-adjusted null model.
 * Louvain/Leiden is strictly marked as an internal quality check and forbidden from public export.
 */
export function analyzeCoOccurrenceWithNullModel(rawInput: CoOccurrenceInput): CoOccurrenceResult {
  const input = CoOccurrenceInputSchema.parse(rawInput);

  if (!input.gate_decision.activated) {
    return CoOccurrenceResultSchema.parse({
      status: "blocked",
      community_check_method: "leiden",
      internal_quality_check_only: true,
      public_export_forbidden: true,
      scored_pairs: [],
      unsuitability_report:
        input.gate_decision.unsuitability_report ??
        buildUnsuitabilityReport({
          method: "pk36_cooccurrence_null",
          elapsed_months: 0,
          failed_criteria: input.gate_decision.failed_criteria,
          rationale: "Co-occurrence null-model analysis blocked by Data Readiness Gate.",
        }),
    });
  }

  const scoredPairs = input.edges.map((edge) => {
    const baseExpected = (edge.degree_a * edge.degree_b) / input.total_cases;
    const expectedNull = baseExpected * edge.shared_case_structure_weight;
    const sd = Math.sqrt(Math.max(expectedNull, 1e-6));
    const zScore = (edge.observed_cooccurrences - expectedNull) / sd;
    return {
      entity_a: edge.entity_a,
      entity_b: edge.entity_b,
      observed: edge.observed_cooccurrences,
      expected_null: Number(expectedNull.toFixed(4)),
      excess_z_score: Number(zScore.toFixed(4)),
      significant_beyond_hub_degree: zScore >= 2.0,
    };
  });

  return CoOccurrenceResultSchema.parse({
    status: "executed",
    community_check_method: "leiden",
    internal_quality_check_only: true,
    public_export_forbidden: true,
    scored_pairs: scoredPairs,
    unsuitability_report: null,
  });
}

// ---------------------------------------------------------------------------
// 4. Hawkes Self-Exciting Process vs Simpler Baselines & Common Causes
// ---------------------------------------------------------------------------

export const HawkesInputSchema = z
  .strictObject({
    gate_decision: z.custom<ReadinessGateDecision>().describe("Data Readiness Gate decision."),
    event_times_days: z
      .array(z.number().nonnegative())
      .min(2)
      .describe("Sorted event timestamps in days."),
    external_common_cause_aic: z
      .number()
      .describe("AIC of simpler inhomogeneous Poisson / external common-cause baseline."),
    homogeneous_poisson_aic: z.number().describe("AIC of homogeneous Poisson baseline."),
    mu: z.number().positive().describe("Background intensity mu."),
    alpha: z.number().nonnegative().describe("Self-excitation jump alpha."),
    beta: z
      .number()
      .positive()
      .describe("Exponential decay rate beta (beta > alpha for stability)."),
  })
  .describe("Input for PK-36 Hawkes process comparison.");

export type HawkesInput = z.infer<typeof HawkesInputSchema>;

export const HawkesResultSchema = z
  .strictObject({
    status: z.enum(["executed", "blocked"]).describe("Execution status."),
    causal_proof: z
      .literal(false)
      .describe("Invariant: Hawkes self-excitation is NEVER causal proof."),
    hawkes_aic: z.number().nullable().describe("AIC of fitted Hawkes model."),
    homogeneous_poisson_aic: z.number().describe("AIC of homogeneous Poisson baseline."),
    external_common_cause_aic: z.number().describe("AIC of external common-cause baseline."),
    outperforms_simpler_baselines: z
      .boolean()
      .describe("True only if Hawkes AIC is strictly lower than both simpler baselines."),
    branching_ratio: z.number().nonnegative().nullable().describe("Estimated alpha / beta."),
    unsuitability_report: z
      .custom<UnsuitabilityReport>()
      .nullable()
      .describe("Unsuitability report when gate blocks execution or model is unstable."),
  })
  .describe("PK-36 Hawkes process comparison output.");

export type HawkesResult = z.infer<typeof HawkesResultSchema>;

/**
 * Evaluate a 1D exponential Hawkes process against homogeneous Poisson and
 * external common-cause baselines. Never emits causal proof.
 */
export function evaluateHawkesProcess(rawInput: HawkesInput): HawkesResult {
  const input = HawkesInputSchema.parse(rawInput);

  if (!input.gate_decision.activated) {
    return HawkesResultSchema.parse({
      status: "blocked",
      causal_proof: false,
      hawkes_aic: null,
      homogeneous_poisson_aic: input.homogeneous_poisson_aic,
      external_common_cause_aic: input.external_common_cause_aic,
      outperforms_simpler_baselines: false,
      branching_ratio: null,
      unsuitability_report:
        input.gate_decision.unsuitability_report ??
        buildUnsuitabilityReport({
          method: "pk36_hawkes_process",
          elapsed_months: 0,
          failed_criteria: input.gate_decision.failed_criteria,
          rationale: "Hawkes process evaluation blocked by Data Readiness Gate.",
        }),
    });
  }

  const times = [...input.event_times_days].sort((a, b) => a - b);
  const tMax = times[times.length - 1] ?? 1;
  let logLik = 0;
  let recursiveSum = 0;

  for (let i = 0; i < times.length; i += 1) {
    const ti = times[i] ?? 0;
    if (i > 0) {
      const prev = times[i - 1] ?? 0;
      recursiveSum = Math.exp(-input.beta * (ti - prev)) * (1 + recursiveSum);
    }
    const lambda = input.mu + input.alpha * recursiveSum;
    logLik += Math.log(Math.max(lambda, 1e-12));
  }

  // Subtract integral of intensity over [0, tMax]
  let integralExcitation = 0;
  for (const ti of times) {
    integralExcitation += (input.alpha / input.beta) * (1 - Math.exp(-input.beta * (tMax - ti)));
  }
  logLik -= input.mu * tMax + integralExcitation;

  // 3 parameters: mu, alpha, beta -> AIC = 2*3 - 2*logLik
  const hawkesAic = 6 - 2 * logLik;
  const branchingRatio = input.alpha / input.beta;
  const outperforms =
    hawkesAic < input.homogeneous_poisson_aic && hawkesAic < input.external_common_cause_aic;

  return HawkesResultSchema.parse({
    status: "executed",
    causal_proof: false,
    hawkes_aic: Number(hawkesAic.toFixed(4)),
    homogeneous_poisson_aic: input.homogeneous_poisson_aic,
    external_common_cause_aic: input.external_common_cause_aic,
    outperforms_simpler_baselines: outperforms,
    branching_ratio: Number(branchingRatio.toFixed(4)),
    unsuitability_report: null,
  });
}
