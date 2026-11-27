import { z } from "zod";
import type { Relationship } from "../model/schemas.ts";
import {
  ENTITY_KINDS,
  type EntityKind,
  RELATION_CLASS_GROUP,
  RELATION_GROUPS,
  type RelationGroup,
} from "../model/vocabularies.ts";

/**
 * PK-06C: Canonical predicate taxonomy, mapping metadata, and strict non-forcing rules.
 *
 * Non-forcing rule: no normalization may alter the substance of a statement:
 * - funding != control
 * - co-presence != collaboration
 * - accusation != commission
 * - political_support != coordination
 *
 * Relationships with `classification_status === "unmapped"` (or `"needs_review"`)
 * are excluded from automatic inferences until reviewed.
 */

export const CLASSIFICATION_STATUSES = ["mapped", "unmapped", "needs_review"] as const;
export type ClassificationStatus = (typeof CLASSIFICATION_STATUSES)[number];

export const PREDICATE_DIRECTIONS = ["directed", "bidirectional", "undirected"] as const;
export type PredicateDirection = (typeof PREDICATE_DIRECTIONS)[number];

export const NODE_KINDS = [...ENTITY_KINDS, "event"] as const;
export type NodeKind = EntityKind | "event";

export const MAPPING_VERSION = "1.0.0";

export type CanonicalPredicateSpec = {
  readonly id: string;
  readonly direction: PredicateDirection;
  readonly allowed_subjects: readonly NodeKind[];
  readonly allowed_objects: readonly NodeKind[];
  readonly relation_group: RelationGroup;
  readonly description: string;
};

const ALL_ACTORS: readonly NodeKind[] = [
  "state",
  "institution",
  "person",
  "organization",
  "company",
  "asset",
];

const ALL_NODES: readonly NodeKind[] = [...ALL_ACTORS, "event"];

export const CANONICAL_PREDICATE_TAXONOMY = {
  PARTICIPATED_IN: {
    id: "PARTICIPATED_IN",
    direction: "directed",
    allowed_subjects: ALL_ACTORS,
    allowed_objects: ["event"],
    relation_group: "participation",
    description: "Presence or role at an event; does not imply control or coordination.",
  },
  CO_PRESENT_AT: {
    id: "CO_PRESENT_AT",
    direction: "bidirectional",
    allowed_subjects: ALL_ACTORS,
    allowed_objects: ALL_ACTORS,
    relation_group: "participation",
    description: "Co-presence at the same event or venue; does not imply collaboration.",
  },
  FUNDED: {
    id: "FUNDED",
    direction: "directed",
    allowed_subjects: ALL_ACTORS,
    allowed_objects: ALL_NODES,
    relation_group: "financial",
    description: "Financial transfer, grant, or funding; does not imply operational control.",
  },
  CONTROLLED: {
    id: "CONTROLLED",
    direction: "directed",
    allowed_subjects: ALL_ACTORS,
    allowed_objects: ALL_NODES,
    relation_group: "control",
    description: "Documented operational, ownership, or governance control.",
  },
  OWNED: {
    id: "OWNED",
    direction: "directed",
    allowed_subjects: ALL_ACTORS,
    allowed_objects: ["company", "asset", "organization"],
    relation_group: "control",
    description: "Legal or beneficial ownership.",
  },
  COLLABORATED_WITH: {
    id: "COLLABORATED_WITH",
    direction: "bidirectional",
    allowed_subjects: ALL_ACTORS,
    allowed_objects: ALL_ACTORS,
    relation_group: "influence_information",
    description: "Documented joint operational or organizational collaboration.",
  },
  ACCUSED_OF: {
    id: "ACCUSED_OF",
    direction: "directed",
    allowed_subjects: ALL_ACTORS,
    allowed_objects: ALL_NODES,
    relation_group: "institutional",
    description: "Formal or public accusation/allegation; does not establish commission.",
  },
  COMMISSIONED: {
    id: "COMMISSIONED",
    direction: "directed",
    allowed_subjects: ALL_ACTORS,
    allowed_objects: ALL_NODES,
    relation_group: "security_intelligence",
    description: "Established tasking or commission of an act.",
  },
  POLITICALLY_SUPPORTED: {
    id: "POLITICALLY_SUPPORTED",
    direction: "directed",
    allowed_subjects: ALL_ACTORS,
    allowed_objects: ALL_ACTORS,
    relation_group: "influence_information",
    description: "Public political endorsement or rhetorical support; does not imply coordination.",
  },
  COORDINATED_WITH: {
    id: "COORDINATED_WITH",
    direction: "bidirectional",
    allowed_subjects: ALL_ACTORS,
    allowed_objects: ALL_ACTORS,
    relation_group: "security_intelligence",
    description: "Documented operational coordination between actors.",
  },
  ATTRIBUTED_BY_AUTHORITY: {
    id: "ATTRIBUTED_BY_AUTHORITY",
    direction: "directed",
    allowed_subjects: ["state", "institution"],
    allowed_objects: ALL_NODES,
    relation_group: "institutional",
    description: "Attribution issued by an authority; distinct from judicially established fact.",
  },
  SUPPLIED: {
    id: "SUPPLIED",
    direction: "directed",
    allowed_subjects: ALL_ACTORS,
    allowed_objects: ALL_ACTORS,
    relation_group: "economic_dependency",
    description: "Provision of goods, energy, raw materials, or technology.",
  },
} as const satisfies Record<string, CanonicalPredicateSpec>;

export type CanonicalPredicateId = keyof typeof CANONICAL_PREDICATE_TAXONOMY;
export const CANONICAL_PREDICATES = Object.keys(CANONICAL_PREDICATE_TAXONOMY) as [
  CanonicalPredicateId,
  ...CanonicalPredicateId[],
];

/**
 * Forbidden substance-altering coercions (PK-06C non-forcing rule).
 * Each rule pairs an original semantic category (matched by predicate token)
 * with canonical predicates it must NEVER be forced into.
 */
export type NonForcingRuleId =
  | "funding_not_control"
  | "copresence_not_collaboration"
  | "accusation_not_commission"
  | "political_support_not_coordination";

export type NonForcingRule = {
  readonly id: NonForcingRuleId;
  readonly sourcePattern: RegExp;
  readonly forbiddenTargets: readonly CanonicalPredicateId[];
  readonly reason: string;
};

export const NON_FORCING_RULES: readonly NonForcingRule[] = [
  {
    id: "funding_not_control",
    sourcePattern: /^(FUND|FINANC|PAY|GRANT|BRIBE|SUBSID|FINANZIAMENTO|PAGAMENTO)/i,
    forbiddenTargets: ["CONTROLLED", "OWNED"],
    reason: "Funding does not imply operational control or ownership.",
  },
  {
    id: "copresence_not_collaboration",
    sourcePattern: /^(CO_PRESEN|PRESEN|PARTICIPAT|ATTEND|MEETING|PARTECIPAZIONE)/i,
    forbiddenTargets: ["COLLABORATED_WITH", "COORDINATED_WITH"],
    reason:
      "Co-presence or participation at an event does not imply collaboration or coordination.",
  },
  {
    id: "accusation_not_commission",
    sourcePattern: /^(ACCUS|ALLEG|INDICT|CHARG|SUSPECT|DENUNCIA|ACCUSA)/i,
    forbiddenTargets: ["COMMISSIONED", "CONTROLLED"],
    reason: "An accusation or allegation does not establish commission.",
  },
  {
    id: "political_support_not_coordination",
    sourcePattern: /^(POLITICAL_SUPPORT|POLITICALLY_SUPPORT|ENDORS|SOSTEGNO_POLITICO|APPOGGIO)/i,
    forbiddenTargets: ["COORDINATED_WITH", "COMMISSIONED", "CONTROLLED"],
    reason: "Political support does not imply operational coordination.",
  },
];

export const PredicateMappingRecord = z.strictObject({
  original_predicate: z
    .string()
    .min(1)
    .describe("Original predicate from the corpus, preserved verbatim."),
  canonical_predicate: z
    .enum(CANONICAL_PREDICATES)
    .nullable()
    .describe("Mapped canonical predicate ID, or null when unmapped or needs_review."),
  mapping_version: z
    .string()
    .min(1)
    .describe("Version of the canonical predicate mapping taxonomy used."),
  classification_status: z
    .enum(CLASSIFICATION_STATUSES)
    .describe("Classification status: mapped, unmapped, or needs_review."),
  direction: z
    .enum(PREDICATE_DIRECTIONS)
    .nullable()
    .describe("Directionality of the canonical predicate, or null when unmapped."),
  allowed_subjects: z
    .array(z.enum(NODE_KINDS))
    .describe("Allowed entity/event kinds for the subject endpoint."),
  allowed_objects: z
    .array(z.enum(NODE_KINDS))
    .describe("Allowed entity/event kinds for the object endpoint."),
  relation_group: z
    .enum(RELATION_GROUPS)
    .nullable()
    .describe("Display relation group of the canonical predicate, or null when unmapped."),
  non_forcing_note: z
    .string()
    .nullable()
    .describe("Note documenting any non-forcing boundary applied, or null when none."),
});
export type PredicateMappingRecord = z.infer<typeof PredicateMappingRecord>;

const EXACT_ORIGINAL_TO_CANONICAL: Record<
  string,
  { canonical: CanonicalPredicateId; note: string | null }
> = {
  PARTICIPATED_IN: { canonical: "PARTICIPATED_IN", note: null },
  PARTECIPAZIONE: {
    canonical: "PARTICIPATED_IN",
    note: "Participation only; never coerced to collaboration.",
  },
  CO_PRESENT_AT: {
    canonical: "CO_PRESENT_AT",
    note: "Co-presence only; never coerced to collaboration.",
  },
  FUNDED: { canonical: "FUNDED", note: "Funding only; never coerced to control." },
  FINANCED: { canonical: "FUNDED", note: "Funding only; never coerced to control." },
  FINANZIAMENTO: { canonical: "FUNDED", note: "Funding only; never coerced to control." },
  CONTROLLED: { canonical: "CONTROLLED", note: null },
  OWNED: { canonical: "OWNED", note: null },
  COLLABORATED_WITH: { canonical: "COLLABORATED_WITH", note: null },
  ACCUSED_OF: { canonical: "ACCUSED_OF", note: "Accusation only; never coerced to commission." },
  ALLEGED: { canonical: "ACCUSED_OF", note: "Accusation only; never coerced to commission." },
  COMMISSIONED: { canonical: "COMMISSIONED", note: null },
  POLITICALLY_SUPPORTED: {
    canonical: "POLITICALLY_SUPPORTED",
    note: "Political support only; never coerced to coordination.",
  },
  SOSTEGNO_POLITICO: {
    canonical: "POLITICALLY_SUPPORTED",
    note: "Political support only; never coerced to coordination.",
  },
  COORDINATED_WITH: { canonical: "COORDINATED_WITH", note: null },
  ATTRIBUTED_BY_AUTHORITY: { canonical: "ATTRIBUTED_BY_AUTHORITY", note: null },
  SUPPLIED: { canonical: "SUPPLIED", note: null },
};

/**
 * Checks whether mapping `originalPredicate` to `canonicalPredicate` would violate
 * any PK-06C non-forcing rule. Returns the violated rule, or null if allowed.
 */
export function detectNonForcingViolation(
  originalPredicate: string,
  canonicalPredicate: CanonicalPredicateId,
): NonForcingRule | null {
  for (const rule of NON_FORCING_RULES) {
    if (
      rule.sourcePattern.test(originalPredicate) &&
      rule.forbiddenTargets.includes(canonicalPredicate)
    ) {
      return rule;
    }
  }
  return null;
}

/**
 * Asserts that a proposed canonical mapping does not violate any PK-06C non-forcing rule.
 * Throws an Error with the rule ID and reason if violated.
 */
export function assertNonForcing(
  originalPredicate: string,
  canonicalPredicate: CanonicalPredicateId,
): void {
  const violation = detectNonForcingViolation(originalPredicate, canonicalPredicate);
  if (violation) {
    throw new Error(
      `Non-forcing violation (${violation.id}): "${originalPredicate}" cannot be mapped to "${canonicalPredicate}". ${violation.reason}`,
    );
  }
}

/**
 * Classifies an original predicate into a PredicateMappingRecord.
 * Unknown predicates are preserved verbatim with `classification_status: "unmapped"`
 * and `canonical_predicate: null` (never guessed or forced).
 */
export function classifyPredicate(
  originalPredicate: string,
  options?: {
    overrideCanonical?: CanonicalPredicateId | null;
    needsReview?: boolean;
    mappingVersion?: string;
  },
): PredicateMappingRecord {
  const version = options?.mappingVersion ?? MAPPING_VERSION;
  const normalized = originalPredicate.trim().toUpperCase();

  if (options?.overrideCanonical) {
    assertNonForcing(normalized, options.overrideCanonical);
    const spec = CANONICAL_PREDICATE_TAXONOMY[options.overrideCanonical];
    return {
      original_predicate: originalPredicate,
      canonical_predicate: spec.id,
      mapping_version: version,
      classification_status: options.needsReview ? "needs_review" : "mapped",
      direction: spec.direction,
      allowed_subjects: [...spec.allowed_subjects],
      allowed_objects: [...spec.allowed_objects],
      relation_group: spec.relation_group,
      non_forcing_note: null,
    };
  }

  const exact = EXACT_ORIGINAL_TO_CANONICAL[normalized];
  if (exact && !options?.needsReview) {
    const spec = CANONICAL_PREDICATE_TAXONOMY[exact.canonical];
    return {
      original_predicate: originalPredicate,
      canonical_predicate: spec.id,
      mapping_version: version,
      classification_status: "mapped",
      direction: spec.direction,
      allowed_subjects: [...spec.allowed_subjects],
      allowed_objects: [...spec.allowed_objects],
      relation_group: spec.relation_group,
      non_forcing_note: exact.note,
    };
  }

  return {
    original_predicate: originalPredicate,
    canonical_predicate: null,
    mapping_version: version,
    classification_status: options?.needsReview ? "needs_review" : "unmapped",
    direction: null,
    allowed_subjects: [],
    allowed_objects: [],
    relation_group: null,
    non_forcing_note: null,
  };
}

/**
 * Validates a PredicateMappingRecord against the taxonomy, entity types, and non-forcing rules.
 */
export function validatePredicateMapping(
  mapping: PredicateMappingRecord,
  endpoints?: { subjectKind: NodeKind; objectKind: NodeKind },
): string[] {
  const errors: string[] = [];
  if (mapping.classification_status === "mapped") {
    if (mapping.canonical_predicate === null) {
      errors.push(
        `${mapping.original_predicate}: mapped status requires a non-null canonical_predicate`,
      );
      return errors;
    }
    const violation = detectNonForcingViolation(
      mapping.original_predicate,
      mapping.canonical_predicate,
    );
    if (violation) {
      errors.push(`${mapping.original_predicate}: ${violation.id} (${violation.reason})`);
    }
    const spec: CanonicalPredicateSpec = CANONICAL_PREDICATE_TAXONOMY[mapping.canonical_predicate];
    if (endpoints) {
      if (!spec.allowed_subjects.includes(endpoints.subjectKind)) {
        errors.push(
          `${mapping.original_predicate}: subject kind "${endpoints.subjectKind}" is not allowed for ${spec.id}`,
        );
      }
      if (!spec.allowed_objects.includes(endpoints.objectKind)) {
        errors.push(
          `${mapping.original_predicate}: object kind "${endpoints.objectKind}" is not allowed for ${spec.id}`,
        );
      }
    }
  }
  return errors;
}

/**
 * PK-06C: Only `mapped` relationships are eligible for automatic inferences.
 * `unmapped` and `needs_review` relationships are strictly excluded until reviewed.
 */
export function isEligibleForAutomaticInference(mapping: PredicateMappingRecord): boolean {
  return mapping.classification_status === "mapped" && mapping.canonical_predicate !== null;
}

export type RelationshipLike = Pick<Relationship, "id" | "predicate" | "relation_class">;

export type MappedRelationship<T extends RelationshipLike = RelationshipLike> = {
  relationship: T;
  mapping: PredicateMappingRecord;
  relation_group: RelationGroup;
};

/** Filters relationships for automatic inference, excluding any unmapped or needs_review ones. */
export function filterRelationshipsForInference<T extends RelationshipLike>(
  items: readonly MappedRelationship<T>[],
): MappedRelationship<T>[] {
  return items.filter((item) => isEligibleForAutomaticInference(item.mapping));
}

/** Helper to attach default classification metadata to a Relationship without forcing unknown predicates. */
export function classifyRelationship<T extends RelationshipLike = RelationshipLike>(
  relationship: T,
): MappedRelationship<RelationshipLike> {
  return {
    relationship,
    mapping: classifyPredicate(relationship.predicate),
    relation_group: RELATION_CLASS_GROUP[relationship.relation_class],
  };
}
