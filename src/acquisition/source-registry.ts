import { readFileSync } from "node:fs";
import { z } from "zod";
import { PartialDate } from "../model/schemas.ts";
import { ORIGIN_TYPES } from "../model/vocabularies.ts";
import { repoPath } from "../pipeline/paths.ts";
import type { PublicRunManifest, RunManifest } from "../runs/schema.ts";

export const SOURCE_AVAILABILITIES = [
  "open_web",
  "api",
  "subscription",
  "archive_only",
  "restricted",
  "intermittent",
] as const;
export type SourceAvailability = (typeof SOURCE_AVAILABILITIES)[number];

export const SOURCE_RELIABILITIES = ["high", "medium", "low", "contested", "unassessed"] as const;
export type SourceReliability = (typeof SOURCE_RELIABILITIES)[number];

export const SourcePeriodSchema = z
  .strictObject({
    from: PartialDate.describe("Start date of source coverage (YYYY, YYYY-MM, or YYYY-MM-DD)."),
    to: PartialDate.nullable().describe("End date of coverage, or null if ongoing."),
  })
  .describe("Temporal coverage period of a registered acquisition source.");
export type SourcePeriod = z.infer<typeof SourcePeriodSchema>;

export const SourceRegistryEntrySchema = z
  .strictObject({
    source_id: z.string().min(1).describe("Stable identifier of the acquisition source."),
    name: z.string().min(1).describe("Human-readable name of the source."),
    country: z
      .string()
      .min(2)
      .describe("ISO country code (e.g., FR, DE, PL, UK, RO, EE, LV, LT, RU, UA)."),
    language: z
      .string()
      .min(2)
      .describe("ISO 639-1 language code (e.g., fr, de, pl, en, ro, et, lv, lt, ru, uk)."),
    availability: z
      .enum(SOURCE_AVAILABILITIES)
      .describe("Operational availability mode of the source."),
    period: SourcePeriodSchema.describe("Historical/ongoing coverage period."),
    reliability: z.enum(SOURCE_RELIABILITIES).describe("Baseline reliability assessment."),
    typical_genealogical_root: z
      .enum(ORIGIN_TYPES)
      .describe("Typical ADR-05 genealogical origin type of records from this source."),
    acquisition_independent_of_published_languages: z
      .boolean()
      .describe(
        "True when primary acquisition occurs in source language regardless of IT/EN publication language.",
      ),
    url: z.string().url().describe("Primary URL of the source."),
    topics: z.array(z.string().min(1)).min(1).describe("Core monitoring topics covered."),
    notes: z.string().min(1).describe("Operational acquisition notes."),
  })
  .describe("Multilingual acquisition source registry entry.");
export type SourceRegistryEntry = z.infer<typeof SourceRegistryEntrySchema>;

export const SourceRegistrySchema = z
  .strictObject({
    schema_version: z.string().min(1).describe("Schema version of the source registry."),
    registry_version: z.string().min(1).describe("Content release version of the registry."),
    updated_at: z.string().min(1).describe("ISO-8601 UTC timestamp of last update."),
    sources: z.array(SourceRegistryEntrySchema).min(1).describe("Registered acquisition sources."),
  })
  .describe("Country- and language-indexed multilingual acquisition source registry.");
export type SourceRegistry = z.infer<typeof SourceRegistrySchema>;

export const DEFAULT_SOURCE_REGISTRY_PATH = repoPath("docs/acquisition/sources-registry.v1.json");

export function validateSourceRegistry(raw: unknown): SourceRegistry {
  const registry = SourceRegistrySchema.parse(raw);
  const seen = new Set<string>();
  for (const s of registry.sources) {
    if (seen.has(s.source_id)) {
      throw new Error(`Duplicate source_id "${s.source_id}" in source registry.`);
    }
    seen.add(s.source_id);
  }
  return registry;
}

export function loadSourceRegistry(registryPath = DEFAULT_SOURCE_REGISTRY_PATH): SourceRegistry {
  const raw = JSON.parse(readFileSync(registryPath, "utf8")) as unknown;
  return validateSourceRegistry(raw);
}

export function filterSourcesByCountryAndLanguage(
  registry: SourceRegistry,
  filter: { country?: string; language?: string; independent_only?: boolean },
): SourceRegistryEntry[] {
  return registry.sources.filter((s) => {
    if (filter.country && s.country !== filter.country) return false;
    if (filter.language && s.language !== filter.language) return false;
    if (filter.independent_only && !s.acquisition_independent_of_published_languages) return false;
    return true;
  });
}

export const SourceCoverageBucketSchema = z
  .strictObject({
    key: z.string().min(1).describe("Country or language code."),
    registered_sources: z
      .number()
      .int()
      .nonnegative()
      .describe("Total registered sources in bucket."),
    consulted_sources: z.number().int().nonnegative().describe("Sources consulted across runs."),
    coverage_ratio: z.number().min(0).max(1).describe("Fraction of registered sources consulted."),
  })
  .describe("Coverage summary for a single country or language bucket.");
export type SourceCoverageBucket = z.infer<typeof SourceCoverageBucketSchema>;

export const SourceCoverageReportSchema = z
  .strictObject({
    registry_version: z.string().min(1).describe("Version of the source registry evaluated."),
    total_runs_inspected: z
      .number()
      .int()
      .nonnegative()
      .describe("Number of PK-08 run manifests inspected."),
    missed_or_failed_runs: z
      .number()
      .int()
      .nonnegative()
      .describe("Count of missed or failed runs."),
    total_registered_sources: z.number().int().nonnegative().describe("Total registered sources."),
    total_consulted_sources: z
      .number()
      .int()
      .nonnegative()
      .describe("Unique registered sources consulted."),
    overall_coverage_ratio: z
      .number()
      .min(0)
      .max(1)
      .describe("Overall consulted/registered ratio."),
    by_country: z.array(SourceCoverageBucketSchema).describe("Coverage breakdown by country."),
    by_language: z.array(SourceCoverageBucketSchema).describe("Coverage breakdown by language."),
    uncovered_source_ids: z
      .array(z.string().min(1))
      .describe("Registered sources not consulted in any run."),
    ru_uk_independent_acquisition_active: z
      .boolean()
      .describe("True when at least one ru and one uk primary source was consulted."),
  })
  .describe("Acquisition coverage report derived from PK-08 run manifests.");
export type SourceCoverageReport = z.infer<typeof SourceCoverageReportSchema>;

function matchesSourceRef(entry: SourceRegistryEntry, consultedRef: string): boolean {
  if (consultedRef === entry.source_id) return true;
  if (consultedRef.startsWith(entry.url)) return true;
  try {
    const entryHost = new URL(entry.url).hostname;
    if (consultedRef.includes(entryHost)) return true;
  } catch {
    // Ignore malformed consulted URLs
  }
  return false;
}

/**
 * Generate an acquisition coverage report from PK-08 run manifests against
 * the registered country/language source catalog.
 */
export function generateSourceCoverageReport(
  registry: SourceRegistry,
  runManifests: readonly (RunManifest | PublicRunManifest)[],
): SourceCoverageReport {
  const consultedSourceIds = new Set<string>();
  let missedOrFailed = 0;

  for (const run of runManifests) {
    if (run.status === "missed" || run.status === "failed") {
      missedOrFailed += 1;
    }
    if ("sources_consulted" in run && Array.isArray(run.sources_consulted)) {
      for (const ref of run.sources_consulted) {
        for (const entry of registry.sources) {
          if (matchesSourceRef(entry, ref)) {
            consultedSourceIds.add(entry.source_id);
          }
        }
      }
    }
  }

  const byCountryMap = new Map<string, { total: number; consulted: number }>();
  const byLangMap = new Map<string, { total: number; consulted: number }>();

  for (const entry of registry.sources) {
    const isConsulted = consultedSourceIds.has(entry.source_id);

    const cBucket = byCountryMap.get(entry.country) ?? { total: 0, consulted: 0 };
    cBucket.total += 1;
    if (isConsulted) cBucket.consulted += 1;
    byCountryMap.set(entry.country, cBucket);

    const lBucket = byLangMap.get(entry.language) ?? { total: 0, consulted: 0 };
    lBucket.total += 1;
    if (isConsulted) lBucket.consulted += 1;
    byLangMap.set(entry.language, lBucket);
  }

  const toBuckets = (
    m: Map<string, { total: number; consulted: number }>,
  ): SourceCoverageBucket[] =>
    [...m.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, b]) => ({
        key,
        registered_sources: b.total,
        consulted_sources: b.consulted,
        coverage_ratio: b.total > 0 ? Number((b.consulted / b.total).toFixed(4)) : 0,
      }));

  const uncovered = registry.sources
    .filter((s) => !consultedSourceIds.has(s.source_id))
    .map((s) => s.source_id);

  const ruConsulted = registry.sources.some(
    (s) =>
      s.language === "ru" &&
      s.acquisition_independent_of_published_languages &&
      consultedSourceIds.has(s.source_id),
  );
  const ukConsulted = registry.sources.some(
    (s) =>
      s.language === "uk" &&
      s.acquisition_independent_of_published_languages &&
      consultedSourceIds.has(s.source_id),
  );

  const totalReg = registry.sources.length;
  const totalCons = consultedSourceIds.size;

  return SourceCoverageReportSchema.parse({
    registry_version: registry.registry_version,
    total_runs_inspected: runManifests.length,
    missed_or_failed_runs: missedOrFailed,
    total_registered_sources: totalReg,
    total_consulted_sources: totalCons,
    overall_coverage_ratio: totalReg > 0 ? Number((totalCons / totalReg).toFixed(4)) : 0,
    by_country: toBuckets(byCountryMap),
    by_language: toBuckets(byLangMap),
    uncovered_source_ids: uncovered,
    ru_uk_independent_acquisition_active: ruConsulted && ukConsulted,
  });
}
