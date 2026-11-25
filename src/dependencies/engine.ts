import { readFileSync } from "node:fs";
import { z } from "zod";
import { COUNTERMEASURE_STAGES } from "../briefs/countermeasures.ts";
import { computeDedupKey, type GeneratedCandidate } from "../discovery/generators/interface.ts";
import { repoPath } from "../pipeline/paths.ts";

export const DEPENDENCY_DIMENSIONS = [
  "flow",
  "stock",
  "nominal_capacity",
  "effective_capacity",
  "concentration",
  "substitutability",
  "response_time",
  "countermeasures",
] as const;
export type DependencyDimension = (typeof DEPENDENCY_DIMENSIONS)[number];

export const VALUE_NATURES = [
  "measured",
  "estimated",
  "forecast",
  "announced_capacity",
  "effective_operational_capacity",
  "unavailable",
] as const;
export type ValueNature = (typeof VALUE_NATURES)[number];

export const UncertaintyIntervalSchema = z
  .strictObject({
    lower: z.number().describe("Lower bound of the uncertainty interval."),
    upper: z.number().describe("Upper bound of the uncertainty interval."),
    confidence_level: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe("Optional confidence level (e.g., 0.9)."),
  })
  .refine((u) => u.lower <= u.upper, {
    message: "Uncertainty interval lower bound must be <= upper bound.",
  })
  .describe("Explicit uncertainty interval for an indicator value.");
export type UncertaintyInterval = z.infer<typeof UncertaintyIntervalSchema>;

export const DependencyIndicatorSchema = z
  .strictObject({
    id: z.string().min(1).describe("Stable indicator identifier."),
    name: z.string().min(1).describe("Human-readable indicator name."),
    dimension: z.enum(DEPENDENCY_DIMENSIONS).describe("Distinct strategic dependency dimension."),
    unit: z
      .string()
      .min(1)
      .describe("Measurement unit (e.g., percent, tonnes_per_year, days_of_demand)."),
    denominator: z
      .string()
      .min(1)
      .describe("Explicit denominator defining what the value is relative to."),
    period: z.string().min(1).describe("Reference period (e.g., 2024, 2024-11, 2028)."),
    geographic_scope: z.string().min(1).describe("Geographic scope (e.g., EU27, Global)."),
    source: z.string().min(1).describe("Authoritative source reference."),
    version: z.string().min(1).describe("Indicator definition/data version."),
    value_nature: z.enum(VALUE_NATURES).describe("Epistemic nature of the value."),
    value: z
      .number()
      .nullable()
      .describe("Numeric value, or null when value_nature is unavailable (never synthetic)."),
    uncertainty_interval: UncertaintyIntervalSchema.nullable().describe(
      "Explicit uncertainty interval, or null if exact/unavailable.",
    ),
    as_of: z.string().min(1).describe("ISO-8601 UTC timestamp when this indicator was recorded."),
  })
  .superRefine((ind, ctx) => {
    if (ind.value_nature === "unavailable" && ind.value !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Indicator with value_nature="unavailable" must have value=null (never a synthetic number).',
        path: ["value"],
      });
    }
    if (ind.value_nature !== "unavailable" && ind.value === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Indicator with value_nature="${ind.value_nature}" must provide a numeric value.`,
        path: ["value"],
      });
    }
  })
  .describe("Sourced strategic dependency indicator with unit, denominator, and value_nature.");
export type DependencyIndicator = z.infer<typeof DependencyIndicatorSchema>;

export const SupplyChainStageSchema = z
  .strictObject({
    stage_id: z.string().min(1).describe("Unique stage identifier."),
    order: z.number().int().positive().describe("1-based upstream-to-downstream order."),
    name: z.string().min(1).describe("Stage name."),
    key_actors: z
      .array(z.string().min(1))
      .min(1)
      .describe("Key countries/regions active at this stage."),
  })
  .describe("Ordered stage in a strategic supply chain.");
export type SupplyChainStage = z.infer<typeof SupplyChainStageSchema>;

export const SupplyChainCountermeasureRefSchema = z
  .strictObject({
    countermeasure_id: z.string().min(1).describe("Countermeasure identifier."),
    title: z.string().min(1).describe("Short title of the countermeasure."),
    stage: z.enum(COUNTERMEASURE_STAGES).describe("PK-13 countermeasure lifecycle stage."),
  })
  .describe("PK-13 stage-tracked countermeasure linked to a supply chain.");
export type SupplyChainCountermeasureRef = z.infer<typeof SupplyChainCountermeasureRefSchema>;

export const SupplyChainModelSchema = z
  .strictObject({
    id: z.string().min(1).describe("Stable supply-chain model identifier."),
    name: z.string().min(1).describe("Human-readable supply-chain name."),
    sector: z.string().min(1).describe("Strategic sector (e.g., critical_raw_materials, energy)."),
    description: z.string().min(1).describe("Factual description of the supply chain."),
    stages: z.array(SupplyChainStageSchema).min(2).describe("Ordered supply-chain stages."),
    indicators: z
      .array(DependencyIndicatorSchema)
      .min(1)
      .describe("Sourced dependency indicators."),
    countermeasures: z
      .array(SupplyChainCountermeasureRefSchema)
      .default([])
      .describe("Linked countermeasures tracked across PK-13 stages."),
  })
  .describe("Sourced strategic supply-chain dependency model.");
export type SupplyChainModel = z.infer<typeof SupplyChainModelSchema>;

export const SupplyChainCatalogSchema = z
  .strictObject({
    schema_version: z.string().min(1).describe("Schema version."),
    catalog_version: z.string().min(1).describe("Catalog release version."),
    updated_at: z.string().min(1).describe("ISO-8601 UTC timestamp of last update."),
    supply_chains: z
      .array(SupplyChainModelSchema)
      .min(2)
      .describe("At least 2 sourced supply-chain models."),
  })
  .describe("Catalog of sourced strategic supply-chain models.");
export type SupplyChainCatalog = z.infer<typeof SupplyChainCatalogSchema>;

export const DEFAULT_SUPPLY_CHAINS_PATH = repoPath("docs/dependencies/supply-chains.v1.json");

export function loadSupplyChainCatalog(
  catalogPath = DEFAULT_SUPPLY_CHAINS_PATH,
): SupplyChainCatalog {
  const raw = JSON.parse(readFileSync(catalogPath, "utf8")) as unknown;
  return SupplyChainCatalogSchema.parse(raw);
}

/**
 * Compute currently available operational capacity from indicators.
 * Rule: `announced_capacity` (e.g., announced factories) and `unavailable` NEVER
 * count toward available capacity today.
 */
export function computeAvailableCapacityToday(indicators: readonly DependencyIndicator[]): {
  available_today: number;
  announced_future_excluded: number;
  unavailable_count: number;
  included_indicator_ids: string[];
  excluded_announced_ids: string[];
} {
  let available = 0;
  let announcedExcluded = 0;
  let unavailableCount = 0;
  const includedIds: string[] = [];
  const excludedAnnouncedIds: string[] = [];

  for (const raw of indicators) {
    const ind = DependencyIndicatorSchema.parse(raw);
    if (ind.value_nature === "unavailable" || ind.value === null) {
      unavailableCount += 1;
      continue;
    }
    if (ind.value_nature === "announced_capacity") {
      announcedExcluded += ind.value;
      excludedAnnouncedIds.push(ind.id);
      continue;
    }
    if (
      ind.value_nature === "effective_operational_capacity" ||
      (ind.dimension === "effective_capacity" && ind.value_nature === "measured")
    ) {
      available += ind.value;
      includedIds.push(ind.id);
    }
  }

  return {
    available_today: available,
    announced_future_excluded: announcedExcluded,
    unavailable_count: unavailableCount,
    included_indicator_ids: includedIds,
    excluded_announced_ids: excludedAnnouncedIds,
  };
}

export type IndicatorComparisonResult =
  | {
      comparable: true;
      difference: number;
      unit: string;
      denominator: string;
      geographic_scope: string;
    }
  | {
      comparable: false;
      reasons: string[];
    };

/**
 * Guard refusing direct comparison across incompatible indicators/units/denominators/scopes,
 * even when both indicators are expressed in `percent`.
 */
export function compareIndicators(
  a: DependencyIndicator,
  b: DependencyIndicator,
): IndicatorComparisonResult {
  const parsedA = DependencyIndicatorSchema.parse(a);
  const parsedB = DependencyIndicatorSchema.parse(b);
  const reasons: string[] = [];

  if (parsedA.value_nature === "unavailable" || parsedA.value === null) {
    reasons.push(`Indicator "${parsedA.id}" is unavailable.`);
  }
  if (parsedB.value_nature === "unavailable" || parsedB.value === null) {
    reasons.push(`Indicator "${parsedB.id}" is unavailable.`);
  }
  if (parsedA.unit !== parsedB.unit) {
    reasons.push(`Incompatible units: "${parsedA.unit}" vs "${parsedB.unit}".`);
  }
  if (parsedA.denominator !== parsedB.denominator) {
    reasons.push(
      `Incompatible denominators (even if both are ${parsedA.unit}): "${parsedA.denominator}" vs "${parsedB.denominator}".`,
    );
  }
  if (parsedA.dimension !== parsedB.dimension) {
    reasons.push(`Incompatible dimensions: "${parsedA.dimension}" vs "${parsedB.dimension}".`);
  }
  if (parsedA.geographic_scope !== parsedB.geographic_scope) {
    reasons.push(
      `Incompatible geographic scopes: "${parsedA.geographic_scope}" vs "${parsedB.geographic_scope}".`,
    );
  }
  if (
    (parsedA.value_nature === "announced_capacity" &&
      parsedB.value_nature === "effective_operational_capacity") ||
    (parsedB.value_nature === "announced_capacity" &&
      parsedA.value_nature === "effective_operational_capacity")
  ) {
    reasons.push(
      "Cannot directly compare announced future capacity against effective operational capacity.",
    );
  }

  if (reasons.length > 0) {
    return { comparable: false, reasons };
  }

  return {
    comparable: true,
    difference: Number(((parsedA.value as number) - (parsedB.value as number)).toFixed(6)),
    unit: parsedA.unit,
    denominator: parsedA.denominator,
    geographic_scope: parsedA.geographic_scope,
  };
}

/**
 * Queue generator `shared_dependency`: surfaces verification questions where
 * high concentration or low substitutability creates a potential shared dependency
 * across actors, without asserting unsupported causal conclusions.
 */
export function generateSharedDependencyCandidates(
  catalog: SupplyChainCatalog,
  options?: { concentration_threshold?: number },
): GeneratedCandidate[] {
  const parsed = SupplyChainCatalogSchema.parse(catalog);
  const threshold = options?.concentration_threshold ?? 65;
  const candidates: GeneratedCandidate[] = [];

  for (const chain of parsed.supply_chains) {
    const highConc = chain.indicators.filter(
      (ind) =>
        (ind.dimension === "concentration" || ind.dimension === "flow") &&
        ind.value !== null &&
        ind.value >= threshold,
    );
    if (highConc.length === 0) continue;

    const topInd = highConc[0];
    if (!topInd) continue;
    const actors = [...new Set(chain.stages.flatMap((s) => s.key_actors))].sort();
    const question = `Does the ${topInd.value}% ${topInd.dimension} recorded in "${chain.name}" (${topInd.period}, ${topInd.geographic_scope}) create an unmitigated shared dependency across ${actors.join(", ")}?`;
    const refs = [chain.id, topInd.id];

    candidates.push({
      method: "shared_dependency",
      method_version: "1.0.0",
      priority: 0.8,
      question,
      refs,
      evidences: [topInd.source],
      alternative_explanations: [
        "Diversified commercial stockpiles or long-term hedging contracts mitigate acute exposure.",
        "Concentration reflects cost optimization rather than strategic leverage.",
      ],
      falsifiers: [
        `Documented alternative supply capacity exceeding ${100 - (topInd.value ?? 0)}% within response_time.`,
        "Verified multi-source procurement diversification across downstream EU operators.",
      ],
      dedup_key: computeDedupKey({ method: "shared_dependency", question, refs }),
      visibility: "publishable",
    });
  }

  return candidates;
}

/**
 * Queue generator `economic_propagation`: surfaces verification questions about
 * potential downstream propagation across ordered supply-chain stages,
 * never producing unsupported causal conclusions.
 */
export function generateEconomicPropagationCandidates(
  catalog: SupplyChainCatalog,
): GeneratedCandidate[] {
  const parsed = SupplyChainCatalogSchema.parse(catalog);
  const candidates: GeneratedCandidate[] = [];

  for (const chain of parsed.supply_chains) {
    const sortedStages = [...chain.stages].sort((a, b) => a.order - b.order);
    const upstream = sortedStages[0];
    const downstream = sortedStages[sortedStages.length - 1];
    if (!upstream || !downstream) continue;

    const responseInd = chain.indicators.find((i) => i.dimension === "response_time");
    const subInd = chain.indicators.find((i) => i.dimension === "substitutability");
    const refs = [
      chain.id,
      upstream.stage_id,
      downstream.stage_id,
      ...(responseInd ? [responseInd.id] : []),
      ...(subInd ? [subInd.id] : []),
    ];

    const question = `If disruption occurs at upstream stage "${upstream.name}" in "${chain.name}", what is the verifiable propagation lag and substitution capacity before impacting "${downstream.name}"?`;

    candidates.push({
      method: "economic_propagation",
      method_version: "1.0.0",
      priority: 0.75,
      question,
      refs,
      evidences: chain.indicators.filter((i) => i.value !== null).map((i) => i.source),
      alternative_explanations: [
        "Downstream inventory buffers or alternative suppliers absorb upstream shocks without price/output pass-through.",
        "Observed downstream volatility is driven by demand-side factors rather than upstream supply.",
      ],
      falsifiers: [
        "Direct empirical evidence of uninterrupted downstream output during historical upstream disruptions.",
        "Verified strategic stockpile coverage exceeding upstream response_time.",
      ],
      dedup_key: computeDedupKey({ method: "economic_propagation", question, refs }),
      visibility: "publishable",
    });
  }

  return candidates;
}
