import {
  type PublicRunError,
  type PublicRunManifest,
  PublicRunManifestSchema,
  type RunError,
  type RunManifest,
} from "./schema.ts";

const SENSITIVE_MESSAGE_PATTERNS: readonly RegExp[] = [
  /https?:\/\//i,
  /\bsources\/(original|incremental)\b/i,
  /\b(bearer|token|secret|password|api[_-]?key|authorization)\b/i,
  /\b(query|queries|hypothesis|entity|dossier)\b/i,
];

function isSensitiveError(error: RunError): boolean {
  if (error.sensitive) return true;
  return SENSITIVE_MESSAGE_PATTERNS.some((pattern) => pattern.test(error.message));
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
    result.message = error.message;
  }
  return result;
}

/**
 * Produce the sanitized public projection of a RunManifest (PK-08).
 * Strips `queries`, `sources_consulted`, `notes`, and sensitive error messages
 * so non-publishable investigative trails never leak to the public repository.
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
