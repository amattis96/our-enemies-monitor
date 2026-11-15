import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  BASELINE_VERSION,
  dTasks,
  e1SourceChain,
  e2LevelStatusPairs,
  e3WithheldBaseline,
  e4CounterInference,
  e5CoParticipation,
  e6MentionsWithoutEdge,
  scanPages,
} from "../audit/baseline.ts";
import { scoreAnswers } from "../audit/benchmark.ts";
import { readDataFiles } from "../pipeline/load.ts";
import { REPO_ROOT } from "../pipeline/paths.ts";
import { validateDataFiles } from "../pipeline/validate.ts";
import { exportFiles } from "../site/exports.ts";
import { publicationReport } from "../site/publication.ts";

const USAGE = `usage:
  pnpm benchmark:measure [--out <file>] [--pages <built site dir>]
  pnpm benchmark:score <answers.json> [--cases <cases.json>] [--out <file>]`;

const DEFAULT_CASES = path.join(REPO_ROOT, "docs/audit/baseline/benchmark-cases.v1.json");

function git(args: string[]): string | null {
  try {
    return execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function htmlFiles(dir: string): string[] {
  return readdirSync(dir)
    .sort()
    .flatMap((name) => {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) return htmlFiles(full);
      return name.endsWith(".html") ? [full] : [];
    });
}

function emit(value: unknown, out: string | undefined) {
  const text = `${JSON.stringify(value, null, 2)}\n`;
  if (out) writeFileSync(out, text);
  else process.stdout.write(text);
}

function measure(args: string[]) {
  const { issues, dataset } = validateDataFiles(readDataFiles());
  const errors = issues.filter((issue) => issue.severity === "error");
  if (errors.length > 0) {
    for (const issue of errors) console.error(issue);
    process.exitCode = 1;
    return;
  }
  const report = publicationReport(dataset);
  const files = exportFiles(report);
  const commitDate = git(["log", "-1", "--format=%cI"]);
  const pagesDir = option(args, "--pages");
  const pages = pagesDir
    ? scanPages(htmlFiles(path.resolve(pagesDir)).map((f) => readFileSync(f, "utf8")))
    : null;
  emit(
    {
      baseline_version: BASELINE_VERSION,
      commit: git(["rev-parse", "HEAD"]),
      commit_date: commitDate,
      data_worktree_clean: git(["status", "--porcelain", "--", "data", "schemas"]) === "",
      references: {
        A: "docs/audit/fable-2026-11/FABLE_A_Deep_Intelligence_Knowledge_Discovery.md §11",
        D: "docs/audit/fable-2026-11/FABLE_D_AI_Interoperability_Semantic_Knowledge.md §9.1",
      },
      A: {
        E1: e1SourceChain(dataset),
        E2: e2LevelStatusPairs(dataset),
        E3: e3WithheldBaseline(dataset, report),
        E4: e4CounterInference(dataset, report.dataset),
        E5: e5CoParticipation(dataset),
        E6: e6MentionsWithoutEdge(dataset),
      },
      D: dTasks(files, { commitDate, pages }),
    },
    option(args, "--out"),
  );
}

function score(args: string[]) {
  const answersPath = args.find(
    (arg, i) => !arg.startsWith("--") && !args[i - 1]?.startsWith("--"),
  );
  if (!answersPath) throw new Error(USAGE);
  const cases: unknown = JSON.parse(readFileSync(option(args, "--cases") ?? DEFAULT_CASES, "utf8"));
  const answers: unknown = JSON.parse(readFileSync(answersPath, "utf8"));
  const { dataset } = validateDataFiles(readDataFiles());
  const known = new Set(
    (Object.keys(dataset) as (keyof typeof dataset)[]).flatMap((name) =>
      dataset[name].map((record) => record.id),
    ),
  );
  emit(scoreAnswers(cases, answers, known), option(args, "--out"));
}

const [command, ...rest] = process.argv.slice(2);
if (command === "measure") measure(rest);
else if (command === "score") score(rest);
else {
  console.error(USAGE);
  process.exitCode = 2;
}
