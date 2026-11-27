import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { compareMonthlyRuns, scoreAiBenchmarkRun } from "../src/audit/ai-benchmark.ts";
import type { Entity, Event, Source } from "../src/model/index.ts";
import { REPO_ROOT } from "../src/pipeline/paths.ts";
import { entityJsonLd, eventJsonLd, sourceJsonLd } from "../src/site/jsonld.ts";
import { renderOgSvg } from "../src/site/og-image.ts";
import {
  auditSeoDist,
  contentLastmod,
  formatApaCitation,
  formatBibtexCitation,
  isSignificantContentChange,
  snapshotStatusNotice,
} from "../src/site/seo.ts";

const tempDirs: string[] = [];

function makeTempDist(): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), "oem-seo-test-"));
  tempDirs.push(dir);
  return dir;
}

function writeDistFile(distDir: string, relPath: string, content: string): void {
  const full = path.join(distDir, relPath);
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(full, content, "utf8");
}

function validPageHtml(options: {
  sitePath: string;
  title?: string;
  description?: string;
  lede?: string;
  ogImage?: string;
  jsonLd?: string;
  includeHreflang?: boolean;
  includeXDefault?: boolean;
  extraBody?: string;
  extraHead?: string;
}): string {
  const site = "https://amattis96.github.io";
  const base = "/our-enemies-monitor";
  const canonical = `${site}${base}${options.sitePath}`;
  const isEn = options.sitePath.startsWith("/en/");
  const itPath = isEn ? options.sitePath.replace(/^\/en/, "") : options.sitePath;
  const enPath = isEn ? options.sitePath : `/en${options.sitePath}`;
  const title = options.title ?? "Documented Event · Our Enemies Monitor";
  const description =
    options.description ??
    "Evidence-based OSINT record with primary source links and explicit evidentiary status.";
  const ogImageTag = options.ogImage
    ? `<meta property="og:image" content="${options.ogImage}" />`
    : "";
  const hreflangTags =
    options.includeHreflang === false
      ? ""
      : `<link rel="alternate" hreflang="it" href="${site}${base}${itPath}" />
         <link rel="alternate" hreflang="en" href="${site}${base}${enPath}" />
         ${options.includeXDefault === false ? "" : `<link rel="alternate" hreflang="x-default" href="${site}${base}${itPath}" />`}`;

  return `<!doctype html>
<html lang="${isEn ? "en" : "it"}">
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <meta property="og:title" content="${title}" />
    ${ogImageTag}
    <link rel="canonical" href="${canonical}" />
    ${hreflangTags}
    ${options.jsonLd ? `<script type="application/ld+json">${options.jsonLd}</script>` : ""}
    ${options.extraHead ?? ""}
  </head>
  <body>
    <main id="main">
      ${options.lede ? `<p class="lede">${options.lede}</p>` : ""}
      ${options.extraBody ?? ""}
    </main>
  </body>
</html>`;
}

function setupBaselineDist(distDir: string): void {
  writeDistFile(
    distDir,
    "index.html",
    validPageHtml({
      sitePath: "/",
      ogImage: "https://amattis96.github.io/our-enemies-monitor/og/TL-0001.svg",
    }),
  );
  writeDistFile(
    distDir,
    "en/index.html",
    validPageHtml({
      sitePath: "/en/",
      ogImage: "https://amattis96.github.io/our-enemies-monitor/og/TL-0001.svg",
    }),
  );
  writeDistFile(
    distDir,
    "data/v1/withheld.json",
    JSON.stringify([{ id: "G-9999", collection: "relationships", reason: "needs_review" }]),
  );
  writeDistFile(
    distDir,
    "data/v1/all.json",
    JSON.stringify({
      events: [],
      entities: [],
      relationships: [],
      hypotheses: [],
      sources: [],
      exposures: [],
    }),
  );
  writeDistFile(distDir, "data/v1/articles.json", JSON.stringify([]));
  writeDistFile(distDir, "data/v1/changes.feed.json", JSON.stringify({ items: [] }));
  writeDistFile(distDir, "data/v1/index.json", JSON.stringify({ files: [] }));
  writeDistFile(
    distDir,
    "sitemap-0.xml",
    `<?xml version="1.0" encoding="UTF-8"?><urlset><url><loc>https://amattis96.github.io/our-enemies-monitor/</loc></url></urlset>`,
  );
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir && existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("PK-20: check-seo & SEO helpers", () => {
  it("passes cleanly on valid dist and treats warnings as non-blocking", () => {
    const dist = makeTempDist();
    setupBaselineDist(dist);
    writeDistFile(
      dist,
      "events/TL-0001/index.html",
      validPageHtml({
        sitePath: "/events/TL-0001/",
        title: "Short", // triggers title_length warning
        description: "Too short", // triggers description_length warning
        lede: new Array(45).fill("word").join(" "), // triggers lead_summary_too_long warning
        // no og:image -> triggers missing_og_image warning
      }),
    );
    writeDistFile(
      dist,
      "en/events/TL-0001/index.html",
      validPageHtml({
        sitePath: "/en/events/TL-0001/",
        ogImage: "https://amattis96.github.io/our-enemies-monitor/og/TL-0001.svg",
      }),
    );

    const report = auditSeoDist({ distDir: dist });
    expect(report.errors).toEqual([]);
    expect(report.warnings.map((w) => w.code)).toEqual(
      expect.arrayContaining([
        "title_length",
        "description_length",
        "lead_summary_too_long",
        "missing_og_image",
      ]),
    );
  });

  it("blocks withheld/private IDs in pages, exports, sitemap, feed, social meta, JSON-LD, and search index", () => {
    const dist = makeTempDist();
    setupBaselineDist(dist);
    writeDistFile(dist, "events/G-9999/index.html", validPageHtml({ sitePath: "/events/G-9999/" }));
    writeDistFile(
      dist,
      "en/events/G-9999/index.html",
      validPageHtml({ sitePath: "/en/events/G-9999/" }),
    );
    writeDistFile(dist, "data/v1/records/G-9999.json", JSON.stringify({ id: "G-9999" }));
    writeDistFile(dist, "data/v1/changes.feed.json", JSON.stringify({ items: [{ id: "G-9999" }] }));
    writeDistFile(
      dist,
      "sitemap-0.xml",
      `<urlset><url><loc>https://amattis96.github.io/our-enemies-monitor/events/G-9999/</loc></url></urlset>`,
    );
    writeDistFile(
      dist,
      "pagefind/fragment.json",
      JSON.stringify({ url: "/events/G-9999/", content: "G-9999" }),
    );
    writeDistFile(
      dist,
      "index.html",
      validPageHtml({
        sitePath: "/",
        extraHead: `<meta property="og:description" content="Private G-9999" />`,
        jsonLd: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Dataset",
          name: "OEM",
          id: "G-9999",
        }),
      }),
    );

    const report = auditSeoDist({ distDir: dist });
    const leaks = report.errors.filter((e) => e.code === "withheld_leak");
    expect(leaks.length).toBeGreaterThanOrEqual(7);
    expect(leaks.map((l) => l.location)).toEqual(
      expect.arrayContaining([
        "/events/G-9999/",
        "data/v1/records/G-9999.json",
        "data/v1/changes.feed.json",
        "sitemap-0.xml",
        expect.stringContaining("pagefind"),
        "/",
      ]),
    );
  });

  it("blocks missing essential caveat, invalid canonical, inconsistent hreflang, invalid JSON-LD, broken essential link, and removed URL without redirect", () => {
    const dist = makeTempDist();
    setupBaselineDist(dist);

    // Hypothesis without E5 caveat + ClaimReview JSON-LD (both blocking)
    writeDistFile(
      dist,
      "hypotheses/H01/index.html",
      validPageHtml({
        sitePath: "/hypotheses/H01/",
        includeXDefault: false,
        jsonLd: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "ClaimReview",
          claimReviewed: "Bad",
        }),
        extraBody: `<p>No caveat here.</p><a href="/our-enemies-monitor/events/MISSING/" data-essential-link>Broken</a>`,
      }),
    );

    // Page with relative canonical and non-reciprocal hreflang
    writeDistFile(
      dist,
      "events/TL-0001/index.html",
      `<!doctype html><html><head>
        <title>Valid Long Enough Title For Test</title>
        <meta name="description" content="Valid description that is definitely longer than fifty characters." />
        <link rel="canonical" href="/events/TL-0001/" />
        <link rel="alternate" hreflang="it" href="https://amattis96.github.io/our-enemies-monitor/events/TL-0001/" />
        <link rel="alternate" hreflang="en" href="https://amattis96.github.io/our-enemies-monitor/en/events/TL-0001/" />
        <link rel="alternate" hreflang="x-default" href="https://amattis96.github.io/our-enemies-monitor/events/TL-0001/" />
      </head><body></body></html>`,
    );

    const report = auditSeoDist({
      distDir: dist,
      previouslyPublishedUrls: ["/events/TL-OLD/"],
    });
    const codes = new Set(report.errors.map((e) => e.code));
    expect(codes.has("missing_essential_caveat")).toBe(true);
    expect(codes.has("invalid_canonical")).toBe(true);
    expect(codes.has("inconsistent_hreflang")).toBe(true);
    expect(codes.has("invalid_jsonld")).toBe(true);
    expect(codes.has("broken_essential_link")).toBe(true);
    expect(codes.has("removed_url_without_redirect")).toBe(true);
  });

  it("computes content-based lastmod without wall-clock time", () => {
    const prev = {
      id: "TL-0001",
      title: { it: "Titolo" },
      review: { status: "reviewed", notes: [] },
    };
    const sameContent = {
      id: "TL-0001",
      title: { it: "Titolo" },
      review: { status: "reviewed", notes: ["typo fix"] },
    };
    const changedContent = {
      id: "TL-0001",
      title: { it: "Titolo aggiornato" },
      review: { status: "reviewed", notes: [] },
    };

    expect(isSignificantContentChange(prev, sameContent)).toBe(false);
    expect(isSignificantContentChange(prev, changedContent)).toBe(true);
    expect(
      contentLastmod({
        significantChange: false,
        previousLastmod: "2026-10-01",
        contentDate: "2026-11-25",
      }),
    ).toBe("2026-10-01");
    expect(
      contentLastmod({
        significantChange: true,
        previousLastmod: "2026-10-01",
        contentDate: "2026-11-25",
      }),
    ).toBe("2026-11-25");
  });

  it("builds semantic JSON-LD for events, organizations, persons, and sources", () => {
    const event: Event = {
      id: "TL-0001",
      record_type: "event",
      timeline_status: "integrated",
      date: { start: "2024-05-01", end: null, precision: "day" },
      title: { it: "Incidente", en: "Incident" },
      description: { it: "Descrizione", en: "Description" },
      category: null,
      themes: ["cyber"],
      geography: { it: "Italia", en: "Italy" },
      places: ["IT"],
      evidence_note: null,
      evidence_level: "E2",
      publisher: null,
      url: null,
      sources: ["S01"],
      known_issues: [],
      review: { status: "reviewed", notes: [] },
      provenance: [],
    };
    const org: Entity = {
      id: "ORG_TEST",
      kind: "organization",
      name: { it: "Ente Test" },
      domain: "institutional",
      country: null,
      external_ids: { wikidata_qid: "Q12345" },
      review: { status: "reviewed", notes: [] },
      provenance: [],
    };
    const person: Entity = {
      id: "PERSON_TEST",
      kind: "person",
      name: { it: "Mario Rossi" },
      domain: "persons",
      country: null,
      review: { status: "reviewed", notes: [] },
      provenance: [],
    };
    const source: Source = {
      id: "S01",
      type: "external_reference",
      title: { it: "Rapporto Ufficiale", en: "Official Report" },
      publisher: "EU Council",
      files: [],
      urls: ["https://example.org/report"],
      cited_in: [],
      review: { status: "reviewed", notes: [] },
      provenance: [],
    };

    const evLd = eventJsonLd({
      lang: "en",
      pageUrl: "https://example.org/en/events/TL-0001/",
      event,
      sources: [source],
    });
    expect(evLd["@type"]).toBe("Event");
    expect((evLd as { location?: unknown }).location).toEqual([{ "@type": "Country", name: "IT" }]);

    expect(
      entityJsonLd({ lang: "it", pageUrl: "https://example.org/entities/ORG_TEST/", entity: org })[
        "@type"
      ],
    ).toBe("Organization");
    expect(
      entityJsonLd({
        lang: "it",
        pageUrl: "https://example.org/entities/PERSON_TEST/",
        entity: person,
      })["@type"],
    ).toBe("Person");
    expect(
      sourceJsonLd({ lang: "en", pageUrl: "https://example.org/sources/S01/", source })["@type"],
    ).toBe("CreativeWork");
  });

  it("includes robots.txt (D5 policy) and llms.txt (item 106)", () => {
    const robots = readFileSync(path.join(REPO_ROOT, "web", "public", "robots.txt"), "utf8");
    expect(robots).toContain("Sitemap:");
    expect(robots).toContain("OAI-SearchBot");
    expect(robots).toContain("GPTBot");
    expect(robots).toContain("D5");

    const llms = readFileSync(path.join(REPO_ROOT, "web", "public", "llms.txt"), "utf8");
    expect(llms).toContain("Our Enemies Monitor");
    expect(llms).toContain("data/v1/index.json");
  });
});

describe("PK-21: Citability & OG SVGs", () => {
  it("generates deterministic OG preview SVGs with XML escaping and E5 caveat for hypotheses", () => {
    const svg = renderOgSvg({
      id: "H06",
      kind: "hypothesis",
      title: "Kerimov & SpaceX <verification>",
      badge: "HYPOTHESIS · E5",
      lang: "en",
    });
    expect(svg.startsWith("<svg ")).toBe(true);
    expect(svg).toContain("H06");
    expect(svg).toContain("Kerimov &amp; SpaceX &lt;verification&gt;");
    expect(svg).toContain("not an established fact");
  });

  it("formats APA, BibTeX, and superseded/withdrawn snapshot notices", () => {
    const input = {
      id: "TL-0001",
      title: "Cyber Incident",
      url: "https://amattis96.github.io/our-enemies-monitor/en/events/TL-0001/",
      lang: "en" as const,
      generatedAt: "2026-11-25T21:00:00Z",
      snapshotId: "snap-2026-11-25-init",
      snapshotStatus: "superseded" as const,
      supersededByUrl: "https://amattis96.github.io/our-enemies-monitor/en/events/TL-0001/?v=2",
      doi: "10.5281/zenodo.123456",
    };

    const apa = formatApaCitation(input);
    expect(apa).toContain("2026");
    expect(apa).toContain("snap-2026-11-25-init");
    expect(apa).toContain("https://doi.org/10.5281/zenodo.123456");

    const bib = formatBibtexCitation(input);
    expect(bib).toContain("@misc{oem_tl_0001_2026,");
    expect(bib).toContain("doi = {10.5281/zenodo.123456}");

    const superseded = snapshotStatusNotice({
      lang: "en",
      status: "superseded",
      supersededByUrl: input.supersededByUrl,
    });
    expect(superseded?.isWarning).toBe(true);
    expect(superseded?.message).toContain("superseded");
    expect(superseded?.message).toContain(input.supersededByUrl);

    const withdrawn = snapshotStatusNotice({ lang: "it", status: "withdrawn" });
    expect(withdrawn?.isWarning).toBe(true);
    expect(withdrawn?.message).toContain("ritirato");
  });

  it("provides a valid CITATION.cff at repo root", () => {
    const cff = readFileSync(path.join(REPO_ROOT, "CITATION.cff"), "utf8");
    expect(cff).toContain("cff-version: 1.2.0");
    expect(cff).toContain("license: CC0-1.0");
  });
});

describe("PK-23: External AI benchmark scorer", () => {
  it("separates verified vs hypothesized missing-citation causes, computes repeat variability, and never mutates on a single bad answer", () => {
    const runNov = {
      schema_version: "1.0.0" as const,
      run_id: "2026-11",
      run_date: "2026-11-25",
      snapshot_id: "snap-2026-11-25-init",
      trials: [
        {
          trial_id: "t1",
          case_id: "B1",
          mode: "findability" as const,
          corpus_available: true,
          web_search_used: true,
          language: "en" as const,
          model: "gpt-5",
          model_version: "2026-11",
          access_mode: "web_search" as const,
          prompt: "Did Kerimov finance SpaceX?",
          run_date: "2026-11-25",
          repeat_index: 1,
          cited_urls: [],
          cited_ids: [],
          answer_text: "No sources found.",
          missing_citation_causes: [
            {
              cause: "poor_indexing" as const,
              certainty: "verified" as const,
              evidence: "Search console shows page not indexed yet.",
            },
            {
              cause: "unknown" as const,
              certainty: "hypothesized" as const,
              evidence: "Possible ranking penalty.",
            },
          ],
          misinterpretations: [],
          passed: false,
        },
        {
          trial_id: "t2",
          case_id: "B1",
          mode: "findability" as const,
          corpus_available: true,
          web_search_used: true,
          language: "en" as const,
          model: "gpt-5",
          model_version: "2026-11",
          access_mode: "web_search" as const,
          prompt: "Did Kerimov finance SpaceX?",
          run_date: "2026-11-25",
          repeat_index: 2,
          cited_urls: ["https://amattis96.github.io/our-enemies-monitor/en/hypotheses/H06/"],
          cited_ids: ["H06"],
          answer_text: "Not established (H06).",
          missing_citation_causes: [],
          misinterpretations: [],
          passed: true,
        },
        {
          trial_id: "t3",
          case_id: "B2",
          mode: "interpretation" as const,
          corpus_available: true,
          web_search_used: false,
          language: "it" as const,
          model: "gpt-5",
          model_version: "2026-11",
          access_mode: "direct_corpus" as const,
          prompt: "Chi ha ordinato l'incendio di Marywilska 44?",
          run_date: "2026-11-25",
          repeat_index: 1,
          cited_urls: [],
          cited_ids: ["TL-0059"],
          answer_text: "Sentenza definitiva.",
          missing_citation_causes: [],
          misinterpretations: [
            {
              kind: "attribution_as_conviction" as const,
              note: "Conflated E2 institutional attribution with a court conviction.",
            },
          ],
          passed: false,
        },
      ],
    };

    const summary = scoreAiBenchmarkRun(runNov);
    expect(summary.findability_citation_rate).toBe(0.5);
    expect(summary.interpretation_pass_rate).toBe(0);
    expect(summary.variability_rate).toBe(1);
    expect(summary.verified_missing_citation_causes.poor_indexing).toBe(1);
    expect(summary.hypothesized_missing_citation_causes.unknown).toBe(1);
    expect(summary.misinterpretation_counts.attribution_as_conviction).toBe(1);
    expect(summary.requires_page_mutation).toBe(false);
    expect(summary.review_candidates).toEqual([]);

    const runDec = {
      ...runNov,
      run_id: "2026-12",
      run_date: "2026-12-25",
      trials: runNov.trials.map((t) => ({ ...t, run_date: "2026-12-25", passed: true })),
    };
    const cmp = compareMonthlyRuns(runNov, runDec);
    expect(cmp.interpretation_pass_rate_delta).toBe(1);
  });
});
