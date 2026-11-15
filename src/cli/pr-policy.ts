import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import {
  type LabelEvent,
  pushLowerBound,
  type RunInfo,
  WAIVER_LABEL,
  waiverStatus,
} from "../pipeline/policy.ts";

// Decides whether the maintainer's `evidence-waiver` label counts for this run.
//
//   pnpm check:pr        (CI only; reads the environment, calls `gh api`)
//
// Environment: GH_TOKEN (read-only scopes), REPO, PR_NUMBER, HEAD_SHA, OWNER
// (the maintainer login), ACTION, plus GITHUB_OUTPUT / GITHUB_STEP_SUMMARY.
// Writes `waiver=true|false` to $GITHUB_OUTPUT. Every context value reaches
// this script through the environment, never through interpolated shell text.
// This script runs PR-controlled code, so it holds no write token: removing
// the label after a push is done by a separate job (evidence-diff.yml). If
// GitHub cannot be read the script exits 1: no waiver is ever assumed.

const env = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`missing environment variable ${name}`);
  return value;
};

const gh = (...ghArgs: string[]): string =>
  execFileSync("gh", ghArgs, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

function main(): void {
  const repo = env("REPO");
  const pr = env("PR_NUMBER");
  const sha = env("HEAD_SHA");
  const owner = env("OWNER");
  const action = env("ACTION");

  const labels = JSON.parse(
    gh("api", `repos/${repo}/issues/${pr}/labels`, "--jq", "[.[].name]"),
  ) as string[];
  const raw = JSON.parse(
    gh("api", "--paginate", "--slurp", `repos/${repo}/issues/${pr}/events?per_page=100`),
  ) as Array<Array<Record<string, unknown>>>;
  const events: LabelEvent[] = raw
    .flat()
    .filter((e) => e.event === "labeled" || e.event === "unlabeled")
    .map((e) => ({
      event: String(e.event),
      label: String((e.label as { name?: string } | undefined)?.name ?? ""),
      actor: String((e.actor as { login?: string } | undefined)?.login ?? ""),
      createdAt: String(e.created_at),
    }));
  if (!/^\d+$/.test(pr)) throw new Error("PR_NUMBER must be numeric");
  const pages = JSON.parse(
    gh(
      "api",
      "--paginate",
      "--slurp",
      `repos/${repo}/actions/runs?head_sha=${sha}&event=pull_request&per_page=100`,
    ),
  ) as Array<{ workflow_runs: Array<Record<string, unknown>> }>;
  const runs: RunInfo[] = pages
    .flatMap((page) => page.workflow_runs)
    .map((r) => ({
      event: String(r.event),
      path: String(r.path ?? ""),
      createdAt: String(r.created_at),
      pullRequests: ((r.pull_requests as Array<{ number: number }> | null) ?? []).map(
        (p) => p.number,
      ),
    }));
  const committerDate = (
    JSON.parse(gh("api", `repos/${repo}/commits/${sha}`)) as {
      commit: { committer: { date?: string } };
    }
  ).commit.committer.date;
  const pushedAt = pushLowerBound(runs, Number(pr), committerDate ?? null);

  const status = waiverStatus({ labels, events, owner, action, pushedAt });

  const line = `${WAIVER_LABEL}: ${status.valid ? "VALID" : "not applied"} — ${status.reason}`;
  process.stdout.write(`${line}\n`);
  if (process.env.GITHUB_STEP_SUMMARY && labels.includes(WAIVER_LABEL)) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `**${line}**\n\n`);
  }
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `waiver=${status.valid ? "true" : "false"}\n`);
  }
}

try {
  main();
} catch (cause) {
  process.stderr.write(`check:pr failed: ${(cause as Error).message}\n`);
  process.exit(1);
}
