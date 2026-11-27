import { z } from "zod";
import { UtcTimestamp } from "../temporal/snapshots.ts";

export const RUN_STATUSES = [
  "completed_with_results",
  "completed_no_results",
  "partial",
  "failed",
  "cancelled",
  "missed",
] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

export const RunWindowSchema = z
  .strictObject({
    from: UtcTimestamp.describe("Inclusive UTC start timestamp of the covered time window."),
    to: UtcTimestamp.describe("Inclusive UTC end timestamp of the covered time window."),
  })
  .describe("Time window covered by a scheduled or manual run.");
export type RunWindow = z.infer<typeof RunWindowSchema>;

export const RunErrorSchema = z
  .strictObject({
    code: z.string().min(1).describe("Machine-readable error code."),
    message: z
      .string()
      .min(1)
      .describe(
        "Error message; redacted in stored manifests only when it contains secrets or is flagged sensitive.",
      ),
    sensitive: z
      .boolean()
      .default(false)
      .describe(
        "When true, the message holds genuinely sensitive detail (credentials, unnecessary personal data) and is redacted.",
      ),
    stage: z
      .string()
      .min(1)
      .optional()
      .describe("Optional pipeline or task stage where the error occurred."),
  })
  .describe("Structured error entry recorded during a run.");
export type RunError = z.infer<typeof RunErrorSchema>;

export const PublicRunErrorSchema = z
  .strictObject({
    code: z.string().min(1).describe("Machine-readable error code."),
    stage: z
      .string()
      .min(1)
      .optional()
      .describe("Optional pipeline or task stage where the error occurred."),
    redacted: z
      .boolean()
      .describe("True when the original error message was redacted for public projection."),
    message: z
      .string()
      .min(1)
      .optional()
      .describe("Non-sensitive error message retained in the public projection."),
  })
  .describe("Sanitized error entry safe for public run manifests.");
export type PublicRunError = z.infer<typeof PublicRunErrorSchema>;

export const RunManifestSchema = z
  .strictObject({
    run_id: z.string().min(1).describe("Unique identifier of the run."),
    task: z.string().min(1).describe("Task or workflow name executed in this run."),
    role: z.string().min(1).describe("Operational role of the actor (e.g., discovery, verifier)."),
    provider: z.string().min(1).describe("Execution or AI provider identifier."),
    model: z.string().min(1).describe("Model identifier used by the run, or none."),
    scheduled_at: UtcTimestamp.describe("UTC timestamp when the run was scheduled to start."),
    started_at: UtcTimestamp.nullable()
      .optional()
      .describe("UTC timestamp when the run actually started, or null if missed."),
    finished_at: UtcTimestamp.nullable()
      .optional()
      .describe("UTC timestamp when the run finished, or null if missed or incomplete."),
    input_commit_sha: z
      .string()
      .regex(/^[0-9a-f]{7,40}$/)
      .nullable()
      .optional()
      .describe("Git commit SHA of the repository input state."),
    output_commit_sha: z
      .string()
      .regex(/^[0-9a-f]{7,40}$/)
      .nullable()
      .optional()
      .describe("Git commit SHA produced by the run, if any."),
    prompt_hash: z
      .string()
      .regex(/^[0-9a-f]{64}$/)
      .nullable()
      .optional()
      .describe("SHA-256 hash of the prompt template used by the run."),
    configuration_hash: z
      .string()
      .regex(/^[0-9a-f]{64}$/)
      .nullable()
      .optional()
      .describe("SHA-256 hash of the task configuration used by the run."),
    engine_version: z.string().min(1).describe("Engine version constant active during the run."),
    window: RunWindowSchema.nullable()
      .optional()
      .describe("Optional time window covered by the run."),
    queries: z
      .array(z.string().min(1))
      .default([])
      .describe(
        "OSINT queries executed, when shareable; kept in the repository after secret minimization.",
      ),
    sources_consulted: z
      .array(z.string().min(1))
      .default([])
      .describe(
        "Public sources or URLs consulted; credentials and auth parameters are stripped before storage.",
      ),
    estimated_cost: z
      .number()
      .nonnegative()
      .nullable()
      .optional()
      .describe("Estimated monetary or unit cost of the run."),
    errors: z.array(RunErrorSchema).default([]).describe("Errors recorded during the run."),
    status: z.enum(RUN_STATUSES).describe("Terminal or missed status of the run."),
    slot_id: z
      .string()
      .min(1)
      .optional()
      .describe("Optional scheduled slot identifier for missed-run reconciliation."),
    notes: z
      .string()
      .min(1)
      .optional()
      .describe(
        "Optional operational notes (impediments, limits); minimized for secrets before storage.",
      ),
  })
  .describe(
    "Run manifest for scheduled tasks, Actions and code agents, stored minimized in docs/runs/manifests/ of the single public repository (D1).",
  );
export type RunManifest = z.infer<typeof RunManifestSchema>;

export const PublicRunManifestSchema = z
  .strictObject({
    run_id: z.string().min(1).describe("Unique identifier of the run."),
    task: z.string().min(1).describe("Task or workflow name executed in this run."),
    role: z.string().min(1).describe("Operational role of the actor."),
    provider: z.string().min(1).describe("Execution or AI provider identifier."),
    model: z.string().min(1).describe("Model identifier used by the run, or none."),
    scheduled_at: UtcTimestamp.describe("UTC timestamp when the run was scheduled to start."),
    started_at: UtcTimestamp.nullable()
      .optional()
      .describe("UTC timestamp when the run actually started, or null if missed."),
    finished_at: UtcTimestamp.nullable()
      .optional()
      .describe("UTC timestamp when the run finished, or null if missed or incomplete."),
    input_commit_sha: z
      .string()
      .regex(/^[0-9a-f]{7,40}$/)
      .nullable()
      .optional()
      .describe("Git commit SHA of the repository input state."),
    output_commit_sha: z
      .string()
      .regex(/^[0-9a-f]{7,40}$/)
      .nullable()
      .optional()
      .describe("Git commit SHA produced by the run, if any."),
    prompt_hash: z
      .string()
      .regex(/^[0-9a-f]{64}$/)
      .nullable()
      .optional()
      .describe("SHA-256 hash of the prompt template used by the run."),
    configuration_hash: z
      .string()
      .regex(/^[0-9a-f]{64}$/)
      .nullable()
      .optional()
      .describe("SHA-256 hash of the task configuration used by the run."),
    engine_version: z.string().min(1).describe("Engine version constant active during the run."),
    window: RunWindowSchema.nullable()
      .optional()
      .describe("Optional time window covered by the run."),
    estimated_cost: z
      .number()
      .nonnegative()
      .nullable()
      .optional()
      .describe("Estimated monetary or unit cost of the run."),
    errors: z
      .array(PublicRunErrorSchema)
      .default([])
      .describe("Sanitized error entries with sensitive messages stripped."),
    status: z.enum(RUN_STATUSES).describe("Terminal or missed status of the run."),
    slot_id: z.string().min(1).optional().describe("Optional scheduled slot identifier."),
  })
  .describe("Sanitized public projection of a run manifest without queries or private sources.");
export type PublicRunManifest = z.infer<typeof PublicRunManifestSchema>;
