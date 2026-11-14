import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { COLLECTION_NAMES, type Dataset } from "../model/index.ts";
import { REPO_ROOT, SCHEMAS_DIR } from "../pipeline/paths.ts";
import { summarize } from "../pipeline/validate.ts";
import { type PublicationReport, publicationReport } from "./publication.ts";
import { buildReadModel, evidenceGraph, hypothesisGraph } from "./read-model.ts";

/**
 * Downloadable data exports published under `data/v1/`. Content is
 * deterministic for a given commit (no build timestamps), so a mirror built
 * from the same commit publishes byte-identical files and digests.
 */
export type ExportFile = { path: string; text: string };

export const EXPORT_VERSION = "v1";

function reportOf(input: Dataset | PublicationReport): PublicationReport {
  return "kind" in input ? input : publicationReport(input);
}

export function exportFiles(input: Dataset | PublicationReport): ExportFile[] {
  const report = reportOf(input);
  const dataset = report.dataset;
  const collections = COLLECTION_NAMES.map((name) => ({
    path: `${name}.json`,
    text: `${JSON.stringify(dataset[name], null, 2)}\n`,
  }));
  const all = { path: "all.json", text: `${JSON.stringify(dataset, null, 2)}\n` };
  const model = buildReadModel(dataset);
  const graphs = [
    { path: "graph.json", text: JSON.stringify(evidenceGraph(model)) },
    { path: "hypotheses-graph.json", text: JSON.stringify(hypothesisGraph(model)) },
  ];
  const schemas = readdirSync(SCHEMAS_DIR)
    .filter((name) => name.endsWith(".schema.json"))
    .sort()
    .map((name) => ({
      path: `schemas/${name}`,
      text: readFileSync(path.join(SCHEMAS_DIR, name), "utf8"),
    }));
  return [
    ...collections,
    all,
    ...graphs,
    { path: "withheld.json", text: `${JSON.stringify(report.withheld, null, 2)}\n` },
    ...schemas,
  ];
}

export type Manifest = {
  export_version: string;
  license: string;
  commit: string | null;
  commit_date: string | null;
  counts: ReturnType<typeof summarize>;
  withheld: { counts: PublicationReport["counts"]; registry: string };
  files: { path: string; bytes: number; sha256: string }[];
};

export function buildManifest(input: Dataset | PublicationReport, files: ExportFile[]): Manifest {
  const report = reportOf(input);
  return {
    export_version: EXPORT_VERSION,
    license: "CC0-1.0 (project-original data); see LICENSE-DATA.md",
    commit: gitValue(["rev-parse", "HEAD"]) ?? process.env.GITHUB_SHA ?? null,
    commit_date: gitValue(["log", "-1", "--format=%cI"]),
    counts: summarize(report.dataset),
    withheld: { counts: report.counts, registry: "withheld.json" },
    files: files.map((file) => ({
      path: file.path,
      bytes: Buffer.byteLength(file.text),
      sha256: createHash("sha256").update(file.text).digest("hex"),
    })),
  };
}

function gitValue(args: string[]): string | null {
  try {
    return execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8" }).trim() || null;
  } catch {
    return null;
  }
}
