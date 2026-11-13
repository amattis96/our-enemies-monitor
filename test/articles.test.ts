import { beforeAll, describe, expect, it } from "vitest";
import { Article, ArticleFrontMatterIt, type Dataset } from "../src/model/index.ts";
import {
  type ArticleFile,
  articleSourceHash,
  bodyProblems,
  readArticleFiles,
  splitFrontMatter,
  validateArticleFiles,
} from "../src/pipeline/articles.ts";
import { readDataFiles } from "../src/pipeline/load.ts";
import { validateDataFiles } from "../src/pipeline/validate.ts";
import {
  articleBacklinks,
  articleLanguages,
  articleMarkdown,
  loadPublishedArticles,
  publicationIssues,
  publishedArticles,
  renderArticleHtml,
  withheldReasons,
} from "../src/site/articles.ts";
import { publishedDataset } from "../src/site/publication.ts";
import { buildReadModel } from "../src/site/read-model.ts";

let raw: Dataset;
let published: Dataset;
beforeAll(() => {
  raw = validateDataFiles(readDataFiles()).dataset;
  published = publishedDataset(raw);
});

type ItOptions = {
  id?: string;
  fixture?: boolean;
  title?: string;
  status?: "needs_review" | "reviewed";
  kind?: "human" | "ai" | "fixture";
  events?: string[];
  entities?: string[];
  hypotheses?: string[];
  sources?: string[];
  body?: string;
};

/** A minimal valid real (non-fixture) Italian article file, with overrides. */
function italianFile(options: ItOptions = {}): ArticleFile {
  const {
    id = "ART-0001",
    fixture = false,
    title = "Titolo di prova",
    status = "reviewed",
    kind = "ai",
    events = ["TL-0001"],
    entities = ["RU"],
    hypotheses = [],
    sources = ["S06"],
    body = "## Sezione\n\nTesto.",
  } = options;
  const list = (ids: string[]) => `[${ids.join(", ")}]`;
  const text = `---
id: ${id}
lang: it
fixture: ${fixture}
title: ${JSON.stringify(title)}
summary: "Sommario."
date: "2026-11-12"
updated: null
generated_by: { kind: ${kind}, tool: "test", run_date: null }
links:
  events: ${list(events)}
  entities: ${list(entities)}
  relationships: []
  hypotheses: ${list(hypotheses)}
references:
${sources.map((s) => `  - source: ${s}`).join("\n")}
review: { status: ${status}, notes: [] }
---
${body}
`;
  return { path: `content/articles/${id}.it.md`, text };
}

function englishFile(id: string, hash: string, title = "Test title"): ArticleFile {
  return {
    path: `content/articles/${id}.en.md`,
    text: `---
id: ${id}
lang: en
title: ${JSON.stringify(title)}
summary: "Summary."
translation: { status: machine, source_hash: "${hash}" }
---
## Section

Text.
`,
  };
}

const errorsOf = (files: ArticleFile[]) =>
  validateArticleFiles(files, raw).issues.filter((issue) => issue.severity === "error");

describe("article schema", () => {
  it("parses the canonical Italian front matter", () => {
    const split = splitFrontMatter(italianFile().text);
    expect(split?.body).toBe("## Sezione\n\nTesto.");
    const parsed = ArticleFrontMatterIt.safeParse(split?.data);
    expect(parsed.success).toBe(true);
  });

  it("requires at least one reference and a full publication date", () => {
    const split = splitFrontMatter(italianFile().text);
    const data = split?.data as Record<string, unknown>;
    expect(ArticleFrontMatterIt.safeParse({ ...data, references: [] }).success).toBe(false);
    expect(ArticleFrontMatterIt.safeParse({ ...data, date: "2026-11" }).success).toBe(false);
    expect(ArticleFrontMatterIt.safeParse({ ...data, fixture: undefined }).success).toBe(false);
  });

  it("never accepts imported_unreviewed articles", () => {
    const { articles } = validateArticleFiles([italianFile()], raw);
    const article = articles[0];
    expect(article).toBeDefined();
    const bad = { ...article, review: { status: "imported_unreviewed", notes: [] } };
    expect(Article.safeParse(bad).success).toBe(false);
  });

  it("validates every article in content/articles", () => {
    const { articles, issues } = validateArticleFiles(readArticleFiles(), raw);
    expect(issues.filter((issue) => issue.severity === "error")).toEqual([]);
    expect(publicationIssues(articles, published)).toEqual([]);
    expect(articles.length).toBeGreaterThan(0);
  });

  it("keeps fixtures unmistakable: flag, ID, title prefix and status agree", () => {
    expect(errorsOf([italianFile({ id: "ART-DEMO-009" })]).map((e) => e.message)).toContain(
      "fixture: true is required exactly for ART-DEMO-NNN IDs",
    );
    expect(errorsOf([italianFile({ fixture: true })]).map((e) => e.message)).toContain(
      "fixture: true is required exactly for ART-DEMO-NNN IDs",
    );
    const fixture = { id: "ART-DEMO-009", fixture: true, kind: "fixture" as const };
    const messages = errorsOf([italianFile({ ...fixture, title: "Prova" })]).map((e) => e.message);
    expect(messages).toContain('fixture title (it) must start with "DEMO / TEST"');
    expect(messages).toContain("a fixture can never be reviewed");
    expect(
      errorsOf([italianFile({ ...fixture, title: "DEMO / TEST — x", status: "needs_review" })]),
    ).toEqual([]);
    expect(errorsOf([italianFile({ kind: "fixture" })]).map((e) => e.message)).toContain(
      "generated_by.kind: fixture is reserved for fixtures",
    );
    for (const article of validateArticleFiles(readArticleFiles(), raw).articles) {
      expect(article.fixture).toBe(article.id.startsWith("ART-DEMO-"));
      if (article.fixture) {
        expect(article.title.it.startsWith("DEMO / TEST")).toBe(true);
        if (article.title.en) expect(article.title.en.startsWith("DEMO / TEST")).toBe(true);
      }
    }
  });

  it("rejects raw HTML and level-1 headings in the body", () => {
    expect(bodyProblems('<script>alert("x")</script>')).toContain("raw HTML is not allowed");
    expect(bodyProblems("# Title")).toContain("level-1 heading in body (start sections at ##)");
    expect(bodyProblems("Se a < b allora")).toEqual([]);
    expect(errorsOf([italianFile({ body: "<div>x</div>" })]).map((e) => e.message)).toContain(
      "raw HTML is not allowed",
    );
  });
});

describe("article reference resolution", () => {
  it("reports unknown events, entities, hypotheses and sources", () => {
    const messages = errorsOf([
      italianFile({
        events: ["TL-9999"],
        entities: ["NOPE"],
        hypotheses: ["H99"],
        sources: ["S99"],
      }),
    ]).map((e) => e.message);
    expect(messages).toEqual(
      expect.arrayContaining([
        "links.events: unknown ID TL-9999",
        "links.entities: unknown ID NOPE",
        "links.hypotheses: unknown ID H99",
        "references: unknown source S99",
      ]),
    );
  });

  it("matches file names, ids and the Italian original", () => {
    const renamed = { ...italianFile(), path: "content/articles/ART-0002.it.md" };
    expect(errorsOf([renamed]).map((e) => e.message)).toContain(
      "front matter id ART-0001 does not match file name",
    );
    expect(errorsOf([englishFile("ART-0001", "0000000000000000")]).map((e) => e.message)).toContain(
      "English translation without the canonical Italian file",
    );
  });

  it("checks the English source hash against the Italian text", () => {
    const it = italianFile();
    const split = splitFrontMatter(it.text);
    const front = ArticleFrontMatterIt.parse(split?.data);
    const hash = articleSourceHash({ ...front, body: split?.body ?? "" });
    expect(errorsOf([it, englishFile("ART-0001", hash)])).toEqual([]);
    expect(
      errorsOf([it, englishFile("ART-0001", "0000000000000000")]).map((e) => e.message),
    ).toEqual([
      "English translation is stale: the Italian text changed (re-translate or remove it)",
    ]);
  });
});

describe("article publication gate", () => {
  const parse = (options: ItOptions) => {
    const { articles } = validateArticleFiles([italianFile(options)], raw);
    const article = articles[0];
    if (!article) throw new Error("article did not parse");
    return article;
  };

  it("publishes reviewed articles that link only public records", () => {
    const article = parse({});
    expect(withheldReasons(article, published)).toEqual([]);
    expect(publishedArticles([article], published)).toEqual([article]);
  });

  it("withholds needs_review articles that are not fixtures", () => {
    const article = parse({ status: "needs_review" });
    expect(withheldReasons(article, published)).toEqual(["review status needs_review"]);
    expect(publishedArticles([article], published)).toEqual([]);
  });

  it("shows needs_review fixtures, which must carry the test banner", () => {
    const fixture = parse({
      id: "ART-DEMO-009",
      fixture: true,
      kind: "fixture",
      title: "DEMO / TEST — x",
      status: "needs_review",
    });
    expect(publishedArticles([fixture], published)).toEqual([fixture]);
  });

  it("never leaks a withheld record through an article", () => {
    // EXT-005 is a Fonte_09 candidate: in Git, withheld from the site.
    expect(raw.events.some((event) => event.id === "EXT-005")).toBe(true);
    expect(published.events.some((event) => event.id === "EXT-005")).toBe(false);
    const article = parse({ events: ["TL-0001", "EXT-005"] });
    expect(withheldReasons(article, published)).toEqual([
      "links.events: EXT-005 is withheld from the public site",
    ]);
    expect(publishedArticles([article], published)).toEqual([]);
    expect(articleBacklinks(publishedArticles([article], published)).has("TL-0001")).toBe(false);

    const fixture = parse({
      id: "ART-DEMO-009",
      fixture: true,
      kind: "fixture",
      title: "DEMO / TEST — x",
      status: "needs_review",
      events: ["EXT-005"],
    });
    expect(publicationIssues([fixture], published).map((issue) => issue.message)).toEqual([
      "fixture links a withheld record (links.events: EXT-005 is withheld from the public site)",
    ]);
    expect(() => loadPublishedArticles(raw, [italianFile({ events: ["TL-9999"] })])).toThrow(
      /unknown ID TL-9999/,
    );
  });

  it("builds back-links only from public articles", () => {
    const visible = parse({});
    const hidden = parse({ id: "ART-0002", status: "needs_review", entities: ["GRU"] });
    const links = articleBacklinks(publishedArticles([visible, hidden], published));
    expect(links.get("TL-0001")).toEqual([visible]);
    expect(links.get("RU")).toEqual([visible]);
    expect(links.has("GRU")).toBe(false);
  });
});

describe("article rendering and Markdown export", () => {
  const url = (path: string, lang: string) =>
    `https://example.org/oem/${lang === "it" ? "" : `${lang}/`}${path}`;

  it("renders Markdown safely", () => {
    const html = renderArticleHtml(
      "## A\n\n| x | y |\n| --- | --- |\n| 1 | 2 |\n\n<script>alert(1)</script>\n\n[x](javascript:alert(1))",
    );
    expect(html).toContain("<h2>A</h2>");
    expect(html).toContain("<table>");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("javascript:");
  });

  it("exports a standalone Markdown file for each approved article language", () => {
    const model = buildReadModel(published);
    const articles = loadPublishedArticles(raw);
    const article = articles.find((item) => item.id === "ART-0001");
    if (!article) throw new Error("approved ART-0001 missing");
    expect(articleLanguages(article)).toEqual(["it", "en"]);

    const it = articleMarkdown(article, "it", model, url);
    expect(it.startsWith("---\nid: ART-0001\nlang: it\n")).toBe(true);
    expect(it).toContain("fixture: false");
    expect(it).toContain("review_status: reviewed");
    expect(it).toContain("canonical_url: https://example.org/oem/articles/ART-0001/");
    expect(it).toContain(`# ${article.title.it}`);
    expect(it).toContain(article.body.it);
    expect(it).toContain("## Riferimenti\n\n");
    expect(it).toContain("https://example.org/oem/sources/S01/");
    expect(it).toContain("- Evento TL-0015: ");
    expect(it).toContain("https://example.org/oem/events/TL-0015/");
    expect(it.endsWith("\n")).toBe(true);

    const en = articleMarkdown(article, "en", model, url);
    expect(en).toContain("lang: en");
    expect(en).toContain("translation_status: machine");
    expect(en).toContain("Machine translation from Italian, not yet reviewed.");
    expect(en).toContain("## References");
    expect(en).toContain("https://example.org/oem/en/events/TL-0015/");

    const { articles: synthetic } = validateArticleFiles([italianFile({ id: "ART-9998" })], raw);
    const italianOnly = synthetic[0];
    if (!italianOnly) throw new Error("synthetic Italian-only article missing");
    expect(articleLanguages(italianOnly)).toEqual(["it"]);
    expect(() => articleMarkdown(italianOnly, "en", model, url)).toThrow(/no en text/);
  });

  it("formats external URL references with access dates", () => {
    const model = buildReadModel(published);
    const article = loadPublishedArticles(raw).find((item) => item.id === "ART-0002");
    if (!article) throw new Error("approved ART-0002 missing");
    const output = articleMarkdown(article, "en", model, url);
    expect(output).toContain("Joint investigation team disrupts group using self-igniting parcels");
    expect(output).toContain(
      "https://www.eurojust.europa.eu/news/joint-investigation-team-disrupts-group-using-self-igniting-parcels-terrorist-attacks",
    );
    expect(output).toContain("accessed 2026-11-13");
    expect(output).toContain("https://example.org/oem/en/entities/GRU/");
  });
});
