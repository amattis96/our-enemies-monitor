import { z } from "zod";

/**
 * Two-plane discovery evaluation:
 * - Ex-ante quality: pertinence, novelty, verifiability, justification.
 * - Ex-post yield: informative resolutions, explicitly including useful refutations.
 */

export const RESOLUTION_OUTCOMES = [
  "pending",
  "confirmed_integrated",
  "useful_refutation",
  "inconclusive",
  "duplicate",
] as const;

export const DiscoveryProposalSchema = z.strictObject({
  id: z.string().min(1).describe("Proposal or candidate identifier."),
  pertinence: z.number().min(0).max(1).describe("Relevance to project scope (0 to 1)."),
  novelty: z.number().min(0).max(1).describe("Non-duplication against existing corpus (0 to 1)."),
  verifiability: z
    .number()
    .min(0)
    .max(1)
    .describe("Presence of primary, checkable sources (0 to 1)."),
  justification: z
    .number()
    .min(0)
    .max(1)
    .describe("Clarity and soundness of rationale / hypothesis link (0 to 1)."),
  resolution: z.enum(RESOLUTION_OUTCOMES).describe("Ex-post resolution outcome after review."),
});

export const ExAnteSummarySchema = z.strictObject({
  total_proposals: z.number().int().nonnegative().describe("Total evaluated proposals."),
  mean_pertinence: z.number().min(0).max(1).describe("Mean pertinence score across proposals."),
  mean_novelty: z.number().min(0).max(1).describe("Mean novelty score across proposals."),
  mean_verifiability: z
    .number()
    .min(0)
    .max(1)
    .describe("Mean verifiability score across proposals."),
  mean_justification: z
    .number()
    .min(0)
    .max(1)
    .describe("Mean justification score across proposals."),
  composite_score: z
    .number()
    .min(0)
    .max(1)
    .describe("Equal-weighted composite ex-ante quality score."),
});

export const ExPostSummarySchema = z.strictObject({
  resolved_count: z.number().int().nonnegative().describe("Number of non-pending proposals."),
  confirmed_integrated: z
    .number()
    .int()
    .nonnegative()
    .describe("Proposals confirmed and integrated into the corpus."),
  useful_refutations: z
    .number()
    .int()
    .nonnegative()
    .describe("Proposals that cleanly refuted a hypothesis or prevented a false positive."),
  informative_resolutions: z
    .number()
    .int()
    .nonnegative()
    .describe("Sum of confirmed_integrated and useful_refutations."),
  inconclusive_or_duplicate: z
    .number()
    .int()
    .nonnegative()
    .describe("Resolved proposals that were inconclusive or duplicates."),
  yield_rate: z
    .number()
    .min(0)
    .max(1)
    .describe("informative_resolutions / resolved_count (0 if none resolved)."),
  refutation_share: z
    .number()
    .min(0)
    .max(1)
    .describe("useful_refutations / informative_resolutions (0 if none informative)."),
});

export const DiscoveryEvalReportSchema = z.strictObject({
  ex_ante: ExAnteSummarySchema.describe("Ex-ante proposal quality metrics."),
  ex_post: ExPostSummarySchema.describe("Ex-post discovery yield metrics."),
});

export type DiscoveryProposal = z.infer<typeof DiscoveryProposalSchema>;
export type DiscoveryEvalReport = z.infer<typeof DiscoveryEvalReportSchema>;

const round4 = (n: number) => Math.round(n * 10000) / 10000;

export function evaluateDiscovery(proposals: readonly DiscoveryProposal[]): DiscoveryEvalReport {
  const parsed = proposals.map((p) => DiscoveryProposalSchema.parse(p));
  const total = parsed.length;

  const mean = (pick: (p: DiscoveryProposal) => number) =>
    total === 0 ? 0 : round4(parsed.reduce((s, p) => s + pick(p), 0) / total);

  const meanPertinence = mean((p) => p.pertinence);
  const meanNovelty = mean((p) => p.novelty);
  const meanVerifiability = mean((p) => p.verifiability);
  const meanJustification = mean((p) => p.justification);
  const compositeScore =
    total === 0
      ? 0
      : round4((meanPertinence + meanNovelty + meanVerifiability + meanJustification) / 4);

  const resolved = parsed.filter((p) => p.resolution !== "pending");
  const confirmed = resolved.filter((p) => p.resolution === "confirmed_integrated").length;
  const usefulRefutations = resolved.filter((p) => p.resolution === "useful_refutation").length;
  const informative = confirmed + usefulRefutations;
  const inconclusiveOrDuplicate = resolved.length - informative;

  return DiscoveryEvalReportSchema.parse({
    ex_ante: {
      total_proposals: total,
      mean_pertinence: meanPertinence,
      mean_novelty: meanNovelty,
      mean_verifiability: meanVerifiability,
      mean_justification: meanJustification,
      composite_score: compositeScore,
    },
    ex_post: {
      resolved_count: resolved.length,
      confirmed_integrated: confirmed,
      useful_refutations: usefulRefutations,
      informative_resolutions: informative,
      inconclusive_or_duplicate: inconclusiveOrDuplicate,
      yield_rate: resolved.length === 0 ? 0 : round4(informative / resolved.length),
      refutation_share: informative === 0 ? 0 : round4(usefulRefutations / informative),
    },
  });
}
