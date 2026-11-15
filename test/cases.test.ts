import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  type CasePilot,
  caseLanes,
  casesOf,
  denialsOf,
  queryClaims,
  readCasePilot,
  validateCasePilot,
} from "../src/editorial/cases.ts";
import {
  CLAIM_ASPECTS,
  CLAIM_KINDS,
  type Dataset,
  PROCEDURAL_STATUSES,
  type Relationship,
} from "../src/model/index.ts";
import { readDataFiles } from "../src/pipeline/load.ts";
import { repoPath } from "../src/pipeline/paths.ts";
import { validateDataFiles } from "../src/pipeline/validate.ts";
import { exportFiles } from "../src/site/exports.ts";
import { publicationReport } from "../src/site/publication.ts";
import { buildVocabulary } from "../src/site/vocabulary.ts";

const dataset = validateDataFiles(readDataFiles()).dataset;
const pilot = readCasePilot();
const clone = (): CasePilot => structuredClone(pilot);
const errorsOf = (p: CasePilot) =>
  validateCasePilot(p, dataset)
    .filter((i) => i.severity === "error")
    .map((i) => i.message);
const claim = (p: CasePilot, id: string) => {
  const found = p.claims.find((c) => c.id === id);
  if (!found) throw new Error(id);
  return found;
};

describe("Case/Claim pilot (B18, ADR-06)", () => {
  it("validates against the canonical data with no errors or warnings", () => {
    expect(validateCasePilot(pilot, dataset)).toEqual([]);
  });

  it("keeps every pilot record needs_review with empty provenance", () => {
    for (const record of [...pilot.cases, ...pilot.claims]) {
      expect(record.review.status, record.id).toBe("needs_review");
      expect(record.provenance, record.id).toEqual([]);
    }
  });

  it("distinguishes fact, attribution, denial and judgment by structured query", () => {
    const ids = (kind: (typeof CLAIM_KINDS)[number]) =>
      queryClaims(pilot, { kind }).map((c) => c.id);
    expect(ids("fact")).toEqual(["CL-0001", "CL-0003"]);
    expect(ids("attribution")).toEqual(["CL-0004"]);
    expect(ids("denial")).toEqual(["CL-0005"]);
    expect(ids("judgment")).toEqual(["CL-0002"]);
    // Marywilska: attribution and denial are two claims by two named parties.
    expect(
      queryClaims(pilot, { about: "TL-0059", aspect: "sponsor" }).map((c) => c.asserted_by),
    ).toEqual(["PL", "RU"]);
    expect(denialsOf(pilot, "CL-0004").map((c) => c.id)).toEqual(["CL-0005"]);
    // An attribution is never a judgment.
    expect(queryClaims(pilot, { case: "CASE-0002", kind: "judgment" })).toEqual([]);
  });

  it("keeps empty lanes visible as not recorded", () => {
    const lanes = caseLanes(pilot, "CASE-0001");
    expect(Object.keys(lanes)).toEqual([...CLAIM_KINDS]);
    expect(lanes.attribution).toEqual([]);
    expect(lanes.judgment.map((c) => c.id)).toEqual(["CL-0002"]);
  });

  it("counts two phases of one case once", () => {
    expect(casesOf(pilot, ["TL-0015", "TL-0092"])).toEqual(["CASE-0001"]);
  });

  it("gives every person claim an exact status, date and registered primary source", () => {
    for (const id of ["CL-0001", "CL-0002"]) {
      const [status] = claim(pilot, id).person_status;
      expect(status?.entity).toBe("GILL");
      expect(status?.status).toBe("sentenced");
      expect(status?.status_date).toBe("2025-11");
      expect(status?.primary_source).toBe("P03");
    }
    const p = clone();
    claim(p, "CL-0002").person_status = [];
    expect(errorsOf(p)).toContain(
      "CL-0002: person GILL needs person_status (status, date, primary source)",
    );
    const q = clone();
    const [status] = claim(q, "CL-0001").person_status;
    if (status) status.primary_url = "https://example.org/unregistered";
    expect(errorsOf(q)).toContain(
      "CL-0001: https://example.org/unregistered is not registered on P03",
    );
  });

  it("rejects denials without reply, attributions without asserter and invented levels", () => {
    const p = clone();
    claim(p, "CL-0005").responds_to = null;
    claim(p, "CL-0004").asserted_by = null;
    claim(p, "CL-0003").evidence_level = "E1";
    claim(p, "CL-0003").about = ["TL-0015"];
    claim(p, "CL-0001").transcribed_from = [{ record: "TL-0015", field: "caveat" }];
    claim(p, "CL-0002").sources = ["S99"];
    expect(errorsOf(p)).toEqual(
      expect.arrayContaining([
        "CL-0005: denial needs responds_to",
        "CL-0004: attribution needs asserted_by",
        "CL-0003: evidence_level E1 is not carried by a listed relationship",
        "CL-0003: TL-0015 is not an event of CASE-0002",
        "CL-0001: TL-0015.caveat is empty",
        "CL-0002: unknown source S99",
      ]),
    );
  });

  it("does not lend a level or a primary URL from an unrelated relationship (fixture)", () => {
    // Fixture: an E1 relationship of GILL with the CPS URL, but about another event.
    const base = dataset.relationships.find((r) => r.id === "G-0287") as Relationship;
    const unrelated: Relationship = {
      ...structuredClone(base),
      id: "G-9999",
      object: "TL-0059",
      events: ["TL-0059"],
    };
    const d: Dataset = { ...dataset, relationships: [...dataset.relationships, unrelated] };
    const p = clone();
    claim(p, "CL-0003").evidence_level = "E1";
    claim(p, "CL-0003").relationships = ["G-0224"];
    claim(p, "CL-0002").relationships = ["G-9999"];
    const errors = validateCasePilot(p, d)
      .filter((i) => i.severity === "error")
      .map((i) => i.message);
    expect(errors).toEqual(
      expect.arrayContaining([
        "CL-0003: evidence_level E1 is not carried by a listed relationship",
        "CL-0002: G-9999 is outside CASE-0001",
        "CL-0002: evidence_level E1 is not carried by a listed relationship",
        "CL-0002: no listed relationship of GILL has primary_url https://www.cps.gov.uk/cps/news/former-ukip-mep-jailed-taking-bribes",
      ]),
    );
  });

  it("treats blank and Italian-less transcribed fields as empty (fixture)", () => {
    const events = dataset.events.map((e) =>
      e.id === "TL-0059" ? { ...e, evidence_note: { it: " " }, title: { ...e.title, it: "" } } : e,
    );
    const errors = validateCasePilot(pilot, { ...dataset, events })
      .filter((i) => i.severity === "error")
      .map((i) => i.message);
    expect(errors).toContain("CL-0004: TL-0059.evidence_note is empty");
    expect(errors).toContain("CL-0003: TL-0059.title is empty");
  });

  it("stays out of the site and the public exports (ADR-10)", () => {
    const files = [
      ...readdirSync(repoPath("src/site")).map((f) => `src/site/${f}`),
      ...readdirSync(repoPath("web/src"), { recursive: true, encoding: "utf8" })
        .filter((f) => /\.(ts|tsx|astro)$/.test(f))
        .map((f) => `web/src/${f}`),
    ];
    expect(files.length).toBeGreaterThan(10);
    for (const file of files) {
      const text = readFileSync(repoPath(file), "utf8");
      expect(text, file).not.toMatch(/editorial\/cases|audit\/cases|pilot\.v1/);
    }
    const text = exportFiles(publicationReport(dataset))
      .filter((f) => !f.path.startsWith("schemas/"))
      .map((f) => f.text)
      .join("\n");
    expect(text).not.toContain("CASE-0001");
    expect(text).not.toContain("CL-0001");
  });
});

describe("Case/Claim contract (B13 rule)", () => {
  const vocabulary = buildVocabulary();
  it("defines every new controlled value in vocabulary.json", () => {
    expect(Object.keys(vocabulary.claim_kinds)).toEqual([...CLAIM_KINDS]);
    expect(Object.keys(vocabulary.claim_aspects)).toEqual([...CLAIM_ASPECTS]);
    expect(Object.keys(vocabulary.procedural_statuses)).toEqual([...PROCEDURAL_STATUSES]);
    expect(vocabulary.claim_kinds.attribution.must_not_read_as).toContain("conviction");
    expect(vocabulary.procedural_statuses.charged.must_not_read_as).toContain("conviction");
  });

  it("describes every property of the case and claim schemas", () => {
    const undescribed = (node: unknown): number => {
      if (!node || typeof node !== "object") return 0;
      const record = node as Record<string, unknown>;
      const own = Object.values(
        (record.properties ?? {}) as Record<string, { description?: string }>,
      ).filter((p) => typeof p.description !== "string").length;
      return own + Object.values(record).reduce<number>((n, v) => n + undescribed(v), 0);
    };
    for (const name of ["cases", "claims"]) {
      const text = readFileSync(repoPath(`schemas/${name}.schema.json`), "utf8");
      expect(undescribed(JSON.parse(text)), name).toBe(0);
    }
    const claims = readFileSync(repoPath("schemas/claims.schema.json"), "utf8");
    for (const section of ["claim_kinds", "claim_aspects", "procedural_statuses"]) {
      expect(claims).toContain(`vocabulary.json#/${section}`);
    }
  });
});
