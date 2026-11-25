import { z } from "zod";

/**
 * PK-02 Evaluation Metrics, Inter-Model Cohen's Kappa, and Zero-Tolerance D6 Gates.
 */

export const ConfusionMatrixSchema = z.strictObject({
  tp: z.number().int().nonnegative().describe("True positives count."),
  fp: z.number().int().nonnegative().describe("False positives count."),
  tn: z.number().int().nonnegative().describe("True negatives count."),
  fn: z.number().int().nonnegative().describe("False negatives count."),
});

export const CaseOutcomeSchema = z.strictObject({
  case_id: z.string().min(1).describe("Evaluated case identifier."),
  abstained: z
    .boolean()
    .describe("True when the system explicitly abstained or declined to answer."),
  unsupported_attributions: z
    .number()
    .int()
    .nonnegative()
    .describe("Count of attributions without valid supporting canonical refs."),
  caveat_required: z.boolean().describe("Whether the case required preserving a critical caveat."),
  caveat_preserved: z
    .boolean()
    .describe("Whether the required caveat was preserved in the output."),
  identity_errors: z
    .number()
    .int()
    .nonnegative()
    .describe("Count of entity or record identity confusions in the output."),
});

export const QualityMetricsSummarySchema = z.strictObject({
  confusion_matrix: ConfusionMatrixSchema.describe("Aggregate binary confusion matrix."),
  precision: z.number().min(0).max(1).describe("Precision = tp / (tp + fp), 0 if denom is 0."),
  recall: z.number().min(0).max(1).describe("Recall = tp / (tp + fn), 0 if denom is 0."),
  f1: z.number().min(0).max(1).describe("Harmonic mean of precision and recall."),
  abstention_rate: z.number().min(0).max(1).describe("Fraction of cases with abstention."),
  unsupported_attributions_count: z
    .number()
    .int()
    .nonnegative()
    .describe("Total unsupported attributions across evaluated cases."),
  unsupported_attributions_rate: z
    .number()
    .min(0)
    .describe("Mean unsupported attributions per evaluated case."),
  caveat_preservation_rate: z
    .number()
    .min(0)
    .max(1)
    .describe("Fraction of caveat-required cases where caveat was preserved (1 if none required)."),
  identity_errors_count: z
    .number()
    .int()
    .nonnegative()
    .describe("Total entity/record identity errors across evaluated cases."),
  identity_error_rate: z.number().min(0).describe("Mean identity errors per evaluated case."),
});

export const D6_GATE_IDS = [
  "withheld_leaks",
  "invalid_canonical_refs",
  "forbidden_inferences_in_regression",
  "human_review_status_by_agent",
  "lost_critical_caveats",
  "unauthorized_contract_regressions",
  "severe_a11y_errors",
] as const;

export const D6GateIdSchema = z
  .enum(D6_GATE_IDS)
  .describe("Zero-tolerance D6 blocking gate identifier.");

export const D6GateInputSchema = z.strictObject({
  withheld_leaks: z
    .number()
    .int()
    .nonnegative()
    .describe("Count of withheld/pending record leaks into public output."),
  invalid_canonical_refs: z
    .number()
    .int()
    .nonnegative()
    .describe("Count of invented or invalid canonical record IDs."),
  forbidden_inferences_in_regression: z
    .number()
    .int()
    .nonnegative()
    .describe("Count of forbidden inference hits in the regression benchmark."),
  human_review_status_by_agent: z
    .number()
    .int()
    .nonnegative()
    .describe("Count of human review statuses set by an automated agent."),
  lost_critical_caveats: z
    .number()
    .int()
    .nonnegative()
    .describe("Count of critical caveats omitted where required."),
  unauthorized_contract_regressions: z
    .number()
    .int()
    .nonnegative()
    .describe("Count of unauthorized schema or public export contract regressions."),
  severe_a11y_errors: z
    .number()
    .int()
    .nonnegative()
    .describe("Count of severe accessibility errors detected in static or browser audit."),
});

export const D6GateStatusSchema = z.strictObject({
  count: z.number().int().nonnegative().describe("Observed violation count for this gate."),
  max_allowed: z.literal(0).describe("Zero-tolerance maximum allowed violations (always 0)."),
  passed: z.boolean().describe("True iff count === 0."),
});

export const D6GateResultSchema = z.strictObject({
  passed: z.boolean().describe("True iff all seven D6 zero-tolerance gates have count === 0."),
  blockers: z.array(D6GateIdSchema).describe("List of D6 gates that failed (count > 0)."),
  checked_at: z.string().min(1).describe("ISO timestamp when D6 gates were evaluated."),
  gates: z
    .strictObject({
      withheld_leaks: D6GateStatusSchema.describe("Withheld leaks gate status."),
      invalid_canonical_refs: D6GateStatusSchema.describe("Invalid canonical refs gate status."),
      forbidden_inferences_in_regression: D6GateStatusSchema.describe(
        "Forbidden inferences in regression gate status.",
      ),
      human_review_status_by_agent: D6GateStatusSchema.describe(
        "Human review status set by agent gate status.",
      ),
      lost_critical_caveats: D6GateStatusSchema.describe("Lost critical caveats gate status."),
      unauthorized_contract_regressions: D6GateStatusSchema.describe(
        "Unauthorized contract regressions gate status.",
      ),
      severe_a11y_errors: D6GateStatusSchema.describe("Severe accessibility errors gate status."),
    })
    .describe("Per-gate zero-tolerance evaluation results."),
});

export const InterModelAgreementInputSchema = z.strictObject({
  model_a: z.string().min(1).describe("Identifier of the first evaluated model."),
  model_b: z.string().min(1).describe("Identifier of the second evaluated model."),
  ratings_a: z.array(z.string().min(1)).min(1).describe("Categorical labels produced by model_a."),
  ratings_b: z
    .array(z.string().min(1))
    .min(1)
    .describe("Categorical labels produced by model_b on the same items."),
});

export type ConfusionMatrix = z.infer<typeof ConfusionMatrixSchema>;
export type CaseOutcome = z.infer<typeof CaseOutcomeSchema>;
export type QualityMetricsSummary = z.infer<typeof QualityMetricsSummarySchema>;
export type D6GateId = z.infer<typeof D6GateIdSchema>;
export type D6GateInput = z.infer<typeof D6GateInputSchema>;
export type D6GateResult = z.infer<typeof D6GateResultSchema>;
export type InterModelAgreementInput = z.infer<typeof InterModelAgreementInputSchema>;

const round4 = (n: number) => Math.round(n * 10000) / 10000;

export function computePrecision(cm: ConfusionMatrix): number {
  const parsed = ConfusionMatrixSchema.parse(cm);
  const denom = parsed.tp + parsed.fp;
  return denom === 0 ? 0 : round4(parsed.tp / denom);
}

export function computeRecall(cm: ConfusionMatrix): number {
  const parsed = ConfusionMatrixSchema.parse(cm);
  const denom = parsed.tp + parsed.fn;
  return denom === 0 ? 0 : round4(parsed.tp / denom);
}

export function computeF1(precision: number, recall: number): number {
  if (precision + recall === 0) return 0;
  return round4((2 * precision * recall) / (precision + recall));
}

export function computeAbstentionRate(outcomes: readonly Pick<CaseOutcome, "abstained">[]): number {
  if (outcomes.length === 0) return 0;
  const abstained = outcomes.filter((o) => o.abstained).length;
  return round4(abstained / outcomes.length);
}

export function summarizeQualityMetrics(
  cm: ConfusionMatrix,
  outcomes: readonly CaseOutcome[],
): QualityMetricsSummary {
  const parsedCm = ConfusionMatrixSchema.parse(cm);
  const parsedOutcomes = outcomes.map((o) => CaseOutcomeSchema.parse(o));

  const precision = computePrecision(parsedCm);
  const recall = computeRecall(parsedCm);
  const f1 = computeF1(precision, recall);
  const abstentionRate = computeAbstentionRate(parsedOutcomes);

  const total = parsedOutcomes.length;
  const unsupportedCount = parsedOutcomes.reduce((s, o) => s + o.unsupported_attributions, 0);
  const identityErrorsCount = parsedOutcomes.reduce((s, o) => s + o.identity_errors, 0);

  const caveatRequired = parsedOutcomes.filter((o) => o.caveat_required);
  const caveatPreserved = caveatRequired.filter((o) => o.caveat_preserved).length;
  const caveatPreservationRate =
    caveatRequired.length === 0 ? 1 : round4(caveatPreserved / caveatRequired.length);

  return QualityMetricsSummarySchema.parse({
    confusion_matrix: parsedCm,
    precision,
    recall,
    f1,
    abstention_rate: abstentionRate,
    unsupported_attributions_count: unsupportedCount,
    unsupported_attributions_rate: total === 0 ? 0 : round4(unsupportedCount / total),
    caveat_preservation_rate: caveatPreservationRate,
    identity_errors_count: identityErrorsCount,
    identity_error_rate: total === 0 ? 0 : round4(identityErrorsCount / total),
  });
}

const NON_MODEL_LABELS = new Set([
  "ground_truth",
  "ground-truth",
  "gold",
  "gold_standard",
  "reference",
  "expected",
  "human_gold",
]);

/**
 * Computes Cohen's kappa strictly for inter-model agreement.
 * Rejects ground-truth/reference comparisons or identical model identifiers.
 */
export function computeCohensKappa(input: InterModelAgreementInput): {
  model_a: string;
  model_b: string;
  n: number;
  observed_agreement: number;
  expected_agreement: number;
  kappa: number;
} {
  const parsed = InterModelAgreementInputSchema.parse(input);
  const aNorm = parsed.model_a.trim().toLowerCase();
  const bNorm = parsed.model_b.trim().toLowerCase();

  if (NON_MODEL_LABELS.has(aNorm) || NON_MODEL_LABELS.has(bNorm)) {
    throw new Error(
      "Cohen's kappa is strictly for inter-model agreement; ground-truth or reference labels are not allowed.",
    );
  }
  if (aNorm === bNorm) {
    throw new Error("Cohen's kappa requires two distinct model identifiers.");
  }
  if (parsed.ratings_a.length !== parsed.ratings_b.length) {
    throw new Error(
      `Rating length mismatch: ${parsed.ratings_a.length} vs ${parsed.ratings_b.length}`,
    );
  }

  const n = parsed.ratings_a.length;
  const countsA = new Map<string, number>();
  const countsB = new Map<string, number>();
  let agree = 0;

  for (let i = 0; i < n; i++) {
    const la = parsed.ratings_a[i] ?? "";
    const lb = parsed.ratings_b[i] ?? "";
    if (la === lb) agree += 1;
    countsA.set(la, (countsA.get(la) ?? 0) + 1);
    countsB.set(lb, (countsB.get(lb) ?? 0) + 1);
  }

  const po = agree / n;
  const categories = new Set([...countsA.keys(), ...countsB.keys()]);
  let pe = 0;
  for (const cat of categories) {
    pe += ((countsA.get(cat) ?? 0) / n) * ((countsB.get(cat) ?? 0) / n);
  }

  const kappa = 1 - pe === 0 ? (po === 1 ? 1 : 0) : (po - pe) / (1 - pe);

  return {
    model_a: parsed.model_a,
    model_b: parsed.model_b,
    n,
    observed_agreement: round4(po),
    expected_agreement: round4(pe),
    kappa: round4(kappa),
  };
}

/**
 * Evaluates all seven zero-tolerance D6 blocking gates.
 */
export function evaluateD6Gates(
  input: D6GateInput,
  checkedAt: string = new Date().toISOString(),
): D6GateResult {
  const parsed = D6GateInputSchema.parse(input);
  const blockers: D6GateId[] = [];

  for (const id of D6_GATE_IDS) {
    if (parsed[id] > 0) blockers.push(id);
  }

  const statusFor = (count: number) => ({
    count,
    max_allowed: 0 as const,
    passed: count === 0,
  });

  return D6GateResultSchema.parse({
    passed: blockers.length === 0,
    blockers,
    checked_at: checkedAt,
    gates: {
      withheld_leaks: statusFor(parsed.withheld_leaks),
      invalid_canonical_refs: statusFor(parsed.invalid_canonical_refs),
      forbidden_inferences_in_regression: statusFor(parsed.forbidden_inferences_in_regression),
      human_review_status_by_agent: statusFor(parsed.human_review_status_by_agent),
      lost_critical_caveats: statusFor(parsed.lost_critical_caveats),
      unauthorized_contract_regressions: statusFor(parsed.unauthorized_contract_regressions),
      severe_a11y_errors: statusFor(parsed.severe_a11y_errors),
    },
  });
}
