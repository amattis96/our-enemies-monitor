import { beforeAll, describe, expect, it } from "vitest";
import { handleJsonRpcMessage } from "../packages/mcp/src/server.ts";
import { MCP_TOOLS } from "../packages/mcp/src/tools.ts";
import type { Dataset } from "../src/model/index.ts";
import { readDataFiles } from "../src/pipeline/load.ts";
import { validateDataFiles } from "../src/pipeline/validate.ts";
import {
  createQueryEngine,
  QUERY_COMPLEXITY_LIMITS,
  QueryComplexityError,
  type QueryEngine,
} from "../src/query/index.ts";
import { DEFAULT_MAX_STALENESS_SECONDS } from "../src/retractions/policy.ts";
import { publicationReport } from "../src/site/publication.ts";
import { buildReadModel, evidenceGraph, timelineItems } from "../src/site/read-model.ts";
import { orderTimeline, matches as siteMatches } from "../src/site/timeline.ts";

let canonicalDataset: Dataset;
let engine: QueryEngine;

beforeAll(() => {
  canonicalDataset = validateDataFiles(readDataFiles()).dataset;
  engine = createQueryEngine({
    dataset: canonicalDataset,
    now: new Date().toISOString(),
  });
});

describe("PK-22 Query Library (src/query/)", () => {
  it("achieves parity with site timeline filters and evidenceGraph", () => {
    const report = publicationReport(canonicalDataset);
    const siteModel = buildReadModel(report.dataset);

    // Timeline parity
    const siteItems = timelineItems(siteModel, "it");
    const siteFiltered = orderTimeline(
      siteItems.filter((item) =>
        siteMatches(item, {
          theme: "fimi",
          from: 2022,
          to: 2025,
          query: "",
          pending: true,
          metadata: false,
          order: "newest",
        }),
      ),
      "newest",
    );

    const queryTimeline = engine.getTimeline({
      theme: "fimi",
      from: 2022,
      to: 2025,
      pending: true,
      metadata: false,
      order: "newest",
      lang: "it",
      limit: QUERY_COMPLEXITY_LIMITS.maxLimit,
    });

    expect(queryTimeline.data.map((i) => i.id)).toEqual(
      siteFiltered.slice(0, QUERY_COMPLEXITY_LIMITS.maxLimit).map((i) => i.id),
    );
    expect(queryTimeline.pagination?.total).toBe(siteFiltered.length);

    // Relationship / evidenceGraph parity
    const graph = evidenceGraph(siteModel);
    const financialEdges = graph.edges.filter((e) => e.group === "financial");
    const queryRelations = engine.getRelations({
      relation_group: "financial",
      limit: QUERY_COMPLEXITY_LIMITS.maxLimit,
    });

    expect(queryRelations.pagination?.total).toBe(financialEdges.length);
    expect(new Set(queryRelations.data.map((r) => r.id))).toEqual(
      new Set(financialEdges.slice(0, QUERY_COMPLEXITY_LIMITS.maxLimit).map((e) => e.id)),
    );
  });

  it("never exposes withheld, private, suspended, or restricted person records", () => {
    const withheld = engine.report.withheld;
    expect(withheld.length).toBeGreaterThan(0);

    for (const w of withheld.slice(0, 25)) {
      if (w.collection === "entities") expect(engine.getEntity(w.id)).toBeNull();
      if (w.collection === "events") expect(engine.getEvent(w.id)).toBeNull();
      expect(engine.getEvidence(w.id)).toBeNull();
      const search = engine.searchRecords({ query: w.id, limit: 50 });
      expect(search.data.some((hit) => hit.id === w.id)).toBe(false);
    }

    // Verify restricted person relationships never appear in getRelations
    const allRels = engine.getRelations({ limit: QUERY_COMPLEXITY_LIMITS.maxLimit });
    for (const rel of allRels.data) {
      const canonicalRel = engine.report.dataset.relationships.find((r) => r.id === rel.id);
      expect(canonicalRel).toBeDefined();
      if (canonicalRel) {
        expect(engine.model.isRestricted(canonicalRel)).toBe(false);
      }
    }

    // Verify PK-07 suspendedRecordIds containment
    const sampleEvent = engine.report.dataset.events[0];
    expect(sampleEvent).toBeDefined();
    if (sampleEvent) {
      const suspendedEngine = createQueryEngine({
        dataset: canonicalDataset,
        suspendedIds: new Set([sampleEvent.id]),
      });
      expect(suspendedEngine.getEvent(sampleEvent.id)).toBeNull();
      expect(suspendedEngine.getEvidence(sampleEvent.id)).toBeNull();
      expect(
        suspendedEngine
          .searchRecords({ query: sampleEvent.id })
          .data.some((h) => h.id === sampleEvent.id),
      ).toBe(false);
    }

    // Verify open questions exclude natural persons by default
    const persons = new Set(
      engine.report.dataset.entities.filter((e) => e.kind === "person").map((e) => e.id),
    );
    const questions = engine.getOpenQuestions(0, 100);
    for (const q of questions.data) {
      if (q.subject) expect(persons.has(q.subject)).toBe(false);
      if (q.object) expect(persons.has(q.object)).toBe(false);
    }
  });

  it("enforces pagination and complexity limits", () => {
    const page1 = engine.searchRecords({ collections: ["events"], offset: 0, limit: 5 });
    const page2 = engine.searchRecords({ collections: ["events"], offset: 5, limit: 5 });

    expect(page1.data).toHaveLength(5);
    expect(page2.data).toHaveLength(5);
    expect(page1.pagination?.has_more).toBe(true);
    expect(page1.pagination?.next_offset).toBe(5);
    expect(page1.data.map((d) => d.id)).not.toEqual(page2.data.map((d) => d.id));

    expect(() => engine.searchRecords({ limit: QUERY_COMPLEXITY_LIMITS.maxLimit + 1 })).toThrow(
      QueryComplexityError,
    );
    expect(() => engine.searchRecords({ offset: -1 })).toThrow(QueryComplexityError);
    expect(() =>
      engine.searchRecords({ query: "x".repeat(QUERY_COMPLEXITY_LIMITS.maxQueryLength + 1) }),
    ).toThrow(QueryComplexityError);
    expect(() =>
      engine.findPaths({
        from: "RU",
        to: "IT",
        max_steps: QUERY_COMPLEXITY_LIMITS.maxPathDepth + 1,
      }),
    ).toThrow(QueryComplexityError);
    expect(() =>
      engine.findPaths({
        from: "RU",
        to: "IT",
        max_paths: QUERY_COMPLEXITY_LIMITS.maxPaths + 1,
      }),
    ).toThrow(QueryComplexityError);
  });

  it("supports progressive evidence retrieval (summary, standard, full)", () => {
    const sampleEvent = engine.report.dataset.events[0];
    expect(sampleEvent).toBeDefined();
    if (!sampleEvent) return;

    const summary = engine.getEvidence(sampleEvent.id, "summary");
    const standard = engine.getEvidence(sampleEvent.id, "standard");
    const full = engine.getEvidence(sampleEvent.id, "full");

    expect(summary?.canonical_ids).toContain(sampleEvent.id);
    expect(summary?.data).not.toHaveProperty("citing_relationships");
    expect(standard?.data).toHaveProperty("known_issues");
    expect(full?.data).toHaveProperty("citing_relationships");
  });

  it("returns full path steps with sources, B15 caveat interruptions, and PK-11 grammar support", () => {
    const flagged = engine.audit.flagged_paths[0];
    if (flagged) {
      const res = engine.findPaths({
        from: flagged.pair[0],
        to: flagged.pair[1],
        max_steps: 4,
        max_paths: 3,
      });
      expect(res.data.paths.length).toBeGreaterThan(0);
      const firstPath = res.data.paths[0];
      expect(firstPath?.steps.length).toBeGreaterThan(0);
      for (const step of firstPath?.steps ?? []) {
        expect(step.relationship).toMatch(/^G-/);
        expect(step.predicate.length).toBeGreaterThan(0);
        expect(Array.isArray(step.sources)).toBe(true);
        expect(step.sources.length).toBeGreaterThan(0);
        expect(step.b15).toBeDefined();
      }
      expect(firstPath?.caveats.length).toBeGreaterThan(0);
    }

    // Grammar-constrained path search
    const sampleRel = engine.report.dataset.relationships.find(
      (r) => !engine.model.isRestricted(r),
    );
    if (sampleRel) {
      const grammarRes = engine.findPaths({
        from: sampleRel.subject,
        to: sampleRel.object,
        apply_grammar: true,
        max_steps: 3,
      });
      expect(grammarRes.data.step_limit.max_steps).toBe(3);
      for (const p of grammarRes.data.paths) {
        expect(p.grammar_applied).toBe(true);
      }
    }
  });

  it("emits PK-07 staleness warning when local snapshot exceeds threshold", () => {
    const generatedAt = "2026-11-20T00:00:00Z";
    const freshEngine = createQueryEngine({
      dataset: canonicalDataset,
      snapshot: {
        snapshot_id: "snap-test",
        status: "published",
        generated_at: generatedAt,
        commit: "abc1234",
        dataset_hash: null,
      },
      now: "2026-11-20T12:00:00Z",
    });
    const freshCoverage = freshEngine.getCoverage();
    expect(freshCoverage.staleness.stale).toBe(false);
    expect(freshCoverage.staleness.warning).toBeNull();
    expect(freshCoverage.caveats.some((c) => c.code === "stale_projection")).toBe(false);

    const staleEngine = createQueryEngine({
      dataset: canonicalDataset,
      snapshot: {
        snapshot_id: "snap-test",
        status: "published",
        generated_at: generatedAt,
        commit: "abc1234",
        dataset_hash: null,
      },
      now: new Date(Date.parse(generatedAt) + (DEFAULT_MAX_STALENESS_SECONDS + 120) * 1000),
    });
    const staleCoverage = staleEngine.getCoverage();
    expect(staleCoverage.staleness.stale).toBe(true);
    expect(staleCoverage.staleness.warning).toContain("stale");
    expect(staleCoverage.caveats.some((c) => c.code === "stale_projection")).toBe(true);
  });
});

describe("PK-22 Thin MCP Server (packages/mcp/)", () => {
  it("handles initialize, ping, notifications, and lists all 12 tools", () => {
    const init = handleJsonRpcMessage(engine, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
    });
    expect(init?.result).toMatchObject({
      capabilities: { tools: {} },
      serverInfo: { name: "our-enemies-monitor-mcp" },
    });

    const notif = handleJsonRpcMessage(engine, {
      jsonrpc: "2.0",
      method: "notifications/initialized",
    });
    expect(notif).toBeNull();

    const list = handleJsonRpcMessage(engine, {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
    });
    const tools = (list?.result as { tools: { name: string }[] } | undefined)?.tools ?? [];
    expect(tools).toHaveLength(MCP_TOOLS.length);
    expect(tools.map((t) => t.name)).toEqual([
      "search_records",
      "get_entity",
      "get_event",
      "get_case",
      "get_relations",
      "get_evidence",
      "find_paths",
      "get_timeline",
      "get_changes",
      "get_methodology",
      "get_open_questions",
      "get_coverage",
    ]);
  });

  it("executes MCP tools with Zod validation, canonical metadata, and complexity errors", () => {
    const methodologyRes = handleJsonRpcMessage(engine, {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "get_methodology", arguments: {} },
    });
    const methPayload = JSON.parse(
      (methodologyRes?.result as { content: { text: string }[] } | undefined)?.content[0]?.text ??
        "{}",
    );
    expect(methPayload.data.evidence_levels).toHaveProperty("E1");
    expect(methPayload.caveats.length).toBeGreaterThan(0);

    const coverageRes = handleJsonRpcMessage(engine, {
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "get_coverage", arguments: {} },
    });
    const covPayload = JSON.parse(
      (coverageRes?.result as { content: { text: string }[] } | undefined)?.content[0]?.text ??
        "{}",
    );
    expect(covPayload.data.total_published).toBeGreaterThan(0);

    const invalidLimit = handleJsonRpcMessage(engine, {
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: { name: "search_records", arguments: { limit: 999 } },
    });
    expect((invalidLimit?.result as { isError: boolean } | undefined)?.isError).toBe(true);
  });
});
