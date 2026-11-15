import type { Article, Language } from "../model/index.ts";
import { pick, textOf } from "./i18n.ts";
import { REPOSITORY_URL } from "./packages.ts";

/**
 * Minimal schema.org JSON-LD (FABLE D §7.3): a `Dataset` for the open-data
 * page and an `Article` for each published editorial article. Builders take
 * only data that is already public; they never read canonical records.
 */

export const CC0_URL = "https://creativecommons.org/publicdomain/zero/1.0/";

/**
 * Serialize for an inline `<script type="application/ld+json">`: the characters
 * that could close the script element or start an HTML comment are written as
 * JSON unicode escapes, which any JSON parser reads back unchanged.
 */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026")
    .replaceAll(" ", "\\u2028")
    .replaceAll(" ", "\\u2029");
}

type DatasetInput = {
  /** Absolute URL of the site root, no trailing slash (e.g. `https://host/base`). */
  siteUrl: string;
  lang: Language;
  /** Absolute URL of the page itself. */
  pageUrl: string;
  commit: string | null;
  commitDate: string | null;
  /** Export files (`data/v1/<path>`) offered as downloads. */
  files: readonly string[];
};

export function datasetJsonLd(input: DatasetInput) {
  const it = input.lang === "it";
  return {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "Our Enemies Monitor",
    description: it
      ? "Base di conoscenza OSINT su interferenze straniere, minacce ibride e dipendenze strategiche che riguardano l'Europa: proiezione pubblica dei dati canonici, con livelli di evidenza e stato di revisione di ogni record."
      : "OSINT knowledge base on foreign interference, hybrid threats and strategic dependencies affecting Europe: public projection of the canonical data, with the evidence level and review status of every record.",
    url: input.pageUrl,
    license: CC0_URL,
    isAccessibleForFree: true,
    inLanguage: ["it", "en"],
    isBasedOn: REPOSITORY_URL,
    ...(input.commit ? { version: input.commit } : {}),
    ...(input.commitDate ? { dateModified: input.commitDate } : {}),
    distribution: input.files.map((file) => ({
      "@type": "DataDownload",
      encodingFormat: "application/json",
      contentUrl: `${input.siteUrl}/data/v1/${file}`,
    })),
  };
}

type ArticleInput = {
  siteUrl: string;
  lang: Language;
  /** Absolute URL of the page itself. */
  pageUrl: string;
  article: Article;
};

/** `null` for a demo fixture: test content never gets structured data. */
export function articleJsonLd({ siteUrl, lang, pageUrl, article }: ArticleInput) {
  if (article.fixture) return null;
  const body = pick(article.body, lang);
  const citations = article.references.flatMap((reference) =>
    "url" in reference
      ? [{ "@type": "CreativeWork", name: reference.title, url: reference.url }]
      : [],
  );
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: textOf(article.title, lang),
    description: textOf(article.summary, lang),
    url: pageUrl,
    mainEntityOfPage: pageUrl,
    inLanguage: body.fallback ? "it" : lang,
    datePublished: article.date,
    dateModified: article.updated ?? article.date,
    creativeWorkStatus: article.review.status,
    license: CC0_URL,
    isAccessibleForFree: true,
    encoding: {
      "@type": "MediaObject",
      encodingFormat: "text/markdown",
      contentUrl: `${siteUrl}/articles/${article.id}.${body.fallback ? "it" : lang}.md`,
    },
    ...(citations.length > 0 ? { citation: citations } : {}),
  };
}
