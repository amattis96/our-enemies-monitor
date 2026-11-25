import { describe, expect, it } from "vitest";
import type { AssertionProvenanceGraph } from "../src/claims/provenance.ts";
import type { DormantHypothesis } from "../src/discovery/dormant.ts";
import type { QueueItem } from "../src/discovery/queue/schema.ts";
import type { Dataset, QualifiedAssertion } from "../src/model/index.ts";
import { buildWhyWeKnow, projectLaboratory } from "../src/site/laboratory.ts";
import { buildReadModel } from "../src/site/read-model.ts";

const review = { status: "reviewed" as const, notes: [] };

function makeDataset(): Dataset {
  return {
    entities: [
      {
        id: "ENT-ORG-1",
        kind: "organization",
        name: { it: "Gruppo Alfa", en: "Alpha Group" },
        domain: "intelligence-security",
        country: "RU",
        review,
        provenance: [],
      },
      {
        id: "ENT-STATE-1",
        kind: "state",
        name: { it: "Stato Beta", en: "Beta State" },
        domain: "geopolitics",
        country: "RU",
        review,
        provenance: [],
      },
      {
        id: "ENT-ASSET-1",
        kind: "asset",
        name: { it: "Cavo Gamma", en: "Gamma Cable" },
        domain: "commerce-infrastructure",
        country: "EE",
        review,
        provenance: [],
      },
      {
        id: "ENT-PERSON-1",
        kind: "person",
        name: { it: "Persona Riservata", en: "Private Person" },
        domain: "persons",
        country: null,
        review,
        provenance: [],
      },
    ],
    events: [
      {
        id: "EV-001",
        record_type: "event",
        timeline_status: "integrated",
        title: { it: "Incidente sul cavo sottomarino", en: "Subsea cable incident" },
        date: { start: "2025-10-01", end: null, precision: "day" },
        places: ["EE"],
        geography: { it: "Mar Baltico", en: "Baltic Sea" },
        category: null,
        themes: ["hybrid_sabotage", "cyber"],
        description: { it: "Interruzione rilevata.", en: "Disruption detected." },
        evidence_level: "E2",
        evidence_note: { it: "Rapporto tecnico", en: "Technical report" },
        publisher: null,
        url: null,
        known_issues: [],
        sources: ["S01", "S02"],
        review,
        provenance: [],
      },
    ],
    relationships: [
      {
        id: "G-001",
        subject: "ENT-ORG-1",
        predicate: "ha condotto operazione contro",
        object: "ENT-ASSET-1",
        relation_class: "hybrid",
        events: ["EV-001"],
        valid_from: "2025-10-01",
        valid_to: null,
        primary_url: null,
        evidence_level: "E2",
        evidence_status: "institutional_attribution",
        caveat: null,
        sources: ["S01"],
        review,
        provenance: [],
      },
      {
        id: "G-002",
        subject: "ENT-STATE-1",
        predicate: "ha finanziato",
        object: "ENT-ORG-1",
        relation_class: "financial",
        events: ["EV-001"],
        valid_from: "2025-09",
        valid_to: null,
        primary_url: null,
        evidence_level: "E1",
        evidence_status: "documented",
        caveat: null,
        sources: ["S03"],
        review,
        provenance: [],
      },
      {
        id: "G-003",
        subject: "ENT-PERSON-1",
        predicate: "ha coordinato",
        object: "ENT-ORG-1",
        relation_class: "governance",
        events: ["EV-001"],
        valid_from: "2025-09",
        valid_to: null,
        primary_url: null,
        evidence_level: "E4",
        evidence_status: "allegation",
        caveat: null,
        sources: ["S02"],
        review,
        provenance: [],
      },
    ],
    sources: [
      {
        id: "S01",
        type: "external_reference",
        title: { it: "Rapporto ufficiale A", en: "Official report A" },
        publisher: "Authority A",
        files: [],
        urls: [],
        cited_in: [],
        origin_type: "official_statement",
        review,
        provenance: [],
      },
      {
        id: "S02",
        type: "external_reference",
        title: { it: "Inchiesta B", en: "Investigation B" },
        publisher: "Press B",
        files: [],
        urls: [],
        cited_in: [],
        origin_type: "original_reporting",
        review,
        provenance: [],
      },
      {
        id: "S03",
        type: "corpus_document",
        title: { it: "Documento primario C", en: "Primary document C" },
        publisher: "Court C",
        files: [],
        urls: [],
        cited_in: [],
        origin_type: "primary_document",
        review,
        provenance: [],
      },
    ],
    hypotheses: [
      {
        id: "H-PUB-1",
        subject: "ENT-ORG-1",
        object: "ENT-ASSET-1",
        hypothesis_type: "attribution",
        question: {
          it: "Quale rotta marittima è stata seguita prima dell'incidente?",
          en: "Which maritime route was followed before the incident?",
        },
        current_limit: { it: "Dati AIS incompleti", en: "Incomplete AIS data" },
        evidence_needed: { it: "Tracciati radar costieri", en: "Coastal radar tracks" },
        priority: "high",
        status: "open_unproven",
        events: ["EV-001"],
        sources: ["S01"],
        external_url: null,
        review,
        provenance: [],
      },
      {
        id: "H-PERSON-1",
        subject: "ENT-PERSON-1",
        object: "ENT-ORG-1",
        hypothesis_type: "control",
        question: {
          it: "La persona ha firmato il mandato?",
          en: "Did the person sign the mandate?",
        },
        current_limit: { it: "Nessun atto pubblico", en: "No public act" },
        evidence_needed: { it: "Registro societario", en: "Corporate registry" },
        priority: "high",
        status: "open_unproven",
        events: ["EV-001"],
        sources: [],
        external_url: null,
        review,
        provenance: [],
      },
      {
        id: "H-INSIN-1",
        subject: "ENT-ORG-1",
        object: "ENT-STATE-1",
        hypothesis_type: "funding",
        question: {
          it: "Il direttore è corrotto e ha ricevuto tangenti?",
          en: "Is the director corrupt and took bribes?",
        },
        current_limit: { it: "Solo voci", en: "Rumors only" },
        evidence_needed: { it: "Atti giudiziari", en: "Court filings" },
        priority: "low",
        status: "open_unproven",
        events: ["EV-001"],
        sources: [],
        external_url: null,
        review,
        provenance: [],
      },
    ],
    exposures: [],
  };
}

function makeQueueItem(overrides: Partial<QueueItem>): QueueItem {
  return {
    id: "Q-1",
    method: "open-triads",
    method_version: "1.0.0",
    engine_version: "1.0.0",
    priority: 60,
    question: "Esistono documenti doganali pubblici per la spedizione?",
    refs: ["ENT-ORG-1", "ENT-ASSET-1"],
    evidences: [],
    alternative_explanations: ["Guasto tecnico accidentale"],
    falsifiers: ["Log di manutenzione indipendente"],
    dedup_key: "dedup-1",
    estimated_cost: 2,
    origin_run_id: "run-1",
    visibility: "publishable",
    status: "queued",
    disposition: null,
    epistemic_outcome: null,
    revision: 0,
    lease_generation: 0,
    assigned_run_id: null,
    lease_expires_at: null,
    input_snapshot: "snap-1",
    retry_count: 0,
    next_eligible_at: null,
    outcome_refs: [],
    transitions: [],
    late_outputs: [],
    d12_redacted: false,
    d12_minimal_trace: null,
    re_review_reason: null,
    ...overrides,
  };
}

describe("PK-24 Laboratory public projection", () => {
  it("excludes internal queue items, insinuating questions, and natural persons by default", () => {
    const model = buildReadModel(makeDataset(), new Map());
    const queueItems: QueueItem[] = [
      makeQueueItem({ id: "Q-PRIV", visibility: "private", question: "Domanda privata interna" }),
      makeQueueItem({
        id: "Q-D12",
        visibility: "publishable",
        d12_redacted: true,
        question: "Domanda redatta D12",
      }),
      makeQueueItem({
        id: "Q-FORB",
        visibility: "publishable",
        disposition: "forbidden",
        question: "Domanda vietata",
      }),
      makeQueueItem({
        id: "Q-PERSON",
        visibility: "publishable",
        refs: ["ENT-PERSON-1"],
        question: "Domanda su persona fisica",
      }),
      makeQueueItem({
        id: "Q-INSIN",
        visibility: "publishable",
        question: "Questo funzionario è colpevole di tradimento?",
      }),
      makeQueueItem({
        id: "Q-PUB-OK",
        visibility: "publishable",
        priority: 85,
        question: "Esistono contratti portuali pubblici per l'ormeggio?",
      }),
    ];

    const projection = projectLaboratory(model, { queueItems });
    const ids = projection.open_questions.map((q) => q.id);

    expect(ids).toContain("H-PUB-1");
    expect(ids).toContain("Q-PUB-OK");
    expect(ids).not.toContain("Q-PRIV");
    expect(ids).not.toContain("Q-D12");
    expect(ids).not.toContain("Q-FORB");
    expect(ids).not.toContain("Q-PERSON");
    expect(ids).not.toContain("Q-INSIN");
    expect(ids).not.toContain("H-PERSON-1");
    expect(ids).not.toContain("H-INSIN-1");

    expect(projection.filtered_counts.internal_queue_excluded).toBe(3);
    expect(projection.filtered_counts.person_excluded).toBe(2);
    expect(projection.filtered_counts.insinuating_excluded).toBe(2);
  });

  it("strips full reactivation fingerprints from cold cases", () => {
    const model = buildReadModel(makeDataset(), new Map());
    const dormant: DormantHypothesis = {
      hypothesis_id: "H-COLD-01",
      status: "dormant",
      closure_reason: null,
      closure_rationale: null,
      fingerprint: {
        entities: ["SECRET-ENTITY-99"],
        places: ["SECRET-PORT-X"],
        themes: ["sabotage"],
        period: { from: "2022-03-01", to: "2024-11-15" },
        techniques: ["T1566-SECRET"],
      },
      known_source_ids: ["S-PRIV-1"],
      known_root_ids: ["ROOT-PRIV-1"],
      last_checked_at: "2026-11-01T00:00:00Z",
      min_recheck_interval_hours: 168,
      novelty_threshold: 0.5,
      reactivation_history: [
        {
          seq: 1,
          evaluated_at: "2026-11-01T00:00:00Z",
          signal_id: "SIG-SECRET",
          source_id: "S-PRIV-1",
          signal_type: "periodic_check",
          trigger_kind: "scheduled_cold_case_check",
          reactivated: false,
          reason: "no novelty",
          independent_roots: ["ROOT-PRIV-1"],
        },
      ],
    };

    const projection = projectLaboratory(model, { dormantHypotheses: [dormant] });
    expect(projection.cold_cases).toHaveLength(1);
    const serialized = JSON.stringify(projection.cold_cases);
    expect(serialized).not.toContain("SECRET-ENTITY-99");
    expect(serialized).not.toContain("SECRET-PORT-X");
    expect(serialized).not.toContain("T1566-SECRET");
    expect(serialized).not.toContain("S-PRIV-1");
    expect(serialized).not.toContain("ROOT-PRIV-1");
    expect(serialized).not.toContain("SIG-SECRET");
    expect(projection.cold_cases[0]?.period_summary).toBe("2022–2024");
    expect(projection.cold_cases[0]?.reactivation_count).toBe(0);
  });

  it("orders needed evidence deterministically by VoI descending", () => {
    const model = buildReadModel(makeDataset(), new Map());
    const queueItems: QueueItem[] = [
      makeQueueItem({
        id: "Q-LOW",
        priority: 20,
        evidences: ["S01", "S02", "S03"],
        estimated_cost: 6,
      }),
      makeQueueItem({ id: "Q-HIGH", priority: 95, evidences: [], estimated_cost: 1 }),
    ];

    const projection = projectLaboratory(model, { queueItems });
    const scores = projection.needed_evidence.map((e) => e.voi_score);
    for (let i = 1; i < scores.length; i += 1) {
      expect(scores[i - 1]).toBeGreaterThanOrEqual(scores[i] ?? 0);
    }
    expect(projection.needed_evidence[0]?.id).toBe("Q-HIGH");
  });
});

describe("PK-24 buildWhyWeKnow", () => {
  it("returns all 4 dimensions with confirmed/uncertain/unknown origins from QualifiedAssertions", () => {
    const model = buildReadModel(makeDataset(), new Map());
    const assertions: QualifiedAssertion[] = [
      {
        id: "CL-0001",
        case_id: "CASE-0001",
        incident_id: "INC-0001",
        subject: "EV-001",
        canonical_predicate: null,
        original_predicate: "si è verificato presso",
        classification_status: "mapped",
        object: "ENT-ASSET-1",
        temporal_interval: { start: "2025-10-01", end: null, precision: "day" },
        asserted_by: "ENT-STATE-1",
        attribution_qualification: "attribution_established",
        supporting_evidence: [
          {
            id: "EVD-1",
            polarity: "supporting",
            source_id: "S01",
            origin_type: "official_statement",
            evidence_nature: "official_document",
            summary: { it: "Rapporto", en: "Report" },
            url: null,
          },
          {
            id: "EVD-2",
            polarity: "supporting",
            source_id: "S02",
            origin_type: "original_reporting",
            evidence_nature: "original_investigation",
            summary: { it: "Inchiesta", en: "Investigation" },
            url: null,
          },
        ],
        contrary_evidence: [],
        evidence_level: "E1",
        verification_state: "verified",
        migration: {
          structural: "migrated",
          evidentiary_verification: "verified",
          lifecycle: "active",
          updated_by: "human_reviewer",
          source_origin: "editorial_review",
          superseded_by: null,
          note: null,
        },
        review,
        provenance: [],
      },
      {
        id: "CL-0002",
        case_id: "CASE-0001",
        incident_id: "INC-0001",
        subject: "ENT-ORG-1",
        canonical_predicate: null,
        original_predicate: "ha condotto operazione su",
        classification_status: "mapped",
        object: "EV-001",
        temporal_interval: { start: "2025-10-01", end: null, precision: "day" },
        asserted_by: "ENT-STATE-1",
        attribution_qualification: "authority_attributed",
        supporting_evidence: [
          {
            id: "EVD-3",
            polarity: "supporting",
            source_id: "S01",
            origin_type: "official_statement",
            evidence_nature: "official_document",
            summary: { it: "Nota", en: "Note" },
            url: null,
          },
        ],
        contrary_evidence: [],
        evidence_level: "E2",
        verification_state: "pending",
        migration: {
          structural: "migrated",
          evidentiary_verification: "pending",
          lifecycle: "active",
          updated_by: "human_reviewer",
          source_origin: "editorial_review",
          superseded_by: null,
          note: null,
        },
        review,
        provenance: [],
      },
    ];

    const graphs: AssertionProvenanceGraph[] = [
      {
        assertion_id: "CL-0001",
        nodes: [
          {
            id: "S01",
            kind: "publication",
            evidence_nature: "official_document",
            origin_type: "official_statement",
            origin_certainty: "established",
            derived_from: [],
            relies_on: [],
          },
          {
            id: "S02",
            kind: "publication",
            evidence_nature: "original_investigation",
            origin_type: "original_reporting",
            origin_certainty: "uncertain",
            derived_from: [],
            relies_on: [],
          },
          {
            id: "S-UNK",
            kind: "publication",
            evidence_nature: "unknown",
            origin_type: "unknown",
            origin_certainty: "unknown",
            derived_from: [],
            relies_on: [],
          },
        ],
      },
    ];

    const breakdown = buildWhyWeKnow("EV-001", model, { assertions, provenanceGraphs: graphs });

    expect(Object.keys(breakdown.dimensions).sort()).toEqual([
      "impact",
      "occurrence",
      "perpetrator",
      "sponsor",
    ]);
    expect(breakdown.dimensions.occurrence.status).toBe("established");
    expect(breakdown.dimensions.occurrence.confirmed_origins).toBe(1);
    expect(breakdown.dimensions.occurrence.uncertain_origins).toBe(1);
    expect(breakdown.dimensions.occurrence.assertions).toHaveLength(1);

    expect(breakdown.dimensions.perpetrator.status).toBe("attributed");
    expect(breakdown.dimensions.perpetrator.confirmed_origins).toBe(1);

    expect(breakdown.dimensions.sponsor.status).toBe("missing");
    expect(breakdown.dimensions.impact.status).toBe("missing");
    expect(breakdown.total_assertions).toBe(2);
  });

  it("projects from ReadModel and excludes restricted person relationships", () => {
    const model = buildReadModel(makeDataset(), new Map());
    const breakdown = buildWhyWeKnow("EV-001", model);

    expect(breakdown.dimensions.occurrence.status).toBe("established");
    expect(breakdown.dimensions.perpetrator.assertions.map((a) => a.id)).toEqual(["G-001"]);
    expect(breakdown.dimensions.sponsor.assertions.map((a) => a.id)).toEqual(["G-002"]);
    // G-003 involves ENT-PERSON-1 without primary source -> restricted, must not appear
    const allIds = Object.values(breakdown.dimensions).flatMap((d) =>
      d.assertions.map((a) => a.id),
    );
    expect(allIds).not.toContain("G-003");
  });
});
