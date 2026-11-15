import { beforeAll, describe, expect, it } from "vitest";
import type { Exposure, Measure } from "../src/model/index.ts";
import { exposureGroupIssues } from "../src/pipeline/exposure-groups.ts";
import { exposureGroupViews, type SupplyChain } from "../src/site/dependencies.ts";
import { publicationReport } from "../src/site/publication.ts";
import { buildReadModel, loadReadModel, type ReadModel } from "../src/site/read-model.ts";
import { roleMatrix } from "../src/site/roles.ts";

const measure = (value: number, label = "Quota", extra: Partial<Measure> = {}): Measure => ({
  label: { it: label },
  value,
  unit: "percent",
  qualifier: "exact",
  out_of: null,
  period: null,
  ...extra,
});

const exposure = (id: string, measures: Measure[], group?: Exposure["group"]): Exposure => ({
  id,
  sector: { it: id },
  indicator: { it: id },
  measures,
  scope: { it: "perimetro" },
  consequence: { it: "cautela" },
  status: "observed",
  ...(group ? { group } : {}),
  sources: ["S08"],
  review: { status: "imported_unreviewed", notes: [] },
  provenance: [],
});

let model: ReadModel;
beforeAll(() => {
  model = buildReadModel(publicationReport(loadReadModel().dataset).dataset);
});

describe("exposure groups (B19)", () => {
  it("accept coherent groups and reject gaps, singletons and malformed pairs", () => {
    const chain = (id: string, position: number) =>
      exposure(id, [measure(50)], { id: "rare_earth_magnets", position });
    expect(exposureGroupIssues([chain("X-901", 1), chain("X-902", 2)])).toEqual([]);
    expect(exposureGroupIssues([chain("X-901", 1), chain("X-902", 3)])[0]?.message).toMatch(
      /without gaps/,
    );
    expect(exposureGroupIssues([chain("X-901", 1)])[0]?.message).toMatch(/fewer than two/);
    const pair = (id: string, position: number, measures: Measure[]) =>
      exposure(id, measures, { id: "eu_gas", position });
    const issues = exposureGroupIssues([
      pair("X-901", 1, [measure(40), measure(10)]),
      pair("X-902", 2, [measure(40), measure(10, "Quota", { unit: "count" })]),
    ]);
    expect(issues.map((i) => i.id)).toEqual(["X-902"]);
    expect(
      exposureGroupIssues([
        exposure("X-901", [measure(1), measure(2)], { id: "rare_earth_magnets", position: 1 }),
        chain("X-902", 2),
      ])[0]?.message,
    ).toMatch(/exactly one measure/);
  });

  it("compare only stages measuring the same exact quantity", () => {
    const [view] = exposureGroupViews([
      exposure("X-903", [measure(98, "Altra grandezza")], {
        id: "rare_earth_magnets",
        position: 3,
      }),
      exposure("X-901", [measure(60)], { id: "rare_earth_magnets", position: 1 }),
      exposure("X-902", [measure(91)], { id: "rare_earth_magnets", position: 2 }),
    ]) as SupplyChain[];
    expect(view?.stages.map((s) => [s.exposure.id, s.sameQuantityAsPrevious])).toEqual([
      ["X-901", null],
      ["X-902", true],
      ["X-903", false],
    ]);
    expect(view?.mostConcentrated).toEqual(["X-902"]);
    expect(view?.comparedStages).toBe(2);
    const [approx] = exposureGroupViews([
      exposure("X-901", [measure(60, "Quota", { qualifier: "approx" })], {
        id: "rare_earth_magnets",
        position: 1,
      }),
      exposure("X-902", [measure(91)], { id: "rare_earth_magnets", position: 2 }),
    ]) as SupplyChain[];
    expect(approx?.mostConcentrated).toEqual([]);
  });

  it("answer FABLE C E4 on the public data: magnets, with the change of quantity stated", () => {
    const views = exposureGroupViews(model.dataset.exposures);
    const chain = views.find((v) => v.id === "rare_earth_magnets") as SupplyChain;
    expect(chain.stages.map((s) => s.exposure.id)).toEqual(["X-004", "X-002", "X-003", "X-001"]);
    expect(chain.mostConcentrated).toEqual(["X-003"]);
    expect(chain.comparedStages).toBe(3);
    expect(chain.stages.at(-1)?.sameQuantityAsPrevious).toBe(false);
    const gas = views.find((v) => v.id === "eu_gas");
    expect(gas?.kind === "before_after" && gas.pairs.map((p) => p.exposure.id)).toEqual([
      "X-011",
      "X-012",
    ]);
  });
});

describe("role matrix (B19)", () => {
  it("counts by existing group and level with a denominator, period and literal predicates", () => {
    const matrix = roleMatrix(model, "RU");
    const rowSum = matrix.rows.reduce((n, r) => n + r.total, 0);
    const levelSum = Object.values(matrix.byLevel).reduce((n, v) => n + v, 0);
    expect(rowSum + matrix.restricted).toBe(matrix.total);
    expect(levelSum).toBe(matrix.total);
    expect(matrix.total).toBe(model.relationshipsOf("RU").length);
    const participation = matrix.rows.find((r) => r.group === "participation");
    // FABLE C E5: Russia appears in many events with many distinct literal roles.
    expect(participation?.total).toBeGreaterThan(1);
    expect(matrix.predicates.reduce((n, p) => n + p.count, 0)).toBe(participation?.total);
    expect(matrix.predicates.length).toBeGreaterThan(1);
    expect(matrix.period?.from && matrix.period.from <= matrix.period.to).toBe(true);
  });

  it("keeps restricted person relationships out of groups and predicates", () => {
    const [participation] = model
      .relationshipsOf("RU")
      .filter((r) => r.relation_class === "event_participation");
    if (!participation) throw new Error("fixture: no RU participation");
    const hidden = { ...participation, id: "G-9999", predicate: "HIDDEN_ROLE" };
    const stub = {
      ...model,
      relationshipsOf: () => [participation, hidden],
      isRestricted: (r: { id: string }) => r.id === "G-9999",
    } as ReadModel;
    const matrix = roleMatrix(stub, "RU");
    expect(matrix.total).toBe(2);
    expect(matrix.restricted).toBe(1);
    expect(matrix.rows.reduce((n, r) => n + r.total, 0)).toBe(1);
    expect(matrix.predicates.map((p) => p.predicate)).not.toContain("HIDDEN_ROLE");
  });
});
