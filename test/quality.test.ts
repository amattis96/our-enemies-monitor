import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { generateQualityReport, QualityReportSchema } from "../src/cli/quality-report.ts";
import { REPO_ROOT } from "../src/pipeline/paths.ts";
import {
  advanceRotation,
  buildTierSplitsFromBaseline,
  checkHtmlDocument,
  computeCohensKappa,
  computePrecision,
  computeRecall,
  D6_GATE_IDS,
  evaluateD6Gates,
  evaluateDiscovery,
  evaluateHoldoutAggregate,
  familiesForFrequency,
  getReferenceSetPrompts,
  getReferenceSetSolutions,
  getTestFamily,
  loadDevReferenceSet,
  needsRotation,
  PAGE_VISUAL_BUDGETS,
  PLAYWRIGHT_LIGHTHOUSE_CI_SPEC,
  ReferenceSetAccessError,
  RotationRecordSchema,
  runStaticHtmlAudit,
  summarizeQualityMetrics,
  TEST_FAMILIES,
  TEST_FAMILY_IDS,
  TEST_FREQUENCIES,
} from "../src/quality/index.ts";

describe("PK-02 test families", () => {
  it("defines all 5 families and covers all 5 trigger frequencies", () => {
    expect(TEST_FAMILIES.map((f) => f.id)).toEqual([...TEST_FAMILY_IDS]);
    for (const freq of TEST_FREQUENCIES) {
      expect(familiesForFrequency(freq).length).toBeGreaterThan(0);
    }
    expect(getTestFamily("evidence_integrity").blocking_in_ci).toBe(true);
  });
});

describe("PK-02 3-tier reference sets & holdout access control", () => {
  it("partitions B1-B20 into dev (10), validation (5), and holdout (5)", () => {
    const splits = buildTierSplitsFromBaseline();
    expect(splits.dev.cases.map((c) => c.id)).toEqual([
      "B1",
      "B2",
      "B3",
      "B4",
      "B5",
      "B6",
      "B7",
      "B8",
      "B9",
      "B10",
    ]);
    expect(splits.validation.cases.map((c) => c.id)).toEqual(["B11", "B12", "B13", "B14", "B15"]);
    expect(splits.holdout.cases.map((c) => c.id)).toEqual(["B16", "B17", "B18", "B19", "B20"]);
    expect(loadDevReferenceSet().cases).toHaveLength(10);
  });

  it("blocks implementation_agent from reading holdout solutions and prompts", () => {
    expect(() => getReferenceSetSolutions("holdout", "implementation_agent")).toThrow(
      ReferenceSetAccessError,
    );
    expect(() => getReferenceSetSolutions("validation", "implementation_agent")).toThrow(
      ReferenceSetAccessError,
    );
    expect(() => getReferenceSetPrompts("holdout", "implementation_agent")).toThrow(
      ReferenceSetAccessError,
    );
    expect(() => evaluateHoldoutAggregate([], "implementation_agent", new Set())).toThrow(
      ReferenceSetAccessError,
    );

    // Dev solutions are readable by implementation_agent
    expect(getReferenceSetSolutions("dev", "implementation_agent").cases).toHaveLength(10);
  });

  it("returns aggregate-only holdout metrics to evaluator without leaking per-case answers", () => {
    const splits = buildTierSplitsFromBaseline();
    const known = new Set(["G-0024", "G-0014", "TL-0026", "TL-0035", "EXT-019"]);
    const answers = splits.holdout.cases.map((c) => ({
      id: c.id,
      text: c.expected_answer,
    }));

    const report = evaluateHoldoutAggregate(answers, "evaluator", known, {
      rotationId: "holdout-v1-epoch-1",
      evaluatedAt: "2026-11-25T00:00:00.000Z",
    });

    expect(report).toMatchObject({
      tier: "holdout",
      total_cases: 5,
      answered: 5,
      passed: 5,
      pass_rate: 1,
      abstention_rate: 0,
      forbidden_hits: 0,
      invented_ids: 0,
    });
    expect("rows" in report).toBe(false);
    expect("cases" in report).toBe(false);
  });

  it("tracks holdout rotation lifecycle", () => {
    const epoch1 = RotationRecordSchema.parse({
      rotation_id: "holdout-v1-epoch-1",
      tier: "holdout",
      active_since: "2026-11-01T00:00:00.000Z",
      rotated_at: null,
      status: "active",
      evaluations_count: 25,
      max_evaluations: 25,
      case_count: 5,
      contamination_risk: "low",
      reason: "Initial epoch",
    });
    expect(needsRotation(epoch1)).toBe(true);
    const { retired, active } = advanceRotation(
      epoch1,
      "holdout-v1-epoch-2",
      "Max evaluations reached",
      "2026-11-25T12:00:00.000Z",
    );
    expect(retired.status).toBe("retired");
    expect(retired.rotated_at).toBe("2026-11-25T12:00:00.000Z");
    expect(active.status).toBe("active");
    expect(active.evaluations_count).toBe(0);
    expect(needsRotation(active)).toBe(false);
  });
});

describe("PK-02 metrics, Cohen's kappa & D6 zero-tolerance gates", () => {
  it("computes precision, recall, F1, abstention, caveat preservation, and identity errors", () => {
    expect(computePrecision({ tp: 8, fp: 2, tn: 5, fn: 1 })).toBe(0.8);
    expect(computeRecall({ tp: 8, fp: 2, tn: 5, fn: 2 })).toBe(0.8);
    expect(computePrecision({ tp: 0, fp: 0, tn: 5, fn: 0 })).toBe(0);

    const summary = summarizeQualityMetrics({ tp: 9, fp: 1, tn: 4, fn: 1 }, [
      {
        case_id: "B1",
        abstained: false,
        unsupported_attributions: 0,
        caveat_required: true,
        caveat_preserved: true,
        identity_errors: 0,
      },
      {
        case_id: "B2",
        abstained: true,
        unsupported_attributions: 1,
        caveat_required: true,
        caveat_preserved: false,
        identity_errors: 1,
      },
    ]);
    expect(summary.precision).toBe(0.9);
    expect(summary.recall).toBe(0.9);
    expect(summary.f1).toBe(0.9);
    expect(summary.abstention_rate).toBe(0.5);
    expect(summary.unsupported_attributions_count).toBe(1);
    expect(summary.caveat_preservation_rate).toBe(0.5);
    expect(summary.identity_errors_count).toBe(1);
  });

  it("computes inter-model Cohen's kappa and rejects ground-truth comparisons", () => {
    const res = computeCohensKappa({
      model_a: "gpt-5",
      model_b: "claude-sonnet",
      ratings_a: ["pass", "pass", "fail", "abstain", "pass"],
      ratings_b: ["pass", "pass", "fail", "abstain", "fail"],
    });
    expect(res.observed_agreement).toBe(0.8);
    expect(res.kappa).toBeGreaterThan(0.6);

    expect(() =>
      computeCohensKappa({
        model_a: "gpt-5",
        model_b: "ground_truth",
        ratings_a: ["pass"],
        ratings_b: ["pass"],
      }),
    ).toThrow(/inter-model agreement/i);

    expect(() =>
      computeCohensKappa({
        model_a: "gpt-5",
        model_b: "gpt-5",
        ratings_a: ["pass"],
        ratings_b: ["pass"],
      }),
    ).toThrow(/distinct model/i);
  });

  it("enforces all 7 zero-tolerance D6 blocking gates", () => {
    const clean = evaluateD6Gates({
      withheld_leaks: 0,
      invalid_canonical_refs: 0,
      forbidden_inferences_in_regression: 0,
      human_review_status_by_agent: 0,
      lost_critical_caveats: 0,
      unauthorized_contract_regressions: 0,
      severe_a11y_errors: 0,
    });
    expect(clean.passed).toBe(true);
    expect(clean.blockers).toEqual([]);

    for (const gateId of D6_GATE_IDS) {
      const failingInput = {
        withheld_leaks: 0,
        invalid_canonical_refs: 0,
        forbidden_inferences_in_regression: 0,
        human_review_status_by_agent: 0,
        lost_critical_caveats: 0,
        unauthorized_contract_regressions: 0,
        severe_a11y_errors: 0,
        [gateId]: 1,
      };
      const res = evaluateD6Gates(failingInput);
      expect(res.passed).toBe(false);
      expect(res.blockers).toEqual([gateId]);
    }
  });
});

describe("PK-02 two-plane discovery evaluation", () => {
  it("evaluates ex-ante quality and ex-post yield including useful refutations", () => {
    const report = evaluateDiscovery([
      {
        id: "DISC-1",
        pertinence: 0.9,
        novelty: 0.8,
        verifiability: 1.0,
        justification: 0.9,
        resolution: "confirmed_integrated",
      },
      {
        id: "DISC-2",
        pertinence: 0.8,
        novelty: 0.7,
        verifiability: 0.9,
        justification: 0.8,
        resolution: "useful_refutation",
      },
      {
        id: "DISC-3",
        pertinence: 0.5,
        novelty: 0.4,
        verifiability: 0.5,
        justification: 0.4,
        resolution: "inconclusive",
      },
      {
        id: "DISC-4",
        pertinence: 0.8,
        novelty: 0.9,
        verifiability: 0.8,
        justification: 0.8,
        resolution: "pending",
      },
    ]);

    expect(report.ex_ante.total_proposals).toBe(4);
    expect(report.ex_ante.composite_score).toBeGreaterThan(0.7);
    expect(report.ex_post.resolved_count).toBe(3);
    expect(report.ex_post.informative_resolutions).toBe(2);
    expect(report.ex_post.useful_refutations).toBe(1);
    expect(report.ex_post.yield_rate).toBeCloseTo(2 / 3, 3);
    expect(report.ex_post.refutation_share).toBe(0.5);
  });
});

describe("PK-02 visual audit & report generation", () => {
  it("specifies 375/768/1440 px and light/dark budgets for every page type", () => {
    expect(PLAYWRIGHT_LIGHTHOUSE_CI_SPEC.viewports_px).toEqual([375, 768, 1440]);
    expect(PLAYWRIGHT_LIGHTHOUSE_CI_SPEC.themes).toEqual(["light", "dark"]);
    expect(PLAYWRIGHT_LIGHTHOUSE_CI_SPEC.matrix_count).toBe(PAGE_VISUAL_BUDGETS.length * 3 * 2);
  });

  it("flags severe static HTML accessibility errors and passes valid HTML", () => {
    const bad = checkHtmlDocument(
      '<html><head><title></title></head><body><img src="x.png"><button tabindex="2">Go</button></body></html>',
      "bad.html",
    );
    const rules = bad.map((i) => i.rule);
    expect(rules).toContain("html-has-lang");
    expect(rules).toContain("meta-viewport");
    expect(rules).toContain("document-title");
    expect(rules).toContain("landmark-one-main");
    expect(rules).toContain("image-alt");
    expect(rules).toContain("tabindex-positive");

    const good = checkHtmlDocument(
      '<!doctype html><html lang="it"><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Test</title></head><body><main><h1>Title</h1><img src="x.png" alt="desc"></main></body></html>',
      "good.html",
    );
    expect(good).toEqual([]);
  });

  it("audits web/dist when built and generates schema-valid quality report", () => {
    const distDir = path.join(REPO_ROOT, "web/dist");
    const visual = runStaticHtmlAudit(distDir);
    if (existsSync(distDir)) {
      expect(visual.built).toBe(true);
      expect(visual.pages_scanned).toBeGreaterThan(0);
      expect(visual.severe_errors).toBe(0);
    }

    const tmpDir = path.join(REPO_ROOT, "docs/quality/reports/.tmp-test");
    mkdirSync(tmpDir, { recursive: true });
    try {
      const report = generateQualityReport();
      const parsed = QualityReportSchema.parse(report);
      expect(parsed.d6_gates.passed).toBe(true);
      expect(parsed.test_families).toHaveLength(5);

      const outFile = path.join(tmpDir, "report.json");
      writeFileSync(outFile, JSON.stringify(parsed));
      expect(JSON.parse(readFileSync(outFile, "utf8"))).toMatchObject({
        report_version: 1,
        d6_gates: { passed: true },
      });
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
