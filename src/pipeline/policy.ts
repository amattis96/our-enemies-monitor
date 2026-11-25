import type { PathChange } from "./changes.ts";
import type { Flag } from "./diff.ts";

/**
 * Pull request policy: which paths a branch may change, and whether the
 * maintainer's waiver label counts. Pure functions: the CLIs collect the data
 * (Git, GitHub API) and pass it in.
 *
 * Limit: the policy keys on the branch name and runs in the PR's own workflow,
 * so it is a review aid, not a barrier. The real barrier is the repository
 * ruleset (code owner review, machine account confined to research/* and
 * agent/*). A rule on the PR author (D-B02-5) would hook in `checkPolicy`.
 */

export const WAIVER_LABEL = "evidence-waiver";

export type BranchClass = "research" | "ingest" | "dependabot-actions" | "free";

export function branchClass(headRef: string): BranchClass {
  if (headRef.startsWith("research/")) return "research";
  if (headRef.startsWith("agent/ingest-")) return "ingest";
  if (headRef.startsWith("dependabot/github_actions/")) return "dependabot-actions";
  return "free"; // other agent/**, maintainer branches, forks: no path restriction
}

type Allowed = { prefix: string; statuses: readonly string[] };

const RULES: Record<Exclude<BranchClass, "free">, { allowed: Allowed[]; label: string }> = {
  research: {
    allowed: [
      { prefix: "sources/incremental/", statuses: ["A"] },
      { prefix: "sources/thematic/", statuses: ["A"] },
      { prefix: "content/articles/", statuses: ["A", "M"] },
    ],
    label:
      "research/* branches (sources/incremental and sources/thematic: add only; content/articles: add or edit)",
  },
  ingest: {
    allowed: [{ prefix: "data/", statuses: ["A", "M", "D"] }],
    label: "agent/ingest-* branches (data/ only)",
  },
  "dependabot-actions": {
    allowed: [
      { prefix: ".github/workflows/", statuses: ["M"] },
      { prefix: ".github/dependabot.yml", statuses: ["M"] },
    ],
    label: "dependabot GitHub Actions branches (.github/workflows and dependabot.yml, modify only)",
  },
};

const error = (id: string, message: string): Flag => ({
  severity: "error",
  id,
  message,
  waivable: false,
});

/** Rules that hold on every branch: immutable sources, links, odd paths. */
export function checkGlobal(changes: PathChange[]): Flag[] {
  const flags: Flag[] = [];
  for (const change of changes) {
    const { path: file, status, mode } = change;
    if (file.startsWith("/") || file.split("/").includes("..")) {
      flags.push(error(file, "path escapes the repository"));
    }
    if (file.startsWith("sources/original/")) {
      flags.push(error(file, `sources/original/ is immutable (status ${status})`));
    } else if (file.startsWith("sources/incremental/") && status !== "A") {
      flags.push(
        error(file, `sources/incremental/ is immutable: only additions (status ${status})`),
      );
    }
    if (status !== "D" && (mode === "120000" || mode === "160000")) {
      flags.push(
        error(file, `${mode === "120000" ? "symbolic link" : "submodule"} is not allowed`),
      );
    }
  }
  return flags;
}

/** Path policy of a branch class plus the global rules. All errors are non-waivable. */
export function checkPolicy(headRef: string, changes: PathChange[]): Flag[] {
  const flags = checkGlobal(changes);
  const kind = branchClass(headRef);
  if (kind === "free") return flags;
  const { allowed, label } = RULES[kind];
  for (const change of changes) {
    const rule = allowed.find((a) => change.path.startsWith(a.prefix));
    if (!rule) {
      flags.push(error(change.path, `outside the paths allowed for ${label}`));
    } else if (!rule.statuses.includes(change.status)) {
      flags.push(
        error(
          change.path,
          `status ${change.status} is not allowed under ${rule.prefix} for ${label}`,
        ),
      );
    }
  }
  return flags;
}

/**
 * Control plane: files that decide what the PR checks enforce or what gets
 * published. The checks run the PR head's own code, so a PR can rewrite them;
 * this list only makes such a change visible (attention, never a barrier).
 * The barrier is a GitHub ruleset requiring code owner review on these paths
 * (`.github/CODEOWNERS`) — a maintainer setting, not enforced here.
 */
export const CONTROL_PLANE: readonly string[] = [
  ".github/",
  "src/cli/check-",
  "src/cli/pr-policy.ts",
  "src/cli/data-diff.ts",
  "src/cli/validate",
  "src/cli/audit-m5.ts",
  "src/pipeline/policy.ts",
  "src/pipeline/diff.ts",
  "src/pipeline/changes.ts",
  "src/pipeline/evidence-policy.ts",
  "src/pipeline/article-",
  "src/pipeline/validate.ts",
  "src/security/",
  "src/site/publication.ts",
  "src/site/surface.ts",
  "docs/roadmap/plan.v1.json",
  "docs/quality/thresholds.v1.json",
  "docs/quality/sets/",
  "docs/audit/inferences/registry.v1.json",
  "docs/automation/engine.manifest.json",
  "src/discovery/path-grammar.v1.json",
  "docs/security/",
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "AGENTS.md",
  "CLAUDE.md",
];

export function isControlPlane(file: string): boolean {
  return CONTROL_PLANE.some((prefix) => file.startsWith(prefix));
}

/** One attention flag per changed control-plane file, on every branch. */
export function controlPlaneFlags(changes: PathChange[]): Flag[] {
  return changes
    .filter((c) => isControlPlane(c.path))
    .map((c) => ({
      severity: "attention" as const,
      id: c.path,
      message: `changes the PR controls (status ${c.status}): this check runs the PR's own code, so only a code owner review required by a GitHub ruleset protects it`,
    }));
}

export type LabelEvent = {
  event: string;
  label: string;
  actor: string;
  createdAt: string;
};

/** A workflow run as listed by the GitHub API, reduced to what the waiver rule needs. */
export type RunInfo = {
  event: string;
  /** Workflow file path, e.g. `.github/workflows/ci.yml@refs/pull/7/merge`. */
  path: string;
  createdAt: string;
  /** Numbers of the pull requests the run is attached to. */
  pullRequests: number[];
};

/**
 * Moment from which a waiver label may count for the current head commit: the
 * latest `ci.yml` run of THIS pull request for that SHA (it starts only on
 * opened/synchronize/reopened, never on label events, so it dates the push;
 * the latest one handles a force push back to an older SHA) or the head
 * commit's committer date, whichever is later. Null when no such run exists
 * (e.g. fork PRs list no pull requests): the waiver is then ignored.
 */
export function pushLowerBound(
  runs: RunInfo[],
  pr: number,
  committerDate: string | null,
): string | null {
  const own = runs
    .filter(
      (r) =>
        r.event === "pull_request" &&
        r.path.startsWith(".github/workflows/ci.yml") &&
        r.pullRequests.includes(pr),
    )
    .map((r) => r.createdAt);
  if (own.length === 0) return null;
  const dates = [...own, ...(committerDate ? [committerDate] : [])];
  return dates.reduce((a, b) => (Date.parse(a) >= Date.parse(b) ? a : b));
}

export type WaiverContext = {
  /** Current labels of the PR (live, not the event payload). */
  labels: string[];
  /** Issue events of the PR in chronological order. */
  events: LabelEvent[];
  /** Login of the maintainer (`vars.MAINTAINER_LOGIN`, else the repository owner): the only actor whose label counts. */
  owner: string;
  /** `pull_request` action of this run. */
  action: string;
  /** `pushLowerBound` of the head commit (ISO), or null if unknown. */
  pushedAt: string | null;
};

/**
 * Does the label waive the waivable errors for the current head commit?
 * Valid only if the label is present now, the last event on it is a `labeled`
 * by the maintainer, that event is later than the push of the head commit, and this
 * run is not a `synchronize` (a push expires the waiver).
 */
export function waiverStatus(ctx: WaiverContext): { valid: boolean; reason: string } {
  if (!ctx.labels.includes(WAIVER_LABEL)) return { valid: false, reason: "label not present" };
  if (ctx.action === "synchronize") {
    return { valid: false, reason: "new commits pushed: the waiver expires and must be reapplied" };
  }
  const last = ctx.events
    .filter((e) => e.label === WAIVER_LABEL && /^(un)?labeled$/.test(e.event))
    .at(-1);
  if (!last || last.event !== "labeled") {
    return { valid: false, reason: "no matching labeled event" };
  }
  if (last.actor !== ctx.owner) {
    return {
      valid: false,
      reason: `label applied by ${last.actor}, not the maintainer (${ctx.owner}): ignored`,
    };
  }
  if (ctx.pushedAt === null) {
    return { valid: false, reason: "cannot establish when the head commit was pushed" };
  }
  if (Date.parse(last.createdAt) <= Date.parse(ctx.pushedAt)) {
    return { valid: false, reason: "label predates the current head commit: reapply it" };
  }
  return { valid: true, reason: `applied by ${ctx.owner} after the current head commit` };
}
