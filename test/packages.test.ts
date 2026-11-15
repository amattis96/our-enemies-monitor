import { beforeAll, describe, expect, it } from "vitest";
import { type Article, COLLECTION_NAMES, type Dataset } from "../src/model/index.ts";
import { buildManifest, type ExportFile, exportFiles } from "../src/site/exports.ts";
import type { DataCommit } from "../src/site/history.ts";
import { articleJsonLd, datasetJsonLd, serializeJsonLd } from "../src/site/jsonld.ts";
import {
  buildArticlesIndex,
  buildChangesFeed,
  buildRecordPackages,
  FEED_MAX_ITEMS,
  publicArticles,
  recordDigest,
  recordPages,
  relatedIndex,
} from "../src/site/packages.ts";
import { type PublicationReport, publicationReport } from "../src/site/publication.ts";
import { loadReadModel } from "../src/site/read-model.ts";
import { lastmodResolver, recordLastmods, sitePathOf } from "../src/site/sitemap.ts";
import { leakedIds, leakedInSitemap, withheldIdSet } from "../src/site/surface.ts";

let report: PublicationReport;
let pub: Dataset;
let withheld: Set<string>;
const commit = {
  commit: "0123456789abcdef0123456789abcdef01234567",
  commit_date: "2026-11-15T07:52:02+01:00",
};

beforeAll(() => {
  report = publicationReport(loadReadModel().dataset);
  pub = report.dataset;
  withheld = withheldIdSet(report.withheld, pub);
});

function article(overrides: Partial<Article> & { id: string }): Article {
  return {
    fixture: false,
    title: { it: "Titolo", en: "Title" },
    summary: { it: "Sintesi", en: "Summary" },
    body: { it: "Corpo", en: "Body" },
    date: "2026-11-12",
    updated: null,
    generated_by: { kind: "ai", tool: "tool", run_date: "2026-11-12" },
    links: { events: [], entities: [], relationships: [], hypotheses: [] },
    references: [
      {
        url: "https://example.org/a",
        title: "Doc",
        publisher: null,
        published: null,
        accessed: "2026-11-12",
      },
    ],
    review: { status: "reviewed", notes: [] },
    ...overrides,
  };
}

describe("record packages (D A6, A7)", () => {
  it("publish exactly one package per public record, with the record unchanged", () => {
    const packages = buildRecordPackages(pub, commit, "v1");
    const total = COLLECTION_NAMES.reduce((n, name) => n + pub[name].length, 0);
    expect(packages).toHaveLength(total);
    expect(new Set(packages.map((p) => p.path)).size).toBe(total);
    for (const name of COLLECTION_NAMES) {
      const sample = pub[name][0];
      const file = packages.find((p) => p.path === `records/${sample?.id}.json`);
      const parsed = JSON.parse(file?.text ?? "null");
      expect(parsed.collection).toBe(name);
      expect(parsed.record).toEqual(JSON.parse(JSON.stringify(sample)));
    }
  });

  it("carry a citation bound to the commit, with no wall clock", () => {
    const [first] = buildRecordPackages(pub, commit, "v1");
    const parsed = JSON.parse(first?.text ?? "null");
    expect(parsed.cite_as.commit).toBe(commit.commit);
    expect(parsed.cite_as.text).toContain("0123456");
    expect(parsed.cite_as.text).toContain("2026-11-15");
    expect(parsed.cite_as.cites).toBe("public_projection");
    expect(parsed.cite_as.package_path).toBe(`records/${parsed.id}.json`);
    expect(parsed.cite_as.record_sha256).toBe(recordDigest(parsed.record));
    expect(parsed.canonical_source.repository_permalink).toBe(
      `https://github.com/amattis96/our-enemies-monitor/blob/${commit.commit}/${parsed.canonical_source.repository_path}`,
    );
    expect(buildRecordPackages(pub, commit, "v1")).toEqual(buildRecordPackages(pub, commit, "v1"));
    const noGit = JSON.parse(
      buildRecordPackages(pub, { commit: null, commit_date: null }, "v1")[0]?.text ?? "",
    );
    expect(noGit.canonical_source.repository_permalink).toBeNull();
  });

  it("cite the exported projection, not the canonical file, when they differ (H08)", () => {
    const canonical = loadReadModel().dataset;
    const files = exportFiles(report, commit, [], undefined, [], []);
    const pkg = (id: string) =>
      JSON.parse(files.find((f) => f.path === `records/${id}.json`)?.text ?? "null");
    const digestOf = (record: unknown) => recordDigest(record);

    // H08: the canonical file holds events, sources and notes the projection omits.
    expect(report.transformed).toContain("H08");
    const h08 = pkg("H08");
    const h08Canonical = canonical.hypotheses.find((h) => h.id === "H08");
    expect(h08.canonical_source.relation).toBe("filtered");
    expect(h08.cite_as.record_sha256).toBe(digestOf(h08.record));
    expect(h08.cite_as.record_sha256).not.toBe(digestOf(h08Canonical));
    const omitted = report.projections.find((p) => p.id === "H08");
    for (const id of [...(omitted?.omitted_events ?? []), ...(omitted?.omitted_sources ?? [])]) {
      expect(JSON.stringify(h08)).not.toContain(`"${id}"`);
    }

    // A record with no projection: the package equals the canonical file.
    const plain = pub.events.find((e) => !report.transformed.includes(e.id));
    if (!plain) throw new Error("no untransformed event");
    const p = pkg(plain.id);
    expect(p.canonical_source.relation).toBe("identical");
    expect(p.cite_as.record_sha256).toBe(digestOf(canonical.events.find((e) => e.id === plain.id)));

    // The manifest hash covers the whole package file.
    const manifest = buildManifest(report, files, commit);
    const entry = manifest.files.find((f) => f.path === "records/H08.json");
    expect(entry?.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("list as related only public records, symmetrically", () => {
    const index = relatedIndex(pub);
    const publicIds = new Set(COLLECTION_NAMES.flatMap((n) => pub[n].map((r) => r.id)));
    for (const [id, related] of index) {
      for (const ids of Object.values(related)) {
        for (const other of ids) {
          expect(publicIds.has(other), `${id} -> ${other}`).toBe(true);
          expect(Object.values(index.get(other) ?? {}).flat()).toContain(id);
        }
      }
    }
    const relationship = pub.relationships[0];
    expect(index.get(relationship?.subject ?? "")?.relationships).toContain(relationship?.id);
  });

  it("map pages only where the site has one", () => {
    expect(recordPages("events", "TL-0001")).toEqual({
      it: "events/TL-0001/",
      en: "en/events/TL-0001/",
    });
    expect(recordPages("relationships", "G-0001")).toBeNull();
  });
});

describe("articles index (D A9)", () => {
  const dataset = (): Dataset => pub;
  it("lists only articles that pass the publication gate, never fixtures", () => {
    const eventId = pub.events[0]?.id ?? "";
    const good = article({
      id: "ART-0001",
      links: { events: [eventId], entities: [], relationships: [], hypotheses: [] },
    });
    const draft = article({ id: "ART-0002", review: { status: "needs_review", notes: [] } });
    const fixture = article({ id: "ART-DEMO-001", fixture: true });
    const leaking = article({
      id: "ART-0003",
      links: { events: ["TL-WITHHELD"], entities: [], relationships: [], hypotheses: [] },
    });
    const index = buildArticlesIndex([good, draft, fixture, leaking], dataset(), "v1");
    expect(index.articles.map((a) => a.id)).toEqual(["ART-0001"]);
    expect(publicArticles([good, draft, fixture, leaking], dataset())).toHaveLength(1);
    expect(index.articles[0]?.markdown).toEqual({
      it: "articles/ART-0001.it.md",
      en: "articles/ART-0001.en.md",
    });
  });
});

describe("changes feed (D A10)", () => {
  const publicId = "TL-0001";
  const history: DataCommit[] = [
    {
      sha: "a".repeat(40),
      date: "2026-11-14T10:00:00+01:00",
      subject: "feat(data): update",
      records: [
        { collection: "events", id: publicId, status: "modified" },
        { collection: "events", id: "TL-GONE", status: "removed" },
        { collection: "events", id: "TL-NOT-PUBLIC", status: "added" },
      ],
    },
    {
      sha: "b".repeat(40),
      date: "2026-11-13T10:00:00+01:00",
      subject: "chore(data): only unpublished",
      records: [{ collection: "events", id: "TL-NOT-PUBLIC", status: "added" }],
    },
  ];

  it("lists only added or modified published records and skips empty commits", () => {
    const feed = buildChangesFeed(history, pub);
    expect(feed.version).toBe("https://jsonfeed.org/version/1.1");
    expect(feed.items).toHaveLength(1);
    expect(feed.items[0]?._oem.records).toEqual([
      {
        collection: "events",
        id: publicId,
        status: "modified",
        package: `records/${publicId}.json`,
      },
    ]);
    expect(feed.items[0]?.date_published).toBe("2026-11-14T10:00:00+01:00");
    expect(feed._oem).toEqual({ items_total: 1, items_listed: 1 });
  });

  it("caps the number of items and reports the total", () => {
    const many = Array.from({ length: FEED_MAX_ITEMS + 5 }, (_, i) => ({
      sha: i.toString(16).padStart(40, "0"),
      date: "2026-11-01T00:00:00+01:00",
      subject: `commit ${i}`,
      records: [{ collection: "events" as const, id: publicId, status: "modified" as const }],
    }));
    const feed = buildChangesFeed(many, pub);
    expect(feed.items).toHaveLength(FEED_MAX_ITEMS);
    expect(feed._oem.items_total).toBe(FEED_MAX_ITEMS + 5);
  });
});

describe("JSON-LD (D A14)", () => {
  it("cannot close the script element or start a comment", () => {
    const text = serializeJsonLd({ name: "</script><script>alert(1)</script><!--", a: "x&y " });
    expect(text).not.toContain("<");
    expect(text).not.toContain(">");
    expect(text).not.toContain(" ");
    expect(JSON.parse(text)).toEqual({ name: "</script><script>alert(1)</script><!--", a: "x&y " });
  });

  it("describes the dataset with CC0 and absolute downloads", () => {
    const ld = datasetJsonLd({
      siteUrl: "https://host/base",
      lang: "en",
      pageUrl: "https://host/base/en/data/",
      commit: commit.commit,
      commitDate: commit.commit_date,
      files: ["events.json", "manifest.json"],
    });
    expect(ld["@type"]).toBe("Dataset");
    expect(ld.license).toBe("https://creativecommons.org/publicdomain/zero/1.0/");
    expect(ld.distribution.map((d) => d.contentUrl)).toEqual([
      "https://host/base/data/v1/events.json",
      "https://host/base/data/v1/manifest.json",
    ]);
    expect(ld.dateModified).toBe(commit.commit_date);
  });

  it("describes a published article and skips fixtures", () => {
    const base = { siteUrl: "https://host/base", pageUrl: "https://host/base/articles/ART-0001/" };
    const real = article({ id: "ART-0001", updated: "2026-11-14" });
    const ld = articleJsonLd({ ...base, lang: "it", article: real });
    expect(ld?.["@type"]).toBe("Article");
    expect(ld?.datePublished).toBe("2026-11-12");
    expect(ld?.dateModified).toBe("2026-11-14");
    expect(ld?.citation).toEqual([
      { "@type": "CreativeWork", name: "Doc", url: "https://example.org/a" },
    ]);
    const italianOnly = article({ id: "ART-0004", body: { it: "Corpo" } });
    expect(articleJsonLd({ ...base, lang: "en", article: italianOnly })?.inLanguage).toBe("it");
    expect(
      articleJsonLd({
        ...base,
        lang: "it",
        article: article({ id: "ART-DEMO-001", fixture: true }),
      }),
    ).toBeNull();
  });
});

describe("sitemap lastmod (D §6)", () => {
  const publicId = "TL-0001";
  const history: DataCommit[] = [
    {
      sha: "a".repeat(40),
      date: "2026-11-14T10:00:00+01:00",
      subject: "s",
      records: [
        { collection: "events", id: publicId, status: "modified" },
        { collection: "events", id: "TL-NOT-PUBLIC", status: "added" },
      ],
    },
    {
      sha: "b".repeat(40),
      date: "2026-10-01T10:00:00+02:00",
      subject: "s",
      records: [{ collection: "events", id: publicId, status: "added" }],
    },
  ];

  it("dates a record page by its newest commit and never dates an unpublished ID", () => {
    const records = recordLastmods(history, pub);
    expect(records.get(publicId)).toBe("2026-11-14");
    expect(records.has("TL-NOT-PUBLIC")).toBe(false);
  });

  it("resolves record, article and other pages without the wall clock", () => {
    const resolve = lastmodResolver({
      records: recordLastmods(history, pub),
      articles: [article({ id: "ART-0001", updated: "2026-11-14" })],
      fallback: "2026-11-15",
    });
    expect(resolve(`/events/${publicId}/`)).toBe("2026-11-14");
    expect(resolve(`/en/events/${publicId}/`)).toBe("2026-11-14");
    expect(resolve("/articles/ART-0001/")).toBe("2026-11-14");
    expect(resolve("/timeline/")).toBe("2026-11-15");
    expect(resolve("/events/TL-NOT-PUBLIC/")).toBe("2026-11-15");
    const noGit = lastmodResolver({ records: new Map(), articles: [], fallback: null });
    expect(noGit("/timeline/")).toBeUndefined();
  });

  it("strips the site origin and base path", () => {
    expect(sitePathOf("https://h.org/our/events/TL-0001/", "https://h.org", "/our")).toBe(
      "/events/TL-0001/",
    );
    expect(sitePathOf("https://h.org/events/TL-0001/", "https://h.org", "")).toBe(
      "/events/TL-0001/",
    );
  });
});

describe("withheld records never reach the machine-readable surface (D A15)", () => {
  let files: ExportFile[];
  beforeAll(() => {
    files = exportFiles(report);
  });

  it("has a non-empty withheld registry to test against", () => {
    expect(withheld.size).toBeGreaterThan(100);
  });

  it("finds a withheld ID only where an ID is structural", () => {
    const [id] = [...withheld];
    expect(leakedIds({ related: { entities: [id] } }, withheld)).toEqual([id]);
    expect(leakedIds({ subject: id }, withheld)).toEqual([id]);
    expect(leakedIds({ publisher: id }, withheld)).toEqual([]);
    expect(leakedIds({ package: `records/${id}.json` }, withheld)).toEqual([id]);
    expect(leakedIds({ text: `free text mentioning ${id} inside` }, withheld)).toEqual([]);
    expect(leakedInSitemap(`<loc>https://h/base/entities/${id}/</loc>`, withheld)).toEqual([id]);
  });

  it("has no package, feed item, article entry or catalog line for a withheld ID", () => {
    const checked = files.filter(
      (f) =>
        f.path.endsWith(".json") && !f.path.startsWith("schemas/") && f.path !== "withheld.json",
    );
    expect(checked.length).toBeGreaterThan(
      COLLECTION_NAMES.reduce((n, name) => n + pub[name].length, 0),
    );
    for (const file of checked) {
      expect(leakedIds(JSON.parse(file.text), withheld), file.path).toEqual([]);
    }
    for (const id of withheld) {
      expect(
        files.some((f) => f.path === `records/${id}.json`),
        id,
      ).toBe(false);
    }
  });

  it("covers every record in the manifest with its SHA-256", () => {
    const manifest = buildManifest(report, files, commit);
    const packages = manifest.files.filter((f) => f.path.startsWith("records/"));
    expect(packages).toHaveLength(COLLECTION_NAMES.reduce((n, name) => n + pub[name].length, 0));
    expect(manifest.files.map((f) => f.path)).toEqual(
      expect.arrayContaining(["articles.json", "changes.feed.json"]),
    );
    const catalog = JSON.parse(files.find((f) => f.path === "index.json")?.text ?? "{}");
    expect(catalog.record_packages.count).toBe(packages.length);
  });

  it("keeps the real articles index to public non-fixture articles", () => {
    const index = JSON.parse(files.find((f) => f.path === "articles.json")?.text ?? "{}");
    for (const entry of index.articles) {
      expect(entry.id).not.toMatch(/DEMO/);
      expect(entry.review_status).toBe("reviewed");
    }
  });
});
