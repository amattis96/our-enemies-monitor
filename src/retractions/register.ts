import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { LocalizedText } from "../model/index.ts";
import { repoPath } from "../pipeline/paths.ts";
import {
  CONTROLLED_PROJECTIONS,
  type ControlledProjection,
  ControlledProjectionSchema,
  DEFAULT_MAX_STALENESS_SECONDS,
  DEFAULT_UNCONTROLLABLE_COPIES_NOTICE,
  type ExternalWithdrawalEntry,
  ExternalWithdrawalEntrySchema,
  ResponseActionSchema,
  type RetractionLevel,
  RetractionLevelSchema,
  responseForLevel,
} from "./policy.ts";

export const RETRACTION_ID = /^RET-\d{3,4}$/;

export const RetractionIdSchema = z
  .string()
  .regex(RETRACTION_ID)
  .describe("Stable retraction register entry identifier (RET-### or RET-####).");

export const RETRACTION_ENTRY_STATUSES = ["open", "contained", "resolved"] as const;

export const RetractionEntryStatusSchema = z
  .enum(RETRACTION_ENTRY_STATUSES)
  .describe("Operational status of the retraction entry (open, contained, or resolved).");

export type RetractionEntryStatus = z.infer<typeof RetractionEntryStatusSchema>;

export const RetractionEntrySchema = z.strictObject({
  id: RetractionIdSchema.describe("Stable retraction entry ID."),
  source_id: z.string().min(1).describe("Identifier of the retracted or contested source."),
  level: RetractionLevelSchema.describe("Severity level of the retraction."),
  action: ResponseActionSchema.describe(
    "Response action mandated by the tiered policy for this level.",
  ),
  status: RetractionEntryStatusSchema.describe(
    "Current containment status (open, contained, or resolved).",
  ),
  recorded_at: z
    .string()
    .min(1)
    .describe("ISO-8601 date or timestamp when the retraction was recorded."),
  reason: z.string().min(1).describe("Documented reason for the retraction or correction."),
  before: z
    .record(z.string(), z.unknown())
    .describe("Snapshot of relevant state before the retraction was applied."),
  after: z
    .record(z.string(), z.unknown())
    .describe("Snapshot of relevant state after the retraction was applied."),
  suspended_ids: z
    .array(z.string().min(1))
    .describe("Record and assertion IDs suspended from OEM-controlled projections."),
  flagged_ids: z
    .array(z.string().min(1))
    .describe("Dependent record IDs flagged for review or public notice."),
  public_notice: LocalizedText.nullable().describe(
    "Optional bilingual public review notice for contested or suspended claims.",
  ),
  controlled_projections: z
    .array(ControlledProjectionSchema)
    .describe("OEM-controlled projections where this retraction's containment applies."),
  external_withdrawals: z
    .array(ExternalWithdrawalEntrySchema)
    .describe("External or immutable publication withdrawal/rectification procedures."),
  uncontrollable_copies_notice: z
    .string()
    .min(1)
    .describe("Explicit declaration regarding uncontrollable external copies, forks, and caches."),
  historical_facts_mutated: z
    .literal(false)
    .describe(
      "Invariant guarantee that canonical historical facts were not automatically mutated.",
    ),
});

export type RetractionEntry = z.infer<typeof RetractionEntrySchema>;

export const RetractionRegisterSchema = z.strictObject({
  registry: z.literal("retractions").describe("Registry type identifier."),
  version: z.literal(1).describe("Schema version of the retraction register."),
  max_staleness_seconds: z
    .number()
    .int()
    .positive()
    .describe("Maximum allowed age in seconds for local projections such as MCP."),
  uncontrollable_copies_declaration: z
    .string()
    .min(1)
    .describe("Default declaration for external/immutable copies outside OEM control."),
  entries: z.array(RetractionEntrySchema).describe("Ordered list of retraction register entries."),
});

export type RetractionRegister = z.infer<typeof RetractionRegisterSchema>;

export const DEFAULT_REGISTER_PATH = repoPath("docs/retractions/register.v1.json");

/** Read and schema-validate the retraction register from disk. */
export function readRetractionRegister(
  filePath: string = DEFAULT_REGISTER_PATH,
): RetractionRegister {
  const raw = readFileSync(filePath, "utf8");
  const parsed: unknown = JSON.parse(raw);
  return RetractionRegisterSchema.parse(parsed);
}

/** Write the retraction register in canonical JSON formatting. */
export function writeRetractionRegister(
  register: RetractionRegister,
  filePath: string = DEFAULT_REGISTER_PATH,
): void {
  const validated = RetractionRegisterSchema.parse(register);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(validated, null, 2)}\n`, "utf8");
}

/** Validate semantic invariants of a retraction register beyond schema shape. */
export function validateRetractionRegister(register: RetractionRegister): string[] {
  const errors: string[] = [];
  const seenIds = new Set<string>();
  for (const entry of register.entries) {
    if (seenIds.has(entry.id)) {
      errors.push(`Duplicate retraction entry id "${entry.id}".`);
    }
    seenIds.add(entry.id);

    const expected = responseForLevel(entry.level);
    if (entry.action !== expected.action) {
      errors.push(
        `Entry ${entry.id}: action "${entry.action}" does not match level "${entry.level}" (expected "${expected.action}").`,
      );
    }
    if (expected.suspend_controlled_projections) {
      const covered = new Set(entry.controlled_projections);
      for (const projection of CONTROLLED_PROJECTIONS) {
        if (!covered.has(projection)) {
          errors.push(
            `Entry ${entry.id}: level "${entry.level}" must cover controlled projection "${projection}".`,
          );
        }
      }
    }
  }
  return errors;
}

export type AppendRetractionInput = {
  id: string;
  source_id: string;
  level: RetractionLevel;
  status?: RetractionEntryStatus;
  recorded_at: string;
  reason: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  suspended_ids?: readonly string[];
  flagged_ids?: readonly string[];
  public_notice?: { it: string; en?: string } | null;
  controlled_projections?: readonly ControlledProjection[];
  external_withdrawals?: readonly ExternalWithdrawalEntry[];
  uncontrollable_copies_notice?: string;
};

/**
 * Return a new register with an appended retraction entry, enforcing policy
 * defaults and never mutating historical canonical facts.
 */
export function appendRetractionEntry(
  register: RetractionRegister,
  input: AppendRetractionInput,
): RetractionRegister {
  const rule = responseForLevel(input.level);
  const entry: RetractionEntry = RetractionEntrySchema.parse({
    id: input.id,
    source_id: input.source_id,
    level: input.level,
    action: rule.action,
    status: input.status ?? (rule.suspend_controlled_projections ? "contained" : "open"),
    recorded_at: input.recorded_at,
    reason: input.reason,
    before: input.before,
    after: input.after,
    suspended_ids: [...new Set(input.suspended_ids ?? [])].sort((a, b) => a.localeCompare(b)),
    flagged_ids: [...new Set(input.flagged_ids ?? [])].sort((a, b) => a.localeCompare(b)),
    public_notice: input.public_notice ?? null,
    controlled_projections:
      input.controlled_projections && input.controlled_projections.length > 0
        ? [...input.controlled_projections]
        : rule.suspend_controlled_projections
          ? [...CONTROLLED_PROJECTIONS]
          : [],
    external_withdrawals: input.external_withdrawals ? [...input.external_withdrawals] : [],
    uncontrollable_copies_notice:
      input.uncontrollable_copies_notice ??
      register.uncontrollable_copies_declaration ??
      DEFAULT_UNCONTROLLABLE_COPIES_NOTICE,
    historical_facts_mutated: false,
  });

  const next: RetractionRegister = {
    ...register,
    entries: [...register.entries, entry],
  };
  const issues = validateRetractionRegister(next);
  if (issues.length > 0) {
    throw new Error(`Invalid retraction register update: ${issues.join("; ")}`);
  }
  return next;
}

/** Create an empty, valid retraction register with default policy settings. */
export function createEmptyRetractionRegister(): RetractionRegister {
  return {
    registry: "retractions",
    version: 1,
    max_staleness_seconds: DEFAULT_MAX_STALENESS_SECONDS,
    uncontrollable_copies_declaration: DEFAULT_UNCONTROLLABLE_COPIES_NOTICE,
    entries: [],
  };
}

/**
 * Return the set of record/assertion IDs currently suspended from publication
 * or a specific OEM-controlled projection. Resolved entries do not suspend.
 */
export function suspendedRecordIds(
  register: RetractionRegister = readRetractionRegister(),
  projection?: ControlledProjection,
): Set<string> {
  const suspended = new Set<string>();
  for (const entry of register.entries) {
    if (entry.status === "resolved") continue;
    const rule = responseForLevel(entry.level);
    if (!rule.suspend_controlled_projections) continue;
    if (projection && !entry.controlled_projections.includes(projection)) continue;
    for (const id of entry.suspended_ids) {
      suspended.add(id);
    }
  }
  return suspended;
}
