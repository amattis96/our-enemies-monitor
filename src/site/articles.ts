import { micromark } from "micromark";
import { gfm, gfmHtml } from "micromark-extension-gfm";
import type { Article, ArticleReference, Dataset, Language } from "../model/index.ts";
import { type ArticleFile, readArticleFiles, validateArticleFiles } from "../pipeline/articles.ts";
import type { Issue } from "../pipeline/validate.ts";
import { formatPredicate } from "./format.ts";
import { pick, textOf } from "./i18n.ts";
import { publishedDataset } from "./publication.ts";
import type { ReadModel } from "./read-model.ts";

/**
 * Public rules for editorial articles (M6). An article is published only
 * when it is reviewed and every record or source it links is itself public,
 * so an article can never surface a withheld record. Demo fixtures are the
 * one exception to the review rule: they are shown with a test banner, and
 * they may link only public records (a validation error otherwise).
 */

const LINK_COLLECTIONS = ["events", "entities", "relationships", "hypotheses"] as const;

/** Reasons an article is withheld from the public site; empty = published. */
export function withheldReasons(article: Article, published: Dataset): string[] {
  const reasons: string[] = [];
  if (article.review.status !== "reviewed" && !article.fixture) {
    reasons.push(`review status ${article.review.status}`);
  }
  for (const collection of LINK_COLLECTIONS) {
    const ids = new Set(published[collection].map((record) => record.id));
    for (const id of article.links[collection]) {
      if (!ids.has(id)) reasons.push(`links.${collection}: ${id} is withheld from the public site`);
    }
  }
  const sources = new Set(published.sources.map((source) => source.id));
  for (const reference of article.references) {
    if ("source" in reference && !sources.has(reference.source)) {
      reasons.push(`references: ${reference.source} is withheld from the public site`);
    }
  }
  return reasons;
}

/** Errors of the publication rules: a fixture must be publishable as it stands. */
export function publicationIssues(articles: Article[], published: Dataset): Issue[] {
  return articles.flatMap((article) =>
    article.fixture
      ? withheldReasons(article, published).map((reason) => ({
          severity: "error" as const,
          file: `content/articles/${article.id}.it.md`,
          message: `fixture links a withheld record (${reason})`,
        }))
      : [],
  );
}

/** Newest first, then by ID. */
export function compareArticles(a: Article, b: Article): number {
  return b.date.localeCompare(a.date) || a.id.localeCompare(b.id);
}

export function publishedArticles(articles: Article[], published: Dataset): Article[] {
  return articles
    .filter((article) => withheldReasons(article, published).length === 0)
    .sort(compareArticles);
}

/**
 * Validate the article files against the canonical dataset and return the
 * public articles. Throws on any error so an invalid article never builds.
 */
export function loadPublishedArticles(
  dataset: Dataset,
  files: ArticleFile[] = readArticleFiles(),
): Article[] {
  const published = publishedDataset(dataset);
  const { articles, issues } = validateArticleFiles(files, dataset);
  const errors = [...issues, ...publicationIssues(articles, published)].filter(
    (issue) => issue.severity === "error",
  );
  if (errors.length > 0) {
    const details = errors.slice(0, 10).map((e) => `${e.file}: ${e.message}`);
    throw new Error(`Invalid articles, run pnpm validate:articles:\n${details.join("\n")}`);
  }
  return publishedArticles(articles, published);
}

/** Record ID → public articles that link it (events, entities, relationships, hypotheses). */
export function articleBacklinks(articles: Article[]): Map<string, Article[]> {
  const map = new Map<string, Article[]>();
  for (const article of articles) {
    for (const collection of LINK_COLLECTIONS) {
      for (const id of article.links[collection]) map.set(id, [...(map.get(id) ?? []), article]);
    }
  }
  return map;
}

/** Languages with a complete text (Italian always; English when translated). */
export function articleLanguages(article: Article): Language[] {
  return article.body.en === undefined ? ["it"] : ["it", "en"];
}

/**
 * Markdown → HTML. micromark is safe by default: raw HTML is escaped and
 * dangerous URL schemes are dropped, so article text cannot inject markup.
 */
export function renderArticleHtml(markdown: string): string {
  return micromark(markdown, { extensions: [gfm()], htmlExtensions: [gfmHtml()] });
}

// ---------------------------------------------------------------------------
// Markdown export: one self-contained file per article and language

/** Absolute URL of a site page (`path` without base, e.g. `events/TL-0001/`). */
export type PageUrl = (path: string, lang: Language) => string;

export type LinkedRecord = {
  collection: (typeof LINK_COLLECTIONS)[number];
  id: string;
  label: string;
  path: string;
};

/** Linked records with labels and page paths, in a stable order. */
export function linkedRecords(article: Article, model: ReadModel, lang: Language): LinkedRecord[] {
  const { links } = article;
  return [
    ...links.events.map((id) => ({
      collection: "events" as const,
      id,
      label: model.nodeLabel(id, lang),
      path: `events/${id}/`,
    })),
    ...links.entities.map((id) => ({
      collection: "entities" as const,
      id,
      label: model.nodeLabel(id, lang),
      path: `entities/${id}/`,
    })),
    ...links.relationships.flatMap((id) => {
      const relation = model.dataset.relationships.find((r) => r.id === id);
      if (!relation) return [];
      return [
        {
          collection: "relationships" as const,
          id,
          label: `${model.nodeLabel(relation.subject, lang)} — ${formatPredicate(relation.predicate)} — ${model.nodeLabel(relation.object, lang)}`,
          path: `entities/${model.nodeKind(relation.subject) === "event" ? relation.object : relation.subject}/`,
        },
      ];
    }),
    ...links.hypotheses.flatMap((id) => {
      const hypothesis = model.hypothesis(id);
      return hypothesis
        ? [
            {
              collection: "hypotheses" as const,
              id,
              label: textOf(hypothesis.question, lang),
              path: `hypotheses/${id}/`,
            },
          ]
        : [];
    }),
  ];
}

/** One line of the reference list, as Markdown. */
export function referenceMarkdown(
  reference: ArticleReference,
  model: ReadModel,
  lang: Language,
  url: PageUrl,
): string {
  if ("source" in reference) {
    const source = model.source(reference.source);
    const title = source ? textOf(source.title, lang) : reference.source;
    const note = reference.note ? ` — ${reference.note}` : "";
    return `[${reference.source}] ${title}. ${url(`sources/${reference.source}/`, lang)}${note}`;
  }
  const parts = [
    reference.title,
    reference.publisher,
    reference.published,
    reference.url,
    `${STRINGS[lang].accessed} ${reference.accessed}`,
  ].filter((part) => part !== null);
  return parts.join(". ");
}

const STRINGS = {
  it: {
    fixture:
      "DEMO / TEST — Contenuto di prova generato per verificare la sezione articoli. Non è un'analisi reale e non aggiunge fatti alla base di conoscenza.",
    review: "Bozza in attesa di revisione editoriale.",
    machine: "Traduzione automatica dall'italiano, non ancora rivista.",
    references: "Riferimenti",
    linked: "Record collegati",
    accessed: "consultato il",
    collections: {
      events: "Evento",
      entities: "Entità",
      relationships: "Relazione",
      hypotheses: "Ipotesi (non accertata)",
    },
  },
  en: {
    fixture:
      "DEMO / TEST — Test content generated to exercise the articles section. It is not a real analysis and adds no facts to the knowledge base.",
    review: "Draft awaiting editorial review.",
    machine: "Machine translation from Italian, not yet reviewed.",
    references: "References",
    linked: "Linked records",
    accessed: "accessed",
    collections: {
      events: "Event",
      entities: "Entity",
      relationships: "Relationship",
      hypotheses: "Hypothesis (not established)",
    },
  },
} as const;

/**
 * Standalone Markdown of an article in one language: front matter, notices,
 * body, references and linked records with absolute URLs. Language must be
 * one of `articleLanguages(article)`.
 */
export function articleMarkdown(
  article: Article,
  lang: Language,
  model: ReadModel,
  url: PageUrl,
): string {
  const t = STRINGS[lang];
  const text = (value: Article["title"]) => {
    const chosen = pick(value, lang);
    if (chosen.fallback) throw new Error(`${article.id} has no ${lang} text`);
    return chosen.value;
  };
  const translation = lang === "it" ? null : article.review.translations?.[lang];
  const frontMatter = [
    `id: ${article.id}`,
    `lang: ${lang}`,
    `title: ${JSON.stringify(text(article.title))}`,
    `date: ${article.date}`,
    `updated: ${article.updated ?? "null"}`,
    `fixture: ${article.fixture}`,
    `review_status: ${article.review.status}`,
    ...(translation ? [`translation_status: ${translation.status}`] : []),
    `canonical_url: ${url(`articles/${article.id}/`, lang)}`,
  ];
  const notices = [
    article.fixture ? t.fixture : null,
    article.review.status === "reviewed" || article.fixture ? null : t.review,
    translation?.status === "machine" ? t.machine : null,
  ].filter((notice) => notice !== null);
  const references = article.references.map(
    (reference, index) => `${index + 1}. ${referenceMarkdown(reference, model, lang, url)}`,
  );
  const linked = linkedRecords(article, model, lang).map(
    (record) =>
      `- ${t.collections[record.collection]} ${record.id}: ${record.label}. ${url(record.path, lang)}`,
  );
  const sections = [
    `---\n${frontMatter.join("\n")}\n---`,
    ...notices.map((notice) => `> **${notice}**`),
    `# ${text(article.title)}`,
    `*${text(article.summary)}*`,
    text(article.body),
    `## ${t.references}\n\n${references.join("\n")}`,
    ...(linked.length > 0 ? [`## ${t.linked}\n\n${linked.join("\n")}`] : []),
  ];
  return `${sections.join("\n\n")}\n`;
}
