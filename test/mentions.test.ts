import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { e6MentionsWithoutEdge } from "../src/audit/baseline.ts";
import {
  buildMentionReport,
  entitySegments,
  MENTION_OUTCOMES,
  MentionExclusionsSchema,
  MentionReviewSchema,
  renderMentionReportMarkdown,
  scanMentions,
  wilson95,
} from "../src/audit/mentions.ts";
import { readDataFiles } from "../src/pipeline/load.ts";
import { REPO_ROOT } from "../src/pipeline/paths.ts";
import { validateDataFiles } from "../src/pipeline/validate.ts";

const read = (file: string): unknown =>
  JSON.parse(readFileSync(path.join(REPO_ROOT, "docs/audit/mentions", file), "utf8"));
const exclusions = MentionExclusionsSchema.parse(read("exclusions.v1.json"));
const review = MentionReviewSchema.parse(read("review.v1.json"));
const dataset = validateDataFiles(readDataFiles()).dataset;
const report = buildMentionReport(dataset, exclusions, review);

describe("B14 text-graph queue", () => {
  it("shares the B12 E6 matcher: raw mentions are exactly the baseline pairs", () => {
    const e6 = e6MentionsWithoutEdge(dataset);
    expect(scanMentions(dataset).map(({ event, entity }) => ({ event, entity }))).toEqual(e6.rows);
    expect(report.summary.raw_mentions).toBe(e6.mentions);
  });

  it("applies the versioned exclusions and keeps every excluded mention listed", () => {
    expect(report.summary.raw_mentions).toBe(
      report.summary.queue + report.summary.excluded_mentions,
    );
    expect(report.excluded.every((e) => e.reason.length > 0)).toBe(true);
    expect(report.queue.some((r) => r.entity === "WAGNER" && r.segment === "collegati")).toBe(
      false,
    );
  });

  it("has no stale exclusion and no review entry outside the queue", () => {
    expect(report.summary.unused_exclusions).toEqual([]);
    expect(report.summary.orphan_reviews).toEqual([]);
  });

  it("review entries are unique, valid and never silently human-approved", () => {
    const keys = review.entries.map((e) => `${e.event}|${e.entity}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const entry of review.entries) {
      expect(MENTION_OUTCOMES).toContain(entry.outcome);
      if (entry.state === "proposta") expect(entry.reviewer).toBeUndefined();
    }
  });

  it("rejects a proposta with a reviewer and a revisionata without one", () => {
    const base = {
      event: "TL-0001",
      entity: "X",
      outcome: "context-only",
      proposed_by: "t",
      note: "n",
    };
    const wrap = (entry: object) => ({
      review_set: "text-graph-mentions",
      version: 1,
      as_of_commit: "ab870b8",
      notes: [],
      entries: [entry],
    });
    expect(
      MentionReviewSchema.safeParse(wrap({ ...base, state: "proposta", reviewer: "A" })).success,
    ).toBe(false);
    expect(MentionReviewSchema.safeParse(wrap({ ...base, state: "revisionata" })).success).toBe(
      false,
    );
    expect(
      MentionReviewSchema.safeParse(
        wrap({ ...base, state: "revisionata", reviewer: "A", reviewed_on: "2026-11-16" }),
      ).success,
    ).toBe(true);
  });

  it("splits names into folded segments of at least five characters", () => {
    expect(entitySegments("Rete Wagner / collegati")).toEqual(["rete wagner", "collegati"]);
    expect(entitySegments("SHAHID KAVEH (unità)")).toEqual(["shahid kaveh", "unita"]);
    expect(entitySegments("AP")).toEqual([]);
  });

  it("reports sampled precision from the review entries only", () => {
    const sample = report.sampled_precision;
    expect(sample.sample_size).toBe(review.entries.length);
    const total = MENTION_OUTCOMES.reduce((sum, o) => sum + sample.by_outcome[o], 0);
    expect(total).toBe(sample.sample_size);
    expect(wilson95(0, 0)).toBeNull();
    const [low, high] = wilson95(13, 26) ?? [0, 0];
    expect(low).toBeLessThan(50);
    expect(high).toBeGreaterThan(50);
  });

  it("is deterministic and renders the unreviewed caveat", () => {
    const again = buildMentionReport(dataset, exclusions, review);
    expect(JSON.stringify(again)).toBe(JSON.stringify(report));
    const text = renderMentionReportMarkdown(report, null);
    expect(text).toContain("Una menzione non è un ruolo");
    expect(text).toContain("proposta");
  });

  it("does not write to data/: report building leaves the dataset untouched", () => {
    const before = JSON.stringify(dataset);
    buildMentionReport(dataset, exclusions, review);
    expect(JSON.stringify(dataset)).toBe(before);
  });
});
