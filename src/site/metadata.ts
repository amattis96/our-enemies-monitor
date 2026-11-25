import { createHash } from "node:crypto";
import type { ExportCommit, ExportFile } from "./exports.ts";

export type FileMetadata = {
  file: string;
  data_version: string;
  snapshot: {
    commit: string | null;
    commit_date: string | null;
  };
  license: {
    spdx: string;
    url: string;
    scope_note: string;
  };
  canonical_language: "it";
  usage_caveat: string;
  schema: string | null;
  format: "json" | "csv" | "unknown";
  bytes: number;
  sha256: string;
};

const LICENSE_INFO = {
  spdx: "CC0-1.0",
  url: "https://creativecommons.org/publicdomain/zero/1.0/",
  scope_note:
    "Project-original data; cited third-party material keeps its own rights. See LICENSE-DATA.md.",
} as const;

const SCHEMA_BY_FILE: Record<string, string | null> = {
  "events.json": "schemas/events.schema.json",
  "entities.json": "schemas/entities.schema.json",
  "relationships.json": "schemas/relationships.schema.json",
  "hypotheses.json": "schemas/hypotheses.schema.json",
  "sources.json": "schemas/sources.schema.json",
  "exposures.json": "schemas/exposures.schema.json",
};

const CAVEAT_BY_FILE: Record<string, string> = {
  "relationships.json":
    "Public projection only: withheld records are omitted, imported_unreviewed records are provisional, evidence_level indicates kind of basis (not a ranking), and Italian text is canonical.",
  "relationships.csv":
    "Public projection only (RFC 4180, UTF-8 with BOM, lists joined with ';'): restricted named-person relationships withhold predicate and caveat; imported_unreviewed records are provisional; Italian columns are canonical.",
  "hypotheses.json":
    "Open verification questions (E5), not established facts. Legacy hypotheses retain only public event links and original citations; unreviewed notes are omitted.",
  "hypotheses.csv":
    "Open verification questions (E5), not established facts. Italian columns are canonical.",
  "exposures.json":
    "Quantified strategic dependencies; values from different universes or denominators are not comparable without reading scope and qualifiers.",
  "withheld.json":
    "Registry of withheld IDs, collections and generic reasons only; an ID absent from the portal may be withheld or nonexistent.",
};

const DEFAULT_USAGE_CAVEAT =
  "Public projection of canonical data: withheld records are excluded, imported_unreviewed records are provisional rather than independently verified, evidence levels are kinds of basis (not a ranking), and Italian text is canonical.";

export function schemaForExportFile(filePath: string): string | null {
  if (filePath in SCHEMA_BY_FILE) return SCHEMA_BY_FILE[filePath] ?? null;
  if (filePath.endsWith(".schema.json")) return filePath;
  return null;
}

export function usageCaveatForExportFile(filePath: string): string {
  if (filePath in CAVEAT_BY_FILE) return CAVEAT_BY_FILE[filePath] ?? DEFAULT_USAGE_CAVEAT;
  if (filePath.endsWith(".csv")) {
    return "Public projection (RFC 4180, UTF-8 with BOM, lists joined with ';'): imported_unreviewed records are provisional, and Italian columns are canonical.";
  }
  return DEFAULT_USAGE_CAVEAT;
}

export function buildFileMetadata(
  file: ExportFile,
  exportVersion: string,
  commit: ExportCommit,
): FileMetadata {
  const format = file.path.endsWith(".json")
    ? "json"
    : file.path.endsWith(".csv")
      ? "csv"
      : "unknown";
  return {
    file: file.path,
    data_version: exportVersion,
    snapshot: {
      commit: commit.commit,
      commit_date: commit.commit_date,
    },
    license: { ...LICENSE_INFO },
    canonical_language: "it",
    usage_caveat: usageCaveatForExportFile(file.path),
    schema: schemaForExportFile(file.path),
    format,
    bytes: Buffer.byteLength(file.text),
    sha256: createHash("sha256").update(file.text).digest("hex"),
  };
}

export function buildMetadataFiles(
  files: readonly ExportFile[],
  exportVersion: string,
  commit: ExportCommit,
): ExportFile[] {
  return files
    .filter((file) => !file.path.endsWith(".metadata.json"))
    .map((file) => ({
      path: `${file.path}.metadata.json`,
      text: `${JSON.stringify(buildFileMetadata(file, exportVersion, commit), null, 2)}\n`,
    }));
}
