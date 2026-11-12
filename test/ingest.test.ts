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
import { checkPlan, plannedFiles } from "../src/pipeline/ingest/apply.ts";
import { type IngestContext, type IngestPlan, planIngest } from "../src/pipeline/ingest/plan.ts";
import { type DataFile, readDataFiles } from "../src/pipeline/load.ts";
import { REPO_ROOT, repoPath } from "../src/pipeline/paths.ts";
import { validateDataFiles } from "../src/pipeline/validate.ts";
import { publishedDataset } from "../src/site/publication.ts";

const FIXTURE = "test/fixtures/Fonte_10.proposals.json";
const fixtureJson = () => JSON.parse(readFileSync(repoPath(FIXTURE), "utf8"));

let files: DataFile[];
let dataset: Dataset;
let fonte10: ProposalFile;
let archive: Map<string, string>;

beforeAll(() => {
  files = readDataFiles();
  dataset = validateDataFiles(files).dataset;
  fonte10 = ProposalFile.parse(fixtureJson());
  const dir = repoPath("sources/incremental");
  archive = new Map(
    readdirSync(dir)
      .filter((name) => name.endsWith(".md"))
      .map((name) => [`sources/incremental/${name}`, readFileSync(path.join(dir, name), "utf8")]),
  );
});

const context = (extra: Partial<IngestContext> = {}): IngestContext => ({
  dataset,
  archive,
  fileExists: () => true,
  ...extra,
});
const outcome = (plan: IngestPlan, ref: string) => plan.operations.find((o) => o.ref === ref);
const afterPlan = (plan: IngestPlan, base = files) =>
  validateDataFiles(plannedFiles(plan, base)).dataset;

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

const base = { sources: ["R01"], notes: [] };
const event = (ref: string, overrides: Record<string, unknown> = {}) => ({
  op: "create_event",
  ref,
  item: ref,
  ...base,
  update_type: "NEW_EVENT",
  evidence_level: "E1",
  title: { it: "Evento sintetico di prova senza corrispondenze nel corpus" },
  description: { it: "Descrizione documentata." },
  date: { start: "2026-11-12", end: null, precision: "day" },
  published: null,
  themes: ["justice"],
  geography: null,
  places: [],
  evidence_note: null,
  publisher: null,
  url: null,
  claims: { perpetrator: null, sponsor: null, motive: null, impact: null },
  contrary_evidence: null,
  related: [],
  ...overrides,
});
const relationship = (ref: string, overrides: Record<string, unknown> = {}) => ({
  op: "create_relationship",
  ref,
  item: ref,
  ...base,
  evidence_level: "E1",
  subject: "PL",
  predicate: "COLLEGATO_A",
  object: "EXT-005",
  relation_class: "context",
  evidence_status: "documented",
  events: [],
  valid_from: null,
  valid_to: null,
  primary_url: null,
  caveat: null,
  person_status: null,
  ...overrides,
});

describe("proposals contract", () => {
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

describe("Fonte_10 fixture dry run", () => {
  let plan: IngestPlan;
  beforeAll(() => {
    plan = planIngest(fonte10, context());
  });

  it("classifies every operation and allocates the next free IDs", () => {
    expect(plan.fatal).toEqual([]);
    expect(plan.operations.map((o) => [o.ref, o.classification, o.id])).toEqual([
      ["OEM-20261112-001", "new", "EXT-035"],
      ["OEM-20261112-001-prokuratura", "new", "PL_PROKURATURA"],
      ["OEM-20261112-001-addebiti", "new", "G-0461"],
      ["OEM-20261112-002", "new", "EXT-036"],
      ["OEM-20261112-003", "new", "EXT-037"],
      ["OEM-20261112-003-h32", "enrichment", "H32"],
      ["OEM-20261112-005-ext022", "enrichment", "EXT-022"],
      ["OEM-20261112-005-ext032", "enrichment", "EXT-032"],
      ["OEM-20261112-006", "new", "EXT-038"],
      ["OEM-20261112-007", "enrichment", "EXT-029"],
    ]);
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
    const ext035 = plan.writes.find((w) => w.id === "EXT-035")?.record as {
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

  it("validates, apart from the not yet merged Markdown file", () => {
    const errors = checkPlan(plan, files).filter((i) => i.severity === "error");
    expect(errors.map((e) => [e.file, e.message])).toEqual([
      [
        "sources/S10.json",
        'file "sources/incremental/Fonte_10_Aggiornamento_OSINT_Eventi_Reti_Europa_2026-11-12.md" does not exist',
      ],
    ]);
  });

  it("leaves the public projection unchanged (M5 gate withholds every candidate)", () => {
    expect(publishedDataset(afterPlan(plan))).toEqual(publishedDataset(dataset));
  });

  it("is idempotent: a second run is all already_applied with no writes", () => {
    const second = planIngest(fonte10, context({ dataset: afterPlan(plan) }));
    expect(second.operations.every((o) => o.classification === "already_applied")).toBe(true);
    expect(second.writes).toEqual([]);
  });

  it("is blocked until the Markdown source is in the repository", () => {
    const blocked = planIngest(fonte10, context({ fileExists: () => false }));
    expect(blocked.fatal[0]).toContain("merge the Markdown source");
  });
});

describe("reconciliation edge cases", () => {
  it("detects duplicates: same event URL, already cited sources, same edge", () => {
    const ext034 = dataset.events.find((e) => e.id === "EXT-034");
    const plan = planIngest(
      sidecar([
        event("dup-url", { url: ext034?.url }),
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

  it("detects duplicates across other incremental sources", () => {
    const other = sidecar([event("elsewhere", { url: "https://example.org/a" })]);
    const mine = ProposalFile.parse({
      ...fixtureJson(),
      operations: [event("mine", { url: "https://example.org/a/" })],
    });
    const plan = planIngest(mine, context({ others: [other] }));
    expect(outcome(plan, "mine")?.classification).toBe("duplicate");
    expect(outcome(plan, "mine")?.reasons[0]).toContain("S11 elsewhere");

    const archived = [...archive.values()][0] ?? "";
    const url = archived.match(/https:\/\/www\.reuters\.com\/[^\s)]+/)?.[0];
    const fromMd = planIngest(sidecar([event("md", { url })]), context());
    expect(outcome(fromMd, "md")?.classification).not.toBe("new");
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
    expect(outcome(plan, "e5")).toMatchObject({ classification: "new", id: "H33" });
    expect(created?.path).toBe("hypotheses/H33.json");
    expect(created?.record).toMatchObject({
      subject: "EXT-035",
      status: "open_unproven",
      priority: "medium",
    });
    expect(plan.writes.some((w) => w.collection === "relationships")).toBe(false);
    const again = planIngest(
      sidecar([event("ev"), { ...hypothesis, ref: "e5-bis" }]),
      context({ dataset: afterPlan(plan) }),
    );
    expect(outcome(again, "e5-bis")).toMatchObject({ classification: "duplicate", id: "H33" });
  });

  it("never reuses or renumbers IDs", () => {
    const plan = planIngest(
      sidecar([event("a"), event("b", { title: { it: "Altro fatto" } })]),
      context(),
    );
    const ids = plan.writes.filter((w) => w.collection === "events").map((w) => w.id);
    expect(ids).toEqual(["EXT-035", "EXT-036"]);
    expect(dataset.events.some((e) => ids.includes(e.id))).toBe(false);
  });
});

describe("pnpm ingest CLI", () => {
  it("writes canonical candidates once, then nothing, and data/ still validates", () => {
    const root = mkdtempSync(path.join(tmpdir(), "oem-ingest-"));
    try {
      mkdirSync(path.join(root, "sources", "incremental"), { recursive: true });
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
      expect(JSON.parse(dry.stdout).writes).toHaveLength(22);
      expect(readdirSync(path.join(root, "data", "events"))).not.toContain("EXT-035.json");

      const first = run("--write", "--json");
      expect(first.status).toBe(0);
      expect(JSON.parse(first.stdout).written).toHaveLength(22);
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
