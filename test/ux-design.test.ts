import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { TimelineItem } from "../src/site/read-model.ts";
import {
  boardAriaAnnouncement,
  filterBoardEdges,
  nextThreadNeighbor,
  parseBoardFilters,
  serializeBoardFilters,
} from "../web/src/islands/EvidenceBoard.tsx";
import {
  countActiveTimelineFilters,
  DEFAULT_EXTENDED_FILTERS,
  matchesExtended,
  parseTimelineFilters,
  serializeTimelineFilters,
} from "../web/src/islands/TimelineExplorer.tsx";

const root = resolve(import.meta.dirname, "..");

describe("PK-18 timeline URL filter serialization & matching", () => {
  it("round-trips legacy and extended URL parameters", () => {
    const query =
      "?tema=cyber_operations&da=2022&a=2025&q=Baltico&ext=0&meta=1&ordine=asc&dominio=energy&relazione=attribuzione&livello=E2&stato=pending&provenienza=Fonte_01&conoscenza=2025-12-31";
    const parsed = parseTimelineFilters(query);
    expect(parsed.theme).toBe("cyber_operations");
    expect(parsed.from).toBe(2022);
    expect(parsed.to).toBe(2025);
    expect(parsed.query).toBe("Baltico");
    expect(parsed.pending).toBe(false);
    expect(parsed.metadata).toBe(true);
    expect(parsed.order).toBe("oldest");
    expect(parsed.domain).toBe("energy");
    expect(parsed.relationType).toBe("attribuzione");
    expect(parsed.level).toBe("E2");
    expect(parsed.status).toBe("pending");
    expect(parsed.provenance).toBe("Fonte_01");
    expect(parsed.knowledgeDate).toBe("2025-12-31");

    const serialized = serializeTimelineFilters(parsed);
    expect(parseTimelineFilters(serialized)).toEqual(parsed);
  });

  it("filters timeline items and counts active filters", () => {
    const item: TimelineItem = {
      id: "TL-0099",
      title: "Incidente energetico nel Baltico",
      start: "2024-06-01",
      end: null,
      precision: "day",
      themes: ["energy"],
      evidence_note: "Attribuzione istituzionale Fonte_01",
      geography: "Baltic Sea",
      pending: false,
      metadata: false,
      evidence_level: "E2",
      places: ["Baltic Sea"],
    };

    const filters = {
      ...DEFAULT_EXTENDED_FILTERS,
      domain: "energy",
      level: "E2",
      status: "integrated" as const,
      provenance: "Fonte_01",
      knowledgeDate: "2024-12-31",
    };
    expect(matchesExtended(item, filters)).toBe(true);
    expect(matchesExtended(item, { ...filters, knowledgeDate: "2023-01-01" })).toBe(false);
    expect(matchesExtended(item, { ...filters, status: "pending" })).toBe(false);
    expect(countActiveTimelineFilters(filters)).toBe(5);
    expect(countActiveTimelineFilters(DEFAULT_EXTENDED_FILTERS)).toBe(0);
  });
});

describe("PK-18 evidence board URL filters & keyboard/a11y helpers", () => {
  const defaultGroups = ["attribution", "sanctions"];
  const defaultLevels = ["E1", "E2", "E3", "E4"];

  it("round-trips board URL filters and keeps ?focus= compatibility", () => {
    const query =
      "?famiglie=attribution&livelli=E1,E2&dominio=russia&relazione=finanzia&periodo=2024&stato=with_caveat&provenienza=REL-01&conoscenza=2025&focus=ENT-001&isola=1&vista=list";
    const parsed = parseBoardFilters(query, defaultGroups, defaultLevels);
    expect(parsed.groups).toEqual(["attribution"]);
    expect(parsed.levels).toEqual(["E1", "E2"]);
    expect(parsed.domain).toBe("russia");
    expect(parsed.relationType).toBe("finanzia");
    expect(parsed.period).toBe("2024");
    expect(parsed.status).toBe("with_caveat");
    expect(parsed.provenance).toBe("REL-01");
    expect(parsed.knowledgeDate).toBe("2025");
    expect(parsed.focus).toBe("ENT-001");
    expect(parsed.isolated).toBe(true);
    expect(parsed.view).toBe("list");

    const serialized = serializeBoardFilters(parsed, defaultGroups, defaultLevels);
    expect(parseBoardFilters(serialized, defaultGroups, defaultLevels)).toEqual(parsed);
  });

  it("filters board edges and navigates along threads with arrow keys", () => {
    const edges = [
      {
        id: "REL-01",
        source: "A",
        target: "B",
        group: "attribution",
        level: "E2",
        label: "attribuisce",
        literal: "attribuisce",
        caveat: { it: "Nota 2024" },
      },
      {
        id: "REL-02",
        source: "A",
        target: "C",
        group: "sanctions",
        level: "E1",
        label: "sanziona",
        literal: "sanziona",
        caveat: null,
      },
    ];
    const filters = parseBoardFilters("?stato=with_caveat", defaultGroups, defaultLevels);
    expect(filterBoardEdges(edges, filters, false).map((e) => e.id)).toEqual(["REL-01"]);

    expect(nextThreadNeighbor("A", edges, "next")).toBe("B");
    expect(nextThreadNeighbor("A", edges, "prev")).toBe("C");
    expect(nextThreadNeighbor("Z", edges, "next")).toBeNull();
  });

  it("produces localized ARIA live announcements", () => {
    expect(boardAriaAnnouncement("it", { nodes: 4, edges: 3 }, "Entità X", 2)).toBe(
      "4 schede, 3 fili visibili. Selezionato Entità X, 2 collegamenti visibili.",
    );
    expect(boardAriaAnnouncement("en", { nodes: 4, edges: 3 })).toBe("4 cards, 3 visible threads.");
  });
});

describe("PK-19 disposition audit & page contracts", () => {
  it("marks every item 60-67 in IMPLEMENTATION_PLAN.md as already_done, implemented, or discarded", () => {
    const plan = readFileSync(resolve(root, "docs/design/IMPLEMENTATION_PLAN.md"), "utf-8");
    for (const num of [60, 61, 62, 63, 64, 65, 66, 67]) {
      const pattern = new RegExp(
        `\\|\\s*${num}\\s*\\|[^\\n]*\\|\\s*\`(?:already_done|implemented|discarded)\`\\s*\\|`,
      );
      expect(plan).toMatch(pattern);
    }
  });

  it("provides required bilingual pages and components with expected contracts", () => {
    const requiredFiles = [
      "web/src/pages/[...lang]/inizia-qui.astro",
      "web/src/pages/[...lang]/api.astro",
      "web/src/pages/404.astro",
      "web/src/components/NewSinceLastVisit.astro",
      "web/src/pages/[...lang]/entities/[id].astro",
      "web/src/pages/[...lang]/entities/index.astro",
      "web/src/pages/[...lang]/articles/[id].astro",
      "web/src/pages/[...lang]/articles/index.astro",
    ];
    for (const rel of requiredFiles) {
      expect(existsSync(resolve(root, rel)), `${rel} must exist`).toBe(true);
    }

    const inizia = readFileSync(resolve(root, "web/src/pages/[...lang]/inizia-qui.astro"), "utf-8");
    expect(inizia).toContain("languageFromParam");
    expect(inizia).toContain("NewSinceLastVisit");

    const api = readFileSync(resolve(root, "web/src/pages/[...lang]/api.astro"), "utf-8");
    expect(api).toContain("data/v1/manifest.json");
    expect(api).toContain("languageFromParam");

    const notFound = readFileSync(resolve(root, "web/src/pages/404.astro"), "utf-8");
    expect(notFound).toContain("notfound-suggestions");
    expect(notFound).toContain('action={href("search/")}');

    const newSince = readFileSync(
      resolve(root, "web/src/components/NewSinceLastVisit.astro"),
      "utf-8",
    );
    expect(newSince).toContain("oem-last-visit");
    expect(newSince).toContain("localStorage");

    const entityPage = readFileSync(
      resolve(root, "web/src/pages/[...lang]/entities/[id].astro"),
      "utf-8",
    );
    expect(entityPage).toContain('role="tablist"');
    expect(entityPage).toContain("mini-board-svg");
    expect(entityPage).toContain("entity-timeline");

    const entitiesIndex = readFileSync(
      resolve(root, "web/src/pages/[...lang]/entities/index.astro"),
      "utf-8",
    );
    expect(entitiesIndex).toContain("entity-filter-q");
    expect(entitiesIndex).toContain("data-alpha");

    const articlePage = readFileSync(
      resolve(root, "web/src/pages/[...lang]/articles/[id].astro"),
      "utf-8",
    );
    expect(articlePage).toContain("dossier-rail");
    expect(articlePage).toContain("Nel fascicolo");

    const articlesIndex = readFileSync(
      resolve(root, "web/src/pages/[...lang]/articles/index.astro"),
      "utf-8",
    );
    expect(articlesIndex).toContain("data-article-filters");
  });
});
