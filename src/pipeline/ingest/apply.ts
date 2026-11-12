import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { COLLECTION_NAMES } from "../../model/index.ts";
import type { DataFile } from "../load.ts";
import { DATA_DIR } from "../paths.ts";
import { serializeRecord } from "../serialize.ts";
import { type Issue, validateDataFiles } from "../validate.ts";
import type { IngestPlan } from "./plan.ts";

/** The data files after the plan, in canonical form. */
export function plannedFiles(plan: IngestPlan, files: DataFile[]): DataFile[] {
  const byPath = new Map(files.map((file) => [file.path, file]));
  for (const write of plan.writes) {
    byPath.set(write.path, {
      collection: write.collection,
      path: write.path,
      text: serializeRecord(write.record),
    });
  }
  // Same order as readDataFiles: collection order, then file name.
  return [...byPath.values()].sort(
    (a, b) =>
      COLLECTION_NAMES.indexOf(a.collection) - COLLECTION_NAMES.indexOf(b.collection) ||
      (a.path < b.path ? -1 : a.path > b.path ? 1 : 0),
  );
}

/**
 * Validate the dataset as it would be after the plan. Errors anywhere block
 * the write; warnings are reported only for records the plan touches.
 */
export function checkPlan(plan: IngestPlan, files: DataFile[]): Issue[] {
  const touched = new Set(plan.writes.map((write) => write.path));
  return validateDataFiles(plannedFiles(plan, files)).issues.filter(
    (issue) => issue.severity === "error" || touched.has(issue.file),
  );
}

/** Write the planned records into `dataDir`; returns the paths whose bytes changed. */
export function applyPlan(plan: IngestPlan, dataDir = DATA_DIR): string[] {
  if (plan.fatal.length > 0) throw new Error(`blocked plan: ${plan.fatal.join("; ")}`);
  const changed: string[] = [];
  for (const write of plan.writes) {
    const target = path.join(dataDir, write.path);
    const text = serializeRecord(write.record);
    if (existsSync(target) && readFileSync(target, "utf8") === text) continue;
    writeFileSync(target, text);
    changed.push(write.path);
  }
  return changed;
}
