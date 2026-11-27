import { z } from "zod";
import type { ExtendedTranslationStatus } from "./multilingual.ts";

export type SearchIndexEntry = {
  id: string;
  lang: string;
  url: string;
  title: string;
  body: string;
  translationStatus?: ExtendedTranslationStatus;
};

export type PartitionedSearchIndex = Record<string, SearchIndexEntry[]>;

/**
 * Partitions search index entries by language, excluding stale and
 * `machine_flagged` entries from non-canonical language partitions.
 */
export function partitionSearchIndex(entries: readonly SearchIndexEntry[]): PartitionedSearchIndex {
  const partitions: PartitionedSearchIndex = {};
  for (const entry of entries) {
    if (
      entry.lang !== "it" &&
      (entry.translationStatus === "stale" || entry.translationStatus === "machine_flagged")
    ) {
      continue;
    }
    const list = partitions[entry.lang] ?? [];
    list.push(entry);
    partitions[entry.lang] = list;
  }
  return partitions;
}

export const I18nBudgetConfigSchema = z
  .strictObject({
    maxPagesPerLanguage: z.number().int().positive().describe("Maximum static pages per language."),
    maxTotalPages: z
      .number()
      .int()
      .positive()
      .describe("Maximum total static pages across all languages."),
    maxIndexBytesPerLanguage: z
      .number()
      .int()
      .positive()
      .describe("Maximum serialized search index size in bytes per language."),
    maxEstimatedBuildSeconds: z
      .number()
      .positive()
      .describe("Maximum estimated CI build duration in seconds."),
  })
  .describe("CI build budget thresholds for multilingual static generation.");
export type I18nBudgetConfig = z.infer<typeof I18nBudgetConfigSchema>;

export const DEFAULT_I18N_BUDGET: I18nBudgetConfig = {
  maxPagesPerLanguage: 2500,
  maxTotalPages: 25000,
  maxIndexBytesPerLanguage: 5 * 1024 * 1024,
  maxEstimatedBuildSeconds: 180,
};

export type LanguageBudgetUsage = {
  lang: string;
  pages: number;
  indexBytes: number;
  estimatedBuildSeconds: number;
};

export type BudgetCheckResult = {
  ok: boolean;
  totalPages: number;
  totalEstimatedBuildSeconds: number;
  violations: string[];
  perLanguage: LanguageBudgetUsage[];
};

export function checkI18nBudget(
  usages: readonly LanguageBudgetUsage[],
  config: I18nBudgetConfig = DEFAULT_I18N_BUDGET,
): BudgetCheckResult {
  const parsedConfig = I18nBudgetConfigSchema.parse(config);
  const violations: string[] = [];
  let totalPages = 0;
  let totalEstimatedBuildSeconds = 0;

  for (const u of usages) {
    totalPages += u.pages;
    totalEstimatedBuildSeconds += u.estimatedBuildSeconds;
    if (u.pages > parsedConfig.maxPagesPerLanguage) {
      violations.push(
        `Language "${u.lang}" exceeds maxPagesPerLanguage (${u.pages} > ${parsedConfig.maxPagesPerLanguage}).`,
      );
    }
    if (u.indexBytes > parsedConfig.maxIndexBytesPerLanguage) {
      violations.push(
        `Language "${u.lang}" exceeds maxIndexBytesPerLanguage (${u.indexBytes} > ${parsedConfig.maxIndexBytesPerLanguage}).`,
      );
    }
  }

  if (totalPages > parsedConfig.maxTotalPages) {
    violations.push(
      `Total pages exceed maxTotalPages (${totalPages} > ${parsedConfig.maxTotalPages}).`,
    );
  }
  if (totalEstimatedBuildSeconds > parsedConfig.maxEstimatedBuildSeconds) {
    violations.push(
      `Estimated build time exceeds maxEstimatedBuildSeconds (${totalEstimatedBuildSeconds}s > ${parsedConfig.maxEstimatedBuildSeconds}s).`,
    );
  }

  return {
    ok: violations.length === 0,
    totalPages,
    totalEstimatedBuildSeconds,
    violations,
    perLanguage: [...usages],
  };
}
