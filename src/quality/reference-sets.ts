import { readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { BenchmarkCaseSchema, BenchmarkCasesSchema, scoreAnswer } from "../audit/benchmark.ts";
import { REPO_ROOT } from "../pipeline/paths.ts";

/**
 * 3-tier reference set model (dev, validation, holdout) built on
 * docs/audit/baseline/benchmark-cases.v1.json, with role-based access guards
 * in code, aggregate-only holdout evaluation and rotation tracking.
 *
 * Methodological limit (26 November 2026): all three tiers are public files
 * in the repository. The code guards keep honest callers from reading
 * solutions, but any agent with repository access can read them, so the
 * `holdout` tier is a held-out PUBLIC split, never an independent holdout.
 * Independent evaluation needs a fresh case set not exposed to the evaluated
 * agent, or an external evaluator; results must state which one was used.
 */
export const HOLDOUT_IS_INDEPENDENT = false as const;

export const REFERENCE_TIERS = ["dev", "validation", "holdout"] as const;
export const CALLER_ROLES = ["implementation_agent", "evaluator", "human_reviewer"] as const;
export const ROTATION_STATUSES = ["active", "scheduled", "retired"] as const;
export const CONTAMINATION_RISKS = ["low", "medium", "high"] as const;

export const ReferenceTierSchema = z
  .enum(REFERENCE_TIERS)
  .describe("Reference set tier: dev, validation, or holdout.");

export const CallerRoleSchema = z
  .enum(CALLER_ROLES)
  .describe("Caller identity used to enforce holdout access boundaries.");

export const ReferenceSetFileSchema = z.strictObject({
  tier: ReferenceTierSchema.describe("Tier of this reference set."),
  version: z.number().int().positive().describe("Schema and split version number."),
  source_case_set: z.string().min(1).describe("Originating benchmark case_set identifier."),
  as_of_commit: z.string().min(7).describe("Git commit hash of the baseline snapshot."),
  access_policy: z
    .string()
    .min(1)
    .describe("Human-readable summary of who may read solutions in this tier."),
  cases: z.array(BenchmarkCaseSchema).min(1).describe("Benchmark cases assigned to this tier."),
});

export const PublicPromptCaseSchema = z.strictObject({
  id: z
    .string()
    .regex(/^B\d{1,2}$/)
    .describe("Benchmark case identifier."),
  topic: z.string().min(1).describe("Topic label of the test case."),
  question: z
    .strictObject({
      it: z.string().min(1).describe("Italian prompt text."),
      en: z.string().min(1).describe("English prompt text."),
    })
    .describe("Bilingual question without expected_answer or scoring phrases."),
});

export const RotationRecordSchema = z.strictObject({
  rotation_id: z.string().min(1).describe("Unique identifier for the holdout rotation epoch."),
  tier: ReferenceTierSchema.describe("Tier tracked by this rotation record."),
  active_since: z.string().min(1).describe("ISO timestamp when this epoch became active."),
  rotated_at: z
    .string()
    .nullable()
    .describe("ISO timestamp when retired, or null if still active."),
  status: z.enum(ROTATION_STATUSES).describe("Current lifecycle status of this rotation epoch."),
  evaluations_count: z
    .number()
    .int()
    .nonnegative()
    .describe("Number of evaluations executed against this epoch."),
  max_evaluations: z
    .number()
    .int()
    .positive()
    .describe("Maximum allowed evaluations before mandatory rotation."),
  case_count: z.number().int().positive().describe("Number of cases in this epoch."),
  contamination_risk: z
    .enum(CONTAMINATION_RISKS)
    .describe("Estimated risk of solution leakage or overfitting."),
  reason: z.string().min(1).describe("Reason for creation, scheduling, or retirement."),
});

export const HoldoutAggregateReportSchema = z.strictObject({
  tier: z.literal("holdout").describe("Evaluated tier (always holdout)."),
  rotation_id: z.string().min(1).describe("Rotation epoch used for evaluation."),
  evaluated_at: z.string().min(1).describe("ISO timestamp of evaluation."),
  total_cases: z.number().int().nonnegative().describe("Total cases in the holdout split."),
  answered: z.number().int().nonnegative().describe("Number of non-empty answers submitted."),
  passed: z.number().int().nonnegative().describe("Number of answers passing all checks."),
  pass_rate: z.number().min(0).max(1).describe("Fraction of total holdout cases passed."),
  abstention_rate: z
    .number()
    .min(0)
    .max(1)
    .describe("Fraction of holdout cases left unanswered/abstained."),
  forbidden_hits: z
    .number()
    .int()
    .nonnegative()
    .describe("Total forbidden phrase hits across holdout answers."),
  invented_ids: z
    .number()
    .int()
    .nonnegative()
    .describe("Total invented canonical IDs across holdout answers."),
  mean_completeness: z
    .number()
    .min(0)
    .max(1)
    .nullable()
    .describe("Mean citation completeness across answered holdout cases."),
});

export type ReferenceTier = z.infer<typeof ReferenceTierSchema>;
export type CallerRole = z.infer<typeof CallerRoleSchema>;
export type ReferenceSetFile = z.infer<typeof ReferenceSetFileSchema>;
export type PublicPromptCase = z.infer<typeof PublicPromptCaseSchema>;
export type RotationRecord = z.infer<typeof RotationRecordSchema>;
export type HoldoutAggregateReport = z.infer<typeof HoldoutAggregateReportSchema>;
export type BenchmarkCase = z.infer<typeof BenchmarkCaseSchema>;

export class ReferenceSetAccessError extends Error {
  readonly role: CallerRole;
  readonly tier: ReferenceTier;

  constructor(role: CallerRole, tier: ReferenceTier, message?: string) {
    super(
      message ??
        `Access denied: role "${role}" is not permitted to read "${tier}" reference set solutions.`,
    );
    this.name = "ReferenceSetAccessError";
    this.role = role;
    this.tier = tier;
  }
}

const DEFAULT_BASELINE_PATH = path.join(REPO_ROOT, "docs/audit/baseline/benchmark-cases.v1.json");
const DEFAULT_DEV_SET_PATH = path.join(REPO_ROOT, "docs/quality/sets/dev.v1.json");

export const TIER_PARTITION = {
  dev: ["B1", "B2", "B3", "B4", "B5", "B6", "B7", "B8", "B9", "B10"],
  validation: ["B11", "B12", "B13", "B14", "B15"],
  holdout: ["B16", "B17", "B18", "B19", "B20"],
} as const;

export function loadBaselineCases(baselinePath: string = DEFAULT_BASELINE_PATH) {
  const raw: unknown = JSON.parse(readFileSync(baselinePath, "utf8"));
  return BenchmarkCasesSchema.parse(raw);
}

export function loadDevReferenceSet(devSetPath: string = DEFAULT_DEV_SET_PATH): ReferenceSetFile {
  const raw: unknown = JSON.parse(readFileSync(devSetPath, "utf8"));
  return ReferenceSetFileSchema.parse(raw);
}

export function buildTierSplitsFromBaseline(baselinePath: string = DEFAULT_BASELINE_PATH): {
  dev: ReferenceSetFile;
  validation: ReferenceSetFile;
  holdout: ReferenceSetFile;
} {
  const baseline = loadBaselineCases(baselinePath);
  const byId = new Map(baseline.cases.map((c) => [c.id, c]));

  const pick = (ids: readonly string[]): BenchmarkCase[] =>
    ids.map((id) => {
      const found = byId.get(id);
      if (!found) throw new Error(`Baseline case ${id} missing from ${baselinePath}`);
      return found;
    });

  return {
    dev: {
      tier: "dev",
      version: baseline.version,
      source_case_set: baseline.case_set,
      as_of_commit: baseline.as_of_commit,
      access_policy: "Open to implementation agents, evaluators, and human reviewers.",
      cases: pick(TIER_PARTITION.dev),
    },
    validation: {
      tier: "validation",
      version: baseline.version,
      source_case_set: baseline.case_set,
      as_of_commit: baseline.as_of_commit,
      access_policy: "Open to evaluators and human reviewers; questions-only for agents.",
      cases: pick(TIER_PARTITION.validation),
    },
    holdout: {
      tier: "holdout",
      version: baseline.version,
      source_case_set: baseline.case_set,
      as_of_commit: baseline.as_of_commit,
      access_policy:
        "Sealed: strictly blocked for implementation_agent; evaluator returns aggregate metrics only.",
      cases: pick(TIER_PARTITION.holdout),
    },
  };
}

/**
 * Role guard on tier solutions: implementation agents calling this API are
 * refused holdout and validation solutions. It prevents accidental use by
 * cooperating code, not deliberate reading of the public files.
 */
export function getReferenceSetSolutions(
  tier: ReferenceTier,
  role: CallerRole,
  baselinePath: string = DEFAULT_BASELINE_PATH,
): ReferenceSetFile {
  const parsedRole = CallerRoleSchema.parse(role);
  const parsedTier = ReferenceTierSchema.parse(tier);

  if (parsedRole === "implementation_agent" && parsedTier === "holdout") {
    throw new ReferenceSetAccessError(parsedRole, parsedTier);
  }
  if (parsedRole === "implementation_agent" && parsedTier === "validation") {
    throw new ReferenceSetAccessError(
      parsedRole,
      parsedTier,
      'Access denied: role "implementation_agent" cannot read "validation" solutions; request prompts only.',
    );
  }

  const splits = buildTierSplitsFromBaseline(baselinePath);
  return splits[parsedTier];
}

/**
 * Returns only prompt metadata (id, topic, question) without expected_answer,
 * required phrases, forbidden phrases, or typical_error. Holdout prompts are
 * also withheld from implementation_agent to prevent targeted overfitting.
 */
export function getReferenceSetPrompts(
  tier: ReferenceTier,
  role: CallerRole,
  baselinePath: string = DEFAULT_BASELINE_PATH,
): PublicPromptCase[] {
  const parsedRole = CallerRoleSchema.parse(role);
  const parsedTier = ReferenceTierSchema.parse(tier);

  if (parsedRole === "implementation_agent" && parsedTier === "holdout") {
    throw new ReferenceSetAccessError(
      parsedRole,
      parsedTier,
      'Access denied: role "implementation_agent" cannot inspect "holdout" cases.',
    );
  }

  const splits = buildTierSplitsFromBaseline(baselinePath);
  return splits[parsedTier].cases.map((c) => ({
    id: c.id,
    topic: c.topic,
    question: c.question,
  }));
}

export interface HoldoutAnswerSubmission {
  id: string;
  text: string;
}

/**
 * Evaluates holdout answers and returns aggregate metrics only.
 * Never returns per-case IDs, expected answers, or phrase-level diagnostics.
 */
export function evaluateHoldoutAggregate(
  answers: readonly HoldoutAnswerSubmission[],
  role: CallerRole,
  knownIds: ReadonlySet<string>,
  options: {
    rotationId?: string;
    baselinePath?: string;
    evaluatedAt?: string;
  } = {},
): HoldoutAggregateReport {
  const parsedRole = CallerRoleSchema.parse(role);
  if (parsedRole === "implementation_agent") {
    throw new ReferenceSetAccessError(
      parsedRole,
      "holdout",
      'Access denied: role "implementation_agent" cannot invoke holdout evaluation directly.',
    );
  }

  const holdout = getReferenceSetSolutions("holdout", parsedRole, options.baselinePath);
  const byId = new Map(answers.map((a) => [a.id, a.text]));

  let answered = 0;
  let passed = 0;
  let forbiddenHits = 0;
  let inventedIds = 0;
  let completenessSum = 0;

  for (const testCase of holdout.cases) {
    const text = byId.get(testCase.id) ?? "";
    if (text.trim() === "") continue;
    answered += 1;
    const scored = scoreAnswer(testCase, text, knownIds);
    if (scored.pass) passed += 1;
    forbiddenHits += scored.forbidden_hits.length;
    inventedIds += scored.invented_ids.length;
    completenessSum += scored.completeness;
  }

  const total = holdout.cases.length;
  const round3 = (n: number) => Math.round(n * 1000) / 1000;

  return HoldoutAggregateReportSchema.parse({
    tier: "holdout",
    rotation_id: options.rotationId ?? "holdout-v1-epoch-1",
    evaluated_at: options.evaluatedAt ?? new Date().toISOString(),
    total_cases: total,
    answered,
    passed,
    pass_rate: total === 0 ? 0 : round3(passed / total),
    abstention_rate: total === 0 ? 0 : round3((total - answered) / total),
    forbidden_hits: forbiddenHits,
    invented_ids: inventedIds,
    mean_completeness: answered === 0 ? null : round3(completenessSum / answered),
  });
}

export function needsRotation(record: RotationRecord): boolean {
  const parsed = RotationRecordSchema.parse(record);
  return (
    parsed.status === "scheduled" ||
    parsed.contamination_risk === "high" ||
    parsed.evaluations_count >= parsed.max_evaluations
  );
}

export function advanceRotation(
  current: RotationRecord,
  newRotationId: string,
  reason: string,
  now: string = new Date().toISOString(),
): { retired: RotationRecord; active: RotationRecord } {
  const parsed = RotationRecordSchema.parse(current);
  const retired: RotationRecord = {
    ...parsed,
    status: "retired",
    rotated_at: now,
    reason,
  };
  const active: RotationRecord = {
    rotation_id: newRotationId,
    tier: parsed.tier,
    active_since: now,
    rotated_at: null,
    status: "active",
    evaluations_count: 0,
    max_evaluations: parsed.max_evaluations,
    case_count: parsed.case_count,
    contamination_risk: "low",
    reason: `Rotated from ${parsed.rotation_id}: ${reason}`,
  };
  return { retired, active };
}
