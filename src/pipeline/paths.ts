import path from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const DATA_DIR = path.join(REPO_ROOT, "data");
export const SCHEMAS_DIR = path.join(REPO_ROOT, "schemas");

/** Absolute path of a repository-relative path such as `sources/original/x.csv`. */
export function repoPath(relative: string): string {
  return path.join(REPO_ROOT, ...relative.split("/"));
}
