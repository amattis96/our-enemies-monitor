import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { repoPath } from "../pipeline/paths.ts";
import { containsSecret, minimizeRunManifest } from "./minimize.ts";
import { type RunManifest, RunManifestSchema } from "./schema.ts";

/**
 * Run manifests are stored in the single public repository (PK-08, D1), one
 * file per run: `docs/runs/manifests/<run_id>.json`. The store is
 * append-only: a run is recorded once; re-recording identical content is a
 * no-op, different content for an existing run is refused, so concurrent
 * writers never overwrite each other. Recording needs no extra
 * infrastructure: the file reaches `main` through an `agent/runs-*` PR.
 */
export const DEFAULT_RUN_MANIFESTS_DIR = repoPath("docs/runs/manifests");

/** File name for a run: the run_id restricted to a safe character set. */
export function runManifestFileName(runId: string): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/.test(runId)) {
    throw new Error(
      `run_id "${runId}" must match [A-Za-z0-9][A-Za-z0-9._-]* to be stored as a file name`,
    );
  }
  return `${runId}.json`;
}

export function serializeRunManifest(manifest: RunManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

export type RecordResult = { path: string; status: "written" | "unchanged" };

/** Minimize, validate and write a manifest; refuse to overwrite a different one. */
export function recordRunManifest(
  input: RunManifest,
  dir: string = DEFAULT_RUN_MANIFESTS_DIR,
): RecordResult {
  const manifest = minimizeRunManifest(input);
  const filePath = path.join(dir, runManifestFileName(manifest.run_id));
  const text = serializeRunManifest(manifest);
  if (existsSync(filePath)) {
    if (readFileSync(filePath, "utf8") === text) return { path: filePath, status: "unchanged" };
    throw new Error(
      `run manifest ${manifest.run_id} already exists with different content; manifests are append-only`,
    );
  }
  mkdirSync(dir, { recursive: true });
  writeFileSync(filePath, text, { encoding: "utf8", flag: "wx" });
  return { path: filePath, status: "written" };
}

export type RunStoreIssue = { file: string; message: string };

/** Load every stored manifest and report contract violations (never throws). */
export function loadRunManifests(dir: string = DEFAULT_RUN_MANIFESTS_DIR): {
  manifests: RunManifest[];
  issues: RunStoreIssue[];
} {
  const manifests: RunManifest[] = [];
  const issues: RunStoreIssue[] = [];
  if (!existsSync(dir)) return { manifests, issues };
  const seen = new Set<string>();
  for (const name of readdirSync(dir).sort()) {
    if (!name.endsWith(".json")) continue;
    const file = path.join(dir, name);
    const raw = readFileSync(file, "utf8");
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      issues.push({ file: name, message: `invalid JSON: ${(error as Error).message}` });
      continue;
    }
    const result = RunManifestSchema.safeParse(parsed);
    if (!result.success) {
      issues.push({ file: name, message: result.error.issues[0]?.message ?? "invalid manifest" });
      continue;
    }
    const manifest = result.data;
    if (name !== runManifestFileName(manifest.run_id)) {
      issues.push({ file: name, message: `file name must be ${manifest.run_id}.json` });
    }
    if (seen.has(manifest.run_id)) {
      issues.push({ file: name, message: `duplicate run_id ${manifest.run_id}` });
    }
    seen.add(manifest.run_id);
    if (containsSecret(raw)) {
      issues.push({
        file: name,
        message: "contains a credential or token; minimize before storing",
      });
    }
    if (raw !== serializeRunManifest(minimizeRunManifest(manifest))) {
      issues.push({ file: name, message: "not in minimized canonical form; use pnpm runs:record" });
    }
    manifests.push(manifest);
  }
  return { manifests, issues };
}
