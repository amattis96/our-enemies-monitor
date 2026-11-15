import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { ProposalFile } from "../model/proposals.ts";
import { applyPlan, checkPlan } from "../pipeline/ingest/apply.ts";
import {
  type Archive,
  archiveContext,
  archiveWarnings,
  INCREMENTAL_DIR,
  parseSidecar,
  readArchive,
} from "../pipeline/ingest/archive.ts";
import { planIngest } from "../pipeline/ingest/plan.ts";
import { buildReport, renderReport } from "../pipeline/ingest/report.ts";
import { readDataFiles } from "../pipeline/load.ts";
import { REPO_ROOT, repoPath } from "../pipeline/paths.ts";
import { validateDataFiles } from "../pipeline/validate.ts";

// Deterministic ingest of a proposals sidecar into candidate records.
//
//   pnpm ingest <Fonte_XX.proposals.json> [--write] [--json] [--report <file>]
//                                         [--compare <other.proposals.json>]...
//                                         [--skip-pending S<NN>]...
//
// Dry run by default. --write creates/updates data/ files (needs_review,
// empty provenance) only when the plan is not blocked and the resulting
// data/ validates. --json prints the JSON report instead of the text one;
// --report also writes the JSON report to a file.
//
// Sidecars are ingested in archive order (source number, then date, then
// file name): an earlier archived sidecar that is not ingested yet blocks
// the run. Deduplication is against data/ only; later archived sidecars and
// --compare files (e.g. from open PRs) only produce attention points. An
// invalid archived or --compare sidecar is a warning; an invalid input
// sidecar stops the run. --skip-pending S<NN> (maintainer only: agents must
// ask) steps over one specific earlier pending sidecar whose plan cannot be
// ingested; it is reported as a warning and noted in the new corpus
// document. Exit code: 0 ok, 1 invalid input sidecar, blocked
// plan or validation errors.

const args = process.argv.slice(2);
const values = (name: string) =>
  args.flatMap((arg, index) =>
    arg === name && args[index + 1] ? [args[index + 1] as string] : [],
  );
const optionArgs = new Set(["--report", "--compare", "--skip-pending"]);
const positional = args.filter(
  (arg, index) => !arg.startsWith("--") && !optionArgs.has(args[index - 1] ?? ""),
);
const input = positional[0];
if (!input) {
  console.error(
    "usage: pnpm ingest <Fonte_XX.proposals.json> [--write] [--json] [--report <file>] [--compare <file>] [--skip-pending S<NN>]",
  );
  process.exit(1);
}
const skip = values("--skip-pending");
const badSkip = skip.filter((code) => !/^S(?:\d{2}|[1-9]\d{2})$/.test(code));
if (badSkip.length > 0) {
  console.error(`--skip-pending expects a source code such as S12, got: ${badSkip.join(", ")}`);
  process.exit(1);
}
const write = args.includes("--write");
const asJson = args.includes("--json");

/** Read and parse a sidecar; problems are readable lines, never a stack trace. */
function loadSidecar(file: string): ReturnType<typeof parseSidecar> {
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch (error) {
    return { problems: [`cannot be read: ${(error as Error).message}`] };
  }
  return parseSidecar(text);
}

const inputPath = path.resolve(input);
const parsedInput = loadSidecar(inputPath);
if ("problems" in parsedInput) {
  console.error(`${inputPath}: invalid proposals sidecar`);
  for (const problem of parsedInput.problems) console.error(`  ${problem}`);
  process.exit(1);
}
const proposals = parsedInput.proposals;

// Archived sidecars and Markdown sources in sources/incremental/.
const incremental = repoPath(INCREMENTAL_DIR);
const archive: Archive = existsSync(incremental)
  ? readArchive(incremental)
  : { names: [], sidecars: [], invalid: [], markdown: new Map() };
const warnings = archiveWarnings(archive);
const compare: ProposalFile[] = [];
for (const file of values("--compare").map((f) => path.resolve(f))) {
  const parsed = loadSidecar(file);
  if ("proposals" in parsed) compare.push(parsed.proposals);
  else warnings.push(`${file}: invalid --compare sidecar, ignored (${parsed.problems.join("; ")})`);
}

const files = readDataFiles();
const current = validateDataFiles(files);
if (current.issues.some((issue) => issue.severity === "error")) {
  console.error("data/ does not validate: run pnpm validate and fix it before ingesting");
  process.exit(1);
}

const relativeInput = path.relative(REPO_ROOT, inputPath).split(path.sep).join("/");
const position = archiveContext(
  { name: path.basename(inputPath), path: relativeInput, proposals },
  archive,
  current.dataset,
  compare,
  skip,
);
for (const code of position.skipped) {
  warnings.push(`${code} is pending and was skipped by the maintainer (--skip-pending ${code})`);
}
for (const code of position.unusedSkips) {
  warnings.push(`--skip-pending ${code} ignored: not an earlier pending sidecar`);
}
const plan = planIngest(proposals, {
  dataset: current.dataset,
  ...position,
  fileExists: (file) => existsSync(repoPath(file)),
});
const validation = checkPlan(plan, files);
const blocked = plan.fatal.length > 0 || validation.some((issue) => issue.severity === "error");

const written = write && !blocked ? applyPlan(plan) : [];
const report = buildReport(plan, validation, write ? "write" : "dry-run", written, warnings);
const json = `${JSON.stringify(report, null, 2)}\n`;
process.stdout.write(asJson ? json : renderReport(report));
const out = values("--report")[0];
if (out) writeFileSync(path.resolve(out), json);
if (write && blocked)
  console.error(`Blocked: nothing written in ${path.relative(REPO_ROOT, repoPath("data"))}/`);
process.exit(blocked ? 1 : 0);
