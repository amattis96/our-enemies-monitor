import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { repoPath } from "../pipeline/paths.ts";
import {
  type ActiveWorkEntry,
  type ActiveWorkFile,
  ActiveWorkFileSchema,
  type PackageProgress,
  PackageProgressSchema,
  type PackageStatus,
  type RoadmapPackage,
  type RoadmapPlan,
  RoadmapPlanSchema,
  type Subpackage,
} from "./schema.ts";

export const DEFAULT_PLAN_PATH = "docs/roadmap/plan.v1.json";
export const DEFAULT_PROGRESS_DIR = "docs/roadmap/progress";
export const DEFAULT_ACTIVE_WORK_PATH = "docs/roadmap/progress/active-work.json";

export type RoadmapUnit = RoadmapPackage | Subpackage;

export type RoadmapIssue = {
  severity: "error" | "warning";
  code: string;
  target: string;
  message: string;
};

export type OverlapWarning = {
  packageA: string;
  packageB: string;
  areaA: string;
  areaB: string;
  message: string;
};

export type ValidationResult = {
  errors: RoadmapIssue[];
  warnings: RoadmapIssue[];
  eligible: string[];
  computedStatuses: Map<string, PackageStatus>;
  overlaps: OverlapWarning[];
};

export function loadRoadmapPlan(planPath = repoPath(DEFAULT_PLAN_PATH)): RoadmapPlan {
  const raw = JSON.parse(readFileSync(planPath, "utf8")) as unknown;
  return RoadmapPlanSchema.parse(raw);
}

export function loadProgressMap(
  progressDir = repoPath(DEFAULT_PROGRESS_DIR),
): Map<string, PackageProgress> {
  const map = new Map<string, PackageProgress>();
  if (!existsSync(progressDir)) return map;
  for (const name of readdirSync(progressDir).sort()) {
    if (!name.startsWith("PK-") || !name.endsWith(".json")) continue;
    const raw = JSON.parse(readFileSync(path.join(progressDir, name), "utf8")) as unknown;
    const parsed = PackageProgressSchema.parse(raw);
    map.set(parsed.id, parsed);
  }
  return map;
}

export function loadActiveWork(
  activeWorkPath = repoPath(DEFAULT_ACTIVE_WORK_PATH),
): ActiveWorkFile {
  if (!existsSync(activeWorkPath)) {
    return { updated_at: "1970-01-01T00:00:00Z", entries: [] };
  }
  const raw = JSON.parse(readFileSync(activeWorkPath, "utf8")) as unknown;
  return ActiveWorkFileSchema.parse(raw);
}

/** Returns all executable units (packages without `subpackages_only` + all subpackages). */
export function collectOperationalUnits(plan: RoadmapPlan): RoadmapUnit[] {
  const units: RoadmapUnit[] = [];
  for (const pkg of plan.packages) {
    if (!pkg.subpackages_only) {
      units.push(pkg);
    }
    if (pkg.subpackages) {
      for (const sub of pkg.subpackages) {
        units.push(sub);
      }
    }
  }
  return units;
}

/**
 * Checks whether a dependency reference (`PK-XX`, `PK-XXY`, or `DX`) is satisfied
 * given the plan and current progress map.
 * A container package (like `PK-06`) is satisfied when all its subpackages are `completed`.
 */
export function isDependencySatisfied(
  ref: string,
  plan: RoadmapPlan,
  progressMap: Map<string, PackageProgress>,
): boolean {
  if (ref.startsWith("D")) {
    const decision = plan.decisions.find((d) => d.id === ref);
    return decision?.status === "resolved";
  }

  const parentPkg = plan.packages.find((p) => p.id === ref);
  if (parentPkg?.subpackages_only && parentPkg.subpackages && parentPkg.subpackages.length > 0) {
    return parentPkg.subpackages.every((sub) => progressMap.get(sub.id)?.status === "completed");
  }

  return progressMap.get(ref)?.status === "completed";
}

/** Computes effective status and eligible package IDs without mutating `plan.v1.json`. */
export function computeEligibility(
  plan: RoadmapPlan,
  progressMap: Map<string, PackageProgress>,
): { eligible: string[]; computedStatuses: Map<string, PackageStatus> } {
  const units = collectOperationalUnits(plan);
  const computedStatuses = new Map<string, PackageStatus>();
  const eligible: string[] = [];

  for (const unit of units) {
    const progress = progressMap.get(unit.id);
    const current = progress?.status;

    if (
      current === "completed" ||
      current === "in_progress" ||
      current === "scheduled" ||
      current === "awaiting_acceptance" ||
      current === "deferred" ||
      current === "not_applicable"
    ) {
      computedStatuses.set(unit.id, current);
      continue;
    }

    if (unit.initial_disposition === "deferred") {
      computedStatuses.set(unit.id, "deferred");
      continue;
    }

    const allRequiresMet = unit.dependencies.requires.every((dep) =>
      isDependencySatisfied(dep, plan, progressMap),
    );

    if (allRequiresMet) {
      computedStatuses.set(unit.id, "eligible");
      eligible.push(unit.id);
    } else {
      computedStatuses.set(unit.id, "blocked");
    }
  }

  return { eligible, computedStatuses };
}

function normalizeWorkArea(area: string): string {
  return area.replace(/\/\*+$/, "").replace(/\/+$/, "");
}

function areasOverlap(a: string, b: string): boolean {
  const na = normalizeWorkArea(a);
  const nb = normalizeWorkArea(b);
  if (na === nb) return true;
  if (na.startsWith(`${nb}/`) || nb.startsWith(`${na}/`)) return true;
  return false;
}

/** Detects overlapping `work_areas` among active work entries. Never hard-blocks. */
export function detectActiveWorkOverlaps(activeWork: ActiveWorkFile): OverlapWarning[] {
  const warnings: OverlapWarning[] = [];
  const entries: ActiveWorkEntry[] = activeWork.entries;
  for (let i = 0; i < entries.length; i++) {
    const a = entries[i];
    if (!a) continue;
    for (let j = i + 1; j < entries.length; j++) {
      const b = entries[j];
      if (!b) continue;
      for (const areaA of a.work_areas) {
        for (const areaB of b.work_areas) {
          if (areasOverlap(areaA, areaB)) {
            warnings.push({
              packageA: a.package_id,
              packageB: b.package_id,
              areaA,
              areaB,
              message: `Work area overlap between ${a.package_id} (${areaA}) and ${b.package_id} (${areaB}); rebase and re-validate before merge.`,
            });
          }
        }
      }
    }
  }
  return warnings;
}

/**
 * Validates structural consistency of the roadmap plan, progress files, and active work.
 * Open decisions do NOT produce errors; they simply keep affected packages `blocked`.
 */
export function validateRoadmap(
  plan: RoadmapPlan,
  progressMap: Map<string, PackageProgress>,
  activeWork?: ActiveWorkFile,
): ValidationResult {
  const errors: RoadmapIssue[] = [];
  const warnings: RoadmapIssue[] = [];

  const allPackageIds = new Set<string>();
  const unitMap = new Map<string, RoadmapUnit>();
  const decisionIds = new Set<string>(plan.decisions.map((d) => d.id));

  for (const pkg of plan.packages) {
    if (allPackageIds.has(pkg.id)) {
      errors.push({
        severity: "error",
        code: "duplicate_package_id",
        target: pkg.id,
        message: `Duplicate package ID: ${pkg.id}`,
      });
    }
    allPackageIds.add(pkg.id);
    if (!pkg.subpackages_only) {
      unitMap.set(pkg.id, pkg);
    }
    if (pkg.subpackages) {
      for (const sub of pkg.subpackages) {
        if (allPackageIds.has(sub.id)) {
          errors.push({
            severity: "error",
            code: "duplicate_package_id",
            target: sub.id,
            message: `Duplicate subpackage ID: ${sub.id}`,
          });
        }
        allPackageIds.add(sub.id);
        unitMap.set(sub.id, sub);
      }
    }
  }

  // 1. Check missing dependency references and acceptance criteria
  const allNodes: RoadmapUnit[] = [
    ...plan.packages,
    ...plan.packages.flatMap((p) => p.subpackages ?? []),
  ];
  for (const node of allNodes) {
    if (node.acceptance_criteria.length === 0) {
      errors.push({
        severity: "error",
        code: "missing_acceptance_criteria",
        target: node.id,
        message: `${node.id} is missing acceptance criteria`,
      });
    }

    const depGroups = [
      ...node.dependencies.requires,
      ...node.dependencies.to_complete,
      ...node.dependencies.to_activate,
      ...node.dependencies.extensions,
    ];
    for (const ref of depGroups) {
      const valid = ref.startsWith("D") ? decisionIds.has(ref) : allPackageIds.has(ref);
      if (!valid) {
        errors.push({
          severity: "error",
          code: "missing_dependency",
          target: node.id,
          message: `${node.id} references unknown dependency: ${ref}`,
        });
      }
    }
  }

  // 2. Cycle detection across requires, to_complete, to_activate
  const graph = new Map<string, string[]>();
  for (const node of allNodes) {
    const edges = [
      ...node.dependencies.requires,
      ...node.dependencies.to_complete,
      ...node.dependencies.to_activate,
    ].filter((ref) => !ref.startsWith("D") && allPackageIds.has(ref));
    graph.set(node.id, edges);
  }

  const visitState = new Map<string, "visiting" | "visited">();
  const stack: string[] = [];

  function dfs(id: string): void {
    const state = visitState.get(id);
    if (state === "visited") return;
    if (state === "visiting") {
      const cycleStart = stack.indexOf(id);
      const cycle = [...stack.slice(cycleStart), id].join(" -> ");
      errors.push({
        severity: "error",
        code: "circular_dependency",
        target: id,
        message: `Circular dependency detected: ${cycle}`,
      });
      return;
    }

    visitState.set(id, "visiting");
    stack.push(id);
    for (const next of graph.get(id) ?? []) {
      dfs(next);
    }
    stack.pop();
    visitState.set(id, "visited");
  }

  for (const node of allNodes) {
    if (!visitState.has(node.id)) {
      dfs(node.id);
    }
  }

  // 3. Check all 140 items (1..140) are covered
  const coveredItems = new Set<number>();
  for (const node of allNodes) {
    for (const item of node.items) coveredItems.add(item);
  }
  for (const parked of plan.parked_items) {
    coveredItems.add(parked.item);
  }

  const missingItems: number[] = [];
  for (let i = 1; i <= 140; i++) {
    if (!coveredItems.has(i)) missingItems.push(i);
  }
  if (missingItems.length > 0) {
    errors.push({
      severity: "error",
      code: "uncovered_items",
      target: "items",
      message: `Uncovered roadmap items (1-140): ${missingItems.join(", ")}`,
    });
  }

  // 4. Operational progress consistency checks
  for (const [id, unit] of unitMap) {
    const progress = progressMap.get(id);
    if (!progress) {
      errors.push({
        severity: "error",
        code: "missing_progress_file",
        target: id,
        message: `Missing operational progress file for ${id}`,
      });
      continue;
    }

    const requiresMet = unit.dependencies.requires.every((dep) =>
      isDependencySatisfied(dep, plan, progressMap),
    );

    if (
      (progress.status === "eligible" ||
        progress.status === "scheduled" ||
        progress.status === "in_progress" ||
        progress.status === "awaiting_acceptance") &&
      !requiresMet
    ) {
      errors.push({
        severity: "error",
        code: "inconsistent_status",
        target: id,
        message: `${id} has status '${progress.status}' while blocking 'requires' dependencies are unsatisfied`,
      });
    }

    if (progress.status === "completed") {
      const hasMergedPrOrRun =
        progress.linked_prs.some((pr) => pr.merged_at !== null) || progress.runs.length > 0;
      const hasPassingTest = progress.test_results.some((tr) => tr.passed);
      const hasEvidence = progress.completion_evidence.length > 0;
      const toCompleteMet = unit.dependencies.to_complete.every((dep) =>
        isDependencySatisfied(dep, plan, progressMap),
      );

      if (!requiresMet || !toCompleteMet) {
        errors.push({
          severity: "error",
          code: "inconsistent_status",
          target: id,
          message: `${id} is marked 'completed' but required/to_complete dependencies are unsatisfied`,
        });
      }
      if (!hasMergedPrOrRun || !hasPassingTest || !hasEvidence) {
        errors.push({
          severity: "error",
          code: "incomplete_evidence",
          target: id,
          message: `${id} is marked 'completed' without merged PR or recorded run, passing test result, and completion evidence`,
        });
      }
    }
  }

  // 5. Overlap warnings on active-work.json (never hard-blocks)
  const overlaps = activeWork ? detectActiveWorkOverlaps(activeWork) : [];
  for (const overlap of overlaps) {
    warnings.push({
      severity: "warning",
      code: "work_area_overlap",
      target: `${overlap.packageA},${overlap.packageB}`,
      message: overlap.message,
    });
  }

  const { eligible, computedStatuses } = computeEligibility(plan, progressMap);

  return {
    errors,
    warnings,
    eligible,
    computedStatuses,
    overlaps,
  };
}
