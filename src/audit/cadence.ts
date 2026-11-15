/**
 * B21 cadence measures (FABLE B §7.2, §8; ADR-08 entry condition). Pure
 * functions over `gh pr list` / `gh run list` JSON exports and `git log`
 * facts, so a cycle can be measured read-only and reproduced from the same
 * inputs. Nothing here calls the network or changes a schedule.
 *
 * Measures (K1–K5, named apart from the scheduling models M1–M6 of FABLE B):
 *   K1 cutoff lag     — at each daily source PR, hours since the research
 *                        baseline last advanced (last merged source PR)
 *   K2 PR → merge     — hours from creation to merge, per PR category
 *   K3 merge → ingest — hours from a sidecar reaching the ref to its corpus
 *                        document appearing in data/sources
 *   K4 CI success     — success share of completed CI runs, push vs PR
 *   K5 backlog        — open PRs per category with age, sidecars not ingested
 */

export type PrCategory = "sources" | "articles" | "ingest" | "other";

export type PrRecord = {
  number: number;
  state: string;
  headRefName: string;
  createdAt: string;
  mergedAt: string | null;
  files: string[];
};

export type RunRecord = {
  workflowName: string;
  event: string;
  headBranch: string;
  conclusion: string;
  createdAt: string;
};

/** A sidecar (or corpus document) first added on the measured ref. */
export type FileAddition = { path: string; at: string };

export type Window = { since?: string | undefined; until?: string | undefined };

const HOUR = 3_600_000;

const hours = (from: string, to: string): number =>
  Math.round(((Date.parse(to) - Date.parse(from)) / HOUR) * 10) / 10;

const inWindow = (at: string, window: Window): boolean =>
  (!window.since || Date.parse(at) >= Date.parse(window.since)) &&
  (!window.until || Date.parse(at) < Date.parse(window.until));

/** Normalise one `gh pr list --json number,state,headRefName,createdAt,mergedAt,files` row. */
export function toPrRecord(row: Record<string, unknown>): PrRecord {
  const files = Array.isArray(row.files)
    ? row.files.map((f) => (typeof f === "string" ? f : String((f as { path: unknown }).path)))
    : [];
  return {
    number: Number(row.number),
    state: String(row.state),
    headRefName: String(row.headRefName),
    createdAt: String(row.createdAt),
    mergedAt: typeof row.mergedAt === "string" && row.mergedAt !== "" ? row.mergedAt : null,
    files,
  };
}

/** Normalise one `gh run list --json workflowName,event,headBranch,conclusion,createdAt` row. */
export function toRunRecord(row: Record<string, unknown>): RunRecord {
  return {
    workflowName: String(row.workflowName),
    event: String(row.event),
    headBranch: String(row.headBranch),
    conclusion: String(row.conclusion ?? ""),
    createdAt: String(row.createdAt),
  };
}

const isSourcePath = (p: string) =>
  p.startsWith("sources/incremental/") || p.startsWith("sources/thematic/");

export function categorize(pr: PrRecord): PrCategory {
  if (pr.headRefName.startsWith("agent/ingest-")) return "ingest";
  if (pr.files.length > 0 && pr.files.every(isSourcePath)) return "sources";
  if (pr.files.length > 0 && pr.files.every((p) => p.startsWith("content/articles/")))
    return "articles";
  return "other";
}

/** A daily Task A PR: only sources, at least one under sources/incremental/. */
const isIncrementalSourcePr = (pr: PrRecord) =>
  categorize(pr) === "sources" && pr.files.some((p) => p.startsWith("sources/incremental/"));

export type Summary = { count: number; median: number | null; max: number | null };

export function summarize(values: number[]): Summary {
  if (values.length === 0) return { count: 0, median: null, max: null };
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const at = (i: number) => sorted[i] ?? 0;
  const median =
    sorted.length % 2 === 1 ? at(mid) : Math.round(((at(mid - 1) + at(mid)) / 2) * 10) / 10;
  return { count: sorted.length, median, max: at(sorted.length - 1) };
}

export type CutoffLagRow = {
  pr: number;
  createdAt: string;
  baselinePr: number | null;
  hours: number | null;
};

/** K1: for each incremental source PR created in the window. */
export function cutoffLag(prs: PrRecord[], window: Window = {}): CutoffLagRow[] {
  const merged = prs
    .filter((pr) => isIncrementalSourcePr(pr) && pr.mergedAt)
    .sort((a, b) => Date.parse(a.mergedAt as string) - Date.parse(b.mergedAt as string));
  return prs
    .filter((pr) => isIncrementalSourcePr(pr) && inWindow(pr.createdAt, window))
    .sort((a, b) => a.number - b.number)
    .map((pr) => {
      const before = merged.filter(
        (m) => Date.parse(m.mergedAt as string) <= Date.parse(pr.createdAt),
      );
      const last = before[before.length - 1];
      return {
        pr: pr.number,
        createdAt: pr.createdAt,
        baselinePr: last?.number ?? null,
        hours: last ? hours(last.mergedAt as string, pr.createdAt) : null,
      };
    });
}

/** K2: PRs merged in the window, per category. */
export function prToMerge(prs: PrRecord[], window: Window = {}): Record<PrCategory, Summary> {
  const out = {} as Record<PrCategory, Summary>;
  for (const category of ["sources", "articles", "ingest", "other"] as const) {
    out[category] = summarize(
      prs
        .filter((pr) => pr.mergedAt && inWindow(pr.mergedAt, window) && categorize(pr) === category)
        .map((pr) => hours(pr.createdAt, pr.mergedAt as string)),
    );
  }
  return out;
}

export type IngestLagRow = {
  sidecar: string;
  code: string;
  mergedAt: string;
  ingestedAt: string | null;
  hours: number | null;
};

/**
 * K3: `sidecars` are additions of `sources/incremental/*.proposals.json`,
 * `corpus` additions of `data/sources/<code>.json` (the corpus document the
 * first `pnpm ingest --write` creates, see `isIngested`). `codeOf` maps a
 * sidecar path to its source code. Rows for sidecars merged in the window.
 */
export function mergeToIngest(
  sidecars: FileAddition[],
  corpus: FileAddition[],
  codeOf: (sidecarPath: string) => string | null,
  window: Window = {},
): IngestLagRow[] {
  return sidecars
    .filter((s) => inWindow(s.at, window))
    .sort((a, b) => a.path.localeCompare(b.path))
    .flatMap((s) => {
      const code = codeOf(s.path);
      if (!code) return [];
      const added = corpus.find((c) => c.path === `data/sources/${code}.json`);
      const ingestedAt = added && Date.parse(added.at) >= Date.parse(s.at) ? added.at : null;
      return [
        {
          sidecar: s.path,
          code,
          mergedAt: s.at,
          ingestedAt,
          hours: ingestedAt ? hours(s.at, ingestedAt) : null,
        },
      ];
    });
}

export type CiRate = {
  completed: number;
  success: number;
  failure: number;
  cancelled: number;
  other: number;
  success_rate: number | null;
};

function rate(runs: RunRecord[]): CiRate {
  const count = (c: string) => runs.filter((r) => r.conclusion === c).length;
  const completed = runs.filter((r) => r.conclusion !== "").length;
  const success = count("success");
  const failure = count("failure");
  const cancelled = count("cancelled");
  return {
    completed,
    success,
    failure,
    cancelled,
    other: completed - success - failure - cancelled,
    success_rate: completed === 0 ? null : Math.round((success / completed) * 1000) / 1000,
  };
}

/** K4: completed runs of `workflow` created in the window; push runs only on `main`. */
export function ciSuccess(
  runs: RunRecord[],
  window: Window = {},
  workflow = "CI",
): { push_main: CiRate; pull_request: CiRate } {
  const selected = runs.filter((r) => r.workflowName === workflow && inWindow(r.createdAt, window));
  return {
    push_main: rate(selected.filter((r) => r.event === "push" && r.headBranch === "main")),
    pull_request: rate(selected.filter((r) => r.event === "pull_request")),
  };
}

export type Backlog = {
  open_prs: Record<PrCategory, { count: number; oldest_hours: number | null; numbers: number[] }>;
  sidecars_not_ingested: string[];
};

/** K5 at instant `now`: PRs created before `now` and not merged/closed by then. */
export function backlog(prs: PrRecord[], ingest: IngestLagRow[], now: string): Backlog {
  const open_prs = {} as Backlog["open_prs"];
  const openAt = (pr: PrRecord) =>
    Date.parse(pr.createdAt) <= Date.parse(now) &&
    (pr.mergedAt ? Date.parse(pr.mergedAt) > Date.parse(now) : pr.state === "OPEN");
  for (const category of ["sources", "articles", "ingest", "other"] as const) {
    const open = prs
      .filter((pr) => openAt(pr) && categorize(pr) === category)
      .sort((a, b) => a.number - b.number);
    open_prs[category] = {
      count: open.length,
      oldest_hours: open.length ? Math.max(...open.map((pr) => hours(pr.createdAt, now))) : null,
      numbers: open.map((pr) => pr.number),
    };
  }
  return {
    open_prs,
    sidecars_not_ingested: ingest
      .filter((row) => Date.parse(row.mergedAt) <= Date.parse(now))
      .filter((row) => !row.ingestedAt || Date.parse(row.ingestedAt) > Date.parse(now))
      .map((row) => row.code),
  };
}

export type CadenceReport = {
  measure: "b21-cadence";
  version: 1;
  window: { since: string | null; until: string | null };
  now: string;
  inputs: { prs: number; runs: number; sidecars_on_ref: number };
  k1_cutoff_lag_hours: { rows: CutoffLagRow[]; summary: Summary };
  k2_pr_to_merge_hours: Record<PrCategory, Summary>;
  k3_merge_to_ingest_hours: { rows: IngestLagRow[]; summary: Summary; not_ingested: number };
  k4_ci_success: { push_main: CiRate; pull_request: CiRate };
  k5_backlog: Backlog;
  notes: string[];
};

export function cadenceReport(input: {
  prs: PrRecord[];
  runs: RunRecord[];
  sidecars: FileAddition[];
  corpus: FileAddition[];
  codeOf: (sidecarPath: string) => string | null;
  window: Window;
  now: string;
}): CadenceReport {
  const { prs, runs, sidecars, corpus, codeOf, window, now } = input;
  const lag = cutoffLag(prs, window);
  const ingestAll = mergeToIngest(sidecars, corpus, codeOf);
  const ingest = mergeToIngest(sidecars, corpus, codeOf, window);
  return {
    measure: "b21-cadence",
    version: 1,
    window: { since: window.since ?? null, until: window.until ?? null },
    now,
    inputs: { prs: prs.length, runs: runs.length, sidecars_on_ref: sidecars.length },
    k1_cutoff_lag_hours: {
      rows: lag,
      summary: summarize(lag.flatMap((r) => (r.hours === null ? [] : [r.hours]))),
    },
    k2_pr_to_merge_hours: prToMerge(prs, window),
    k3_merge_to_ingest_hours: {
      rows: ingest,
      summary: summarize(ingest.flatMap((r) => (r.hours === null ? [] : [r.hours]))),
      not_ingested: ingest.filter((r) => r.ingestedAt === null).length,
    },
    k4_ci_success: ciSuccess(runs, window),
    k5_backlog: backlog(prs, ingestAll, now),
    notes: [
      "Categories: sources = only sources/incremental|thematic files; articles = only content/articles; ingest = agent/ingest-* head; other = everything else.",
      "K1 counts only PRs touching sources/incremental/; baseline = last such PR merged before creation.",
      "K3 uses the first addition of data/sources/<code>.json on the ref; a corpus document added before the sidecar does not count.",
      "K4 counts only completed runs; push runs only on main. A cancelled push run on main is a merge left untested.",
      "A cycle is one window (for example Friday 05:00 to the next Friday 05:00 Europe/Rome); ADR-08 asks for 2–4 of them.",
    ],
  };
}
