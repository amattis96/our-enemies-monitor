import { COLLECTION_NAMES, type CollectionName, type Dataset } from "../model/index.ts";
import { type ExportCommit, exportCommit, latestPublicEventDate } from "./exports.ts";
import { type PublicationReport, publicationReport } from "./publication.ts";

export type CanonicalCounts = {
  published: Record<CollectionName, number>;
  withheld: Record<CollectionName, number>;
  total_published: number;
  total_withheld: number;
  snapshot_date: string | null;
  commit: string | null;
  commit_date: string | null;
  latest_public_event_date: string | null;
};

function reportOf(input: Dataset | PublicationReport): PublicationReport {
  return "kind" in input ? input : publicationReport(input);
}

/**
 * Single canonical counts & snapshot-date summary for templates and exports.
 * All counts derive from the public projection and publication report.
 */
export function canonicalCounts(
  input: Dataset | PublicationReport,
  commit: ExportCommit = exportCommit(),
): CanonicalCounts {
  const report = reportOf(input);
  const dataset = report.dataset;
  const published = Object.fromEntries(
    COLLECTION_NAMES.map((name) => [name, dataset[name].length]),
  ) as Record<CollectionName, number>;
  const withheld = { ...report.counts };
  const total_published = COLLECTION_NAMES.reduce((sum, name) => sum + published[name], 0);
  const total_withheld = COLLECTION_NAMES.reduce((sum, name) => sum + withheld[name], 0);
  const latest_public_event_date = latestPublicEventDate(dataset);
  const snapshot_date = commit.commit_date?.slice(0, 10) ?? latest_public_event_date;

  return {
    published,
    withheld,
    total_published,
    total_withheld,
    snapshot_date,
    commit: commit.commit,
    commit_date: commit.commit_date,
    latest_public_event_date,
  };
}
