import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EVIDENCE_LEVELS, RELATION_GROUPS, THEMES } from "../src/model/index.ts";
import { repoPath } from "../src/pipeline/paths.ts";
import { cardTilt, layoutBoard } from "../src/site/board-layout.ts";
import type { TimelineItem } from "../src/site/read-model.ts";
import {
  DEFAULT_FILTERS,
  matches,
  orderTimeline,
  parseFilters,
  serializeFilters,
  yearCounts,
} from "../src/site/timeline.ts";
import {
  EVIDENCE_THREAD,
  RELATION_GROUP_COLOR,
  RELATION_GROUP_ORDER,
  referencedIcons,
} from "../src/site/visual.ts";

const sprite = readFileSync(repoPath("docs/design/assets/icons.svg"), "utf8");
const symbols = new Set([...sprite.matchAll(/<symbol id="([^"]+)"/g)].map((m) => m[1]));

describe("Dossier visual vocabulary", () => {
  it("has a sprite symbol for every theme, kind, relation group, evidence level and review status", () => {
    const missing = referencedIcons(THEMES).filter((id) => !symbols.has(id));
    expect(missing).toEqual([]);
  });

  it("gives every relation group a colour token and a legend position", () => {
    for (const group of RELATION_GROUPS) {
      expect(RELATION_GROUP_COLOR[group]).toMatch(/^var\(--series-/);
    }
    expect([...RELATION_GROUP_ORDER].sort()).toEqual([...RELATION_GROUPS].sort());
  });

  it("encodes evidence levels by distinct thread patterns, never by colour", () => {
    const patterns = EVIDENCE_LEVELS.map((level) => JSON.stringify(EVIDENCE_THREAD[level]));
    expect(new Set(patterns).size).toBe(EVIDENCE_LEVELS.length);
  });
});

const item = (id: string, start: string, extra: Partial<TimelineItem> = {}): TimelineItem => ({
  id,
  title: id,
  start,
  end: null,
  precision: start.length === 4 ? "year" : start.length === 7 ? "month" : "day",
  themes: ["cyber"],
  evidence_note: null,
  geography: null,
  pending: false,
  metadata: false,
  evidence_level: null,
  places: [],
  ...extra,
});

describe("timeline presentation", () => {
  const items = [
    item("A", "2007-04"),
    item("B", "2026-10-20"),
    item("C", "2026"),
    item("D", "2015-01-02"),
  ];

  it("orders newest first by default, with year-only dates after finer dates of the same year", () => {
    expect(orderTimeline(items, "newest").map((i) => i.id)).toEqual(["B", "C", "D", "A"]);
    expect(orderTimeline(items, "oldest").map((i) => i.id)).toEqual(["A", "D", "C", "B"]);
  });

  it("counts every year in the range, zeros included", () => {
    const counts = yearCounts(items);
    expect(counts[0]).toEqual({ year: 2007, count: 1 });
    expect(counts.at(-1)).toEqual({ year: 2026, count: 2 });
    expect(counts).toHaveLength(20);
    expect(counts.find((c) => c.year === 2010)?.count).toBe(0);
  });

  it("keeps the ?tema= deep link and round-trips filters through the URL", () => {
    expect(parseFilters("?tema=cyber").theme).toBe("cyber");
    expect(parseFilters("?theme=energy").theme).toBe("energy");
    const filters = {
      ...DEFAULT_FILTERS,
      theme: "cyber",
      from: 2020,
      to: 2024,
      query: "Baltico",
      order: "oldest" as const,
    };
    expect(parseFilters(serializeFilters(filters))).toEqual(filters);
    expect(serializeFilters(DEFAULT_FILTERS)).toBe("");
  });

  it("filters by theme, period, pending status and text", () => {
    const pending = item("E", "2024-05", { pending: true, geography: "Mar Baltico" });
    expect(matches(pending, { ...DEFAULT_FILTERS, pending: false })).toBe(false);
    expect(matches(pending, { ...DEFAULT_FILTERS, query: "baltico" })).toBe(true);
    expect(matches(pending, { ...DEFAULT_FILTERS, from: 2025, to: 2026 })).toBe(false);
    expect(matches(pending, { ...DEFAULT_FILTERS, theme: "energy" })).toBe(false);
  });
});

describe("evidence board layout", () => {
  const nodes = ["a", "b", "c", "d", "e"].map((id) => ({ id }));
  const edges = [
    { source: "a", target: "b" },
    { source: "b", target: "c" },
    { source: "d", target: "a", weak: true },
    { source: "e", target: "e" },
  ];

  it("is deterministic and positions every node with finite coordinates", () => {
    const first = layoutBoard(nodes, edges, { ticks: 120 });
    const second = layoutBoard([...nodes].reverse(), edges, { ticks: 120 });
    expect(second).toEqual(first);
    expect(Object.keys(first).sort()).toEqual(["a", "b", "c", "d", "e"]);
    for (const [x, y] of Object.values(first)) {
      expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
    }
  });

  it("tilts cards by a stable angle within ±3°", () => {
    expect(cardTilt("VOE")).toBe(cardTilt("VOE"));
    for (const id of ["A", "TL-0060", "G-0001", "Z"]) {
      expect(Math.abs(cardTilt(id))).toBeLessThanOrEqual(3);
    }
  });
});
