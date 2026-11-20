import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { e7IndependentRoots } from "../src/audit/baseline.ts";
import type { Dataset, Source } from "../src/model/index.ts";
import {
  corpusOnlyE1,
  type GenealogySource,
  genealogyCycles,
  genealogyIssues,
  independentRoots,
} from "../src/pipeline/genealogy.ts";
import { readDataFiles } from "../src/pipeline/load.ts";
import { REPO_ROOT } from "../src/pipeline/paths.ts";
import { validateDataFiles } from "../src/pipeline/validate.ts";

const ext = (id: string, extra: Partial<GenealogySource> = {}): GenealogySource => ({
  id,
  type: "external_reference",
  ...extra,
});
const corpus = (id: string, derived_from?: string[]): GenealogySource => ({
  id,
  type: "corpus_document",
  origin_type: "corpus_synthesis",
  ...(derived_from ? { derived_from } : {}),
});

// EXT-005-like case (A §4.7): ministry statement, a wire reporting it, the
// wire republished elsewhere. Three references, one root.
const ministry = ext("WEB-EXT-005", { origin_type: "official_statement" });
const wire = ext("WEB-EXT-006", { origin_type: "wire", relies_on: ["WEB-EXT-005"] });
const copy = ext("WEB-EXT-051", { origin_type: "republication", derived_from: ["WEB-EXT-006"] });

describe("independent roots (ADR-05)", () => {
  it("counts a statement, its wire and a republication as one root", () => {
    const sources = [ministry, wire, copy];
    expect(independentRoots(["WEB-EXT-005", "WEB-EXT-006", "WEB-EXT-051"], sources)).toEqual({
      references: ["WEB-EXT-005", "WEB-EXT-006", "WEB-EXT-051"],
      roots: ["WEB-EXT-005"],
      undetermined: [],
      corpus_only: false,
    });
  });

  it("never counts a corpus synthesis as a root", () => {
    const sources = [corpus("S00"), corpus("S06", ["S00"])];
    expect(independentRoots(["S06", "S00"], sources)).toMatchObject({
      roots: [],
      corpus_only: true,
    });
  });

  it("counts sources without genealogy as their own, undetermined, root", () => {
    const sources = [ext("WEB-EXT-001"), ext("WEB-EXT-002")];
    expect(independentRoots(["WEB-EXT-001", "WEB-EXT-002"], sources)).toMatchObject({
      roots: ["WEB-EXT-001", "WEB-EXT-002"],
      undetermined: ["WEB-EXT-001", "WEB-EXT-002"],
    });
  });

  it("cuts cycles instead of looping", () => {
    const sources = [ext("A", { derived_from: ["B"] }), ext("B", { derived_from: ["A"] })];
    expect(independentRoots(["A"], sources).roots).toEqual([]);
  });
});

describe("genealogy validation", () => {
  it("reports each cycle once, rotated to its smallest ID", () => {
    const sources = [
      ext("C", { derived_from: ["A"] }),
      ext("A", { relies_on: ["B"] }),
      ext("B", { derived_from: ["C"] }),
    ];
    expect(genealogyCycles(sources)).toEqual([["A", "B", "C"]]);
    expect(genealogyIssues(sources)).toEqual([
      { severity: "error", id: "A", message: "circular genealogy: A → B → C → A" },
    ]);
  });

  it("rejects missing and self references and misplaced corpus_synthesis", () => {
    const messages = genealogyIssues([
      ext("A", { derived_from: ["A"], relies_on: ["Z"] }),
      ext("B", { origin_type: "corpus_synthesis" }),
      { id: "S01", type: "corpus_document", origin_type: "wire" },
    ]).map((i) => `${i.severity} ${i.id} ${i.message}`);
    expect(messages).toEqual([
      "error A derived_from cites itself",
      'error A relies_on "Z" does not exist',
      "error B origin_type corpus_synthesis is reserved for corpus documents",
      'error S01 corpus document with origin_type "wire"',
    ]);
  });

  it("warns on a republication that does not say what it republishes", () => {
    expect(genealogyIssues([ext("A", { origin_type: "republication" })])).toEqual([
      {
        severity: "warning",
        id: "A",
        message: "republication without derived_from: counted as its own root",
      },
    ]);
  });

  it("flags E1 records resting only on corpus syntheses, and only those", () => {
    const sources = [corpus("S00"), ext("F02")];
    const records = [
      { id: "G-2", evidence_level: "E1", sources: ["S00"] },
      { id: "G-1", evidence_level: "E1", sources: ["S00", "F02"] },
      { id: "G-3", evidence_level: "E2", sources: ["S00"] },
      { id: "G-4", evidence_level: "E1", sources: ["S99"] },
    ];
    expect(corpusOnlyE1(records, sources)).toEqual(["G-2"]);
  });
});

describe("canonical data", () => {
  const { issues, dataset } = validateDataFiles(readDataFiles());

  it("has no genealogy errors and declares the corpus consolidations", () => {
    expect(issues.filter((i) => i.severity === "error")).toEqual([]);
    const s08 = dataset.sources.find((s) => s.id === "S08");
    expect(s08?.derived_from).toEqual(["S00", "S01", "S02", "S03", "S04", "S05", "S06", "S07"]);
    for (const s of dataset.sources)
      expect(s.origin_type === "corpus_synthesis", s.id).toBe(s.type === "corpus_document");
  });

  it("computes A E7 from derived_from alone (B17 acceptance)", () => {
    // The historical S09 cohort is fixed; newer S12+ candidates legitimately
    // add EXT-035+ events and must not invalidate the B17 baseline acceptance.
    const baseline: Dataset = {
      ...dataset,
      events: dataset.events.filter(
        (event) => event.id.startsWith("EXT-") && Number(event.id.slice(4)) <= 34,
      ),
    };
    const e7 = e7IndependentRoots(baseline);
    expect(e7.ext_events_with_external_refs).toBe(34);
    expect(e7.single_reference).toBe(18);
    // Same function, genealogy filled in memory: the count moves with the
    // fields, not with publisher text.
    const withGenealogy: Dataset = {
      ...baseline,
      sources: baseline.sources.map((s) => {
        const fix = [ministry, wire, copy].find((g) => g.id === s.id);
        return fix ? { ...s, ...fix } : s;
      }),
    };
    const after = e7IndependentRoots(withGenealogy);
    expect(after.single_root).toBe(e7.single_root + 2);
    expect(after.single_root_ids).toEqual(expect.arrayContaining(["EXT-005", "EXT-034"]));
  });
});

describe("pilot proposal file (docs/audit/sources/pilot.v1.json)", () => {
  type Pilot = {
    state: string;
    claims: {
      record: string;
      current_sources: string[];
      candidate_sources: string[];
      state: string;
      verified_by: unknown;
    }[];
    genealogy: { source: string; state: string }[];
  };
  const pilot = JSON.parse(
    readFileSync(path.join(REPO_ROOT, "docs/audit/sources/pilot.v1.json"), "utf8"),
  ) as Pilot;
  const { dataset } = validateDataFiles(readDataFiles());
  const ids = new Set(
    (Object.keys(dataset) as (keyof Dataset)[]).flatMap((n) => dataset[n].map((r) => r.id)),
  );

  it("stays a proposal that cites only existing records", () => {
    expect(pilot.state).toBe("proposta");
    for (const c of pilot.claims) {
      expect(c.state, c.record).toBe("proposta");
      expect(c.verified_by, c.record).toBeNull();
      for (const id of [c.record, ...c.current_sources, ...c.candidate_sources])
        expect(ids, c.record).toContain(id);
    }
  });

  it("proposes a genealogy that would validate", () => {
    const proposed = new Map(pilot.genealogy.map((g) => [g.source, g]));
    const sources = dataset.sources.map((s) => {
      const g = proposed.get(s.id) as
        | {
            origin_type: Source["origin_type"];
            derived_from: string[] | null;
            relies_on: string[] | null;
          }
        | undefined;
      if (!g) return s;
      return {
        ...s,
        origin_type: g.origin_type,
        ...(g.derived_from ? { derived_from: g.derived_from } : {}),
        ...(g.relies_on ? { relies_on: g.relies_on } : {}),
      };
    });
    expect(pilot.genealogy.every((g) => ids.has(g.source) && g.state === "proposta")).toBe(true);
    expect(genealogyIssues(sources).filter((i) => i.severity === "error")).toEqual([]);
  });
});
