import { beforeAll, describe, expect, it } from "vitest";
import type { Dataset } from "../src/model/index.ts";
import { readDataFiles } from "../src/pipeline/load.ts";
import { validateDataFiles } from "../src/pipeline/validate.ts";
import { exportFiles } from "../src/site/exports.ts";
import { publishedDataset } from "../src/site/publication.ts";
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
      expect(relation.events.every((id) => events.has(id)), relation.id).toBe(true);
    }
    for (const record of [
      ...visible.events,
      ...visible.relationships,
      ...visible.hypotheses,
      ...visible.exposures,
    ]) {
      expect(record.sources.every((id) => sources.has(id)), record.id).toBe(true);
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
