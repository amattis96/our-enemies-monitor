import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { Article, Dataset } from "../src/model/index.ts";
import { readArticleFiles, validateArticleFiles } from "../src/pipeline/articles.ts";
import { readDataFiles } from "../src/pipeline/load.ts";
import { validateDataFiles } from "../src/pipeline/validate.ts";
import {
  appendRetractionEntry,
  buildSourceImpactIndex,
  CONTROLLED_PROJECTIONS,
  checkProjectionStaleness,
  createEmptyRetractionRegister,
  filterControlledProjection,
  logExternalWithdrawal,
  lookupSourceImpact,
  readRetractionRegister,
  responseForLevel,
  suspendedRecordIds,
  validateRetractionRegister,
  writeRetractionRegister,
} from "../src/retractions/index.ts";
import { publicationReport } from "../src/site/publication.ts";

const tempDirs: string[] = [];

function makeTempDir(prefix: string): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

function makeTestDataset(): Dataset {
  const baseReview = {
    status: "reviewed" as const,
    notes: [],
    translations: {},
  };
  const baseProv = [
    {
      file: "sources/original/test.md",
      line: 1,
      original: { text: "test" },
    },
  ];

  return {
    sources: [
      {
        id: "S90",
        type: "external_reference",
        title: { it: "Fonte decisiva", en: "Decisive source" },
        publisher: "Test Authority",
        files: [],
        urls: ["https://example.org/s90"],
        cited_in: [],
        origin_type: "primary_document",
        review: baseReview,
        provenance: baseProv,
      },
      {
        id: "S91",
        type: "external_reference",
        title: { it: "Fonte derivata", en: "Derived source" },
        publisher: "Test Press",
        files: [],
        urls: ["https://example.org/s91"],
        cited_in: [],
        origin_type: "republication",
        derived_from: ["S90"],
        review: baseReview,
        provenance: baseProv,
      },
    ],
    entities: [
      {
        id: "ENT_A",
        kind: "organization",
        name: { it: "Ente A", en: "Entity A" },
        domain: "intelligence-security",
        country: null,
        review: baseReview,
        provenance: baseProv,
      },
      {
        id: "ENT_B",
        kind: "person",
        name: { it: "Persona B", en: "Person B" },
        domain: "persons",
        country: null,
        review: baseReview,
        provenance: baseProv,
      },
    ],
    events: [
      {
        id: "TL-9001",
        record_type: "event",
        timeline_status: "integrated",
        date: { start: "2025-02-10", end: null, precision: "day" },
        title: { it: "Evento di prova", en: "Test event" },
        description: { it: "Descrizione evento", en: "Event description" },
        category: null,
        themes: ["cyber"],
        geography: null,
        places: ["IT"],
        evidence_note: null,
        evidence_level: "E1",
        publisher: null,
        url: null,
        sources: ["S90"],
        known_issues: [],
        review: baseReview,
        provenance: baseProv,
      },
    ],
    relationships: [
      {
        id: "G-9001",
        subject: "ENT_A",
        predicate: "COOPERATES_WITH",
        object: "ENT_B",
        relation_class: "operational",
        evidence_level: "E1",
        evidence_status: "documented",
        events: ["TL-9001"],
        valid_from: null,
        valid_to: null,
        primary_url: "https://example.org/s90",
        caveat: null,
        sources: ["S90"],
        review: baseReview,
        provenance: baseProv,
      },
      {
        id: "G-9002",
        subject: "ENT_A",
        predicate: "MENTIONS",
        object: "ENT_B",
        relation_class: "context",
        evidence_level: "E2",
        evidence_status: "institutional_attribution",
        events: [],
        valid_from: null,
        valid_to: null,
        primary_url: "https://example.org/s91",
        caveat: null,
        sources: ["S91"],
        review: baseReview,
        provenance: baseProv,
      },
    ],
    hypotheses: [
      {
        id: "H90",
        subject: "ENT_A",
        object: "ENT_B",
        hypothesis_type: "DIRECT_CONTROL",
        question: { it: "Domanda?", en: "Question?" },
        current_limit: { it: "Limite", en: "Limit" },
        priority: "high",
        evidence_needed: { it: "Evidenza", en: "Evidence" },
        events: ["TL-9001"],
        external_url: null,
        status: "open_unproven",
        sources: ["S90"],
        review: baseReview,
        provenance: baseProv,
      },
    ],
    exposures: [
      {
        id: "X-900",
        sector: { it: "Energia", en: "Energy" },
        indicator: { it: "Quota", en: "Share" },
        measures: [
          {
            label: { it: "Valore", en: "Value" },
            value: 42,
            unit: "percent",
            qualifier: "exact",
            out_of: null,
            period: "2024",
          },
        ],
        scope: { it: "Ambito", en: "Scope" },
        consequence: { it: "Conseguenza", en: "Consequence" },
        status: "observed",
        sources: ["S91"],
        review: baseReview,
        provenance: baseProv,
      },
    ],
  };
}

function makeTestArticles(): Article[] {
  return [
    {
      id: "ART-9001",
      fixture: false,
      title: { it: "Articolo test", en: "Test article" },
      summary: { it: "Sintesi", en: "Summary" },
      date: "2025-03-01",
      updated: null,
      generated_by: { kind: "human", tool: null, run_date: null },
      links: {
        events: ["TL-9001"],
        entities: ["ENT_A"],
        relationships: ["G-9001"],
        hypotheses: ["H90"],
      },
      references: [{ source: "S90", note: null }],
      body: { it: "Corpo testo", en: "Body text" },
      review: { status: "reviewed", notes: [], translations: {} },
    },
  ];
}

describe("PK-07 source impact index and CLI", () => {
  it("maps source -> assertions, relationships, events, articles, hypotheses, and exposures transitively", () => {
    const dataset = makeTestDataset();
    const articles = makeTestArticles();
    const index = buildSourceImpactIndex({
      dataset,
      articles,
      assertions: [{ id: "A-9001", sources: ["S90"], relationship_id: "G-9001" }],
    });

    const impact = lookupSourceImpact(index, "S90");
    expect(impact.exists).toBe(true);
    expect(impact.dependent_sources).toEqual(["S91"]);
    expect(impact.assertions).toEqual(["A-9001"]);
    expect(impact.relationships).toEqual(["G-9001", "G-9002"]);
    expect(impact.events).toEqual(["TL-9001"]);
    expect(impact.articles).toEqual(["ART-9001"]);
    expect(impact.hypotheses).toEqual(["H90"]);
    expect(impact.exposures).toEqual(["X-900"]);
    expect(impact.total_dependents).toBe(8);
  });

  it("queries real repository dataset via CLI for S01", () => {
    const { dataset } = validateDataFiles(readDataFiles());
    const { articles } = validateArticleFiles(readArticleFiles(), dataset);
    const index = buildSourceImpactIndex({ dataset, articles });
    const s01 = lookupSourceImpact(index, "S01");
    expect(s01.exists).toBe(true);
    expect(s01.total_dependents).toBeGreaterThan(0);

    const stdout = execFileSync("node", ["src/cli/impact.ts", "S01"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    const parsed = JSON.parse(stdout) as {
      source_id: string;
      exists: boolean;
      total_dependents: number;
    };
    expect(parsed.source_id).toBe("S01");
    expect(parsed.exists).toBe(true);
    expect(parsed.total_dependents).toBe(s01.total_dependents);
  });
});

describe("PK-07 tiered response policy, containment, external tracker, and staleness", () => {
  it("maps all 5 retraction levels to their required response actions", () => {
    expect(responseForLevel("marginal_correction").action).toBe("ordinary_review");
    expect(responseForLevel("secondary_source_retracted").action).toBe("flag_dependents");
    expect(responseForLevel("primary_evidence_contested").action).toBe("public_review_notice");
    expect(responseForLevel("sole_decisive_evidence_withdrawn").action).toBe(
      "precautionary_suspension",
    );
    expect(responseForLevel("severe_person_error").action).toBe("priority_human_verification");
  });

  it("suspends dependent records across all controlled projections when sole decisive evidence is withdrawn without mutating historical facts", () => {
    const dataset = makeTestDataset();
    const articles = makeTestArticles();

    // Snapshot canonical data files on disk to verify zero automatic mutation of historical facts
    const tmpDir = makeTempDir("oem-retract-");
    const eventFile = path.join(tmpDir, "TL-9001.json");
    const relFile = path.join(tmpDir, "G-9001.json");
    cpSync(path.join(process.cwd(), "data/events/TL-0001.json"), eventFile);
    cpSync(path.join(process.cwd(), "data/relationships/G-0001.json"), relFile);
    const eventBefore = readFileSync(eventFile, "utf8");
    const relBefore = readFileSync(relFile, "utf8");

    const impact = lookupSourceImpact(
      buildSourceImpactIndex({
        dataset,
        articles,
        assertions: [{ id: "A-9001", sources: ["S90"], relationship_id: "G-9001" }],
      }),
      "S90",
    );

    const externalLog = logExternalWithdrawal([
      {
        target_kind: "release",
        identifier: "v2025.03.01",
        status: "initiated",
        initiated_at: "2025-03-10T10:00:00Z",
        note: "Errata notice opened for release v2025.03.01",
      },
      {
        target_kind: "doi",
        identifier: "10.5281/zenodo.0000000",
        status: "logged",
        initiated_at: "2025-03-10T10:05:00Z",
      },
      {
        target_kind: "external_archive",
        identifier: "https://web.archive.org/web/20250301/https://example.org",
        status: "logged",
        initiated_at: "2025-03-10T10:10:00Z",
      },
    ]);

    expect(externalLog.uncontrollable_copies_notice).toContain("outside OEM's direct control");

    let register = createEmptyRetractionRegister();
    const suspendedTargets = [
      ...impact.assertions,
      ...impact.relationships,
      ...impact.events,
      ...impact.articles,
      ...impact.hypotheses,
    ];

    register = appendRetractionEntry(register, {
      id: "RET-001",
      source_id: "S90",
      level: "sole_decisive_evidence_withdrawn",
      recorded_at: "2025-03-10T10:15:00Z",
      reason: "Sole decisive official report S90 withdrawn by issuing authority.",
      before: {
        source_status: "active",
        dependent_ids: suspendedTargets,
      },
      after: {
        source_status: "withdrawn",
        suspended_ids: suspendedTargets,
      },
      suspended_ids: suspendedTargets,
      flagged_ids: impact.exposures,
      public_notice: {
        it: "Sospensione cautelativa in seguito al ritiro della fonte decisiva S90.",
        en: "Precautionary suspension following withdrawal of decisive source S90.",
      },
      external_withdrawals: externalLog.entries,
      uncontrollable_copies_notice: externalLog.uncontrollable_copies_notice,
    });

    const registerPath = path.join(tmpDir, "register.v1.json");
    writeRetractionRegister(register, registerPath);
    const loadedRegister = readRetractionRegister(registerPath);
    expect(validateRetractionRegister(loadedRegister)).toEqual([]);
    expect(loadedRegister.entries[0]?.historical_facts_mutated).toBe(false);

    for (const projection of CONTROLLED_PROJECTIONS) {
      const suspended = suspendedRecordIds(loadedRegister, projection);
      expect(suspended.has("A-9001")).toBe(true);
      expect(suspended.has("G-9001")).toBe(true);
      expect(suspended.has("TL-9001")).toBe(true);
      expect(suspended.has("ART-9001")).toBe(true);
      expect(suspended.has("H90")).toBe(true);

      const relProjection = filterControlledProjection(
        projection,
        dataset.relationships,
        suspended,
      );
      expect(relProjection.visible).toEqual([]);
      expect(relProjection.suspended).toEqual(["G-9001", "G-9002"]);
    }

    // Historical canonical facts remain completely untouched
    expect(readFileSync(eventFile, "utf8")).toBe(eventBefore);
    expect(readFileSync(relFile, "utf8")).toBe(relBefore);
  });

  it("triggers a staleness threshold warning when a local projection (e.g. MCP) exceeds max staleness", () => {
    const fresh = checkProjectionStaleness({
      projection: "mcp",
      generatedAt: "2025-03-10T09:00:00Z",
      now: "2025-03-10T10:00:00Z",
      maxStalenessSeconds: 86_400,
    });
    expect(fresh.stale).toBe(false);
    expect(fresh.warning).toBeNull();

    const stale = checkProjectionStaleness({
      projection: "mcp",
      generatedAt: "2025-03-08T00:00:00Z",
      now: "2025-03-10T10:00:00Z",
      maxStalenessSeconds: 86_400,
    });
    expect(stale.stale).toBe(true);
    expect(stale.warning).toContain("mcp");
    expect(stale.warning).toContain("may not be current");
  });

  it("validates the checked-in docs/retractions/register.v1.json", () => {
    const register = readRetractionRegister();
    expect(register.registry).toBe("retractions");
    expect(register.version).toBe(1);
    expect(validateRetractionRegister(register)).toEqual([]);
    expect(suspendedRecordIds(register).size).toBe(0);
  });

  it("withholds suspended records in publicationReport across controlled projections", () => {
    const { dataset } = validateDataFiles(readDataFiles());
    const baseline = publicationReport(dataset);
    const targetEvent = baseline.dataset.events[0];
    const targetSource = baseline.dataset.sources[0];
    if (!targetEvent || !targetSource) throw new Error("missing baseline fixture");

    const suspended = new Set<string>([targetEvent.id, targetSource.id]);
    const report = publicationReport(dataset, undefined, suspended);

    expect(report.dataset.events.some((e) => e.id === targetEvent.id)).toBe(false);
    expect(report.dataset.sources.some((s) => s.id === targetSource.id)).toBe(false);
    expect(report.withheld.find((w) => w.id === targetEvent.id)?.reasons).toContain(
      "retraction_suspended",
    );
    expect(report.withheld.find((w) => w.id === targetSource.id)?.reasons).toContain(
      "retraction_suspended",
    );
    expect(
      [
        ...report.dataset.events,
        ...report.dataset.relationships,
        ...report.dataset.hypotheses,
        ...report.dataset.exposures,
      ].every((r) => !r.sources.includes(targetSource.id)),
    ).toBe(true);
  });
});
