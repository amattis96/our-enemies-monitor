import { describe, expect, it } from "vitest";
import {
  type InferenceRegistry,
  isNegativeCaveat,
  readInferenceRegistry,
  validateInferenceRegistry,
} from "../src/editorial/inferences.ts";
import type { Dataset, Relationship } from "../src/model/index.ts";
import { readDataFiles } from "../src/pipeline/load.ts";
import { validateDataFiles } from "../src/pipeline/validate.ts";
import { exportFiles } from "../src/site/exports.ts";
import { annotationsFor, counterInferenceAudit } from "../src/site/inferences.ts";
import { publicationReport } from "../src/site/publication.ts";
import { buildReadModel } from "../src/site/read-model.ts";

const dataset = validateDataFiles(readDataFiles()).dataset;
const registry = readInferenceRegistry();
const report = publicationReport(dataset);
const model = buildReadModel(report.dataset);
const audit = counterInferenceAudit(registry, model);
const clone = <T>(value: T): T => structuredClone(value);
const errorsOf = (r: InferenceRegistry, d: Dataset = dataset) =>
  validateInferenceRegistry(r, d)
    .filter((i) => i.severity === "error")
    .map((i) => i.message);

type Entry = InferenceRegistry["forbidden_inferences"][number];
const P = "test fixture";
const fixtureEntry = (id: string, over: Partial<Entry>): Entry => ({
  id,
  pairs: [],
  statement: { it: "Affermazione di prova non sostenuta.", en: "Unsupported test statement." },
  declared_by: { kind: "source", source: null, record: "H07", locator: "fixture" },
  hypotheses: [],
  note: null,
  state: "proposta",
  proposed_by: P,
  reviewer: null,
  reviewed_on: null,
  lifted: null,
  ...over,
});
const reviewed = {
  state: "revisionata" as const,
  reviewer: "maintainer",
  reviewed_on: "2026-11-15",
};
const fixtureRegistry = (entries: Entry[]): InferenceRegistry => ({
  ...clone(registry),
  forbidden_inferences: entries,
});
const warningsOf = (r: InferenceRegistry, d: Dataset = dataset) =>
  validateInferenceRegistry(r, d)
    .filter((i) => i.severity === "warning")
    .map((i) => i.message);

describe("forbidden-inference registry (B15)", () => {
  it("validates against the canonical data with no errors and no warnings", () => {
    expect(validateInferenceRegistry(registry, dataset)).toEqual([]);
  });

  it("transcribes the nine Fonte_09 §8.3 pairs protected by fonte09.test.ts", () => {
    const fromFonte09 = registry.forbidden_inferences
      .filter((e) => e.declared_by.source === "S09")
      .flatMap((e) => e.pairs.map((p) => p.join("|")))
      .sort();
    expect(fromFonte09).toEqual(
      [
        "IRGC|NONAME057",
        "GRU|NONAME057",
        "RU|EXT-010",
        "RU|EXT-019",
        "RU|EXT-012",
        "RU|EXT-013",
        "IR|EXT-006",
        "STORM|EXT-020",
        "HAYI|SHAHIDKAVEH",
      ].sort(),
    );
    // Ten lines in §8.3: two name no canonical node and keep no pair.
    expect(
      registry.forbidden_inferences.filter((e) => e.declared_by.source === "S09"),
    ).toHaveLength(10);
  });

  it("classifies negative caveats per relationship, not by the word «non»", () => {
    const base = dataset.relationships[0];
    if (!base) throw new Error("no relationship");
    const rel = (id: string, it: string) =>
      ({ ...clone(base), id, caveat: { it } }) as Relationship;
    const d = clone(dataset);
    d.relationships = [
      rel("G-9001", "Dolo non provato"),
      rel("G-9002", "Pianificato, non operativo"),
    ];
    expect(isNegativeCaveat(d.relationships[0] as Relationship)).toBe(true);
    const r = clone(registry);
    r.forbidden_inferences = [];
    r.caveat_classifications = [
      {
        relationship: "G-9001",
        categories: ["not_established"],
        interrupts_composition: true,
        note: null,
        state: "proposta",
        proposed_by: P,
        reviewer: null,
        reviewed_on: null,
      },
      {
        relationship: "G-9002",
        categories: ["scope_precision"],
        interrupts_composition: false,
        note: null,
        state: "proposta",
        proposed_by: P,
        reviewer: null,
        reviewed_on: null,
      },
    ];
    expect(validateInferenceRegistry(r, d)).toEqual([]);
    r.caveat_classifications.pop();
    expect(warningsOf(r, d)).toEqual([
      "G-9002: caveat contains a negation but has no classification in the registry",
    ]);
  });

  it("blocks a direct edge on a reviewed forbidden pair, warns on a proposal, ignores a lifted one", () => {
    const withEdge = clone(dataset);
    const base = withEdge.relationships[0];
    if (!base) throw new Error("no relationship");
    withEdge.relationships.push({
      ...base,
      id: "G-9999",
      subject: "X",
      object: "US",
    } as Relationship);
    const pair: [string, string] = ["US", "X"];
    const hit = (m: string) => m.includes("G-9999");

    const proposal = fixtureRegistry([fixtureEntry("FI-901", { pairs: [pair] })]);
    expect(errorsOf(proposal, withEdge).some(hit)).toBe(false);
    expect(warningsOf(proposal, withEdge).some(hit)).toBe(true);

    const declared = fixtureRegistry([fixtureEntry("FI-901", { pairs: [pair], ...reviewed })]);
    expect(errorsOf(declared, withEdge).some(hit)).toBe(true);

    const lifted = fixtureRegistry([
      fixtureEntry("FI-901", {
        pairs: [pair],
        ...reviewed,
        lifted: { on: "2026-11-15", by: "maintainer", source: "S01", note: "test fixture lift" },
      }),
    ]);
    expect([...errorsOf(lifted, withEdge), ...warningsOf(lifted, withEdge)].some(hit)).toBe(false);
  });

  it("enforces the authority rule on review states", () => {
    const bad = clone(registry);
    const [first, second, third] = bad.forbidden_inferences;
    if (!first || !second || !third) throw new Error("registry too small");
    first.declared_by.kind = "maintainer";
    second.reviewer = "someone";
    third.lifted = {
      on: "2026-11-15",
      by: "maintainer",
      source: "S09",
      note: "lifted without review",
    };
    const errors = errorsOf(bad);
    expect(errors.some((m) => m.includes("only the maintainer declares"))).toBe(true);
    expect(errors.some((m) => m.includes("proposta must not carry reviewer"))).toBe(true);
    expect(errors.some((m) => m.includes("only a revisionata entry can be lifted"))).toBe(true);
  });
});

describe("counter-inference audit (FABLE A E4)", () => {
  it("annotates the paths of H06, H15 and H07 (3/3)", () => {
    const interrupted = (id: string) =>
      annotationsFor(audit, id).find((a) => a.origin.id === id)?.interrupted_at;
    expect(interrupted("H06")).toEqual(["G-0087"]);
    expect(interrupted("H07")).toEqual(["G-0078", "G-0072"]);
    expect(interrupted("H15")).toEqual(["G-0429", "G-0427"]);
  });

  it("publishes unreviewed entries only with canonical pairs and no named person", () => {
    const r = fixtureRegistry([
      fixtureEntry("FI-901", {}),
      fixtureEntry("FI-902", { ...reviewed }),
      fixtureEntry("FI-903", { pairs: [["KERIMOV", "SPACEX"]], hypotheses: ["H06"] }),
      fixtureEntry("FI-904", { pairs: [["KERIMOV", "SPACEX"]], hypotheses: ["H06"], ...reviewed }),
      fixtureEntry("FI-905", { pairs: [["US", "X"]], hypotheses: ["H07"] }),
    ]);
    const a = counterInferenceAudit(r, model);
    expect(a.forbidden_inferences.map((e) => e.id)).toEqual(["FI-902", "FI-904", "FI-905"]);
    expect(a.forbidden_inferences_not_public).toBe(2);
    // The forbidden pair X–US merges into H07's own pair instead of a second row.
    const h07 = a.flagged_paths.filter((p) => p.hypotheses.includes("H07"));
    expect(h07).toHaveLength(1);
    expect(h07[0]?.forbidden_by).toEqual(["FI-905"]);
    const merged = counterInferenceAudit(
      fixtureRegistry([fixtureEntry("FI-906", { pairs: [["US", "X"]], hypotheses: ["H15"] })]),
      model,
    ).flagged_paths.find((p) => p.origin.id === "H07");
    expect(merged?.hypotheses).toEqual(["H07", "H15"]);
  });

  it("never names a withheld record and counts non-public entries", () => {
    const visible = new Set(
      (Object.keys(report.dataset) as (keyof Dataset)[]).flatMap((n) =>
        report.dataset[n].map((r) => r.id),
      ),
    );
    const named = [
      ...audit.forbidden_inferences.flatMap((e) => [
        ...e.pairs.flat(),
        ...e.hypotheses,
        e.declared_by.source,
        e.declared_by.record,
      ]),
      ...audit.caveat_classifications.map((c) => c.relationship),
      ...audit.flagged_paths.flatMap((a) => [
        ...a.pair,
        ...a.hypotheses,
        ...a.path.flatMap((s) => [s.relationship, s.subject, s.object]),
      ]),
    ].filter((id): id is string => id !== null);
    expect(named.filter((id) => !visible.has(id))).toEqual([]);
    expect(audit.forbidden_inferences_not_public).toBe(
      registry.forbidden_inferences.length - audit.forbidden_inferences.length,
    );
  });

  it("is published as data/v1/inferences.json and listed in the catalog", () => {
    const files = exportFiles(report, { commit: null, commit_date: null }, [], registry);
    const file = files.find((f) => f.path === "inferences.json");
    expect(JSON.parse(file?.text ?? "null")).toEqual(JSON.parse(JSON.stringify(audit)));
    const catalog = JSON.parse(files.find((f) => f.path === "index.json")?.text ?? "{}");
    expect(catalog.datasets.map((d: { path: string }) => d.path)).toContain("inferences.json");
  });
});
