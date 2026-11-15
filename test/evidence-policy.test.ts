import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { m5References, readM5Audit } from "../src/editorial/m5.ts";
import {
  consistentEvidence,
  hasOriginalProvenance,
  personReference,
  suspectPerson,
} from "../src/pipeline/evidence-policy.ts";
import { readDataFiles } from "../src/pipeline/load.ts";
import { validateDataFiles } from "../src/pipeline/validate.ts";

const data = validateDataFiles(readDataFiles()).dataset;
const original = data.relationships.find((r) => r.id === "G-0008");
if (!original) throw new Error("missing G-0008 fixture");

describe("evidence policy", () => {
  it("requires a real original path for the baseline", () => {
    expect(hasOriginalProvenance(original)).toBe(true);
    expect(hasOriginalProvenance({ provenance: [] })).toBe(false);
    expect(
      hasOriginalProvenance({
        provenance: [{ file: "sources/incremental/example.md", line: 1, original: { text: "x" } }],
      }),
    ).toBe(false);
    expect(
      hasOriginalProvenance({
        provenance: [
          { file: "sources/original/../incremental/example.md", line: 1, original: { text: "x" } },
        ],
      }),
    ).toBe(false);
  });
  it("accepts exactly the four provisional evidence pairs", () => {
    const pairs = {
      E1: "documented",
      E2: "institutional_attribution",
      E3: "corroborated",
      E4: "allegation",
    } as const;
    for (const [level, expected] of Object.entries(pairs))
      for (const status of Object.values(pairs)) {
        const relation = {
          ...original,
          evidence_level: level as keyof typeof pairs,
          evidence_status: status,
        };
        expect(consistentEvidence(relation)).toBe(status === expected);
      }
  });
  it("binds exact references to the claim", () => {
    const url = "https://example.com/doc#section";
    const relation = { ...original, primary_url: url, provenance: [] };
    const sourceFixture = data.sources[0];
    const sourceId = relation.sources[0];
    if (!sourceFixture || !sourceId) throw new Error("missing source fixture");
    const source = { ...sourceFixture, id: sourceId, urls: [url] };
    expect(personReference(relation, [source], new Map())).toBe("direct");
    expect(personReference(relation, [{ ...source, id: "S99" }], new Map())).toBe("unregistered");
    expect(personReference(relation, [], new Map([["G-9999", [url]]]))).toBe("unregistered");
    expect(personReference(relation, [], new Map([[relation.id, [url]]]))).toBe("m5");
    expect(
      personReference({ ...relation, primary_url: `${url}x` }, [], new Map([[relation.id, [url]]])),
    ).toBe("unregistered");
    expect(personReference(original, [], new Map())).toBe("original");
    expect(personReference({ ...original, id: "G-9999" }, [], new Map())).toBe("unregistered");
    expect(personReference({ ...relation, primary_url: null }, [], new Map())).toBe("missing");
  });
  it("projects M5 matches only and preserves approval", () => {
    const audit = readM5Audit();
    const snapshot = JSON.stringify(audit);
    const references = m5References(audit);
    expect(references.has("G-0024")).toBe(true);
    expect(references.has("G-0230")).toBe(false);
    const changed = structuredClone(audit);
    const review = changed.relationship_reviews[0];
    if (!review) throw new Error("missing review fixture");
    review.source_id = "unknown";
    expect(m5References(changed).has(review.id)).toBe(false);
    review.assessment = "primary_not_found";
    expect(m5References(changed).has(review.id)).toBe(false);
    expect(JSON.stringify(audit)).toBe(snapshot);
  });
  it("flags person-like names as a warning heuristic only", () => {
    const entity = data.entities.find((e) => e.kind === "organization");
    if (!entity) throw new Error("missing entity fixture");
    expect(suspectPerson({ ...entity, name: { it: "Mario Rossi" } })).toBe(true);
    expect(suspectPerson({ ...entity, name: { it: "Associated Press" } })).toBe(true);
    expect(suspectPerson({ ...entity, name: { it: "Jose\u0301   Rossi" } })).toBe(true);
    expect(suspectPerson({ ...entity, name: { it: "ACME" } })).toBe(false);
    expect(suspectPerson({ ...entity, kind: "person", name: { it: "Mario Rossi" } })).toBe(false);
  });
});

describe("M5 registry loader", () => {
  it("fails closed on missing and malformed registry files", () => {
    const root = mkdtempSync(path.join(tmpdir(), "b03-m5-"));
    try {
      const run = () =>
        spawnSync(
          process.execPath,
          [
            "--input-type=module",
            "-e",
            `import { readM5References } from ${JSON.stringify(new URL("../src/editorial/m5.ts", import.meta.url).href)}; readM5References();`,
          ],
          { env: { ...process.env, OEM_REPO_ROOT: root }, encoding: "utf8" },
        );
      expect(run().status).not.toBe(0);
      mkdirSync(path.join(root, "docs", "audit"), { recursive: true });
      writeFileSync(path.join(root, "docs", "audit", "M5_2026-11-12.json"), "{}");
      expect(run().status).not.toBe(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
