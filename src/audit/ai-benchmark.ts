import { z } from "zod";

export const AI_BENCHMARK_MODES = ["findability", "interpretation"] as const;
export type AiBenchmarkMode = (typeof AI_BENCHMARK_MODES)[number];

export const AI_ACCESS_MODES = ["web_search", "direct_corpus", "hybrid"] as const;
export type AiAccessMode = (typeof AI_ACCESS_MODES)[number];

export const MISSING_CITATION_CAUSE_KINDS = [
  "poor_indexing",
  "irrelevant_corpus",
  "search_engine_policy",
  "consulted_not_cited",
  "unknown",
] as const;
export type MissingCitationCauseKind = (typeof MISSING_CITATION_CAUSE_KINDS)[number];

export const CAUSE_CERTAINTIES = ["verified", "hypothesized"] as const;
export type CauseCertainty = (typeof CAUSE_CERTAINTIES)[number];

export const MISINTERPRETATION_KINDS = [
  "unsupported_inference",
  "attribution_as_conviction",
  "hypothesis_as_fact",
  "invented_id",
  "omitted_caveat",
  "other",
] as const;
export type MisinterpretationKind = (typeof MISINTERPRETATION_KINDS)[number];

export const MissingCitationCauseSchema = z.strictObject({
  cause: z
    .enum(MISSING_CITATION_CAUSE_KINDS)
    .describe("Classified cause of missing citation (including unknown)."),
  certainty: z
    .enum(CAUSE_CERTAINTIES)
    .describe("Whether the cause is directly verified or hypothesized."),
  evidence: z
    .string()
    .min(1)
    .describe("Observed evidence or rationale supporting this cause classification."),
});
export type MissingCitationCause = z.infer<typeof MissingCitationCauseSchema>;

export const MisinterpretationSchema = z.strictObject({
  kind: z.enum(MISINTERPRETATION_KINDS).describe("Category of interpretation error."),
  note: z.string().min(1).describe("Specific description of the misinterpretation."),
});
export type Misinterpretation = z.infer<typeof MisinterpretationSchema>;

export const AiBenchmarkTrialSchema = z.strictObject({
  trial_id: z.string().min(1).describe("Unique trial identifier within the run."),
  case_id: z.string().min(1).describe("Benchmark case identifier (e.g. B1..B20)."),
  mode: z.enum(AI_BENCHMARK_MODES).describe("findability (web search) or interpretation (corpus)."),
  corpus_available: z
    .boolean()
    .describe("Whether the corpus or snapshot was available to the model."),
  web_search_used: z.boolean().describe("Whether live web search was enabled during the trial."),
  language: z.enum(["it", "en"]).describe("Prompt language."),
  model: z.string().min(1).describe("External model name."),
  model_version: z.string().min(1).describe("Exact model version or release tag."),
  access_mode: z.enum(AI_ACCESS_MODES).describe("How the model accessed the knowledge base."),
  prompt: z.string().min(1).describe("Exact prompt submitted to the model."),
  run_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe("Date of execution (YYYY-MM-DD)."),
  repeat_index: z
    .number()
    .int()
    .positive()
    .describe("1-based repeat index for measuring repeat variability."),
  cited_urls: z.array(z.string()).describe("Portal or source URLs cited in the answer."),
  cited_ids: z.array(z.string()).describe("Canonical record IDs cited in the answer."),
  answer_text: z.string().describe("Full model answer text."),
  missing_citation_causes: z
    .array(MissingCitationCauseSchema)
    .describe("Causes of missing citation, separating verified from hypothesized."),
  misinterpretations: z
    .array(MisinterpretationSchema)
    .describe("Recorded interpretation errors, distinct from missing citations."),
  passed: z.boolean().describe("Whether the trial met the benchmark criteria."),
});
export type AiBenchmarkTrial = z.infer<typeof AiBenchmarkTrialSchema>;

export const AiBenchmarkRunSchema = z.strictObject({
  schema_version: z.literal("1.0.0").describe("Schema version of the external AI benchmark run."),
  run_id: z.string().min(1).describe("Unique identifier for this benchmark run (e.g. 2026-11)."),
  run_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe("Run date (YYYY-MM-DD)."),
  snapshot_id: z.string().min(1).describe("Snapshot ID or commit evaluated."),
  trials: z.array(AiBenchmarkTrialSchema).min(1).describe("Recorded benchmark trials."),
});
export type AiBenchmarkRun = z.infer<typeof AiBenchmarkRunSchema>;

export type RepeatVariabilityEntry = {
  group_key: string;
  trials: number;
  pass_count: number;
  citation_counts: number[];
  is_variable: boolean;
};

export type AiBenchmarkSummary = {
  run_id: string;
  run_date: string;
  snapshot_id: string;
  total_trials: number;
  findability_trials: number;
  findability_citation_rate: number;
  interpretation_trials: number;
  interpretation_pass_rate: number;
  repeat_variability: RepeatVariabilityEntry[];
  variability_rate: number;
  verified_missing_citation_causes: Record<MissingCitationCauseKind, number>;
  hypothesized_missing_citation_causes: Record<MissingCitationCauseKind, number>;
  misinterpretation_counts: Record<MisinterpretationKind, number>;
  /**
   * Policy invariant: a single bad answer never triggers a page mutation.
   * Only recurring, verified issues across multiple trials/runs are surfaced as review candidates.
   */
  requires_page_mutation: false;
  review_candidates: string[];
};

function emptyCauseCounts(): Record<MissingCitationCauseKind, number> {
  return {
    poor_indexing: 0,
    irrelevant_corpus: 0,
    search_engine_policy: 0,
    consulted_not_cited: 0,
    unknown: 0,
  };
}

function emptyMisinterpretationCounts(): Record<MisinterpretationKind, number> {
  return {
    unsupported_inference: 0,
    attribution_as_conviction: 0,
    hypothesis_as_fact: 0,
    invented_id: 0,
    omitted_caveat: 0,
    other: 0,
  };
}

/**
 * Score and summarize an external AI benchmark run.
 */
export function scoreAiBenchmarkRun(runInput: unknown): AiBenchmarkSummary {
  const run = AiBenchmarkRunSchema.parse(runInput);
  const findability = run.trials.filter((t) => t.mode === "findability");
  const interpretation = run.trials.filter((t) => t.mode === "interpretation");

  const findabilityCited = findability.filter(
    (t) => t.cited_urls.length > 0 || t.cited_ids.length > 0,
  ).length;
  const interpretationPassed = interpretation.filter((t) => t.passed).length;

  const verifiedCauses = emptyCauseCounts();
  const hypothesizedCauses = emptyCauseCounts();
  const misinterpretations = emptyMisinterpretationCounts();

  const groups = new Map<string, AiBenchmarkTrial[]>();
  const verifiedFailuresByCase = new Map<string, number>();

  for (const trial of run.trials) {
    for (const c of trial.missing_citation_causes) {
      if (c.certainty === "verified") {
        verifiedCauses[c.cause] += 1;
        verifiedFailuresByCase.set(
          trial.case_id,
          (verifiedFailuresByCase.get(trial.case_id) ?? 0) + 1,
        );
      } else {
        hypothesizedCauses[c.cause] += 1;
      }
    }
    for (const m of trial.misinterpretations) {
      misinterpretations[m.kind] += 1;
    }

    const key = `${trial.case_id}|${trial.mode}|${trial.language}|${trial.model}|${trial.access_mode}`;
    groups.set(key, [...(groups.get(key) ?? []), trial]);
  }

  const repeatVariability: RepeatVariabilityEntry[] = [];
  for (const [groupKey, groupTrials] of groups) {
    if (groupTrials.length < 2) continue;
    const passCount = groupTrials.filter((t) => t.passed).length;
    const citationCounts = groupTrials.map((t) => t.cited_urls.length + t.cited_ids.length);
    const passesVary = passCount > 0 && passCount < groupTrials.length;
    const citationsVary = new Set(citationCounts).size > 1;
    repeatVariability.push({
      group_key: groupKey,
      trials: groupTrials.length,
      pass_count: passCount,
      citation_counts: citationCounts,
      is_variable: passesVary || citationsVary,
    });
  }

  const variableGroups = repeatVariability.filter((g) => g.is_variable).length;
  const reviewCandidates = [...verifiedFailuresByCase.entries()]
    .filter(([, count]) => count >= 2)
    .map(([caseId]) => caseId)
    .sort();

  return {
    run_id: run.run_id,
    run_date: run.run_date,
    snapshot_id: run.snapshot_id,
    total_trials: run.trials.length,
    findability_trials: findability.length,
    findability_citation_rate: findability.length === 0 ? 0 : findabilityCited / findability.length,
    interpretation_trials: interpretation.length,
    interpretation_pass_rate:
      interpretation.length === 0 ? 0 : interpretationPassed / interpretation.length,
    repeat_variability: repeatVariability,
    variability_rate:
      repeatVariability.length === 0 ? 0 : variableGroups / repeatVariability.length,
    verified_missing_citation_causes: verifiedCauses,
    hypothesized_missing_citation_causes: hypothesizedCauses,
    misinterpretation_counts: misinterpretations,
    requires_page_mutation: false,
    review_candidates: reviewCandidates,
  };
}

export type MonthlyComparison = {
  previous_run_id: string;
  current_run_id: string;
  findability_citation_rate_delta: number;
  interpretation_pass_rate_delta: number;
  variability_rate_delta: number;
};

/**
 * Compare two monthly benchmark runs.
 */
export function compareMonthlyRuns(
  previousInput: unknown,
  currentInput: unknown,
): MonthlyComparison {
  const prev = scoreAiBenchmarkRun(previousInput);
  const curr = scoreAiBenchmarkRun(currentInput);
  return {
    previous_run_id: prev.run_id,
    current_run_id: curr.run_id,
    findability_citation_rate_delta:
      curr.findability_citation_rate - prev.findability_citation_rate,
    interpretation_pass_rate_delta: curr.interpretation_pass_rate - prev.interpretation_pass_rate,
    variability_rate_delta: curr.variability_rate - prev.variability_rate,
  };
}
