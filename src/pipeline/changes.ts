import { execFileSync } from "node:child_process";
import { lstatSync } from "node:fs";
import path from "node:path";

/**
 * Changed paths of a pull request, read from Git in a form that cannot hide a
 * deletion: raw output, NUL-separated, renames reported as a deletion plus an
 * addition, and the comparison anchored at the merge base (so commits that
 * landed on the base branch meanwhile are not attributed to the PR).
 */

export type ChangeStatus = "A" | "M" | "D" | "T" | "U" | "X";

export type PathChange = {
  status: ChangeStatus;
  path: string;
  /** Mode of the new side (`000000` for a deletion). */
  mode: string;
};

/** Parse `git diff --raw -z --no-renames` output (`:<m1> <m2> <s1> <s2> <S>\0<path>\0…`). */
export function parseRawZ(output: string): PathChange[] {
  const tokens = output.split("\0");
  const changes: PathChange[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const meta = tokens[i] ?? "";
    if (!meta.startsWith(":")) continue;
    const fields = meta.slice(1).split(" ");
    const status = (fields[4] ?? "X").charAt(0) as ChangeStatus;
    const file = tokens[++i];
    if (file === undefined || file === "") continue;
    changes.push({ status, path: file, mode: fields[1] ?? "000000" });
  }
  return changes;
}

export function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

/** The commit a PR branches from: fails (throws) when `base` cannot be resolved. */
export function mergeBase(cwd: string, base: string): string {
  return git(cwd, "merge-base", base, "HEAD").trim();
}

/**
 * Every path that differs between the merge base and the working tree,
 * including untracked files (local runs before committing).
 */
export function collectChanges(cwd: string, base: string): PathChange[] {
  const tracked = parseRawZ(git(cwd, "diff", "--raw", "-z", "--no-renames", base, "--"));
  const known = new Set(tracked.map((c) => c.path));
  const untracked = git(cwd, "ls-files", "-z", "--others", "--exclude-standard")
    .split("\0")
    .filter((p) => p !== "" && !known.has(p))
    .map((p): PathChange => {
      const symlink = lstatSync(path.join(cwd, p), { throwIfNoEntry: false })?.isSymbolicLink();
      return { status: "A", path: p, mode: symlink ? "120000" : "100644" };
    });
  return [...tracked, ...untracked];
}

/** File content at a commit, or null when the path did not exist there. */
export function showAt(cwd: string, commit: string, file: string): string | null {
  try {
    return git(cwd, "show", `${commit}:${file}`);
  } catch {
    return null;
  }
}
