import type { Article, Dataset } from "../model/index.ts";
import { COLLECTION_NAMES } from "../model/index.ts";
import { exportArticles, exportCommit, exportHistory } from "./exports.ts";
import type { DataCommit } from "./history.ts";
import { publicArticles } from "./packages.ts";
import { publicationReport } from "./publication.ts";
import { loadReadModel } from "./read-model.ts";

/**
 * `lastmod` of sitemap URLs (FABLE D §6). Every date comes from Git history
 * or from an article's own dates, never from the wall clock: a record page
 * takes the date of the newest commit that added or modified the record; an
 * article page its `updated` (else `date`); any other page the date of the
 * exported commit. Only published IDs are indexed, so a withheld record has
 * no date and its page (which does not exist) is never mapped.
 */

const RECORD_PAGES = new Set(["events", "entities", "hypotheses", "sources"]);

/** Published record ID → `YYYY-MM-DD` of the newest commit that added or modified it. */
export function recordLastmods(
  history: readonly DataCommit[],
  published: Dataset,
): Map<string, string> {
  const publishedIds = new Set(COLLECTION_NAMES.flatMap((n) => published[n].map((r) => r.id)));
  const dates = new Map<string, string>();
  for (const commit of history) {
    const day = commit.date.slice(0, 10);
    for (const touch of commit.records) {
      if (touch.status === "removed" || !publishedIds.has(touch.id)) continue;
      const known = dates.get(touch.id);
      if (known === undefined || day > known) dates.set(touch.id, day);
    }
  }
  return dates;
}

export type LastmodSources = {
  records: ReadonlyMap<string, string>;
  /** Public articles only. */
  articles: readonly Article[];
  /** Date of the exported commit (`YYYY-MM-DD`), when Git is available. */
  fallback: string | null;
};

/** Resolver from a page path inside the site (language prefix allowed) to a `lastmod`. */
export function lastmodResolver({ records, articles, fallback }: LastmodSources) {
  const articleDates = new Map(articles.map((a) => [a.id, a.updated ?? a.date]));
  return (sitePath: string): string | undefined => {
    const segments = sitePath.split("/").filter(Boolean);
    if (segments[0] === "en") segments.shift();
    const [section, id] = segments;
    if (segments.length === 2 && section && id) {
      if (RECORD_PAGES.has(section)) return records.get(id) ?? fallback ?? undefined;
      if (section === "articles") return articleDates.get(id) ?? fallback ?? undefined;
    }
    return fallback ?? undefined;
  };
}

/** Path of an absolute sitemap URL relative to the site root (`base` without trailing slash). */
export function sitePathOf(url: string, siteOrigin: string, base: string): string {
  const path = new URL(url, siteOrigin).pathname;
  return path.startsWith(`${base}/`) ? path.slice(base.length) : path;
}

/** Resolver over the real repository: public projection, Git history, public articles. */
export function repositoryLastmodResolver() {
  const published = publicationReport(loadReadModel().dataset).dataset;
  return lastmodResolver({
    records: recordLastmods(exportHistory(), published),
    articles: publicArticles(exportArticles(), published),
    fallback: exportCommit().commit_date?.slice(0, 10) ?? null,
  });
}
