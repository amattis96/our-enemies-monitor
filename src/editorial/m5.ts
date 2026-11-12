import { readFileSync } from "node:fs";
import { z } from "zod";
import type { Dataset } from "../model/index.ts";
import { repoPath } from "../pipeline/paths.ts";

const Url = z.url({ protocol: /^https?$/ });
const AuditSource = z.strictObject({
  id: z.string().min(1),
  publisher: z.string().min(1),
  url: Url,
  issued_at: z.iso.date().nullable(),
  source_type: z.string().min(1),
  retrieved_at: z.iso.date(),
  archived_url: Url.nullable(),
  content_sha256: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .nullable(),
  verification: z.enum(["opened_or_matched_in_source_search"]),
});
const RelationshipReview = z.strictObject({
  id: z.string().regex(/^G-\d{4}$/),
  source_id: z.string().nullable(),
  assessment: z.enum(["matched_with_scope_limits", "primary_not_found"]),
  limitation: z.string().min(15),
  human_approved: z.boolean(),
});
const Fonte09Decision = z.strictObject({
  id: z.string().regex(/^EXT-\d{3}$/),
  oem_id: z.string().regex(/^OEM26-\d{3}$/),
  case_id: z.string().min(3),
  action: z.enum([
    "standalone_event",
    "merge_case",
    "source_only",
    "correction_only",
    "procedural_event",
    "ongoing_update",
    "split_required",
  ]),
  target_id: z.string().nullable(),
  rationale: z.string().min(20),
  source_checked: z.boolean(),
  human_approved: z.boolean(),
});
const AtomicClaim = z.strictObject({
  id: z.string().regex(/^C-\d{3}$/),
  record_id: z.string().min(1),
  aspect: z.string().min(3),
  evidence_level: z.enum(["E1", "E2", "E3", "E4"]),
  proposition_it: z.string().min(25),
  source_ids: z.array(z.string()).min(1),
  limitation_it: z.string().min(20),
  contrary_evidence_it: z.string().nullable(),
  attribution_confidence: z.enum(["institutional_claim", "not_quantified"]),
  impact_confidence: z.enum(["not_quantified"]),
  human_approved: z.boolean(),
});

export const M5Audit = z.strictObject({
  version: z.string().min(1),
  compiled_at: z.iso.date(),
  baseline_commit: z.string().regex(/^[a-f0-9]{40}$/),
  policy: z.string().min(1),
  sources: z.array(AuditSource).min(1),
  relationship_reviews: z.array(RelationshipReview).min(1),
  fonte09_decisions: z.array(Fonte09Decision).min(1),
  atomic_claims: z.array(AtomicClaim).min(1),
});
export type M5Audit = z.infer<typeof M5Audit>;

export const M5_AUDIT_PATH = "docs/audit/M5_2026-11-12.json";

export function readM5Audit(): M5Audit {
  return M5Audit.parse(JSON.parse(readFileSync(repoPath(M5_AUDIT_PATH), "utf8")));
}

/** Original 36 person links requiring primary-source review at M5 intake. */
const ORIGINAL_PERSON_EDGES = [
  24, 25, 26, 27, 40, 41, 42, 43, 71, 73, 74, 77, 88, 89, 90, 117, 132, 137, 138, 139, 159, 170,
  176, 179, 193, 213, 219, 230, 254, 259, 262, 266, 274, 287, 327, 336,
].map((n) => "G-" + String(n).padStart(4, "0"));

function checkDuplicates<T extends { id: string }>(name: string, records: T[], errors: string[]) {
  const seen = new Set<string>();
  for (const record of records) {
    if (seen.has(record.id)) errors.push("duplicate " + name + ": " + record.id);
    seen.add(record.id);
  }
}

/** Structural integrity and publication safeguards, NOT final source authentication. */
export function validateM5Audit(report: M5Audit, dataset: Dataset): string[] {
  const errors: string[] = [];
  checkDuplicates("source", report.sources, errors);
  checkDuplicates("person link", report.relationship_reviews, errors);
  checkDuplicates("Fonte_09 decision", report.fonte09_decisions, errors);
  checkDuplicates("atomic claim", report.atomic_claims, errors);
  const sources = new Map(report.sources.map((s) => [s.id, s]));
  const events = new Map(dataset.events.map((e) => [e.id, e]));
  const entities = new Map(dataset.entities.map((e) => [e.id, e]));
  const relationships = new Map(dataset.relationships.map((r) => [r.id, r]));
  const knownPersonEdges = new Set(ORIGINAL_PERSON_EDGES);
  const reviewedPersonEdges = new Set(report.relationship_reviews.map((r) => r.id));
  for (const id of knownPersonEdges) {
    if (!reviewedPersonEdges.has(id)) errors.push("missing person link: " + id);
  }
  for (const item of report.relationship_reviews) {
    const r = relationships.get(item.id);
    if (!knownPersonEdges.has(item.id)) errors.push("unexpected person link: " + item.id);
    if (!r) {
      errors.push("relationship not found: " + item.id);
      continue;
    }
    if (![r.subject, r.object].some((id) => entities.get(id)?.kind === "person")) {
      errors.push("not a person link: " + item.id);
    }
    if (item.human_approved && r.review.status !== "reviewed") {
      errors.push("unreviewed human approval: " + item.id);
    }
    if (item.source_id === null) {
      if (item.assessment !== "primary_not_found" || r.primary_url !== null) {
        errors.push("unresolved link must stay quarantined: " + item.id);
      }
    } else {
      const source = sources.get(item.source_id);
      if (!source) errors.push("unknown source for " + item.id + ": " + item.source_id);
      if (item.assessment !== "matched_with_scope_limits") {
        errors.push("invalid assessment for " + item.id);
      }
      if (source && r.primary_url !== source.url) {
        errors.push("primary_url differs from audit source for " + item.id);
      }
    }
  }

  const required = Array.from({ length: 30 }, (_, i) => "EXT-" + String(i + 5).padStart(3, "0"));
  const proposed = new Set(report.fonte09_decisions.map((d) => d.id));
  for (const id of required) if (!proposed.has(id)) errors.push("missing Fonte_09 decision: " + id);
  for (const decision of report.fonte09_decisions) {
    const record = events.get(decision.id);
    if (!required.includes(decision.id)) errors.push("unexpected Fonte_09 ID: " + decision.id);
    if (!record) {
      errors.push("missing candidate: " + decision.id);
    } else if (
      !decision.human_approved &&
      (record.review.status !== "needs_review" || record.timeline_status !== "pending_integration")
    ) {
      errors.push("unapproved candidate published: " + decision.id);
    }
    if (decision.human_approved && record?.review.status !== "reviewed") {
      errors.push("unreviewed human approval: " + decision.id);
    }
    if (decision.target_id && !events.has(decision.target_id)) {
      errors.push("unknown target for " + decision.id + ": " + decision.target_id);
    }
    if (decision.oem_id !== "OEM26-" + String(Number(decision.id.slice(4)) - 4).padStart(3, "0")) {
      errors.push("mismatched OEM ID: " + decision.id);
    }
  }
  for (const claim of report.atomic_claims) {
    const record =
      events.get(claim.record_id) ??
      relationships.get(claim.record_id) ??
      entities.get(claim.record_id);
    if (!record) errors.push("claim missing record: " + claim.id);
    for (const id of claim.source_ids) {
      if (!sources.has(id)) errors.push("claim missing source: " + claim.id + " / " + id);
    }
    if (claim.human_approved && record?.review.status !== "reviewed") {
      errors.push("approved claim linked to unreviewed record: " + claim.id);
    }
  }
  return errors;
}
