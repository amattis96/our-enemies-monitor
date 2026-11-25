import { z } from "zod";
import {
  CANONICAL_PREDICATES,
  CLASSIFICATION_STATUSES,
  EVIDENCE_NATURES,
  EVIDENTIARY_VERIFICATION_STATES,
  MigrationState,
} from "../claims/index.ts";
import {
  CountryCode,
  DateRange,
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
  ORIGIN_TYPES,
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

// ---------------------------------------------------------------------------
// PK-06A: Qualified assertions & multi-incident cases ready for data/cases/ and data/claims/

export const INCIDENT_ID = /^INC-\d{4}$/;
export const IncidentId = z.string().regex(INCIDENT_ID);

/**
 * Distinguishes "un'autorità ha attribuito" (`authority_attributed`) from
 * "l'attribuzione è accertata" (`attribution_established`).
 */
export const ATTRIBUTION_QUALIFICATIONS = [
  "authority_attributed",
  "attribution_established",
  "denied",
  "disputed",
  "unattributed",
] as const;
export type AttributionQualification = (typeof ATTRIBUTION_QUALIFICATIONS)[number];

export const EVIDENCE_POLARITIES = ["supporting", "contrary"] as const;
export type EvidencePolarity = (typeof EVIDENCE_POLARITIES)[number];

export const EvidenceItem = z.strictObject({
  id: z.string().min(1).describe("Stable identifier of the evidence item."),
  polarity: z
    .enum(EVIDENCE_POLARITIES)
    .describe("Whether the evidence supports or contradicts the assertion."),
  source_id: SourceId.describe("Source code citing or carrying this evidence."),
  origin_type: z
    .enum([...ORIGIN_TYPES, "unknown"])
    .optional()
    .describe("B17 origin_type of the evidence source, or 'unknown' when undetermined."),
  evidence_nature: z
    .enum(EVIDENCE_NATURES)
    .describe("Nature of the evidence (official_document, direct_testimony, etc.)."),
  summary: LocalizedText.describe("Concise summary of what this evidence establishes or disputes."),
  url: Url.nullable().describe("Direct URL of the evidence document, or null when absent."),
});
export type EvidenceItem = z.infer<typeof EvidenceItem>;

export const QualifiedAssertion = z.strictObject({
  id: ClaimId.describe("Stable assertion ID (CL-####); never renumbered or reused."),
  case_id: CaseId.describe("Case this assertion belongs to."),
  incident_id: IncidentId.nullable().describe(
    "Specific incident within a multi-incident case, or null if case-wide.",
  ),
  subject: NodeId.describe("Subject entity or event ID of the assertion."),
  canonical_predicate: z
    .enum(CANONICAL_PREDICATES)
    .nullable()
    .describe("Canonical predicate ID from PK-06C taxonomy, or null when unmapped/needs_review."),
  original_predicate: z
    .string()
    .min(1)
    .describe("Original predicate from the corpus or editorial record, preserved verbatim."),
  classification_status: z
    .enum(CLASSIFICATION_STATUSES)
    .describe("PK-06C classification status: mapped, unmapped, or needs_review."),
  object: NodeId.describe("Object entity or event ID of the assertion."),
  temporal_interval: DateRange.describe("Temporal interval of the asserted fact or attribution."),
  asserted_by: NodeId.nullable().describe(
    "Entity making the assertion (e.g. authority or court), or null when not stated.",
  ),
  attribution_qualification: z
    .enum(ATTRIBUTION_QUALIFICATIONS)
    .describe(
      "Explicitly distinguishes authority_attributed (an authority attributed) from attribution_established (attribution established).",
    ),
  supporting_evidence: z
    .array(EvidenceItem)
    .describe("Supporting evidence items with their origin and nature."),
  contrary_evidence: z
    .array(EvidenceItem)
    .describe("Contrary or disputing evidence items with their origin and nature."),
  evidence_level: z
    .enum(RELATIONSHIP_EVIDENCE_LEVELS)
    .nullable()
    .describe("Evidentiary qualification (E1-E4), or null when not assigned."),
  verification_state: z
    .enum(EVIDENTIARY_VERIFICATION_STATES)
    .describe("PK-06D evidentiary verification state: pending, verified, or disputed."),
  migration: MigrationState.describe("PK-06D three-dimensional migration state."),
  review: Review.describe("Editorial review state of the assertion."),
  provenance: emptyProvenance,
});
export type QualifiedAssertion = z.infer<typeof QualifiedAssertion>;

export const Incident = z.strictObject({
  id: IncidentId.describe("Stable incident ID (INC-####) within a case."),
  title: LocalizedText.describe("Short title of the distinct incident."),
  date: DateRange.describe("Temporal interval of this specific incident."),
  events: z
    .array(EventId)
    .min(1)
    .describe("Events that are phases of this specific incident (counted once per incident)."),
  places: z.array(CountryCode).describe("ISO 3166-1 alpha-2 country codes for this incident."),
});
export type Incident = z.infer<typeof Incident>;

export const QualifiedCase = z.strictObject({
  id: CaseId.describe("Stable case ID (CASE-####); never renumbered or reused."),
  title: LocalizedText.describe("Short title of the case."),
  summary: LocalizedText.describe("What the case groups; it adds no claim of its own."),
  incidents: z
    .array(Incident)
    .min(1)
    .describe(
      "Distinct incidents grouped under this case, enabling separate incident counts per case.",
    ),
  events: z
    .array(EventId)
    .min(1)
    .describe("All events that are phases of the case across its incidents."),
  assertions: z
    .array(ClaimId)
    .min(1)
    .describe("Assertion IDs belonging to this case; every case must have at least one assertion."),
  grouping_basis: LocalizedText.describe(
    "Why these incidents and events form one case, stated from the records.",
  ),
  sources,
  migration: MigrationState.describe("PK-06D three-dimensional migration state."),
  review: Review.describe("Editorial review state of the case."),
  provenance: emptyProvenance,
});
export type QualifiedCase = z.infer<typeof QualifiedCase>;

export const CaseCollectionFile = z.strictObject({
  collection: z.literal("cases").describe("Collection name for data/cases/."),
  version: z.literal(1).describe("Collection format version."),
  cases: z.array(QualifiedCase).describe("Qualified multi-incident cases."),
});
export type CaseCollectionFile = z.infer<typeof CaseCollectionFile>;

export const ClaimCollectionFile = z.strictObject({
  collection: z.literal("claims").describe("Collection name for data/claims/."),
  version: z.literal(1).describe("Collection format version."),
  claims: z.array(QualifiedAssertion).describe("Qualified assertions."),
});
export type ClaimCollectionFile = z.infer<typeof ClaimCollectionFile>;
