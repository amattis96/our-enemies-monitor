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

/**
 * Editorial themes of events, used for filtering. Assigned from the original
 * category (which stays the reference), never inferred from free text.
 */
export const THEME_LABELS = {
  armed_conflict: { it: "Conflitto armato e difesa", en: "Armed conflict and defence" },
  hybrid_sabotage: { it: "Sabotaggio e operazioni ibride", en: "Sabotage and hybrid operations" },
  cyber: { it: "Cyber", en: "Cyber" },
  intelligence: { it: "Intelligence e spionaggio", en: "Intelligence and espionage" },
  information_manipulation: {
    it: "Manipolazione informativa (FIMI)",
    en: "Information manipulation (FIMI)",
  },
  elections_influence: {
    it: "Elezioni e influenza politica",
    en: "Elections and political influence",
  },
  finance_sanctions: {
    it: "Finanza, sanzioni e corruzione",
    en: "Finance, sanctions and corruption",
  },
  justice: { it: "Giustizia e indagini", en: "Justice and investigations" },
  energy: { it: "Energia", en: "Energy" },
  industry_dependencies: {
    it: "Industria, materie prime e dipendenze",
    en: "Industry, raw materials and dependencies",
  },
  infrastructure_space: {
    it: "Infrastrutture critiche e spazio",
    en: "Critical infrastructure and space",
  },
  surveillance_spyware: { it: "Spyware e sorveglianza", en: "Spyware and surveillance" },
  migration_borders: { it: "Migrazione e frontiere", en: "Migration and borders" },
  geopolitics_diplomacy: { it: "Geopolitica e diplomazia", en: "Geopolitics and diplomacy" },
  eu_nato_response: { it: "Risposte UE e NATO", en: "EU and NATO responses" },
  society_health: { it: "Società, proteste e salute", en: "Society, protests and health" },
  platforms_technology: { it: "Piattaforme e tecnologia", en: "Platforms and technology" },
  research_metadata: { it: "Metadati della ricerca", en: "Research metadata" },
} as const satisfies Record<string, Label>;

export type Theme = keyof typeof THEME_LABELS;
export const THEMES = Object.keys(THEME_LABELS) as [Theme, ...Theme[]];

export const MEASURE_UNITS = ["percent", "eur_billion", "count", "year"] as const;

/** How the source qualifies a value: "circa", "oltre", "quasi", "meno del". */
export const MEASURE_QUALIFIERS = ["exact", "approx", "more_than", "less_than", "nearly"] as const;

/** `target`: planned or programmed values (e.g. IRIS² 2030), not observations. */
export const EXPOSURE_STATUSES = ["observed", "target"] as const;

export const TRANSLATION_STATUSES = ["machine", "reviewed"] as const;

export const LANGUAGES = ["it", "en"] as const;
export type Language = (typeof LANGUAGES)[number];
