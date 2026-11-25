import { describe, expect, it } from "vitest";
import {
  collectOperationalUnits,
  detectActiveWorkOverlaps,
  loadActiveWork,
  loadProgressMap,
  loadRoadmapPlan,
  validateRoadmap,
} from "../src/roadmap/index.ts";
import { renderRoadmapStatusTable, renderRoadmapSummary } from "../src/roadmap/render.ts";
import {
  type ActiveWorkFile,
  type PackageProgress,
  type RoadmapPlan,
  RoadmapPlanSchema,
} from "../src/roadmap/schema.ts";

const plan = loadRoadmapPlan();
const progressMap = loadProgressMap();
const activeWork = loadActiveWork();

function clonePlan(): RoadmapPlan {
  return structuredClone(plan);
}

function cloneProgressMap(): Map<string, PackageProgress> {
  const copy = new Map<string, PackageProgress>();
  for (const [key, value] of progressMap) {
    copy.set(key, structuredClone(value));
  }
  return copy;
}

function initialProgressMap(): Map<string, PackageProgress> {
  const copy = cloneProgressMap();
  for (const id of ["PK-00", "PK-02", "PK-03", "PK-04", "PK-05", "PK-15A"]) {
    const entry = copy.get(id);
    if (!entry) continue;
    entry.status = "eligible";
    entry.linked_prs = [];
    entry.runs = [];
    entry.test_results = [];
    entry.completion_evidence = [];
    delete entry.notes;
  }
  for (const id of [
    "PK-01",
    "PK-06A",
    "PK-06B",
    "PK-06C",
    "PK-06D",
    "PK-07",
    "PK-08",
    "PK-09",
    "PK-10",
    "PK-11",
    "PK-12",
    "PK-13",
    "PK-14",
    "PK-16",
    "PK-17",
    "PK-18",
    "PK-19",
    "PK-20",
    "PK-21",
    "PK-22",
    "PK-23",
    "PK-24",
    "PK-25",
    "PK-25-CAL",
    "PK-26",
    "PK-27",
    "PK-28",
    "PK-29",
    "PK-30",
    "PK-31",
    "PK-33",
    "PK-34",
    "PK-35",
    "PK-36",
    "PK-37",
    "PK-38",
  ]) {
    const entry = copy.get(id);
    if (!entry) continue;
    entry.status = "blocked";
    entry.linked_prs = [];
    entry.runs = [];
    entry.test_results = [];
    entry.completion_evidence = [];
    delete entry.notes;
  }
  return copy;
}

describe("Executable roadmap (PK-00)", () => {
  it("validates plan.v1.json against RoadmapPlanSchema and covers all 140 items", () => {
    const parsed = RoadmapPlanSchema.parse(plan);
    expect(parsed.packages).toHaveLength(39);
    expect(parsed.decisions).toHaveLength(14);
    expect(parsed.milestones).toHaveLength(6);

    const units = collectOperationalUnits(parsed);
    expect(units).toHaveLength(44);

    const covered = new Set<number>();
    for (const pkg of parsed.packages) {
      for (const item of pkg.items) covered.add(item);
      for (const sub of pkg.subpackages ?? []) {
        for (const item of sub.items) covered.add(item);
      }
    }
    for (const parked of parsed.parked_items) {
      covered.add(parked.item);
    }
    for (let i = 1; i <= 140; i++) {
      expect(covered.has(i), `missing item ${i}`).toBe(true);
    }
  });

  it("passes validation for live progressMap and computes initial eligible packages on fresh state", () => {
    const liveResult = validateRoadmap(plan, progressMap, activeWork);
    expect(liveResult.errors).toEqual([]);

    const freshPm = initialProgressMap();
    const result = validateRoadmap(plan, freshPm, activeWork);
    expect(result.errors).toEqual([]);
    // Owner decision 26 November 2026 (D1, D12, D14 resolved; single public
    // repository): PK-01 can start (D13 is needed only to complete it), and
    // PK-08 and the PK-25 calendar no longer wait on a private repository.
    expect(result.computedStatuses.get("PK-01")).toBe("eligible");
    expect(result.computedStatuses.get("PK-09")).toBe("blocked");
    expect(result.computedStatuses.get("PK-15B")).toBe("blocked");
    expect(result.computedStatuses.get("PK-32")).toBe("deferred");
    expect(result.eligible).toEqual([
      "PK-00",
      "PK-01",
      "PK-02",
      "PK-03",
      "PK-04",
      "PK-05",
      "PK-08",
      "PK-15A",
      "PK-25-CAL",
    ]);
  });

  it("detects circular dependencies as structural errors", () => {
    const p = clonePlan();
    const pk03 = p.packages.find((pkg) => pkg.id === "PK-03");
    const pk04 = p.packages.find((pkg) => pkg.id === "PK-04");
    if (!pk03 || !pk04) throw new Error("Missing PK-03 or PK-04");
    pk03.dependencies.requires.push("PK-04");
    pk04.dependencies.requires.push("PK-03");

    const result = validateRoadmap(p, progressMap, activeWork);
    expect(result.errors.some((e) => e.code === "circular_dependency")).toBe(true);
  });

  it("detects uncovered items (1-140) as structural errors", () => {
    const p = clonePlan();
    const pk08 = p.packages.find((pkg) => pkg.id === "PK-08");
    if (!pk08) throw new Error("Missing PK-08");
    pk08.items = pk08.items.filter((item) => item !== 135);

    const result = validateRoadmap(p, progressMap, activeWork);
    const err = result.errors.find((e) => e.code === "uncovered_items");
    expect(err).toBeDefined();
    expect(err?.message).toContain("135");
  });

  it("detects missing dependency references as structural errors", () => {
    const p = clonePlan();
    const pk03 = p.packages.find((pkg) => pkg.id === "PK-03");
    if (!pk03) throw new Error("Missing PK-03");
    pk03.dependencies.requires.push("PK-99");

    const result = validateRoadmap(p, progressMap, activeWork);
    expect(result.errors.some((e) => e.code === "missing_dependency")).toBe(true);
  });

  it("warns on active-work.json overlaps without hard-blocking", () => {
    const work: ActiveWorkFile = {
      updated_at: "2026-11-25T10:00:00Z",
      entries: [
        {
          package_id: "PK-03",
          agent_id: "agent-a",
          work_areas: ["src/pipeline/"],
          base_commit: "c150732",
          started_at: "2026-11-25T09:00:00Z",
        },
        {
          package_id: "PK-05",
          agent_id: "agent-b",
          work_areas: ["src/pipeline/validate.ts"],
          base_commit: "c150732",
          started_at: "2026-11-25T09:30:00Z",
        },
      ],
    };

    const overlaps = detectActiveWorkOverlaps(work);
    expect(overlaps).toHaveLength(1);
    expect(overlaps[0]?.packageA).toBe("PK-03");
    expect(overlaps[0]?.packageB).toBe("PK-05");

    const result = validateRoadmap(plan, progressMap, work);
    expect(result.errors).toEqual([]);
    expect(result.warnings.some((w) => w.code === "work_area_overlap")).toBe(true);
  });

  it("supports operational progress updates and subpackage unlocking without modifying plan.v1.json", () => {
    const p = clonePlan();
    const pm = initialProgressMap();

    const complete = (id: string, prNumber: number) => {
      const entry = pm.get(id);
      if (!entry) throw new Error(`Missing progress ${id}`);
      entry.status = "completed";
      entry.linked_prs.push({
        number: prNumber,
        title: `${id}: complete`,
        merged_at: "2026-11-26T12:00:00Z",
      });
      entry.test_results.push({
        command: "pnpm test",
        passed: true,
        recorded_at: "2026-11-26T11:55:00Z",
      });
      entry.completion_evidence.push("Verified in CI");
    };

    // Completing PK-04, PK-05, and resolving D2 unlocks PK-06A..PK-06D
    complete("PK-04", 101);
    complete("PK-05", 102);
    const d2 = p.decisions.find((d) => d.id === "D2");
    if (!d2) throw new Error("Missing D2");
    d2.status = "resolved";
    d2.resolution = "Confirmed ADR-06";

    const mid = validateRoadmap(p, pm, activeWork);
    expect(mid.errors).toEqual([]);
    expect(mid.eligible).toContain("PK-06A");
    expect(mid.eligible).toContain("PK-06B");
    expect(mid.eligible).toContain("PK-06C");
    expect(mid.eligible).toContain("PK-06D");
    expect(mid.computedStatuses.get("PK-07")).toBe("blocked");

    // Completing PK-06B while PK-06D is in_progress unlocks PK-07
    complete("PK-06B", 103);
    const pk06d = pm.get("PK-06D");
    if (!pk06d) throw new Error("Missing PK-06D");
    pk06d.status = "in_progress";

    const after = validateRoadmap(p, pm, activeWork);
    expect(after.errors).toEqual([]);
    expect(after.eligible).toContain("PK-07");
  });

  it("rejects completed status when merged PR/run, test result, or evidence is missing", () => {
    const pm = initialProgressMap();
    const pk00 = pm.get("PK-00");
    if (!pk00) throw new Error("Missing PK-00");
    pk00.status = "completed";

    const result = validateRoadmap(plan, pm, activeWork);
    expect(result.errors.some((e) => e.code === "incomplete_evidence")).toBe(true);
  });

  it("rejects completed status while an owner decision or awaiting_acceptance dependency is open", () => {
    const pm = cloneProgressMap();
    const evidence = (id: string) => {
      const entry = pm.get(id);
      if (!entry) throw new Error(`Missing progress ${id}`);
      entry.status = "completed";
      entry.runs = [{ run_id: "r", recorded_at: "2026-11-26T12:00:00Z", outcome: "ok" }];
      entry.test_results = [
        { command: "pnpm test", passed: true, recorded_at: "2026-11-26T12:00:00Z" },
      ];
      entry.completion_evidence = ["verified"];
    };
    // PK-06A requires D2 (open): code delivered does not make it completed.
    evidence("PK-06A");
    // PK-19 requires PK-02, which is only awaiting acceptance.
    const pk02 = pm.get("PK-02");
    if (!pk02) throw new Error("Missing PK-02");
    pk02.status = "awaiting_acceptance";
    evidence("PK-19");

    const result = validateRoadmap(plan, pm, activeWork);
    const flagged = result.errors
      .filter((e) => e.code === "inconsistent_status")
      .map((e) => e.target);
    expect(flagged).toContain("PK-06A");
    expect(flagged).toContain("PK-19");
  });

  it("renders Markdown status table and summary", () => {
    const freshPm = initialProgressMap();
    const result = validateRoadmap(plan, freshPm, activeWork);
    const table = renderRoadmapStatusTable(plan, freshPm, result.computedStatuses);
    expect(table).toContain(
      "| PK | Pacchetto | M | Sforzo | Ricorrente | Impatto | Richiede | Stato |",
    );
    expect(table).toContain("| 00 | Piano eseguibile e controllo della roadmap |");
    expect(table).toContain("| 01 | Sicurezza, identità, confine e gateway di pubblicazione |");

    const summary = renderRoadmapSummary(plan, freshPm, result.computedStatuses);
    expect(summary).toContain(
      "Pacchetti eligible (9): PK-00, PK-01, PK-02, PK-03, PK-04, PK-05, PK-08, PK-15A, PK-25-CAL",
    );
    expect(summary).toContain("Decisioni aperte (11):");
  });
});
