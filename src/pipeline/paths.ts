import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Repository root: the nearest ancestor containing `sources/original`. Found
 * by walking up (not a fixed relative path) because the site build bundles
 * this module into another directory. `OEM_REPO_ROOT` overrides it.
 */
function findRepoRoot(): string {
  if (process.env.OEM_REPO_ROOT) return path.resolve(process.env.OEM_REPO_ROOT);
  for (const start of [path.dirname(fileURLToPath(import.meta.url)), process.cwd()]) {
    let dir = start;
    while (true) {
      if (existsSync(path.join(dir, "sources", "original"))) return dir;
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  throw new Error("Repository root not found (no sources/original in any parent directory)");
}

export const REPO_ROOT = findRepoRoot();
export const DATA_DIR = path.join(REPO_ROOT, "data");
export const SCHEMAS_DIR = path.join(REPO_ROOT, "schemas");

/** Absolute path of a repository-relative path such as `sources/original/x.csv`. */
export function repoPath(relative: string): string {
  return path.join(REPO_ROOT, ...relative.split("/"));
}
