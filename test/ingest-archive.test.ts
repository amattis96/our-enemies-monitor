import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Dataset } from "../src/model/index.ts";
import { ProposalFile } from "../src/model/proposals.ts";
import { plannedFiles } from "../src/pipeline/ingest/apply.ts";
import {
  type Archive,
  archiveContext,
  checkArchive,
  compareSidecars,
  isIngested,
  readArchive,
} from "../src/pipeline/ingest/archive.ts";
import { type IngestContext, type IngestPlan, planIngest } from "../src/pipeline/ingest/plan.ts";
import { buildReport, renderReport } from "../src/pipeline/ingest/report.ts";
import { type DataFile, readDataFiles } from "../src/pipeline/load.ts";
import { repoPath } from "../src/pipeline/paths.ts";
import { validateDataFiles } from "../src/pipeline/validate.ts";
import { publishedDataset } from "../src/site/publication.ts";
import {
  event,
  FIXTURE,
  fixtureJson,
  freeIds,
  markdownOf,
  relationship,
  sidecarJson,
} from "./helpers/ingest.ts";

// Regression tests of block B04 (Fable B R9–R13, T6–T8): ingest order and
// gate, unforgeable markers, duplicates that carry new evidence, invalid
// archived sidecars, the archive check and the legacy Markdown URL filter.

let files: DataFile[];
let dataset: Dataset;

beforeAll(() => {
  files = readDataFiles();
  dataset = validateDataFiles(files).dataset;
});

const context = (extra: Partial<IngestContext> = {}): IngestContext => ({
  dataset,
  fileExists: () => true,
  ...extra,
});
const sidecar = (number: number, operations: unknown[], source: Record<string, unknown> = {}) =>
  ProposalFile.parse(sidecarJson(number, operations, source));
const outcome = (plan: IngestPlan, ref: string) => plan.operations.find((o) => o.ref === ref);
const afterPlan = (plan: IngestPlan, start: DataFile[] = files) => {
  const next = plannedFiles(plan, start);
  return { files: next, dataset: validateDataFiles(next).dataset };
};
const emptyArchive = (): Archive => ({ names: [], sidecars: [], invalid: [], markdown: new Map() });
const archiveOf = (...sidecars: ProposalFile[]): Archive => ({
  ...emptyArchive(),
  names: sidecars.map((s) => `Fonte_${s.source.code.slice(1)}.proposals.json`),
  sidecars: sidecars.map((s) => ({
    name: `Fonte_${s.source.code.slice(1)}.proposals.json`,
    path: `sources/incremental/Fonte_${s.source.code.slice(1)}.proposals.json`,
    proposals: s,
  })),
});
const keyed = (s: ProposalFile) => ({
  name: `Fonte_${s.source.code.slice(1)}.proposals.json`,
  path: `sources/incremental/Fonte_${s.source.code.slice(1)}.proposals.json`,
  proposals: s,
});

const URL_A = "https://example.org/sabotaggio-sintetico-a";
const sabotage = (ref: string, overrides: Record<string, unknown> = {}) =>
  event(ref, {
    url: URL_A,
    title: { it: "Sabotaggio sintetico di una sottostazione elettrica in Estonia" },
    ...overrides,
  });

/** A temporary directory with the given files. */
function directory(entries: Record<string, string>): string {
  const dir = mkdtempSync(path.join(tmpdir(), "oem-archive-"));
  for (const [name, text] of Object.entries(entries)) writeFileSync(path.join(dir, name), text);
  return dir;
}
const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

describe("extended archive numbering", () => {
  it("orders mixed versions numerically and blocks pending predecessors", () => {
    const s99 = ProposalFile.parse({ ...sidecarJson(99, []), schema_version: "1.0" });
    const s100 = sidecar(100, []);
    const s101 = sidecar(101, []);
    expect(
      [keyed(s101), keyed(s99), keyed(s100)]
        .sort(compareSidecars)
        .map((s) => s.proposals.source.code),
    ).toEqual(["S99", "S100", "S101"]);
    expect(archiveContext(keyed(s101), archiveOf(s101, s99, s100), dataset).pending).toEqual([
      "S99",
      "S100",
    ]);
  });
  it("recognizes S100 markers on rerun", () => {
    const proposals = sidecar(100, [sabotage("one")]);
    const first = planIngest(proposals, context());
    expect(first.fatal).toEqual([]);
    const again = planIngest(proposals, context({ dataset: afterPlan(first).dataset }));
    expect(outcome(again, "one")?.classification).toBe("already_applied");
    expect(again.writes).toEqual([]);
  });
});

describe("ingest order and gate (R9, T6)", () => {
  it("T-a1: an ingested earlier sidecar dedupes a later one through data/", () => {
    const s12 = sidecar(12, [sabotage("s12-ev")]);
    const s13 = sidecar(13, [sabotage("s13-ev")]);
    const [created] = freeIds(dataset, "EXT-", 3, 1);

    const before = archiveContext(keyed(s13), archiveOf(s12, s13), dataset);
    expect(before.pending).toEqual(["S12"]);

    const first = planIngest(
      s12,
      context(archiveContext(keyed(s12), archiveOf(s12, s13), dataset)),
    );
    expect(first.fatal).toEqual([]);
    expect(outcome(first, "s12-ev")).toMatchObject({ classification: "new", id: created });
    expect(first.attention).toContain("s12-ev: also proposed by S13 s13-ev");

    const ingested = afterPlan(first).dataset;
    expect(isIngested(s12, ingested)).toBe(true);
    const position = archiveContext(keyed(s13), archiveOf(s12, s13), ingested);
    expect(position.pending).toEqual([]);
    const second = planIngest(s13, context({ ...position, dataset: ingested }));
    expect(second.fatal).toEqual([]);
    expect(outcome(second, "s13-ev")).toMatchObject({ classification: "duplicate", id: created });
  });

  it("T-a2: refuses while an earlier archived sidecar is not ingested", () => {
    const s12 = sidecar(12, [sabotage("s12-ev")]);
    const s13 = sidecar(13, [sabotage("s13-ev", { url: "https://example.org/altro" })]);
    const plan = planIngest(s13, context(archiveContext(keyed(s13), archiveOf(s12, s13), dataset)));
    expect(plan.fatal).toEqual([
      "S12 precedes S13 in the archive and is not ingested: ingest S12 first",
    ]);
  });

  it("T-a2b: --skip-pending steps over one pending sidecar and records it", () => {
    const s12 = sidecar(12, [sabotage("s12-ev")]);
    const s13 = sidecar(13, [sabotage("s13-ev", { url: "https://example.org/altro" })]);
    const position = archiveContext(keyed(s13), archiveOf(s12, s13), dataset, [], ["S12", "S11"]);
    expect(position).toMatchObject({ pending: [], skipped: ["S12"], unusedSkips: ["S11"] });
    const plan = planIngest(s13, context(position));
    expect(plan.fatal).toEqual([]);
    const corpus = plan.writes.find((w) => w.id === "S13")?.record as {
      review: { notes: string[] };
    };
    expect(corpus.review.notes).toContain(
      "Ingested while S12 was pending, skipped by maintainer (--skip-pending).",
    );
  });

  it("T-a2c: another archived sidecar declaring the input's code blocks the run", () => {
    const s12 = sidecar(12, [sabotage("s12-ev")]);
    const archive = archiveOf(s12);
    const copy = { ...keyed(s12), name: "copy.proposals.json", path: "elsewhere/copy.json" };
    expect(archiveContext(keyed(s12), archive, dataset).sameCode).toEqual([]);
    const plan = planIngest(s12, context(archiveContext(copy, archive, dataset)));
    expect(plan.fatal).toEqual([
      "sources/incremental/Fonte_12.proposals.json also declares S12: fix the archive numbering (pnpm validate:sidecars)",
    ]);
  });

  it("orders sidecars by number, then date, then file name", () => {
    const at = (number: number, created_at: string, name: string) => ({
      name,
      proposals: sidecar(number, [], {
        created_at,
        coverage: { start: created_at, end: created_at },
      }),
    });
    const items = [
      at(13, "2026-11-01", "a.json"),
      at(12, "2026-11-15", "b.json"),
      at(12, "2026-11-14", "c.json"),
      at(12, "2026-11-14", "a.json"),
    ];
    const sorted = [...items]
      .sort(compareSidecars)
      .map((k) => [k.proposals.source.code, k.proposals.source.created_at, k.name]);
    expect(sorted).toEqual([
      ["S12", "2026-11-14", "a.json"],
      ["S12", "2026-11-14", "c.json"],
      ["S12", "2026-11-15", "b.json"],
      ["S13", "2026-11-01", "a.json"],
    ]);
    expect(compareSidecars(items[3] as (typeof items)[0], items[3] as (typeof items)[0])).toBe(0);
  });

  it("T-a3: the archive order does not depend on the directory listing", () => {
    const s12 = sidecarJson(12, [sabotage("s12-ev")]);
    const s13 = sidecarJson(13, [sabotage("s13-ev")]);
    const dir = directory({
      "Fonte_12.proposals.json": json(s12),
      "Fonte_13.proposals.json": json(s13),
      "Fonte_12_test.md": "# 12\n",
      "Fonte_13_test.md": "# 13\n",
    });
    try {
      const names = ["Fonte_13_test.md", "Fonte_13.proposals.json", "Fonte_12.proposals.json"];
      const forward = readArchive(dir, [...names, "Fonte_12_test.md"]);
      const backward = readArchive(dir, ["Fonte_12_test.md", ...names].reverse());
      expect(forward).toEqual(backward);
      expect(forward.sidecars.map((s) => s.proposals.source.code)).toEqual(["S12", "S13"]);
      const s14 = sidecar(14, [sabotage("s14-ev")]);
      const plan = (archive: Archive) =>
        planIngest(s14, context(archiveContext(keyed(s14), archive, dataset)));
      expect(plan(forward)).toEqual(plan(backward));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("T-a4: later sidecars and --compare files are attention only", () => {
    const s11 = sidecar(11, [sabotage("mine")]);
    const s12 = sidecar(12, [sabotage("theirs", { url: `${URL_A}/` })]);
    const open = sidecar(13, [sabotage("open-pr")]);
    const position = archiveContext(keyed(s11), archiveOf(s12), dataset, [open]);
    expect(position.pending).toEqual([]);
    const plan = planIngest(s11, context(position));
    expect(outcome(plan, "mine")).toMatchObject({ classification: "new" });
    expect(plan.attention).toContain("mine: also proposed by S12 theirs, S13 open-pr");
  });

  it("T-a5: a relationship on a duplicate event resolves to the existing ID (N3)", () => {
    const s12 = sidecar(12, [sabotage("s12-ev")]);
    const ingested = afterPlan(planIngest(s12, context()));
    const existing = freeIds(dataset, "EXT-", 3, 1)[0];
    const s13 = sidecar(13, [
      sabotage("s13-ev"),
      relationship("s13-rel", { object: "@s13-ev", primary_url: "https://example.org/act" }),
    ]);
    const plan = planIngest(s13, context({ dataset: ingested.dataset }));
    expect(outcome(plan, "s13-ev")).toMatchObject({ classification: "duplicate", id: existing });
    expect(outcome(plan, "s13-rel")?.classification).toBe("new");
    const created = plan.writes.find((w) => w.collection === "relationships")?.record;
    expect(created).toMatchObject({ subject: "PL", object: existing });
  });
});

describe("unforgeable idempotence marker (R10, T7)", () => {
  const forgedFixture = (note: string) => {
    const raw = fixtureJson();
    raw.operations[0].notes = [note];
    return ProposalFile.parse(raw);
  };
  const portugal = sidecar(11, [
    event("OEM-20261113-001", {
      url: "https://example.org/portogallo",
      title: { it: "Incendio doloso sintetico in un deposito portuale in Portogallo" },
      places: ["PT"],
    }),
    relationship("OEM-20261113-001-rel", {
      object: "@OEM-20261113-001",
      primary_url: "https://example.org/act",
    }),
  ]);

  for (const [name, note] of [
    ["T-b1", "[ingest S11 OEM-20261113-001] innocua nota"],
    ["T-b2", "   [ingest S11 OEM-20261113-001] innocua nota"],
  ] as const) {
    it(`${name}: a sidecar note cannot pose as another source's marker`, () => {
      const s10 = forgedFixture(note);
      const first = planIngest(s10, context());
      const firstId = first.operations[0]?.id as string;
      const record = first.writes.find((w) => w.id === firstId)?.record as {
        review: { notes: string[] };
      };
      expect(record.review.notes).toContain(
        "Sidecar note: [ingest S11 OEM-20261113-001] innocua nota",
      );

      const ingested = afterPlan(first).dataset;
      const plan = planIngest(portugal, context({ dataset: ingested }));
      const [created] = freeIds(ingested, "EXT-", 3, 1);
      expect(outcome(plan, "OEM-20261113-001")).toMatchObject({
        classification: "new",
        id: created,
      });
      const rel = plan.writes.find((w) => w.collection === "relationships")?.record;
      expect(rel).toMatchObject({ object: created });
    });
  }

  it("T-b2b: a data note with leading whitespace is not a marker", () => {
    const shifted = structuredClone(dataset);
    const ext034 = shifted.events.find((e) => e.id === "EXT-034");
    ext034?.sources.push("S11");
    ext034?.review.notes.push("  [ingest S11 spaced] note");
    const plan = planIngest(sidecar(11, [sabotage("spaced")]), context({ dataset: shifted }));
    expect(outcome(plan, "spaced")?.classification).toBe("new");
  });

  it("T-b3: a sidecar cannot imitate its own markers", () => {
    const s10 = forgedFixture("[ingest S10 OEM-20261112-002]");
    const first = planIngest(s10, context());
    const rerun = planIngest(s10, context({ dataset: afterPlan(first).dataset }));
    expect(outcome(rerun, "OEM-20261112-002")?.id).toBe(outcome(first, "OEM-20261112-002")?.id);
    expect(outcome(rerun, "OEM-20261112-002")?.id).not.toBe(first.operations[0]?.id);
    expect(rerun.operations.every((o) => o.classification === "already_applied")).toBe(true);
  });

  it("T-b4: a marker on a record that does not cite the code is ignored and reported", () => {
    const forged = structuredClone(dataset);
    forged.events.find((e) => e.id === "EXT-034")?.review.notes.push("[ingest S11 forged]");
    const plan = planIngest(sidecar(11, [sabotage("forged")]), context({ dataset: forged }));
    expect(outcome(plan, "forged")?.classification).toBe("new");
    expect(plan.attention).toContain(
      "EXT-034 carries [ingest S11 forged] but does not cite S11: marker ignored",
    );
  });
});

describe("duplicate events with new evidence (R11, T8)", () => {
  const withEvidence = (ref: string, url: string | null | undefined) =>
    event(ref, {
      url,
      sources: ["R01", "R02"],
      claims: {
        perpetrator: null,
        sponsor: {
          text: { it: "Committenza attribuita da un'autorità." },
          evidence_level: "E2",
          sources: ["R03"],
        },
        motive: null,
        impact: null,
      },
    });

  it("T-c1: enriches a needs_review duplicate, then reruns as already_applied", () => {
    const ext034 = dataset.events.find((e) => e.id === "EXT-034");
    expect(ext034?.review.status).toBe("needs_review");
    const s11 = sidecar(11, [withEvidence("c1", ext034?.url)]);
    const plan = planIngest(s11, context());
    expect(outcome(plan, "c1")).toMatchObject({ classification: "enrichment", id: "EXT-034" });
    const record = plan.writes.find((w) => w.id === "EXT-034")?.record as {
      sources: string[];
      review: { status: string; notes: string[] };
      description: unknown;
    };
    expect(record.review.status).toBe("needs_review");
    expect(record.description).toEqual(ext034?.description);
    expect(record.sources).toEqual(expect.arrayContaining([...(ext034?.sources ?? []), "S11"]));
    expect(record.sources.length).toBeGreaterThanOrEqual((ext034?.sources.length ?? 0) + 3);
    expect(
      record.review.notes.some((n) =>
        n.startsWith("[ingest S11 c1] c1 (S11). Duplicate of EXT-034"),
      ),
    ).toBe(true);
    expect(record.review.notes.some((n) => n.startsWith("Sponsor claim (E2;"))).toBe(true);
    expect(plan.attention.some((a) => a.startsWith("EXT-034: enriched by duplicate"))).toBe(true);
    expect(publishedDataset(afterPlan(plan).dataset)).toEqual(publishedDataset(dataset));

    const rerun = planIngest(s11, context({ dataset: afterPlan(plan).dataset }));
    expect(outcome(rerun, "c1")).toMatchObject({
      classification: "already_applied",
      id: "EXT-034",
    });
    expect(rerun.writes).toEqual([]);
  });

  it("T-c2: a published duplicate is a conflict listing the evidence not applied", () => {
    const ext001 = dataset.events.find((e) => e.id === "EXT-001");
    expect(ext001?.review.status).toBe("imported_unreviewed");
    const plan = planIngest(sidecar(11, [withEvidence("c2", ext001?.url)]), context());
    const result = outcome(plan, "c2");
    expect(result).toMatchObject({ classification: "conflict", id: "EXT-001" });
    expect(result?.unapplied?.target).toBe("EXT-001");
    expect(result?.unapplied?.citations.map((c) => c.split(" ")[0])).toEqual(["R01", "R02", "R03"]);
    expect(result?.unapplied?.claims).toEqual([
      "Sponsor (E2; R03): Committenza attribuita da un'autorità.",
    ]);
    expect(plan.writes.map((w) => w.id)).toEqual(["S11"]);
    expect(publishedDataset(afterPlan(plan).dataset)).toEqual(publishedDataset(dataset));
    const text = renderReport(buildReport(plan, [], "dry-run"));
    expect(text).toContain("Evidence not applied");
    expect(text).toContain("claim: Sponsor (E2; R03)");
  });
});

describe("no silent loss on matched events (review)", () => {
  it("a published duplicate carrying only contrary evidence is a conflict listing it", () => {
    const ext001 = dataset.events.find((e) => e.id === "EXT-001");
    const plan = planIngest(
      sidecar(12, [
        event("contrary", {
          url: ext001?.url,
          sources: ext001?.sources,
          title: { it: ext001?.title.it },
          description: { it: ext001?.description.it },
          themes: ext001?.themes,
          places: ext001?.places,
          date: ext001?.date,
          contrary_evidence: { it: "Una smentita ufficiale contesta la ricostruzione." },
        }),
        relationship("contrary-rel", {
          object: "@contrary",
          primary_url: "https://example.org/act",
        }),
      ]),
      context(),
    );
    const result = outcome(plan, "contrary");
    expect(result).toMatchObject({ classification: "conflict", id: "EXT-001" });
    expect(result?.unapplied).toEqual({
      target: "EXT-001",
      citations: [],
      claims: [],
      other: ["contrary evidence: Una smentita ufficiale contesta la ricostruzione."],
    });
    expect(plan.attention).toContain(
      "contrary: contrary-rel attach to EXT-001, whose new evidence from contrary was not applied",
    );
    const corpus = plan.writes.find((w) => w.id === "S12")?.record as {
      review: { notes: string[] };
    };
    expect(corpus.review.notes.at(-1)).toBe(
      "Ingest outcome: 1 new, 0 enrichment, 0 duplicate, 0 already_applied, 1 conflict, 0 rejected. " +
        `Evidence not applied: contrary → EXT-001. Conflicts: contrary → EXT-001.`,
    );
  });

  it("a needs_review duplicate with a differing description is enriched with a note, not changed", () => {
    const ext034 = dataset.events.find((e) => e.id === "EXT-034");
    const plan = planIngest(
      sidecar(12, [
        event("desc", { url: ext034?.url, sources: ["WEB-EXT-051"], notes: ["Nota."] }),
      ]),
      context(),
    );
    expect(outcome(plan, "desc")?.classification).toBe("enrichment");
    const record = plan.writes.find((w) => w.id === "EXT-034")?.record as {
      description: unknown;
      review: { notes: string[] };
    };
    expect(record.description).toEqual(ext034?.description);
    expect(record.review.notes).toContain(
      "Proposed by S12, not applied: description: Descrizione documentata.",
    );
    expect(record.review.notes).toContain("Sidecar note: Nota.");
  });

  it("a near-duplicate conflict lists everything the operation proposed", () => {
    const plan = planIngest(
      sidecar(12, [
        event("near", {
          title: { it: "Raid ucraino sul porto di Ust-Luga, con versioni divergenti" },
          date: { start: "2026-11-11", end: null, precision: "day" },
        }),
      ]),
      context(),
    );
    expect(outcome(plan, "near")?.unapplied).toEqual({
      target: "EXT-031",
      citations: [`R01 ${fixtureJson().references[0].url}`],
      claims: [],
      other: ["description: Descrizione documentata.", "themes: justice"],
    });
  });
});

describe("legacy Markdown URL filter (defect f)", () => {
  it("T-f1: a URL quoted only in a registered (ingested) Markdown is not a conflict", () => {
    const real = readArchive(repoPath("sources/incremental"));
    const s09 = [...real.markdown].find(([file]) => file.includes("Fonte_09_"))?.[1] ?? "";
    const eventUrls = new Set(dataset.events.map((e) => e.url));
    // A URL quoted in Fonte_09 that is not the URL of any event in data/.
    const url = [...s09.matchAll(/https:\/\/[^\s)>\]]+/g)]
      .map((m) => m[0])
      .find((u) => !eventUrls.has(u));
    expect(url).toBeDefined();
    const s12 = sidecar(12, [sabotage("f1", { url })]);
    const position = archiveContext(keyed(s12), real, dataset);
    expect([...position.legacyMarkdown.keys()].some((f) => f.includes("Fonte_09_"))).toBe(false);
    const plan = planIngest(s12, context(position));
    expect(outcome(plan, "f1")?.classification).toBe("new");
  });

  it("T-f2: a URL quoted in a Markdown without sidecar is a conflict with a clear reason", () => {
    const real = readArchive(repoPath("sources/incremental"));
    const [file, text] = [...real.markdown].find(([f]) => f.includes("Fonte_10_")) ?? ["", ""];
    const url = text.match(/https:\/\/[^\s)>\]]+/)?.[0] as string;
    const s12 = sidecar(12, [sabotage("f2", { url })]);
    const plan = planIngest(s12, context(archiveContext(keyed(s12), real, dataset)));
    expect(outcome(plan, "f2")?.classification).toBe("conflict");
    expect(outcome(plan, "f2")?.unapplied?.target).toBeNull();
    expect(outcome(plan, "f2")?.reasons[0]).toBe(
      `URL quoted in ${file} (Markdown without sidecar, not ingested): check whether the item is already described there`,
    );
  });
});

describe("archive check (R12, R13)", () => {
  const check = (entries: Record<string, string>) => {
    const dir = directory(entries);
    try {
      return checkArchive(readArchive(dir), dataset);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };
  const errors = (entries: Record<string, string>) =>
    check(entries)
      .filter((i) => i.severity === "error")
      .map((i) => `${path.basename(i.file)}: ${i.message}`);

  it("accepts a clean archive and lists the ingest queue as warnings", () => {
    const issues = check({
      "Fonte_12.proposals.json": json(sidecarJson(12, [sabotage("a")])),
      "Fonte_12_test.md": "# 12\n",
      "Fonte_13_test.md": "# 13\n",
    });
    expect(issues.filter((i) => i.severity === "error")).toEqual([]);
    expect(issues.map((i) => i.message)).toEqual([
      "Markdown source without a proposals sidecar",
      "S12 not yet ingested (position 1 of 1 in ingest order)",
    ]);
  });

  it("T-e1: names the file and field of an invalid sidecar", () => {
    expect(
      errors({
        "Fonte_12.proposals.json": json({ ...sidecarJson(12, []), schema_version: "1.2" }),
        "Fonte_13.proposals.json": "{ broken",
        "Fonte_12_test.md": "",
        "Fonte_13_test.md": "",
      }),
    ).toEqual([
      "Fonte_12.proposals.json: invalid proposals sidecar: schema_version: unsupported or missing version 1.2",
      expect.stringMatching(
        /^Fonte_13\.proposals\.json: invalid proposals sidecar: not valid JSON/,
      ),
    ]);
  });

  it("ignores non-source files but refuses misnamed sidecars and Fonte Markdown", () => {
    expect(errors({ "README.md": "# archive\n", "notes.txt": "" })).toEqual([]);
    const found = errors({ "fonte12.proposals.json": "{}", "Fonte_12.md": "" });
    expect(found).toContain("Fonte_12.md: Markdown name must be Fonte_NN_<title>.md");
    expect(found).toContain("fonte12.proposals.json: sidecar name must be Fonte_NN.proposals.json");
  });

  it("T-r13a: one Markdown per Fonte number", () => {
    expect(errors({ "Fonte_12_a_2026-11-14.md": "", "Fonte_12_b_2026-11-15.md": "" })).toEqual([
      "Fonte_12_a_2026-11-14.md: Fonte_12 is used by 2 Markdown sources: sources/incremental/Fonte_12_a_2026-11-14.md, sources/incremental/Fonte_12_b_2026-11-15.md",
      "Fonte_12_b_2026-11-15.md: Fonte_12 is used by 2 Markdown sources: sources/incremental/Fonte_12_a_2026-11-14.md, sources/incremental/Fonte_12_b_2026-11-15.md",
    ]);
  });

  it("T-r13b: code and file are unique and match the sidecar name", () => {
    const s12 = json(sidecarJson(12, []));
    const found = errors({
      "Fonte_12.proposals.json": s12,
      "Fonte_13.proposals.json": s12,
      "Fonte_12_test.md": "",
      "Fonte_13_test.md": "",
    });
    expect(found).toContain(
      "Fonte_13.proposals.json: source.code S12 does not match the file name Fonte_13.proposals.json",
    );
    expect(found).toContain("Fonte_12.proposals.json: S12 is declared by 2 sidecars");
    expect(found).toContain(`Fonte_13.proposals.json: ${markdownOf(12)} is declared by 2 sidecars`);
  });

  it("T-r13c: accepts Fonte_100 and rejects noncanonical aliases", () => {
    expect(errors({ "Fonte_100_x.md": "" })).toEqual([]);
    expect(errors({ "Fonte_099_x.md": "" })).toEqual([
      "Fonte_099_x.md: Fonte_099: source numbers must have two digits or be 100–999",
    ]);
  });

  it("refuses a code registered in data/sources for another file, and a missing Markdown", () => {
    const s09 = sidecarJson(9, [], { file: "sources/incremental/Fonte_09_altro.md" });
    expect(errors({ "Fonte_09.proposals.json": json(s09) })).toEqual([
      "Fonte_09.proposals.json: source.file sources/incremental/Fonte_09_altro.md is not in sources/incremental/",
      expect.stringMatching(
        /^Fonte_09\.proposals\.json: S09 is already registered in data\/sources for /,
      ),
    ]);
  });
});

describe("CLI: archive order, invalid sidecars and pnpm validate:sidecars (R9, R12)", () => {
  let root: string;
  const incremental = () => path.join(root, "sources", "incremental");
  /** The real archive plus `entries` (data/sources registers the real Markdown). */
  const setArchive = (entries: Record<string, string>) => {
    rmSync(incremental(), { recursive: true, force: true });
    cpSync(repoPath("sources/incremental"), incremental(), { recursive: true });
    for (const [name, text] of Object.entries(entries))
      writeFileSync(path.join(incremental(), name), text);
  };
  const env = () => ({ ...process.env, OEM_REPO_ROOT: root });
  const ingest = (input: string, ...args: string[]) =>
    spawnSync(process.execPath, [repoPath("src/cli/ingest.ts"), input, ...args], {
      env: env(),
      encoding: "utf8",
    });
  const validateSidecars = (repo?: string) =>
    spawnSync(process.execPath, [repoPath("src/cli/validate-sidecars.ts")], {
      env: repo ? { ...process.env, OEM_REPO_ROOT: repo } : env(),
      encoding: "utf8",
    });
  const fixtureMarkdown = () => path.basename(ProposalFile.parse(fixtureJson()).source.file);

  beforeAll(() => {
    root = mkdtempSync(path.join(tmpdir(), "oem-ingest-archive-"));
    mkdirSync(path.join(root, "sources"), { recursive: true });
    mkdirSync(path.join(root, "docs", "audit"), { recursive: true });
    cpSync(
      repoPath("docs/audit/M5_2026-11-12.json"),
      path.join(root, "docs/audit/M5_2026-11-12.json"),
    );
    symlinkSync(repoPath("sources/original"), path.join(root, "sources", "original"));
    cpSync(repoPath("data"), path.join(root, "data"), { recursive: true });
  });
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it("T-a2 (CLI): exits 1 and writes nothing while an earlier sidecar is pending", () => {
    setArchive({
      "Fonte_12.proposals.json": json(sidecarJson(12, [sabotage("s12-ev")])),
      "Fonte_12_test.md": "# 12\n",
      "Fonte_13.proposals.json": json(sidecarJson(13, [sabotage("s13-ev")])),
      "Fonte_13_test.md": "# 13\n",
    });
    const run = ingest(path.join(incremental(), "Fonte_13.proposals.json"), "--write", "--json");
    expect(run.status).toBe(1);
    const report = JSON.parse(run.stdout);
    expect(report.fatal).toEqual([
      "S12 precedes S13 in the archive and is not ingested: ingest S12 first",
    ]);
    expect(report.written).toEqual([]);
  }, 60_000);

  it("T-a2b (CLI): --skip-pending S12 lets S13 through with a warning", () => {
    setArchive({
      "Fonte_12.proposals.json": json(sidecarJson(12, [sabotage("s12-ev")])),
      "Fonte_12_test.md": "# 12\n",
      "Fonte_13.proposals.json": json(sidecarJson(13, [sabotage("s13-ev")])),
      "Fonte_13_test.md": "# 13\n",
    });
    const input = path.join(incremental(), "Fonte_13.proposals.json");
    const run = ingest(input, "--json", "--skip-pending", "S12");
    expect(run.status).toBe(0);
    const report = JSON.parse(run.stdout);
    expect(report.fatal).toEqual([]);
    expect(report.warnings).toEqual([
      "S12 is pending and was skipped by the maintainer (--skip-pending S12)",
    ]);
    expect(ingest(input, "--skip-pending", "12").status).toBe(1);
  }, 60_000);

  it("T-d1 (CLI): invalid other sidecars are warnings, not a stop", () => {
    setArchive({
      [fixtureMarkdown()]: "# Fonte_10 placeholder for tests\n",
      "Fonte_12.proposals.json": json({ ...sidecarJson(12, []), schema_version: "1.2" }),
      "Fonte_13.proposals.json": "{ broken",
    });
    const run = ingest(repoPath(FIXTURE), "--json");
    expect(run.status).toBe(0);
    const warnings = JSON.parse(run.stdout).warnings as string[];
    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toContain("sources/incremental/Fonte_12.proposals.json");
    expect(warnings[0]).toContain("schema_version:");
    expect(warnings[1]).toContain("sources/incremental/Fonte_13.proposals.json");
    expect(warnings[1]).toContain("not valid JSON");
  }, 60_000);

  it("T-d2 (CLI): a broken input sidecar exits 1 with a readable message", () => {
    setArchive({ "Fonte_12.proposals.json": "{ broken", "Fonte_12_test.md": "" });
    const run = ingest(path.join(incremental(), "Fonte_12.proposals.json"));
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("invalid proposals sidecar");
    expect(run.stderr).toContain("not valid JSON");
    expect(run.stderr).not.toMatch(/\n\s+at /);
  }, 60_000);

  it("T-e1 (CLI): validate:sidecars fails on an invalid archived sidecar", () => {
    setArchive({
      "Fonte_12.proposals.json": json({ ...sidecarJson(12, []), schema_version: "1.2" }),
      "Fonte_12_test.md": "",
    });
    const run = validateSidecars();
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("sources/incremental/Fonte_12.proposals.json");
    expect(run.stderr).toContain("schema_version");
  }, 60_000);

  it("T-e2 (CLI): validate:sidecars passes on the repository archive", () => {
    const run = validateSidecars(path.resolve(repoPath(".")));
    expect(run.stderr).not.toContain("error ");
    expect(run.status).toBe(0);
  }, 60_000);
});
