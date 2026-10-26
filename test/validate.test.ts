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

  it("warns about named persons without a primary source", () => {
    const warnings = validateDataFiles(baseline).issues.filter((i) => i.severity === "warning");
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings.every((w) => w.message.includes("without primary_url"))).toBe(true);
  });
});
