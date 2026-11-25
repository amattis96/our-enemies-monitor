import { describe, expect, it } from "vitest";
import {
  checkPersonDataMinimization,
  compareNamesWithTransliteration,
  DecisionsStore,
  enrichEntityProfile,
  findCandidatePairs,
  type IdentityEntityProfile,
  IdentityEntityProfile as IdentityEntityProfileSchema,
  jaroWinklerSimilarity,
  type LifecycleState,
  type LinkageDecision,
  mergeEntities,
  normalizeEnrichmentInput,
  RedirectsStore,
  resolveEntityId,
  revertMerge,
  revertSplit,
  scoreEntityPair,
  splitEntity,
  transliterateCyrillicToLatin,
} from "../src/identity/index.ts";

function makeCompany(
  id: string,
  nameIt: string,
  overrides: Partial<IdentityEntityProfile> = {},
): IdentityEntityProfile {
  return {
    id,
    kind: "company",
    name: { it: nameIt },
    domain: "commerce-infrastructure",
    country: null,
    ...overrides,
  };
}

describe("PK-04 Entity Identity", () => {
  it("transliterates Cyrillic to Latin non-destructively and computes Jaro-Winkler similarity", () => {
    const original = "Газпром";
    expect(transliterateCyrillicToLatin(original)).toBe("Gazprom");
    // Original string is never mutated
    expect(original).toBe("Газпром");

    const cmp = compareNamesWithTransliteration("Газпром", "Gazprom");
    expect(cmp.transliterated).toBe(true);
    expect(cmp.similarity).toBe(1);

    const a = makeCompany("GAZPROM_RU", "ПАО Газпром");
    const b = makeCompany("GAZPROM_LAT", "PAO Gazprom");
    const scored = scoreEntityPair(a, b);
    expect(scored.transliteration_used).toBe(true);
    expect(scored.best_name_similarity).toBeGreaterThan(0.95);
    expect(a.name.it).toBe("ПАО Газпром");
    expect(b.name.it).toBe("PAO Gazprom");
    expect(jaroWinklerSimilarity("rosatom", "rosatom")).toBe(1);
  });

  it("prioritizes qualified external identifiers over name similarity", () => {
    const a = makeCompany("COMP_A", "Alpha Energy Holdings", {
      external_ids: {
        lei: "5493001KJTIIGC8Y1R12",
        wikidata_qid: "Q123456",
      },
    });
    const b = makeCompany("COMP_B", "Alpha Holdings Ltd.", {
      external_ids: {
        lei: "5493001KJTIIGC8Y1R12",
        wikidata_qid: "Q123456",
      },
    });
    const sameLei = scoreEntityPair(a, b);
    expect(sameLei.matched_fields).toContain("external_ids.lei");
    expect(sameLei.matched_fields).toContain("external_ids.wikidata_qid");
    expect(sameLei.score).toBeGreaterThan(0.95);
    expect(sameLei.auto_merge).toBe(false);

    // Conflicting LEIs penalize even when names are identical
    const c = makeCompany("COMP_C", "Alpha Energy Holdings", {
      external_ids: {
        lei: "9999001KJTIIGC8Y1R99",
      },
    });
    const conflictingLei = scoreEntityPair(a, c);
    expect(conflictingLei.conflicting_fields).toContain("external_ids.lei");
    expect(conflictingLei.score).toBeLessThan(0.2);
    expect(conflictingLei.outcome).toBe("distinct");

    // Registry number + jurisdiction match
    const regA = makeCompany("REG_A", "North Stream Operator", {
      external_ids: {
        registry_numbers: [
          { number: "HRB 12345", jurisdiction: "DE", registry: "Handelsregister" },
        ],
      },
    });
    const regB = makeCompany("REG_B", "Nord Stream AG", {
      external_ids: {
        registry_numbers: [{ number: "HRB 12345", jurisdiction: "DE" }],
      },
    });
    const regScore = scoreEntityPair(regA, regB);
    expect(regScore.matched_fields).toContain("external_ids.registry_numbers");
    expect(regScore.score).toBeGreaterThan(0.9);
  });

  it("respects persisted distinct decisions unconditionally in either order", () => {
    const a = makeCompany("ENTITY_A", "Rosatom State Corp", {
      external_ids: { wikidata_qid: "Q111" },
    });
    const b = makeCompany("ENTITY_B", "Rosatom State Corp", {
      external_ids: { wikidata_qid: "Q111" },
    });
    const decisions: LinkageDecision[] = [
      {
        id: "DEC-1",
        entity_a: "ENTITY_B",
        entity_b: "ENTITY_A",
        outcome: "distinct",
        decided_by: "editor-1",
        decided_at: "2026-11-25T10:00:00Z",
        rationale: "Distinct legal subsidiaries despite shared parent reference.",
      },
    ];

    const result = scoreEntityPair(a, b, decisions);
    expect(result.persisted_decision).toBe(true);
    expect(result.outcome).toBe("distinct");

    const candidates = findCandidatePairs([a, b], decisions);
    expect(candidates).toHaveLength(0);

    const withDistinct = findCandidatePairs([a, b], decisions, {
      includePersistedDistinct: true,
    });
    expect(withDistinct).toHaveLength(1);
    expect(withDistinct[0]?.outcome).toBe("distinct");
  });

  it("never performs automatic merges and keeps uncertain pairs unmerged", () => {
    const a = makeCompany("U_A", "Baltic Cable Group", { country: "EE" });
    const b = makeCompany("U_B", "Baltic Cable", { country: "EE" });

    const scored = scoreEntityPair(a, b);
    expect(scored.auto_merge).toBe(false);
    expect(["uncertain", "same"]).toContain(scored.outcome);

    const state: LifecycleState = {
      entities: [a, b],
      redirects: [],
      history: [],
      decisions: [
        {
          id: "DEC-U",
          entity_a: "U_A",
          entity_b: "U_B",
          outcome: "uncertain",
          decided_by: "editor-1",
          decided_at: "2026-11-25T10:00:00Z",
          rationale: "Needs corporate registry verification.",
        },
      ],
    };

    // Rejects automatic merge
    expect(() =>
      mergeEntities(state, ["U_A", "U_B"], "U_A", {
        mergedBy: "auto",
        humanConfirmed: false,
        rationale: "Auto attempt",
      }),
    ).toThrow(/Automatic merge is forbidden/);

    // Rejects merge when persisted decision is uncertain
    expect(() =>
      mergeEntities(state, ["U_A", "U_B"], "U_A", {
        mergedBy: "editor-1",
        humanConfirmed: true,
        rationale: "Attempted merge of uncertain pair",
      }),
    ).toThrow(/uncertain/);
  });

  it("supports reversible merge, split, and redirect round-trips", () => {
    const a = makeCompany("ENT_A", "Vagner Group", {
      external_ids: { wikidata_qid: "Q555" },
    });
    const b = makeCompany("ENT_B", "Wagner PMC", {
      aliases: [
        {
          name: "ЧВК Вагнер",
          kind: "transliteration",
          valid_from: "2014",
          valid_to: null,
          script: "cyrillic",
        },
      ],
    });

    const initialState: LifecycleState = {
      entities: [a, b],
      redirects: [],
      history: [],
      decisions: [],
    };

    const merged = mergeEntities(initialState, ["ENT_A", "ENT_B"], "ENT_A", {
      mergedBy: "editor-1",
      humanConfirmed: true,
      rationale: "Confirmed same organization.",
      mergeId: "M-001",
      mergedAt: "2026-11-25T12:00:00Z",
    });

    expect(merged.entities).toHaveLength(1);
    expect(merged.entities[0]?.id).toBe("ENT_A");
    expect(merged.entities[0]?.aliases?.some((al) => al.name === "ЧВК Вагнер")).toBe(true);
    expect(resolveEntityId("ENT_B", merged.redirects)).toBe("ENT_A");

    // Revert merge restores exact pre-merge state
    const revertedMerge = revertMerge(merged, "M-001", "2026-11-25T13:00:00Z");
    expect(revertedMerge.entities).toHaveLength(2);
    expect(revertedMerge.redirects).toHaveLength(0);
    expect(resolveEntityId("ENT_B", revertedMerge.redirects)).toBe("ENT_B");
    expect(revertedMerge.history[0]?.reverted_at).toBe("2026-11-25T13:00:00Z");

    // Split & revert split round-trip
    const split = splitEntity(
      revertedMerge,
      "ENT_B",
      [makeCompany("ENT_B1", "Wagner Logistics"), makeCompany("ENT_B2", "Wagner Media")],
      {
        splitBy: "editor-1",
        humanConfirmed: true,
        rationale: "Separate legal units.",
        splitId: "S-001",
        splitAt: "2026-11-25T14:00:00Z",
      },
    );

    expect(split.entities.map((e) => e.id)).toEqual(["ENT_A", "ENT_B1", "ENT_B2"]);

    const revertedSplit = revertSplit(split, "S-001", "2026-11-25T15:00:00Z");
    expect(revertedSplit.entities.map((e) => e.id)).toEqual(["ENT_A", "ENT_B"]);
    expect(revertedSplit.history.find((h) => h.id === "S-001")?.reverted_at).toBe(
      "2026-11-25T15:00:00Z",
    );

    // Redirect cycle detection
    expect(() =>
      resolveEntityId("A", [
        {
          from_id: "A",
          to_id: "B",
          reason: "merge",
          created_at: "2026-11-25T00:00:00Z",
          created_by: "editor-1",
        },
        {
          from_id: "B",
          to_id: "A",
          reason: "merge",
          created_at: "2026-11-25T00:00:00Z",
          created_by: "editor-1",
        },
      ]),
    ).toThrow(/cycle/i);
  });

  it("enforces person data minimization and validates store schemas", () => {
    const validPerson = {
      id: "PERSON_1",
      kind: "person",
      name: { it: "Mario Rossi" },
      domain: "persons",
      country: null,
      public_roles: ["Director of State Agency"],
      sanctions_listed: true,
    };
    expect(IdentityEntityProfileSchema.safeParse(validPerson).success).toBe(true);

    const invalidPerson = {
      ...validPerson,
      passport_number: "AB123456",
      home_address: "Via Roma 1",
    };
    const minCheck = checkPersonDataMinimization(invalidPerson);
    expect(minCheck.ok).toBe(false);
    expect(minCheck.violations).toEqual(["home_address", "passport_number"]);
    expect(IdentityEntityProfileSchema.safeParse(invalidPerson).success).toBe(false);

    expect(DecisionsStore.safeParse({ version: "1.0", decisions: [] }).success).toBe(true);
    expect(RedirectsStore.safeParse({ version: "1.0", redirects: [], history: [] }).success).toBe(
      true,
    );
  });

  it("normalizes offline corporate and sanctions enrichment inputs deterministically", () => {
    const leiCand = normalizeEnrichmentInput({
      source: "gleif_lei",
      lei: "5493001KJTIIGC8Y1R12",
      legal_name: "Example Energy GmbH",
      jurisdiction: "DE",
      other_names: ["Example Energy"],
      official_website: "https://example-energy.de",
    });

    const sanctionsCand = normalizeEnrichmentInput({
      source: "opensanctions",
      id: "os-123",
      schema: "Person",
      name: "Ivan Petrov",
      aliases: ["Иван Петров"],
      countries: ["RU"],
      extra_attributes: {
        date_of_birth: "1970-01-01",
      },
    });
    expect(sanctionsCand.minimization_warnings.length).toBe(1);
    expect(sanctionsCand.sanctions_listed).toBe(true);

    const corpCand = normalizeEnrichmentInput({
      source: "corporate_registry",
      registry: "KVK",
      jurisdiction: "NL",
      registration_number: "34123456",
      legal_name: "Example Holding B.V.",
      previous_names: [{ name: "Old Holding B.V.", valid_from: "2010", valid_to: "2020" }],
    });

    const base = makeCompany("EX_1", "Example Energy GmbH");
    const enriched = enrichEntityProfile(base, [leiCand, corpCand]);
    expect(enriched.profile.external_ids?.lei).toBe("5493001KJTIIGC8Y1R12");
    expect(enriched.profile.external_ids?.registry_numbers).toHaveLength(1);
    expect(enriched.added_aliases).toContain("Example Energy");
    expect(enriched.added_aliases).toContain("Old Holding B.V.");
    // Original entity was not mutated
    expect(base.external_ids).toBeUndefined();
  });
});
