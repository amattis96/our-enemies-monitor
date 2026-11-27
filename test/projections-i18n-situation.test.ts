import { describe, expect, it } from "vitest";
import { checkI18nBudget, DEFAULT_I18N_BUDGET, partitionSearchIndex } from "../src/i18n/budget.ts";
import { buildHreflangAlternates, resolveTranslationFallback } from "../src/i18n/fallback.ts";
import {
  evaluateLanguageRollout,
  isTranslationPublishable,
  TARGET_LANGUAGE_ROLLOUT,
  type TranslationEntry,
} from "../src/i18n/multilingual.ts";
import { checkTranslationQualifiers, loadIateGlossary } from "../src/i18n/qualifier-check.ts";
import type { Dataset } from "../src/model/index.ts";
import { projectLaboratory } from "../src/site/laboratory.ts";
import { buildReadModel } from "../src/site/read-model.ts";
import {
  buildCyberStixBundle,
  buildSituationRoom,
  projectTechniques,
  projectVulnerabilities,
} from "../src/site/stix.ts";

function makeTestDataset(): Dataset {
  const validProvenance = [
    {
      file: "sources/original/Fonte_01_Timeline.csv",
      row: 1,
      original: { id: "TL-0001" },
    },
  ];
  return {
    events: [
      {
        id: "TL-0001",
        record_type: "event",
        timeline_status: "integrated",
        date: { start: "2024-03-10", end: null, precision: "day" },
        title: { it: "Attacco cyber a infrastruttura", en: "Cyber attack on infrastructure" },
        description: { it: "Descrizione evento cyber.", en: "Cyber event description." },
        category: { it: "Cyber", en: "Cyber" },
        themes: ["cyber"],
        geography: { it: "Germania", en: "Germany" },
        places: ["DE"],
        evidence_note: null,
        evidence_level: "E2",
        publisher: "BSI",
        url: "https://example.org/cyber-1",
        sources: ["S01"],
        known_issues: [],
        review: { status: "reviewed", notes: [] },
        provenance: [],
      },
      {
        id: "TL-0002",
        record_type: "event",
        timeline_status: "integrated",
        date: { start: "2024-04-01", end: null, precision: "day" },
        title: { it: "Accordo energetico", en: "Energy agreement" },
        description: { it: "Evento non cyber.", en: "Non-cyber event." },
        category: { it: "Energia", en: "Energy" },
        themes: ["energy"],
        geography: { it: "Italia", en: "Italy" },
        places: ["IT"],
        evidence_note: null,
        evidence_level: "E1",
        publisher: "GOV",
        url: "https://example.org/energy-1",
        sources: ["S01"],
        known_issues: [],
        review: { status: "reviewed", notes: [] },
        provenance: [],
      },
      {
        id: "TL-0003",
        record_type: "event",
        timeline_status: "integrated",
        date: { start: "2024-05-01", end: null, precision: "day" },
        title: { it: "Evento cyber in revisione", en: "Cyber event needs review" },
        description: { it: "Record riservato.", en: "Withheld record." },
        category: { it: "Cyber", en: "Cyber" },
        themes: ["cyber"],
        geography: null,
        places: [],
        evidence_note: null,
        evidence_level: "E3",
        publisher: null,
        url: null,
        sources: ["S01"],
        known_issues: [],
        review: { status: "needs_review", notes: [] },
        provenance: [],
      },
      {
        id: "TL-0004",
        record_type: "event",
        timeline_status: "integrated",
        date: { start: "2024-06-01", end: null, precision: "day" },
        title: { it: "Interferenza elettorale", en: "Electoral interference" },
        description: { it: "Dossier elettorale.", en: "Electoral dossier." },
        category: { it: "Elezioni", en: "Elections" },
        themes: ["elections_influence"],
        geography: { it: "Francia", en: "France" },
        places: ["FR"],
        evidence_note: null,
        evidence_level: "E2",
        publisher: "VIGINUM",
        url: "https://example.org/elections-1",
        sources: ["S01"],
        known_issues: [],
        review: { status: "reviewed", notes: [] },
        provenance: [],
      },
    ],
    entities: [
      {
        id: "APT_UNIT",
        kind: "organization",
        name: { it: "Unità APT", en: "APT Unit" },
        domain: "intelligence-security",
        country: null,
        review: { status: "reviewed", notes: [] },
        provenance: [],
      },
      {
        id: "EU_GRID",
        kind: "asset",
        name: { it: "Rete elettrica", en: "Power grid" },
        domain: "commerce-infrastructure",
        country: null,
        review: { status: "reviewed", notes: [] },
        provenance: [],
      },
      {
        id: "PRIVATE_PERSON",
        kind: "person",
        name: { it: "Persona Riservata", en: "Restricted Person" },
        domain: "persons",
        country: null,
        review: { status: "reviewed", notes: [] },
        provenance: [],
      },
    ],
    relationships: [
      {
        id: "G-0001",
        subject: "APT_UNIT",
        predicate: "TARGETED_INFRASTRUCTURE",
        object: "EU_GRID",
        relation_class: "technical",
        evidence_level: "E2",
        evidence_status: "institutional_attribution",
        events: ["TL-0001"],
        valid_from: "2024-03-10",
        valid_to: null,
        primary_url: "https://example.org/cyber-1",
        caveat: { it: "Attribuzione istituzionale.", en: "Institutional attribution." },
        sources: ["S01"],
        review: { status: "reviewed", notes: [] },
        provenance: [],
      },
      {
        id: "G-0002",
        subject: "APT_UNIT",
        predicate: "OWNED_BY",
        object: "EU_GRID",
        relation_class: "ownership",
        evidence_level: "E1",
        evidence_status: "documented",
        events: ["TL-0002"],
        valid_from: "2024-04-01",
        valid_to: null,
        primary_url: "https://example.org/energy-1",
        caveat: null,
        sources: ["S01"],
        review: { status: "reviewed", notes: [] },
        provenance: [],
      },
      {
        id: "G-0003",
        subject: "PRIVATE_PERSON",
        predicate: "OPERATED",
        object: "EU_GRID",
        relation_class: "technical",
        evidence_level: "E3",
        evidence_status: "corroborated",
        events: ["TL-0001"],
        valid_from: "2024-03-10",
        valid_to: null,
        primary_url: null,
        caveat: null,
        sources: ["S01"],
        review: { status: "reviewed", notes: [] },
        provenance: [],
      },
    ],
    hypotheses: [
      {
        id: "H01",
        subject: "APT_UNIT",
        object: "EU_GRID",
        hypothesis_type: "ATTRIBUTION_CHECK",
        question: { it: "L'unità ha coordinato l'operazione?", en: "Did the unit coordinate?" },
        current_limit: { it: "Non dimostrato.", en: "Not demonstrated." },
        priority: "high",
        evidence_needed: { it: "Log forensi.", en: "Forensic logs." },
        events: ["TL-0001"],
        external_url: null,
        status: "open_unproven",
        sources: ["S01"],
        review: { status: "reviewed", notes: [] },
        provenance: validProvenance,
      },
    ],
    sources: [
      {
        id: "S01",
        type: "corpus_document",
        title: { it: "Rapporto BSI", en: "BSI Report" },
        publisher: "BSI",
        files: [],
        urls: ["https://example.org/bsi"],
        cited_in: [],
        review: { status: "reviewed", notes: [] },
        provenance: [],
      },
    ],
    exposures: [],
  };
}

describe("PK-30: Cyber-only STIX 2.1 export & public projections", () => {
  it("exports cyber events and technical relationships while strictly excluding non-cyber and withheld records", () => {
    const dataset = makeTestDataset();
    const bundle = buildCyberStixBundle(dataset, {
      withheldIds: new Set(["TL-0003"]),
      timestamp: "2026-11-25T00:00:00.000Z",
    });

    expect(bundle.type).toBe("bundle");
    const oemIds = bundle.objects.map((o) => o.x_oem_id);

    expect(oemIds).toContain("TL-0001");
    expect(oemIds).toContain("G-0001");
    expect(oemIds).toContain("APT_UNIT");
    expect(oemIds).toContain("EU_GRID");

    // Non-cyber event and ownership relationship must be excluded
    expect(oemIds).not.toContain("TL-0002");
    expect(oemIds).not.toContain("G-0002");

    // Withheld / needs_review and restricted person relationships must be excluded
    expect(oemIds).not.toContain("TL-0003");
    expect(oemIds).not.toContain("G-0003");
    expect(oemIds).not.toContain("PRIVATE_PERSON");

    for (const obj of bundle.objects) {
      expect(obj.spec_version).toBe("2.1");
    }
  });

  it("projects techniques and sanitized vulnerability domains without operational leaks", () => {
    const model = buildReadModel(makeTestDataset());
    const lab = projectLaboratory(model);
    const techniques = projectTechniques(model, lab);
    const cyberTech = techniques.find((t) => t.id === "cyber");
    expect(cyberTech).toBeDefined();
    expect(cyberTech?.documentedFacts.map((e) => e.id)).toContain("TL-0001");
    expect(cyberTech?.statisticalAnomalies.length).toBeGreaterThan(0);

    const vulns = projectVulnerabilities(model);
    expect(vulns.some((v) => v.domain === "energy")).toBe(true);
  });
});

describe("PK-31: Multilingual rollout, qualifier checks, stale fallback & build budget", () => {
  it("loads IATE glossary and flags missing legal/evidentiary qualifiers, numbers, dates, or negations", () => {
    const glossary = loadIateGlossary();
    expect(glossary.entries.length).toBeGreaterThanOrEqual(10);

    const okResult = checkTranslationQualifiers(
      "Il presunto attacco del 2024-03-10 coinvolge 3 server e non è dimostrato.",
      "The alleged attack of 2024-03-10 involves 3 servers and is not demonstrated.",
      "en",
      glossary,
    );
    expect(okResult.ok).toBe(true);
    expect(okResult.status).toBe("machine");

    const missingQualifier = checkTranslationQualifiers(
      "Il presunto coinvolgimento non dimostrato del 2024-03-10.",
      "The confirmed involvement of 2024-03-10.",
      "en",
      glossary,
    );
    expect(missingQualifier.ok).toBe(false);
    expect(missingQualifier.status).toBe("machine_flagged");
    expect(missingQualifier.issues.some((i) => i.code === "missing_qualifier")).toBe(true);

    const missingNumberAndDate = checkTranslationQualifiers(
      "Rapporto del 2024-05-12 su 42 domini.",
      "Report on several domains.",
      "fr",
      glossary,
    );
    expect(missingNumberAndDate.status).toBe("machine_flagged");
    expect(missingNumberAndDate.issues.some((i) => i.code === "date_mismatch")).toBe(true);
    expect(missingNumberAndDate.issues.some((i) => i.code === "number_mismatch")).toBe(true);
  });

  it("never publishes machine_flagged or stale translations and respects D7/D11 gates", () => {
    const flagged: TranslationEntry = {
      status: "machine_flagged",
      source_hash: "0123456789abcdef",
      target_hash: "fedcba9876543210",
      tier: "L1",
      flagged_reasons: ["missing_qualifier"],
    };
    expect(isTranslationPublishable("fr", flagged).publishable).toBe(false);
    expect(isTranslationPublishable("fr", flagged).reason).toBe("machine_flagged");

    const validL2: TranslationEntry = {
      status: "machine",
      source_hash: "0123456789abcdef",
      target_hash: "fedcba9876543210",
      tier: "L2",
    };
    expect(isTranslationPublishable("fr", validL2).publishable).toBe(true);
    expect(isTranslationPublishable("ru", validL2).publishable).toBe(false);
    expect(
      isTranslationPublishable("uk", validL2, { d7Enabled: false, d11ReviewerApproved: new Set() })
        .publishable,
    ).toBe(false);
    expect(
      isTranslationPublishable("uk", validL2, { d7Enabled: true, d11ReviewerApproved: new Set() })
        .publishable,
    ).toBe(true);

    const validL4: TranslationEntry = { ...validL2, tier: "L4" };
    expect(
      isTranslationPublishable("de", validL4, { d7Enabled: true, d11ReviewerApproved: new Set() })
        .publishable,
    ).toBe(false);
    expect(
      isTranslationPublishable("de", validL4, {
        d7Enabled: true,
        d11ReviewerApproved: new Set(["de"]),
      }).publishable,
    ).toBe(true);

    expect(TARGET_LANGUAGE_ROLLOUT[0]?.languages).toEqual(["fr", "de", "pl"]);
    const rollout = evaluateLanguageRollout("fr", [
      { ...validL2, tier: "L1" },
      { ...validL2, tier: "L2" },
      { ...validL2, tier: "L3" },
    ]);
    expect(rollout.l1ToL3Complete).toBe(true);
    expect(rollout.flaggedCount).toBe(0);
  });

  it("excludes stale and machine_flagged translations from hreflang and search index partitions", () => {
    const itUrl = "https://example.org/events/TL-0001/";
    const frRes = resolveTranslationFallback({
      lang: "fr",
      pagePath: "/fr/events/TL-0001/",
      italianUrl: itUrl,
      selfUrl: "https://example.org/fr/events/TL-0001/",
      currentSourceHash: "aaaaaaaaaaaaaaaa",
      entry: {
        status: "machine",
        source_hash: "bbbbbbbbbbbbbbbb",
        target_hash: "cccccccccccccccc",
        tier: "L3",
      },
    });
    expect(frRes.isStale).toBe(true);
    expect(frRes.showItalianOriginal).toBe(true);
    expect(frRes.includeInHreflang).toBe(false);
    expect(frRes.robots).toBe("noindex, follow");
    expect(frRes.canonicalUrl).toBe(itUrl);

    const enRes = resolveTranslationFallback({
      lang: "en",
      pagePath: "/en/events/TL-0001/",
      italianUrl: itUrl,
      selfUrl: "https://example.org/en/events/TL-0001/",
      currentSourceHash: "aaaaaaaaaaaaaaaa",
      entry: {
        status: "machine",
        source_hash: "aaaaaaaaaaaaaaaa",
        target_hash: "dddddddddddddddd",
        tier: "L3",
      },
    });
    expect(enRes.includeInHreflang).toBe(true);

    const alternates = buildHreflangAlternates(itUrl, [frRes, enRes]);
    expect(alternates.map((a) => a.hreflang)).toEqual(["it", "en", "x-default"]);

    const partitions = partitionSearchIndex([
      { id: "1", lang: "it", url: "/events/TL-0001/", title: "IT", body: "IT" },
      {
        id: "2",
        lang: "fr",
        url: "/fr/events/TL-0001/",
        title: "FR",
        body: "FR",
        translationStatus: "stale",
      },
      {
        id: "3",
        lang: "de",
        url: "/de/events/TL-0001/",
        title: "DE",
        body: "DE",
        translationStatus: "machine_flagged",
      },
      {
        id: "4",
        lang: "en",
        url: "/en/events/TL-0001/",
        title: "EN",
        body: "EN",
        translationStatus: "machine",
      },
    ]);
    expect(partitions.fr).toBeUndefined();
    expect(partitions.de).toBeUndefined();
    expect(partitions.en).toHaveLength(1);
  });

  it("enforces CI i18n build budget limits", () => {
    const ok = checkI18nBudget(
      [
        { lang: "it", pages: 950, indexBytes: 400_000, estimatedBuildSeconds: 15 },
        { lang: "en", pages: 950, indexBytes: 400_000, estimatedBuildSeconds: 15 },
      ],
      DEFAULT_I18N_BUDGET,
    );
    expect(ok.ok).toBe(true);

    const over = checkI18nBudget(
      [{ lang: "fr", pages: 3000, indexBytes: 100_000, estimatedBuildSeconds: 10 }],
      DEFAULT_I18N_BUDGET,
    );
    expect(over.ok).toBe(false);
    expect(over.violations.length).toBeGreaterThan(0);
  });
});

describe("PK-37: Descriptive Situation Room", () => {
  it("excludes private/needs_review/restricted records and attaches links and caveats", () => {
    const dataset = makeTestDataset();
    const model = buildReadModel(dataset);
    const lab = projectLaboratory(model, {
      queueItems: [
        {
          id: "Q-PRIVATE-1",
          method: "gap_scan",
          method_version: "1.0.0",
          engine_version: "1.0.0",
          priority: 90,
          question: "Internal private queue item",
          refs: [],
          evidences: [],
          alternative_explanations: [],
          falsifiers: [],
          dedup_key: "priv-1",
          origin_run_id: "RUN-001",
          visibility: "private",
          status: "queued",
          revision: 1,
          lease_generation: 0,
          assigned_run_id: null,
          lease_expires_at: null,
          input_snapshot: "SNAP-2026-11-25",
          retry_count: 0,
          outcome_refs: [],
          transitions: [],
          late_outputs: [],
          d12_redacted: false,
        },
      ],
    });

    const room = buildSituationRoom(model, lab, { generatedAt: "2026-11-25T23:00:00.000Z" });
    expect(room.generated_at).toBe("2026-11-25T23:00:00.000Z");

    const serialized = JSON.stringify(room);
    expect(serialized).not.toContain("TL-0003");
    expect(serialized).not.toContain("G-0003");
    expect(serialized).not.toContain("PRIVATE_PERSON");
    expect(serialized).not.toContain("Q-PRIVATE-1");

    expect(room.verified_events.length).toBeGreaterThan(0);
    for (const item of room.verified_events) {
      expect(item.hrefPath).toMatch(/^events\//);
      expect(item.caveat.it.length).toBeGreaterThan(0);
    }
    expect(room.dossiers_calendar.map((d) => d.id)).toContain("TL-0004");
  });
});
