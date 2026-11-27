import { z } from "zod";
import { UtcTimestamp } from "../temporal/snapshots.ts";

export const BenchmarkModelCandidateSchema = z
  .strictObject({
    provider: z.string().min(1).describe("Model provider identifier (e.g., anthropic, openai)."),
    model: z.string().min(1).describe("Model identifier."),
    benchmark_score: z
      .number()
      .min(0)
      .max(1)
      .describe("Normalized PK-23 benchmark score used to select the strongest eligible critic."),
    eligible_for_critic: z
      .boolean()
      .default(true)
      .describe("Whether the model is approved for independent critical review."),
  })
  .describe("Benchmark-ranked model candidate for independent critic selection.");
export type BenchmarkModelCandidate = z.infer<typeof BenchmarkModelCandidateSchema>;

export const SourcePackageItemSchema = z
  .strictObject({
    source_id: z.string().min(1).describe("Source or document identifier."),
    title: z.string().min(1).describe("Title or label of the source."),
    excerpt: z.string().min(1).describe("Relevant factual excerpt or evidence summary."),
    url: z.string().min(1).optional().describe("Optional canonical URL of the source."),
  })
  .describe("Primary or secondary source item presented to the critic before author conclusion.");
export type SourcePackageItem = z.infer<typeof SourcePackageItemSchema>;

export const AuthorConclusionSchema = z
  .strictObject({
    author_provider: z.string().min(1).describe("Provider that produced the author draft."),
    author_model: z.string().min(1).describe("Model that produced the author draft."),
    verdict: z
      .enum(["supported", "partially_supported", "unsupported", "needs_more_evidence"])
      .describe("Author's proposed evidentiary verdict."),
    summary: z.string().min(1).describe("Author's conclusion summary."),
    cited_source_ids: z.array(z.string().min(1)).min(1).describe("Source IDs cited by the author."),
  })
  .describe("Author's conclusion withheld during Phase 1 blind source evaluation.");
export type AuthorConclusion = z.infer<typeof AuthorConclusionSchema>;

export const BlindSourceEvaluationSchema = z
  .strictObject({
    critic_provider: z.string().min(1).describe("Independent critic provider."),
    critic_model: z.string().min(1).describe("Independent critic model (distinct from author)."),
    evaluated_at: UtcTimestamp.describe("UTC timestamp when blind evaluation was completed."),
    independent_verdict: z
      .enum(["supported", "partially_supported", "unsupported", "needs_more_evidence"])
      .describe("Critic's verdict formed strictly from sources before seeing author conclusion."),
    source_assessments: z
      .array(
        z.strictObject({
          source_id: z.string().min(1).describe("Evaluated source ID."),
          reliability: z
            .enum(["high", "medium", "low", "disputed"])
            .describe("Critic's assessment of source reliability."),
          supports_claim: z
            .boolean()
            .describe("Whether the source independently supports the target claim."),
          notes: z.string().min(1).describe("Brief evidentiary note."),
        }),
      )
      .min(1)
      .describe("Per-source independent assessments."),
    alternative_hypotheses: z
      .array(z.string().min(1))
      .min(1)
      .describe("Alternative explanations considered by the critic."),
    confidence: z
      .enum(["low", "medium", "high"])
      .describe("Critic confidence prior to seeing author conclusion."),
  })
  .describe("Phase 1 blind source evaluation completed before author conclusion is revealed.");
export type BlindSourceEvaluation = z.infer<typeof BlindSourceEvaluationSchema>;

export const MODEL_ATTESTATIONS = ["platform_reported", "self_declared", "unverifiable"] as const;
export const ModelAttestationSchema = z
  .enum(MODEL_ATTESTATIONS)
  .describe(
    "How the author and critic model identities are known: reported by the execution platform, only declared by the agent, or not verifiable.",
  );
export type ModelAttestation = z.infer<typeof ModelAttestationSchema>;

export const CriticComparisonReportSchema = z
  .strictObject({
    session_id: z.string().min(1).describe("Identifier of the critic review session."),
    target_id: z.string().min(1).describe("Article, case, or claim ID under review."),
    is_major_verification: z
      .boolean()
      .describe("True when anti-anchoring blind evaluation was mandatory."),
    author_model: z.string().min(1).describe("Model used by the author."),
    critic_model: z.string().min(1).describe("Model used by the independent critic."),
    blind_evaluation: BlindSourceEvaluationSchema.describe("Recorded Phase 1 blind evaluation."),
    author_conclusion: AuthorConclusionSchema.describe(
      "Author conclusion revealed only after Phase 1.",
    ),
    compared_at: UtcTimestamp.describe("UTC timestamp when comparison was finalized."),
    agrees_with_author: z
      .boolean()
      .describe("True when independent verdict matches author's verdict."),
    discrepancies: z
      .array(z.string().min(1))
      .describe("Specific factual, attribution, or causal discrepancies found."),
    anchoring_risk_detected: z
      .boolean()
      .describe("True when author conclusion appears stronger than blind source support."),
    final_recommendation: z
      .enum(["approve_ai_verified", "request_revision", "reject_insufficient_evidence"])
      .describe("Final critic recommendation."),
    model_attestation: ModelAttestationSchema,
    cross_model_verified: z
      .boolean()
      .describe(
        "True only when the platform reported both models and they differ; never inferred from declared names alone.",
      ),
    independence_limit: z
      .string()
      .min(1)
      .nullable()
      .describe("Stated limitation when cross-model independence is not verified, else null."),
  })
  .describe("Phase 2 anti-anchoring critic comparison report.");
export type CriticComparisonReport = z.infer<typeof CriticComparisonReportSchema>;

export type CriticSessionState = {
  readonly session_id: string;
  readonly target_id: string;
  readonly claim_question: string;
  readonly is_major_verification: boolean;
  readonly sources: readonly SourcePackageItem[];
  readonly author_conclusion: AuthorConclusion;
  readonly critic_selection: BenchmarkModelCandidate;
  readonly phase: "awaiting_blind_evaluation" | "blind_evaluated" | "finalized";
  readonly blind_evaluation: BlindSourceEvaluation | null;
  readonly report: CriticComparisonReport | null;
};

function nowUtc(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

/**
 * Select the highest-scoring benchmark-eligible critic model that differs
 * from the author's model (and preferably differs in provider when available).
 */
export function selectCriticModel(
  author: { provider: string; model: string },
  candidates: readonly BenchmarkModelCandidate[],
): BenchmarkModelCandidate {
  const eligible = candidates
    .map((c) => BenchmarkModelCandidateSchema.parse(c))
    .filter((c) => c.eligible_for_critic && c.model !== author.model);

  if (eligible.length === 0) {
    throw new Error(
      `No eligible critic model distinct from author model "${author.model}" is available.`,
    );
  }

  const sorted = [...eligible].sort((a, b) => {
    const aDiffProvider = a.provider !== author.provider ? 1 : 0;
    const bDiffProvider = b.provider !== author.provider ? 1 : 0;
    if (b.benchmark_score !== a.benchmark_score) {
      return b.benchmark_score - a.benchmark_score;
    }
    return bDiffProvider - aDiffProvider;
  });

  const chosen = sorted[0];
  if (!chosen) {
    throw new Error("Failed to select critic model.");
  }
  return chosen;
}

/**
 * Initialize a two-phase anti-anchoring critic session. In Phase 1, the author's
 * conclusion is withheld so the critic evaluates sources independently first.
 */
export function createCriticSession(input: {
  session_id: string;
  target_id: string;
  claim_question: string;
  is_major_verification: boolean;
  sources: readonly SourcePackageItem[];
  author_conclusion: AuthorConclusion;
  candidates: readonly BenchmarkModelCandidate[];
}): CriticSessionState {
  if (input.sources.length === 0) {
    throw new Error("Critic session requires at least one source item.");
  }
  const authorConclusion = AuthorConclusionSchema.parse(input.author_conclusion);
  const criticSelection = selectCriticModel(
    {
      provider: authorConclusion.author_provider,
      model: authorConclusion.author_model,
    },
    input.candidates,
  );
  return {
    session_id: input.session_id,
    target_id: input.target_id,
    claim_question: input.claim_question,
    is_major_verification: input.is_major_verification,
    sources: input.sources.map((s) => SourcePackageItemSchema.parse(s)),
    author_conclusion: authorConclusion,
    critic_selection: criticSelection,
    phase: "awaiting_blind_evaluation",
    blind_evaluation: null,
    report: null,
  };
}

/**
 * Return the Phase 1 blind prompt payload for the critic. Never includes the
 * author's conclusion or verdict.
 */
export function getBlindEvaluationPayload(session: CriticSessionState): {
  session_id: string;
  target_id: string;
  claim_question: string;
  critic_provider: string;
  critic_model: string;
  sources: readonly SourcePackageItem[];
  author_conclusion_redacted: true;
} {
  return {
    session_id: session.session_id,
    target_id: session.target_id,
    claim_question: session.claim_question,
    critic_provider: session.critic_selection.provider,
    critic_model: session.critic_selection.model,
    sources: session.sources,
    author_conclusion_redacted: true,
  };
}

/**
 * Record Phase 1 blind source evaluation before revealing the author's conclusion.
 */
export function submitBlindEvaluation(
  session: CriticSessionState,
  evaluation: Omit<BlindSourceEvaluation, "critic_provider" | "critic_model" | "evaluated_at"> & {
    evaluated_at?: string;
  },
): CriticSessionState {
  if (session.phase !== "awaiting_blind_evaluation") {
    throw new Error(
      `Blind evaluation already submitted for session "${session.session_id}" (phase: ${session.phase}).`,
    );
  }
  const parsed = BlindSourceEvaluationSchema.parse({
    ...evaluation,
    critic_provider: session.critic_selection.provider,
    critic_model: session.critic_selection.model,
    evaluated_at: evaluation.evaluated_at ?? nowUtc(),
  });
  return {
    ...session,
    phase: "blind_evaluated",
    blind_evaluation: parsed,
  };
}

/**
 * Reveal the author's conclusion ONLY after Phase 1 blind evaluation is recorded.
 */
export function revealAuthorConclusion(session: CriticSessionState): AuthorConclusion {
  if (session.is_major_verification && session.blind_evaluation === null) {
    throw new Error(
      `Anti-anchoring violation: cannot reveal author conclusion for major verification "${session.target_id}" before blind source evaluation is submitted.`,
    );
  }
  return session.author_conclusion;
}

/**
 * Finalize Phase 2 comparison between the blind critic evaluation and the
 * author's conclusion.
 */
export function finalizeCriticReview(
  session: CriticSessionState,
  input: {
    discrepancies?: readonly string[];
    compared_at?: string;
    final_recommendation?: CriticComparisonReport["final_recommendation"];
    /** Defaults to `unverifiable`: cross-model review is never assumed. */
    model_attestation?: ModelAttestation;
  } = {},
): CriticSessionState {
  if (session.blind_evaluation === null) {
    throw new Error(
      `Anti-anchoring violation: cannot finalize critic review "${session.session_id}" before blind source evaluation.`,
    );
  }
  const blind = session.blind_evaluation;
  const author = session.author_conclusion;
  const agrees = blind.independent_verdict === author.verdict;
  const anchoringRisk = author.verdict === "supported" && blind.independent_verdict !== "supported";
  const recommendation =
    input.final_recommendation ??
    (agrees && blind.independent_verdict === "supported"
      ? "approve_ai_verified"
      : blind.independent_verdict === "unsupported"
        ? "reject_insufficient_evidence"
        : "request_revision");

  const attestation = input.model_attestation ?? "unverifiable";
  const crossModel =
    attestation === "platform_reported" && blind.critic_model !== author.author_model;
  const report = CriticComparisonReportSchema.parse({
    session_id: session.session_id,
    target_id: session.target_id,
    is_major_verification: session.is_major_verification,
    author_model: author.author_model,
    critic_model: blind.critic_model,
    blind_evaluation: blind,
    author_conclusion: author,
    compared_at: input.compared_at ?? nowUtc(),
    agrees_with_author: agrees,
    discrepancies: [...(input.discrepancies ?? [])],
    anchoring_risk_detected: anchoringRisk,
    final_recommendation: recommendation,
    model_attestation: attestation,
    cross_model_verified: crossModel,
    independence_limit: crossModel
      ? null
      : attestation === "platform_reported"
        ? "Author and critic ran on the same model: the review is anti-anchoring but not cross-model."
        : "The execution platform did not report the models used: cross-model independence is not verified.",
  });

  return {
    ...session,
    phase: "finalized",
    report,
  };
}
