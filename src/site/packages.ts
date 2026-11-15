import {
  type Article,
  COLLECTION_NAMES,
  type CollectionName,
  type Dataset,
} from "../model/index.ts";
import { withheldReasons } from "./articles.ts";
import type { DataCommit } from "./history.ts";

/**
 * Machine-readable packages derived from the SAME public projection as the
 * pages and the collection exports (FABLE D A6–A11, A14–A15): one package per
 * published record, the editorial articles index and the changes feed. Nothing
 * here reads canonical data directly, so a withheld record, a restricted person
 * link or an unpublished article cannot appear. Content is deterministic for a
 * given commit (no wall clock).
 */

export const REPOSITORY_URL = "https://github.com/amattis96/our-enemies-monitor";

/** Commit identity, as in the export manifest. */
export type PackageCommit = { commit: string | null; commit_date: string | null };

/** Newest records in the feed; the full history stays in Git. */
export const FEED_MAX_ITEMS = 50;

const compact = (value: unknown) => `${JSON.stringify(value)}\n`;

/** Site-relative page paths of a record (`null` where it has no page of its own). */
export function recordPages(
  collection: CollectionName,
  id: string,
): { it: string; en: string } | null {
  switch (collection) {
    case "events":
    case "entities":
    case "hypotheses":
    case "sources":
      return { it: `${collection}/${id}/`, en: `en/${collection}/${id}/` };
    case "exposures":
      return { it: `dependencies/#${id}`, en: `en/dependencies/#${id}` };
    default:
      return null;
  }
}

type Related = Record<CollectionName, string[]>;

/** ID → collection over the public dataset (IDs are unique across collections). */
function collectionOf(dataset: Dataset): Map<string, CollectionName> {
  const map = new Map<string, CollectionName>();
  for (const name of COLLECTION_NAMES) {
    for (const record of dataset[name]) map.set(record.id, name);
  }
  return map;
}

/** Forward references a record states in its own fields. */
function forwardRefs(record: object): string[] {
  const fields = record as Record<string, unknown>;
  const refs: string[] = [];
  for (const key of ["subject", "object"]) {
    if (typeof fields[key] === "string") refs.push(fields[key]);
  }
  for (const key of ["events", "sources"]) {
    const value = fields[key];
    if (Array.isArray(value)) refs.push(...value.filter((v): v is string => typeof v === "string"));
  }
  return refs;
}

/** Public records each record points to or is pointed at by, per collection, sorted. */
export function relatedIndex(dataset: Dataset): Map<string, Related> {
  const where = collectionOf(dataset);
  const sets = new Map<string, Map<CollectionName, Set<string>>>();
  const link = (from: string, to: string) => {
    const target = where.get(to);
    if (!target || from === to) return;
    const byCollection = sets.get(from) ?? new Map<CollectionName, Set<string>>();
    byCollection.set(target, (byCollection.get(target) ?? new Set()).add(to));
    sets.set(from, byCollection);
  };
  for (const name of COLLECTION_NAMES) {
    for (const record of dataset[name]) {
      for (const ref of forwardRefs(record)) {
        link(record.id, ref);
        link(ref, record.id);
      }
    }
  }
  const index = new Map<string, Related>();
  for (const id of where.keys()) {
    const related = Object.fromEntries(
      COLLECTION_NAMES.map((name) => [name, [...(sets.get(id)?.get(name) ?? [])].sort()]),
    ) as Related;
    index.set(id, related);
  }
  return index;
}

/** One package per published record: `records/<ID>.json`. */
export function buildRecordPackages(
  dataset: Dataset,
  commit: PackageCommit,
  exportVersion: string,
): { path: string; text: string }[] {
  const related = relatedIndex(dataset);
  return COLLECTION_NAMES.flatMap((collection) =>
    dataset[collection].map((record) => {
      const repositoryPath = `data/${collection}/${record.id}.json`;
      const short = commit.commit?.slice(0, 7);
      const day = commit.commit_date?.slice(0, 10);
      const text = [
        `Our Enemies Monitor, record ${record.id} (${collection}), public export ${exportVersion}`,
        short ? `commit ${short}${day ? ` (${day})` : ""}` : null,
        "CC0-1.0",
      ]
        .filter((part) => part !== null)
        .join(", ");
      return {
        path: `records/${record.id}.json`,
        text: compact({
          export_version: exportVersion,
          id: record.id,
          collection,
          cite_as: {
            text: `${text}.`,
            commit: commit.commit,
            commit_date: commit.commit_date,
            license: "CC0-1.0",
            pages: recordPages(collection, record.id),
            repository_path: repositoryPath,
            repository_permalink: commit.commit
              ? `${REPOSITORY_URL}/blob/${commit.commit}/${repositoryPath}`
              : null,
          },
          record,
          related: related.get(record.id),
          reading_rules: "vocabulary.json",
        }),
      };
    }),
  );
}

function translationStatus(article: Article): string | null {
  return article.review.translations?.en?.status ?? null;
}

/** Publishable, non-fixture articles only: the same gate as the pages. */
export function publicArticles(articles: readonly Article[], published: Dataset): Article[] {
  return articles.filter(
    (article) => !article.fixture && withheldReasons(article, published).length === 0,
  );
}

/** `articles.json`: the editorial articles that pass the publication gate. */
export function buildArticlesIndex(
  articles: readonly Article[],
  published: Dataset,
  exportVersion: string,
) {
  return {
    export_version: exportVersion,
    note: "Editorial analyses, not canonical records. Only articles that pass the publication gate (human-reviewed, every linked record and source public, not a demo fixture) are listed. Paths are relative to the site root.",
    articles: publicArticles(articles, published).map((article) => ({
      id: article.id,
      title: article.title,
      summary: article.summary,
      date: article.date,
      updated: article.updated,
      review_status: article.review.status,
      translation_status_en: translationStatus(article),
      generated_by: { kind: article.generated_by.kind, tool: article.generated_by.tool },
      pages: { it: `articles/${article.id}/`, en: `en/articles/${article.id}/` },
      markdown: {
        it: `articles/${article.id}.it.md`,
        ...(article.body.en === undefined ? {} : { en: `articles/${article.id}.en.md` }),
      },
      links: article.links,
      references: article.references,
    })),
  };
}

/** `JSON Feed 1.1` of the data changes that touch a published record. */
export function buildChangesFeed(history: readonly DataCommit[], published: Dataset) {
  const publishedIds = new Set(COLLECTION_NAMES.flatMap((n) => published[n].map((r) => r.id)));
  const items = history
    .map((commit) => ({
      ...commit,
      records: commit.records.filter(
        (touch) => touch.status !== "removed" && publishedIds.has(touch.id),
      ),
    }))
    .filter((commit) => commit.records.length > 0);
  return {
    version: "https://jsonfeed.org/version/1.1",
    title: "Our Enemies Monitor — changes to the published data",
    description: `Each item is a Git commit that added or modified published records. The ${FEED_MAX_ITEMS} newest are listed; the full history is in Git. Records removed from the data or not published are never listed.`,
    home_page_url: `${REPOSITORY_URL}/commits/main/data`,
    language: "en",
    _oem: { items_total: items.length, items_listed: Math.min(items.length, FEED_MAX_ITEMS) },
    items: items.slice(0, FEED_MAX_ITEMS).map((commit) => {
      const counts = new Map<string, number>();
      for (const touch of commit.records) {
        const key = `${touch.status} ${touch.collection}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      return {
        id: commit.sha,
        url: `${REPOSITORY_URL}/commit/${commit.sha}`,
        title: commit.subject,
        content_text: [...counts].map(([key, n]) => `${n} ${key}`).join("; "),
        date_published: commit.date,
        _oem: {
          records: commit.records.map((touch) => ({
            collection: touch.collection,
            id: touch.id,
            status: touch.status,
            package: `records/${touch.id}.json`,
          })),
        },
      };
    }),
  };
}
