import { describe, expect, it } from "vitest";
import { type InferenceRegistry, readInferenceRegistry } from "../src/editorial/inferences.ts";
import type { Dataset } from "../src/model/index.ts";
import { readDataFiles } from "../src/pipeline/load.ts";
import { validateDataFiles } from "../src/pipeline/validate.ts";
import { counterInferenceAudit } from "../src/site/inferences.ts";
import { publicationReport } from "../src/site/publication.ts";
import { buildReadModel } from "../src/site/read-model.ts";
import { buildTraces, notSaid, traceFor, weakestLink } from "../src/site/trace.ts";

const dataset = validateDataFiles(readDataFiles()).dataset;
const registry = readInferenceRegistry();
const report = publicationReport(dataset);
const model = buildReadModel(report.dataset);
const audit = counterInferenceAudit(registry, model);
const traces = buildTraces(registry, model, audit);

describe("trace (B16)", () => {
  it("builds one trace per audited pair, one for every public hypothesis", () => {
    for (const h of report.dataset.hypotheses) {
      expect(traceFor(traces, h.id)?.pair).toEqual([h.subject, h.object]);
    }
    expect(traces).toHaveLength(audit.audit.pairs_audited);
  });

  it("orders each path from the first end to the second, step by step", () => {
    for (const t of traces) {
      let at = t.pair[0];
      for (const step of t.steps) {
        expect([step.subject, step.object]).toContain(at);
        at = step.subject === at ? step.object : step.subject;
      }
      if (t.steps.length > 0) expect(at).toBe(t.pair[1]);
    }
  });

  it("shows the interruption and the hypothesis for H06, H07 and H15 (C §8.1)", () => {
    const expected: Record<string, string[]> = {
      H06: ["G-0087"],
      H07: ["G-0078", "G-0072"],
      H15: ["G-0429", "G-0427"],
    };
    for (const [id, relationships] of Object.entries(expected)) {
      const t = traceFor(traces, id);
      expect(t, id).toBeDefined();
      expect(t?.interrupted_at.sort(), id).toEqual([...relationships].sort());
      expect(t?.hypotheses.map((h) => h.id)).toContain(id);
      const kinds = t?.not_said.map((n) => n.kind) ?? [];
      expect(kinds).toContain("chain");
      expect(kinds).toContain("interruption");
      expect(kinds).toContain("hypothesis");
      // Interruptions and annotations are the audit's, not a second computation.
      const flagged = audit.flagged_paths.find((a) => a.origin.id === id);
      expect(t?.steps.map((s) => s.relationship)).toEqual(flagged?.path.map((s) => s.relationship));
    }
  });

  it("keeps the unreviewed label on classifications nobody reviewed", () => {
    const t = traceFor(traces, "H06");
    const items = t?.not_said.filter((n) => n.kind === "interruption") ?? [];
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      const step = t?.steps.find((s) => s.relationship === item.ref);
      expect(item.unreviewed).toBe(step?.classification_state !== "revisionata");
    }
  });

  it("states the weakest link as the highest evidence code", () => {
    expect(weakestLink([])).toBeNull();
    expect(weakestLink(["E1", "E3", "E3", "E2"])).toEqual({ level: "E3", count: 2, total: 4 });
  });

  it("says plainly when the public graph holds no path", () => {
    const base = traces[0];
    if (!base) throw new Error("no trace");
    const none = notSaid({ ...base, steps: [], interrupted_at: [], weakest: null });
    expect(none.map((n) => n.kind)).toContain("no_path");
    expect(none.map((n) => n.kind)).not.toContain("shortest_only");
  });

  it("warns that event participation is not control, financing or coordination", () => {
    const withParticipation = traces.find((t) => t.steps.some((s) => s.group === "participation"));
    if (withParticipation) {
      expect(withParticipation.not_said.map((n) => n.kind)).toContain("participation");
    }
    const base = traces[0];
    if (!base || base.steps.length === 0) throw new Error("no trace");
    const first = base.steps[0];
    if (!first) throw new Error("no step");
    const forced = notSaid({ ...base, steps: [{ ...first, group: "participation" }] });
    expect(forced.map((n) => n.kind)).toContain("participation");
  });

  it("every step carries a caveat or a level, and every wording exists in both languages", () => {
    for (const t of traces) {
      for (const n of t.not_said) {
        expect(n.text.it.length).toBeGreaterThan(0);
        expect(n.text.en?.length ?? 0).toBeGreaterThan(0);
      }
      for (const s of t.steps) expect(s.evidence_level).toMatch(/^E[1-4]$/);
    }
  });

  it("never names a withheld record or a restricted relationship", () => {
    const visible = new Set(
      (Object.keys(report.dataset) as (keyof Dataset)[]).flatMap((n) =>
        report.dataset[n].map((r) => r.id),
      ),
    );
    const restricted = new Set(
      report.dataset.relationships.filter((r) => model.isRestricted(r)).map((r) => r.id),
    );
    const named = traces.flatMap((t) => [
      t.id,
      ...t.pair,
      ...t.hypotheses.map((h) => h.id),
      ...t.forbidden.map((f) => f.id),
      ...t.steps.flatMap((s) => [s.relationship, s.subject, s.object]),
    ]);
    expect(named.filter((id) => !visible.has(id) && !id.startsWith("FI-"))).toEqual([]);
    expect(traces.flatMap((t) => t.steps).filter((s) => restricted.has(s.relationship))).toEqual(
      [],
    );
  });

  it("lists a public forbidden inference on the pair, unreviewed until reviewed", () => {
    const entry: InferenceRegistry["forbidden_inferences"][number] = {
      id: "FI-950",
      statement: { it: "Affermazione di prova.", en: "Test statement." },
      note: null,
      proposed_by: "test fixture",
      pairs: [["US", "X"]],
      hypotheses: ["H07"],
      declared_by: { kind: "source" as const, source: null, record: "H07", locator: "fixture" },
      state: "proposta" as const,
      reviewer: null,
      reviewed_on: null,
      lifted: null,
    };
    const r = { ...structuredClone(registry), forbidden_inferences: [entry] };
    const t = traceFor(buildTraces(r, model), "H07");
    expect(t?.forbidden.map((f) => f.id)).toEqual(["FI-950"]);
    const item = t?.not_said.find((n) => n.kind === "forbidden");
    expect(item?.ref).toBe("FI-950");
    expect(item?.unreviewed).toBe(true);
  });
});
