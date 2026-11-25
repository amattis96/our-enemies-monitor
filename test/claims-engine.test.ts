import { describe, expect, it } from "vitest";
import {
  type AssertionProvenanceGraph,
  analyzeAssertionIndependence,
  applyMigrationTransition,
  assertNonForcing,
  canCreateAssertion,
  classifyPredicate,
  classifyRelationship,
  createInitialMigrationState,
  filterRelationshipsForInference,
  isEligibleForAutomaticInference,
  mapM5ToEvidentiaryVerification,
  migrateLegacyRelationship,
  validatePredicateMapping,
  validateProvenanceDag,
} from "../src/claims/index.ts";
import {
  countCaseIncidents,
  isAttributionEstablished,
  validateQualifiedCasesAndAssertions,
} from "../src/editorial/cases.ts";
import {
  type QualifiedAssertion,
  type QualifiedCase,
  QualifiedCase as QualifiedCaseSchema,
} from "../src/model/index.ts";
import { readDataFiles } from "../src/pipeline/load.ts";
import { validateDataFiles } from "../src/pipeline/validate.ts";

const dataset = validateDataFiles(readDataFiles()).dataset;

function makeBaseAssertion(overrides: Partial<QualifiedAssertion> = {}): QualifiedAssertion {
  const firstEntity = dataset.entities[0]?.id ?? "RU";
  const secondEntity = dataset.entities[1]?.id ?? "PL";
  const firstSource = dataset.sources[0]?.id ?? "S01";
  return {
    id: "CL-0101",
    case_id: "CASE-0101",
    incident_id: "INC-0001",
    subject: firstEntity,
    canonical_predicate: "ATTRIBUTED_BY_AUTHORITY",
    original_predicate: "ATTRIBUTED_BY_AUTHORITY",
    classification_status: "mapped",
    object: secondEntity,
    temporal_interval: { start: "2024-05", end: null, precision: "month" },
    asserted_by: firstEntity,
    attribution_qualification: "authority_attributed",
    supporting_evidence: [
      {
        id: "EV-001",
        polarity: "supporting",
        source_id: firstSource,
        origin_type: "official_statement",
        evidence_nature: "official_document",
        summary: { it: "Comunicato ufficiale dell'autorità nazionale." },
        url: null,
      },
    ],
    contrary_evidence: [
      {
        id: "EV-002",
        polarity: "contrary",
        source_id: firstSource,
        origin_type: "official_statement",
        evidence_nature: "official_document",
        summary: { it: "Smentita formale della controparte." },
        url: null,
      },
    ],
    evidence_level: "E2",
    verification_state: "pending",
    migration: createInitialMigrationState("new_sidecar"),
    review: { status: "needs_review", notes: [] },
    provenance: [],
    ...overrides,
  };
}

function makeBaseCase(overrides: Partial<QualifiedCase> = {}): QualifiedCase {
  const e1 = dataset.events[0]?.id ?? "TL-0001";
  const e2 = dataset.events[1]?.id ?? e1;
  const s1 = dataset.sources[0]?.id ?? "S01";
  return {
    id: "CASE-0101",
    title: { it: "Caso multi-incidente di prova" },
    summary: { it: "Raggruppamento editoriale di due incidenti distinti." },
    incidents: [
      {
        id: "INC-0001",
        title: { it: "Primo incidente" },
        date: { start: "2024-05", end: null, precision: "month" },
        events: [e1],
        places: ["PL"],
      },
      {
        id: "INC-0002",
        title: { it: "Secondo incidente" },
        date: { start: "2024-06", end: null, precision: "month" },
        events: [e2],
        places: ["DE"],
      },
    ],
    events: [e1, e2],
    assertions: ["CL-0101", "CL-0102"],
    grouping_basis: { it: "Medesimo modus operandi documentato nei registri." },
    sources: [s1],
    migration: createInitialMigrationState("new_sidecar"),
    review: { status: "needs_review", notes: [] },
    provenance: [],
    ...overrides,
  };
}

describe("PK-06A: Qualified assertions & multi-incident cases", () => {
  it("distinguishes authority_attributed from attribution_established and tracks separate incident counts", () => {
    const a1 = makeBaseAssertion({
      id: "CL-0101",
      incident_id: "INC-0001",
      attribution_qualification: "authority_attributed",
      verification_state: "pending",
    });
    const a2 = makeBaseAssertion({
      id: "CL-0102",
      incident_id: "INC-0002",
      attribution_qualification: "attribution_established",
      verification_state: "verified",
      evidence_level: "E1",
    });
    const kase = makeBaseCase();

    expect(isAttributionEstablished(a1)).toBe(false);
    expect(isAttributionEstablished(a2)).toBe(true);
    expect(validateQualifiedCasesAndAssertions([kase], [a1, a2], dataset)).toEqual([]);

    const counts = countCaseIncidents(kase, [a1, a2]);
    expect(counts.incident_count).toBe(2);
    expect(counts.assertion_count).toBe(2);
    expect(counts.per_incident_assertions).toEqual({
      "INC-0001": 1,
      "INC-0002": 1,
    });
  });

  it("rejects attribution_established when verification_state is not verified", () => {
    const unverifiedEstablished = makeBaseAssertion({
      id: "CL-0103",
      attribution_qualification: "attribution_established",
      verification_state: "pending",
    });
    const kase = makeBaseCase({ assertions: ["CL-0103"] });
    const issues = validateQualifiedCasesAndAssertions([kase], [unverifiedEstablished], dataset);
    expect(issues.some((i) => i.message.includes("requires verification_state 'verified'"))).toBe(
      true,
    );
  });

  it("enforces the case-has-at-least-one-assertion invariant", () => {
    const emptyCase = { ...makeBaseCase(), assertions: [] };
    expect(QualifiedCaseSchema.safeParse(emptyCase).success).toBe(false);

    const kaseWithDanglingRef = makeBaseCase({ assertions: ["CL-9999"] });
    const issues = validateQualifiedCasesAndAssertions([kaseWithDanglingRef], [], dataset);
    expect(issues.some((i) => i.message.includes("no matching assertions found"))).toBe(true);
  });
});

describe("PK-06B: Multi-derivation DAG provenance & unknown-origin non-independence", () => {
  it("supports multi-derivation DAGs, deduplicates shared roots, and formats structured summaries", () => {
    // 6 publications:
    // - PUB-1 & PUB-2 both rely on ROOT-DOC-1 (official_document) -> 1 established origin
    // - PUB-3 derives from BOTH ROOT-DOC-1 and ROOT-TEST-2 (multi-derivation!) -> adds ROOT-TEST-2 (2nd established origin)
    // - PUB-4 & PUB-5 rely on two uncertain roots -> 2 uncertain origins
    // - PUB-6 has unknown origin -> NEVER counted as independent
    const graph: AssertionProvenanceGraph = {
      assertion_id: "CL-0101",
      nodes: [
        {
          id: "ROOT-DOC-1",
          kind: "root",
          evidence_nature: "official_document",
          origin_type: "primary_document",
          origin_certainty: "established",
          derived_from: [],
          relies_on: [],
        },
        {
          id: "ROOT-TEST-2",
          kind: "root",
          evidence_nature: "direct_testimony",
          origin_type: "official_statement",
          origin_certainty: "established",
          derived_from: [],
          relies_on: [],
        },
        {
          id: "ROOT-UNC-1",
          kind: "root",
          evidence_nature: "media_report",
          origin_type: "original_reporting",
          origin_certainty: "uncertain",
          derived_from: [],
          relies_on: [],
        },
        {
          id: "ROOT-UNC-2",
          kind: "root",
          evidence_nature: "intelligence_assessment",
          origin_type: "official_statement",
          origin_certainty: "uncertain",
          derived_from: [],
          relies_on: [],
        },
        {
          id: "PUB-1",
          kind: "publication",
          evidence_nature: "investigation_relying_on_same_doc",
          origin_type: "original_reporting",
          origin_certainty: "established",
          derived_from: [],
          relies_on: ["ROOT-DOC-1"],
        },
        {
          id: "PUB-2",
          kind: "publication",
          evidence_nature: "investigation_relying_on_same_doc",
          origin_type: "original_reporting",
          origin_certainty: "established",
          derived_from: [],
          relies_on: ["ROOT-DOC-1"],
        },
        {
          id: "PUB-3",
          kind: "publication",
          evidence_nature: "media_report",
          origin_type: "synthesis",
          origin_certainty: "established",
          derived_from: ["ROOT-DOC-1", "ROOT-TEST-2"],
          relies_on: [],
        },
        {
          id: "PUB-4",
          kind: "publication",
          evidence_nature: "republication",
          origin_type: "republication",
          origin_certainty: "uncertain",
          derived_from: ["ROOT-UNC-1"],
          relies_on: [],
        },
        {
          id: "PUB-5",
          kind: "publication",
          evidence_nature: "republication",
          origin_type: "republication",
          origin_certainty: "uncertain",
          derived_from: ["ROOT-UNC-2"],
          relies_on: [],
        },
        {
          id: "PUB-6",
          kind: "publication",
          evidence_nature: "unknown",
          origin_type: "unknown",
          origin_certainty: "unknown",
          derived_from: [],
          relies_on: [],
        },
      ],
    };

    expect(validateProvenanceDag(graph)).toEqual([]);
    const analysis = analyzeAssertionIndependence(graph);
    expect(analysis.publication_count).toBe(6);
    expect(analysis.independent_established_origins).toEqual(["ROOT-DOC-1", "ROOT-TEST-2"]);
    expect(analysis.uncertain_origins).toEqual(["ROOT-UNC-1", "ROOT-UNC-2"]);
    expect(analysis.unknown_origins).toEqual(["PUB-6"]);
    // Unknown origin is NEVER counted as independent
    expect(analysis.independent_count).toBe(2);
    expect(analysis.summary_it).toContain("6 pubblicazioni, 2 origini accertate, 2 incerte");
  });

  it("never counts unknown origins as independent even when there are multiple unknown publications", () => {
    const graph: AssertionProvenanceGraph = {
      assertion_id: "CL-0200",
      nodes: [
        {
          id: "UNK-1",
          kind: "publication",
          evidence_nature: "unknown",
          origin_certainty: "unknown",
          derived_from: [],
          relies_on: [],
        },
        {
          id: "UNK-2",
          kind: "publication",
          evidence_nature: "media_report",
          origin_type: "unknown",
          origin_certainty: "unknown",
          derived_from: [],
          relies_on: [],
        },
      ],
    };

    const analysis = analyzeAssertionIndependence(graph);
    expect(analysis.independent_count).toBe(0);
    expect(analysis.independent_established_origins).toEqual([]);
    expect(analysis.unknown_origins).toEqual(["UNK-1", "UNK-2"]);
  });

  it("requires explicit genealogy for new sources and detects cycles", () => {
    const invalidGraph: AssertionProvenanceGraph = {
      assertion_id: "CL-0201",
      nodes: [
        {
          id: "NEW-SRC-1",
          kind: "publication",
          evidence_nature: "unknown",
          origin_certainty: "unknown",
          derived_from: [],
          relies_on: [],
          is_new_source: true,
        },
        {
          id: "CYC-A",
          kind: "source",
          evidence_nature: "media_report",
          origin_certainty: "established",
          derived_from: ["CYC-B"],
          relies_on: [],
        },
        {
          id: "CYC-B",
          kind: "source",
          evidence_nature: "media_report",
          origin_certainty: "established",
          derived_from: ["CYC-A"],
          relies_on: [],
        },
      ],
    };
    const issues = validateProvenanceDag(invalidGraph);
    expect(issues.some((i) => i.message.includes("new source requires explicit genealogy"))).toBe(
      true,
    );
    expect(issues.some((i) => i.message.includes("circular derivation"))).toBe(true);
  });
});

describe("PK-06C: Canonical predicates, non-forcing rules & unmapped exclusion", () => {
  it("enforces all 4 non-forcing coercion rules", () => {
    expect(() => assertNonForcing("FUNDED", "CONTROLLED")).toThrow(/funding_not_control/);
    expect(() => assertNonForcing("CO_PRESENT_AT", "COLLABORATED_WITH")).toThrow(
      /copresence_not_collaboration/,
    );
    expect(() => assertNonForcing("ACCUSED_OF", "COMMISSIONED")).toThrow(
      /accusation_not_commission/,
    );
    expect(() => assertNonForcing("POLITICALLY_SUPPORTED", "COORDINATED_WITH")).toThrow(
      /political_support_not_coordination/,
    );

    const badMapping = classifyPredicate("FUNDED");
    badMapping.canonical_predicate = "CONTROLLED";
    expect(validatePredicateMapping(badMapping)).toEqual([
      expect.stringContaining("funding_not_control"),
    ]);
  });

  it("preserves original predicate as unmapped and excludes unmapped relationships from automatic inferences", () => {
    const unmapped = classifyPredicate("CUSTOM_UNCLASSIFIED_LINK");
    expect(unmapped.original_predicate).toBe("CUSTOM_UNCLASSIFIED_LINK");
    expect(unmapped.canonical_predicate).toBeNull();
    expect(unmapped.classification_status).toBe("unmapped");
    expect(isEligibleForAutomaticInference(unmapped)).toBe(false);

    const needsReview = classifyPredicate("FUNDED", { needsReview: true });
    expect(needsReview.classification_status).toBe("needs_review");
    expect(isEligibleForAutomaticInference(needsReview)).toBe(false);

    const mapped = classifyPredicate("FUNDED");
    expect(mapped.classification_status).toBe("mapped");
    expect(mapped.canonical_predicate).toBe("FUNDED");
    expect(isEligibleForAutomaticInference(mapped)).toBe(true);

    const eligible = filterRelationshipsForInference([
      classifyRelationship({ id: "G-0001", predicate: "FUNDED", relation_class: "financial" }),
      classifyRelationship({
        id: "G-0002",
        predicate: "UNMAPPED_CUSTOM_REL",
        relation_class: "context",
      }),
    ]);
    expect(eligible.map((item) => item.relationship.id)).toEqual(["G-0001"]);
  });
});

describe("PK-06D: Progressive migration across 3 orthogonal dimensions", () => {
  it("allows script to advance structural state to migrated but NEVER assign verified", () => {
    const rel = dataset.relationships[0];
    expect(rel).toBeDefined();
    if (!rel) return;

    const migrated = migrateLegacyRelationship(rel, "script");
    expect(migrated.structural).toBe("migrated");
    expect(migrated.evidentiary_verification).toBe("pending");
    expect(migrated.lifecycle).toBe("active");

    expect(() =>
      applyMigrationTransition(migrated, { evidentiary_verification: "verified" }, "script"),
    ).toThrow(/never assign evidentiary_verification = 'verified'/);

    const humanVerified = applyMigrationTransition(
      migrated,
      { evidentiary_verification: "verified" },
      "human_reviewer",
    );
    expect(humanVerified.evidentiary_verification).toBe("verified");
    expect(humanVerified.structural).toBe("migrated");
  });

  it("reuses M5 editorial states conservatively and restricts assertion creation origins", () => {
    expect(
      mapM5ToEvidentiaryVerification({
        reviewStatus: "reviewed",
        humanApproved: false,
      }),
    ).toBe("pending");
    expect(
      mapM5ToEvidentiaryVerification({
        reviewStatus: "reviewed",
        humanApproved: true,
        assessment: "matched_with_scope_limits",
      }),
    ).toBe("verified");
    expect(
      mapM5ToEvidentiaryVerification({
        reviewStatus: "needs_review",
        assessment: "primary_not_found",
      }),
    ).toBe("disputed");

    expect(canCreateAssertion("baseline_import")).toBe(false);
    expect(canCreateAssertion("editorial_review")).toBe(true);
    expect(canCreateAssertion("new_sidecar")).toBe(true);
  });
});
