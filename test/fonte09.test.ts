import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import type { Dataset } from "../src/model/index.ts";
import { readDataFiles } from "../src/pipeline/load.ts";
import { repoPath } from "../src/pipeline/paths.ts";
import { validateDataFiles } from "../src/pipeline/validate.ts";

const ARCHIVE = "sources/incremental/Fonte_09_Aggiornamento_OSINT_Eventi_Reti_Europa_2026-11-11.md";

let dataset: Dataset;
beforeAll(() => {
  dataset = validateDataFiles(readDataFiles()).dataset;
});

const range = (prefix: string, from: number, to: number, width = 3) =>
  Array.from(
    { length: to - from + 1 },
    (_, i) => `${prefix}${String(from + i).padStart(width, "0")}`,
  );

describe("Fonte_09 incremental import", () => {
  it("keeps the 30 OEM26 items as pending, unreviewed events without provenance", () => {
    const events = range("EXT-", 5, 34).map((id) => dataset.events.find((e) => e.id === id));
    expect(events.every((e) => e !== undefined)).toBe(true);
    for (const event of events) {
      expect(event?.timeline_status).toBe("pending_integration");
      expect(event?.review.status).toBe("needs_review");
      expect(event?.provenance).toEqual([]);
      expect(event?.sources).toContain("S09");
      expect(event?.evidence_level).not.toBe("E5");
    }
  });

  it("registers all 50 SRC references with the URLs of the archived document", () => {
    const text = readFileSync(repoPath(ARCHIVE), "utf8");
    const registered = new Map<number, string[]>();
    for (const line of text.split("\n")) {
      const match = line.match(/^- \*\*\[SRC-(\d{2})\]\*\*.*?: (https?:\/\/.+)$/);
      if (match) registered.set(Number(match[1]), match[2]?.split(/ e (?=https?:)/) ?? []);
    }
    expect(registered.size).toBe(50);
    for (const [n, urls] of registered) {
      const source = dataset.sources.find(
        (s) => s.id === `WEB-EXT-${String(n + 4).padStart(3, "0")}`,
      );
      expect(source?.urls, `SRC-${n}`).toEqual(urls);
      expect(source?.cited_in).toEqual(["S09"]);
    }
  });

  it("adds hypotheses H23–H32 as open and unproven, never as relationships", () => {
    for (const id of range("H", 23, 32, 2)) {
      expect(dataset.hypotheses.find((h) => h.id === id)?.status).toBe("open_unproven");
    }
    expect(dataset.hypotheses.every((h) => h.status === "open_unproven")).toBe(true);
  });

  it("does not record the links Fonte_09 §8.3 forbids", () => {
    const forbidden: [string, string][] = [
      ["IRGC", "NONAME057"],
      ["GRU", "NONAME057"],
      ["RU", "EXT-010"],
      ["RU", "EXT-019"],
      ["RU", "EXT-012"],
      ["RU", "EXT-013"],
      ["IR", "EXT-006"],
      ["STORM", "EXT-020"],
      ["HAYI", "SHAHIDKAVEH"],
    ];
    for (const [a, b] of forbidden) {
      const found = dataset.relationships.some(
        (r) => (r.subject === a && r.object === b) || (r.subject === b && r.object === a),
      );
      expect(found, `${a} <-> ${b}`).toBe(false);
    }
  });

  it("gives every relationship about a named person a primary source", () => {
    const persons = new Set(dataset.entities.filter((e) => e.kind === "person").map((e) => e.id));
    const fonte09 = dataset.relationships.filter((r) => r.sources.includes("S09"));
    expect(fonte09.length).toBeGreaterThan(0);
    for (const r of fonte09) {
      if (persons.has(r.subject) || persons.has(r.object)) {
        expect(r.primary_url, r.id).not.toBeNull();
        expect(r.caveat?.it, r.id).toMatch(/presunzione di innocenza|impugnabile/);
      }
    }
  });
});
