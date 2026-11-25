import { createHash } from "node:crypto";
import { readDataFiles } from "../pipeline/load.ts";
import { DATA_DIR } from "../pipeline/paths.ts";

export type DatasetFileInput = {
  path: string;
  text: string;
};

export type DatasetHashResult = {
  algorithm: "sha256";
  hash: string;
  fileCount: number;
  excludedPaths: string[];
  serializedBytes: number;
};

const EXCLUDED_PREFIXES = [
  "docs/snapshots/",
  "docs/roadmap/progress/",
  "docs/quality/reports/",
  ".git/",
  "node_modules/",
  "web/dist/",
  ".astro/",
];

const EXCLUDED_EXACT = new Set([
  "docs/snapshots",
  "docs/snapshots/index.json",
  "docs/roadmap/progress",
  "docs/quality/reports",
  "docs/roadmap/progress/active-work.json",
]);

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\/+/, "");
}

/**
 * Exclude snapshot registries, operational manifests, and build artifacts so
 * dataset hashes are never self-referential.
 */
export function isExcludedFromDatasetHash(filePath: string): boolean {
  const normalized = normalizePath(filePath);
  if (EXCLUDED_EXACT.has(normalized)) return true;
  if (EXCLUDED_PREFIXES.some((prefix) => normalized.startsWith(prefix))) return true;
  const base = normalized.split("/").pop() ?? normalized;
  if (base === "manifest.json" || base.endsWith(".manifest.json")) return true;
  return false;
}

/** Recursively sort object keys so JSON serialization is deterministic. */
export function canonicalizeValue(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(canonicalizeValue);
  const record = value as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  const keys = Object.keys(record).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  for (const key of keys) {
    const entry = record[key];
    if (entry !== undefined) sorted[key] = canonicalizeValue(entry);
  }
  return sorted;
}

/** Deterministic 2-space LF JSON serialization with sorted keys. */
export function canonicalizeJson(value: unknown): string {
  return `${JSON.stringify(canonicalizeValue(value), null, 2)}\n`;
}

/**
 * Produce the deterministic canonical byte-level serialization of a dataset,
 * excluding `docs/snapshots/` and operational manifests.
 */
export function canonicalDatasetSerialization(options?: {
  dataDir?: string;
  files?: readonly DatasetFileInput[];
}): { serialized: string; fileCount: number; excludedPaths: string[] } {
  const sourceFiles = options?.files ?? readDataFiles(options?.dataDir ?? DATA_DIR);
  const included: DatasetFileInput[] = [];
  const excludedPaths: string[] = [];

  for (const file of sourceFiles) {
    const normalized = normalizePath(file.path);
    if (isExcludedFromDatasetHash(normalized)) {
      excludedPaths.push(normalized);
    } else {
      included.push({ path: normalized, text: file.text });
    }
  }

  included.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  excludedPaths.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  const entries = included.map((file) => {
    if (file.path.endsWith(".json")) {
      return {
        path: file.path,
        content: canonicalizeValue(JSON.parse(file.text)),
      };
    }
    return {
      path: file.path,
      content: file.text,
    };
  });

  const serialized = canonicalizeJson(entries);
  return {
    serialized,
    fileCount: included.length,
    excludedPaths,
  };
}

/** Compute SHA-256 hash of a canonicalized JSON value. */
export function hashCanonical(value: unknown): string {
  return createHash("sha256").update(canonicalizeJson(value), "utf8").digest("hex");
}

/** Compute deterministic SHA-256 hash of the dataset. */
export function computeDatasetHash(options?: {
  dataDir?: string;
  files?: readonly DatasetFileInput[];
}): DatasetHashResult {
  const { serialized, fileCount, excludedPaths } = canonicalDatasetSerialization(options);
  const hash = createHash("sha256").update(serialized, "utf8").digest("hex");
  return {
    algorithm: "sha256",
    hash,
    fileCount,
    excludedPaths,
    serializedBytes: Buffer.byteLength(serialized, "utf8"),
  };
}

/** Convenience helper returning only the SHA-256 hex digest of the dataset. */
export function hashDataset(dataDir = DATA_DIR): string {
  return computeDatasetHash({ dataDir }).hash;
}
