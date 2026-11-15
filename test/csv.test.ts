import { beforeAll, describe, expect, it } from "vitest";
import type { Dataset } from "../src/model/index.ts";
import {
  CSV_BOM,
  CSV_ID_COLUMNS,
  collectionCsvs,
  csvCell,
  exportFileName,
  pageRelationshipsCsv,
  parseCsv,
  toCsv,
} from "../src/site/csv.ts";
import { buildManifest, type ExportFile, exportFiles } from "../src/site/exports.ts";
import { type PublicationReport, publicationReport } from "../src/site/publication.ts";
import { loadReadModel } from "../src/site/read-model.ts";
import { leakedIds, leakedInCsv, withheldIdSet } from "../src/site/surface.ts";

let report: PublicationReport;
let pub: Dataset;
let files: ExportFile[];

beforeAll(() => {
  report = publicationReport(loadReadModel().dataset);
  pub = report.dataset;
  files = exportFiles(report);
});

describe("CSV writer", () => {
  it("quotes separators, quotes and line breaks", () => {
    expect(csvCell('a "b", c')).toBe('"a ""b"", c"');
    expect(csvCell("riga\nnuova")).toBe('"riga\nnuova"');
    expect(csvCell(null)).toBe("");
    expect(csvCell(["S01", "S06"])).toBe("S01;S06");
    expect(csvCell(false)).toBe("false");
  });

  it("neutralises cells a spreadsheet would run as formulas", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("@cmd")).toBe("'@cmd");
    expect(csvCell("-12")).toBe("-12");
  });

  it("writes a BOM, a header and CRLF rows that read back unchanged", () => {
    const rows = [{ id: "A", text: 'virgola, "citazione"\nriga' }];
    const text = toCsv(
      [
        { name: "id", value: (r: (typeof rows)[number]) => r.id },
        { name: "text", value: (r: (typeof rows)[number]) => r.text },
      ],
      rows,
    );
    expect(text.startsWith(CSV_BOM)).toBe(true);
    expect(text.endsWith("\r\n")).toBe(true);
    expect(parseCsv(text)).toEqual(rows);
  });

  it("names view exports by view and language", () => {
    expect(exportFileName("timeline", "it", "csv")).toBe("oem-timeline-it.csv");
  });
});

describe("collection CSVs of the public projection", () => {
  it("publish one row per public record, with the manifest hashing each file", () => {
    const csv = files.filter((f) => f.path.endsWith(".csv"));
    expect(csv.map((f) => f.path).sort()).toEqual([
      "entities.csv",
      "events.csv",
      "hypotheses.csv",
      "relationships.csv",
      "sources.csv",
    ]);
    for (const file of csv) {
      const name = file.path.replace(/\.csv$/, "") as keyof Dataset;
      const rows = parseCsv(file.text);
      expect(rows.map((r) => r.id)).toEqual(pub[name].map((r) => r.id));
    }
    const manifest = buildManifest(report, files);
    expect(manifest.files.map((f) => f.path)).toEqual(expect.arrayContaining(["events.csv"]));
  });

  it("never carry a withheld ID in an ID column", () => {
    const withheld = withheldIdSet(report.withheld, pub);
    for (const file of files.filter((f) => f.path.endsWith(".csv"))) {
      expect(leakedInCsv(file.text, withheld), file.path).toEqual([]);
    }
    const [id] = [...withheld];
    if (!id) throw new Error("empty withheld registry");
    expect(leakedInCsv(`id,events\r\nX,A;${id}\r\n`, withheld)).toEqual([id]);
    expect(leakedInCsv(`id,title_it\r\nX,${id}\r\n`, withheld)).toEqual([]);
    expect(CSV_ID_COLUMNS.has("subject")).toBe(true);
    expect(leakedIds({ subject: id }, withheld)).toEqual([id]);
  });

  it("withhold the predicate and caveat of a restricted relationship", () => {
    const [first] = pub.relationships;
    if (!first) throw new Error("no relationship");
    const rows = parseCsv(
      collectionCsvs(pub, (id) => id === first.id).find((f) => f.path === "relationships.csv")
        ?.text ?? "",
    );
    const row = rows.find((r) => r.id === first.id);
    expect(row?.restricted).toBe("true");
    expect(row?.predicate).toBe("");
    expect(row?.caveat_it).toBe("");
    expect(rows.find((r) => r.id !== first.id)?.restricted).toBe("false");
  });
});

describe("record page relationship CSV", () => {
  it("lists the page rows and hides a restricted predicate", () => {
    const rels = pub.relationships.slice(0, 2);
    const [first] = rels;
    if (!first) throw new Error("no relationship");
    const text = pageRelationshipsCsv(rels, "en", {
      name: (id) => `name ${id}`,
      url: (id) => `https://example.org/${id}/`,
      restricted: (r) => r.id === first.id,
    });
    const rows = parseCsv(text);
    expect(rows.map((r) => r.id)).toEqual(rels.map((r) => r.id));
    expect(rows[0]?.predicate).toBe("");
    expect(rows[0]?.primary_url).toBe("");
    expect(rows[1]?.predicate).toBe(rels[1]?.predicate);
    expect(rows[0]?.subject_name).toBe(`name ${first.subject}`);
  });
});
