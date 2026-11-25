import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import { z } from "zod";
import { REPO_ROOT } from "../pipeline/paths.ts";

export const WorkflowViolationSchema = z
  .strictObject({
    file: z.string().describe("Workflow filename relative to .github/workflows/."),
    rule: z
      .enum([
        "sha-pinning",
        "minimal-permissions",
        "no-pull-request-target",
        "no-inline-expression",
        "loop-prevention",
      ])
      .describe("Security rule that was violated."),
    message: z.string().describe("Actionable description of the violation."),
  })
  .describe("Single security audit violation in a GitHub Actions workflow.");

export type WorkflowViolation = z.infer<typeof WorkflowViolationSchema>;

export const WorkflowAuditResultSchema = z
  .strictObject({
    passed: z.boolean().describe("True when all audited workflow files pass every rule."),
    files_checked: z.array(z.string()).describe("Sorted list of workflow filenames audited."),
    violations: z.array(WorkflowViolationSchema).describe("All detected violations."),
  })
  .describe("Aggregate result of auditing all GitHub Actions workflows.");

export type WorkflowAuditResult = z.infer<typeof WorkflowAuditResultSchema>;

type ParsedWorkflow = {
  permissions?: Record<string, string>;
  on?: Record<string, unknown>;
  concurrency?: { group?: string; "cancel-in-progress"?: unknown };
  jobs?: Record<
    string,
    {
      if?: string;
      permissions?: Record<string, string>;
      concurrency?: { group?: string };
      steps?: Array<{ uses?: string; run?: string }>;
    }
  >;
};

const SHA_USES_RE = /uses:\s+[\w.-]+\/[\w.-]+@[0-9a-f]{40}(?:\s+#\s*v\d+\.\d+\.\d+)?\s*$/;
const HAS_WRITE = (perms: Record<string, string> | undefined): boolean =>
  Object.values(perms ?? {}).includes("write");

/**
 * Audit all `.github/workflows/*.yml` files for:
 * - SHA-pinned `uses:` actions
 * - Minimal top-level and job-level permissions (no write on jobs running repo code)
 * - No `pull_request_target`
 * - No `${{ }}` interpolation inside `run:` scripts
 * - Loop-prevention concurrency/token/path guards
 */
export function auditWorkflows(
  workflowsDir: string = path.join(REPO_ROOT, ".github/workflows"),
): WorkflowAuditResult {
  const files = readdirSync(workflowsDir)
    .filter((f) => /\.ya?ml$/.test(f))
    .sort();
  const violations: WorkflowViolation[] = [];

  for (const file of files) {
    const raw = readFileSync(path.join(workflowsDir, file), "utf8");
    const parsed = parse(raw) as ParsedWorkflow;

    if (/\bpull_request_target\b/.test(raw)) {
      violations.push({
        file,
        rule: "no-pull-request-target",
        message: "pull_request_target is forbidden to prevent untrusted PR code execution.",
      });
    }

    for (const line of raw.split("\n")) {
      if (/^\s*-?\s*uses:/.test(line) && !SHA_USES_RE.test(line)) {
        violations.push({
          file,
          rule: "sha-pinning",
          message: `Action must be pinned to a 40-char commit SHA: ${line.trim()}`,
        });
      }
    }

    if (!parsed.permissions || HAS_WRITE(parsed.permissions)) {
      violations.push({
        file,
        rule: "minimal-permissions",
        message: "Top-level workflow permissions must be explicitly defined and read-only.",
      });
    }

    const jobs = Object.entries(parsed.jobs ?? {});
    for (const [jobId, job] of jobs) {
      const steps = job.steps ?? [];
      const runsRepoCode = steps.some(
        (s) =>
          String(s.uses ?? "").startsWith("actions/checkout") ||
          /\b(?:pnpm|node\s+src)\b/.test(String(s.run ?? "")),
      );
      if (runsRepoCode && HAS_WRITE(job.permissions)) {
        violations.push({
          file,
          rule: "minimal-permissions",
          message: `Job "${jobId}" runs repository code and must not hold write permissions.`,
        });
      }
      for (const step of steps) {
        if (typeof step.run === "string" && /\$\{\{[^}]*\}\}/.test(step.run)) {
          violations.push({
            file,
            rule: "no-inline-expression",
            message: `Job "${jobId}" interpolates \${{ }} directly in a run script; pass via env instead.`,
          });
        }
      }
    }

    const hasConcurrency =
      Boolean(parsed.concurrency?.group) || jobs.some(([, j]) => Boolean(j.concurrency?.group));
    if (!hasConcurrency) {
      violations.push({
        file,
        rule: "loop-prevention",
        message: "Workflow must define a concurrency group to prevent overlapping or looping runs.",
      });
    }
  }

  return {
    passed: violations.length === 0,
    files_checked: files,
    violations,
  };
}
