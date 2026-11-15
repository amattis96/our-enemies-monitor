import { z } from "zod";
import {
  EntityId,
  EventId,
  LocalizedText,
  NodeId,
  PartialDate,
  ProvenanceEntry,
  RelationshipId,
  Review,
  SourceId,
  Url,
} from "./schemas.ts";
import {
  CLAIM_ASPECTS,
  CLAIM_KINDS,
  PROCEDURAL_STATUSES,
  RELATIONSHIP_EVIDENCE_LEVELS,
} from "./vocabularies.ts";

/**
 * ADR-06 (B18, proposed, to be confirmed): additive Case and Claim model.
 * Not a canonical collection yet: the pilot lives in
 * `docs/audit/cases/pilot.v1.json`, is validated against `data/` and is
 * neither published nor exported. Claims are written by hand from existing
 * records and sources, never generated from the baseline.
 */

export const CASE_ID = /^CASE-\d{4}$/;
export const CLAIM_ID = /^CL-\d{4}$/;
export const CaseId = z.string().regex(CASE_ID);
export const ClaimId = z.string().regex(CLAIM_ID);

const emptyProvenance = z
  .array(ProvenanceEntry)
  .max(0)
  .describe("Always empty: cases and claims are editorial records, never imported.");
const sources = z
  .array(SourceId)
  .min(1)
  .describe(
    "Codes of cited sources (see sources.json). Corpus synthesis documents are not independent confirmations.",
  );

/** Where the text of a claim comes from: an existing record field. */
export const TranscribedFrom = z.strictObject({
  record: z
    .union([EventId, RelationshipId, SourceId])
    .describe("Existing event, relationship or source record the claim is transcribed from."),
  field: z
    .enum(["title", "description", "evidence_note", "date", "predicate", "caveat"])
    .describe("Field of that record whose content the claim restates; it must not be empty."),
});

/** AGENTS.md rule 7 for a named person a claim concerns. */
export const PersonStatus = z.strictObject({
  entity: EntityId.describe("Person entity the claim concerns."),
  status: z
    .enum(PROCEDURAL_STATUSES)
    .describe(
      "Exact legal or procedural status at status_date, not a ranking. Definitions: vocabulary.json#/procedural_statuses.",
    ),
  status_date: PartialDate.describe(
    "Date of that status with its real precision (YYYY, YYYY-MM or YYYY-MM-DD); never a publication date taken as the date of a conduct.",
  ),
  primary_source: SourceId.describe(
    "Specific primary source of the status: an external reference also cited by the claim.",
  ),
  primary_url: Url.describe("URL of the primary source; must be registered on that source."),
  note: LocalizedText.nullable().describe(
    "Limits of the status (for example finality not recorded); null when none.",
  ),
});

export const Case = z.strictObject({
  id: CaseId.describe("Stable case ID (CASE-####); never renumbered or reused."),
  title: LocalizedText.describe("Short title of the case."),
  summary: LocalizedText.describe("What the case groups; it adds no claim of its own."),
  events: z
    .array(EventId)
    .min(1)
    .describe(
      "Events that are phases of the case. Two phases of one case are not two independent confirmations.",
    ),
  grouping_basis: LocalizedText.describe(
    "Why these events are one case, stated from the records (editorial grouping rule).",
  ),
  sources,
  review: Review.describe("Editorial review state of the case."),
  provenance: emptyProvenance,
});

export const Claim = z.strictObject({
  id: ClaimId.describe("Stable claim ID (CL-####); never renumbered or reused."),
  case: CaseId.describe("Case the claim belongs to."),
  kind: z
    .enum(CLAIM_KINDS)
    .describe(
      "fact, attribution, denial or judgment: distinct claims, never merged. An attribution is not a judgment. Definitions: vocabulary.json#/claim_kinds.",
    ),
  aspect: z
    .enum(CLAIM_ASPECTS)
    .describe(
      "What the claim is about: occurrence, perpetrator, sponsor, motive or impact, each a separate claim. Definitions: vocabulary.json#/claim_aspects.",
    ),
  proposition: LocalizedText.describe(
    "The proposition, restating the cited record fields without adding precision or inference.",
  ),
  limit: LocalizedText.nullable().describe(
    "What the claim does not establish (who established it, scope of the asserter, details resting on a single source); null when none.",
  ),
  about: z
    .array(z.union([EventId, RelationshipId]))
    .min(1)
    .describe("Events or relationships of the case the claim is about."),
  subjects: z
    .array(EntityId)
    .describe("Entities the proposition concerns; a person requires person_status."),
  asserted_by: NodeId.nullable().describe(
    "Entity that makes the claim (required for attribution and denial); null when the records do not name it.",
  ),
  asserted_on: PartialDate.nullable().describe(
    "When the claim was made, with its real precision; null when the records do not state it. Distinct from the date of the fact.",
  ),
  responds_to: ClaimId.nullable().describe(
    "Claim this one replies to (required for a denial); null otherwise.",
  ),
  supersedes: ClaimId.nullable().describe("Claim this one replaces; null when none."),
  evidence_level: z
    .enum(RELATIONSHIP_EVIDENCE_LEVELS)
    .nullable()
    .describe(
      "Kind of basis (E1-E4) of this specific claim, not a ranking (ADR-04); copied from a listed relationship, else null. Definitions: vocabulary.json#/evidence_levels.",
    ),
  relationships: z
    .array(RelationshipId)
    .describe(
      "Existing relationships that carry the same statement (same about record, endpoint or event); empty when none. A person claim lists the relationship carrying the primary_url.",
    ),
  transcribed_from: z
    .array(TranscribedFrom)
    .min(1)
    .describe("Record fields the proposition is transcribed from."),
  person_status: z
    .array(PersonStatus)
    .describe("Procedural status of each person subject or asserter (AGENTS.md rule 7)."),
  sources,
  review: Review.describe("Editorial review state of the claim."),
  provenance: emptyProvenance,
});

export const CasePilotFile = z.strictObject({
  pilot: z.literal("case-claim").describe("File kind."),
  version: z.literal(1).describe("File format version."),
  as_of_commit: z
    .string()
    .regex(/^[a-f0-9]{7,40}$/)
    .describe("Commit of the data the pilot was reconstructed from."),
  notes: z.array(z.string().min(10)).describe("Scope, omissions and limits of the pilot."),
  cases: z.array(Case).describe("Pilot cases."),
  claims: z.array(Claim).describe("Pilot claims."),
});

/** Record schemas emitted by `pnpm schemas` (additive, ADR-10). */
export const CASE_SCHEMAS = { cases: Case, claims: Claim } as const;

export type Case = z.infer<typeof Case>;
export type Claim = z.infer<typeof Claim>;
export type PersonStatus = z.infer<typeof PersonStatus>;
export type CasePilotFile = z.infer<typeof CasePilotFile>;
