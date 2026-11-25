import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { EVIDENCE_LEVELS } from "../src/model/index.ts";
import { repoPath } from "../src/pipeline/paths.ts";
import {
  cleanExportDetail,
  cleanExportLabel,
  EVIDENCE_PLAIN_LABELS,
  evidencePlainDefinition,
  firstOccurrenceTracker,
  GLOSSARY,
  glossaryEntry,
  sortedGlossary,
} from "../src/site/glossary.ts";
import { loadReadModel, type ReadModel } from "../src/site/read-model.ts";

let model: ReadModel;
beforeAll(() => {
  model = loadReadModel();
});

describe("bilingual glossary (PK-15A)", () => {
  const requiredIds = [
    "osint",
    "fimi",
    "baseline",
    "cutoff",
    "canonical_records",
    "gnss",
    "ubo",
    "e1",
    "e2",
    "e3",
    "e4",
    "e5",
  ];

  it("includes every required term with non-empty IT and EN definitions", () => {
    for (const id of requiredIds) {
      const entry = glossaryEntry(id);
      expect(entry, `Missing glossary term: ${id}`).toBeDefined();
    }
    for (const entry of GLOSSARY) {
      expect(entry.id.length).toBeGreaterThan(0);
      expect(entry.term.it.trim().length).toBeGreaterThan(0);
      expect(entry.term.en.trim().length).toBeGreaterThan(0);
      expect(entry.short.it.trim().length).toBeGreaterThan(0);
      expect(entry.short.en.trim().length).toBeGreaterThan(0);
      expect(entry.definition.it.trim().length).toBeGreaterThan(0);
      expect(entry.definition.en.trim().length).toBeGreaterThan(0);
    }
  });

  it("sorts glossary entries per language and tracks first occurrences", () => {
    expect(sortedGlossary("it")).toHaveLength(GLOSSARY.length);
    expect(sortedGlossary("en")).toHaveLength(GLOSSARY.length);

    const tracker = firstOccurrenceTracker();
    expect(tracker.isFirst("osint")).toBe(true);
    expect(tracker.isFirst("OSINT")).toBe(false);
    expect(tracker.isFirst("fimi")).toBe(true);
    tracker.reset();
    expect(tracker.isFirst("osint")).toBe(true);
  });
});

describe("E1–E5 plain-language labels", () => {
  it("provides plain-language IT and EN definitions for every evidence level", () => {
    for (const level of EVIDENCE_LEVELS) {
      const entry = EVIDENCE_PLAIN_LABELS[level];
      expect(entry.short.it.trim().length).toBeGreaterThan(0);
      expect(entry.short.en.trim().length).toBeGreaterThan(0);
      expect(entry.plain.it.trim().length).toBeGreaterThan(0);
      expect(entry.plain.en.trim().length).toBeGreaterThan(0);
      expect(evidencePlainDefinition(level, "it")).not.toBe(level);
      expect(evidencePlainDefinition(level, "en")).not.toBe(level);
    }
  });

  it("renders plain-language definition next to every EvidenceStamp badge", () => {
    const stamp = readFileSync(repoPath("web/src/components/EvidenceStamp.astro"), "utf8");
    expect(stamp).toContain("evidencePlainDefinition(level, lang)");
    expect(stamp).toContain('class="stamp-def"');
  });
});

describe("human-readable labels and zero sole internal codes", () => {
  it("resolves human-readable names for every published entity and event", () => {
    for (const entity of model.dataset.entities) {
      const labelIt = model.nodeLabel(entity.id, "it");
      const labelEn = model.nodeLabel(entity.id, "en");
      expect(labelIt.trim().length).toBeGreaterThan(0);
      expect(labelEn.trim().length).toBeGreaterThan(0);
      expect(labelIt).toBe(entity.name.it);
    }
    for (const event of model.dataset.events) {
      const labelIt = model.nodeLabel(event.id, "it");
      expect(labelIt.trim().length).toBeGreaterThan(0);
      expect(labelIt).toBe(event.title.it);
      expect(labelIt).not.toBe(event.id);
    }
  });

  it("keeps internal codes in secondary/tooltip position in NodeLink and hypotheses index", () => {
    const nodeLink = readFileSync(repoPath("web/src/components/NodeLink.astro"), "utf8");
    expect(nodeLink).toContain("title={tooltip}");
    expect(nodeLink).toContain("data-code={id}");
    expect(nodeLink).toContain("<T text={localizedName} lang={lang} />");

    const hypothesesIndex = readFileSync(
      repoPath("web/src/pages/[...lang]/hypotheses/index.astro"),
      "utf8",
    );
    expect(hypothesesIndex).not.toContain(">{h.id}</a>");
    expect(hypothesesIndex).toContain("<T text={h.question} lang={lang} />");
    expect(hypothesesIndex).toContain("evidence_needed");
    expect(hypothesesIndex).toContain("Linked trace");
    expect(hypothesesIndex).toContain("Tracciato collegato");
  });

  it("cleans technical export labels and preserves OS-aware search shortcut & lean nav", () => {
    expect(cleanExportLabel("Scheda in JSON (pacchetto del record)", "it")).not.toContain(
      "pacchetto",
    );
    expect(cleanExportDetail("records/H01.json", "en")).not.toBe("records/H01.json");

    const search = readFileSync(repoPath("web/src/components/SearchPalette.astro"), "utf8");
    expect(search).toContain("⌘K");
    expect(search).toContain("Ctrl K");

    const home = readFileSync(repoPath("web/src/pages/[...lang]/index.astro"), "utf8");
    expect(home).toContain("Cosa succede adesso");
    expect(home).toContain("What's happening now");

    const footer = readFileSync(repoPath("web/src/components/SiteFooter.astro"), "utf8");
    expect(footer).not.toContain('"timeline/"');
    expect(footer).not.toContain('"network/"');
    expect(footer).not.toContain('"atlas/"');
  });
});
