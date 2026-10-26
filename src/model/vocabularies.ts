/**
 * Controlled vocabularies of the canonical data model.
 *
 * Codes are English and stable; labels are for display. Italian is the
 * canonical language of the corpus.
 */

export type Label = { it: string; en: string };

export const EVIDENCE_LEVELS = ["E1", "E2", "E3", "E4", "E5"] as const;
export type EvidenceLevel = (typeof EVIDENCE_LEVELS)[number];

/** E5 (hypothesis) never appears on a relationship. */
export const RELATIONSHIP_EVIDENCE_LEVELS = ["E1", "E2", "E3", "E4"] as const;

export const EVIDENCE_LEVEL_LABELS: Record<EvidenceLevel, Label> = {
  E1: {
    it: "Atto primario, sentenza, decisione ufficiale o fatto tecnico verificato",
    en: "Primary act, judgment, official decision or verified technical fact",
  },
  E2: {
    it: "Attribuzione formale di governo, intelligence o istituzione",
    en: "Formal attribution by a government, intelligence service or institution",
  },
  E3: {
    it: "Inchiesta originale, prova forense indipendente o corroborazione solida",
    en: "Original investigation, independent forensics or strong corroboration",
  },
  E4: {
    it: "Accusa o denuncia non corroborata pubblicamente",
    en: "Allegation or complaint not publicly corroborated",
  },
  E5: {
    it: "Ipotesi, correlazione o scenario",
    en: "Hypothesis, correlation or scenario",
  },
};

/** Evidence status of a relationship, mapped from the Fonte_07 edge codes. */
export const RELATIONSHIP_EVIDENCE_STATUSES = [
  "documented",
  "corroborated",
  "institutional_attribution",
  "allegation",
] as const;

export const RELATIONSHIP_EVIDENCE_STATUS_FROM_BASELINE: Record<
  string,
  (typeof RELATIONSHIP_EVIDENCE_STATUSES)[number]
> = {
  documentato: "documented",
  corroborato: "corroborated",
  attribuzione_istituzionale: "institutional_attribution",
  denuncia: "allegation",
};

export const ENTITY_KINDS = [
  "state",
  "institution",
  "person",
  "organization",
  "company",
  "asset",
] as const;
export type EntityKind = (typeof ENTITY_KINDS)[number];

/** Thematic domains of non-event nodes as defined in Fonte_07. */
export const ENTITY_DOMAINS = [
  "commerce-infrastructure",
  "dependencies",
  "geopolitics",
  "influence-technology",
  "institutional",
  "intelligence-security",
  "persons",
  "targets",
] as const;

/**
 * Display groups for relation classes. A group is a filtering aid for the
 * UI, not an evidentiary claim: each relationship keeps its exact class and
 * predicate.
 */
export const RELATION_GROUPS = [
  "participation",
  "control",
  "financial",
  "influence_information",
  "security_intelligence",
  "economic_dependency",
  "institutional",
  "context",
] as const;
export type RelationGroup = (typeof RELATION_GROUPS)[number];

/** The 30 relation classes observed in Fonte_07, with their display group. */
export const RELATION_CLASS_GROUP = {
  event_participation: "participation",
  operational: "control",
  ownership: "control",
  governance: "control",
  financial: "financial",
  influence: "influence_information",
  information: "influence_information",
  information_flow: "influence_information",
  platform: "influence_information",
  political: "influence_information",
  intelligence: "security_intelligence",
  technical: "security_intelligence",
  security: "security_intelligence",
  surveillance: "security_intelligence",
  military: "security_intelligence",
  hybrid: "security_intelligence",
  supply: "economic_dependency",
  dependency: "economic_dependency",
  infrastructure: "economic_dependency",
  technology: "economic_dependency",
  trade: "economic_dependency",
  commerce: "economic_dependency",
  commercial: "economic_dependency",
  competition: "economic_dependency",
  policy: "institutional",
  legal: "institutional",
  diplomacy: "institutional",
  oversight: "institutional",
  context: "context",
  consequence: "context",
} as const satisfies Record<string, RelationGroup>;

export type RelationClass = keyof typeof RELATION_CLASS_GROUP;
export const RELATION_CLASSES = Object.keys(RELATION_CLASS_GROUP) as [
  RelationClass,
  ...RelationClass[],
];

export const DATE_PRECISIONS = ["year", "month", "day"] as const;

export const EVENT_RECORD_TYPES = ["event", "dataset_metadata"] as const;

/** `pending_integration`: verified record not yet merged into the timeline. */
export const TIMELINE_STATUSES = ["integrated", "pending_integration"] as const;

export const HYPOTHESIS_PRIORITIES = ["critical", "high", "medium", "low"] as const;

export const HYPOTHESIS_PRIORITY_FROM_BASELINE: Record<
  string,
  (typeof HYPOTHESIS_PRIORITIES)[number]
> = {
  Critica: "critical",
  Alta: "high",
  Media: "medium",
  Bassa: "low",
};

export const HYPOTHESIS_STATUSES = [
  "open_unproven",
  "under_review",
  "promoted",
  "refuted",
  "closed_insufficient",
] as const;

export const SOURCE_TYPES = ["corpus_document", "external_reference", "unspecified_web"] as const;

export const REVIEW_STATUSES = ["imported_unreviewed", "needs_review", "reviewed"] as const;

export const KNOWN_ISSUE_CODES = ["misclassified_category", "date_reflects_publication"] as const;
