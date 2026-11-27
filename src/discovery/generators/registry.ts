import {
  classifyRelationship,
  isEligibleForAutomaticInference,
} from "../../claims/canonical-predicates.ts";
import { activePairKeys, type InferenceRegistry, pairKey } from "../../editorial/inferences.ts";
import type { Dataset } from "../../model/index.ts";
import { createContradictionsGenerator } from "./contradictions.ts";
import { createEvidentiaryGapsGenerator } from "./evidentiary-gaps.ts";
import type { DiscoveryGenerator, GeneratedCandidate, GeneratorContext } from "./interface.ts";
import { createJudicialUpdatesGenerator } from "./judicial-updates.ts";
import { createMissingLinksGenerator } from "./missing-links.ts";
import {
  createOpenTriadsGenerator,
  GENERATOR_ACTIVATION_STATES,
  type GeneratorActivationState,
  type GeneratorDeps,
  resolveGeneratorDeps,
} from "./open-triads.ts";
import { createRelationChangesGenerator } from "./relation-changes.ts";
import { createWeakBridgesGenerator } from "./weak-bridges.ts";

export { GENERATOR_ACTIVATION_STATES, type GeneratorActivationState };

export type RegisteredGeneratorSpec = {
  id: string;
  activation: GeneratorActivationState;
  min_ex_ante_quality: number;
  min_ex_post_yield: number;
  generator: DiscoveryGenerator;
};

export type ValidationTarget = {
  target_refs: readonly string[];
  method?: string;
  confirmed: boolean;
};

export type ExAnteQualityResult = {
  total_count: number;
  valid_count: number;
  quality_score: number;
  forbidden_hits: number;
  unmapped_hits: number;
};

export type ExPostYieldResult = {
  total_candidates: number;
  confirmed_hits: number;
  yield_rate: number;
  validation_recall: number;
};

export type GeneratorRunMetrics = {
  id: string;
  version: string;
  activation: GeneratorActivationState;
  skipped: boolean;
  candidate_count: number;
  ex_ante: ExAnteQualityResult;
  ex_post: ExPostYieldResult;
  eligible_for_promotion: boolean;
  promotion_block_reasons: string[];
};

export type RegistryRunResult = {
  active_candidates: GeneratedCandidate[];
  shadow_candidates: GeneratedCandidate[];
  metrics: GeneratorRunMetrics[];
};

/**
 * Every generator starts in `shadow` (plan §5.13): promotion to
 * `experimental` or `active` is an explicit, recorded decision taken after
 * the ex-ante/ex-post gate on a validation set, never a code default.
 */
export const DEFAULT_ACTIVATION_MAP: Record<string, GeneratorActivationState> = {
  open_triads: "shadow",
  weak_bridges: "shadow",
  contradictions: "shadow",
  relation_changes: "shadow",
  missing_links: "shadow",
  judicial_updates: "shadow",
  evidentiary_gaps: "shadow",
};

export function createGeneratorRegistry(
  deps?: GeneratorDeps & { activations?: Partial<Record<string, GeneratorActivationState>> },
): RegisteredGeneratorSpec[] {
  const activations = { ...DEFAULT_ACTIVATION_MAP, ...(deps?.activations ?? {}) };
  return [
    {
      id: "open_triads",
      activation: activations.open_triads ?? "shadow",
      min_ex_ante_quality: 0.9,
      min_ex_post_yield: 0.2,
      generator: createOpenTriadsGenerator(deps),
    },
    {
      id: "weak_bridges",
      activation: activations.weak_bridges ?? "shadow",
      min_ex_ante_quality: 0.85,
      min_ex_post_yield: 0.2,
      generator: createWeakBridgesGenerator(deps),
    },
    {
      id: "contradictions",
      activation: activations.contradictions ?? "shadow",
      min_ex_ante_quality: 0.9,
      min_ex_post_yield: 0.25,
      generator: createContradictionsGenerator(deps),
    },
    {
      id: "relation_changes",
      activation: activations.relation_changes ?? "shadow",
      min_ex_ante_quality: 0.85,
      min_ex_post_yield: 0.2,
      generator: createRelationChangesGenerator(deps),
    },
    {
      id: "missing_links",
      activation: activations.missing_links ?? "shadow",
      min_ex_ante_quality: 0.85,
      min_ex_post_yield: 0.2,
      generator: createMissingLinksGenerator(deps),
    },
    {
      id: "judicial_updates",
      activation: activations.judicial_updates ?? "shadow",
      min_ex_ante_quality: 0.9,
      min_ex_post_yield: 0.2,
      generator: createJudicialUpdatesGenerator(deps),
    },
    {
      id: "evidentiary_gaps",
      activation: activations.evidentiary_gaps ?? "shadow",
      min_ex_ante_quality: 0.85,
      min_ex_post_yield: 0.2,
      generator: createEvidentiaryGapsGenerator(deps),
    },
  ];
}

/**
 * Ex-ante quality measurement: checks structural completeness (evidences,
 * alternative explanations, falsifiers) and zero B15 forbidden / unmapped leaks.
 */
export function measureExAnteQuality(
  candidates: readonly GeneratedCandidate[],
  dataset: Dataset,
  inferenceRegistry: InferenceRegistry,
  methodId?: string,
): ExAnteQualityResult {
  if (candidates.length === 0) {
    return {
      total_count: 0,
      valid_count: 0,
      quality_score: 1,
      forbidden_hits: 0,
      unmapped_hits: 0,
    };
  }

  const forbiddenPairs = activePairKeys(inferenceRegistry);
  const relMap = new Map(dataset.relationships.map((r) => [r.id, r]));
  let validCount = 0;
  let forbiddenHits = 0;
  let unmappedHits = 0;

  for (const c of candidates) {
    const hasEvidences = (c.evidences?.length ?? 0) > 0;
    const hasAlts = (c.alternative_explanations?.length ?? 0) > 0;
    const hasFalsifiers = (c.falsifiers?.length ?? 0) > 0;

    let hasForbidden = false;
    for (let i = 0; i < c.refs.length; i += 1) {
      for (let j = i + 1; j < c.refs.length; j += 1) {
        const a = c.refs[i];
        const b = c.refs[j];
        if (a && b && forbiddenPairs.has(pairKey(a, b))) {
          hasForbidden = true;
        }
      }
    }

    let hasUnmapped = false;
    // evidentiary_gaps intentionally surfaces unmapped predicates for human review
    if (methodId !== "evidentiary_gaps") {
      for (const ref of c.refs) {
        const rel = relMap.get(ref);
        if (!rel) continue;
        const mapped = classifyRelationship(rel);
        if (!isEligibleForAutomaticInference(mapped.mapping)) {
          hasUnmapped = true;
        }
      }
    }

    if (hasForbidden) forbiddenHits += 1;
    if (hasUnmapped) unmappedHits += 1;
    if (hasEvidences && hasAlts && hasFalsifiers && !hasForbidden && !hasUnmapped) {
      validCount += 1;
    }
  }

  return {
    total_count: candidates.length,
    valid_count: validCount,
    quality_score: validCount / candidates.length,
    forbidden_hits: forbiddenHits,
    unmapped_hits: unmappedHits,
  };
}

/**
 * Ex-post yield measurement against a validation set of confirmed outcomes.
 */
export function measureExPostYield(
  candidates: readonly GeneratedCandidate[],
  validationSet: readonly ValidationTarget[],
): ExPostYieldResult {
  const confirmedTargets = validationSet.filter((v) => v.confirmed);
  if (candidates.length === 0) {
    return {
      total_candidates: 0,
      confirmed_hits: 0,
      yield_rate: 0,
      validation_recall: 0,
    };
  }

  let confirmedHits = 0;
  const matchedTargets = new Set<number>();

  for (const c of candidates) {
    const refSet = new Set(c.refs);
    let hit = false;
    for (let idx = 0; idx < confirmedTargets.length; idx += 1) {
      const target = confirmedTargets[idx];
      if (!target) continue;
      if (target.method && target.method !== c.method) continue;
      if (target.target_refs.every((r) => refSet.has(r))) {
        hit = true;
        matchedTargets.add(idx);
      }
    }
    if (hit) confirmedHits += 1;
  }

  return {
    total_candidates: candidates.length,
    confirmed_hits: confirmedHits,
    yield_rate: confirmedHits / candidates.length,
    validation_recall:
      confirmedTargets.length > 0 ? matchedTargets.size / confirmedTargets.length : 0,
  };
}

/**
 * Enforces that a generator in `shadow` state cannot advance past `shadow`
 * until it passes ex-ante quality and ex-post yield thresholds on a validation set.
 */
export function evaluatePromotionGate(
  spec: Pick<
    RegisteredGeneratorSpec,
    "id" | "activation" | "min_ex_ante_quality" | "min_ex_post_yield"
  >,
  exAnte: ExAnteQualityResult,
  exPost: ExPostYieldResult,
  hasValidationSet: boolean,
): { eligible: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (exAnte.forbidden_hits > 0) {
    reasons.push(`forbidden_hits=${exAnte.forbidden_hits} (must be 0)`);
  }
  if (exAnte.unmapped_hits > 0) {
    reasons.push(`unmapped_hits=${exAnte.unmapped_hits} (must be 0)`);
  }
  if (exAnte.quality_score < spec.min_ex_ante_quality) {
    reasons.push(
      `ex_ante_quality=${exAnte.quality_score.toFixed(2)} < ${spec.min_ex_ante_quality.toFixed(2)}`,
    );
  }
  if (!hasValidationSet) {
    reasons.push("no validation set provided for ex-post yield measurement");
  } else if (exPost.yield_rate < spec.min_ex_post_yield) {
    reasons.push(
      `ex_post_yield=${exPost.yield_rate.toFixed(2)} < ${spec.min_ex_post_yield.toFixed(2)}`,
    );
  }
  return { eligible: reasons.length === 0, reasons };
}

export async function runGeneratorRegistry(
  context: GeneratorContext,
  options?: GeneratorDeps & {
    activations?: Partial<Record<string, GeneratorActivationState>>;
    validationSet?: readonly ValidationTarget[];
  },
): Promise<RegistryRunResult> {
  const { dataset, inferenceRegistry } = resolveGeneratorDeps(options);
  const registry = createGeneratorRegistry(options);
  const validationSet = options?.validationSet ?? [];
  const hasValidationSet = validationSet.length > 0;

  const activeCandidates: GeneratedCandidate[] = [];
  const shadowCandidates: GeneratedCandidate[] = [];
  const metrics: GeneratorRunMetrics[] = [];

  for (const spec of registry) {
    if (spec.activation === "disabled") {
      const emptyExAnte = measureExAnteQuality([], dataset, inferenceRegistry, spec.id);
      const emptyExPost = measureExPostYield([], validationSet);
      metrics.push({
        id: spec.id,
        version: spec.generator.metadata.version,
        activation: spec.activation,
        skipped: true,
        candidate_count: 0,
        ex_ante: emptyExAnte,
        ex_post: emptyExPost,
        eligible_for_promotion: false,
        promotion_block_reasons: ["generator is disabled"],
      });
      continue;
    }

    const generated = await spec.generator.generate(context);
    const exAnte = measureExAnteQuality(generated, dataset, inferenceRegistry, spec.id);
    const exPost = measureExPostYield(generated, validationSet);
    const gate = evaluatePromotionGate(spec, exAnte, exPost, hasValidationSet);

    if (spec.activation === "shadow") {
      shadowCandidates.push(...generated);
    } else {
      activeCandidates.push(...generated);
    }

    metrics.push({
      id: spec.id,
      version: spec.generator.metadata.version,
      activation: spec.activation,
      skipped: false,
      candidate_count: generated.length,
      ex_ante: exAnte,
      ex_post: exPost,
      eligible_for_promotion: gate.eligible,
      promotion_block_reasons: gate.reasons,
    });
  }

  return {
    active_candidates: activeCandidates,
    shadow_candidates: shadowCandidates,
    metrics,
  };
}
