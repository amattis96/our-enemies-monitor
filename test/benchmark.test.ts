import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  e5CoParticipation,
  isNegativeCaveat,
  mulberry32,
  shortestPath,
} from "../src/audit/baseline.ts";
import {
  assertsPhrase,
  BenchmarkCasesSchema,
  normalize,
  scoreAnswer,
  scoreAnswers,
} from "../src/audit/benchmark.ts";
import { readDataFiles } from "../src/pipeline/load.ts";
import { REPO_ROOT } from "../src/pipeline/paths.ts";
import { validateDataFiles } from "../src/pipeline/validate.ts";

const read = (file: string): unknown =>
  JSON.parse(readFileSync(path.join(REPO_ROOT, "docs/audit/baseline", file), "utf8"));
const cases = BenchmarkCasesSchema.parse(read("benchmark-cases.v1.json"));
const dataset = validateDataFiles(readDataFiles()).dataset;
const known = new Set(
  (Object.keys(dataset) as (keyof typeof dataset)[]).flatMap((name) =>
    dataset[name].map((r) => r.id),
  ),
);

describe("B12 benchmark case file", () => {
  it("covers B1-B20 with supporting IDs that exist in the repository", () => {
    expect(cases.cases.map((c) => c.id)).toEqual(Array.from({ length: 20 }, (_, i) => `B${i + 1}`));
    for (const c of cases.cases) for (const id of c.supporting_ids) expect(known).toContain(id);
  });

  it("accepts each reference answer and the empty template", () => {
    for (const c of cases.cases)
      expect(scoreAnswer(c, c.expected_answer, known).pass, c.id).toBe(true);
    const report = scoreAnswers(cases, read("answers.template.json"), known);
    expect(report.summary).toMatchObject({ cases: 20, answered: 0 });
  });

  it("flags typical errors, invented IDs and ignores negated forbidden phrases", () => {
    const b1 = cases.cases[0];
    if (!b1) throw new Error("B1 missing");
    const wrong = scoreAnswer(b1, "Sì, attraverso GVA: vedi G-0999.", known);
    expect(wrong).toMatchObject({ pass: false, forbidden_hits: ["sì, attraverso gva"] });
    expect(wrong.invented_ids).toEqual(["G-0999"]);
    expect(
      assertsPhrase(
        normalize("Non è vero che Kerimov ha finanziato SpaceX"),
        "kerimov ha finanziato spacex",
      ),
    ).toBe(false);
    expect(assertsPhrase(normalize("It was intentional."), "was intentional")).toBe(true);
  });
});

describe("B12 measurement helpers", () => {
  it("finds the same shortest path regardless of edge order", () => {
    const edges = [
      { id: "e3", source: "B", target: "D" },
      { id: "e1", source: "A", target: "B" },
      { id: "e2", source: "A", target: "C" },
      { id: "e4", source: "C", target: "D" },
    ];
    expect(shortestPath(edges, "A", "D")).toEqual(["e1", "e3"]);
    expect(shortestPath([...edges].reverse(), "A", "D")).toEqual(["e1", "e3"]);
    expect(shortestPath(edges, "A", "Z")).toBeNull();
  });

  it("separates negative caveats from the participation boilerplate", () => {
    expect(isNegativeCaveat({ caveat: { it: "Dolo non provato" } })).toBe(true);
    expect(
      isNegativeCaveat({
        caveat: { it: "Relazione di presenza/ruolo. Non inferisce coordinamento." },
      }),
    ).toBe(false);
    expect(isNegativeCaveat({ caveat: { it: "Attribuzione Consiglio UE" } })).toBe(false);
  });

  it("is reproducible for a fixed seed", () => {
    const a = mulberry32(7);
    const b = mulberry32(7);
    expect([a(), a()]).toEqual([b(), b()]);
    expect(e5CoParticipation(dataset, 3)).toEqual(e5CoParticipation(dataset, 3));
  });
});
