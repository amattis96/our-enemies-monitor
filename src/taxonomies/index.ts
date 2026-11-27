import { readFileSync } from "node:fs";
import { z } from "zod";
import { repoPath } from "../pipeline/paths.ts";

export const TAXONOMY_FRAMEWORKS = ["disarm", "mitre_attack", "internal_sabotage"] as const;
export type TaxonomyFrameworkId = (typeof TAXONOMY_FRAMEWORKS)[number];

export const TECHNIQUE_STATUSES = ["active", "deprecated"] as const;
export type TechniqueStatus = (typeof TECHNIQUE_STATUSES)[number];

export const TaxonomyFrameworkSchema = z
  .strictObject({
    id: z.enum(TAXONOMY_FRAMEWORKS).describe("Canonical taxonomy framework identifier."),
    name: z.string().min(1).describe("Human-readable name of the framework."),
    version: z.string().min(1).describe("Version of the external or internal framework."),
    domain: z.string().min(1).describe("Primary operational domain covered by the framework."),
    url: z.string().url().nullable().describe("Reference URL for external frameworks, or null."),
  })
  .describe("Metadata describing a supported technique taxonomy framework.");
export type TaxonomyFramework = z.infer<typeof TaxonomyFrameworkSchema>;

export const TaxonomyTechniqueSchema = z
  .strictObject({
    id: z.string().min(1).describe("Stable technique identifier across manifest versions."),
    framework: z.enum(TAXONOMY_FRAMEWORKS).describe("Framework this technique belongs to."),
    external_code: z
      .string()
      .min(1)
      .describe("Framework-native code (e.g., T0049, T1566, SAB-001)."),
    name: z.string().min(1).describe("Canonical technique name."),
    category: z.string().min(1).describe("Operational category within the framework."),
    description: z.string().min(1).describe("Factual definition of the technique."),
    status: z.enum(TECHNIQUE_STATUSES).describe("Lifecycle status of the technique ID."),
    introduced_in: z.string().min(1).describe("Schema/manifest version when ID was introduced."),
    parent_id: z.string().min(1).nullable().describe("Optional parent technique ID, or null."),
  })
  .describe("Versioned technique entry in the canonical taxonomy manifest.");
export type TaxonomyTechnique = z.infer<typeof TaxonomyTechniqueSchema>;

export const TaxonomyDeprecationSchema = z
  .strictObject({
    deprecated_id: z.string().min(1).describe("Deprecated technique identifier."),
    deprecated_in: z.string().min(1).describe("Manifest version when deprecation took effect."),
    reason: z.string().min(1).describe("Rationale for deprecating the technique ID."),
    replacement_id: z
      .string()
      .min(1)
      .nullable()
      .describe("Recommended active replacement ID, or null if retired without replacement."),
  })
  .describe("Deprecation record for a retired or split technique ID.");
export type TaxonomyDeprecation = z.infer<typeof TaxonomyDeprecationSchema>;

export const TaxonomyMigrationSchema = z
  .strictObject({
    from_id: z.string().min(1).describe("Source technique ID being migrated."),
    to_id: z.string().min(1).describe("Target active technique ID."),
    from_version: z.string().min(1).describe("Origin manifest version."),
    to_version: z.string().min(1).describe("Destination manifest version."),
    reversible: z.boolean().describe("Whether the migration is a 1:1 reversible rename."),
    note: z.string().min(1).describe("Migration guidance for analysts."),
  })
  .describe("Explicit migration rule from a deprecated technique ID to an active ID.");
export type TaxonomyMigration = z.infer<typeof TaxonomyMigrationSchema>;

export const TaxonomyManifestSchema = z
  .strictObject({
    schema_version: z.string().min(1).describe("Schema version of the taxonomy manifest."),
    manifest_version: z.string().min(1).describe("Content release version of the manifest."),
    updated_at: z.string().min(1).describe("ISO-8601 UTC timestamp of last manifest update."),
    frameworks: z
      .record(z.enum(TAXONOMY_FRAMEWORKS), TaxonomyFrameworkSchema)
      .describe("Supported taxonomy frameworks keyed by framework ID."),
    techniques: z
      .array(TaxonomyTechniqueSchema)
      .min(1)
      .describe("All registered techniques across DISARM, MITRE ATT&CK, and internal sabotage."),
    deprecations: z
      .array(TaxonomyDeprecationSchema)
      .describe("Deprecation records for retired technique IDs."),
    migrations: z
      .array(TaxonomyMigrationSchema)
      .describe("Migration mappings for deprecated technique IDs."),
  })
  .describe("Versioned taxonomy manifest for techniques with deprecations and migrations.");
export type TaxonomyManifest = z.infer<typeof TaxonomyManifestSchema>;

export const TECHNIQUE_RESOLUTION_STATUSES = [
  "active",
  "migrated",
  "deprecated_no_replacement",
  "unclassifiable",
] as const;
export type TechniqueResolutionStatus = (typeof TECHNIQUE_RESOLUTION_STATUSES)[number];

export type TechniqueResolutionResult =
  | {
      status: "active";
      technique: TaxonomyTechnique;
      resolved_id: string;
    }
  | {
      status: "migrated";
      original_id: string;
      resolved_id: string;
      technique: TaxonomyTechnique;
      migration: TaxonomyMigration;
    }
  | {
      status: "deprecated_no_replacement";
      original_id: string;
      deprecation: TaxonomyDeprecation;
    }
  | {
      status: "unclassifiable";
      original_id: string;
      reason: string;
    };

export const DEFAULT_TAXONOMY_MANIFEST_PATH = repoPath("docs/taxonomies/manifest.v1.json");

export function validateTaxonomyManifest(raw: unknown): TaxonomyManifest {
  const manifest = TaxonomyManifestSchema.parse(raw);
  const seenIds = new Set<string>();
  for (const t of manifest.techniques) {
    if (seenIds.has(t.id)) {
      throw new Error(`Duplicate technique ID "${t.id}" in taxonomy manifest.`);
    }
    seenIds.add(t.id);
  }
  for (const m of manifest.migrations) {
    if (!seenIds.has(m.to_id)) {
      throw new Error(`Migration target "${m.to_id}" does not exist in taxonomy manifest.`);
    }
  }
  return manifest;
}

export function loadTaxonomyManifest(
  manifestPath = DEFAULT_TAXONOMY_MANIFEST_PATH,
): TaxonomyManifest {
  const raw = JSON.parse(readFileSync(manifestPath, "utf8")) as unknown;
  return validateTaxonomyManifest(raw);
}

/**
 * Resolve a technique ID against the manifest, following migrations for
 * deprecated IDs and returning `"unclassifiable"` when no valid mapping exists.
 */
export function resolveTechnique(
  manifest: TaxonomyManifest,
  id: string,
): TechniqueResolutionResult {
  const trimmed = id.trim();
  if (!trimmed || trimmed.toLowerCase() === "unclassifiable") {
    return {
      status: "unclassifiable",
      original_id: id,
      reason: "Explicitly marked or empty unclassifiable observation.",
    };
  }

  const byId = new Map(manifest.techniques.map((t) => [t.id, t]));
  const direct = byId.get(trimmed);

  if (direct && direct.status === "active") {
    return {
      status: "active",
      technique: direct,
      resolved_id: direct.id,
    };
  }

  const migration = manifest.migrations.find((m) => m.from_id === trimmed);
  if (migration) {
    const target = byId.get(migration.to_id);
    if (target && target.status === "active") {
      return {
        status: "migrated",
        original_id: trimmed,
        resolved_id: target.id,
        technique: target,
        migration,
      };
    }
  }

  const deprecation = manifest.deprecations.find((d) => d.deprecated_id === trimmed);
  if (deprecation) {
    if (deprecation.replacement_id) {
      const target = byId.get(deprecation.replacement_id);
      if (target && target.status === "active") {
        return {
          status: "migrated",
          original_id: trimmed,
          resolved_id: target.id,
          technique: target,
          migration: {
            from_id: trimmed,
            to_id: target.id,
            from_version: deprecation.deprecated_in,
            to_version: manifest.manifest_version,
            reversible: false,
            note: deprecation.reason,
          },
        };
      }
    }
    return {
      status: "deprecated_no_replacement",
      original_id: trimmed,
      deprecation,
    };
  }

  return {
    status: "unclassifiable",
    original_id: id,
    reason: `Technique ID "${trimmed}" is not present in manifest ${manifest.manifest_version}.`,
  };
}

/**
 * Classify an observation by framework and external code without forcing a match.
 * Returns `"unclassifiable"` when no exact match exists.
 */
export function classifyTechnique(
  manifest: TaxonomyManifest,
  input: {
    framework?: TaxonomyFrameworkId;
    external_code?: string;
    unclassifiable_reason?: string;
  },
): TechniqueResolutionResult {
  if (input.unclassifiable_reason) {
    return {
      status: "unclassifiable",
      original_id: input.external_code ?? "unclassifiable",
      reason: input.unclassifiable_reason,
    };
  }
  if (!input.framework || !input.external_code) {
    return {
      status: "unclassifiable",
      original_id: input.external_code ?? "unclassifiable",
      reason: "Missing framework or external_code; cannot force classification.",
    };
  }
  const match = manifest.techniques.find(
    (t) => t.framework === input.framework && t.external_code === input.external_code,
  );
  if (!match) {
    return {
      status: "unclassifiable",
      original_id: `${input.framework}:${input.external_code}`,
      reason: `No technique in ${input.framework} matches code "${input.external_code}".`,
    };
  }
  return resolveTechnique(manifest, match.id);
}

/**
 * Migrate a list of technique IDs to their active counterparts, preserving
 * unclassifiable entries explicitly instead of dropping or forcing them.
 */
export function migrateTechniqueIds(
  manifest: TaxonomyManifest,
  ids: readonly string[],
): {
  resolved_ids: string[];
  migrated: Array<{ from_id: string; to_id: string }>;
  unclassifiable: Array<{ original_id: string; reason: string }>;
} {
  const resolved_ids: string[] = [];
  const migrated: Array<{ from_id: string; to_id: string }> = [];
  const unclassifiable: Array<{ original_id: string; reason: string }> = [];

  for (const id of ids) {
    const res = resolveTechnique(manifest, id);
    if (res.status === "active") {
      resolved_ids.push(res.resolved_id);
    } else if (res.status === "migrated") {
      resolved_ids.push(res.resolved_id);
      migrated.push({ from_id: res.original_id, to_id: res.resolved_id });
    } else if (res.status === "deprecated_no_replacement") {
      unclassifiable.push({ original_id: res.original_id, reason: res.deprecation.reason });
    } else {
      unclassifiable.push({ original_id: res.original_id, reason: res.reason });
    }
  }

  return { resolved_ids, migrated, unclassifiable };
}
