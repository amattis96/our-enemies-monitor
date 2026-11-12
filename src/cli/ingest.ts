import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ProposalFile } from "../model/proposals.ts";
import { applyPlan, checkPlan } from "../pipeline/ingest/apply.ts";
import { planIngest } from "../pipeline/ingest/plan.ts";
import { buildReport, renderReport } from "../pipeline/ingest/report.ts";
import { readDataFiles } from "../pipeline/load.ts";
import { REPO_ROOT, repoPath } from "../pipeline/paths.ts";
import { validateDataFiles } from "../pipeline/validate.ts";

// Deterministic ingest of a proposals sidecar into candidate records.
//
//   pnpm ingest <Fonte_XX.proposals.json> [--write] [--json] [--report <file>]
//                                         [--compare <other.proposals.json>]...
//
// Dry run by default. --write creates/updates data/ files (needs_review,
// empty provenance) only when the plan is not blocked and the resulting
// data/ validates. --json prints the JSON report instead of the text one;
// --report also writes the JSON report to a file. --compare adds sidecars
// (e.g. from open PRs) to deduplicate against, besides those already in
// sources/incremental/. Exit code: 0 ok, 1 invalid sidecar, blocked plan or
// validation errors.

const args = process.argv.slice(2);
const values = (name: string) =>
  args.flatMap((arg, index) =>
    arg === name && args[index + 1] ? [args[index + 1] as string] : [],
  );
const optionArgs = new Set(["--report", "--compare"]);
const positional = args.filter(
  (arg, index) => !arg.startsWith("--") && !optionArgs.has(args[index - 1] ?? ""),
);
const input = positional[0];
if (!input) {
  console.error(
    "usage: pnpm ingest <Fonte_XX.proposals.json> [--write] [--json] [--report <file>]",
  );
  process.exit(1);
}
const write = args.includes("--write");
const asJson = args.includes("--json");

function readProposals(file: string): ProposalFile {
  const parsed = ProposalFile.safeParse(JSON.parse(readFileSync(file, "utf8")));
  if (!parsed.success) {
    console.error(`${file}: invalid proposals sidecar`);
    for (const issue of parsed.error.issues) {
      console.error(`  ${issue.path.join(".") || "(root)"}: ${issue.message}`);
    }
    process.exit(1);
  }
  return parsed.data;
}

const inputPath = path.resolve(input);
const proposals = readProposals(inputPath);

// Other sidecars and Markdown sources already archived in sources/incremental/.
const incremental = repoPath("sources/incremental");
const archived = existsSync(incremental) ? readdirSync(incremental).sort() : [];
const others = [
  ...archived
    .filter((name) => name.endsWith(".proposals.json"))
    .map((name) => path.join(incremental, name))
    .filter((file) => file !== inputPath),
  ...values("--compare").map((file) => path.resolve(file)),
].map(readProposals);
const archive = new Map(
  archived
    .filter((name) => name.endsWith(".md"))
    .map((name) => [
      `sources/incremental/${name}`,
      readFileSync(path.join(incremental, name), "utf8"),
    ]),
);

const files = readDataFiles();
const current = validateDataFiles(files);
if (current.issues.some((issue) => issue.severity === "error")) {
  console.error("data/ does not validate: run pnpm validate and fix it before ingesting");
  process.exit(1);
}

const plan = planIngest(proposals, {
  dataset: current.dataset,
  others,
  archive,
  fileExists: (file) => existsSync(repoPath(file)),
});
const validation = checkPlan(plan, files);
const blocked = plan.fatal.length > 0 || validation.some((issue) => issue.severity === "error");

const written = write && !blocked ? applyPlan(plan) : [];
const report = buildReport(plan, validation, write ? "write" : "dry-run", written);
const json = `${JSON.stringify(report, null, 2)}\n`;
process.stdout.write(asJson ? json : renderReport(report));
const out = values("--report")[0];
if (out) writeFileSync(path.resolve(out), json);
if (write && blocked)
  console.error(`Blocked: nothing written in ${path.relative(REPO_ROOT, repoPath("data"))}/`);
process.exit(blocked ? 1 : 0);
