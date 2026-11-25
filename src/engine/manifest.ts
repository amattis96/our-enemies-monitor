import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { DormantHypothesisSchema } from "../discovery/dormant.ts";
import { repoPath } from "../pipeline/paths.ts";
import { DEFAULT_MAX_STALENESS_SECONDS } from "../retractions/policy.ts";
import {
  type PublicRunManifest,
  PublicRunManifestSchema,
  RunManifestSchema,
  sanitizeRunManifest,
} from "../runs/index.ts";
import { ENGINE_VERSION } from "./version.ts";

export const METHOD_LIFECYCLE_STATUSES = ["disabled", "shadow", "experimental", "active"] as const;
export type MethodLifecycleStatus = (typeof METHOD_LIFECYCLE_STATUSES)[number];

export const BilingualTextSchema = z
  .strictObject({
    it: z.string().min(1).describe("Italian localized text."),
    en: z.string().min(1).describe("English localized text."),
  })
  .describe("Bilingual text pair in Italian and English.");
export type BilingualText = z.infer<typeof BilingualTextSchema>;

export const EngineMethodSchema = z
  .strictObject({
    id: z.string().min(1).describe("Stable identifier of the engine or discovery method."),
    name: BilingualTextSchema.describe("Human-readable method name in IT and EN."),
    version: z.string().min(1).describe("Semantic version of the method implementation."),
    status: z
      .enum(METHOD_LIFECYCLE_STATUSES)
      .describe("Lifecycle activation state (disabled, shadow, experimental, active)."),
    public_summary: BilingualTextSchema.describe(
      "Public explanation of what the method checks and why.",
    ),
    limitations: BilingualTextSchema.describe(
      "Declared methodological and evidentiary limitations.",
    ),
    evidentiary_criteria: BilingualTextSchema.describe(
      "Evidentiary requirements before any candidate can become a published fact.",
    ),
    detection_mechanics: z
      .string()
      .min(1)
      .describe("Private exact detection mechanics stripped from public projections."),
  })
  .describe("Method entry in the authoritative engine manifest.");
export type EngineMethod = z.infer<typeof EngineMethodSchema>;

export const PublicEngineMethodSchema = EngineMethodSchema.omit({
  detection_mechanics: true,
}).describe("Public projection of an engine method without exact detection mechanics.");
export type PublicEngineMethod = z.infer<typeof PublicEngineMethodSchema>;

export const CodeThresholdsSchema = z
  .strictObject({
    missed_run_grace_minutes: z
      .number()
      .int()
      .nonnegative()
      .describe("Grace window in minutes before a scheduled slot is marked missed."),
    dormant_min_recheck_interval_hours: z
      .number()
      .nonnegative()
      .describe("Minimum interval in hours between redundant dormant hypothesis checks."),
    dormant_novelty_threshold: z
      .number()
      .min(0)
      .max(1)
      .describe("Minimum fingerprint match threshold for dormant hypothesis candidate relevance."),
    retraction_max_staleness_seconds: z
      .number()
      .int()
      .positive()
      .describe("Maximum allowed projection staleness in seconds for retraction containment."),
    quality_min_precision: z
      .number()
      .min(0)
      .max(1)
      .describe("Minimum required precision for agent quality evaluation."),
    quality_min_recall: z
      .number()
      .min(0)
      .max(1)
      .describe("Minimum required recall for agent quality evaluation."),
    quality_min_caveat_preservation_rate: z
      .number()
      .min(0)
      .max(1)
      .describe("Minimum required caveat preservation rate in agent outputs."),
    quality_min_ex_ante_composite: z
      .number()
      .min(0)
      .max(1)
      .describe("Minimum ex-ante composite score for discovery generators."),
    quality_min_ex_post_yield_rate: z
      .number()
      .min(0)
      .max(1)
      .describe("Minimum ex-post informative yield rate for discovery generators."),
  })
  .describe("Protected rule thresholds enforced in code and verified by CI.");
export type CodeThresholds = z.infer<typeof CodeThresholdsSchema>;

export const SecurityThresholdsSchema = z
  .strictObject({
    prompt_injection_high_severity_block: z
      .boolean()
      .describe("Whether high-severity prompt injection findings block automated agent reads."),
    holdout_max_evaluations_before_rotation: z
      .number()
      .int()
      .positive()
      .describe("Maximum holdout evaluations before mandatory rotation."),
    quarantine_marker_prefix: z
      .string()
      .min(1)
      .describe("Delimiter prefix used to isolate untrusted quarantined sources."),
    max_api_cost_per_run_usd: z
      .number()
      .nonnegative()
      .describe("Internal cost ceiling per scheduled run in USD."),
    rate_limit_backoff_seconds: z
      .number()
      .int()
      .positive()
      .describe("Internal retry backoff duration in seconds."),
    protection_details: z
      .string()
      .min(1)
      .describe("Private description of internal security and anti-abuse protections."),
    investigative_queries: z
      .array(z.string().min(1))
      .describe("Private investigative query templates kept out of public projections."),
  })
  .describe(
    "Sensitive security thresholds and protection details stripped from public projections.",
  );
export type SecurityThresholds = z.infer<typeof SecurityThresholdsSchema>;

export const EngineCadenceSchema = z
  .strictObject({
    task_id: z.string().min(1).describe("Task or workflow identifier."),
    role: z.string().min(1).describe("Operational role executed by the task."),
    schedule: z.string().min(1).describe("Human-readable or cron schedule."),
    timezone: z.string().min(1).describe("IANA timezone for the schedule."),
    status: z.enum(["active", "paused", "event_driven"]).describe("Operational cadence status."),
  })
  .describe("Scheduled or event-driven cadence entry.");
export type EngineCadence = z.infer<typeof EngineCadenceSchema>;

export const EngineRoleSchema = z
  .strictObject({
    id: z.string().min(1).describe("Role identifier."),
    label: BilingualTextSchema.describe("Role title in IT and EN."),
    responsibilities: BilingualTextSchema.describe("Summary of what this role does."),
    can_set_human_reviewed: z
      .boolean()
      .describe("Whether this role is authorized to assign human reviewed status."),
  })
  .describe("Role definition explaining who does what in the pipeline.");
export type EngineRole = z.infer<typeof EngineRoleSchema>;

export const EngineModelAssignmentSchema = z
  .strictObject({
    role: z.string().min(1).describe("Role identifier using this model."),
    provider: z.string().min(1).describe("Provider identifier."),
    model: z.string().min(1).describe("Model identifier."),
    purpose: BilingualTextSchema.describe("Purpose of this model assignment."),
  })
  .describe("Model assignment for a pipeline role.");
export type EngineModelAssignment = z.infer<typeof EngineModelAssignmentSchema>;

export const OperationalMetricsSchema = z
  .strictObject({
    measured_at: z
      .string()
      .min(1)
      .describe("UTC ISO-8601 timestamp of the latest operational measurement."),
    runs_recorded: z
      .number()
      .int()
      .nonnegative()
      .describe("Total recorded runs in the current window."),
    missed_runs: z.number().int().nonnegative().describe("Total missed runs detected."),
    informative_resolutions: z
      .number()
      .int()
      .nonnegative()
      .describe(
        "Count of informative discovery resolutions (confirmations and useful refutations).",
      ),
    last_snapshot_id: z.string().min(1).describe("Latest canonical snapshot identifier."),
  })
  .describe("Operational measured values separated from protected rule definitions.");
export type OperationalMetrics = z.infer<typeof OperationalMetricsSchema>;

export const EngineManifestSchema = z
  .strictObject({
    schema_version: z.literal("1.0.0").describe("Schema version of engine.manifest.json."),
    engine_version: z.string().min(1).describe("Engine version matching src/engine/version.ts."),
    updated_at: z.string().min(1).describe("UTC date or timestamp of the manifest definition."),
    methods: z.array(EngineMethodSchema).min(1).describe("Engine and discovery methods."),
    thresholds: z
      .strictObject({
        code_thresholds: CodeThresholdsSchema.describe("Protected code-coupled thresholds."),
        security_thresholds: SecurityThresholdsSchema.describe(
          "Private security thresholds and investigative details.",
        ),
      })
      .describe("Protected rule thresholds."),
    cadences: z.array(EngineCadenceSchema).min(1).describe("Task and workflow cadences."),
    roles: z.array(EngineRoleSchema).min(1).describe("Pipeline roles and permissions."),
    models: z.array(EngineModelAssignmentSchema).min(1).describe("Model assignments per role."),
    operational_metrics: OperationalMetricsSchema.describe(
      "Operational measured state separated from protected rules.",
    ),
  })
  .describe("Authoritative versioned engine manifest (PK-16).");
export type EngineManifest = z.infer<typeof EngineManifestSchema>;

export const PublicEngineManifestSchema = z
  .strictObject({
    schema_version: z
      .literal("1.0.0")
      .describe("Schema version of the public manifest projection."),
    engine_version: z.string().min(1).describe("Active engine version."),
    updated_at: z.string().min(1).describe("UTC date or timestamp of the manifest definition."),
    methods: z
      .array(PublicEngineMethodSchema)
      .min(1)
      .describe("Public method projections without detection mechanics."),
    public_thresholds: CodeThresholdsSchema.describe(
      "Publicly auditable quality and staleness thresholds.",
    ),
    cadences: z.array(EngineCadenceSchema).min(1).describe("Publicly declared task cadences."),
    roles: z.array(EngineRoleSchema).min(1).describe("Publicly declared pipeline roles."),
    models: z
      .array(EngineModelAssignmentSchema)
      .min(1)
      .describe("Publicly declared model assignments."),
    operational_metrics: OperationalMetricsSchema.describe("Operational measured summary."),
  })
  .describe(
    "Sanitized public projection of the engine manifest stripping security thresholds, protection details, investigative queries, and exact detection mechanics.",
  );
export type PublicEngineManifest = z.infer<typeof PublicEngineManifestSchema>;

export const DEFAULT_ENGINE_MANIFEST_PATH = repoPath("docs/automation/engine.manifest.json");

/** Read and validate the authoritative engine manifest from disk. */
export function readEngineManifest(
  filePath: string = DEFAULT_ENGINE_MANIFEST_PATH,
): EngineManifest {
  const raw = readFileSync(filePath, "utf8");
  const parsed: unknown = JSON.parse(raw);
  return EngineManifestSchema.parse(parsed);
}

/**
 * Produce the public projection of the engine manifest (PK-16), stripping
 * security thresholds, protection details, investigative queries, and exact
 * detection mechanics per the PK-01 threat model.
 */
export function projectPublicEngineManifest(manifest: EngineManifest): PublicEngineManifest {
  const methods: PublicEngineMethod[] = manifest.methods.map((method) => ({
    id: method.id,
    name: method.name,
    version: method.version,
    status: method.status,
    public_summary: method.public_summary,
    limitations: method.limitations,
    evidentiary_criteria: method.evidentiary_criteria,
  }));

  return PublicEngineManifestSchema.parse({
    schema_version: manifest.schema_version,
    engine_version: manifest.engine_version,
    updated_at: manifest.updated_at,
    methods,
    public_thresholds: manifest.thresholds.code_thresholds,
    cadences: manifest.cadences,
    roles: manifest.roles,
    models: manifest.models,
    operational_metrics: manifest.operational_metrics,
  });
}

export type CoherenceCheckResult = {
  ok: boolean;
  errors: string[];
  checked: {
    engine_version: string;
    code_thresholds: CodeThresholds;
    motore_page_present: boolean;
  };
};

type QualityThresholdsFile = {
  agent_quality: {
    min_precision: number;
    min_recall: number;
    min_caveat_preservation_rate: number;
  };
  discovery_quality: {
    min_ex_ante_composite: number;
    min_ex_post_yield_rate: number;
  };
};

function extractMissedGraceDefault(missedSource: string): number | null {
  const match = /defaultGraceMinutes\s*=\s*options\?\.defaultGraceMinutes\s*\?\?\s*(\d+)/.exec(
    missedSource,
  );
  if (!match?.[1]) return null;
  return Number.parseInt(match[1], 10);
}

/**
 * Verify semantic coherence between `engine.manifest.json`, code constants/schemas,
 * quality thresholds, and the `/metodo/motore` page.
 */
export function checkEngineManifestCoherence(
  manifest: EngineManifest,
  options?: {
    engineVersion?: string;
    missedSource?: string;
    retractionMaxStalenessSeconds?: number;
    dormantDefaults?: { min_recheck_interval_hours: number; novelty_threshold: number };
    qualityThresholds?: QualityThresholdsFile;
    motorePageSource?: string;
  },
): CoherenceCheckResult {
  const errors: string[] = [];
  const actualEngineVersion = options?.engineVersion ?? ENGINE_VERSION;
  if (manifest.engine_version !== actualEngineVersion) {
    errors.push(
      `engine_version drift: manifest has "${manifest.engine_version}", code has "${actualEngineVersion}"`,
    );
  }

  const ct = manifest.thresholds.code_thresholds;

  const missedSource =
    options?.missedSource ?? readFileSync(repoPath("src/runs/missed.ts"), "utf8");
  const actualGraceMinutes = extractMissedGraceDefault(missedSource);
  if (actualGraceMinutes === null) {
    errors.push("Unable to extract defaultGraceMinutes from src/runs/missed.ts");
  } else if (ct.missed_run_grace_minutes !== actualGraceMinutes) {
    errors.push(
      `missed_run_grace_minutes drift: manifest has ${ct.missed_run_grace_minutes}, code has ${actualGraceMinutes}`,
    );
  }

  const actualStaleness = options?.retractionMaxStalenessSeconds ?? DEFAULT_MAX_STALENESS_SECONDS;
  if (ct.retraction_max_staleness_seconds !== actualStaleness) {
    errors.push(
      `retraction_max_staleness_seconds drift: manifest has ${ct.retraction_max_staleness_seconds}, code has ${actualStaleness}`,
    );
  }

  const dormantDefaults =
    options?.dormantDefaults ??
    (() => {
      const parsed = DormantHypothesisSchema.parse({
        hypothesis_id: "HYP-COHERENCE-CHECK",
        status: "dormant",
        fingerprint: {
          entities: ["ENT-CHECK"],
          places: ["EU"],
          themes: ["check"],
          period: { from: "2026-01-01", to: "2026-12-31" },
        },
      });
      return {
        min_recheck_interval_hours: parsed.min_recheck_interval_hours,
        novelty_threshold: parsed.novelty_threshold,
      };
    })();

  if (ct.dormant_min_recheck_interval_hours !== dormantDefaults.min_recheck_interval_hours) {
    errors.push(
      `dormant_min_recheck_interval_hours drift: manifest has ${ct.dormant_min_recheck_interval_hours}, code has ${dormantDefaults.min_recheck_interval_hours}`,
    );
  }
  if (ct.dormant_novelty_threshold !== dormantDefaults.novelty_threshold) {
    errors.push(
      `dormant_novelty_threshold drift: manifest has ${ct.dormant_novelty_threshold}, code has ${dormantDefaults.novelty_threshold}`,
    );
  }

  const qualityThresholds: QualityThresholdsFile =
    options?.qualityThresholds ??
    (JSON.parse(
      readFileSync(repoPath("docs/quality/thresholds.v1.json"), "utf8"),
    ) as QualityThresholdsFile);

  if (ct.quality_min_precision !== qualityThresholds.agent_quality.min_precision) {
    errors.push(
      `quality_min_precision drift: manifest has ${ct.quality_min_precision}, thresholds.v1.json has ${qualityThresholds.agent_quality.min_precision}`,
    );
  }
  if (ct.quality_min_recall !== qualityThresholds.agent_quality.min_recall) {
    errors.push(
      `quality_min_recall drift: manifest has ${ct.quality_min_recall}, thresholds.v1.json has ${qualityThresholds.agent_quality.min_recall}`,
    );
  }
  if (
    ct.quality_min_caveat_preservation_rate !==
    qualityThresholds.agent_quality.min_caveat_preservation_rate
  ) {
    errors.push(
      `quality_min_caveat_preservation_rate drift: manifest has ${ct.quality_min_caveat_preservation_rate}, thresholds.v1.json has ${qualityThresholds.agent_quality.min_caveat_preservation_rate}`,
    );
  }
  if (
    ct.quality_min_ex_ante_composite !== qualityThresholds.discovery_quality.min_ex_ante_composite
  ) {
    errors.push(
      `quality_min_ex_ante_composite drift: manifest has ${ct.quality_min_ex_ante_composite}, thresholds.v1.json has ${qualityThresholds.discovery_quality.min_ex_ante_composite}`,
    );
  }
  if (
    ct.quality_min_ex_post_yield_rate !== qualityThresholds.discovery_quality.min_ex_post_yield_rate
  ) {
    errors.push(
      `quality_min_ex_post_yield_rate drift: manifest has ${ct.quality_min_ex_post_yield_rate}, thresholds.v1.json has ${qualityThresholds.discovery_quality.min_ex_post_yield_rate}`,
    );
  }

  const motorePath = repoPath("web/src/pages/[...lang]/metodo/motore.astro");
  let motorePagePresent = false;
  if (options?.motorePageSource !== undefined) {
    motorePagePresent = options.motorePageSource.includes("projectPublicEngineManifest");
  } else if (existsSync(motorePath)) {
    const motoreSource = readFileSync(motorePath, "utf8");
    motorePagePresent = motoreSource.includes("projectPublicEngineManifest");
  }
  if (!motorePagePresent) {
    errors.push(
      "web/src/pages/[...lang]/metodo/motore.astro is missing or does not consume projectPublicEngineManifest()",
    );
  }

  return {
    ok: errors.length === 0,
    errors,
    checked: {
      engine_version: actualEngineVersion,
      code_thresholds: ct,
      motore_page_present: motorePagePresent,
    },
  };
}

/**
 * Load sanitized public run manifests from `docs/runs/` (if present) for `/stato`.
 * Accepts both already-sanitized `PublicRunManifest` files and full `RunManifest`
 * files (sanitizing them on the fly via `sanitizeRunManifest`).
 */
export function loadPublicRunManifests(
  runsDir: string = repoPath("docs/runs"),
): PublicRunManifest[] {
  if (!existsSync(runsDir)) return [];
  const entries = readdirSync(runsDir, { withFileTypes: true });
  const results: PublicRunManifest[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const fullPath = path.join(runsDir, entry.name);
    const parsed: unknown = JSON.parse(readFileSync(fullPath, "utf8"));
    const items = Array.isArray(parsed) ? parsed : [parsed];
    for (const item of items) {
      const pub = PublicRunManifestSchema.safeParse(item);
      if (pub.success) {
        results.push(pub.data);
        continue;
      }
      const priv = RunManifestSchema.safeParse(item);
      if (priv.success) {
        results.push(sanitizeRunManifest(priv.data));
      }
    }
  }

  return results.sort((a, b) => b.scheduled_at.localeCompare(a.scheduled_at));
}
