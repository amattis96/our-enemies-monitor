/**
 * Automated integration gate (replaces the ChatGPT Task D merge step).
 *
 * Pure decision logic: the CLI (`src/cli/auto-merge.ts`) collects the facts
 * from the GitHub API with a read-only token and a separate job, which runs no
 * repository code, performs the single action chosen here. GitHub's branch
 * protection still enforces the required checks on the merge request itself.
 *
 * A pull request is merged only when ALL of these hold:
 * - base `main`, head branch in this repository, not draft;
 * - branch class `research/*`, `agent/ingest-*` or `agent/publish-ART-*`, and
 *   every changed path is allowed for that class (never the control plane);
 * - no `evidence-waiver` or `automerge:hold` label;
 * - the latest `OEM Task C | Review & Fix` comment by the maintainer account
 *   is a clean `READY_FOR_D` naming a commit of the PR; if the PR moved since,
 *   the changed-file inventory (path, status, blob) must be identical;
 * - `check` and `evidence-diff` succeeded on the current HEAD;
 * - the latest CI run of the current `main` succeeded (build + Pages deploy).
 * One action per run: merging moves `main`, whose CI must pass before the next.
 */

export const REQUIRED_CHECKS = ["check", "evidence-diff"] as const;
export const HANDOFF_PREFIX = "OEM Task C | Review & Fix";
export const BLOCKING_LABELS = ["evidence-waiver", "automerge:hold"] as const;

export type FileChange = { path: string; status: string; blob: string };
export type Comment = { author: string; body: string; createdAt: string };
export type RunState = "success" | "pending" | "failure" | "missing";

export type PullFacts = {
  number: number;
  headRef: string;
  headSha: string;
  headRepo: string;
  baseRef: string;
  draft: boolean;
  labels: string[];
  /** GitHub `mergeable_state`: clean, behind, blocked, dirty, unstable, unknown… */
  mergeableState: string | null;
  comments: Comment[];
  /** SHAs of the commits on the PR branch. */
  commits: string[];
  /** Changed files of the current HEAD against main (three-dot). */
  files: FileChange[];
  /** Changed files of the C-reviewed HEAD, when it differs from the current one. */
  reviewedFiles: FileChange[] | null;
  checks: Partial<Record<(typeof REQUIRED_CHECKS)[number], RunState>>;
};

export type Context = { repo: string; owner: string; canUpdate: boolean };

export type Action = "merge" | "update" | "dispatch-ci" | "wait" | "skip";
export type Decision = { pr: number; action: Action; reason: string; headSha: string };

type Rule = { prefix: string; statuses: readonly string[] };
type BranchRules = { match: (ref: string) => boolean; allowed: Rule[] };

const ARTICLES = "content/articles/";
const BRANCHES: BranchRules[] = [
  {
    match: (ref) => ref.startsWith("research/"),
    allowed: [
      { prefix: "sources/incremental/", statuses: ["added"] },
      { prefix: "sources/thematic/", statuses: ["added"] },
      { prefix: ARTICLES, statuses: ["added", "modified"] },
    ],
  },
  {
    match: (ref) => ref.startsWith("agent/ingest-"),
    allowed: [{ prefix: "data/", statuses: ["added", "modified"] }],
  },
  {
    match: (ref) => ref.startsWith("agent/publish-ART-"),
    allowed: [{ prefix: ARTICLES, statuses: ["modified"] }],
  },
];

/** First path outside the branch's allowed set, or null when all are allowed. */
export function pathViolation(headRef: string, files: FileChange[]): string | null {
  const rules = BRANCHES.find((b) => b.match(headRef));
  if (!rules) return `branch ${headRef} is not an automated research/ingest/publish branch`;
  if (files.length === 0) return "empty diff";
  for (const file of files) {
    const ok = rules.allowed.some(
      (r) => file.path.startsWith(r.prefix) && r.statuses.includes(file.status),
    );
    if (!ok) return `${file.status} ${file.path} is outside the automated path policy`;
  }
  return null;
}

const NEGATIVE =
  /NOT\s+READY_FOR_D|\bBLOCKED_(?:EVIDENCE|TECHNICAL|HUMAN)\b|\bPENDING_(?:CHECKS|C)\b|\bSTALE\b/;
const SHA = /\b[0-9a-f]{40}\b/g;

export type Handoff =
  | { verdict: "none" }
  | { verdict: "not_ready"; reason: string }
  | { verdict: "ready"; reviewedHead: string };

/**
 * Reads the latest Task C handoff written by the maintainer account. Only a
 * clean READY_FOR_D counts; any negative verdict token makes it not ready.
 * The reviewed HEAD is the newest PR commit whose SHA the comment names.
 */
export function parseHandoff(comments: Comment[], owner: string, commits: string[]): Handoff {
  const handoffs = comments
    .filter((c) => c.author === owner && c.body.trimStart().startsWith(HANDOFF_PREFIX))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const last = handoffs.at(-1);
  if (!last) return { verdict: "none" };
  const negative = last.body.match(NEGATIVE);
  if (negative) return { verdict: "not_ready", reason: `latest C verdict: ${negative[0]}` };
  if (!/\bREADY_FOR_D\b/.test(last.body)) {
    return { verdict: "not_ready", reason: "latest C handoff carries no READY_FOR_D" };
  }
  const named = new Set(last.body.match(SHA) ?? []);
  const reviewed = [...commits].reverse().find((sha) => named.has(sha));
  if (!reviewed) return { verdict: "not_ready", reason: "C handoff names no commit of this PR" };
  return { verdict: "ready", reviewedHead: reviewed };
}

const key = (f: FileChange) => `${f.status}\u0000${f.path}\u0000${f.blob}`;

/** Same paths, statuses and blob SHAs: the content C reviewed is unchanged. */
export function sameInventory(a: FileChange[], b: FileChange[]): boolean {
  if (a.length !== b.length) return false;
  const left = a.map(key).sort();
  const right = b.map(key).sort();
  return left.every((k, i) => k === right[i]);
}

export function decidePull(pull: PullFacts, ctx: Context): Decision {
  const result = (action: Action, reason: string): Decision => ({
    pr: pull.number,
    action,
    reason,
    headSha: pull.headSha,
  });
  if (pull.baseRef !== "main") return result("skip", `base is ${pull.baseRef}`);
  if (pull.headRepo !== ctx.repo) return result("skip", "head branch is outside this repository");
  if (pull.draft) return result("skip", "draft");
  const label = pull.labels.find((l) => (BLOCKING_LABELS as readonly string[]).includes(l));
  if (label) return result("skip", `label ${label}`);
  const violation = pathViolation(pull.headRef, pull.files);
  if (violation) return result("skip", violation);

  const handoff = parseHandoff(pull.comments, ctx.owner, pull.commits);
  if (handoff.verdict === "none") return result("wait", "no Task C handoff yet");
  if (handoff.verdict === "not_ready") return result("skip", handoff.reason);
  if (handoff.reviewedHead !== pull.headSha) {
    if (!pull.reviewedFiles || !sameInventory(pull.files, pull.reviewedFiles)) {
      return result("skip", "content changed after the C-reviewed HEAD: new C review needed");
    }
  }

  for (const name of REQUIRED_CHECKS) {
    const state = pull.checks[name] ?? "missing";
    if (state === "failure") return result("skip", `required check ${name} failed`);
    if (state !== "success") return result("wait", `required check ${name} is ${state}`);
  }

  switch (pull.mergeableState) {
    case "clean":
    case "has_hooks":
      return result("merge", "C handoff, path policy and required checks satisfied");
    case "behind":
      return ctx.canUpdate
        ? result("update", "behind main: updating branch (CI reruns on the new HEAD)")
        : result("skip", "behind main and no AUTOMERGE_TOKEN to update the branch");
    case "dirty":
      return result("skip", "merge conflict with main");
    case "blocked":
      return result("skip", "blocked by branch protection (unresolved conversation?)");
    case "unstable":
      return result("skip", "a non-required check is failing");
    default:
      return result("wait", `mergeability ${pull.mergeableState ?? "unknown"} not computed yet`);
  }
}

export type Plan = { main: RunState; decisions: Decision[]; next: Decision | null };

/** One action per run: a merge first, else a branch update, oldest PR first. */
export function plan(main: RunState, pulls: PullFacts[], ctx: Context): Plan {
  const ordered = [...pulls].sort((a, b) => a.number - b.number);
  if (main !== "success") {
    const reason = `main CI is ${main}: no merge until it succeeds`;
    const decisions = ordered.map((p) => ({
      pr: p.number,
      action: "wait" as const,
      reason,
      headSha: p.headSha,
    }));
    const next: Decision | null =
      main === "missing"
        ? { pr: 0, action: "dispatch-ci", reason: "no CI run on main", headSha: "" }
        : null;
    return { main, decisions, next };
  }
  const decisions = ordered.map((p) => decidePull(p, ctx));
  const next =
    decisions.find((d) => d.action === "merge") ??
    decisions.find((d) => d.action === "update") ??
    null;
  return { main, decisions, next };
}

export type Run = { event: string; status: string; conclusion: string | null; created_at: string };

/** State of the CI runs (push or dispatch) of the current main commit. */
export function mainState(runs: Run[]): RunState {
  const relevant = runs
    .filter((r) => r.event === "push" || r.event === "workflow_dispatch")
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  if (relevant.some((r) => r.conclusion === "success")) return "success";
  if (relevant.some((r) => r.status !== "completed")) return "pending";
  return relevant.length ? "failure" : "missing";
}

export type CheckRun = {
  name: string;
  status: string;
  conclusion: string | null;
  id: number;
  app: { slug?: string } | null;
};

/** Latest GitHub Actions check run with this name on a commit. */
export function checkState(runs: CheckRun[], name: string): RunState {
  const latest = runs
    .filter((r) => r.name === name && r.app?.slug === "github-actions")
    .sort((a, b) => b.id - a.id)[0];
  if (!latest) return "missing";
  if (latest.status !== "completed") return "pending";
  return latest.conclusion === "success" ? "success" : "failure";
}
