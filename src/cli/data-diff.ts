import { execFileSync } from "node:child_process";
import { appendFileSync, writeFileSync } from "node:fs";
import { COLLECTION_NAMES, type CollectionName } from "../model/index.ts";
import { diffData, diffMarkdown } from "../pipeline/diff.ts";
import { type DataFile, readDataFiles } from "../pipeline/load.ts";
import { REPO_ROOT } from "../pipeline/paths.ts";

// Evidence diff of data/ against a Git ref.
//
//   pnpm data:diff [--base <ref>] [--agent] [--out <file.md>]
//
// --agent: changes an automated agent must never make are errors (exit 1),
// including any change outside data/. The Markdown report is printed, written
// to --out, and appended to $GITHUB_STEP_SUMMARY when set.

const args = process.argv.slice(2);
const option = (name: string) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const base = option("--base") ?? "origin/main";
const agent = args.includes("--agent");
const out = option("--out");

const git = (...gitArgs: string[]) =>
  execFileSync("git", gitArgs, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "ignore"],
  });

const changedPaths = git("diff", "--name-only", base, "--")
  .split("\n")
  .filter((p) => p !== "");
const untracked = git("ls-files", "--others", "--exclude-standard")
  .split("\n")
  .filter((p) => p !== "");
const touched = [...new Set([...changedPaths, ...untracked])];
const dataPaths = touched.filter((p) => /^data\/[a-z]+\/[^/]+\.json$/.test(p));

const collectionOf = (path: string) => path.split("/")[1] as CollectionName;
const before: DataFile[] = dataPaths.flatMap((path) => {
  if (!COLLECTION_NAMES.includes(collectionOf(path))) return [];
  try {
    return [
      { collection: collectionOf(path), path: path.slice(5), text: git("show", `${base}:${path}`) },
    ];
  } catch {
    return []; // file added after base
  }
});
const current = new Map(readDataFiles().map((f) => [f.path, f]));
const after = dataPaths.flatMap((path) => current.get(path.slice(5)) ?? []);

const persons = new Set(
  [...current.values()]
    .filter((f) => f.collection === "entities" && JSON.parse(f.text).kind === "person")
    .map((f) => JSON.parse(f.text).id as string),
);
const report = diffData(before, after, { agent, persons });

if (agent) {
  for (const path of touched.filter((p) => !p.startsWith("data/"))) {
    report.flags.unshift({
      severity: "error",
      id: path,
      message: "research agents may change only data/",
    });
  }
}

const markdown = diffMarkdown(
  report,
  `Evidence diff against \`${base}\`${agent ? " (agent rules)" : ""}`,
);
process.stdout.write(markdown);
if (out) writeFileSync(out, markdown);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
process.exit(report.flags.some((f) => f.severity === "error") ? 1 : 0);
