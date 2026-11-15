import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { COLLECTION_NAMES, type Dataset } from "../src/model/index.ts";
import { repoPath } from "../src/pipeline/paths.ts";
import { buildCatalog, exportFiles, latestPublicEventDate } from "../src/site/exports.ts";
import { type PublicationReport, publicationReport } from "../src/site/publication.ts";
import { loadReadModel } from "../src/site/read-model.ts";
import type { ArchivedResearch } from "../src/site/research.ts";
import { buildVocabulary, GLOSSARY_IT_EN } from "../src/site/vocabulary.ts";

let report: PublicationReport;
let pub: Dataset;
const vocabulary = buildVocabulary();

beforeAll(() => {
  report = publicationReport(loadReadModel().dataset);
  pub = report.dataset;
});

/** Paths of `properties` entries lacking a `description`, recursively. */
function undescribed(node: unknown, path = "$"): string[] {
  if (Array.isArray(node)) return node.flatMap((item, i) => undescribed(item, `${path}[${i}]`));
  if (!node || typeof node !== "object") return [];
  const record = node as Record<string, unknown>;
  const missing: string[] = [];
  const properties = record.properties;
  if (properties && typeof properties === "object") {
    for (const [name, value] of Object.entries(properties)) {
      if (typeof (value as { description?: unknown }).description !== "string")
        missing.push(`${path}.${name}`);
    }
  }
  for (const [key, value] of Object.entries(record)) {
    missing.push(...undescribed(value, `${path}/${key}`));
  }
  return missing;
}

describe("schema descriptions (FABLE D A1)", () => {
  it("describe every property of every collection schema", () => {
    for (const name of COLLECTION_NAMES) {
      const schema = JSON.parse(readFileSync(repoPath(`schemas/${name}.schema.json`), "utf8"));
      expect(undescribed(schema), name).toEqual([]);
    }
  });

  it("point enumerated fields to their vocabulary section", () => {
    const schema = readFileSync(repoPath("schemas/relationships.schema.json"), "utf8");
    for (const section of ["evidence_levels", "relation_classes", "evidence_statuses"]) {
      expect(schema).toContain(`vocabulary.json#/${section}`);
      expect(vocabulary).toHaveProperty(section);
    }
    expect(schema).toContain("not a ranking");
  });
});

describe("vocabulary (FABLE D A2)", () => {
  it("has an entry for every controlled value used in the public data", () => {
    const used: [keyof typeof vocabulary, string[]][] = [
      [
        "evidence_levels",
        [...pub.events, ...pub.relationships].flatMap((r) =>
          r.evidence_level ? [r.evidence_level] : [],
        ),
      ],
      ["evidence_statuses", pub.relationships.map((r) => r.evidence_status)],
      ["relation_classes", pub.relationships.map((r) => r.relation_class)],
      ["entity_kinds", pub.entities.map((e) => e.kind)],
      ["entity_domains", pub.entities.map((e) => e.domain)],
      [
        "review_statuses",
        COLLECTION_NAMES.flatMap((name) => pub[name].map((r) => r.review.status)),
      ],
      [
        "translation_statuses",
        COLLECTION_NAMES.flatMap((name) =>
          pub[name].flatMap((r) => r.review.translations?.en?.status ?? []),
        ),
      ],
      ["timeline_statuses", pub.events.map((e) => e.timeline_status)],
      ["event_record_types", pub.events.map((e) => e.record_type)],
      ["themes", pub.events.flatMap((e) => e.themes)],
      ["date_precisions", pub.events.map((e) => e.date.precision)],
      ["known_issue_codes", pub.events.flatMap((e) => e.known_issues.map((k) => k.code))],
      ["hypothesis_statuses", pub.hypotheses.map((h) => h.status)],
      ["hypothesis_priorities", pub.hypotheses.map((h) => h.priority)],
      ["source_types", pub.sources.map((s) => s.type)],
      ["origin_types", pub.sources.flatMap((s) => s.origin_type ?? [])],
      ["exposure_statuses", pub.exposures.map((x) => x.status)],
      ["exposure_groups", pub.exposures.flatMap((x) => x.group?.id ?? [])],
      ["measure_units", pub.exposures.flatMap((x) => x.measures.map((m) => m.unit))],
      ["measure_qualifiers", pub.exposures.flatMap((x) => x.measures.map((m) => m.qualifier))],
      ["withheld_reasons", report.withheld.flatMap((w) => w.reasons)],
    ];
    for (const [section, values] of used) {
      expect(values.length, section).toBeGreaterThan(0);
      const entries = vocabulary[section] as Record<string, unknown>;
      const missing = [...new Set(values)].filter((value) => !(value in entries));
      expect(missing, section).toEqual([]);
    }
  });

  it("states that evidence levels are not ordinal and E2 is not a conviction", () => {
    expect(vocabulary.scale_note.en).toMatch(/not steps of a scale/);
    expect(vocabulary.evidence_levels.E2.must_not_read_as).toContain("conviction");
    expect(vocabulary.evidence_levels.E5.applies_to).toEqual(["hypotheses"]);
    expect(vocabulary.relation_classes.event_participation.must_not_read_as).toContain("control");
  });

  it("publishes reading rules R1-R5 in both languages", () => {
    expect(vocabulary.reading_rules.map((r) => r.id)).toEqual(["R1", "R2", "R3", "R4", "R5"]);
    for (const { rule } of vocabulary.reading_rules) {
      expect(rule.it.length).toBeGreaterThan(0);
      expect(rule.en.length).toBeGreaterThan(0);
    }
  });

  it("keeps the glossary within docs/TRANSLATION_GLOSSARY.md", () => {
    const doc = readFileSync(repoPath("docs/TRANSLATION_GLOSSARY.md"), "utf8");
    for (const term of Object.keys(GLOSSARY_IT_EN)) expect(doc).toContain(term);
  });
});

describe("catalog (FABLE D A3)", () => {
  it("reports freshness and counts from the same public projection", () => {
    const files = exportFiles(report);
    const catalog = JSON.parse(files.find((f) => f.path === "index.json")?.text ?? "{}");
    const expected = pub.events
      .filter((e) => e.record_type === "event")
      .map((e) => e.date.start)
      .reduce<string | null>((max, d) => (max === null || d > max ? d : max), null);
    expect(catalog.freshness.latest_public_event_date).toBe(expected);
    expect(catalog.freshness.latest_public_event_date).toBe(latestPublicEventDate(pub));
    for (const name of COLLECTION_NAMES) {
      expect(catalog.projection.published[name]).toBe(pub[name].length);
      expect(catalog.projection.withheld[name]).toBe(
        report.withheld.filter((w) => w.collection === name).length,
      );
    }
    expect(catalog.canonical_language).toBe("it");
    expect(catalog.read_first).toEqual(["vocabulary.json"]);
    const paths = new Set(files.map((f) => f.path));
    for (const entry of catalog.datasets) {
      expect(paths.has(entry.path), entry.path).toBe(true);
      if (entry.schema) expect(paths.has(entry.schema), entry.schema).toBe(true);
    }
    expect(paths.has("vocabulary.json")).toBe(true);
  });

  it("derives every date from inputs, never from the wall clock", () => {
    const commit = { commit: "abc", commit_date: "2026-11-15T00:00:00+01:00" };
    const archive: ArchivedResearch[] = [
      {
        id: "S11",
        title: "t",
        createdAt: "2026-11-13",
        kind: "incremental",
        path: "p",
        url: "u",
      },
    ];
    const first = buildCatalog(report, commit, archive);
    expect(buildCatalog(report, commit, archive)).toEqual(first);
    expect(first.freshness.commit_date).toBe(commit.commit_date);
    expect(first.freshness.latest_archived_source).toMatchObject({
      id: "S11",
      created_at: "2026-11-13",
    });
    expect(buildCatalog(report, commit, []).freshness.latest_archived_source).toBeNull();
    const thematic: ArchivedResearch[] = [
      { id: "T-1", title: "t", createdAt: "2026-11-14", kind: "thematic", path: "p", url: "u" },
    ];
    expect(
      buildCatalog(report, commit, [...thematic, ...archive]).freshness.latest_archived_source?.id,
    ).toBe("S11");
  });
});
