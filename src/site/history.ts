import { execFileSync } from "node:child_process";
import { lstatSync } from "node:fs";
import path from "node:path";
import type { CollectionName } from "../model/index.ts";
import { REPO_ROOT } from "../pipeline/paths.ts";

/**
 * Change history of the canonical data, read from Git at build time. Git is
 * the audit trail: every published change maps to a commit.
 */
export type RecordTouch = {
  collection: CollectionName;
  id: string;
  status: "added" | "modified" | "removed";
};
export type DataCommit = { sha: string; date: string; subject: string; records: RecordTouch[] };

const STATUS: Record<string, RecordTouch["status"]> = { A: "added", M: "modified", D: "removed" };

export function dataHistory(): DataCommit[] {
  const env = { ...process.env, LC_ALL: "C", LANG: "C" };
  const gitContext = Object.keys(process.env).some((key) =>
    /^(GIT_DIR|GIT_WORK_TREE|GIT_COMMON_DIR|GIT_CEILING_DIRECTORIES|GIT_DISCOVERY_ACROSS_FILESYSTEM|GIT_OBJECT_DIRECTORY|GIT_ALTERNATE_OBJECT_DIRECTORIES|GIT_INDEX_FILE|GIT_CONFIG.*)$/.test(
      key,
    ),
  );
  let dir = REPO_ROOT;
  let metadata = false;
  while (true) {
    try {
      lstatSync(path.join(dir, ".git"));
      metadata = true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw new Error("Git history metadata inspection failed");
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  try {
    const inside = execFileSync("git", ["rev-parse", "--is-inside-work-tree"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    if (inside.trim() !== "true") throw new Error("not a worktree");
  } catch (error) {
    const failure = error as { status?: number; stderr?: string | Buffer; code?: string };
    const stderr = String(failure.stderr ?? "").trim();
    if (
      !metadata &&
      !gitContext &&
      failure.status === 128 &&
      /^fatal: not a git repository \(or any of the parent directories\): \.git$/.test(stderr)
    ) {
      console.warn("Git history unavailable: source directory is not a Git checkout");
      return [];
    }
    throw new Error(
      `Git history context probe failed (${failure.code ?? failure.status ?? "unknown error"})`,
    );
  }
  let log: string;
  try {
    log = execFileSync(
      "git",
      ["log", "--no-renames", "--name-status", "--format=%x1e%H%x09%cI%x09%s", "--", "data/"],
      {
        cwd: REPO_ROOT,
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
        env,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
  } catch (error) {
    const failure = error as { code?: string; status?: number; signal?: string };
    throw new Error(
      `Git history log failed (${failure.code ?? failure.status ?? failure.signal ?? "unknown error"})`,
    );
  }
  return log
    .split("\x1e")
    .filter((chunk) => chunk.trim() !== "")
    .map((chunk) => {
      const [header = "", ...lines] = chunk.trim().split("\n");
      const [sha = "", date = "", subject = ""] = header.split("\t");
      const records = lines.flatMap((line): RecordTouch[] => {
        const match = /^([AMD])\tdata\/([a-z]+)\/([^/]+)\.json$/.exec(line.trim());
        if (!match) return [];
        const [, code = "", collection = "", id = ""] = match;
        const status = STATUS[code];
        return status ? [{ collection: collection as CollectionName, id, status }] : [];
      });
      return { sha, date, subject, records };
    })
    .filter((commit) => commit.records.length > 0);
}
