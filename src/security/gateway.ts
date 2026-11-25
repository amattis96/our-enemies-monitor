import { z } from "zod";
import { COLLECTION_NAMES, COLLECTIONS, type Dataset } from "../model/index.ts";
import { consistentEvidence, type M5References } from "../pipeline/evidence-policy.ts";
import { corpusOnlyE1 } from "../pipeline/genealogy.ts";
import { publicationReport } from "../site/publication.ts";

export const GatewayChecksSchema = z
  .strictObject({
    schema_valid: z.boolean().describe("All records in the public projection match Zod schemas."),
    visibility_enforced: z
      .boolean()
      .describe("All private/needs_review/pending records were withheld."),
    evidentiary_valid: z
      .boolean()
      .describe("Published relationships satisfy consistentEvidence and no E1 is corpus-only."),
    m5_gate_passed: z
      .boolean()
      .describe("M5 person primary-reference and legacy-hypothesis gates passed."),
    sanitized: z
      .boolean()
      .describe("Sensitive internal notes and private fields were stripped from public records."),
    export_leak_free: z
      .boolean()
      .describe(
        "Serialized public export contains no withheld IDs, secret tokens, or private paths.",
      ),
  })
  .describe("Individual gate results for the private-to-public publication gateway.");

export type GatewayChecks = z.infer<typeof GatewayChecksSchema>;

export const GatewayVerdictSchema = z
  .strictObject({
    passed: z
      .boolean()
      .describe("True only if every gateway check passed without leaks or errors."),
    checks: GatewayChecksSchema.describe("Detailed breakdown of each gateway check."),
    withheld_count: z
      .number()
      .int()
      .nonnegative()
      .describe("Total number of records withheld from the public projection."),
    leaks: z.array(z.string()).describe("Detected boundary leaks or forbidden references."),
    errors: z.array(z.string()).describe("Validation or policy errors blocking publication."),
    warnings: z
      .array(z.string())
      .describe("Non-blocking findings with the same severity as in `pnpm validate` (ADR-05)."),
  })
  .describe("Fail-closed verdict from the private-to-public publication gateway.");

export type GatewayVerdict = z.infer<typeof GatewayVerdictSchema> & {
  public_dataset: Dataset | null;
};

const DEFAULT_FORBIDDEN_PATTERNS: readonly RegExp[] = [
  /sources\/original\//,
  /sources\/incremental\//,
  /<<<OEM_QUARANTINED_SOURCE/,
  /\bAUTOMERGE_TOKEN\b/,
  /\b(?:ghp|gho|ghu|ghs)_[A-Za-z0-9]{20,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/,
  /\bsk-[A-Za-z0-9]{20,}\b/,
  /"dataClass"\s*:\s*"(?:private_investigative|holdout_evaluation)"/,
];

function checkExportLeaks(
  visible: Dataset,
  withheldIds: ReadonlySet<string>,
  extraSensitiveTerms: readonly string[],
): string[] {
  const leaks: string[] = [];

  for (const e of visible.events) {
    for (const s of e.sources) {
      if (withheldIds.has(s)) leaks.push(`Event ${e.id} references withheld source ${s}`);
    }
  }
  for (const r of visible.relationships) {
    if (withheldIds.has(r.subject))
      leaks.push(`Relationship ${r.id} references withheld subject ${r.subject}`);
    if (withheldIds.has(r.object))
      leaks.push(`Relationship ${r.id} references withheld object ${r.object}`);
    for (const ev of r.events) {
      if (withheldIds.has(ev)) leaks.push(`Relationship ${r.id} references withheld event ${ev}`);
    }
  }
  for (const h of visible.hypotheses) {
    if (withheldIds.has(h.subject))
      leaks.push(`Hypothesis ${h.id} references withheld subject ${h.subject}`);
    if (withheldIds.has(h.object))
      leaks.push(`Hypothesis ${h.id} references withheld object ${h.object}`);
    for (const ev of h.events) {
      if (withheldIds.has(ev)) leaks.push(`Hypothesis ${h.id} references withheld event ${ev}`);
    }
  }

  // Two fields legitimately cite the public archive in this repository:
  // `provenance` (rows of `sources/original/` for imported records, hard
  // rule 3, verified by `pnpm validate`) and a corpus source's `files` (the
  // archived documents themselves). Both are public on record pages and in
  // data/v1. Only these fields are exempt: an archive path anywhere else in
  // a public record is still a leak.
  const scannable = {
    ...visible,
    sources: visible.sources.map(({ files: _files, ...rest }) => rest),
  };
  const serialized = JSON.stringify(scannable, (key, value) =>
    key === "provenance" ? undefined : value,
  );
  for (const pattern of DEFAULT_FORBIDDEN_PATTERNS) {
    if (pattern.test(serialized)) {
      leaks.push(`Forbidden pattern matched in public export: ${pattern.source}`);
    }
  }
  for (const term of extraSensitiveTerms) {
    if (term.length > 0 && serialized.includes(term)) {
      leaks.push(`Sensitive term leaked in public export: ${term}`);
    }
  }
  return leaks;
}

/**
 * Single authorized private -> public publication gateway.
 * Fails closed (`passed: false`, `public_dataset: null`) if any check fails.
 */
export function validatePublicationGateway(
  dataset: Dataset,
  options: {
    m5References?: M5References;
    extraSensitiveTerms?: readonly string[];
    skipSchemaCheck?: boolean;
  } = {},
): GatewayVerdict {
  const errors: string[] = [];
  const report = publicationReport(dataset, options.m5References);
  const visible = report.dataset;

  let schemaValid = true;
  if (!options.skipSchemaCheck) {
    for (const collection of COLLECTION_NAMES) {
      const schema = COLLECTIONS[collection];
      for (const record of visible[collection]) {
        const parsed = schema.safeParse(record);
        if (!parsed.success) {
          schemaValid = false;
          errors.push(
            `Schema error in ${collection}/${record.id}: ${parsed.error.issues[0]?.message ?? "invalid"}`,
          );
        }
      }
    }
  }

  const visibilityEnforced =
    visible.events.every(
      (e) => e.review.status !== "needs_review" && e.timeline_status === "integrated",
    ) &&
    visible.entities.every((e) => e.review.status !== "needs_review") &&
    visible.relationships.every((r) => r.review.status !== "needs_review") &&
    visible.hypotheses.every((h) => h.review.status !== "needs_review") &&
    visible.exposures.every((x) => x.review.status !== "needs_review");

  if (!visibilityEnforced) {
    errors.push(
      "Non-publishable record (needs_review or non-integrated) survived publication filter.",
    );
  }

  const invalidEvidence = visible.relationships.filter((r) => !consistentEvidence(r));
  for (const r of invalidEvidence) {
    errors.push(
      `Relationship ${r.id} has inconsistent evidence_level (${r.evidence_level}) and evidence_status (${r.evidence_status}).`,
    );
  }
  // ADR-05: a corpus synthesis alone is not enough for E1, but the ADR and
  // `pnpm validate` classify it as a warning to review, not a publication
  // block. The gateway reports it with the same severity.
  const warnings = corpusOnlyE1(visible.relationships, visible.sources).map(
    (id) => `Relationship ${id} is E1 but relies solely on corpus_synthesis sources (ADR-05).`,
  );
  const evidentiaryValid = invalidEvidence.length === 0;

  const m5Violations = report.withheld.filter(
    (w) =>
      w.reasons.includes("person_primary_missing") ||
      w.reasons.includes("person_primary_unregistered") ||
      w.reasons.includes("legacy_hypothesis_changed"),
  );
  // M5 gate means no leaked person without primary reference or tampered legacy hypothesis reached visible output.
  const m5GatePassed = visible.relationships.every((r) => {
    const withheldIds = new Set(m5Violations.map((v) => v.id));
    return !withheldIds.has(r.id);
  });

  const sanitized = visible.hypotheses.every(
    (h) => h.review.status !== "imported_unreviewed" || h.review.notes.length === 0,
  );
  if (!sanitized) {
    errors.push("Unsanitized review notes present on imported_unreviewed hypothesis.");
  }

  const withheldIds = new Set(report.withheld.map((w) => w.id));
  const leaks = checkExportLeaks(visible, withheldIds, options.extraSensitiveTerms ?? []);
  const exportLeakFree = leaks.length === 0;

  const passed =
    schemaValid &&
    visibilityEnforced &&
    evidentiaryValid &&
    m5GatePassed &&
    sanitized &&
    exportLeakFree &&
    errors.length === 0;

  return {
    passed,
    checks: {
      schema_valid: schemaValid,
      visibility_enforced: visibilityEnforced,
      evidentiary_valid: evidentiaryValid,
      m5_gate_passed: m5GatePassed,
      sanitized,
      export_leak_free: exportLeakFree,
    },
    withheld_count: report.withheld.length,
    leaks,
    errors,
    warnings,
    public_dataset: passed ? visible : null,
  };
}
