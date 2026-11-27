import { containsSecret, redactSecrets } from "./minimize.ts";
import {
  type PublicRunError,
  type PublicRunManifest,
  PublicRunManifestSchema,
  type RunError,
  type RunManifest,
} from "./schema.ts";

/**
 * Only genuinely sensitive errors are withheld from the status page: flagged
 * `sensitive`, or still carrying a secret. Ordinary OSINT terms, public URLs
 * and source paths are not sensitive (D1/D12, 26 November 2026).
 */
function isSensitiveError(error: RunError): boolean {
  return error.sensitive || containsSecret(error.message);
}

function sanitizeRunError(error: RunError): PublicRunError {
  const sensitive = isSensitiveError(error);
  const result: PublicRunError = {
    code: error.code,
    redacted: sensitive,
  };
  if (error.stage !== undefined) {
    result.stage = error.stage;
  }
  if (!sensitive) {
    result.message = redactSecrets(error.message);
  }
  return result;
}

/**
 * Compact summary of a RunManifest for the public status page `/stato`
 * (PK-08). The full minimized manifest, with queries and consulted sources,
 * is stored in `docs/runs/manifests/`; the page shows only status, timing,
 * provider/model, versions, cost and non-sensitive errors.
 */
export function sanitizeRunManifest(manifest: RunManifest): PublicRunManifest {
  const projected: PublicRunManifest = {
    run_id: manifest.run_id,
    task: manifest.task,
    role: manifest.role,
    provider: manifest.provider,
    model: manifest.model,
    scheduled_at: manifest.scheduled_at,
    engine_version: manifest.engine_version,
    errors: manifest.errors.map(sanitizeRunError),
    status: manifest.status,
  };

  if (manifest.started_at !== undefined) projected.started_at = manifest.started_at;
  if (manifest.finished_at !== undefined) projected.finished_at = manifest.finished_at;
  if (manifest.input_commit_sha !== undefined) {
    projected.input_commit_sha = manifest.input_commit_sha;
  }
  if (manifest.output_commit_sha !== undefined) {
    projected.output_commit_sha = manifest.output_commit_sha;
  }
  if (manifest.prompt_hash !== undefined) projected.prompt_hash = manifest.prompt_hash;
  if (manifest.configuration_hash !== undefined) {
    projected.configuration_hash = manifest.configuration_hash;
  }
  if (manifest.window !== undefined) projected.window = manifest.window;
  if (manifest.estimated_cost !== undefined) projected.estimated_cost = manifest.estimated_cost;
  if (manifest.slot_id !== undefined) projected.slot_id = manifest.slot_id;

  return PublicRunManifestSchema.parse(projected);
}
