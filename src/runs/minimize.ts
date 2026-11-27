import { type RunManifest, RunManifestSchema } from "./schema.ts";

/**
 * Minimization of run manifests before they are stored in the single public
 * repository (PK-08, D1/D12). Ordinary OSINT queries and public source URLs
 * are kept; only genuinely sensitive detail is removed: credentials and
 * tokens, authentication data inside URLs, and messages flagged sensitive.
 */

const REDACTED = "[REDACTED]";

/** Secret-looking values: provider keys, GitHub tokens, bearer/basic credentials. */
const SECRET_PATTERNS: readonly RegExp[] = [
  /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}\b/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
  /\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{20,}\b/g,
  /\bAIza[0-9A-Za-z_-]{30,}\b/g,
  /\bxox[abpr]-[A-Za-z0-9-]{10,}\b/g,
  /\b(?:bearer|basic)\s+[A-Za-z0-9._~+/=-]{12,}/gi,
  /\b(?:password|passwd|secret|api[_-]?key|access[_-]?token|auth[_-]?token)\s*[:=]\s*\S+/gi,
];

/** Query parameters that carry authentication material. */
const AUTH_PARAMS = new Set([
  "token",
  "access_token",
  "auth",
  "auth_token",
  "api_key",
  "apikey",
  "key",
  "sig",
  "signature",
  "password",
  "pass",
  "session",
  "sessionid",
  "x-amz-signature",
  "x-amz-credential",
  "x-amz-security-token",
]);

/** Remove userinfo and authentication query parameters from a URL. */
export function stripUrlCredentials(value: string): string {
  return value.replace(/https?:\/\/[^\s"'<>]+/gi, (raw) => {
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      return raw;
    }
    let changed = false;
    if (url.username || url.password) {
      url.username = "";
      url.password = "";
      changed = true;
    }
    for (const name of [...url.searchParams.keys()]) {
      if (AUTH_PARAMS.has(name.toLowerCase())) {
        url.searchParams.set(name, REDACTED);
        changed = true;
      }
    }
    return changed ? url.toString() : raw;
  });
}

/** Redact secrets and URL credentials in free text. */
export function redactSecrets(value: string): string {
  let out = stripUrlCredentials(value);
  for (const pattern of SECRET_PATTERNS) out = out.replace(pattern, REDACTED);
  return out;
}

/** True when a string still looks like it carries a secret after minimization. */
export function containsSecret(value: string): boolean {
  return SECRET_PATTERNS.some((pattern) => {
    pattern.lastIndex = 0;
    const hit = pattern.test(value);
    pattern.lastIndex = 0;
    return hit;
  });
}

/**
 * Minimized manifest for storage in `docs/runs/manifests/`. Errors flagged
 * `sensitive` lose their message; every other string is kept with secrets
 * and URL credentials redacted.
 */
export function minimizeRunManifest(input: RunManifest): RunManifest {
  const manifest = RunManifestSchema.parse(input);
  const result: RunManifest = {
    ...manifest,
    queries: manifest.queries.map(redactSecrets),
    sources_consulted: manifest.sources_consulted.map(redactSecrets),
    errors: manifest.errors.map((error) =>
      error.sensitive
        ? { ...error, message: REDACTED }
        : { ...error, message: redactSecrets(error.message) },
    ),
  };
  if (manifest.notes !== undefined) result.notes = redactSecrets(manifest.notes);
  return RunManifestSchema.parse(result);
}
