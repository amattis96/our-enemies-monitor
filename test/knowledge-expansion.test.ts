import { describe, expect, it } from "vitest";
import {
  filterSourcesByCountryAndLanguage,
  generateSourceCoverageReport,
  loadSourceRegistry,
} from "../src/acquisition/source-registry.ts";
import {
  compareIndicators,
  computeAvailableCapacityToday,
  DependencyIndicatorSchema,
  generateEconomicPropagationCandidates,
  generateSharedDependencyCandidates,
  loadSupplyChainCatalog,
} from "../src/dependencies/engine.ts";
import {
  COMPETING_EXPLANATION_KINDS,
  computeReactivationFingerprint,
  findTemporalPaths,
  LEAD_EVALUATION_OUTCOMES,
  LeadRecordSchema,
  LikelihoodAssessmentSchema,
  shouldReactivateLead,
} from "../src/discovery/leads.ts";
import type { InferenceRegistry } from "../src/editorial/inferences.ts";
import type { Dataset, Entity, Relationship } from "../src/model/index.ts";
import type { RunManifest } from "../src/runs/schema.ts";
import {
  buildHybridSearchIndex,
  computeContentHash,
  evaluateHybridVsLexical,
  searchHybridIndex,
} from "../src/search/hybrid.ts";
import {
  aggregateRiskCalendar,
  buildRiskDossier,
  type RiskEvent,
} from "../src/taxonomies/calendar.ts";
import {
  classifyTechnique,
  loadTaxonomyManifest,
  migrateTechniqueIds,
  resolveTechnique,
} from "../src/taxonomies/index.ts";
import {
  evaluateVulnerabilitySignals,
  projectPublicVulnerabilityCatalog,
  type VulnerabilityCatalog,
} from "../src/taxonomies/vulnerabilities.ts";

describe("PK-25: Taxonomies, JRC/Hybrid CoE vulnerabilities, and risk calendar", () => {
  it("loads versioned taxonomy manifest with DISARM, MITRE ATT&CK, internal sabotage, migrations, and unclassifiable support", () => {
    const manifest = loadTaxonomyManifest();
    expect(manifest.frameworks.disarm.domain).toBe("FIMI");
    expect(manifest.frameworks.mitre_attack.domain).toBe("cyber");
    expect(manifest.frameworks.internal_sabotage.domain).toBe("sabotage_infrastructure");

    const active = resolveTechnique(manifest, "SAB-PROXY-001");
    expect(active.status).toBe("active");
    if (active.status === "active") {
      expect(active.technique.category).toBe("paid_saboteurs");
    }

    const migrated = resolveTechnique(manifest, "DISARM-T0010-LEGACY");
    expect(migrated.status).toBe("migrated");
    if (migrated.status === "migrated") {
      expect(migrated.resolved_id).toBe("DISARM-T0084");
    }

    const unknown = resolveTechnique(manifest, "UNKNOWN-999");
    expect(unknown.status).toBe("unclassifiable");

    const forcedCheck = classifyTechnique(manifest, {
      framework: "disarm",
      external_code: "NONEXISTENT",
    });
    expect(forcedCheck.status).toBe("unclassifiable");

    const batch = migrateTechniqueIds(manifest, [
      "ATT&CK-T1566",
      "DISARM-T0010-LEGACY",
      "unclassifiable",
    ]);
    expect(batch.resolved_ids).toEqual(["ATT&CK-T1566", "DISARM-T0084"]);
    expect(batch.migrated).toEqual([{ from_id: "DISARM-T0010-LEGACY", to_id: "DISARM-T0084" }]);
    expect(batch.unclassifiable).toHaveLength(1);
  });

  it("projects JRC/Hybrid CoE vulnerability catalog publicly while stripping private operational details", () => {
    const catalog: VulnerabilityCatalog = {
      schema_version: "1.0.0",
      catalog_version: "2026.11.1",
      entries: [
        {
          id: "VULN-ENERGY-01",
          title: "Subsea power interconnector exposure",
          domain: "energy",
          framework_ref: "JRC-HT-2023-EN-01",
          description:
            "Exposure of Baltic and North Sea subsea power cables to physical tampering.",
          severity_band: "high",
          linked_technique_ids: ["SAB-INFRA-001"],
          public_summary: "Subsea interconnectors face elevated physical disruption risk.",
          private_operational_details: "PRIVATE_SENSOR_BLINDSPOT_COORDS_XYZ",
          weak_signals: [
            {
              signal_id: "WS-001",
              title: "Anomalous vessel loitering over Baltic interconnector",
              domain: "energy",
              indicator_description: "AIS dark period over cable corridor.",
              observed_at: "2025-10-12",
              confidence: "high",
              source_refs: ["SRC-EE-VLA"],
              visibility: "public",
              public_summary: "Unusual maritime loitering observed near subsea cable corridor.",
            },
            {
              signal_id: "WS-002",
              title: "Private HUMINT tip on proxy recruitment",
              domain: "energy",
              indicator_description: "Encrypted channel recruitment chatter.",
              observed_at: "2025-10-14",
              confidence: "medium",
              source_refs: ["SRC-PRIVATE-01"],
              visibility: "private",
              public_summary: "Redacted.",
              private_operational_details: "PRIVATE_TELEGRAM_HANDLE_DO_NOT_PUBLISH",
            },
          ],
        },
      ],
    };

    const firstEntry = catalog.entries[0];
    if (!firstEntry) throw new Error("Expected first vulnerability entry");
    const evalStats = evaluateVulnerabilitySignals(firstEntry);
    expect(evalStats.total_signals).toBe(2);
    expect(evalStats.private_signals).toBe(1);
    expect(evalStats.requires_review).toBe(true);

    const publicCatalog = projectPublicVulnerabilityCatalog(catalog);
    const serialized = JSON.stringify(publicCatalog);
    expect(serialized).not.toContain("PRIVATE_SENSOR_BLINDSPOT_COORDS_XYZ");
    expect(serialized).not.toContain("PRIVATE_TELEGRAM_HANDLE_DO_NOT_PUBLISH");
    expect(publicCatalog[0]?.weak_signals).toHaveLength(1);
    expect(publicCatalog[0]?.weak_signals[0]?.signal_id).toBe("WS-001");
  });

  it("aggregates official risk calendar and builds generalized public risk dossier", () => {
    const events: RiskEvent[] = [
      {
        id: "CAL-RO-2025",
        title: "Romanian Parliamentary Election",
        event_type: "election",
        country: "RO",
        region: "Eastern Europe",
        scheduled_date: "2025-05-04",
        window_start: "2025-04-01",
        window_end: "2025-05-15",
        official_source_url: "https://www.roaep.ro/",
        source_id: "SRC-RO-DNSC",
        risk_domains: ["electoral_process", "information_ecosystem"],
        related_vulnerability_ids: ["VULN-ELEC-01"],
      },
      {
        id: "CAL-EU-2025",
        title: "European Council Summit",
        event_type: "summit",
        country: "EU",
        region: "EU",
        scheduled_date: "2025-06-26",
        window_start: "2025-06-20",
        window_end: "2025-06-28",
        official_source_url: "https://www.consilium.europa.eu/",
        source_id: "SRC-EU-COUNCIL",
        risk_domains: ["cyber_infrastructure"],
        related_vulnerability_ids: [],
      },
    ];

    const agg = aggregateRiskCalendar(events, { country: "RO" });
    expect(agg.events).toHaveLength(1);
    expect(agg.by_type.election).toBe(1);

    const dossier = buildRiskDossier({
      dossier_id: "DOSSIER-RO-2025",
      label: "Romania Election Exposure Dossier",
      country: "RO",
      visibility: "public",
      generated_at: "2025-04-02T00:00:00Z",
      calendar_events: events,
      vulnerabilities: [
        {
          id: "VULN-ELEC-01",
          title: "Electoral FIMI Amplification",
          domain: "electoral_process",
          framework_ref: "HybridCoE-EL-01",
          description: "Coordinated inauthentic amplification during election silence.",
          severity_band: "high",
          weak_signals: [],
          linked_technique_ids: ["DISARM-T0084"],
          public_summary: "Elevated FIMI risk around election window.",
          private_operational_details: "PRIVATE_DO_NOT_LEAK",
        },
      ],
    });

    expect(dossier.technique_ids).toEqual(["DISARM-T0084"]);
    expect(JSON.stringify(dossier)).not.toContain("PRIVATE_DO_NOT_LEAK");
    expect(dossier.caveats.length).toBeGreaterThan(0);
  });
});

describe("PK-26: Multilingual source registry and PK-08 coverage report", () => {
  it("covers FR, DE, PL, UK, RO, Baltic (EE/LV/LT) plus RU/UA independent acquisition", () => {
    const registry = loadSourceRegistry();
    const countries = new Set(registry.sources.map((s) => s.country));
    for (const c of ["FR", "DE", "PL", "UK", "RO", "EE", "LV", "LT", "RU", "UA"]) {
      expect(countries.has(c)).toBe(true);
    }

    const ruUk = filterSourcesByCountryAndLanguage(registry, { independent_only: true }).filter(
      (s) => s.language === "ru" || s.language === "uk",
    );
    expect(ruUk).toHaveLength(2);
  });

  it("computes coverage report from PK-08 run manifests", () => {
    const registry = loadSourceRegistry();
    const runs: RunManifest[] = [
      {
        run_id: "run-001",
        task: "acquire-multilingual",
        role: "acquisition",
        provider: "local",
        model: "none",
        scheduled_at: "2026-11-25T00:00:00Z",
        started_at: "2026-11-25T00:01:00Z",
        finished_at: "2026-11-25T00:05:00Z",
        engine_version: "1.0.0",
        queries: ["baltics cable"],
        sources_consulted: [
          "SRC-FR-VIGINUM",
          "https://publication.pravo.gov.ru/document/123",
          "https://cert.gov.ua/article/456",
        ],
        errors: [],
        status: "completed_with_results",
      },
      {
        run_id: "run-002",
        task: "acquire-de",
        role: "acquisition",
        provider: "local",
        model: "none",
        scheduled_at: "2026-11-25T01:00:00Z",
        started_at: null,
        finished_at: null,
        engine_version: "1.0.0",
        queries: [],
        sources_consulted: [],
        errors: [],
        status: "missed",
      },
    ];

    const report = generateSourceCoverageReport(registry, runs);
    expect(report.total_runs_inspected).toBe(2);
    expect(report.missed_or_failed_runs).toBe(1);
    expect(report.total_consulted_sources).toBe(3);
    expect(report.ru_uk_independent_acquisition_active).toBe(true);
    expect(report.uncovered_source_ids).toContain("SRC-DE-BSI");
  });
});

describe("PK-27: Leads schema, competing explanations, and time-respecting path search", () => {
  it("enforces undeterminable as outcome only and rejects unmotivated likelihood ratios", () => {
    expect(COMPETING_EXPLANATION_KINDS).toHaveLength(5);
    expect(LEAD_EVALUATION_OUTCOMES).toContain("undeterminable");

    const badLikelihood = LikelihoodAssessmentSchema.safeParse({
      likelihood_ratio: 4.5,
      data_basis: null,
      evidence_refs: [],
      rationale: "Guessing.",
    });
    expect(badLikelihood.success).toBe(false);

    const fp = computeReactivationFingerprint({
      hypothesis_ids: ["HYP-1", "HYP-2"],
      steps: [
        {
          step_type: "documented",
          from_node: "E-001",
          to_node: "E-002",
          predicate: "CONTROLLED",
        },
      ],
      non_evaluability_conditions: ["Awaiting court filing disclosure."],
    });

    const validLead = LeadRecordSchema.parse({
      lead_id: "LEAD-001",
      title: "Intermediary control chain",
      hypothesis_ids: ["HYP-1", "HYP-2"],
      steps: [
        {
          step_type: "documented",
          from_node: "E-001",
          to_node: "E-002",
          relationship_id: "R-001",
          predicate: "CONTROLLED",
          lag_days: 14,
          valid_from: "2024-01-01",
          valid_to: "2024-06-01",
          confidence_note: "Corporate registry filing.",
        },
      ],
      falsifiers: ["Registry proves divestment prior to 2024-01-01."],
      supporting_evidence: [],
      contrary_evidence: [],
      non_evaluability_conditions: ["Awaiting court filing disclosure."],
      reactivation_fingerprint: fp,
      competing_explanations: [
        {
          kind: "intentional_coordination",
          summary: "Coordinated operational direction.",
          likelihood: {
            likelihood_ratio: null,
            data_basis: null,
            evidence_refs: [],
            rationale: "Insufficient baseline data for numeric ratio.",
          },
        },
        {
          kind: "ordinary_dynamics",
          summary: "Routine commercial subsidiary oversight.",
          likelihood: {
            likelihood_ratio: 1.5,
            data_basis: "motivated_estimate",
            evidence_refs: ["SRC-001"],
            rationale: "Consistent with standard holding structure.",
          },
        },
      ],
      composite_hypotheses: [
        {
          id: "COMP-1",
          component_explanations: ["common_cause", "ordinary_dynamics"],
          summary: "Shared regulatory shock plus routine commercial response.",
          likelihood: {
            likelihood_ratio: null,
            data_basis: null,
            evidence_refs: [],
            rationale: "Qualitative composite only.",
          },
        },
      ],
      evaluation_outcome: "undeterminable",
      created_at: "2026-11-25T00:00:00Z",
      updated_at: "2026-11-25T00:00:00Z",
    });

    expect(validLead.evaluation_outcome).toBe("undeterminable");
    const react = shouldReactivateLead(validLead, ["SRC-NEW-99"]);
    expect(react.reactivate).toBe(true);
  });

  it("finds time-respecting paths while blocking PK-11 forbidden pairs, unmapped edges, and penalizing generic hubs", () => {
    const makeEntity = (id: string, kind: Entity["kind"], domain: Entity["domain"]): Entity => ({
      id,
      kind,
      name: { it: id, en: id },
      aliases: [],
      country: "EU",
      domain,
      review: { status: "reviewed", notes: [] },
      provenance: [],
    });

    const makeRel = (
      id: string,
      subject: string,
      object: string,
      predicate: string,
      relClass: Relationship["relation_class"],
      validFrom: string,
      validTo: string,
    ): Relationship => ({
      id,
      subject,
      object,
      relation_class: relClass,
      predicate,
      valid_from: validFrom,
      valid_to: validTo,
      evidence_level: "E1",
      evidence_status: "documented",
      events: [],
      primary_url: null,
      caveat: null,
      sources: ["S-001"],
      review: { status: "reviewed", notes: [] },
      provenance: [],
    });

    const dataset: Dataset = {
      entities: [
        makeEntity("E-SRC", "company", "commerce-infrastructure"),
        makeEntity("E-MID", "company", "commerce-infrastructure"),
        makeEntity("E-STATE-HUB", "state", "geopolitics"),
        makeEntity("E-TGT", "company", "commerce-infrastructure"),
      ],
      events: [],
      relationships: [
        // Allowed temporal path: E-SRC -> E-MID -> E-TGT (CONTROLLED -> CONTROLLED)
        makeRel("R-1", "E-SRC", "E-MID", "CONTROLLED", "operational", "2023-01-01", "2024-01-01"),
        makeRel("R-2", "E-MID", "E-TGT", "CONTROLLED", "operational", "2024-02-01", "2025-01-01"),
        // Forbidden pair path: FUNDED -> CONTROLLED via E-STATE-HUB
        makeRel("R-3", "E-SRC", "E-STATE-HUB", "FUNDED", "financial", "2023-01-01", "2024-01-01"),
        makeRel(
          "R-4",
          "E-STATE-HUB",
          "E-TGT",
          "CONTROLLED",
          "operational",
          "2024-01-01",
          "2025-01-01",
        ),
        // Unmapped predicate should be ignored
        makeRel(
          "R-5",
          "E-SRC",
          "E-TGT",
          "unmapped_pred_xyz",
          "context",
          "2022-01-01",
          "2022-06-01",
        ),
      ],
      sources: [],
      hypotheses: [],
      exposures: [],
    };

    const emptyRegistry: InferenceRegistry = {
      registry: "forbidden-inferences",
      version: 1,
      as_of_commit: "0000000",
      notes: [],
      forbidden_inferences: [],
      caveat_classifications: [],
    };

    const paths = findTemporalPaths({
      dataset,
      source_id: "E-SRC",
      target_id: "E-TGT",
      max_length: 3,
      inferenceRegistry: emptyRegistry,
    });

    expect(paths).toHaveLength(1);
    expect(paths[0]?.nodes).toEqual(["E-SRC", "E-MID", "E-TGT"]);
    expect(paths[0]?.total_lag_days).toBeGreaterThan(0);
  });
});

describe("PK-28: Hybrid search index, strict public/private isolation, and offline evaluator", () => {
  it("enforces strict public/private index separation and evaluates hybrid vs lexical", () => {
    const publicChunks = [
      {
        chunk_id: "C-PUB-1",
        record_id: "REC-1",
        text: "Baltic subsea cable disruption investigation and maritime patrol report",
        metadata: {
          embedding_model: "oem-local-ngram-v1",
          model_version: "1.0.0",
          content_hash: computeContentHash(
            "Baltic subsea cable disruption investigation and maritime patrol report",
          ),
          segmentation_version: "seg-v1",
          language: "en",
          visibility: "public" as const,
        },
        structured: {
          entity_kinds: ["asset"],
          tags: ["infrastructure_space"],
          caveats: ["Attribution remains under official investigation."],
        },
      },
      {
        chunk_id: "C-PUB-2",
        record_id: "REC-2",
        text: "European Union sanctions compliance and rare earth magnet supply",
        metadata: {
          embedding_model: "oem-local-ngram-v1",
          model_version: "1.0.0",
          content_hash: computeContentHash(
            "European Union sanctions compliance and rare earth magnet supply",
          ),
          segmentation_version: "seg-v1",
          language: "en",
          visibility: "public" as const,
        },
        structured: {
          entity_kinds: ["company"],
          tags: ["industry_dependencies"],
          caveats: [],
        },
      },
    ];

    const pubIndex = buildHybridSearchIndex({
      index_id: "idx-public",
      visibility: "public",
      chunks: publicChunks,
    });

    const firstChunk = publicChunks[0];
    if (!firstChunk) throw new Error("Expected first chunk");

    // Attempting to index a private chunk into a public index MUST throw
    expect(() =>
      buildHybridSearchIndex({
        index_id: "idx-public-bad",
        visibility: "public",
        chunks: [
          {
            ...firstChunk,
            metadata: { ...firstChunk.metadata, visibility: "private" },
          },
        ],
      }),
    ).toThrow(/boundary violation/i);

    // Attempting to query a public index from a private context MUST throw
    expect(() =>
      searchHybridIndex(pubIndex, {
        query: "baltic cable",
        context_visibility: "private",
      }),
    ).toThrow(/boundary violation/i);

    const hits = searchHybridIndex(pubIndex, {
      query: "baltic subsea cable",
      context_visibility: "public",
      mode: "hybrid",
    });
    expect(hits[0]?.record_id).toBe("REC-1");
    expect(hits[0]?.suggestion_only).toBe(true);
    expect(hits[0]?.creates_edges).toBe(false);

    const evalReport = evaluateHybridVsLexical(pubIndex, [
      {
        query_id: "Q1",
        query: "subsea cables patrol",
        relevant_record_ids: ["REC-1"],
        required_caveats: {
          "REC-1": ["Attribution remains under official investigation."],
        },
      },
    ]);

    expect(evalReport.hybrid.recall_at_k).toBe(1);
    expect(evalReport.hybrid.caveat_preservation).toBe(1);
    expect(evalReport.hybrid.ndcg_at_k).toBeGreaterThanOrEqual(evalReport.lexical_only.ndcg_at_k);
  });
});

describe("PK-29: Strategic dependencies engine and supply-chain queue generators", () => {
  it("loads >=2 sourced supply-chain models and enforces capacity, unavailable, and comparison guards", () => {
    const catalog = loadSupplyChainCatalog();
    expect(catalog.supply_chains.length).toBeGreaterThanOrEqual(2);

    const ree = catalog.supply_chains.find((s) => s.id === "SC-RARE-EARTH-MAGNETS");
    expect(ree).toBeDefined();
    if (!ree) throw new Error("Expected SC-RARE-EARTH-MAGNETS");
    const firstInd = ree.indicators[0];
    if (!firstInd) throw new Error("Expected first indicator");

    // Unavailable indicator cannot have a synthetic numeric value
    const syntheticBad = DependencyIndicatorSchema.safeParse({
      ...firstInd,
      id: "IND-SYNTH-BAD",
      value_nature: "unavailable",
      value: 42,
    });
    expect(syntheticBad.success).toBe(false);

    // Announced factory never counts in available capacity today
    const cap = computeAvailableCapacityToday(ree.indicators);
    expect(cap.available_today).toBe(3000);
    expect(cap.announced_future_excluded).toBe(12000);
    expect(cap.unavailable_count).toBe(1);
    expect(cap.excluded_announced_ids).toContain("IND-REE-EU-ANNOUNCED-CAP");

    // Guard refuses comparing two percentage indicators with incompatible denominators/dimensions/scopes
    const indConc = ree.indicators.find((i) => i.id === "IND-REE-REFINING-CONC");
    const indFlow = ree.indicators.find((i) => i.id === "IND-REE-EU-IMPORT-FLOW");
    if (!indConc || !indFlow) throw new Error("Expected concentration and flow indicators");
    expect(indConc.unit).toBe("percent");
    expect(indFlow.unit).toBe("percent");

    const cmp = compareIndicators(indConc, indFlow);
    expect(cmp.comparable).toBe(false);
    if (!cmp.comparable) {
      expect(cmp.reasons.length).toBeGreaterThan(0);
    }

    // Queue generators produce investigative questions with falsifiers and dedup keys
    const sharedCandidates = generateSharedDependencyCandidates(catalog);
    const propCandidates = generateEconomicPropagationCandidates(catalog);
    expect(sharedCandidates.length).toBeGreaterThanOrEqual(1);
    expect(propCandidates.length).toBeGreaterThanOrEqual(2);
    expect(sharedCandidates[0]?.method).toBe("shared_dependency");
    expect(sharedCandidates[0]?.question.endsWith("?")).toBe(true);
    expect(propCandidates[0]?.method).toBe("economic_propagation");
    expect(propCandidates[0]?.falsifiers?.length).toBeGreaterThan(0);
  });
});
