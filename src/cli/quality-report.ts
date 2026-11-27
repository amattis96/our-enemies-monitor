import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { scoreAnswer } from "../audit/benchmark.ts";
import { readDataFiles } from "../pipeline/load.ts";
import { REPO_ROOT } from "../pipeline/paths.ts";
import { validateDataFiles } from "../pipeline/validate.ts";
import {
  evaluateD6Gates,
  evaluateDiscovery,
  evaluateHoldoutAggregate,
  loadDevReferenceSet,
  needsRotation,
  PLAYWRIGHT_LIGHTHOUSE_CI_SPEC,
  RotationRecordSchema,
  runStaticHtmlAudit,
  TEST_FAMILIES,
} from "../quality/index.ts";

const DEFAULT_OUT = path.join(REPO_ROOT, "docs/quality/reports/latest.json");
const THRESHOLDS_PATH = path.join(REPO_ROOT, "docs/quality/thresholds.v1.json");

export const QualityReportSchema = z.strictObject({
  report_version: z.literal(1).describe("Operational quality report schema version."),
  generated_at: z.string().min(1).describe("ISO timestamp when the report was generated."),
  commit: z.string().nullable().describe("Current git HEAD commit hash, if available."),
  thresholds_version: z.number().int().positive().describe("Version of thresholds.v1.json."),
  test_families: z
    .array(
      z.strictObject({
        id: z.string().min(1).describe("Test family identifier."),
        frequencies: z.array(z.string().min(1)).describe("Configured trigger frequencies."),
        blocking_in_ci: z.boolean().describe("Whether failures block CI."),
      }),
    )
    .describe("Inventory of PK-02 test families."),
  reference_sets: z
    .strictObject({
      dev_cases: z.number().int().nonnegative().describe("Number of cases in dev split."),
      scorer_self_check_pass_rate: z
        .number()
        .min(0)
        .max(1)
        .describe(
          "Share of dev expected answers the scorer accepts: a check of the scorer, not an agent result.",
        ),
      holdout_aggregate: z
        .strictObject({
          tier: z.literal("holdout").describe("Holdout tier label."),
          rotation_id: z.string().min(1).describe("Active holdout rotation epoch ID."),
          total_cases: z.number().int().nonnegative().describe("Total holdout cases."),
          needs_rotation: z.boolean().describe("Whether holdout epoch requires rotation."),
          independent: z
            .literal(false)
            .describe(
              "Always false: B16-B20 are public in the repository, so they are not an independent holdout.",
            ),
          limitation: z.string().min(1).describe("Declared methodological limitation."),
        })
        .describe(
          "Held-out public split: aggregate status, explicitly not an independent holdout.",
        ),
    })
    .describe("3-tier reference set and rotation summary."),
  d6_gates: z
    .strictObject({
      passed: z.boolean().describe("True iff all zero-tolerance D6 gates passed."),
      blockers: z.array(z.string()).describe("Failed D6 gate identifiers."),
    })
    .describe("Zero-tolerance D6 blocking gate result."),
  agent_metrics: z
    .strictObject({
      measured: z
        .literal(false)
        .describe("False until real agent answers from a recorded run are scored."),
      note: z.string().min(1).describe("Why no agent metric is reported."),
    })
    .describe(
      "Agent quality metrics (precision, recall, F1, abstention, caveats). Never computed from expected answers.",
    ),
  discovery_eval: z
    .strictObject({
      ex_ante_composite: z.number().min(0).max(1).describe("Ex-ante composite quality score."),
      ex_post_yield_rate: z.number().min(0).max(1).describe("Ex-post informative yield rate."),
      useful_refutations: z
        .number()
        .int()
        .nonnegative()
        .describe("Count of useful refutations included in yield."),
    })
    .describe("Two-plane discovery evaluation summary."),
  visual_audit: z
    .strictObject({
      built: z.boolean().describe("Whether web/dist was present for static HTML audit."),
      pages_scanned: z.number().int().nonnegative().describe("HTML pages scanned."),
      severe_errors: z.number().int().nonnegative().describe("Severe static a11y errors."),
      warnings: z.number().int().nonnegative().describe("Non-blocking static warnings."),
      passed: z.boolean().describe("True iff severe_errors === 0."),
      ci_matrix_combinations: z
        .number()
        .int()
        .positive()
        .describe("Total (page_type x viewport x theme) combinations in CI spec."),
    })
    .describe("Visual and static accessibility audit summary."),
});

export type QualityReport = z.infer<typeof QualityReportSchema>;

function gitCommit(): string | null {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    }).trim();
  } catch {
    return null;
  }
}

function parseOption(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : undefined;
}

export function generateQualityReport(options: { distDir?: string } = {}): QualityReport {
  const thresholds = JSON.parse(readFileSync(THRESHOLDS_PATH, "utf8")) as {
    version: number;
    reference_sets: { holdout_max_evaluations_before_rotation: number };
  };

  const { issues, dataset } = validateDataFiles(readDataFiles());
  const dataErrors = issues.filter((i) => i.severity === "error");
  const knownIds = new Set(
    (Object.keys(dataset) as (keyof typeof dataset)[]).flatMap((k) => dataset[k].map((r) => r.id)),
  );

  // Scorer self-check: the reference set's own expected answers must pass the
  // scorer and must not cite invented IDs or forbidden phrasing. This checks
  // the benchmark material, not any agent; agent metrics stay unmeasured.
  const devSet = loadDevReferenceSet();
  let devPassed = 0;
  let forbiddenHits = 0;
  let inventedIds = 0;
  for (const c of devSet.cases) {
    const scored = scoreAnswer(c, c.expected_answer, knownIds);
    if (scored.pass) devPassed += 1;
    forbiddenHits += scored.forbidden_hits.length;
    inventedIds += scored.invented_ids.length;
  }

  const holdoutRotation = RotationRecordSchema.parse({
    rotation_id: "holdout-v1-epoch-1",
    tier: "holdout",
    active_since: "2026-11-25T00:00:00.000Z",
    rotated_at: null,
    status: "active",
    evaluations_count: 1,
    max_evaluations: thresholds.reference_sets.holdout_max_evaluations_before_rotation,
    case_count: 5,
    contamination_risk: "low",
    reason: "Initial PK-02 holdout epoch.",
  });

  // Evaluate holdout with evaluator role (aggregate only, empty submission baseline check)
  const holdoutAgg = evaluateHoldoutAggregate([], "evaluator", knownIds, {
    rotationId: holdoutRotation.rotation_id,
  });

  const visual = runStaticHtmlAudit(options.distDir);

  const d6 = evaluateD6Gates({
    withheld_leaks: 0,
    invalid_canonical_refs: inventedIds,
    forbidden_inferences_in_regression: forbiddenHits,
    human_review_status_by_agent: 0,
    lost_critical_caveats: 0,
    unauthorized_contract_regressions: dataErrors.length,
    severe_a11y_errors: visual.severe_errors,
  });

  const discovery = evaluateDiscovery([]);

  return QualityReportSchema.parse({
    report_version: 1,
    generated_at: new Date().toISOString(),
    commit: gitCommit(),
    thresholds_version: thresholds.version,
    test_families: TEST_FAMILIES.map((f) => ({
      id: f.id,
      frequencies: [...f.frequencies],
      blocking_in_ci: f.blocking_in_ci,
    })),
    reference_sets: {
      dev_cases: devSet.cases.length,
      scorer_self_check_pass_rate:
        devSet.cases.length === 0 ? 0 : Math.round((devPassed / devSet.cases.length) * 1000) / 1000,
      holdout_aggregate: {
        tier: "holdout",
        rotation_id: holdoutAgg.rotation_id,
        total_cases: holdoutAgg.total_cases,
        needs_rotation: needsRotation(holdoutRotation),
        independent: false,
        limitation:
          "B16-B20 are public in docs/audit/baseline/: any agent with repository access can read them. Results on this split are not an independent validation; independent evaluation needs a fresh, unexposed case set or an external evaluator.",
      },
    },
    d6_gates: {
      passed: d6.passed,
      blockers: [...d6.blockers],
    },
    agent_metrics: {
      measured: false,
      note: "No recorded agent answers yet. Expected answers are used only for the scorer self-check and are never reported as agent results.",
    },
    discovery_eval: {
      ex_ante_composite: discovery.ex_ante.composite_score,
      ex_post_yield_rate: discovery.ex_post.yield_rate,
      useful_refutations: discovery.ex_post.useful_refutations,
    },
    visual_audit: {
      built: visual.built,
      pages_scanned: visual.pages_scanned,
      severe_errors: visual.severe_errors,
      warnings: visual.warnings,
      passed: visual.passed,
      ci_matrix_combinations: PLAYWRIGHT_LIGHTHOUSE_CI_SPEC.matrix_count,
    },
  });
}

const isEntrypoint =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);

if (isEntrypoint) {
  const args = process.argv.slice(2);
  const outPath = parseOption(args, "--out") ?? DEFAULT_OUT;
  const distDir = parseOption(args, "--dist");
  const report = generateQualityReport(distDir ? { distDir } : {});
  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(
    `PK-02 quality report written to ${path.relative(REPO_ROOT, outPath)} (d6_passed=${String(report.d6_gates.passed)}, visual_pages=${String(report.visual_audit.pages_scanned)}, severe_a11y=${String(report.visual_audit.severe_errors)})\n`,
  );
  if (!report.d6_gates.passed) {
    process.exitCode = 1;
  }
}
