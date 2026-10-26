import { readFileSync } from "node:fs";
import { XMLParser } from "fast-xml-parser";
import { beforeAll, describe, expect, it } from "vitest";
import type { Dataset } from "../src/model/index.ts";
import { BASELINE_FILES } from "../src/pipeline/baseline/files.ts";
import { importBaseline } from "../src/pipeline/baseline/import.ts";
import { datasetToFiles } from "../src/pipeline/load.ts";
import { repoPath } from "../src/pipeline/paths.ts";
import { SourceReader } from "../src/pipeline/sources.ts";
import { summarize, validateDataFiles } from "../src/pipeline/validate.ts";

let dataset: Dataset;
beforeAll(() => {
  dataset = importBaseline();
});

const byId = <T extends { id: string }>(records: T[], id: string): T => {
  const record = records.find((r) => r.id === id);
  if (!record) throw new Error(`missing ${id}`);
  return record;
};

describe("baseline import", () => {
  it("reproduces the record counts documented by the corpus (Fonte_08 §20.1)", () => {
    expect(summarize(dataset)).toEqual({
      events: 151,
      timeline_events: 147,
      pending_events: 4,
      entities: 202,
      relationships: 444,
      event_participation: 291,
      direct_relationships: 153,
      hypotheses: 22,
      sources: 55,
    });
  });

  it("preserves original IDs and merges EV_* graph nodes into events", () => {
    expect(byId(dataset.events, "TL-0001").title.it).toBe("Attacchi DDoS contro l’Estonia");
    expect(dataset.events.filter((e) => e.id.startsWith("EXT-"))).toHaveLength(4);
    const endpoints = [...dataset.relationships, ...dataset.hypotheses].flatMap((r) => [
      r.subject,
      r.object,
    ]);
    expect(endpoints.some((id) => id.startsWith("EV_"))).toBe(false);
    expect(byId(dataset.events, "TL-0001").provenance.map((p) => p.file)).toEqual([
      BASELINE_FILES.timelineCsv,
      BASELINE_FILES.nodesCsv,
    ]);
  });

  it("marks pending timeline integration and dataset metadata explicitly", () => {
    expect(byId(dataset.events, "EXT-001").timeline_status).toBe("pending_integration");
    expect(byId(dataset.events, "EXT-001").evidence_level).toBe("E2");
    expect(byId(dataset.events, "TL-0147").record_type).toBe("dataset_metadata");
  });

  it("records the anomalies reported by the corpus without correcting them", () => {
    const flagged = dataset.events.filter((e) => e.known_issues.length > 0).map((e) => e.id);
    expect(flagged.sort()).toEqual(["TL-0035", "TL-0048", "TL-0113"]);
    expect(byId(dataset.events, "TL-0113").date.start).toBe("2026-06");
  });

  it("parses mixed source separators and removes duplicates", () => {
    // Original value: "S06;S06,S00;S03;S05"
    expect(byId(dataset.relationships, "G-0113").sources).toEqual(["S06", "S00", "S03", "S05"]);
  });

  it("keeps hypotheses out of the relationship graph", () => {
    expect(dataset.relationships.some((r) => r.id.startsWith("H"))).toBe(false);
    expect(dataset.hypotheses.every((h) => h.status === "open_unproven")).toBe(true);
  });

  it("imports the F01–F30 and P01–P11 reference registries with URLs", () => {
    const ids = dataset.sources.map((s) => s.id);
    expect(ids.filter((id) => /^F\d{2}$/.test(id))).toHaveLength(30);
    expect(ids.filter((id) => /^P\d{2}$/.test(id))).toHaveLength(11);
    expect(byId(dataset.sources, "F10").urls).toHaveLength(2);
  });

  it("produces data that validates without errors", () => {
    const { issues } = validateDataFiles(datasetToFiles(dataset));
    expect(issues.filter((i) => i.severity === "error")).toEqual([]);
  });
});

describe("GraphML export", () => {
  // GraphML is a consistency check, not an import input: it must describe
  // exactly the same nodes and edges as the CSV files.
  it("matches the node and edge CSV files exactly", () => {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@",
      isArray: (name) => ["key", "node", "edge", "data"].includes(name),
      parseTagValue: false,
      trimValues: false,
    });
    type Data = { "@key": string; "#text"?: string };
    type Element = { "@id"?: string; "@source"?: string; "@target"?: string; data?: Data[] };
    const xml = parser.parse(readFileSync(repoPath(BASELINE_FILES.graphml), "utf8"));
    const keys = new Map<string, string>(
      xml.graphml.key.map((k: { "@id": string; "@attr.name": string }) => [
        k["@id"],
        k["@attr.name"],
      ]),
    );
    const attributes = (element: Element) =>
      Object.fromEntries((element.data ?? []).map((d) => [keys.get(d["@key"]), d["#text"] ?? ""]));

    const graph = xml.graphml.graph[0] ?? xml.graphml.graph;
    const reader = new SourceReader();
    const nodes = (graph.node as Element[]).map((n) => ({ id: n["@id"], ...attributes(n) }));
    expect(nodes).toEqual(reader.csvRows(BASELINE_FILES.nodesCsv));

    const edges = (graph.edge as Element[]).map((e) => {
      const { id, ...rest } = attributes(e);
      return { id, source: e["@source"], target: e["@target"], ...rest };
    });
    // NetworkX writes edges grouped by source node, so compare by ID.
    const byEdgeId = (a: { id?: string }, b: { id?: string }) =>
      (a.id ?? "").localeCompare(b.id ?? "");
    expect(edges.sort(byEdgeId)).toEqual(
      [...reader.csvRows(BASELINE_FILES.edgesCsv)].sort(byEdgeId),
    );
  });
});
