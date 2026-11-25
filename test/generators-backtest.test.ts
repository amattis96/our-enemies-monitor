import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  LLM_TEMPORAL_CONTAMINATION_DISCLAIMER,
  RETROSPECTIVE_PARTIAL_DISCLAIMER,
  runBacktestReport,
} from "../src/discovery/backtest.ts";
import { createContradictionsGenerator } from "../src/discovery/generators/contradictions.ts";
import { createEvidentiaryGapsGenerator } from "../src/discovery/generators/evidentiary-gaps.ts";
import type { GeneratorContext } from "../src/discovery/generators/interface.ts";
import { createJudicialUpdatesGenerator } from "../src/discovery/generators/judicial-updates.ts";
import { createMissingLinksGenerator } from "../src/discovery/generators/missing-links.ts";
import {
  createOpenTriadsGenerator,
  loadPathGrammar,
} from "../src/discovery/generators/open-triads.ts";
import {
  evaluatePromotionGate,
  measureExAnteQuality,
  measureExPostYield,
  runGeneratorRegistry,
} from "../src/discovery/generators/registry.ts";
import { createRelationChangesGenerator } from "../src/discovery/generators/relation-changes.ts";
import {
  createWeakBridgesGenerator,
  shouldExcludeGenericNode,
} from "../src/discovery/generators/weak-bridges.ts";
import type { InferenceRegistry } from "../src/editorial/inferences.ts";
import type { Dataset, Entity, Event, Relationship, Review } from "../src/model/index.ts";
import {
  PrivateDomainAccessError,
  recordKnowledgeRevision,
  recordSnapshotTransition,
} from "../src/temporal/index.ts";

const REVIEW: Review = { status: "imported_unreviewed", notes: [] };

const CTX: GeneratorContext = {
  snapshot_id: "snap-test",
  dataset_hash: "0".repeat(64),
  engine_version: "1.0.0",
  generated_at: "2026-01-01T00:00:00Z",
  run_id: "run-test-1",
};

function makeEntity(
  id: string,
  kind: Entity["kind"],
  domain: Entity["domain"] = "geopolitics",
  aliases?: Entity["aliases"],
): Entity {
  return {
    id,
    kind,
    name: { it: id, en: id },
    domain,
    country: kind === "state" ? "RU" : null,
    ...(aliases ? { aliases } : {}),
    review: REVIEW,
    provenance: [],
  };
}

function makeEvent(
  id: string,
  start: string,
  opts?: { themes?: Event["themes"]; first_reported?: string; title?: string },
): Event {
  return {
    id,
    record_type: "event",
    timeline_status: "integrated",
    date: { start, end: null, precision: "day" },
    ...(opts?.first_reported ? { first_reported: opts.first_reported } : {}),
    title: { it: opts?.title ?? `Event ${id}`, en: opts?.title ?? `Event ${id}` },
    description: { it: `Description for ${id}`, en: `Description for ${id}` },
    category: null,
    themes: opts?.themes ?? ["cyber"],
    geography: null,
    places: [],
    evidence_note: null,
    evidence_level: "E2",
    publisher: null,
    url: null,
    sources: ["S01"],
    known_issues: [],
    review: REVIEW,
    provenance: [],
  };
}

function makeRel(
  id: string,
  subject: string,
  predicate: string,
  object: string,
  opts?: Partial<Relationship>,
): Relationship {
  return {
    id,
    subject,
    predicate,
    object,
    relation_class: opts?.relation_class ?? "operational",
    evidence_level: opts?.evidence_level ?? "E2",
    evidence_status: opts?.evidence_status ?? "corroborated",
    events: opts?.events ?? [],
    valid_from: opts?.valid_from ?? null,
    valid_to: opts?.valid_to ?? null,
    primary_url: opts?.primary_url ?? null,
    caveat: opts?.caveat ?? null,
    sources: opts?.sources ?? ["S01"],
    review: REVIEW,
    provenance: [],
  };
}

function makeRegistry(pairs: [string, string][] = []): InferenceRegistry {
  return {
    registry: "forbidden-inferences",
    version: 1,
    as_of_commit: "026c5ab",
    notes: ["Test inference registry for unit tests."],
    forbidden_inferences: pairs.map((pair, idx) => ({
      id: `FI-${String(idx + 1).padStart(3, "0")}`,
      pairs: [pair],
      statement: {
        it: `Inferenza vietata tra ${pair[0]} e ${pair[1]}.`,
        en: `Forbidden inference between ${pair[0]} and ${pair[1]}.`,
      },
      declared_by: { kind: "source", source: "S01", record: null, locator: "Test §1" },
      hypotheses: [],
      note: null,
      state: "revisionata",
      proposed_by: "test-suite",
      reviewer: "maintainer",
      reviewed_on: "2026-01-01",
      lifted: null,
    })),
    caveat_classifications: [],
  };
}

const tempDirs: string[] = [];
afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe("PK-11: Path grammar and deterministic generators", () => {
  it("loads path-grammar.v1.json with allowed, conditional, and forbidden rules", () => {
    const grammar = loadPathGrammar();
    expect(grammar.schema_version).toBe("1.0.0");
    expect(grammar.excluded_classification_statuses).toContain("unmapped");
    expect(grammar.enforce_b15_forbidden_pairs).toBe(true);
    expect(grammar.rules.some((r) => r.status === "allowed")).toBe(true);
    expect(grammar.rules.some((r) => r.status === "forbidden")).toBe(true);
    expect(grammar.rules.some((r) => r.status === "conditional")).toBe(true);
  });

  it("open-triads generates allowed triads and produces zero forbidden pairs or unmapped relationships", async () => {
    const dataset: Dataset = {
      events: [makeEvent("TL-0001", "2024-03-01")],
      entities: [
        makeEntity("ACTOR_A", "state"),
        makeEntity("BROKER_B", "company"),
        makeEntity("TARGET_C", "company"),
        makeEntity("FORBIDDEN_D", "organization"),
        makeEntity("UNMAPPED_E", "company"),
      ],
      relationships: [
        // Allowed triad: ACTOR_A -[CONTROLLED]-> BROKER_B -[CONTROLLED]-> TARGET_C
        makeRel("G-0001", "ACTOR_A", "CONTROLLED", "BROKER_B", { valid_from: "2023-01-01" }),
        makeRel("G-0002", "BROKER_B", "CONTROLLED", "TARGET_C", { valid_from: "2023-06-01" }),
        // Forbidden pair triad: ACTOR_A -> BROKER_B -> FORBIDDEN_D (B15 forbids ACTOR_A|FORBIDDEN_D)
        makeRel("G-0003", "BROKER_B", "CONTROLLED", "FORBIDDEN_D", { valid_from: "2023-06-01" }),
        // Forbidden grammar combination: ACTOR_A -[FUNDED]-> BROKER_B -[CONTROLLED]-> TARGET_C
        makeRel("G-0004", "ACTOR_A", "FUNDED", "BROKER_B", {
          relation_class: "financial",
          valid_from: "2023-01-01",
        }),
        // Unmapped predicate: BROKER_B -[CUSTOM_UNMAPPED_REL]-> UNMAPPED_E
        makeRel("G-0005", "BROKER_B", "CUSTOM_UNMAPPED_REL", "UNMAPPED_E"),
      ],
      hypotheses: [],
      sources: [],
      exposures: [],
    };
    const registry = makeRegistry([["ACTOR_A", "FORBIDDEN_D"]]);
    const gen = createOpenTriadsGenerator({ dataset, inferenceRegistry: registry });
    const candidates = await gen.generate(CTX);

    expect(candidates.length).toBe(1);
    expect(candidates[0]?.refs).toContain("ACTOR_A");
    expect(candidates[0]?.refs).toContain("TARGET_C");
    // Zero forbidden pairs
    expect(candidates.some((c) => c.refs.includes("FORBIDDEN_D"))).toBe(false);
    // Zero unmapped relationships
    expect(candidates.some((c) => c.refs.includes("G-0005") || c.refs.includes("UNMAPPED_E"))).toBe(
      false,
    );
    // Zero grammar-forbidden FUNDED + CONTROLLED
    expect(candidates.some((c) => c.refs.includes("G-0004"))).toBe(false);
  });

  it("weak-bridges uses predicate- and purpose-driven generic-node exclusion (not entity kind alone)", async () => {
    const stateNode = makeEntity("STATE_HUB", "state", "geopolitics");

    // Same state node is excluded for PARTICIPATED_IN in weak_bridge discovery...
    expect(
      shouldExcludeGenericNode({
        node: stateNode,
        predicate: "PARTICIPATED_IN",
        purpose: "weak_bridge",
        degree: 5,
      }),
    ).toBe(true);

    // ...but NOT excluded for CONTROLLED in weak_bridge_structural or attribution_trace!
    expect(
      shouldExcludeGenericNode({
        node: stateNode,
        predicate: "CONTROLLED",
        purpose: "weak_bridge_structural",
        degree: 5,
      }),
    ).toBe(false);
    expect(
      shouldExcludeGenericNode({
        node: stateNode,
        predicate: "PARTICIPATED_IN",
        purpose: "attribution_trace",
        degree: 5,
      }),
    ).toBe(false);

    const dataset: Dataset = {
      events: [],
      entities: [
        makeEntity("COMP_A", "company", "commerce-infrastructure"),
        makeEntity("COMP_B", "company", "commerce-infrastructure"),
        makeEntity("COMP_C", "company", "commerce-infrastructure"),
      ],
      relationships: [
        makeRel("G-0010", "COMP_A", "CONTROLLED", "COMP_B"),
        makeRel("G-0011", "COMP_B", "CONTROLLED", "COMP_C"),
      ],
      hypotheses: [],
      sources: [],
      exposures: [],
    };
    const gen = createWeakBridgesGenerator({ dataset, inferenceRegistry: makeRegistry() });
    const candidates = await gen.generate(CTX);
    expect(candidates.length).toBe(2);
    expect(candidates.every((c) => c.method === "weak_bridges")).toBe(true);
  });

  it("contradictions detects incompatible roles, out-of-lifespan relations, judicial scaling-back, and discordant attributions", async () => {
    const dataset: Dataset = {
      events: [
        makeEvent("TL-0001", "2025-05-01"),
        makeEvent("TL-0002", "2025-06-01", {
          themes: ["justice"],
          title: "Tribunale archivia accusa contro ORG_X",
        }),
      ],
      entities: [
        makeEntity("ORG_X", "organization", "intelligence-security", [
          {
            name: "ORG_X",
            kind: "rename",
            valid_from: "2020-01-01",
            valid_to: "2023-12-31",
          },
        ]),
        makeEntity("ACTOR_Y", "person", "persons"),
      ],
      relationships: [
        // Incompatible roles: ORG_X ACCUSED_OF ACTOR_Y vs ACTOR_Y COMMISSIONED ORG_X
        makeRel("G-0020", "ORG_X", "ACCUSED_OF", "ACTOR_Y", {
          evidence_status: "allegation",
          evidence_level: "E4",
          events: ["TL-0002"],
        }),
        makeRel("G-0021", "ACTOR_Y", "COMMISSIONED", "ORG_X"),
        // Out of lifespan: ORG_X ended 2023-12-31, relation starts 2025-01-01
        makeRel("G-0022", "ORG_X", "CONTROLLED", "ACTOR_Y", { valid_from: "2025-01-01" }),
      ],
      hypotheses: [],
      sources: [],
      exposures: [],
    };

    const gen = createContradictionsGenerator({
      dataset,
      inferenceRegistry: makeRegistry(),
      proceduralRecords: [
        { id: "PROC-1", entity_id: "ORG_X", status: "acquitted", date: "2025-07-01" },
      ],
      attributionClaims: [
        {
          id: "CLM-1",
          target_id: "TL-0001",
          level: "sponsor",
          attributed_actor_id: "ORG_X",
          source_id: "S01",
          stance: "attribution",
        },
        {
          id: "CLM-2",
          target_id: "TL-0001",
          level: "sponsor",
          attributed_actor_id: "ACTOR_Y",
          source_id: "S02",
          stance: "attribution",
        },
      ],
    });

    const candidates = await gen.generate(CTX);
    const questions = candidates.map((c) => c.question);
    expect(questions.some((q) => q.includes("Incompatible roles"))).toBe(true);
    expect(questions.some((q) => q.includes("outside the recorded lifespan"))).toBe(true);
    expect(questions.some((q) => q.includes("scales back accusation"))).toBe(true);
    expect(questions.some((q) => q.includes("Verification request (sponsor level)"))).toBe(true);
  });

  it("relation-changes, missing-links, judicial-updates, and evidentiary-gaps produce deterministic candidates", async () => {
    const dataset: Dataset = {
      events: [
        makeEvent("TL-0001", "2024-02-01"),
        makeEvent("TL-0002", "2024-09-01", { themes: ["justice"], title: "Indagine avviata" }),
      ],
      entities: [makeEntity("ENT_A", "company"), makeEntity("ENT_B", "company")],
      relationships: [
        makeRel("G-0030", "ENT_A", "SUPPLIED", "ENT_B", {
          valid_from: "2023-01-01",
          valid_to: "2023-12-31",
          evidence_status: "allegation",
          evidence_level: "E4",
          events: ["TL-0001"],
        }),
        makeRel("G-0031", "ENT_A", "CONTROLLED", "ENT_B", {
          valid_from: "2024-01-01",
          evidence_status: "corroborated",
          evidence_level: "E3",
        }),
        makeRel("G-0032", "ENT_B", "PARTICIPATED_IN", "TL-0001", {
          relation_class: "event_participation",
          events: ["TL-0001"],
        }),
        makeRel("G-0033", "ENT_A", "PARTICIPATED_IN", "TL-0002", {
          relation_class: "event_participation",
          events: ["TL-0002"],
        }),
      ],
      hypotheses: [],
      sources: [],
      exposures: [],
    };
    const registry = makeRegistry();

    const relChanges = await createRelationChangesGenerator({
      dataset,
      inferenceRegistry: registry,
    }).generate(CTX);
    const missing = await createMissingLinksGenerator({
      dataset,
      inferenceRegistry: registry,
    }).generate(CTX);
    const judicial = await createJudicialUpdatesGenerator({
      dataset,
      inferenceRegistry: registry,
    }).generate(CTX);
    const gaps = await createEvidentiaryGapsGenerator({
      dataset,
      inferenceRegistry: registry,
    }).generate(CTX);

    expect(relChanges.length).toBeGreaterThan(0);
    expect(missing.length).toBeGreaterThan(0);
    expect(judicial.length).toBeGreaterThan(0);
    expect(gaps.length).toBeGreaterThan(0);
  });

  it("registry enforces ex-ante quality & ex-post yield before advancing past shadow", async () => {
    const dataset: Dataset = {
      events: [],
      entities: [
        makeEntity("A", "company"),
        makeEntity("B", "company"),
        makeEntity("C", "company"),
      ],
      relationships: [
        makeRel("G-0001", "A", "CONTROLLED", "B"),
        makeRel("G-0002", "B", "CONTROLLED", "C"),
      ],
      hypotheses: [],
      sources: [],
      exposures: [],
    };
    const registry = makeRegistry();

    const result = await runGeneratorRegistry(CTX, {
      dataset,
      inferenceRegistry: registry,
      activations: {
        open_triads: "shadow",
        weak_bridges: "disabled",
      },
      validationSet: [{ target_refs: ["A", "B", "C"], method: "open_triads", confirmed: true }],
    });

    const disabledMetric = result.metrics.find((m) => m.id === "weak_bridges");
    expect(disabledMetric?.skipped).toBe(true);

    const shadowMetric = result.metrics.find((m) => m.id === "open_triads");
    expect(shadowMetric?.activation).toBe("shadow");
    expect(shadowMetric?.eligible_for_promotion).toBe(true);
    // Shadow candidates do not enter active_candidates
    expect(result.shadow_candidates.some((c) => c.method === "open_triads")).toBe(true);
    expect(result.active_candidates.some((c) => c.method === "open_triads")).toBe(false);

    // Promotion gate blocks when validation set is absent or yield is too low
    const exAnte = measureExAnteQuality(result.shadow_candidates, dataset, registry);
    const lowYield = measureExPostYield(result.shadow_candidates, [
      { target_refs: ["NONEXISTENT"], confirmed: true },
    ]);
    const blocked = evaluatePromotionGate(
      { id: "open_triads", activation: "shadow", min_ex_ante_quality: 0.9, min_ex_post_yield: 0.2 },
      exAnte,
      lowYield,
      true,
    );
    expect(blocked.eligible).toBe(false);
    expect(blocked.reasons.some((r) => r.includes("ex_post_yield"))).toBe(true);
  });
});

describe("PK-14: Backtest and historical replay", () => {
  it("enforces zero future leakage across 3 dates and includes contamination + retrospective-partial disclaimers", async () => {
    const tmp = mkdtempSync(path.join(os.tmpdir(), "oem-backtest-"));
    tempDirs.push(tmp);
    const snapshotsDir = path.join(tmp, "snapshots");

    recordSnapshotTransition(
      {
        event_id: "evt-1",
        snapshot_id: "snap-2025-01-01",
        transition: "snapshot.accepted",
        commit: "026c5ab",
        recorded_at: "2025-01-01T12:00:00Z",
        precision: "second",
        versions: { dataset: "0.1.0", portal: "0.1.0", schema: "1.0.0", engine: "0.9.0" },
        dataset_hash: "a".repeat(64),
        idempotency_key: "k1",
      },
      snapshotsDir,
    );

    const dataset: Dataset = {
      events: [
        makeEvent("TL-0001", "2024-03-01"),
        makeEvent("TL-0002", "2025-06-01", { first_reported: "2025-06-02" }),
      ],
      entities: [
        makeEntity("ENT_1", "company"),
        makeEntity("ENT_2", "company"),
        makeEntity("ENT_3", "company"),
      ],
      relationships: [
        makeRel("G-0001", "ENT_1", "CONTROLLED", "ENT_2", { valid_from: "2024-01-01" }),
        makeRel("G-0002", "ENT_2", "CONTROLLED", "ENT_3", {
          valid_from: "2025-06-01",
          events: ["TL-0002"],
        }),
      ],
      hypotheses: [],
      sources: [],
      exposures: [],
    };

    const report = await runBacktestReport({
      dates: ["2024-06-01", "2025-01-01", "2026-01-01"],
      mode: "canonical",
      experiment: "both",
      snapshotsDir,
      dataset,
      inferenceRegistry: makeRegistry(),
      validationSet: [
        { target_refs: ["ENT_1", "ENT_2", "ENT_3"], method: "open_triads", confirmed: true },
      ],
    });

    expect(report.dates.length).toBe(3);
    expect(report.disclaimers.llm_temporal_contamination).toBe(
      LLM_TEMPORAL_CONTAMINATION_DISCLAIMER,
    );
    expect(report.disclaimers.retrospective_partial).toBe(RETROSPECTIVE_PARTIAL_DISCLAIMER);

    // Date 1 (2024-06-01): before snapshot inception -> retrospective_partial: true, historical_replay not reconstructible, zero leakage of TL-0002/G-0002
    const d1 = report.dates[0];
    expect(d1?.asof.retrospective_partial).toBe(true);
    const d1Retro = d1?.experiments.find((e) => e.experiment === "retrospective_backtest");
    const d1Replay = d1?.experiments.find((e) => e.experiment === "historical_replay");
    expect(d1Retro?.dataset_counts.events).toBe(1);
    expect(d1Retro?.dataset_counts.relationships).toBe(1);
    expect(d1Replay?.reconstructible).toBe(false);

    // Date 2 (2025-01-01): snapshot exists (engine 0.9.0) -> historical_replay reconstructible
    const d2 = report.dates[1];
    const d2Replay = d2?.experiments.find((e) => e.experiment === "historical_replay");
    expect(d2Replay?.reconstructible).toBe(true);
    expect(d2Replay?.engine_version).toBe("0.9.0");

    // Date 3 (2026-01-01): TL-0002 & G-0002 now visible -> open_triads finds triad & records yield
    const d3 = report.dates[2];
    const d3Retro = d3?.experiments.find((e) => e.experiment === "retrospective_backtest");
    expect(d3Retro?.dataset_counts.events).toBe(2);
    expect(d3Retro?.dataset_counts.relationships).toBe(2);
    const triadYield = d3Retro?.per_method.find((m) => m.method === "open_triads");
    expect(triadYield?.candidate_count).toBe(1);
    expect(triadYield?.confirmed_hits).toBe(1);
    expect(triadYield?.yield_rate).toBe(1);
  });

  it("supports acquired mode in private domain and blocks public/mcp surfaces", async () => {
    const tmp = mkdtempSync(path.join(os.tmpdir(), "oem-backtest-priv-"));
    tempDirs.push(tmp);
    const revisionsDir = path.join(tmp, "revisions");

    recordKnowledgeRevision(
      {
        stage: "acquired",
        collection: "entities",
        record_id: "PRIV_A",
        recorded_at: "2024-05-01T00:00:00Z",
        precision: "second",
        record: makeEntity("PRIV_A", "company") as unknown as Record<string, unknown>,
      },
      revisionsDir,
    );

    const privReport = await runBacktestReport({
      dates: ["2024-06-01"],
      mode: "acquired",
      experiment: "retrospective_backtest",
      surface: "private",
      revisionsDir,
      inferenceRegistry: makeRegistry(),
    });
    expect(privReport.dates[0]?.asof.domain).toBe("private");
    expect(privReport.dates[0]?.experiments[0]?.dataset_counts.entities).toBe(1);

    await expect(
      runBacktestReport({
        dates: ["2024-06-01"],
        mode: "acquired",
        experiment: "retrospective_backtest",
        surface: "public",
        revisionsDir,
        inferenceRegistry: makeRegistry(),
      }),
    ).rejects.toThrow(PrivateDomainAccessError);
  });
});
