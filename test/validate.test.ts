import { beforeAll, describe, expect, it } from "vitest";
import { importBaseline } from "../src/pipeline/baseline/import.ts";
import { type DataFile, datasetToFiles, readDataFiles } from "../src/pipeline/load.ts";
import { serializeRecord } from "../src/pipeline/serialize.ts";
import { validateDataFiles } from "../src/pipeline/validate.ts";

let baseline: DataFile[];
beforeAll(() => {
  baseline = datasetToFiles(importBaseline());
});

/** Apply a change to one record (by data path) and return the errors. */
function errorsAfter(target: string, change: (record: Record<string, unknown>) => void): string[] {
  const files = baseline.map((file) => {
    if (file.path !== target) return file;
    const record = JSON.parse(file.text);
    change(record);
    return { ...file, text: serializeRecord(record) };
  });
  return validateDataFiles(files)
    .issues.filter((i) => i.severity === "error")
    .map((i) => `${i.file}: ${i.message}`);
}

describe("committed data", () => {
  it("has no validation errors", () => {
    const files = readDataFiles();
    expect(files.length).toBeGreaterThan(0);
    const errors = validateDataFiles(files).issues.filter((i) => i.severity === "error");
    expect(errors).toEqual([]);
  });
});

describe("validator", () => {
  it("rejects dangling references", () => {
    const errors = errorsAfter("relationships/G-0001.json", (r) => {
      r.object = "NOPE";
    });
    expect(errors).toContainEqual(expect.stringContaining('object "NOPE" does not exist'));
  });

  it("rejects unknown source codes", () => {
    const errors = errorsAfter("events/TL-0001.json", (r) => {
      r.sources = ["S99"];
    });
    expect(errors).toContainEqual(expect.stringContaining('source "S99" does not exist'));
  });

  it("rejects E5 on a relationship", () => {
    const errors = errorsAfter("relationships/G-0001.json", (r) => {
      r.evidence_level = "E5";
    });
    expect(errors).toContainEqual(expect.stringContaining("evidence_level"));
  });

  it("rejects an end date before the start date", () => {
    const errors = errorsAfter("events/TL-0001.json", (r) => {
      r.date = { start: "2007-04", end: "2006-01", precision: "month" };
    });
    expect(errors).toContainEqual(expect.stringContaining("end is before start"));
  });

  it("rejects a precision that does not match the date", () => {
    const errors = errorsAfter("events/TL-0001.json", (r) => {
      r.date = { start: "2007-04", end: null, precision: "day" };
    });
    expect(errors).toContainEqual(expect.stringContaining("start does not match precision"));
  });

  it("rejects impossible calendar dates", () => {
    const errors = errorsAfter("events/TL-0001.json", (r) => {
      r.date = { start: "2007-02-30", end: null, precision: "day" };
    });
    expect(errors).toContainEqual(expect.stringContaining("invalid calendar date"));
  });

  it("detects tampered provenance", () => {
    const errors = errorsAfter("entities/RU.json", (r) => {
      const [entry] = r.provenance as { original: Record<string, string> }[];
      if (entry) entry.original.name = "Altro nome";
    });
    expect(errors).toContainEqual(expect.stringContaining("differs from original"));
  });

  it("requires event participation to involve an event", () => {
    const errors = errorsAfter("relationships/G-0001.json", (r) => {
      r.relation_class = "event_participation";
    });
    expect(errors).toContainEqual(expect.stringContaining("without an event endpoint"));
  });

  it("rejects duplicate IDs and file names that do not match the ID", () => {
    const copy = baseline.find((f) => f.path === "entities/RU.json");
    if (!copy) throw new Error("missing fixture");
    const errors = validateDataFiles([...baseline, { ...copy, path: "entities/RU2.json" }]).issues;
    const messages = errors.map((i) => i.message);
    expect(messages).toContainEqual(expect.stringContaining('duplicate id "RU"'));
    expect(messages).toContainEqual(expect.stringContaining("file name does not match"));
  });

  it("rejects files not in canonical form", () => {
    const files = baseline.map((file) =>
      file.path === "entities/RU.json"
        ? { ...file, text: JSON.stringify(JSON.parse(file.text)) }
        : file,
    );
    const messages = validateDataFiles(files).issues.map((i) => `${i.file}: ${i.message}`);
    expect(messages).toContain("entities/RU.json: not in canonical form (run pnpm format:data)");
  });

  it("reports every missing person URL and classifies heuristic warnings separately", () => {
    const data = importBaseline();
    const persons = new Set(
      data.entities.filter((entity) => entity.kind === "person").map((entity) => entity.id),
    );
    const missingPaths = data.relationships
      .filter(
        (relation) =>
          relation.primary_url === null &&
          (persons.has(relation.subject) || persons.has(relation.object)),
      )
      .map((relation) => `relationships/${relation.id}.json`)
      .sort();
    expect(missingPaths.length).toBeGreaterThan(0);

    const personName =
      /^\p{Lu}[\p{Ll}\p{M}]+(?:['’-]\p{Lu}?[\p{Ll}\p{M}]+)*(?:\s+\p{Lu}[\p{Ll}\p{M}]+(?:['’-]\p{Lu}?[\p{Ll}\p{M}]+)*){1,3}$/u;
    const heuristicPaths = data.entities
      .filter(
        (entity) =>
          entity.kind !== "person" &&
          (entity.domain === "persons" || personName.test(entity.name.it.trim())),
      )
      .filter((entity) =>
        data.relationships.some(
          (relation) => relation.subject === entity.id || relation.object === entity.id,
        ),
      )
      .map((entity) => `entities/${entity.id}.json`)
      .sort();
    expect(heuristicPaths.length).toBeGreaterThan(0);

    const warnings = validateDataFiles(baseline).issues.filter(
      (issue) => issue.severity === "warning",
    );
    const missing = warnings.filter((issue) => issue.message.includes("without primary_url"));
    const heuristic = warnings.filter((issue) =>
      issue.message.startsWith("possible person classification; relationships: "),
    );
    expect(missing.map((issue) => issue.file).sort()).toEqual(missingPaths);
    expect(heuristic.map((issue) => issue.file).sort()).toEqual(heuristicPaths);
    expect(warnings).toHaveLength(missing.length + heuristic.length);
    for (const issue of heuristic) {
      const id = issue.file.slice("entities/".length, -".json".length);
      const related = data.relationships
        .filter((relation) => relation.subject === id || relation.object === id)
        .map((relation) => relation.id);
      expect(issue.message).toBe(
        `possible person classification; relationships: ${related.join(", ")}`,
      );
    }
  });
});

describe("validator (M3 rules)", () => {
  /** Change one committed record (with translations) and return the errors. */
  function committedErrorsAfter(target: string, change: (record: Record<string, unknown>) => void) {
    const files = readDataFiles().map((file) => {
      if (file.path !== target) return file;
      const record = JSON.parse(file.text);
      change(record);
      return { ...file, text: serializeRecord(record) };
    });
    return validateDataFiles(files)
      .issues.filter((i) => i.severity === "error")
      .map((i) => `${i.file}: ${i.message}`);
  }

  it("flags a translation made stale by a change of the Italian text", () => {
    const errors = committedErrorsAfter("events/TL-0001.json", (r) => {
      (r.title as { it: string }).it = "Titolo modificato";
    });
    expect(errors).toContainEqual(expect.stringContaining("translation is stale"));
  });

  it("flags English text without a translation state", () => {
    const errors = committedErrorsAfter("events/TL-0001.json", (r) => {
      (r.review as { translations?: unknown }).translations = undefined;
    });
    expect(errors).toContainEqual(expect.stringContaining("no review.translations.en state"));
  });

  it("flags an incomplete translation", () => {
    const errors = committedErrorsAfter("events/TL-0001.json", (r) => {
      delete (r.description as { en?: string }).en;
    });
    expect(errors).toContainEqual(expect.stringContaining("translation incomplete"));
  });

  it("rejects unknown country codes and countries on non-states", () => {
    expect(
      committedErrorsAfter("events/TL-0001.json", (r) => {
        r.places = ["ZZ"];
      }),
    ).toContainEqual(expect.stringContaining('place "ZZ" is not an ISO country code'));
    expect(
      committedErrorsAfter("entities/GRU.json", (r) => {
        r.country = "RU";
      }),
    ).toContainEqual(expect.stringContaining("country must be set for states and only for states"));
  });
});

describe("B03 validation", () => {
  it("rejects missing original provenance for each collection", () => {
    const data = validateDataFiles(readDataFiles()).dataset;
    for (const collection of Object.keys(data) as (keyof typeof data)[]) {
      const copy = structuredClone(data);
      const record = copy[collection].find((r) => r.review.status === "imported_unreviewed");
      if (!record) throw new Error(`missing ${collection} fixture`);
      record.provenance = [];
      const issues = validateDataFiles(datasetToFiles(copy)).issues;
      expect(
        issues.some(
          (i) =>
            i.severity === "error" &&
            i.file === `${collection}/${record.id}.json` &&
            i.message.includes("requires original provenance"),
        ),
      ).toBe(true);
    }
  });
  it("reports inconsistent pairs and unregistered person links", () => {
    const copy = validateDataFiles(readDataFiles()).dataset;
    const personLink = copy.relationships.find((r) => r.id === "G-0230");
    if (!personLink) throw new Error("missing person link fixture");
    personLink.primary_url = "https://example.com/";
    personLink.evidence_status =
      personLink.evidence_status === "documented" ? "allegation" : "documented";
    const issues = validateDataFiles(datasetToFiles(copy)).issues.filter(
      (i) => i.file === "relationships/G-0230.json",
    );
    expect(
      issues.some((i) => i.severity === "error" && i.message.includes("inconsistent evidence")),
    ).toBe(true);
    expect(
      issues.some(
        (i) => i.severity === "warning" && i.message.includes("unregistered primary_url"),
      ),
    ).toBe(true);
  });
});
