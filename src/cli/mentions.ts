import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  buildMentionReport,
  MentionExclusionsSchema,
  MentionReviewSchema,
  renderMentionReportMarkdown,
} from "../audit/mentions.ts";
import { readDataFiles } from "../pipeline/load.ts";
import { REPO_ROOT } from "../pipeline/paths.ts";
import { validateDataFiles } from "../pipeline/validate.ts";

const USAGE = `usage: pnpm audit:mentions [--format md|json] [--out <file>] [--exclusions <file>] [--review <file>]

Read-only text-graph queue (B14): entity names in event text without a
participation edge. Writes only to --out, never under data/, sources/ or schemas/.`;

const DIR = path.join(REPO_ROOT, "docs/audit/mentions");
const PROTECTED = ["data", "sources", "schemas"];

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function head(): string | null {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: REPO_ROOT, encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

function protectedDir(file: string): string | undefined {
  const resolved = path.resolve(file);
  return PROTECTED.find((dir) => resolved.startsWith(path.join(REPO_ROOT, dir) + path.sep));
}

const args = process.argv.slice(2);
if (args.includes("--help")) {
  console.log(USAGE);
} else {
  const format = option(args, "--format") ?? "md";
  if (format !== "md" && format !== "json") {
    console.error(USAGE);
    process.exitCode = 2;
  } else {
    const load = (flag: string, fallback: string): unknown =>
      JSON.parse(readFileSync(option(args, flag) ?? path.join(DIR, fallback), "utf8"));
    const exclusions = MentionExclusionsSchema.parse(load("--exclusions", "exclusions.v1.json"));
    const review = MentionReviewSchema.parse(load("--review", "review.v1.json"));
    const { issues, dataset } = validateDataFiles(readDataFiles());
    const errors = issues.filter((issue) => issue.severity === "error");
    if (errors.length > 0) {
      for (const issue of errors) console.error(issue);
      process.exitCode = 1;
    } else {
      const report = buildMentionReport(dataset, exclusions, review);
      const commit = head();
      const text =
        format === "json"
          ? `${JSON.stringify({ commit, ...report }, null, 2)}\n`
          : renderMentionReportMarkdown(report, commit);
      const out = option(args, "--out");
      const blocked = out ? protectedDir(out) : undefined;
      if (blocked) {
        console.error(`refusing to write under ${blocked}/: ${out}`);
        process.exitCode = 1;
      } else if (out) writeFileSync(out, text);
      else process.stdout.write(text);
      // Anomalies (stale exclusions, orphan reviews) make the exit code non-zero.
      if (report.summary.unused_exclusions.length + report.summary.orphan_reviews.length > 0) {
        process.exitCode = 1;
      }
    }
  }
}
