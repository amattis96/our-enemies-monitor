import type { Article, Entity, Event, Language, Source } from "../model/index.ts";
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

type EventJsonLdInput = {
  lang: Language;
  pageUrl: string;
  event: Event;
  sources?: readonly Source[];
};

/** Semantic JSON-LD for a public event record (country-level location only, never invented coordinates). */
export function eventJsonLd({ lang, pageUrl, event, sources = [] }: EventJsonLdInput) {
  const title = pick(event.title, lang);
  const description = textOf(event.description, lang);
  const citations: { "@type": "CreativeWork"; name: string; url?: string; identifier?: string }[] =
    sources.map((source) =>
      source.urls[0]
        ? { "@type": "CreativeWork", name: textOf(source.title, lang), url: source.urls[0] }
        : { "@type": "CreativeWork", name: textOf(source.title, lang), identifier: source.id },
    );
  if (event.record_type === "dataset_metadata") {
    return {
      "@context": "https://schema.org",
      "@type": "CreativeWork",
      identifier: event.id,
      name: title.value,
      description,
      url: pageUrl,
      inLanguage: title.fallback ? "it" : lang,
      dateCreated: event.date.start,
      creativeWorkStatus: event.review.status,
      license: CC0_URL,
      isAccessibleForFree: true,
    };
  }
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    identifier: event.id,
    name: title.value,
    description,
    url: pageUrl,
    inLanguage: title.fallback ? "it" : lang,
    startDate: event.date.start,
    ...(event.date.end ? { endDate: event.date.end } : {}),
    ...(event.places.length > 0
      ? {
          location: event.places.map((code) => ({
            "@type": "Country",
            name: code,
          })),
        }
      : {}),
    creativeWorkStatus: event.review.status,
    ...(event.evidence_level
      ? {
          additionalProperty: {
            "@type": "PropertyValue",
            name: "evidence_level",
            value: event.evidence_level,
          },
        }
      : {}),
    ...(citations.length > 0 ? { citation: citations } : {}),
    license: CC0_URL,
    isAccessibleForFree: true,
  };
}

type EntityJsonLdInput = {
  lang: Language;
  pageUrl: string;
  entity: Entity;
};

function schemaTypeForEntityKind(kind: Entity["kind"]): string {
  switch (kind) {
    case "person":
      return "Person";
    case "state":
      return "Country";
    case "organization":
    case "institution":
    case "company":
      return "Organization";
    case "asset":
      return "Thing";
  }
}

/** Semantic JSON-LD for a public entity (Organization, Person, Country, or Thing). */
export function entityJsonLd({ lang, pageUrl, entity }: EntityJsonLdInput) {
  const name = pick(entity.name, lang);
  const sameAs: string[] = [];
  if (entity.external_ids?.wikidata_qid) {
    sameAs.push(`https://www.wikidata.org/wiki/${entity.external_ids.wikidata_qid}`);
  }
  if (entity.external_ids?.official_website) {
    sameAs.push(entity.external_ids.official_website);
  }
  const alternateName = entity.aliases?.map((alias) => alias.name) ?? [];
  return {
    "@context": "https://schema.org",
    "@type": schemaTypeForEntityKind(entity.kind),
    identifier: entity.id,
    name: name.value,
    url: pageUrl,
    inLanguage: name.fallback ? "it" : lang,
    additionalType: entity.kind,
    ...(entity.country ? { addressCountry: entity.country } : {}),
    ...(alternateName.length > 0 ? { alternateName } : {}),
    ...(sameAs.length > 0 ? { sameAs } : {}),
    ...(entity.external_ids?.lei ? { leiCode: entity.external_ids.lei } : {}),
    creativeWorkStatus: entity.review.status,
  };
}

export function organizationJsonLd(input: EntityJsonLdInput) {
  return entityJsonLd(input);
}

export function personJsonLd(input: EntityJsonLdInput) {
  return entityJsonLd(input);
}

type SourceJsonLdInput = {
  lang: Language;
  pageUrl: string;
  source: Source;
};

/** Semantic JSON-LD for a public source record. */
export function sourceJsonLd({ lang, pageUrl, source }: SourceJsonLdInput) {
  const title = pick(source.title, lang);
  return {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    identifier: source.id,
    name: title.value,
    url: pageUrl,
    inLanguage: title.fallback ? "it" : lang,
    ...(source.publisher
      ? {
          publisher: {
            "@type": "Organization",
            name: source.publisher,
          },
        }
      : {}),
    ...(source.urls.length > 0 ? { sameAs: source.urls } : {}),
    ...(source.origin_type
      ? {
          additionalProperty: {
            "@type": "PropertyValue",
            name: "origin_type",
            value: source.origin_type,
          },
        }
      : {}),
    creativeWorkStatus: source.review.status,
  };
}
