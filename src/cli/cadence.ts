import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { cadenceReport, type FileAddition, toPrRecord, toRunRecord } from "../audit/cadence.ts";
import { REPO_ROOT } from "../pipeline/paths.ts";

// B21 cadence measures (ADR-08 entry condition). Read-only: it reads two JSON
// exports the maintainer makes with `gh` and the local Git history; it never
// calls the network and never changes a schedule or a prompt.
//
//   gh pr list --state all --limit 500 \
//     --json number,state,headRefName,createdAt,mergedAt,files > prs.json
//   gh run list --limit 500 \
//     --json workflowName,event,headBranch,conclusion,createdAt > runs.json
//   pnpm cadence:measure --prs prs.json --runs runs.json \
//     [--since <ISO>] [--until <ISO>] [--now <ISO>] [--ref main] [--out <file>]

const USAGE =
  "usage: pnpm cadence:measure --prs <prs.json> --runs <runs.json> [--since <ISO>] [--until <ISO>] [--now <ISO>] [--ref <git ref>] [--out <file>]";

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function readRows(file: string): Record<string, unknown>[] {
  const parsed: unknown = JSON.parse(readFileSync(file, "utf8"));
  if (!Array.isArray(parsed)) throw new Error(`${file}: expected a JSON array from gh --json`);
  return parsed as Record<string, unknown>[];
}

const git = (args: string[]) => execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8" });

/** First additions on the first-parent history of `ref` (merge time on main). */
function additions(ref: string, paths: string[]): FileAddition[] {
  const out = git([
    "log",
    "--first-parent",
    "--reverse",
    "--diff-filter=A",
    "--format=@%cI",
    "--name-only",
    ref,
    "--",
    ...paths,
  ]);
  const seen = new Map<string, string>();
  let at = "";
  for (const line of out.split("\n")) {
    if (line.startsWith("@")) at = line.slice(1);
    else if (line.trim() && !seen.has(line.trim())) seen.set(line.trim(), at);
  }
  return [...seen].map(([path, when]) => ({ path, at: when }));
}

function codeAt(ref: string) {
  return (sidecarPath: string): string | null => {
    try {
      const parsed = JSON.parse(git(["show", `${ref}:${sidecarPath}`])) as {
        source?: { code?: unknown };
      };
      return typeof parsed.source?.code === "string" ? parsed.source.code : null;
    } catch {
      return null;
    }
  };
}

const args = process.argv.slice(2);
const prsFile = option(args, "--prs");
const runsFile = option(args, "--runs");
if (!prsFile || !runsFile) {
  console.error(USAGE);
  process.exit(2);
}
const ref = option(args, "--ref") ?? "main";
const since = option(args, "--since");
const until = option(args, "--until");
for (const [name, value] of [
  ["--since", since],
  ["--until", until],
  ["--now", option(args, "--now")],
] as const) {
  if (value !== undefined && Number.isNaN(Date.parse(value))) {
    console.error(`${name} expects an ISO date-time, got: ${value}`);
    process.exit(2);
  }
}

const prs = readRows(prsFile).map(toPrRecord);
const runs = readRows(runsFile).map(toRunRecord);
const sidecars = additions(ref, ["sources/incremental"]).filter((a) =>
  a.path.endsWith(".proposals.json"),
);
const corpus = additions(ref, ["data/sources"]);
// Deterministic default for "now": the window end, else the latest input timestamp.
const latest = [
  ...prs.flatMap((p) => [p.createdAt, p.mergedAt ?? ""]),
  ...runs.map((r) => r.createdAt),
]
  .filter(Boolean)
  .sort()
  .at(-1);
const now = option(args, "--now") ?? until ?? latest ?? new Date(0).toISOString();

const report = cadenceReport({
  prs,
  runs,
  sidecars,
  corpus,
  codeOf: codeAt(ref),
  window: { since, until },
  now,
});
const text = `${JSON.stringify(report, null, 2)}\n`;
const out = option(args, "--out");
if (out) writeFileSync(out, text);
else process.stdout.write(text);
