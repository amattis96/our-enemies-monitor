import { z } from "zod";
import { type GenealogySource, independentRoots } from "../pipeline/genealogy.ts";
import { UtcTimestamp } from "../temporal/snapshots.ts";

export const DORMANT_STATUSES = [
  "dormant",
  "reactivated",
  "refuted",
  "closed_insufficient",
] as const;
export type DormantStatus = (typeof DORMANT_STATUSES)[number];

export const DORMANT_CLOSURE_REASONS = ["refuted", "closed_insufficient"] as const;
export type DormantClosureReason = (typeof DORMANT_CLOSURE_REASONS)[number];

export const REACTIVATION_TRIGGER_KINDS = [
  "scheduled_cold_case_check",
  "evidentiary_reopening",
] as const;
export type ReactivationTriggerKind = (typeof REACTIVATION_TRIGGER_KINDS)[number];

export const REACTIVATION_SIGNAL_TYPES = [
  "news_reprise",
  "irrelevant_source",
  "periodic_check",
  "independent_discriminating_evidence",
  "source_retraction",
  "documented_refutation",
  "same_institution_document",
] as const;
export type ReactivationSignalType = (typeof REACTIVATION_SIGNAL_TYPES)[number];

export const ReactivationPeriodSchema = z
  .strictObject({
    from: z.string().min(1).describe("Start date or period boundary of the hypothesis."),
    to: z.string().min(1).describe("End date or period boundary of the hypothesis."),
  })
  .describe("Temporal window of the dormant hypothesis.");
export type ReactivationPeriod = z.infer<typeof ReactivationPeriodSchema>;

export const ReactivationFingerprintSchema = z
  .strictObject({
    entities: z.array(z.string().min(1)).describe("Private entity IDs or names in the hypothesis."),
    places: z.array(z.string().min(1)).describe("Place IDs or names in the hypothesis."),
    themes: z.array(z.string().min(1)).describe("Theme IDs or tags in the hypothesis."),
    period: ReactivationPeriodSchema.describe("Time period covered by the hypothesis."),
    techniques: z
      .array(z.string().min(1))
      .optional()
      .describe("Optional TTP or operational technique tags when available (PK-25)."),
  })
  .describe("Private reactivation fingerprint kept out of public projections.");
export type ReactivationFingerprint = z.infer<typeof ReactivationFingerprintSchema>;

export const ReactivationHistoryEntrySchema = z
  .strictObject({
    seq: z.number().int().nonnegative().describe("Monotonic sequence number of the entry."),
    evaluated_at: UtcTimestamp.describe("UTC timestamp when the signal was evaluated."),
    signal_id: z.string().min(1).describe("Identifier of the evaluated signal."),
    source_id: z.string().min(1).describe("Source identifier associated with the signal."),
    signal_type: z
      .enum(REACTIVATION_SIGNAL_TYPES)
      .describe("Classification of the incoming signal."),
    trigger_kind: z
      .enum(REACTIVATION_TRIGGER_KINDS)
      .describe("Distinguishes scheduled cold-case checks from evidentiary reopenings."),
    reactivated: z.boolean().describe("True when the evaluation triggered reactivation."),
    reason: z.string().min(1).describe("Deterministic evaluation rationale."),
    independent_roots: z
      .array(z.string().min(1))
      .default([])
      .describe("Resolved independent genealogy roots for the candidate source."),
  })
  .describe("Audit record of a dormant hypothesis reactivation evaluation.");
export type ReactivationHistoryEntry = z.infer<typeof ReactivationHistoryEntrySchema>;

export const DormantHypothesisSchema = z
  .strictObject({
    hypothesis_id: z.string().min(1).describe("Unique identifier of the dormant hypothesis."),
    status: z.enum(DORMANT_STATUSES).describe("Current lifecycle state of the hypothesis."),
    closure_reason: z
      .enum(DORMANT_CLOSURE_REASONS)
      .nullable()
      .optional()
      .describe("Motivated closure reason when closed."),
    closure_rationale: z
      .string()
      .min(1)
      .nullable()
      .optional()
      .describe("Explicit rationale required for any motivated closure."),
    fingerprint: ReactivationFingerprintSchema.describe(
      "Private fingerprint used to match candidate signals.",
    ),
    known_source_ids: z
      .array(z.string().min(1))
      .default([])
      .describe("Source IDs already evaluated for this hypothesis."),
    known_root_ids: z
      .array(z.string().min(1))
      .default([])
      .describe("Independent genealogy root IDs already known for this hypothesis."),
    last_checked_at: UtcTimestamp.nullable()
      .optional()
      .describe("UTC timestamp of the last reactivation check."),
    min_recheck_interval_hours: z
      .number()
      .nonnegative()
      .default(168)
      .describe("Minimum interval in hours between redundant non-exceptional checks."),
    novelty_threshold: z
      .number()
      .min(0)
      .max(1)
      .default(0.5)
      .describe("Minimum fingerprint match threshold for candidate relevance."),
    reactivation_history: z
      .array(ReactivationHistoryEntrySchema)
      .default([])
      .describe("Append-only history of reactivation evaluations and reopenings."),
  })
  .describe("Dormant hypothesis state with private fingerprint and reactivation history.");
export type DormantHypothesis = z.infer<typeof DormantHypothesisSchema>;

export const ReactivationSignalSchema = z
  .strictObject({
    signal_id: z.string().min(1).describe("Unique identifier of the incoming signal."),
    trigger_kind: z
      .enum(REACTIVATION_TRIGGER_KINDS)
      .describe("Whether this is a scheduled cold-case check or an evidentiary reopening."),
    signal_type: z.enum(REACTIVATION_SIGNAL_TYPES).describe("Semantic category of the signal."),
    source_id: z.string().min(1).describe("Candidate source ID triggering evaluation."),
    institution_id: z
      .string()
      .min(1)
      .optional()
      .describe("Originating institution identifier for same-institution assessment."),
    is_discriminating: z
      .boolean()
      .optional()
      .describe("Whether the evidence discriminates between competing explanations."),
    substantive_retraction: z
      .boolean()
      .optional()
      .describe("Whether a source retraction materially alters the evidentiary basis."),
    documented_refutation: z
      .boolean()
      .optional()
      .describe("Whether a refutation is backed by documented evidence."),
    same_institution_new_facts: z
      .boolean()
      .optional()
      .describe("Case-by-case flag indicating a same-institution document introduces new facts."),
    materially_new_event: z
      .boolean()
      .optional()
      .describe("Exception flag for genuinely new events bypassing cooldown intervals."),
    fingerprint_match_score: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe("Optional fingerprint overlap score between 0 and 1."),
    observed_at: UtcTimestamp.describe("UTC timestamp when the signal was observed."),
    summary: z.string().min(1).describe("Short summary of the candidate signal."),
  })
  .describe("Candidate signal evaluated against a dormant hypothesis for material novelty.");
export type ReactivationSignal = z.infer<typeof ReactivationSignalSchema>;

export type ReactivationEvaluationResult = {
  reactivate: boolean;
  trigger_kind: ReactivationTriggerKind;
  reason: string;
  independent_roots: string[];
  hypothesis: DormantHypothesis;
};

function hoursBetween(earlierIso: string, laterIso: string): number {
  const earlierMs = Date.parse(earlierIso);
  const laterMs = Date.parse(laterIso);
  if (Number.isNaN(earlierMs) || Number.isNaN(laterMs)) {
    throw new Error(`Invalid UTC timestamp comparison: ${earlierIso} vs ${laterIso}`);
  }
  return (laterMs - earlierMs) / 3_600_000;
}

function recordHistory(
  hypothesis: DormantHypothesis,
  signal: ReactivationSignal,
  params: {
    reactivate: boolean;
    triggerKind: ReactivationTriggerKind;
    reason: string;
    roots: string[];
  },
): DormantHypothesis {
  const nextStatus: DormantStatus = params.reactivate ? "reactivated" : hypothesis.status;
  const nextKnownSources = params.reactivate
    ? [...new Set([...hypothesis.known_source_ids, signal.source_id])]
    : hypothesis.known_source_ids;
  const nextKnownRoots = params.reactivate
    ? [...new Set([...hypothesis.known_root_ids, ...params.roots])]
    : hypothesis.known_root_ids;

  return DormantHypothesisSchema.parse({
    ...hypothesis,
    status: nextStatus,
    known_source_ids: nextKnownSources,
    known_root_ids: nextKnownRoots,
    last_checked_at: signal.observed_at,
    reactivation_history: [
      ...hypothesis.reactivation_history,
      {
        seq: hypothesis.reactivation_history.length,
        evaluated_at: signal.observed_at,
        signal_id: signal.signal_id,
        source_id: signal.source_id,
        signal_type: signal.signal_type,
        trigger_kind: params.triggerKind,
        reactivated: params.reactivate,
        reason: params.reason,
        independent_roots: params.roots,
      },
    ],
  });
}

/**
 * Evaluate whether an incoming signal constitutes material novelty sufficient
 * to reactivate a dormant hypothesis (PK-10).
 *
 * Non-mechanical rules:
 * - News reprises, irrelevant sources, and periodic checks without novelty never reactivate.
 * - Independent discriminating evidence, substantive retractions, and documented refutations reactivate.
 * - Same-institution new documents are evaluated case-by-case using genealogy and new-facts criteria.
 */
export function evaluateReactivation(
  hypothesis: DormantHypothesis,
  signal: ReactivationSignal,
  options?: { sourcesGraph?: readonly GenealogySource[] },
): ReactivationEvaluationResult {
  const resolvedRoots = options?.sourcesGraph
    ? independentRoots([signal.source_id], options.sourcesGraph).roots
    : [signal.source_id];

  const reject = (
    reason: string,
    triggerKind = signal.trigger_kind,
  ): ReactivationEvaluationResult => ({
    reactivate: false,
    trigger_kind: triggerKind,
    reason,
    independent_roots: resolvedRoots,
    hypothesis: recordHistory(hypothesis, signal, {
      reactivate: false,
      triggerKind,
      reason,
      roots: resolvedRoots,
    }),
  });

  const accept = (
    reason: string,
    triggerKind: ReactivationTriggerKind = "evidentiary_reopening",
  ): ReactivationEvaluationResult => ({
    reactivate: true,
    trigger_kind: triggerKind,
    reason,
    independent_roots: resolvedRoots,
    hypothesis: recordHistory(hypothesis, signal, {
      reactivate: true,
      triggerKind,
      reason,
      roots: resolvedRoots,
    }),
  });

  if (signal.signal_type === "news_reprise") {
    return reject("news_reprise_not_material_novelty");
  }

  if (signal.signal_type === "irrelevant_source") {
    return reject("irrelevant_source");
  }

  if (signal.signal_type === "periodic_check") {
    return reject("periodic_check_without_novelty", "scheduled_cold_case_check");
  }

  if (
    signal.fingerprint_match_score !== undefined &&
    signal.fingerprint_match_score < hypothesis.novelty_threshold
  ) {
    return reject("below_fingerprint_novelty_threshold");
  }

  const isRetractionOrRefutation =
    signal.signal_type === "source_retraction" || signal.signal_type === "documented_refutation";

  if (
    hypothesis.last_checked_at &&
    !signal.materially_new_event &&
    !isRetractionOrRefutation &&
    hoursBetween(hypothesis.last_checked_at, signal.observed_at) <
      hypothesis.min_recheck_interval_hours
  ) {
    return reject("within_min_recheck_interval");
  }

  const knownRoots = new Set(hypothesis.known_root_ids);
  const hasIndependentRoot = resolvedRoots.some((root) => !knownRoots.has(root));

  if (!isRetractionOrRefutation && knownRoots.size > 0 && !hasIndependentRoot) {
    return reject("same_genealogy_root_not_novel");
  }

  if (signal.signal_type === "source_retraction") {
    if (signal.substantive_retraction === false) {
      return reject("non_substantive_retraction");
    }
    return accept("substantive_source_retraction", "evidentiary_reopening");
  }

  if (signal.signal_type === "documented_refutation") {
    if (signal.documented_refutation === false) {
      return reject("undocumented_refutation");
    }
    return accept("documented_refutation", "evidentiary_reopening");
  }

  if (signal.signal_type === "independent_discriminating_evidence") {
    if (signal.is_discriminating === false) {
      return reject("non_discriminating_evidence");
    }
    return accept("independent_discriminating_evidence", "evidentiary_reopening");
  }

  if (signal.signal_type === "same_institution_document") {
    if (signal.same_institution_new_facts === true && signal.is_discriminating !== false) {
      return accept("same_institution_new_discriminating_facts", "evidentiary_reopening");
    }
    return reject("same_institution_without_discriminating_novelty");
  }

  return reject("unrecognized_signal_type");
}

/**
 * Close a dormant hypothesis with a mandatory motivated closure reason
 * (`refuted` or `closed_insufficient`) and non-empty rationale.
 */
export function closeDormantHypothesis(
  hypothesis: DormantHypothesis,
  params: {
    reason: DormantClosureReason;
    rationale: string;
    closed_at: string;
  },
): DormantHypothesis {
  if (!params.rationale.trim()) {
    throw new Error("Motivated closure requires a non-empty rationale.");
  }
  return DormantHypothesisSchema.parse({
    ...hypothesis,
    status: params.reason,
    closure_reason: params.reason,
    closure_rationale: params.rationale.trim(),
    last_checked_at: params.closed_at,
  });
}
