import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { AiBenchmarkRunSchema } from "../audit/ai-benchmark.ts";
import { repoPath } from "../pipeline/paths.ts";
import { containsSecret } from "../runs/minimize.ts";
import { loadRunManifests } from "../runs/store.ts";

// pnpm validate:runs: every stored run manifest is valid, minimized, named by
// its run_id and unique; every recorded external AI benchmark run matches
// AiBenchmarkRunSchema. Part of pnpm check.
const { manifests, issues } = loadRunManifests();
for (const issue of issues)
  console.error(`error  docs/runs/manifests/${issue.file}: ${issue.message}`);

const benchmarkDir = repoPath("docs/audit/ai-benchmarks/runs");
let benchmarkRuns = 0;
const benchmarkIssues: string[] = [];
if (existsSync(benchmarkDir)) {
  for (const name of readdirSync(benchmarkDir)
    .filter((n) => n.endsWith(".json"))
    .sort()) {
    const raw = readFileSync(path.join(benchmarkDir, name), "utf8");
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      benchmarkIssues.push(`${name}: invalid JSON`);
      continue;
    }
    const result = AiBenchmarkRunSchema.safeParse(parsed);
    if (!result.success) {
      benchmarkIssues.push(`${name}: ${result.error.issues[0]?.message ?? "invalid run"}`);
    } else if (name !== `${result.data.run_id}.json`) {
      benchmarkIssues.push(`${name}: file name must be ${result.data.run_id}.json`);
    } else if (containsSecret(raw)) {
      benchmarkIssues.push(`${name}: contains a credential or token`);
    } else {
      benchmarkRuns += 1;
    }
  }
}
for (const issue of benchmarkIssues) console.error(`error  docs/audit/ai-benchmarks/runs/${issue}`);
const total = issues.length + benchmarkIssues.length;
console.log(
  `${manifests.length} run manifest(s), ${benchmarkRuns} AI benchmark run(s), ${total} error(s)`,
);
if (total > 0) process.exitCode = 1;
