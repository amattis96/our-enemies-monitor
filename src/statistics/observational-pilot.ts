import { z } from "zod";
import type { ReadinessGateInput, StatisticalMethodId } from "./readiness-gate.ts";

export const PILOT_DOMAINS = ["subsea_cable_baltic", "gnss_interference_air"] as const;
export type PilotDomain = (typeof PILOT_DOMAINS)[number];

export const PILOT_EVENT_CLASSIFICATIONS = [
  "ordinary_non_hostile",
  "contested",
  "attributed_incident",
] as const;
export type PilotEventClassification = (typeof PILOT_EVENT_CLASSIFICATIONS)[number];

export const PilotObservationSchema = z
  .strictObject({
    id: z.string().min(1).describe("Unique observational record identifier."),
    period: z.string().min(1).describe("Time bucket (e.g. YYYY-MM)."),
    domain: z.enum(PILOT_DOMAINS).describe("Observational pilot domain."),
    classification: z
      .enum(PILOT_EVENT_CLASSIFICATIONS)
      .describe("Event classification including ordinary non-hostile baseline events."),
    incident_count: z
      .number()
      .int()
      .nonnegative()
      .describe("Number of observed events in this record."),
    denominator_value: z
      .number()
      .positive()
      .describe("Public denominator value (e.g. vessel transits or flight operations)."),
    denominator_unit: z.string().min(1).describe("Unit of the public denominator."),
    retrospective_comparable: z
      .boolean()
      .describe("True when collected under identical criteria and perimeter as current series."),
    collection_criteria_version: z
      .string()
      .min(1)
      .describe("Documented collection criteria version identifier."),
  })
  .describe("Single observational pilot record with public denominator.");

export type PilotObservation = z.infer<typeof PilotObservationSchema>;

export const CoverageLogEntrySchema = z
  .strictObject({
    period: z.string().min(1).describe("Time bucket (e.g. YYYY-MM)."),
    coverage_ratio: z
      .number()
      .gt(0)
      .max(1)
      .describe("Estimated observational coverage in (0, 1] for this period."),
    active_sources: z
      .number()
      .int()
      .nonnegative()
      .describe("Number of active systematic sources contributing in this period."),
    criteria_version: z
      .string()
      .min(1)
      .describe("Collection criteria version active during this period."),
    notes: z
      .string()
      .min(1)
      .optional()
      .describe("Optional note on coverage changes to prevent misreading coverage as threat."),
  })
  .describe("Coverage-over-time log entry for PK-33.");

export type CoverageLogEntry = z.infer<typeof CoverageLogEntrySchema>;

export const ObservationalPilotDatasetSchema = z
  .strictObject({
    storage_scope: z
      .literal("observational_pilot")
      .describe("Explicitly separates pilot dataset from curated data/ corpus."),
    distinct_from_curated_corpus: z
      .literal(true)
      .describe("Invariant guarantee that pilot observations are not mixed into data/."),
    domain: z.enum(PILOT_DOMAINS).describe("Pilot domain identifier."),
    denominator_name: z.string().min(1).describe("Public denominator name."),
    documented_criteria: z
      .string()
      .min(1)
      .describe("Fixed, documented inclusion and measurement criteria."),
    observations: z
      .array(PilotObservationSchema)
      .describe("Systematic observations including ordinary non-hostile events."),
    coverage_log: z
      .array(CoverageLogEntrySchema)
      .describe("Coverage-over-time log preventing coverage bias."),
  })
  .describe("Separate observational pilot dataset for PK-33.");

export type ObservationalPilotDataset = z.infer<typeof ObservationalPilotDatasetSchema>;

export type CoverageAdjustedSeriesPoint = {
  period: string;
  raw_incidents: number;
  ordinary_non_hostile_incidents: number;
  denominator_value: number;
  coverage_ratio: number;
  coverage_adjusted_rate_per_10k: number;
  retrospective_comparable: boolean;
};

/**
 * Create a validated observational pilot dataset distinct from the curated corpus (`data/`).
 */
export function createObservationalPilotDataset(params: {
  domain: PilotDomain;
  denominator_name: string;
  documented_criteria: string;
  observations: PilotObservation[];
  coverage_log: CoverageLogEntry[];
}): ObservationalPilotDataset {
  return ObservationalPilotDatasetSchema.parse({
    storage_scope: "observational_pilot",
    distinct_from_curated_corpus: true,
    domain: params.domain,
    denominator_name: params.denominator_name,
    documented_criteria: params.documented_criteria,
    observations: params.observations,
    coverage_log: params.coverage_log,
  });
}

/**
 * Compute coverage-adjusted incident rates per 10,000 denominator units,
 * ensuring increases in observational coverage are not mistaken for threat increases.
 */
export function computeCoverageAdjustedSeries(
  dataset: ObservationalPilotDataset,
): CoverageAdjustedSeriesPoint[] {
  const coverageByPeriod = new Map<string, CoverageLogEntry>();
  for (const entry of dataset.coverage_log) {
    coverageByPeriod.set(entry.period, entry);
  }

  const byPeriod = new Map<string, PilotObservation[]>();
  for (const obs of dataset.observations) {
    const list = byPeriod.get(obs.period) ?? [];
    list.push(obs);
    byPeriod.set(obs.period, list);
  }

  const periods = [...byPeriod.keys()].sort();
  return periods.map((period) => {
    const rows = byPeriod.get(period) ?? [];
    const cov = coverageByPeriod.get(period);
    const coverageRatio = cov?.coverage_ratio ?? 1;

    let rawIncidents = 0;
    let ordinaryNonHostile = 0;
    let denominatorValue = 0;
    let allComparable = true;

    for (const row of rows) {
      rawIncidents += row.incident_count;
      if (row.classification === "ordinary_non_hostile") {
        ordinaryNonHostile += row.incident_count;
      }
      denominatorValue += row.denominator_value;
      if (!row.retrospective_comparable) {
        allComparable = false;
      }
    }

    const effectiveDenominator = denominatorValue * coverageRatio;
    const ratePer10k = effectiveDenominator > 0 ? (rawIncidents / effectiveDenominator) * 10000 : 0;

    return {
      period,
      raw_incidents: rawIncidents,
      ordinary_non_hostile_incidents: ordinaryNonHostile,
      denominator_value: denominatorValue,
      coverage_ratio: coverageRatio,
      coverage_adjusted_rate_per_10k: Number(ratePer10k.toFixed(6)),
      retrospective_comparable: allComparable,
    };
  });
}

/**
 * Derive a Data Readiness Gate input payload from an observational pilot dataset.
 */
export function pilotDatasetToGateInput(params: {
  dataset: ObservationalPilotDataset;
  method: StatisticalMethodId;
  elapsed_months: number;
  expected_periods: number;
  observed_cycles: number;
  independent_test_observations: number;
}): ReadinessGateInput {
  const uniquePeriods = new Set(params.dataset.observations.map((o) => o.period));
  const missingRatio =
    params.expected_periods > 0
      ? Math.max(0, (params.expected_periods - uniquePeriods.size) / params.expected_periods)
      : 1;

  const criteriaVersions = new Set(
    params.dataset.observations.map((o) => o.collection_criteria_version),
  );
  const nonComparableCount = params.dataset.observations.filter(
    (o) => !o.retrospective_comparable,
  ).length;

  return {
    method: params.method,
    elapsed_months: params.elapsed_months,
    missing_period_ratio: Number(missingRatio.toFixed(4)),
    source_discontinuities: nonComparableCount,
    denominator_present: params.dataset.observations.every((o) => o.denominator_value > 0),
    denominator_coherent: params.dataset.observations.length > 0,
    usable_observations: params.dataset.observations.length,
    observed_cycles: params.observed_cycles,
    collection_criteria_changes: Math.max(0, criteriaVersions.size - 1),
    independent_test_period_available: params.independent_test_observations > 0,
    independent_test_observations: params.independent_test_observations,
  };
}
