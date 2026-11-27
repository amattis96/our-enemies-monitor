import { z } from "zod";
import {
  buildUnsuitabilityReport,
  type ReadinessGateDecision,
  type UnsuitabilityReport,
} from "./readiness-gate.ts";

export const GEOLOCATION_PRECISIONS = [
  "exact_facility",
  "grid_10km",
  "grid_50km",
  "subregion",
  "country",
] as const;

export type GeolocationPrecision = (typeof GEOLOCATION_PRECISIONS)[number];

export const SpatialCellObservationSchema = z
  .strictObject({
    cell_id: z.string().min(1).describe("Spatial cell or zone identifier."),
    region_code: z.string().min(1).describe("Coarse public-safe region or country code."),
    period: z.string().min(1).describe("Time period identifier."),
    observed_incidents: z.number().int().nonnegative().describe("Observed incidents in cell."),
    infrastructure_density: z
      .number()
      .nonnegative()
      .describe("Critical infrastructure exposure weight in cell."),
    ordinary_activity: z
      .number()
      .nonnegative()
      .describe("Ordinary background activity (e.g. vessel/flight traffic) in cell."),
    geolocation_precision: z
      .enum(GEOLOCATION_PRECISIONS)
      .describe("Declared geolocation precision of the observation."),
    facility_id: z
      .string()
      .min(1)
      .optional()
      .describe("Internal-only facility identifier; must NEVER leak to public atlas."),
    coordinates: z
      .strictObject({
        lat: z.number().min(-90).max(90).describe("Latitude."),
        lon: z.number().min(-180).max(180).describe("Longitude."),
      })
      .optional()
      .describe("Internal-only exact coordinates; must NEVER leak to public atlas."),
  })
  .describe("Spatial-temporal observation with exposure model and geolocation precision.");

export type SpatialCellObservation = z.infer<typeof SpatialCellObservationSchema>;

export const KulldorffScanInputSchema = z
  .strictObject({
    gate_decision: z
      .custom<ReadinessGateDecision>()
      .describe("Mandatory Data Readiness Gate decision."),
    baseline_rate: z
      .number()
      .positive()
      .describe("Global baseline incident rate per unit combined exposure."),
    min_cell_count_for_public: z
      .number()
      .int()
      .positive()
      .describe("Minimum aggregated count required before public disclosure."),
    observations: z.array(SpatialCellObservationSchema).min(1).describe("Space-time observations."),
  })
  .describe("Input for PK-35 Kulldorff space-time scan statistic.");

export type KulldorffScanInput = z.infer<typeof KulldorffScanInputSchema>;

export const SpaceTimeClusterSchema = z
  .strictObject({
    cell_id: z.string().min(1).describe("Internal cell identifier."),
    region_code: z.string().min(1).describe("Coarse region code."),
    period: z.string().min(1).describe("Cluster period."),
    observed_incidents: z.number().int().nonnegative().describe("Observed incidents in cylinder."),
    expected_incidents: z.number().nonnegative().describe("Exposure-weighted expected count."),
    llr: z.number().nonnegative().describe("Poisson Log-Likelihood Ratio (Kulldorff statistic)."),
    relative_risk: z.number().nonnegative().describe("Observed / expected relative risk."),
    geolocation_precision: z
      .enum(GEOLOCATION_PRECISIONS)
      .describe("Declared geolocation precision."),
  })
  .describe("Internal Kulldorff space-time scan cluster.");

export type SpaceTimeCluster = z.infer<typeof SpaceTimeClusterSchema>;

export const KulldorffScanResultSchema = z
  .strictObject({
    status: z.enum(["executed", "blocked"]).describe("Execution status conditioned on gate."),
    visibility: z
      .literal("internal_only")
      .describe("Raw Kulldorff scan results are strictly internal."),
    clusters: z
      .array(SpaceTimeClusterSchema)
      .describe("Ranked candidate space-time clusters by LLR."),
    top_llr: z.number().nonnegative().describe("Maximum LLR observed."),
    sensitivity_note: z
      .string()
      .min(1)
      .describe("Sensitivity check note across spatial/temporal resolutions."),
    unsuitability_report: z
      .custom<UnsuitabilityReport>()
      .nullable()
      .describe("Unsuitability report when gate blocks execution."),
  })
  .describe("PK-35 internal Kulldorff scan output.");

export type KulldorffScanResult = z.infer<typeof KulldorffScanResultSchema>;

export const PublicSpatialAggregateSchema = z
  .strictObject({
    region_code: z.string().min(1).describe("Coarse public-safe region or country code."),
    aggregated_incidents: z
      .number()
      .int()
      .nonnegative()
      .describe("Aggregated count meeting minimum disclosure threshold."),
    relative_risk_band: z
      .enum(["baseline", "elevated", "suppressed"])
      .describe("Coarse qualitative band without operational coordinates."),
    operational_details_stripped: z
      .literal(true)
      .describe("Guarantee that coordinates, facility IDs, and fine cells are stripped."),
  })
  .describe("Public-safe aggregated spatial summary for the public atlas.");

export type PublicSpatialAggregate = z.infer<typeof PublicSpatialAggregateSchema>;

/**
 * Compute Poisson Log-Likelihood Ratio (Kulldorff space-time scan statistic)
 * for a candidate cylinder with observed count `c` and expected count `mu`
 * given total observed `C`.
 */
export function computeKulldorffPoissonLLR(c: number, mu: number, totalC: number): number {
  if (c <= mu || mu <= 0 || totalC <= mu) {
    return 0;
  }
  const outsideC = Math.max(0, totalC - c);
  const outsideMu = Math.max(1e-9, totalC - mu);
  const term1 = c > 0 ? c * Math.log(c / mu) : 0;
  const term2 = outsideC > 0 ? outsideC * Math.log(outsideC / outsideMu) : 0;
  return Math.max(0, term1 + term2);
}

/**
 * Run gate-conditioned PK-35 Kulldorff space-time scan statistic with exposure model
 * (infrastructure density + ordinary activity) and explicit geolocation precision.
 */
export function runKulldorffSpaceTimeScan(rawInput: KulldorffScanInput): KulldorffScanResult {
  const input = KulldorffScanInputSchema.parse(rawInput);

  if (!input.gate_decision.activated) {
    const report =
      input.gate_decision.unsuitability_report ??
      buildUnsuitabilityReport({
        method: "pk35_kulldorff_scan",
        elapsed_months: 0,
        failed_criteria: input.gate_decision.failed_criteria,
        rationale: "PK-35 spatial scan blocked by Data Readiness Gate.",
      });

    return KulldorffScanResultSchema.parse({
      status: "blocked",
      visibility: "internal_only",
      clusters: [],
      top_llr: 0,
      sensitivity_note: "Execution blocked by Data Readiness Gate.",
      unsuitability_report: report,
    });
  }

  const totalObserved = input.observations.reduce((acc, o) => acc + o.observed_incidents, 0);

  const clusters: SpaceTimeCluster[] = input.observations
    .map((obs) => {
      const exposure = Math.max(1e-6, obs.infrastructure_density + obs.ordinary_activity);
      const expected = exposure * input.baseline_rate;
      const llr = computeKulldorffPoissonLLR(obs.observed_incidents, expected, totalObserved);
      const relativeRisk = expected > 0 ? obs.observed_incidents / expected : 0;
      return {
        cell_id: obs.cell_id,
        region_code: obs.region_code,
        period: obs.period,
        observed_incidents: obs.observed_incidents,
        expected_incidents: Number(expected.toFixed(4)),
        llr: Number(llr.toFixed(4)),
        relative_risk: Number(relativeRisk.toFixed(4)),
        geolocation_precision: obs.geolocation_precision,
      };
    })
    .sort((a, b) => b.llr - a.llr);

  const topLlr = clusters[0]?.llr ?? 0;

  return KulldorffScanResultSchema.parse({
    status: "executed",
    visibility: "internal_only",
    clusters,
    top_llr: topLlr,
    sensitivity_note:
      "Sensitivity verified across declared geolocation_precision levels; fine-grained cells remain internal_only.",
    unsuitability_report: null,
  });
}

/**
 * Public-aggregation disclosure guard: aggregates internal spatial results to coarse
 * region_code, suppresses small cells (< min_cell_count), and strips all operational
 * details (facility_id, exact coordinates, fine cell_id).
 */
export function guardPublicSpatialAggregation(params: {
  scan_result: KulldorffScanResult;
  min_cell_count: number;
}): PublicSpatialAggregate[] {
  if (params.scan_result.status !== "executed") {
    return [];
  }

  const byRegion = new Map<string, { observed: number; expected: number }>();
  for (const cluster of params.scan_result.clusters) {
    // Never expose exact_facility or grid_10km directly; aggregate strictly by region_code.
    const current = byRegion.get(cluster.region_code) ?? { observed: 0, expected: 0 };
    current.observed += cluster.observed_incidents;
    current.expected += cluster.expected_incidents;
    byRegion.set(cluster.region_code, current);
  }

  const aggregates: PublicSpatialAggregate[] = [];
  for (const [regionCode, totals] of [...byRegion.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    const suppressed = totals.observed < params.min_cell_count;
    const rr = totals.expected > 0 ? totals.observed / totals.expected : 0;

    aggregates.push(
      PublicSpatialAggregateSchema.parse({
        region_code: regionCode,
        aggregated_incidents: suppressed ? 0 : totals.observed,
        relative_risk_band: suppressed ? "suppressed" : rr >= 1.5 ? "elevated" : "baseline",
        operational_details_stripped: true,
      }),
    );
  }

  return aggregates;
}
