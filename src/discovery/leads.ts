import { createHash } from "node:crypto";
import { z } from "zod";
import {
  type CanonicalPredicateId,
  classifyRelationship,
  isEligibleForAutomaticInference,
} from "../claims/canonical-predicates.ts";
import { activePairKeys, type InferenceRegistry, pairKey } from "../editorial/inferences.ts";
import {
  comparePartialDates,
  type Dataset,
  PartialDate,
  type Relationship,
} from "../model/index.ts";
import { canonicalizeValue } from "../temporal/hash.ts";
import {
  buildInterruptingCaveatSet,
  buildNodeKindMap,
  buildNodeMap,
  DEFAULT_PATH_GRAMMAR_PATH,
  isTemporallyCompatible,
  loadPathGrammar,
  type PathGrammar,
  type PathGrammarRule,
} from "./generators/open-triads.ts";
import { type GraphAlgorithmPurpose, shouldExcludeGenericNode } from "./generators/weak-bridges.ts";

export const LEAD_STEP_TYPES = [
  "documented",
  "temporal",
  "technique_analogy",
  "hypothesized_consequence",
] as const;
export type LeadStepType = (typeof LEAD_STEP_TYPES)[number];

export const COMPETING_EXPLANATION_KINDS = [
  "intentional_coordination",
  "independent_convergence",
  "common_cause",
  "ordinary_dynamics",
  "information_error",
] as const;
export type CompetingExplanationKind = (typeof COMPETING_EXPLANATION_KINDS)[number];

/**
 * `undeterminable` is strictly an evaluation outcome, never a competing explanation.
 */
export const LEAD_EVALUATION_OUTCOMES = [
  "supported",
  "weakened",
  "refuted",
  "undeterminable",
] as const;
export type LeadEvaluationOutcome = (typeof LEAD_EVALUATION_OUTCOMES)[number];

export const LIKELIHOOD_DATA_BASES = ["empirical_data", "motivated_estimate"] as const;
export type LikelihoodDataBasis = (typeof LIKELIHOOD_DATA_BASES)[number];

export const LikelihoodAssessmentSchema = z
  .strictObject({
    likelihood_ratio: z
      .number()
      .positive()
      .nullable()
      .describe("Likelihood ratio, or null when no empirical data or motivated estimate exists."),
    data_basis: z
      .enum(LIKELIHOOD_DATA_BASES)
      .nullable()
      .describe("Basis for likelihood ratio; required whenever likelihood_ratio is non-null."),
    evidence_refs: z
      .array(z.string().min(1))
      .describe("Cited evidence backing the likelihood ratio; required when non-null."),
    rationale: z
      .string()
      .min(1)
      .describe("Explicit justification for the likelihood assessment or why it is null."),
  })
  .superRefine((val, ctx) => {
    if (val.likelihood_ratio !== null) {
      if (val.data_basis === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Likelihood ratio requires an explicit data_basis (never invented numbers).",
          path: ["data_basis"],
        });
      }
      if (val.evidence_refs.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Likelihood ratio requires at least one evidence_ref.",
          path: ["evidence_refs"],
        });
      }
    }
  })
  .describe("Evidence-backed likelihood ratio assessment (never an unmotivated numeric guess).");
export type LikelihoodAssessment = z.infer<typeof LikelihoodAssessmentSchema>;

export const CompetingExplanationSchema = z
  .strictObject({
    kind: z
      .enum(COMPETING_EXPLANATION_KINDS)
      .describe("One of the 5 standard competing explanations (never undeterminable)."),
    summary: z
      .string()
      .min(1)
      .describe("Factual summary of how this explanation accounts for the lead."),
    likelihood: LikelihoodAssessmentSchema.describe(
      "Likelihood ratio assessment for this explanation.",
    ),
  })
  .describe("Standard competing explanation evaluated against a lead.");
export type CompetingExplanation = z.infer<typeof CompetingExplanationSchema>;

export const CompositeHypothesisSchema = z
  .strictObject({
    id: z.string().min(1).describe("Identifier of the composite hypothesis."),
    component_explanations: z
      .array(z.enum(COMPETING_EXPLANATION_KINDS))
      .min(2)
      .describe("Two or more standard explanations combined into a composite hypothesis."),
    summary: z
      .string()
      .min(1)
      .describe("How the combined mechanisms jointly explain observations."),
    likelihood: LikelihoodAssessmentSchema.describe(
      "Likelihood assessment for the composite hypothesis.",
    ),
  })
  .describe("Composite hypothesis combining multiple standard competing explanations.");
export type CompositeHypothesis = z.infer<typeof CompositeHypothesisSchema>;

export const LeadStepSchema = z
  .strictObject({
    step_type: z.enum(LEAD_STEP_TYPES).describe("Epistemic nature of this step."),
    from_node: z.string().min(1).describe("Source entity or event ID."),
    to_node: z.string().min(1).describe("Target entity or event ID."),
    relationship_id: z
      .string()
      .min(1)
      .optional()
      .describe("Optional underlying relationship ID when step is documented."),
    predicate: z.string().min(1).optional().describe("Canonical predicate if mapped."),
    lag_days: z
      .number()
      .int()
      .nonnegative()
      .nullable()
      .describe("Observed or estimated non-negative temporal lag in days, or null if unknown."),
    valid_from: PartialDate.nullable().describe("Start date of the step."),
    valid_to: PartialDate.nullable().describe("End date of the step."),
    confidence_note: z.string().min(1).describe("Factual caveat or epistemic note on this step."),
  })
  .describe("Typed step in a temporal lead path.");
export type LeadStep = z.infer<typeof LeadStepSchema>;

export const LeadEvidenceItemSchema = z
  .strictObject({
    ref_id: z.string().min(1).describe("Source, event, or relationship ID."),
    summary: z.string().min(1).describe("What the evidence establishes or contradicts."),
    recorded_at: z.string().min(1).describe("ISO-8601 UTC timestamp."),
  })
  .describe("Supporting or contrary evidence entry on a lead.");
export type LeadEvidenceItem = z.infer<typeof LeadEvidenceItemSchema>;

export const LeadRecordSchema = z
  .strictObject({
    lead_id: z.string().min(1).describe("Stable lead identifier."),
    title: z.string().min(1).describe("Short factual title of the investigative lead."),
    hypothesis_ids: z
      .array(z.string().min(1))
      .min(1)
      .describe("Many-to-many links to hypothesis or discovery queue IDs."),
    steps: z.array(LeadStepSchema).min(1).describe("Ordered sequence of typed lead steps."),
    falsifiers: z
      .array(z.string().min(1))
      .min(1)
      .describe("Explicit conditions that would falsify this lead."),
    supporting_evidence: z
      .array(LeadEvidenceItemSchema)
      .describe("Evidence items supporting the lead."),
    contrary_evidence: z
      .array(LeadEvidenceItemSchema)
      .describe("Evidence items contradicting or weakening the lead."),
    non_evaluability_conditions: z
      .array(z.string().min(1))
      .describe("Explicit conditions under which the lead cannot currently be evaluated."),
    reactivation_fingerprint: z
      .string()
      .regex(/^[0-9a-f]{64}$/)
      .describe("Deterministic SHA-256 fingerprint for reactivating dormant/closed leads."),
    competing_explanations: z
      .array(CompetingExplanationSchema)
      .min(1)
      .describe("Evaluated competing explanations (never undeterminable)."),
    composite_hypotheses: z
      .array(CompositeHypothesisSchema)
      .default([])
      .describe("Optional composite hypotheses combining multiple standard explanations."),
    evaluation_outcome: z
      .enum(LEAD_EVALUATION_OUTCOMES)
      .describe("Overall evaluation outcome (undeterminable belongs here, never in explanations)."),
    created_at: z.string().min(1).describe("ISO-8601 UTC creation timestamp."),
    updated_at: z.string().min(1).describe("ISO-8601 UTC last update timestamp."),
  })
  .describe("PK-27 investigative lead record stored in data/leads/.");
export type LeadRecord = z.infer<typeof LeadRecordSchema>;

export function computeReactivationFingerprint(input: {
  hypothesis_ids: readonly string[];
  steps: readonly Pick<LeadStep, "step_type" | "from_node" | "to_node" | "predicate">[];
  non_evaluability_conditions: readonly string[];
}): string {
  const normalized = canonicalizeValue({
    hypothesis_ids: [...new Set(input.hypothesis_ids)].sort(),
    steps: input.steps.map((s) => ({
      step_type: s.step_type,
      from_node: s.from_node,
      to_node: s.to_node,
      predicate: s.predicate ?? null,
    })),
    non_evaluability_conditions: [...new Set(input.non_evaluability_conditions)].sort(),
  });
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

export function shouldReactivateLead(
  lead: LeadRecord,
  newEvidenceRefs: readonly string[],
): { reactivate: boolean; matching_refs: string[]; reason: string } {
  const parsed = LeadRecordSchema.parse(lead);
  const existingRefs = new Set([
    ...parsed.supporting_evidence.map((e) => e.ref_id),
    ...parsed.contrary_evidence.map((e) => e.ref_id),
    ...parsed.steps.flatMap((s) => (s.relationship_id ? [s.relationship_id] : [])),
  ]);
  const novelRefs = newEvidenceRefs.filter((r) => !existingRefs.has(r));
  if (
    novelRefs.length > 0 &&
    (parsed.evaluation_outcome === "undeterminable" ||
      parsed.non_evaluability_conditions.length > 0)
  ) {
    return {
      reactivate: true,
      matching_refs: novelRefs,
      reason: `New unassessed evidence (${novelRefs.join(", ")}) may resolve non-evaluability conditions.`,
    };
  }
  return {
    reactivate: false,
    matching_refs: [],
    reason: "No novel evidence requiring reactivation.",
  };
}

export type TemporalPathResult = {
  nodes: string[];
  steps: LeadStep[];
  score: number;
  generic_node_penalties: number;
  total_lag_days: number | null;
};

function partialDateToApproxDays(d: string | null): number | null {
  if (!d) return null;
  const parts = d.split("-").map(Number);
  const year = parts[0];
  if (year === undefined || Number.isNaN(year)) return null;
  const month = parts[1] ?? 1;
  const day = parts[2] ?? 1;
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

function computeLagDays(prev: Relationship, next: Relationship): number | null {
  const prevEnd = prev.valid_to ?? prev.valid_from;
  const nextStart = next.valid_from ?? next.valid_to;
  const prevDays = partialDateToApproxDays(prevEnd);
  const nextDays = partialDateToApproxDays(nextStart);
  if (prevDays === null || nextDays === null) return null;
  return Math.max(0, Math.round(nextDays - prevDays));
}

function isPairForbiddenByGrammar(
  grammar: PathGrammar,
  firstPred: CanonicalPredicateId,
  secondPred: CanonicalPredicateId,
): boolean {
  return grammar.rules.some(
    (rule: PathGrammarRule) =>
      rule.status === "forbidden" &&
      rule.first_predicate === firstPred &&
      rule.second_predicate === secondPred,
  );
}

function isTemporallyOrderCompatible(prev: Relationship, next: Relationship): boolean {
  const prevAnchor = prev.valid_from ?? prev.valid_to;
  const nextAnchor = next.valid_to ?? next.valid_from;
  if (prevAnchor && nextAnchor && comparePartialDates(prevAnchor, nextAnchor) > 0) {
    return false;
  }
  return isTemporallyCompatible("sequential_or_overlap", prev, next);
}

/**
 * Time-respecting path search enforcing:
 * - max_length limit
 * - PK-11 path grammar (zero forbidden predicate pairs, zero unmapped/needs_review, zero B15 forbidden pairs)
 * - temporal compatibility along consecutive hops
 * - PK-11 generic-node penalty for high-degree hub intermediate nodes
 */
export function findTemporalPaths(input: {
  dataset: Dataset;
  source_id: string;
  target_id: string;
  max_length?: number;
  inferenceRegistry?: InferenceRegistry;
  grammar?: PathGrammar;
  purpose?: GraphAlgorithmPurpose;
  hubThreshold?: number;
  genericNodePenalty?: number;
}): TemporalPathResult[] {
  const maxLength = input.max_length ?? 4;
  const purpose = input.purpose ?? "weak_bridge";
  const hubThreshold = input.hubThreshold ?? 4;
  const genericPenaltyWeight = input.genericNodePenalty ?? 0.35;
  const grammar = input.grammar ?? loadPathGrammar(DEFAULT_PATH_GRAMMAR_PATH);
  const interrupting = input.inferenceRegistry
    ? buildInterruptingCaveatSet(input.inferenceRegistry)
    : new Set<string>();
  const forbiddenPairs = input.inferenceRegistry
    ? activePairKeys(input.inferenceRegistry)
    : new Set<string>();

  const nodeMap = buildNodeMap(input.dataset);
  buildNodeKindMap(input.dataset);

  type EligibleEdge = {
    rel: Relationship;
    predicate: CanonicalPredicateId;
    from: string;
    to: string;
  };

  const adj = new Map<string, EligibleEdge[]>();
  const degrees = new Map<string, number>();

  for (const r of input.dataset.relationships) {
    if (interrupting.has(r.id)) continue;
    if (forbiddenPairs.has(pairKey(r.subject, r.object))) continue;
    const mapped = classifyRelationship(r);
    if (!isEligibleForAutomaticInference(mapped.mapping)) continue;
    const pred = mapped.mapping.canonical_predicate;
    if (pred === null) continue;

    const addEdge = (from: string, to: string) => {
      const list = adj.get(from) ?? [];
      list.push({ rel: r, predicate: pred, from, to });
      adj.set(from, list);
    };

    addEdge(r.subject, r.object);
    if (mapped.mapping.direction === "bidirectional") {
      addEdge(r.object, r.subject);
    }

    degrees.set(r.subject, (degrees.get(r.subject) ?? 0) + 1);
    degrees.set(r.object, (degrees.get(r.object) ?? 0) + 1);
  }

  const results: TemporalPathResult[] = [];

  function dfs(
    current: string,
    visited: Set<string>,
    edges: EligibleEdge[],
    penalties: number,
  ): void {
    if (current === input.target_id && edges.length > 0) {
      let totalLag: number | null = 0;
      const steps: LeadStep[] = edges.map((e, idx) => {
        const prev = idx > 0 ? edges[idx - 1] : undefined;
        const lag = prev ? computeLagDays(prev.rel, e.rel) : 0;
        if (lag === null) {
          totalLag = null;
        } else if (totalLag !== null) {
          totalLag += lag;
        }
        return {
          step_type: "documented",
          from_node: e.from,
          to_node: e.to,
          relationship_id: e.rel.id,
          predicate: e.predicate,
          lag_days: lag,
          valid_from: e.rel.valid_from,
          valid_to: e.rel.valid_to,
          confidence_note: `Documented ${e.predicate} (${e.rel.evidence_level}).`,
        };
      });

      const baseScore = 1 / edges.length;
      const score = Number(Math.max(0, baseScore - penalties * genericPenaltyWeight).toFixed(4));
      results.push({
        nodes: [input.source_id, ...edges.map((e) => e.to)],
        steps,
        score,
        generic_node_penalties: penalties,
        total_lag_days: totalLag,
      });
      return;
    }

    if (edges.length >= maxLength) return;

    const outgoing = adj.get(current) ?? [];
    for (const edge of outgoing) {
      if (visited.has(edge.to)) continue;

      const prevEdge = edges[edges.length - 1];
      if (prevEdge) {
        if (isPairForbiddenByGrammar(grammar, prevEdge.predicate, edge.predicate)) {
          continue;
        }
        if (!isTemporallyOrderCompatible(prevEdge.rel, edge.rel)) {
          continue;
        }
      }

      let nextPenalties = penalties;
      if (edge.to !== input.target_id) {
        const isGeneric = shouldExcludeGenericNode({
          node: nodeMap.get(edge.to),
          predicate: edge.predicate,
          purpose,
          degree: degrees.get(edge.to) ?? 0,
          hubThreshold,
        });
        if (isGeneric) {
          nextPenalties += 1;
        }
      }

      visited.add(edge.to);
      edges.push(edge);
      dfs(edge.to, visited, edges, nextPenalties);
      edges.pop();
      visited.delete(edge.to);
    }
  }

  const visited = new Set<string>([input.source_id]);
  dfs(input.source_id, visited, [], 0);

  return results.sort((a, b) => b.score - a.score || a.steps.length - b.steps.length);
}
