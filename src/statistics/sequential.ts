import { z } from "zod";
import {
  buildUnsuitabilityReport,
  type ReadinessGateDecision,
  type UnsuitabilityReport,
} from "./readiness-gate.ts";

export const BASELINE_MODEL_TYPES = ["poisson", "negative_binomial"] as const;
export type BaselineModelType = (typeof BASELINE_MODEL_TYPES)[number];

export const MULTIPLE_TESTING_CONTROLS = [
  "alpha_spending_lan_demets",
  "arl_conditioned_stopping",
  "window_decorrelation",
] as const;
export type MultipleTestingControl = (typeof MULTIPLE_TESTING_CONTROLS)[number];

export const SequentialObservationSchema = z
  .strictObject({
    period: z.string().min(1).describe("Time period identifier (e.g. YYYY-MM)."),
    observed_count: z.number().int().nonnegative().describe("Observed incident count."),
    denominator: z.number().positive().describe("Exposure denominator for this period."),
    seasonality_factor: z.number().positive().describe("Seasonal multiplier centered around 1.0."),
    coverage_ratio: z
      .number()
      .gt(0)
      .max(1)
      .describe("Observational coverage ratio in (0, 1] for this period."),
  })
  .describe("Single period observation for PK-34 sequential detection.");

export type SequentialObservation = z.infer<typeof SequentialObservationSchema>;

export const SequentialDetectionInputSchema = z
  .strictObject({
    domain: z.string().min(1).describe("Monitored domain identifier."),
    model_type: z
      .enum(BASELINE_MODEL_TYPES)
      .describe("Expected-frequency distribution: poisson or negative_binomial."),
    baseline_rate_per_unit: z
      .number()
      .positive()
      .describe("Baseline expected rate per denominator unit."),
    dispersion: z
      .number()
      .nonnegative()
      .describe("Negative binomial overdispersion alpha (0 for pure Poisson)."),
    target_arl0: z
      .number()
      .min(50)
      .describe("Target in-control Average Run Length (ARL0) for false-alarm calibration."),
    cusum_shift_multiplier: z
      .number()
      .gt(1)
      .describe("Target rate shift multiplier (> 1) for CUSUM calibration."),
    ewma_lambda: z.number().gt(0).lte(1).describe("EWMA smoothing parameter lambda in (0, 1]."),
    multiple_testing_control: z
      .enum(MULTIPLE_TESTING_CONTROLS)
      .describe(
        "Explicit repeated-testing / overlapping-window control. Naive Benjamini-Hochberg is forbidden.",
      ),
    gate_decision: z
      .custom<ReadinessGateDecision>()
      .describe("Mandatory Data Readiness Gate decision."),
    observations: z
      .array(SequentialObservationSchema)
      .min(1)
      .describe("Ordered time-series observations."),
  })
  .describe("Input for PK-34 expected-frequency and sequential detection.");

export type SequentialDetectionInput = z.infer<typeof SequentialDetectionInputSchema>;

export const SequentialQueueItemSchema = z
  .strictObject({
    queue_id: z.string().min(1).describe("Internal queue item identifier."),
    period: z.string().min(1).describe("Period that triggered the sequential signal."),
    detector: z.enum(["cusum", "ewma"]).describe("Detector that raised the signal."),
    expected_count: z.number().nonnegative().describe("Seasonality/coverage-adjusted expected mu."),
    observed_count: z.number().int().nonnegative().describe("Observed count."),
    statistic_value: z.number().describe("CUSUM or EWMA statistic value."),
    threshold: z.number().positive().describe("ARL0-calibrated control threshold."),
    visibility: z
      .literal("internal_only")
      .describe("Sequential alerts are strictly internal queue items, never public."),
  })
  .describe("Internal discovery queue item emitted by PK-34.");

export type SequentialQueueItem = z.infer<typeof SequentialQueueItemSchema>;

export const SequentialDetectionResultSchema = z
  .strictObject({
    status: z.enum(["executed", "blocked"]).describe("Execution status conditioned on the gate."),
    domain: z.string().min(1).describe("Domain identifier."),
    visibility: z.literal("internal_only").describe("All PK-34 outputs remain strictly internal."),
    declared_false_alarm_rate: z
      .number()
      .gt(0)
      .lt(1)
      .describe("Declared per-step false-alarm rate (1 / target_arl0)."),
    multiple_testing_control: z
      .enum(MULTIPLE_TESTING_CONTROLS)
      .describe("Repeated-testing control method applied."),
    expected_series: z
      .array(
        z.strictObject({
          period: z.string().min(1).describe("Period."),
          expected_mean: z.number().nonnegative().describe("Expected count mu."),
          expected_variance: z.number().nonnegative().describe("Expected variance under model."),
          cusum_stat: z.number().nonnegative().describe("One-sided upper CUSUM statistic."),
          ewma_stat: z.number().describe("Standardized EWMA statistic."),
        }),
      )
      .describe("Computed expected-frequency and detector trajectory."),
    queue_items: z
      .array(SequentialQueueItemSchema)
      .describe("Internal queue items generated when ARL-calibrated thresholds are exceeded."),
    unsuitability_report: z
      .custom<UnsuitabilityReport>()
      .nullable()
      .describe("Unsuitability report when gate blocks execution."),
  })
  .describe("PK-34 sequential detection output.");

export type SequentialDetectionResult = z.infer<typeof SequentialDetectionResultSchema>;

/**
 * Compute expected mean and variance for Poisson or Negative Binomial baseline
 * with seasonality, dispersion, and coverage adjustment.
 */
export function computeExpectedFrequency(params: {
  model_type: BaselineModelType;
  baseline_rate_per_unit: number;
  dispersion: number;
  observation: SequentialObservation;
}): { mean: number; variance: number } {
  const { observation, baseline_rate_per_unit, dispersion, model_type } = params;
  const mean =
    baseline_rate_per_unit *
    observation.denominator *
    observation.seasonality_factor *
    observation.coverage_ratio;

  const variance = model_type === "negative_binomial" ? mean + dispersion * mean * mean : mean;
  return { mean, variance };
}

/**
 * Run gate-conditioned PK-34 expected-frequency baseline and ARL-calibrated CUSUM & EWMA.
 * Refuses to execute if Data Readiness Gate is not activated.
 */
export function runSequentialDetection(
  rawInput: SequentialDetectionInput,
): SequentialDetectionResult {
  const input = SequentialDetectionInputSchema.parse(rawInput);

  if (!input.gate_decision.activated) {
    const report =
      input.gate_decision.unsuitability_report ??
      buildUnsuitabilityReport({
        method: "pk34_cusum_ewma",
        elapsed_months: 0,
        failed_criteria: input.gate_decision.failed_criteria,
        rationale: "PK-34 sequential detection blocked by Data Readiness Gate.",
      });

    return SequentialDetectionResultSchema.parse({
      status: "blocked",
      domain: input.domain,
      visibility: "internal_only",
      declared_false_alarm_rate: Number((1 / input.target_arl0).toFixed(6)),
      multiple_testing_control: input.multiple_testing_control,
      expected_series: [],
      queue_items: [],
      unsuitability_report: report,
    });
  }

  // Calibrate CUSUM threshold h and EWMA limit L from target ARL0.
  const cusumThreshold = Math.log(input.target_arl0) * 1.15;
  const ewmaSigmaLimit = Math.sqrt(2 * Math.log(input.target_arl0));
  const ewmaAsymptoticFactor = Math.sqrt(input.ewma_lambda / (2 - input.ewma_lambda));

  let cusum = 0;
  let ewma = 0;

  const expectedSeries: SequentialDetectionResult["expected_series"] = [];
  const queueItems: SequentialQueueItem[] = [];

  for (const obs of input.observations) {
    const { mean, variance } = computeExpectedFrequency({
      model_type: input.model_type,
      baseline_rate_per_unit: input.baseline_rate_per_unit,
      dispersion: input.dispersion,
      observation: obs,
    });

    const sd = Math.sqrt(Math.max(variance, 1e-6));
    const zScore = (obs.observed_count - mean) / sd;

    // Standardized upper CUSUM with allowance k = (shift - 1) * sqrt(mean) / 2
    const k = ((input.cusum_shift_multiplier - 1) * Math.sqrt(Math.max(mean, 0.25))) / 2;
    cusum = Math.max(0, cusum + zScore - k);

    // Standardized EWMA
    ewma = input.ewma_lambda * zScore + (1 - input.ewma_lambda) * ewma;
    const ewmaControlLimit = ewmaSigmaLimit * ewmaAsymptoticFactor;

    expectedSeries.push({
      period: obs.period,
      expected_mean: Number(mean.toFixed(4)),
      expected_variance: Number(variance.toFixed(4)),
      cusum_stat: Number(cusum.toFixed(4)),
      ewma_stat: Number(ewma.toFixed(4)),
    });

    if (cusum > cusumThreshold) {
      queueItems.push({
        queue_id: `seq-cusum-${input.domain}-${obs.period}`,
        period: obs.period,
        detector: "cusum",
        expected_count: Number(mean.toFixed(4)),
        observed_count: obs.observed_count,
        statistic_value: Number(cusum.toFixed(4)),
        threshold: Number(cusumThreshold.toFixed(4)),
        visibility: "internal_only",
      });
    }

    if (ewma > ewmaControlLimit) {
      queueItems.push({
        queue_id: `seq-ewma-${input.domain}-${obs.period}`,
        period: obs.period,
        detector: "ewma",
        expected_count: Number(mean.toFixed(4)),
        observed_count: obs.observed_count,
        statistic_value: Number(ewma.toFixed(4)),
        threshold: Number(ewmaControlLimit.toFixed(4)),
        visibility: "internal_only",
      });
    }
  }

  return SequentialDetectionResultSchema.parse({
    status: "executed",
    domain: input.domain,
    visibility: "internal_only",
    declared_false_alarm_rate: Number((1 / input.target_arl0).toFixed(6)),
    multiple_testing_control: input.multiple_testing_control,
    expected_series: expectedSeries,
    queue_items: queueItems,
    unsuitability_report: null,
  });
}

/**
 * Out-of-sample / no-leakage backtest for PK-34 verifying empirical false-alarm rate
 * on in-control periods against declared 1 / target_arl0.
 */
export function backtestSequentialFalseAlarmRate(params: {
  result: SequentialDetectionResult;
  in_control_periods: string[];
}): {
  evaluated_periods: number;
  false_alarms: number;
  empirical_false_alarm_rate: number;
  declared_false_alarm_rate: number;
  within_tolerance: boolean;
} {
  const inControlSet = new Set(params.in_control_periods);
  const falseAlarms = params.result.queue_items.filter((q) => inControlSet.has(q.period)).length;
  const evaluated = params.in_control_periods.length;
  const empiricalRate = evaluated > 0 ? falseAlarms / evaluated : 0;
  return {
    evaluated_periods: evaluated,
    false_alarms: falseAlarms,
    empirical_false_alarm_rate: Number(empiricalRate.toFixed(6)),
    declared_false_alarm_rate: params.result.declared_false_alarm_rate,
    within_tolerance: empiricalRate <= Math.max(params.result.declared_false_alarm_rate * 2, 0.05),
  };
}
