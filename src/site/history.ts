import { execFileSync } from "node:child_process";
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
  let log: string;
  try {
    log = execFileSync(
      "git",
      ["log", "--no-renames", "--name-status", "--format=%x1e%H%x09%cI%x09%s", "--", "data/"],
      {
        cwd: REPO_ROOT,
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
        stdio: ["ignore", "pipe", "ignore"],
      },
    );
  } catch {
    return []; // not a Git checkout (e.g. a source archive): no history to show
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
