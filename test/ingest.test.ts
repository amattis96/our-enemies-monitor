import { execFileSync, spawnSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import type { Dataset } from "../src/model/index.ts";
import { ProposalFile } from "../src/model/proposals.ts";
import { applyPlan, checkPlan, plannedFiles } from "../src/pipeline/ingest/apply.ts";
import {
  type ArchiveContext,
  archiveContext,
  readArchive,
} from "../src/pipeline/ingest/archive.ts";
import {
  type IngestContext,
  type IngestPlan,
  nextId,
  planIngest,
} from "../src/pipeline/ingest/plan.ts";
import { type DataFile, readDataFiles } from "../src/pipeline/load.ts";
import { REPO_ROOT, repoPath } from "../src/pipeline/paths.ts";
import { serializeRecord } from "../src/pipeline/serialize.ts";
import { validateDataFiles } from "../src/pipeline/validate.ts";
import { publishedDataset } from "../src/site/publication.ts";
import { base, event, FIXTURE, fixtureJson, freeIds, relationship } from "./helpers/ingest.ts";

let files: DataFile[];
let dataset: Dataset;
let fonte10: ProposalFile;
/** Position of the fixture in the real archive, as the CLI computes it. */
let fixturePosition: ArchiveContext;

beforeAll(() => {
  files = readDataFiles();
  dataset = validateDataFiles(files).dataset;
  fonte10 = ProposalFile.parse(fixtureJson());
  fixturePosition = archiveContext(
    { name: "Fonte_10.proposals.json", path: FIXTURE, proposals: fonte10 },
    readArchive(repoPath("sources/incremental")),
    dataset,
  );
});

const context = (extra: Partial<IngestContext> = {}): IngestContext => ({
  dataset,
  fileExists: () => true,
  ...extra,
});

const outcome = (plan: IngestPlan, ref: string) => plan.operations.find((o) => o.ref === ref);
const afterPlan = (plan: IngestPlan, start = files) =>
  validateDataFiles(plannedFiles(plan, start)).dataset;

function firstRecord<T>(records: T[]): T {
  const record = records[0];
  if (record === undefined) throw new Error("Expected a non-empty dataset collection");
  return record;
}

/** A minimal sidecar around synthetic operations. */
function sidecar(operations: unknown[], references: unknown[] = []): ProposalFile {
  const json = fixtureJson();
  return ProposalFile.parse({
    ...json,
    source: {
      ...json.source,
      code: "S11",
      file: "sources/incremental/Fonte_11_test.md",
    },
    references: [...json.references, ...references],
    operations,
  });
}

describe("proposals contract", () => {
  it("enforces versioned ID boundaries and exact source filenames", () => {
    const legacy = fixtureJson();
    const source = {
      ...legacy.source,
      code: "S100",
      file: "sources/incremental/Fonte_100_test.md",
      baseline_source: "S100",
    };
    const current = { ...legacy, schema_version: "1.1", source, operations: [] };
    expect(ProposalFile.safeParse(current).success).toBe(true);
    expect(ProposalFile.safeParse({ ...current, schema_version: "1.0" }).success).toBe(false);
    for (const version of ["1.2", "2.0", undefined])
      expect(ProposalFile.safeParse({ ...current, schema_version: version }).success).toBe(false);
    for (const code of ["S001", "S099", "S1000"])
      expect(ProposalFile.safeParse({ ...current, source: { ...source, code } }).success).toBe(
        false,
      );
    for (const file of [
      "sources/incremental/Fonte_099_test.md",
      "sources/incremental/Fonte_1000_test.md",
      "sources/incremental/Fonte_100test.md",
    ])
      expect(ProposalFile.safeParse({ ...current, source: { ...source, file } }).success).toBe(
        false,
      );
    expect(
      ProposalFile.safeParse({
        ...legacy,
        source: { ...legacy.source, file: "sources/incremental/Fonte_100_test.md" },
      }).success,
    ).toBe(false);
    const citation = {
      ...base,
      op: "add_citation",
      ref: "a",
      item: "a",
      evidence_level: "E1",
      target: "H100",
      note: { it: "Nota" },
      sources: ["S100"],
    };
    expect(ProposalFile.safeParse({ ...current, operations: [citation] }).success).toBe(true);
    expect(ProposalFile.safeParse({ ...legacy, operations: [citation] }).success).toBe(false);
    for (const id of ["H099", "H1000"])
      expect(
        ProposalFile.safeParse({ ...current, operations: [{ ...citation, target: id }] }).success,
      ).toBe(false);
  });

  it("keeps each extended typed reference out of 1.0 while accepting it in 1.1", () => {
    const legacy = fixtureJson();
    const citation = {
      ...base,
      op: "add_citation",
      ref: "a",
      item: "a",
      evidence_level: "E1",
      target: "H01",
      note: { it: "Nota" },
      sources: ["S09"],
    };
    const shell = { ...legacy, operations: [citation] };
    const cases = [
      { ...shell, operations: [{ ...citation, target: "H100" }] },
      { ...shell, operations: [{ ...citation, sources: ["S100"] }] },
      { ...shell, source: { ...legacy.source, baseline_source: "S100" } },
    ];
    for (const proposal of cases) {
      expect(ProposalFile.safeParse({ ...proposal, schema_version: "1.0" }).success).toBe(false);
      expect(ProposalFile.safeParse({ ...proposal, schema_version: "1.1" }).success).toBe(true);
    }
  });

  it("allocates hypotheses through 999 and reports exhaustion without partial writes", () => {
    for (const [last, next] of [
      ["H32", "H33"],
      ["H98", "H99"],
      ["H99", "H100"],
      ["H998", "H999"],
    ] as const)
      expect(nextId([last], "H", 2, 3)).toBe(next);
    for (const [id, prefix, width] of [
      ["H999", "H", 2],
      ["EXT-999", "EXT-", 3],
      ["WEB-EXT-999", "WEB-EXT-", 3],
      ["G-9999", "G-", 4],
    ] as const)
      expect(() => nextId([id], prefix, width, prefix === "H" ? 3 : width)).toThrow("exhausted");
    const copy = structuredClone(dataset);
    copy.events.push({ ...firstRecord(copy.events), id: "EXT-999" });
    const before = JSON.stringify(copy);
    const plan = planIngest(sidecar([event("first"), event("later")]), context({ dataset: copy }));
    expect(plan.fatal.join(" ")).toContain("EXT-999 exhausted");
    expect(plan.fatal.join(" ")).toContain("first");
    expect(plan.fatal.join(" ")).toContain("later");
    expect(plan.writes).toEqual([]);
    expect(JSON.stringify(copy)).toBe(before);
  });

  it("makes each namespace exhaustion fatal after prior operations", () => {
    const hypothesis = {
      op: "create_hypothesis",
      ref: "last",
      item: "last",
      ...base,
      sources: ["S09"],
      evidence_level: "E5",
      subject: "PL",
      object: "RU",
      hypothesis_type: "UNIQUE_SYNTHETIC_TYPE",
      question: { it: "Domanda nuova?" },
      current_limit: { it: "Limite." },
      evidence_needed: { it: "Prova." },
      priority: null,
      events: [],
      external_url: null,
    };
    const cases = [
      { collection: "hypotheses", id: "H999", op: hypothesis },
      {
        collection: "relationships",
        id: "G-9999",
        op: relationship("last", { sources: ["S09"], predicate: "SYNTHETIC_EXHAUSTION_TEST" }),
      },
      {
        collection: "sources",
        id: "WEB-EXT-999",
        op: event("last", { sources: ["R01"], title: { it: "Secondo evento unico" } }),
      },
    ] as const;
    for (const test of cases) {
      const copy = structuredClone(dataset);
      if (test.collection === "hypotheses")
        copy.hypotheses.push({ ...firstRecord(copy.hypotheses), id: test.id });
      if (test.collection === "relationships")
        copy.relationships.push({ ...firstRecord(copy.relationships), id: test.id });
      if (test.collection === "sources")
        copy.sources.push({ ...firstRecord(copy.sources), id: test.id });
      const plan = planIngest(
        sidecar([event("prior", { sources: ["S09"] }), test.op, event("remaining")]),
        context({ dataset: copy }),
      );
      expect(plan.fatal.join(" ")).toContain(`${test.id} exhausted`);
      expect(plan.fatal.join(" ")).toContain("last");
      expect(plan.fatal.join(" ")).toContain("remaining");
      expect(plan.writes).toEqual([]);
      expect(() => applyPlan(plan)).toThrow("blocked plan");
    }
  });

  it("accepts the hand-authored Fonte_10 fixture", () => {
    expect(fonte10.operations).toHaveLength(10);
    expect(fonte10.source.code).toBe("S10");
  });

  it("rejects E5 outside create_hypothesis, pointing at data/hypotheses", () => {
    for (const operation of [
      event("X", { evidence_level: "E5" }),
      relationship("X", { evidence_level: "E5" }),
      event("X", {
        claims: {
          perpetrator: null,
          sponsor: { text: { it: "Forse." }, evidence_level: "E5", sources: ["R01"] },
          motive: null,
          impact: null,
        },
      }),
    ]) {
      const parsed = ProposalFile.safeParse({ ...fixtureJson(), operations: [operation] });
      expect(parsed.success).toBe(false);
      expect(parsed.error?.issues.some((i) => i.message.includes("create_hypothesis"))).toBe(true);
    }
  });

  it("rejects undeclared references, forward @refs, persons without relevance and code mismatches", () => {
    const bad = (operations: unknown[], source?: Record<string, unknown>) =>
      ProposalFile.safeParse({
        ...fixtureJson(),
        source: { ...fixtureJson().source, ...source },
        operations,
      }).success;
    expect(bad([event("A", { sources: ["R99"] })])).toBe(false);
    expect(bad([relationship("B", { object: "@A" }), event("A")])).toBe(false);
    expect(
      bad([
        {
          op: "create_entity",
          ref: "P",
          item: "P",
          ...base,
          evidence_level: "E1",
          id: "SOMEONE",
          kind: "person",
          name: { it: "Una Persona" },
          aliases: [],
          domain: "persons",
          country: null,
          public_relevance: null,
        },
      ]),
    ).toBe(false);
    expect(bad([], { code: "S12" })).toBe(false);
    expect(bad([event("A"), relationship("B", { object: "@A" })])).toBe(true);
  });
});

describe("documented contract example", () => {
  it("validates the sidecar example in docs/M6_CHATGPT_OSINT_WORKFLOW.md", () => {
    const doc = readFileSync(repoPath("docs/M6_CHATGPT_OSINT_WORKFLOW.md"), "utf8");
    const example = doc.slice(doc.indexOf("### 4.7 Example")).match(/```json\n([\s\S]*?)```/)?.[1];
    const parsed = ProposalFile.safeParse(JSON.parse(example ?? "null"));
    expect(parsed.error?.issues ?? []).toEqual([]);
  });
});

/** Expected classification of the fixture against a dataset, with computed IDs. */
function expectedFixture(ds: Dataset) {
  const [e1, e2, e3, e6] = freeIds(ds, "EXT-", 3, 4);
  const [g1] = freeIds(ds, "G-", 4, 1);
  return [
    ["OEM-20261112-001", "new", e1],
    ["OEM-20261112-001-prokuratura", "new", "PL_PROKURATURA"],
    ["OEM-20261112-001-addebiti", "new", g1],
    ["OEM-20261112-002", "new", e2],
    ["OEM-20261112-003", "new", e3],
    ["OEM-20261112-003-h32", "enrichment", "H32"],
    ["OEM-20261112-005-ext022", "enrichment", "EXT-022"],
    ["OEM-20261112-005-ext032", "enrichment", "EXT-032"],
    ["OEM-20261112-006", "new", e6],
    ["OEM-20261112-007", "enrichment", "EXT-029"],
  ];
}

describe("Fonte_10 fixture dry run", () => {
  let plan: IngestPlan;
  let firstEvent: string;
  beforeAll(() => {
    plan = planIngest(fonte10, context(fixturePosition));
    firstEvent = freeIds(dataset, "EXT-", 3, 1)[0] as string;
  });

  it("classifies every operation and allocates the next free IDs", () => {
    expect(plan.fatal).toEqual([]);
    expect(plan.operations.map((o) => [o.ref, o.classification, o.id])).toEqual(
      expectedFixture(dataset),
    );
  });

  it("allocates computed IDs after a dataset that already holds the next event ID (N2)", () => {
    const shifted = structuredClone(dataset);
    const template = shifted.events.find((e) => e.id === "EXT-034");
    shifted.events.push({
      ...structuredClone(template),
      id: firstEvent,
      url: null,
      title: { it: "Evento segnaposto già ingerito da una fonte precedente" },
    } as (typeof shifted.events)[number]);
    const shiftedPlan = planIngest(fonte10, context({ ...fixturePosition, dataset: shifted }));
    expect(shiftedPlan.operations.map((o) => [o.ref, o.classification, o.id])).toEqual(
      expectedFixture(shifted),
    );
    expect(shiftedPlan.operations[0]?.id).not.toBe(firstEvent);
  });

  it("writes only needs_review candidates with empty provenance", () => {
    for (const write of plan.writes.filter((w) => w.action === "create")) {
      const record = write.record as { review: { status: string }; provenance: unknown[] };
      expect(record.review.status, write.id).toBe("needs_review");
      expect(record.provenance, write.id).toEqual([]);
    }
    const updated = plan.writes.filter((w) => w.action === "update").map((w) => w.id);
    expect(updated).toEqual(["EXT-022", "EXT-029", "EXT-032", "H32", "WEB-EXT-045"]);
  });

  it("reuses an existing source by URL instead of duplicating it", () => {
    const ext029 = plan.writes.find((w) => w.id === "EXT-029")?.record as { sources: string[] };
    expect(ext029.sources).toContain("WEB-EXT-045");
    expect(
      plan.writes.filter((w) => w.collection === "sources" && w.action === "create"),
    ).toHaveLength(11);
  });

  it("keeps perpetrator, sponsor and motive out of the event description", () => {
    const ext035 = plan.writes.find((w) => w.id === firstEvent)?.record as {
      description: { it: string };
      evidence_level: string;
      review: { notes: string[] };
    };
    expect(ext035.evidence_level).toBe("E1");
    expect(ext035.description.it).not.toContain("committenza");
    expect(ext035.review.notes.some((n) => n.startsWith("Sponsor claim (E2;"))).toBe(true);
    expect(ext035.review.notes.some((n) => n.startsWith("Perpetrator claim (E4;"))).toBe(true);
  });

  it("does not apply corrections: EXT-022 keeps its text and gains a note", () => {
    const before = dataset.events.find((e) => e.id === "EXT-022");
    const after = plan.writes.find((w) => w.id === "EXT-022")?.record as typeof before;
    expect(after?.description).toEqual(before?.description);
    expect(after?.review.notes.at(-1)).toContain("Correction proposed");
    expect(plan.attention).toContain('EXT-022: correction of "description" awaits an editor');
  });

  it("validates after the Fonte_10 Markdown source has been merged", () => {
    const errors = checkPlan(plan, files).filter((i) => i.severity === "error");
    expect(errors).toEqual([]);
  });

  it("leaves the public projection unchanged (M5 gate withholds every candidate)", () => {
    expect(publishedDataset(afterPlan(plan))).toEqual(publishedDataset(dataset));
  });

  it("is idempotent: a second run is all already_applied with no writes", () => {
    const second = planIngest(fonte10, context({ ...fixturePosition, dataset: afterPlan(plan) }));
    expect(second.operations.every((o) => o.classification === "already_applied")).toBe(true);
    expect(second.writes).toEqual([]);
  });

  it("is blocked until the Markdown source is in the repository", () => {
    const blocked = planIngest(fonte10, context({ ...fixturePosition, fileExists: () => false }));
    expect(blocked.fatal[0]).toContain("merge the Markdown source");
  });
});

describe("reconciliation edge cases", () => {
  it("detects duplicates: same event URL, already cited sources, same edge (T-c3)", () => {
    const ext034 = dataset.events.find((e) => e.id === "EXT-034");
    const plan = planIngest(
      sidecar([
        event("dup-url", {
          url: ext034?.url,
          sources: ["WEB-EXT-051"],
          description: { it: ext034?.description.it },
          themes: ext034?.themes,
          places: ext034?.places,
        }),
        {
          op: "add_citation",
          ref: "dup-cite",
          item: "dup-cite",
          sources: ["R14"],
          notes: [],
          evidence_level: "E2",
          target: "EXT-029",
          note: { it: "Già citata." },
        },
        relationship("dup-edge", {
          subject: "EBRD",
          predicate: "ANNUNCIA_IMPEGNI_PER",
          object: "EXT-028",
          relation_class: "policy",
          primary_url: "https://www.ebrd.com/",
        }),
      ]),
      context(),
    );
    expect(plan.operations.map((o) => [o.classification, o.id])).toEqual([
      ["duplicate", "EXT-034"],
      ["duplicate", "EXT-029"],
      ["duplicate", "G-0460"],
    ]);
    expect(plan.writes.map((w) => w.id)).toEqual(["S11"]);
  });

  it("flags conflicts instead of overwriting", () => {
    const ext031 = dataset.events.find((e) => e.id === "EXT-031");
    const plan = planIngest(
      sidecar([
        {
          op: "create_entity",
          ref: "taken",
          item: "taken",
          ...base,
          evidence_level: "E1",
          id: "RU",
          kind: "organization",
          name: { it: "Una organizzazione omonima" },
          aliases: [],
          domain: "geopolitics",
          country: null,
          public_relevance: null,
        },
        event("similar", {
          title: { it: `${ext031?.title.it} e nuove dichiarazioni` },
          date: ext031?.date,
          sources: ext031?.sources.filter((id) => id.startsWith("WEB-EXT-")),
          description: { it: ext031?.description.it },
          themes: ext031?.themes,
          places: ext031?.places,
        }),
        {
          op: "add_citation",
          ref: "published",
          item: "published",
          ...base,
          evidence_level: "E1",
          target: "TL-0001",
          note: { it: "Nuova fonte." },
        },
        {
          op: "propose_correction",
          ref: "stale",
          item: "stale",
          ...base,
          evidence_level: "E1",
          target: "EXT-022",
          field: "description",
          observed: { it: "un passaggio che non esiste" },
          proposed: { it: "Testo." },
          rationale: { it: "Motivo." },
        },
        relationship("depends", { subject: "@taken" }),
      ]),
      context(),
    );
    expect(plan.operations.map((o) => o.classification)).toEqual([
      "conflict",
      "duplicate",
      "conflict",
      "conflict",
      "rejected",
    ]);
    expect(outcome(plan, "taken")?.reasons[0]).toContain("taken by");
    expect(outcome(plan, "published")?.reasons[0]).toContain("imported_unreviewed");
    expect(outcome(plan, "depends")?.reasons[0]).toContain("@taken");
    expect(plan.writes.map((w) => w.id)).toEqual(["S11"]);
  });

  it("flags a near-duplicate event as a conflict for an editor", () => {
    const plan = planIngest(
      sidecar([
        event("near", {
          title: { it: "Raid ucraino sul porto di Ust-Luga, con versioni divergenti" },
          date: { start: "2026-11-11", end: null, precision: "day" },
        }),
      ]),
      context(),
    );
    expect(outcome(plan, "near")).toMatchObject({ classification: "conflict", id: "EXT-031" });
  });

  it("rejects a person relationship without primary_url, legal status and date", () => {
    const person = dataset.entities.find((e) => e.kind === "person");
    const link = (ref: string, overrides: Record<string, unknown>) =>
      relationship(ref, { subject: person?.id, object: "EXT-030", ...overrides });
    const plan = planIngest(
      sidecar([
        link("no-url", {}),
        link("no-status", { primary_url: "https://example.org/act" }),
        link("complete", {
          primary_url: "https://example.org/act",
          person_status: {
            legal_status: { it: "Indagato, non condannato" },
            status_date: "2026-11-10",
          },
        }),
      ]),
      context(),
    );
    expect(plan.operations.map((o) => o.classification)).toEqual(["rejected", "rejected", "new"]);
    expect(outcome(plan, "no-url")?.reasons[0]).toContain("primary_url");
    const created = plan.writes.find((w) => w.collection === "relationships")?.record as {
      review: { notes: string[] };
    };
    expect(
      created.review.notes.some((n) => n.startsWith("Legal/procedural status at 2026-11-10")),
    ).toBe(true);
    expect(plan.attention.some((a) => a.includes("named person"))).toBe(true);
  });

  it("routes E5 material to data/hypotheses/ only", () => {
    const hypothesis = {
      op: "create_hypothesis",
      ref: "e5",
      item: "e5",
      ...base,
      evidence_level: "E5",
      subject: "@ev",
      object: "RU",
      hypothesis_type: "RETE_FINANZIARIA_COMUNE_DI_PROVA",
      question: { it: "Le stesse reti finanziarie sostengono più sabotaggi?" },
      current_limit: { it: "Nessuna prova pubblica." },
      evidence_needed: { it: "Dati sui pagamenti." },
      priority: null,
      events: ["@ev"],
      external_url: null,
    };
    const plan = planIngest(sidecar([event("ev"), hypothesis]), context());
    const created = plan.writes.find((w) => w.collection === "hypotheses");
    const [h] = freeIds(dataset, "H", 2, 1);
    expect(outcome(plan, "e5")).toMatchObject({ classification: "new", id: h });
    expect(created?.path).toBe(`hypotheses/${h}.json`);
    expect(created?.record).toMatchObject({
      subject: freeIds(dataset, "EXT-", 3, 1)[0],
      status: "open_unproven",
      priority: "medium",
    });
    expect(plan.writes.some((w) => w.collection === "relationships")).toBe(false);
    const again = planIngest(
      sidecar([event("ev"), { ...hypothesis, ref: "e5-bis" }]),
      context({ dataset: afterPlan(plan) }),
    );
    expect(outcome(again, "e5-bis")).toMatchObject({ classification: "duplicate", id: h });
  });

  it("never reuses or renumbers IDs", () => {
    const plan = planIngest(
      sidecar([event("a"), event("b", { title: { it: "Altro fatto" } })]),
      context(),
    );
    const ids = plan.writes.filter((w) => w.collection === "events").map((w) => w.id);
    expect(ids).toEqual(freeIds(dataset, "EXT-", 3, 2));
    expect(dataset.events.some((e) => ids.includes(e.id))).toBe(false);
  });
});

describe("pnpm ingest CLI", () => {
  it("reports exhausted IDs in text and JSON dry runs without writing", () => {
    const root = mkdtempSync(path.join(tmpdir(), "oem-exhaust-"));
    try {
      cpSync(repoPath("data"), path.join(root, "data"), { recursive: true });
      mkdirSync(path.join(root, "sources", "incremental"), { recursive: true });
      symlinkSync(repoPath("sources/original"), path.join(root, "sources", "original"));
      cpSync(repoPath("sources/incremental"), path.join(root, "sources", "incremental"), {
        recursive: true,
      });
      mkdirSync(path.join(root, "docs", "audit"), { recursive: true });
      cpSync(
        repoPath("docs/audit/M5_2026-11-12.json"),
        path.join(root, "docs/audit/M5_2026-11-12.json"),
      );
      const eventRecord = firstRecord(dataset.events);
      const exhausted = {
        ...eventRecord,
        id: "EXT-999",
        provenance: [],
        review: { ...eventRecord.review, status: "needs_review" as const },
      };
      writeFileSync(path.join(root, "data/events/EXT-999.json"), serializeRecord(exhausted));
      const proposal = sidecar([event("first"), event("later")]);
      const input = path.join(root, "input.json");
      writeFileSync(input, JSON.stringify(proposal));
      writeFileSync(path.join(root, proposal.source.file), "# Test\n");
      const before = readdirSync(path.join(root, "data/events"));
      for (const args of [[], ["--json"]]) {
        const run = spawnSync(process.execPath, [repoPath("src/cli/ingest.ts"), input, ...args], {
          env: { ...process.env, OEM_REPO_ROOT: root },
          encoding: "utf8",
        });
        expect(run.status).toBe(1);
        expect(run.stderr).toBe("");
        expect(run.stdout).toContain("EXT-999 exhausted");
        expect(run.stderr).not.toContain("    at ");
        if (args.length) expect(JSON.parse(run.stdout).writes).toEqual([]);
      }
      expect(readdirSync(path.join(root, "data/events"))).toEqual(before);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("writes canonical candidates once, then nothing, and data/ still validates", () => {
    const root = mkdtempSync(path.join(tmpdir(), "oem-ingest-"));
    try {
      mkdirSync(path.join(root, "sources", "incremental"), { recursive: true });
      mkdirSync(path.join(root, "docs", "audit"), { recursive: true });
      cpSync(
        repoPath("docs/audit/M5_2026-11-12.json"),
        path.join(root, "docs/audit/M5_2026-11-12.json"),
      );
      // validate.ts also checks the B15 forbidden-inference registry.
      cpSync(repoPath("docs/audit/inferences"), path.join(root, "docs/audit/inferences"), {
        recursive: true,
      });
      symlinkSync(repoPath("sources/original"), path.join(root, "sources", "original"));
      cpSync(repoPath("sources/incremental"), path.join(root, "sources", "incremental"), {
        recursive: true,
      });
      writeFileSync(path.join(root, fonte10.source.file), "# Fonte_10 placeholder for tests\n");
      cpSync(repoPath("data"), path.join(root, "data"), { recursive: true });
      const run = (...args: string[]) =>
        spawnSync(process.execPath, [repoPath("src/cli/ingest.ts"), repoPath(FIXTURE), ...args], {
          env: { ...process.env, OEM_REPO_ROOT: root },
          encoding: "utf8",
        });

      const dry = run("--json");
      expect(dry.status).toBe(0);
      const planned = JSON.parse(dry.stdout).writes as { path: string }[];
      expect(planned.length).toBeGreaterThan(0);
      const [firstEvent] = freeIds(dataset, "EXT-", 3, 1);
      expect(readdirSync(path.join(root, "data", "events"))).not.toContain(`${firstEvent}.json`);

      const first = run("--write", "--json");
      expect(first.status).toBe(0);
      // Same files; the corpus document is written last.
      const written = JSON.parse(first.stdout).written as string[];
      expect([...written].sort()).toEqual(planned.map((w) => w.path).sort());
      expect(written.at(-1)).toBe(`sources/${fonte10.source.code}.json`);
      const second = run("--write", "--json");
      expect(second.status).toBe(0);
      expect(JSON.parse(second.stdout).written).toEqual([]);
      expect(JSON.parse(second.stdout).summary.already_applied).toBe(10);

      execFileSync(process.execPath, [repoPath("src/cli/validate.ts")], {
        env: { ...process.env, OEM_REPO_ROOT: root },
        stdio: "ignore",
      });
      expect(REPO_ROOT).not.toBe(root);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 60_000);
});
