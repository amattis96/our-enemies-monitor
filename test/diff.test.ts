import { beforeAll, describe, expect, it } from "vitest";
import { importBaseline } from "../src/pipeline/baseline/import.ts";
import { diffData, diffMarkdown } from "../src/pipeline/diff.ts";
import { type DataFile, datasetToFiles } from "../src/pipeline/load.ts";
import { serializeRecord } from "../src/pipeline/serialize.ts";

let base: DataFile[];
const persons = new Set(["GILL", "MED", "MUSK"]);
beforeAll(() => {
  base = datasetToFiles(importBaseline());
});

function changed(path: string, change: (record: Record<string, unknown>) => void): DataFile[] {
  return base.map((file) => {
    if (file.path !== path) return file;
    const record = JSON.parse(file.text);
    change(record);
    return { ...file, text: serializeRecord(record) };
  });
}

const errors = (files: DataFile[], agent = true) =>
  diffData(base, files, { agent, persons })
    .flags.filter((f) => f.severity === "error")
    .map((f) => `${f.id}: ${f.message}`);

const newRelationship = (overrides: Record<string, unknown> = {}): DataFile => ({
  collection: "relationships",
  path: "relationships/G-9001.json",
  text: serializeRecord({
    id: "G-9001",
    subject: "MED",
    predicate: "FINANZIA",
    object: "VOE",
    relation_class: "financial",
    evidence_level: "E2",
    evidence_status: "institutional_attribution",
    events: [],
    valid_from: null,
    valid_to: null,
    primary_url: "https://example.org/act",
    caveat: null,
    sources: ["S01"],
    review: { status: "needs_review", notes: [] },
    provenance: [],
    ...overrides,
  }),
});

describe("evidence diff", () => {
  it("reports nothing when data is unchanged", () => {
    const report = diffData(base, base, { agent: true, persons });
    expect(report.changes).toEqual([]);
    expect(diffMarkdown(report)).toContain("No changes");
  });

  it("accepts a well-formed agent proposal but flags it for attention", () => {
    const report = diffData(base, [...base, newRelationship()], { agent: true, persons });
    expect(report.flags.filter((f) => f.severity === "error")).toEqual([]);
    const attention = report.flags.map((f) => f.message);
    expect(attention).toContainEqual(expect.stringContaining("named person MED"));
    expect(attention).toContainEqual(expect.stringContaining("asserts a financial relationship"));
    expect(diffMarkdown(report)).toContain("| `predicate` | — | `FINANZIA` |");
  });

  it("rejects agent relationships without a primary source or review status", () => {
    const found = errors([
      ...base,
      newRelationship({ primary_url: null, review: { status: "reviewed", notes: [] } }),
    ]);
    expect(found).toContainEqual(expect.stringContaining("without primary_url"));
    expect(found).toContainEqual(expect.stringContaining('expected "needs_review"'));
  });

  it("rejects deletions and provenance changes by agents", () => {
    expect(errors(base.filter((f) => f.path !== "entities/RU.json"))).toContainEqual(
      expect.stringContaining("record removed"),
    );
    expect(
      errors(
        changed("entities/RU.json", (r) => {
          (r.provenance as { row: number }[])[0] = {
            ...(r.provenance as { row: number }[])[0],
            row: 2,
          } as never;
        }),
      ),
    ).toContainEqual(expect.stringContaining("provenance changed"));
  });

  it("rejects self-review and hypothesis promotion by agents", () => {
    expect(
      errors(
        changed("events/TL-0001.json", (r) => {
          (r.review as { status: string }).status = "reviewed";
        }),
      ),
    ).toContainEqual(expect.stringContaining("only a human reviewer"));
    expect(
      errors(
        changed("hypotheses/H01.json", (r) => {
          r.status = "promoted";
        }),
      ),
    ).toContainEqual(expect.stringContaining("hypothesis promoted"));
  });

  it("flags raised evidence levels", () => {
    const report = diffData(
      base,
      changed("relationships/G-0002.json", (r) => {
        r.evidence_level = "E1";
      }),
      { persons },
    );
    expect(report.flags.map((f) => f.message)).toContain("evidence level raised E2 → E1");
  });

  it("only warns, never fails, outside agent mode", () => {
    const files = base.filter((f) => f.path !== "entities/RU.json");
    expect(errors(files, false)).toEqual([]);
    expect(diffData(base, files, { persons }).flags[0]?.severity).toBe("attention");
  });
});
