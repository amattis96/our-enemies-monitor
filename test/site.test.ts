import { beforeAll, describe, expect, it } from "vitest";
import { CATEGORY_THEMES, EVENT_THEME_OVERRIDES } from "../src/pipeline/baseline/themes.ts";
import { buildManifest, exportFiles } from "../src/site/exports.ts";
import {
  formatDateRange,
  formatMeasure,
  formatPartialDate,
  formatPredicate,
} from "../src/site/format.ts";
import { languagePaths, pick } from "../src/site/i18n.ts";
import {
  atlasRows,
  evidenceGraph,
  hypothesisGraph,
  loadReadModel,
  type ReadModel,
  timelineItems,
} from "../src/site/read-model.ts";

let model: ReadModel;
beforeAll(() => {
  model = loadReadModel();
});

describe("read model", () => {
  it("restricts named-person relationships without a primary source", () => {
    const restricted = model.dataset.relationships.filter((r) => model.isRestricted(r));
    expect(restricted.length).toBeGreaterThan(0);
    for (const r of restricted) {
      expect(r.primary_url).toBeNull();
      expect([model.nodeKind(r.subject), model.nodeKind(r.object)]).toContain("person");
    }
    // A person relationship with a primary URL stays public (G-0008: MED → MAR, EU Council).
    const withUrl = model.dataset.relationships.find((r) => r.id === "G-0008");
    expect(withUrl && model.isRestricted(withUrl)).toBe(false);
  });

  it("keeps restricted relationships and hypotheses out of the evidence graph", () => {
    const graph = evidenceGraph(model);
    const restricted = model.dataset.relationships.filter((r) => model.isRestricted(r));
    expect(graph.edges).toHaveLength(model.dataset.relationships.length - restricted.length);
    const ids = new Set(graph.edges.map((e) => e.id));
    expect(restricted.some((r) => ids.has(r.id))).toBe(false);
    expect(graph.edges.every((e) => e.id.startsWith("G-"))).toBe(true);
    const nodes = new Set(graph.nodes.map((n) => n.id));
    expect(graph.edges.every((e) => nodes.has(e.source) && nodes.has(e.target))).toBe(true);
  });

  it("publishes hypotheses only in their own graph", () => {
    const graph = hypothesisGraph(model);
    expect(graph.edges).toHaveLength(model.dataset.hypotheses.length);
    expect(graph.edges.every((e) => e.id.startsWith("H"))).toBe(true);
  });

  it("orders the timeline by start date, year-only entries first within a year", () => {
    const items = timelineItems(model);
    expect(items).toHaveLength(model.dataset.events.length);
    const starts = items.map((i) => i.start);
    expect(starts).toEqual([...starts].sort());
    const year2014 = items.filter((i) => i.start.startsWith("2014"));
    expect(year2014[0]?.precision).toBe("year");
  });
});

describe("themes", () => {
  it("map every original category, with no stale entries", () => {
    const categories = new Set(
      model.dataset.events.flatMap((e) => (e.category ? [e.category.it] : [])),
    );
    expect(Object.keys(CATEGORY_THEMES).sort()).toEqual([...categories].sort());
  });

  it("apply overrides only to existing events", () => {
    for (const id of Object.keys(EVENT_THEME_OVERRIDES)) {
      expect(model.event(id)?.themes).toEqual(EVENT_THEME_OVERRIDES[id]?.themes);
    }
  });
});

describe("atlas", () => {
  it("keeps event location separate from state roles", () => {
    const rows = atlasRows(model);
    const ee = rows.find((r) => r.code === "EE");
    expect(ee?.located.map((e) => e.id)).toContain("TL-0001");
    expect(ee?.state?.id).toBe("EE");
    for (const row of rows) {
      expect(row.located.every((e) => e.places.includes(row.code))).toBe(true);
      expect(row.located.some((e) => e.record_type === "dataset_metadata")).toBe(false);
    }
  });

  it("does not reveal restricted relationships through roles", () => {
    const roleCount = atlasRows(model).reduce(
      (sum, row) => sum + row.roles.reduce((n, role) => n + role.events.length, 0),
      0,
    );
    const visible = model.dataset.relationships.filter(
      (r) =>
        r.relation_class === "event_participation" &&
        !model.isRestricted(r) &&
        [r.subject, r.object].some((id) => model.entity(id)?.kind === "state"),
    ).length;
    expect(roleCount).toBe(visible);
  });
});

describe("i18n", () => {
  it("falls back to Italian and says so", () => {
    expect(pick({ it: "ciao", en: "hello" }, "en")).toEqual({
      value: "hello",
      lang: "en",
      fallback: false,
    });
    expect(pick({ it: "ciao" }, "en")).toEqual({ value: "ciao", lang: "it", fallback: true });
    expect(pick({ it: "ciao", en: "hello" }, "it").value).toBe("ciao");
  });

  it("returns fresh static paths on every call", () => {
    expect(languagePaths()).not.toBe(languagePaths());
    expect(languagePaths().map((p) => p.params.lang)).toEqual([undefined, "en"]);
  });
});

describe("exports", () => {
  it("are deterministic and described by the manifest", () => {
    const files = exportFiles(model.dataset);
    expect(exportFiles(model.dataset)).toEqual(files);
    expect(files.map((f) => f.path)).toContain("events.json");
    expect(files.map((f) => f.path)).toContain("schemas/exposures.schema.json");
    const manifest = buildManifest(model.dataset, files);
    expect(manifest.files).toHaveLength(files.length);
    expect(manifest.counts.exposures).toBe(14);
    expect(JSON.parse(files.find((f) => f.path === "all.json")?.text ?? "{}").events).toHaveLength(
      151,
    );
  });
});

describe("formatting", () => {
  it("formats partial dates without inventing precision", () => {
    expect(formatPartialDate("2007")).toBe("2007");
    expect(formatPartialDate("2007-04")).toBe("aprile 2007");
    expect(formatPartialDate("2026-10-06")).toBe("6 ottobre 2026");
    expect(formatDateRange("2007-04", "2007-05")).toBe("aprile 2007 – maggio 2007");
  });

  it("formats measures with their qualifier and unit", () => {
    const base = { label: { it: "x" }, out_of: null, period: null } as const;
    expect(formatMeasure({ ...base, value: 85, unit: "percent", qualifier: "approx" }, "it")).toBe(
      "circa 85%",
    );
    expect(
      formatMeasure({ ...base, value: 43.6, unit: "eur_billion", qualifier: "exact" }, "en"),
    ).toBe("€43.6 bn");
    expect(
      formatMeasure({ ...base, value: 19, unit: "count", qualifier: "exact", out_of: 20 }, "en"),
    ).toBe("19 of 20");
    expect(formatPartialDate("2007-04", "en")).toBe("April 2007");
  });

  it("keeps predicates literal", () => {
    expect(formatPredicate("GESTISCE_OCCULTAMENTE")).toBe("gestisce occultamente");
  });
});
