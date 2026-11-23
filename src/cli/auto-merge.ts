import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import {
  type CheckRun,
  type Comment,
  checkState,
  type FileChange,
  mainState,
  type PullFacts,
  plan,
  REQUIRED_CHECKS,
  type Run,
} from "../pipeline/auto-merge.ts";

// Chooses the next automated integration action (read-only).
//
//   node src/cli/auto-merge.ts        (CI: .github/workflows/auto-merge.yml)
//
// Environment: GH_TOKEN (read scopes only), REPO, OWNER (maintainer login),
// CAN_UPDATE ("true" when the write job holds AUTOMERGE_TOKEN), optional
// GITHUB_OUTPUT / GITHUB_STEP_SUMMARY. Writes action, pr and head_sha to
// $GITHUB_OUTPUT. Any API failure exits 1: no action is ever assumed.

const env = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`missing environment variable ${name}`);
  return value;
};

const api = <T>(path: string, paginate = false): T => {
  const args = paginate ? ["api", "--paginate", "--slurp", path] : ["api", path];
  const out = execFileSync("gh", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return JSON.parse(out) as T;
};

type ApiFile = { filename: string; status: string; sha: string };
const toChanges = (files: ApiFile[]): FileChange[] =>
  files.map((f) => ({ path: f.filename, status: f.status, blob: f.sha }));

function main(): void {
  const repo = env("REPO");
  const owner = env("OWNER");
  const canUpdate = process.env.CAN_UPDATE === "true";

  const mainSha = api<{ sha: string }>(`repos/${repo}/commits/main`).sha;
  const ciRuns = api<{ workflow_runs: Run[] }>(
    `repos/${repo}/actions/workflows/ci.yml/runs?branch=main&head_sha=${mainSha}&per_page=50`,
  ).workflow_runs;
  const mainCi = mainState(ciRuns);

  const open = api<Array<{ number: number }>>(
    `repos/${repo}/pulls?state=open&base=main&per_page=100`,
  );
  const pulls: PullFacts[] = open.map(({ number }) => {
    const pr = api<{
      number: number;
      draft: boolean;
      mergeable_state: string | null;
      labels: Array<{ name: string }>;
      head: { ref: string; sha: string; repo: { full_name: string } | null };
      base: { ref: string };
    }>(`repos/${repo}/pulls/${number}`);
    const comments: Comment[] = api<Array<Array<Record<string, unknown>>>>(
      `repos/${repo}/issues/${number}/comments?per_page=100`,
      true,
    )
      .flat()
      .map((c) => ({
        author: String((c.user as { login?: string } | null)?.login ?? ""),
        body: String(c.body ?? ""),
        createdAt: String(c.created_at),
      }));
    const commits = api<Array<Array<{ sha: string }>>>(
      `repos/${repo}/pulls/${number}/commits?per_page=100`,
      true,
    )
      .flat()
      .map((c) => c.sha);
    const files = toChanges(
      api<ApiFile[][]>(`repos/${repo}/pulls/${number}/files?per_page=100`, true).flat(),
    );
    const checkRuns = api<Array<{ check_runs: CheckRun[] }>>(
      `repos/${repo}/commits/${pr.head.sha}/check-runs?per_page=100`,
      true,
    ).flatMap((p) => p.check_runs);
    const checks = Object.fromEntries(REQUIRED_CHECKS.map((n) => [n, checkState(checkRuns, n)]));

    // Inventory of the C-reviewed HEAD, only needed when the PR moved since.
    let reviewedFiles: FileChange[] | null = null;
    const named = new Set(
      comments.flatMap((c) => (c.body.match(/\b[0-9a-f]{40}\b/g) ?? []) as string[]),
    );
    const reviewed = [...commits].reverse().find((sha) => named.has(sha));
    if (reviewed && reviewed !== pr.head.sha) {
      const compare = api<{ files?: ApiFile[] }>(
        `repos/${repo}/compare/main...${reviewed}?per_page=100`,
      );
      const list = compare.files ?? [];
      reviewedFiles = list.length >= 100 ? null : toChanges(list);
    }

    return {
      number: pr.number,
      headRef: pr.head.ref,
      headSha: pr.head.sha,
      headRepo: pr.head.repo?.full_name ?? "",
      baseRef: pr.base.ref,
      draft: pr.draft,
      labels: pr.labels.map((l) => l.name),
      mergeableState: pr.mergeable_state,
      comments,
      commits,
      files,
      reviewedFiles,
      checks,
    };
  });

  const result = plan(mainCi, pulls, { repo, owner, canUpdate });
  const next = result.next;

  const lines = [
    `### Auto-merge — main \`${mainSha.slice(0, 8)}\` CI: **${result.main}**`,
    "",
    "| PR | HEAD | Decision | Reason |",
    "| --- | --- | --- | --- |",
    ...result.decisions.map(
      (d) => `| #${d.pr} | \`${d.headSha.slice(0, 8)}\` | ${d.action} | ${d.reason} |`,
    ),
    "",
    next
      ? `**Next action:** ${next.action}${next.pr ? ` #${next.pr}` : ""}`
      : "**Next action:** none",
    "",
  ];
  process.stdout.write(`${lines.join("\n")}\n`);
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join("\n"));
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `action=${next?.action ?? "none"}\npr=${next?.pr ?? 0}\nhead_sha=${next?.headSha ?? ""}\n`,
    );
  }
}

try {
  main();
} catch (cause) {
  process.stderr.write(`auto-merge failed: ${(cause as Error).message}\n`);
  process.exit(1);
}
