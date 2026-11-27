import { beforeAll, describe, expect, it } from "vitest";
import { COLLECTION_NAMES, type Dataset } from "../src/model/index.ts";
import { canonicalCounts } from "../src/site/counts.ts";
import { CSV_BOM, parseCsv } from "../src/site/csv.ts";
import {
  buildManifest,
  type ExportFile,
  exportFiles,
  exportMetadataFiles,
} from "../src/site/exports.ts";
import { type MarkdownCollection, recordMarkdown } from "../src/site/markdown.ts";
import { verifyParity } from "../src/site/parity.ts";
import { type PublicationReport, publicationReport } from "../src/site/publication.ts";
import { buildReadModel, loadReadModel, type ReadModel } from "../src/site/read-model.ts";
import { leakedIds, withheldIdSet } from "../src/site/surface.ts";

let report: PublicationReport;
let pub: Dataset;
let model: ReadModel;
let files: ExportFile[];
let withheld: Set<string>;

const commit = {
  commit: "0123456789abcdef0123456789abcdef01234567",
  commit_date: "2026-11-15T07:52:02+01:00",
};

beforeAll(() => {
  report = publicationReport(loadReadModel().dataset);
  pub = report.dataset;
  model = buildReadModel(pub);
  files = exportFiles(report, commit, [], undefined, [], []);
  withheld = withheldIdSet(report.withheld, pub);
});

describe("PK-03 data contracts", () => {
  it("generates <file>.metadata.json for every exported file in data/v1/ with zero withheld IDs", () => {
    const manifest = buildManifest(report, files, commit);
    const metaFiles = exportMetadataFiles(files, manifest, commit);
    expect(metaFiles).toHaveLength(files.length + 1);

    for (const metaFile of metaFiles) {
      expect(metaFile.path.endsWith(".metadata.json")).toBe(true);
      const parsed = JSON.parse(metaFile.text) as Record<string, unknown>;
      expect(parsed.data_version).toBe("v1");
      expect(parsed.canonical_language).toBe("it");
      expect(parsed.snapshot).toEqual({
        commit: commit.commit,
        commit_date: commit.commit_date,
      });
      expect((parsed.license as { spdx?: string })?.spdx).toBe("CC0-1.0");
      expect(typeof parsed.usage_caveat).toBe("string");
      expect((parsed.usage_caveat as string).length).toBeGreaterThan(20);
      expect("schema" in parsed).toBe(true);
      expect(parsed.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(leakedIds(parsed, withheld), metaFile.path).toEqual([]);
    }

    const eventsMeta = JSON.parse(
      metaFiles.find((f) => f.path === "events.json.metadata.json")?.text ?? "{}",
    );
    expect(eventsMeta.schema).toBe("schemas/events.schema.json");
  });

  it("emits strict RFC 4180 CSV with no text before header row and essential caveats included", () => {
    const csvFiles = files.filter((f) => f.path.endsWith(".csv"));
    expect(csvFiles.length).toBe(5);

    for (const file of csvFiles) {
      const body = file.text.startsWith(CSV_BOM) ? file.text.slice(1) : file.text;
      const firstLine = body.split("\r\n")[0] ?? "";
      expect(firstLine.startsWith("#")).toBe(false);
      expect(firstLine.startsWith("id,")).toBe(true);
      expect(file.text.endsWith("\r\n")).toBe(true);

      const rows = parseCsv(file.text);
      const name = file.path.replace(/\.csv$/, "") as keyof Dataset;
      expect(rows).toHaveLength(pub[name].length);
    }

    const eventsRows = parseCsv(files.find((f) => f.path === "events.csv")?.text ?? "");
    expect(eventsRows[0]).toHaveProperty("known_issues_codes");
    expect(eventsRows[0]).toHaveProperty("evidence_note_it");
    expect(eventsRows[0]).toHaveProperty("review_status");
  });

  it("generates deterministic .md for every published record and strictly excludes withheld records", () => {
    const mdCollections: MarkdownCollection[] = [
      "events",
      "entities",
      "hypotheses",
      "sources",
      "exposures",
    ];
    for (const col of mdCollections) {
      for (const record of pub[col]) {
        const md1 = recordMarkdown(col, record.id, model);
        const md2 = recordMarkdown(col, record.id, model);
        expect(md1).not.toBeNull();
        expect(md1).toBe(md2);
        expect(md1).toContain(`id: "${record.id}"`);
        expect(md1).toContain("## Essential Caveat");
        for (const withheldId of withheld) {
          expect(md1).not.toContain(`"${withheldId}"`);
          expect(md1).not.toContain(`\`${withheldId}\``);
        }
      }
    }

    for (const w of report.withheld) {
      if (w.collection === "relationships") continue;
      if (!withheld.has(w.id)) continue;
      expect(recordMarkdown(w.collection, w.id, model), w.id).toBeNull();
    }
  });

  it("returns canonical counts and snapshot date matching the publication report", () => {
    const counts = canonicalCounts(report, commit);
    const totalPublished = COLLECTION_NAMES.reduce((sum, name) => sum + pub[name].length, 0);
    const totalWithheld = COLLECTION_NAMES.reduce((sum, name) => sum + report.counts[name], 0);

    expect(counts.total_published).toBe(totalPublished);
    expect(counts.total_withheld).toBe(totalWithheld);
    expect(counts.snapshot_date).toBe("2026-11-15");
    expect(counts.commit).toBe(commit.commit);
    for (const name of COLLECTION_NAMES) {
      expect(counts.published[name]).toBe(pub[name].length);
      expect(counts.withheld[name]).toBe(report.counts[name]);
    }
  });

  it("verifies 100% critical-field parity across JSON, CSV, .md, and optional HTML", () => {
    const sampleEvent = pub.events[0];
    if (!sampleEvent) throw new Error("missing sample event");
    const htmlByKey = new Map<string, string>([
      [
        `events/${sampleEvent.id}`,
        `<html><body>${sampleEvent.id} ${sampleEvent.sources.join(" ")}</body></html>`,
      ],
    ]);

    const parity = verifyParity(report, { files, model, htmlByKey });
    expect(parity.mismatches).toEqual([]);
    expect(parity.ok).toBe(true);
    expect(parity.checked_records).toBe(
      COLLECTION_NAMES.reduce((sum, name) => sum + pub[name].length, 0),
    );

    const badHtml = new Map<string, string>([
      [`events/${sampleEvent.id}`, "<html><body>missing id</body></html>"],
    ]);
    const failing = verifyParity(report, { files, model, htmlByKey: badHtml });
    expect(failing.ok).toBe(false);
    expect(failing.mismatches.some((m) => m.surface === "html")).toBe(true);
  });
});
