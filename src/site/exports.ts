import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { COLLECTION_NAMES, type Dataset } from "../model/index.ts";
import { REPO_ROOT, SCHEMAS_DIR } from "../pipeline/paths.ts";
import { summarize } from "../pipeline/validate.ts";
import { type PublicationReport, publicationReport } from "./publication.ts";
import { buildReadModel, evidenceGraph, hypothesisGraph } from "./read-model.ts";
import { type ArchivedResearch, archivedResearch } from "./research.ts";
import { buildVocabulary } from "./vocabulary.ts";

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

/** Commit identity of the export: derived from Git, never from the wall clock. */
export type ExportCommit = { commit: string | null; commit_date: string | null };

let cachedCommit: ExportCommit | undefined;
export function exportCommit(): ExportCommit {
  cachedCommit ??= {
    commit: gitValue(["rev-parse", "HEAD"]) ?? process.env.GITHUB_SHA ?? null,
    commit_date: gitValue(["log", "-1", "--format=%cI"]),
  };
  return cachedCommit;
}

const LICENSE = "CC0-1.0 (project-original data); see LICENSE-DATA.md";

/** Latest start date of a public `event` record (dataset metadata excluded). */
export function latestPublicEventDate(dataset: Dataset): string | null {
  return (
    dataset.events
      .filter((e) => e.record_type === "event")
      .map((e) => e.date.start)
      .sort()
      .at(-1) ?? null
  );
}

/**
 * Catalog (`index.json`): what the export is, how fresh it is at three
 * distinct dates, and how much of the canonical data it publishes. Every value
 * derives from the commit, the public projection and the committed archive.
 */
export function buildCatalog(
  report: PublicationReport,
  commit: ExportCommit,
  archive: readonly ArchivedResearch[],
) {
  const dataset = report.dataset;
  const latest = archive.find((item) => item.kind === "incremental");
  return {
    name: "Our Enemies Monitor — public projection of the canonical data",
    export_version: EXPORT_VERSION,
    commit: commit.commit,
    license: {
      spdx: "CC0-1.0",
      url: "https://creativecommons.org/publicdomain/zero/1.0/",
      scope_note:
        "Project-original data; cited third-party material keeps its own rights. See LICENSE-DATA.md.",
    },
    canonical_language: "it",
    translation_rule:
      "Italian text is canonical and prevails on divergence; each record states its English translation status in review.translations.en.",
    freshness: {
      commit_date: commit.commit_date,
      latest_public_event_date: latestPublicEventDate(dataset),
      latest_archived_source: latest
        ? {
            id: latest.id,
            kind: latest.kind,
            created_at: latest.createdAt,
            in_public_sources: dataset.sources.some((s) => s.id === latest.id),
          }
        : null,
      note: "commit_date is the date of the exported commit; latest_public_event_date is the latest start date of a published event record (dataset metadata excluded); latest_archived_source is the newest committed incremental source (thematic documents excluded), which does not by itself add canonical records; in_public_sources says whether its source record is published.",
    },
    projection: {
      published: Object.fromEntries(COLLECTION_NAMES.map((name) => [name, dataset[name].length])),
      withheld: report.counts,
      withheld_registry: "withheld.json",
    },
    read_first: ["vocabulary.json"],
    manifest: "manifest.json",
    datasets: [
      ...COLLECTION_NAMES.map((name) => ({
        path: `${name}.json`,
        schema: `schemas/${name}.schema.json`,
      })),
      { path: "all.json", schema: null },
      { path: "graph.json", schema: null },
      { path: "hypotheses-graph.json", schema: null },
      { path: "withheld.json", schema: null },
    ],
  };
}

const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

export function exportFiles(
  input: Dataset | PublicationReport,
  commit: ExportCommit = exportCommit(),
  archive: readonly ArchivedResearch[] = archivedResearch(),
): ExportFile[] {
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
    { path: "index.json", text: json(buildCatalog(report, commit, archive)) },
    { path: "vocabulary.json", text: json(buildVocabulary()) },
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

export function buildManifest(
  input: Dataset | PublicationReport,
  files: ExportFile[],
  commit: ExportCommit = exportCommit(),
): Manifest {
  const report = reportOf(input);
  return {
    export_version: EXPORT_VERSION,
    license: LICENSE,
    commit: commit.commit,
    commit_date: commit.commit_date,
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
