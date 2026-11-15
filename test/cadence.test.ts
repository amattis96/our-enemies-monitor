import { describe, expect, it } from "vitest";
import {
  backlog,
  cadenceReport,
  categorize,
  ciSuccess,
  cutoffLag,
  mergeToIngest,
  prToMerge,
  summarize,
  toPrRecord,
  toRunRecord,
} from "../src/audit/cadence.ts";

// Fixture shaped like `gh pr list --json number,state,headRefName,createdAt,mergedAt,files`.
const prs = [
  {
    number: 1,
    state: "MERGED",
    headRefName: "research/osint-incremental-20261106",
    createdAt: "2026-11-06T00:00:00Z",
    mergedAt: "2026-11-06T04:00:00Z",
    files: [{ path: "sources/incremental/Fonte_09_x.md" }],
  },
  {
    number: 2,
    state: "MERGED",
    headRefName: "research/osint-incremental-20261107",
    createdAt: "2026-11-07T00:00:00Z",
    mergedAt: "2026-11-13T04:00:00Z",
    files: [
      { path: "sources/incremental/Fonte_10_x.md" },
      { path: "sources/incremental/Fonte_10.proposals.json" },
    ],
  },
  {
    number: 3,
    state: "MERGED",
    headRefName: "research/article-20261113",
    createdAt: "2026-11-13T02:00:00Z",
    mergedAt: "2026-11-13T08:00:00Z",
    files: [{ path: "content/articles/ART-0003.it.md" }],
  },
  {
    number: 4,
    state: "OPEN",
    headRefName: "research/osint-incremental-20261114",
    createdAt: "2026-11-14T00:00:00Z",
    mergedAt: null,
    files: [{ path: "sources/incremental/Fonte_11_x.md" }],
  },
  {
    number: 5,
    state: "OPEN",
    headRefName: "agent/ingest-fonte-10",
    createdAt: "2026-11-14T12:00:00Z",
    mergedAt: "",
    files: [{ path: "data/sources/S10.json" }],
  },
  {
    number: 6,
    state: "CLOSED",
    headRefName: "feat/x",
    createdAt: "2026-11-08T00:00:00Z",
    mergedAt: null,
    files: [{ path: "src/x.ts" }],
  },
].map(toPrRecord);

const runs = [
  ["CI", "push", "main", "success", "2026-11-13T04:00:10Z"],
  ["CI", "push", "main", "cancelled", "2026-11-13T04:00:20Z"],
  ["CI", "push", "main", "failure", "2026-11-13T04:00:30Z"],
  ["CI", "push", "feat/x", "failure", "2026-11-13T05:00:00Z"],
  ["CI", "pull_request", "research/a", "success", "2026-11-13T02:00:10Z"],
  ["CI", "pull_request", "research/b", "", "2026-11-14T00:00:10Z"],
  ["Deploy", "push", "main", "failure", "2026-11-13T04:01:00Z"],
].map(([workflowName, event, headBranch, conclusion, createdAt]) =>
  toRunRecord({ workflowName, event, headBranch, conclusion, createdAt }),
);

const sidecar = { path: "sources/incremental/Fonte_10.proposals.json", at: "2026-11-13T04:00:00Z" };
const sidecars = [sidecar];
const codeOf = (p: string) => (p.includes("Fonte_10") ? "S10" : null);

describe("cadence measures (B21)", () => {
  it("normalises gh rows and categorises PRs by path and branch", () => {
    expect(prs.at(0)?.files).toEqual(["sources/incremental/Fonte_09_x.md"]);
    expect(prs.at(4)?.mergedAt).toBeNull();
    expect(prs.map(categorize)).toEqual([
      "sources",
      "sources",
      "articles",
      "sources",
      "ingest",
      "other",
    ]);
  });

  it("K1 measures hours since the baseline last advanced at each source PR", () => {
    expect(cutoffLag(prs)).toEqual([
      { pr: 1, createdAt: "2026-11-06T00:00:00Z", baselinePr: null, hours: null },
      { pr: 2, createdAt: "2026-11-07T00:00:00Z", baselinePr: 1, hours: 20 },
      { pr: 4, createdAt: "2026-11-14T00:00:00Z", baselinePr: 2, hours: 20 },
    ]);
    expect(cutoffLag(prs, { since: "2026-11-10T00:00:00Z" }).map((r) => r.pr)).toEqual([4]);
  });

  it("K2 summarises creation-to-merge hours per category within the window", () => {
    const k2 = prToMerge(prs);
    expect(k2.sources).toEqual({ count: 2, median: 76, max: 148 });
    expect(k2.articles).toEqual({ count: 1, median: 6, max: 6 });
    expect(k2.ingest.count).toBe(0);
    expect(prToMerge(prs, { until: "2026-11-10T00:00:00Z" }).sources.count).toBe(1);
  });

  it("K3 pairs a merged sidecar with its later corpus document only", () => {
    expect(mergeToIngest(sidecars, [], codeOf)).toEqual([
      {
        sidecar: sidecar.path,
        code: "S10",
        mergedAt: sidecar.at,
        ingestedAt: null,
        hours: null,
      },
    ]);
    const corpus = [{ path: "data/sources/S10.json", at: "2026-11-15T04:00:00Z" }];
    expect(mergeToIngest(sidecars, corpus, codeOf).at(0)?.hours).toBe(48);
    const earlier = [{ path: "data/sources/S10.json", at: "2026-11-01T00:00:00Z" }];
    expect(mergeToIngest(sidecars, earlier, codeOf).at(0)?.ingestedAt).toBeNull();
    expect(mergeToIngest(sidecars, [], () => null)).toEqual([]);
  });

  it("K4 counts completed CI runs, push only on main, other workflows ignored", () => {
    const k4 = ciSuccess(runs);
    expect(k4.push_main).toEqual({
      completed: 3,
      success: 1,
      failure: 1,
      cancelled: 1,
      other: 0,
      success_rate: 0.333,
    });
    expect(k4.pull_request.completed).toBe(1);
    expect(ciSuccess([]).push_main.success_rate).toBeNull();
  });

  it("K5 reports open PRs and sidecars not ingested at a given instant", () => {
    const ingest = mergeToIngest(sidecars, [], codeOf);
    const k5 = backlog(prs, ingest, "2026-11-15T00:00:00Z");
    expect(k5.open_prs.sources).toEqual({ count: 1, oldest_hours: 24, numbers: [4] });
    expect(k5.open_prs.ingest.numbers).toEqual([5]);
    expect(k5.open_prs.other.count).toBe(0);
    expect(k5.sidecars_not_ingested).toEqual(["S10"]);
    // Before PR 2 merged it was still open, and no sidecar was on the ref.
    const past = backlog(prs, ingest, "2026-11-10T00:00:00Z");
    expect(past.open_prs.sources.numbers).toEqual([2]);
    expect(past.sidecars_not_ingested).toEqual([]);
  });

  it("produces the same report from the same inputs", () => {
    const input = {
      prs,
      runs,
      sidecars,
      corpus: [],
      codeOf,
      window: { since: "2026-11-06T00:00:00Z", until: "2026-11-15T00:00:00Z" },
      now: "2026-11-15T00:00:00Z",
    };
    const report = cadenceReport(input);
    expect(JSON.stringify(cadenceReport(input))).toBe(JSON.stringify(report));
    expect(report.k3_merge_to_ingest_hours.not_ingested).toBe(1);
    expect(summarize([3, 1, 2, 4])).toEqual({ count: 4, median: 2.5, max: 4 });
  });
});
