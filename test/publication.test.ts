import { beforeAll, describe, expect, it } from "vitest";
import type { Dataset } from "../src/model/index.ts";
import { readDataFiles } from "../src/pipeline/load.ts";
import { validateDataFiles } from "../src/pipeline/validate.ts";
import { buildManifest, exportFiles } from "../src/site/exports.ts";
import { publicationReport, publishedDataset } from "../src/site/publication.ts";
import { buildReadModel, evidenceGraph, timelineItems } from "../src/site/read-model.ts";

let raw: Dataset;
let visible: Dataset;
beforeAll(() => {
  raw = validateDataFiles(readDataFiles()).dataset;
  visible = publishedDataset(raw);
});

describe("M5 publication quarantine", () => {
  it("keeps pending candidates in Git but out of the site and exports", () => {
    expect(raw.events.some((record) => record.id === "EXT-005")).toBe(true);
    expect(visible.events.some((record) => record.id === "EXT-005")).toBe(false);
    expect(visible.events.every((record) => record.timeline_status === "integrated")).toBe(true);
    expect(visible.events.every((record) => record.review.status !== "needs_review")).toBe(true);
    expect(timelineItems(buildReadModel(visible))).toHaveLength(visible.events.length);
    const all = JSON.parse(
      exportFiles(raw).find((file) => file.path === "all.json")?.text ?? "{}",
    ) as Dataset;
    expect(all.events).toHaveLength(visible.events.length);
    expect(all.events.some((record) => record.id === "EXT-005")).toBe(false);
  });

  it("never exports an unsourced named-person relationship", () => {
    const persons = new Set(
      raw.entities.filter((entity) => entity.kind === "person").map((entity) => entity.id),
    );
    expect(
      raw.relationships.some(
        (relation) =>
          relation.primary_url === null &&
          (persons.has(relation.subject) || persons.has(relation.object)),
      ),
    ).toBe(true);
    for (const relation of visible.relationships) {
      if (persons.has(relation.subject) || persons.has(relation.object)) {
        expect(relation.primary_url, relation.id).not.toBeNull();
      }
    }
    const exported = JSON.parse(
      exportFiles(raw).find((file) => file.path === "relationships.json")?.text ?? "[]",
    );
    expect(exported).toEqual(visible.relationships);
    const graph = evidenceGraph(buildReadModel(visible));
    expect(graph.edges.every((edge) => visible.relationships.some((r) => r.id === edge.id))).toBe(
      true,
    );
  });

  it("maintains references and labels legacy records as unreviewed", () => {
    const events = new Set(visible.events.map((record) => record.id));
    const nodes = new Set([...events, ...visible.entities.map((record) => record.id)]);
    const sources = new Set(visible.sources.map((record) => record.id));
    for (const relation of [...visible.relationships, ...visible.hypotheses]) {
      expect(nodes.has(relation.subject), relation.id).toBe(true);
      expect(nodes.has(relation.object), relation.id).toBe(true);
      expect(
        relation.events.every((id) => events.has(id)),
        relation.id,
      ).toBe(true);
    }
    for (const record of [
      ...visible.events,
      ...visible.relationships,
      ...visible.hypotheses,
      ...visible.exposures,
    ]) {
      expect(
        record.sources.every((id) => sources.has(id)),
        record.id,
      ).toBe(true);
    }
    expect(visible.events.some((event) => event.review.status === "imported_unreviewed")).toBe(
      true,
    );
  });

  it("is idempotent and leaves canonical records unchanged", () => {
    const snapshot = JSON.stringify(raw);
    expect(publishedDataset(visible)).toEqual(visible);
    expect(JSON.stringify(raw)).toBe(snapshot);
  });
});

describe("B03 fail-closed projection", () => {
  it("quarantines arbitrary URLs in public data, graph and raw read model", () => {
    const copy = structuredClone(raw);
    const relation = copy.relationships.find((r) => r.id === "G-0230");
    if (!relation) throw new Error("missing relation fixture");
    relation.primary_url = "https://example.com/";
    expect(buildReadModel(copy).isRestricted(relation)).toBe(true);
    expect(publishedDataset(copy).relationships.some((r) => r.id === relation.id)).toBe(false);
    expect(evidenceGraph(buildReadModel(copy)).edges.some((edge) => edge.id === relation.id)).toBe(
      false,
    );
    const files = exportFiles(copy);
    const relationshipsFile = files.find((file) => file.path === "relationships.json");
    const allFile = files.find((file) => file.path === "all.json");
    const graphFile = files.find((file) => file.path === "graph.json");
    if (!relationshipsFile || !allFile) throw new Error("missing export fixture");
    const relationships = JSON.parse(relationshipsFile.text) as Dataset["relationships"];
    const all = JSON.parse(allFile.text) as Dataset;
    expect(relationships.some((r) => r.id === relation.id)).toBe(false);
    expect(all.relationships.some((r) => r.id === relation.id)).toBe(false);
    expect(
      JSON.parse(graphFile?.text ?? "{}").edges.some(
        (edge: { id: string }) => edge.id === relation.id,
      ),
    ).toBe(false);
  });
  it("does not leak an invalid baseline source or claims citing it", () => {
    const copy = structuredClone(raw);
    const event = copy.events.find(
      (e) => visible.events.some((v) => v.id === e.id) && e.sources.length > 0,
    );
    if (!event) throw new Error("missing event fixture");
    const source = copy.sources.find((s) => s.id === event.sources[0]);
    if (!source) throw new Error("missing source fixture");
    source.review.status = "imported_unreviewed";
    source.provenance = [];
    const projected = publishedDataset(copy);
    expect(projected.sources.some((s) => s.id === source.id)).toBe(false);
    expect(
      [
        ...projected.events,
        ...projected.relationships,
        ...projected.hypotheses,
        ...projected.exposures,
      ].every((r) => !r.sources.includes(source.id)),
    ).toBe(true);
    source.review.status = "needs_review";
    const withMetadata = publishedDataset(copy);
    expect(withMetadata.events.some((e) => e.id === event.id)).toBe(true);
    expect(
      withMetadata.sources.some((s) => s.id === source.id && s.review.status === "needs_review"),
    ).toBe(true);
  });
  it("excludes invalid imported baselines in all collections", () => {
    for (const collection of Object.keys(raw) as (keyof Dataset)[]) {
      const copy = structuredClone(raw);
      const record = copy[collection].find(
        (r) =>
          r.review.status === "imported_unreviewed" &&
          visible[collection].some((v) => v.id === r.id),
      );
      if (!record) throw new Error(`missing ${collection} fixture`);
      expect(publishedDataset(copy)[collection].some((r) => r.id === record.id)).toBe(true);
      record.provenance = [];
      expect(publishedDataset(copy)[collection].some((r) => r.id === record.id)).toBe(false);
    }
  });
});

describe("B05 hypothesis projection and withheld registry", () => {
  it("restores unchanged historical hypotheses and accounts for every excluded record", () => {
    const report = publicationReport(raw);
    expect(
      ["H02", "H08", "H10", "H11", "H12", "H13", "H16", "H17", "H19", "H20", "H21"].every((id) =>
        report.dataset.hypotheses.some((h) => h.id === id),
      ),
    ).toBe(true);
    expect(report.dataset.hypotheses).toHaveLength(22);
    expect(report.dataset.hypotheses.find((h) => h.id === "H19")?.events).toEqual([]);
    expect(report.dataset.hypotheses.find((h) => h.id === "H20")?.events).toEqual([]);
    expect(report.counts).toEqual({
      events: 34,
      entities: 18,
      relationships: 25,
      hypotheses: 10,
      sources: 51,
      exposures: 0,
    });
    for (const collection of Object.keys(raw) as (keyof Dataset)[]) {
      const publicIds = new Set(report.dataset[collection].map((r) => r.id));
      expect(
        report.withheld
          .filter((r) => r.collection === collection)
          .map((r) => r.id)
          .sort(),
      ).toEqual(
        raw[collection]
          .filter((r) => !publicIds.has(r.id))
          .map((r) => r.id)
          .sort(),
      );
    }
    expect(
      report.withheld.every(
        (r) => Object.keys(r).sort().join(",") === "collection,id,reasons" && r.reasons.length > 0,
      ),
    ).toBe(true);
    const files = exportFiles(report);
    expect(JSON.parse(files.find((f) => f.path === "withheld.json")?.text ?? "null")).toEqual(
      report.withheld,
    );
    expect(buildManifest(report, files).withheld.counts).toEqual(report.counts);
  });
  it("omits candidate links, arbitrary notes and incremental citations without mutating input", () => {
    const copy = structuredClone(raw);
    const h = copy.hypotheses.find((r) => r.id === "H15");
    if (!h) throw new Error("missing H15");
    const candidate = copy.events.find((e) => e.id === "EXT-025");
    if (!candidate) throw new Error("missing candidate");
    const marker = "UNREVIEWED_SENTINEL_CONTENT";
    candidate.title.it = marker;
    h.events.push(candidate.id);
    h.review.notes.push(marker, `Fonte_07 ${marker}`);
    const snapshot = JSON.stringify(copy);
    const report = publicationReport(copy);
    const projected = report.dataset.hypotheses.find((r) => r.id === h.id);
    expect(projected).toBeDefined();
    expect(projected?.events).not.toContain(candidate.id);
    expect(projected?.review.notes).toEqual([]);
    expect(projected?.sources).not.toContain("S09");
    expect(report.dataset.sources.some((r) => r.id === "S09")).toBe(false);
    expect(report.projections.find((r) => r.id === h.id)?.omitted_events).toContain(candidate.id);
    for (const file of exportFiles(report)) expect(file.text).not.toContain(marker);
    expect(JSON.stringify(copy)).toBe(snapshot);
    expect(publishedDataset(report.dataset)).toEqual(report.dataset);
  });
  it("projects a legacy hypothesis only onto events present in its original row", () => {
    const copy = structuredClone(raw);
    const h = copy.hypotheses.find((r) => r.id === "H15");
    if (!h) throw new Error("missing H15");
    const publicEvent = publicationReport(raw).dataset.events.find((e) => !h.events.includes(e.id));
    if (!publicEvent) throw new Error("missing public event");
    h.events.push(publicEvent.id);
    const projected = publicationReport(copy).dataset.hypotheses.find((r) => r.id === h.id);
    expect(projected).toBeDefined();
    expect(projected?.events).not.toContain(publicEvent.id);
    expect(projected?.events).toEqual(h.events.filter((id) => id !== publicEvent.id));
  });
  it("withholds changed historical meaning and preserves removed or invalid references", () => {
    const copy = structuredClone(raw);
    const h = copy.hypotheses.find((r) => r.id === "H08");
    if (!h) throw new Error("missing H08");
    const removed = h.sources[0];
    if (!removed) throw new Error("missing source");
    h.sources = h.sources.filter((s) => s !== removed);
    expect(
      publicationReport(copy).dataset.hypotheses.find((r) => r.id === h.id)?.sources,
    ).not.toContain(removed);
    h.events.push("TL-9999");
    expect(publicationReport(copy).dataset.hypotheses.some((r) => r.id === h.id)).toBe(false);
    h.events.pop();
    h.sources.push("S99");
    expect(
      publicationReport(copy).dataset.hypotheses.find((r) => r.id === h.id)?.sources,
    ).toContain("S99");
    h.question.it += " changed";
    const report = publicationReport(copy);
    expect(report.dataset.hypotheses.some((r) => r.id === h.id)).toBe(false);
    expect(report.withheld.find((r) => r.id === h.id)?.reasons).toContain(
      "legacy_hypothesis_changed",
    );
    h.question.it = raw.hypotheses.find((r) => r.id === h.id)?.question.it ?? "";
    h.priority = h.priority === "critical" ? "high" : "critical";
    expect(publicationReport(copy).withheld.find((r) => r.id === h.id)?.reasons).toContain(
      "legacy_hypothesis_changed",
    );
  });
  it("keeps reviewed hypotheses visible when a candidate is linked, and retains cited source metadata", () => {
    const copy = structuredClone(raw);
    const h = copy.hypotheses.find((r) => r.id === "H06");
    const candidate = copy.events.find((r) => r.id === "EXT-025");
    const source = copy.sources.find((r) => r.id === "S09");
    if (!h || !candidate || !source) throw new Error("missing positive control");
    h.review.status = "reviewed";
    h.events.push(candidate.id);
    h.sources.push(source.id);
    h.review.notes.push("reviewed positive control");
    const report = publicationReport(copy);
    const projected = report.dataset.hypotheses.find((r) => r.id === h.id);
    expect(projected?.review.notes).toContain("reviewed positive control");
    expect(projected?.events).not.toContain(candidate.id);
    expect(projected?.sources).toContain(source.id);
    expect(report.dataset.sources.find((r) => r.id === source.id)?.review.status).toBe(
      "needs_review",
    );
    expect(report.withheld.some((r) => r.id === h.id || r.id === source.id)).toBe(false);
  });
  it("does not publish a historical hypothesis with a withheld endpoint or unreviewed status", () => {
    const copy = structuredClone(raw);
    const h = copy.hypotheses.find((r) => r.id === "H08");
    if (!h) throw new Error("missing H08");
    const subject = copy.entities.find((r) => r.id === h.subject);
    if (!subject) throw new Error("missing endpoint");
    subject.review.status = "needs_review";
    let report = publicationReport(copy);
    expect(report.withheld.find((r) => r.id === h.id)?.reasons).toContain("withheld_endpoint");
    subject.review.status = "imported_unreviewed";
    h.review.status = "needs_review";
    report = publicationReport(copy);
    expect(report.withheld.find((r) => r.id === h.id)?.reasons).toContain("needs_review");
  });
});
