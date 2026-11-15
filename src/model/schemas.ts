import { z } from "zod";
import {
  DATE_PRECISIONS,
  ENTITY_DOMAINS,
  ENTITY_KINDS,
  EVENT_RECORD_TYPES,
  EVIDENCE_LEVELS,
  EXPOSURE_STATUSES,
  HYPOTHESIS_PRIORITIES,
  HYPOTHESIS_STATUSES,
  KNOWN_ISSUE_CODES,
  MEASURE_QUALIFIERS,
  MEASURE_UNITS,
  RELATION_CLASSES,
  RELATIONSHIP_EVIDENCE_LEVELS,
  RELATIONSHIP_EVIDENCE_STATUSES,
  REVIEW_STATUSES,
  SOURCE_TYPES,
  THEMES,
  TIMELINE_STATUSES,
  TRANSLATION_STATUSES,
} from "./vocabularies.ts";

// ---------------------------------------------------------------------------
// Identifiers. Namespaces are disjoint, so a reference resolves by ID alone.

export const EVENT_ID = /^(TL-\d{4}|EXT-\d{3})$/;
export const ENTITY_ID = /^[A-Z][A-Z0-9_]*$/;
export const RELATIONSHIP_ID = /^G-\d{4}$/;
export const HYPOTHESIS_ID = /^H(?:\d{2}|[1-9]\d{2})$/;
export const CORPUS_SOURCE_ID = /^S(?:\d{2}|[1-9]\d{2})$/;
export const SOURCE_ID = /^(S(?:\d{2}|[1-9]\d{2})|F\d{2}|P\d{2}|WEB|WEB-EXT-\d{3})$/;
export const EXPOSURE_ID = /^X-\d{3}$/;
/** ISO 3166-1 alpha-2 country code. */
export const COUNTRY_CODE = /^[A-Z]{2}$/;

export const EventId = z.string().regex(EVENT_ID);
export const EntityId = z.string().regex(ENTITY_ID);
export const RelationshipId = z.string().regex(RELATIONSHIP_ID);
export const HypothesisId = z.string().regex(HYPOTHESIS_ID);
export const SourceId = z.string().regex(SOURCE_ID);
export const ExposureId = z.string().regex(EXPOSURE_ID);
export const CountryCode = z.string().regex(COUNTRY_CODE);
/** Endpoint of a relationship or hypothesis: an entity or an event. */
export const NodeId = z.union([EntityId, EventId]);

// ---------------------------------------------------------------------------
// Shared building blocks

/** Free text. Italian (`it`) is canonical; other keys are translations. */
export const LocalizedText = z.strictObject({
  it: z
    .string()
    .min(1)
    .describe("Canonical Italian text. On divergence the Italian text prevails."),
  en: z
    .string()
    .min(1)
    .optional()
    .describe("English translation; its status is in review.translations.en."),
});

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** `YYYY`, `YYYY-MM` or `YYYY-MM-DD`; precision is the number of parts. */
export const PartialDate = z
  .string()
  .regex(/^\d{4}(-\d{2}(-\d{2})?)?$/)
  .refine((value) => {
    const [, month, day] = value.split("-").map(Number);
    if (month === undefined) return true;
    if (month < 1 || month > 12) return false;
    if (day === undefined) return true;
    return day >= 1 && day <= (DAYS_IN_MONTH[month - 1] ?? 0);
  }, "invalid calendar date");

export const DatePrecision = z.enum(DATE_PRECISIONS);

export function precisionOf(date: string): z.infer<typeof DatePrecision> {
  return DATE_PRECISIONS[date.split("-").length - 1] ?? "year";
}

/** Compare two partial dates at their common precision. */
export function comparePartialDates(a: string, b: string): number {
  const length = Math.min(a.length, b.length);
  return a.slice(0, length).localeCompare(b.slice(0, length));
}

export const DateRange = z
  .strictObject({
    start: PartialDate.describe("Start date: YYYY, YYYY-MM or YYYY-MM-DD (no invented precision)."),
    end: PartialDate.nullable().describe(
      "End date with the same format, or null when unknown or none.",
    ),
    precision: DatePrecision.describe(
      "Precision of the start date (year, month or day). Definitions: vocabulary.json#/date_precisions.",
    ),
  })
  .refine((range) => precisionOf(range.start) === range.precision, {
    message: "start does not match precision",
    path: ["precision"],
  })
  .refine((range) => range.end === null || comparePartialDates(range.end, range.start) >= 0, {
    message: "end is before start",
    path: ["end"],
  });

export const Url = z.url({ protocol: /^https?$/ });

/** Where an imported record came from, with the verbatim original values. */
export const ProvenanceEntry = z.union([
  z.strictObject({
    file: z.string().startsWith("sources/").describe("Original repository file under sources/."),
    row: z.int().positive().describe("1-based data row of the original CSV file."),
    original: z
      .record(z.string(), z.string())
      .describe("Verbatim original values of that row, keyed by column."),
  }),
  z.strictObject({
    file: z.string().startsWith("sources/").describe("Original repository file under sources/."),
    line: z.int().positive().describe("1-based line of the original text file."),
    original: z
      .strictObject({ text: z.string().describe("Verbatim original line.") })
      .describe("Verbatim original text."),
  }),
]);

/**
 * Translation state per language. `source_hash` fingerprints the Italian
 * texts the translation was made from, so a later change of the Italian
 * text marks the translation as stale.
 */
export const TranslationState = z.strictObject({
  status: z
    .enum(TRANSLATION_STATUSES)
    .describe("Translation status. Definitions: vocabulary.json#/translation_statuses."),
  source_hash: z
    .string()
    .regex(/^[0-9a-f]{16}$/)
    .describe("Fingerprint of the Italian texts the translation was made from."),
  target_hash: z
    .string()
    .regex(/^[0-9a-f]{16}$/)
    .describe("Fingerprint of the translated texts as imported."),
});

export const Review = z.strictObject({
  status: z
    .enum(REVIEW_STATUSES)
    .describe(
      "Editorial review status of the record. imported_unreviewed is provisional, not verified. Definitions: vocabulary.json#/review_statuses.",
    ),
  notes: z
    .array(z.string().min(1))
    .describe("Free-text editorial and technical notes, in English; not typed claims."),
  translations: z
    .strictObject({
      en: TranslationState.optional().describe("State of the English translation."),
    })
    .optional()
    .describe("Translation state per language."),
});

export const KnownIssue = z.strictObject({
  code: z
    .enum(KNOWN_ISSUE_CODES)
    .describe("Kind of issue. Definitions: vocabulary.json#/known_issue_codes."),
  note: LocalizedText.describe("What the corpus reports about the issue."),
  reported_in: z.array(SourceId).min(1).describe("Sources that report the issue."),
});

const sourceRefs = z
  .array(SourceId)
  .describe(
    "Codes of cited sources (see sources.json). Corpus synthesis documents are not independent confirmations.",
  );
const review = Review.describe("Editorial review state of the record.");
const provenance = z
  .array(ProvenanceEntry)
  .describe(
    "Original corpus file and row or line each imported record derives from; empty for records created later.",
  );

// ---------------------------------------------------------------------------
// Records

export const Event = z.strictObject({
  id: EventId.describe("Stable record ID (TL-#### or EXT-###); never renumbered or reused."),
  record_type: z
    .enum(EVENT_RECORD_TYPES)
    .describe(
      "event, or dataset_metadata (a research collection date, not a geopolitical event). Definitions: vocabulary.json#/event_record_types.",
    ),
  timeline_status: z
    .enum(TIMELINE_STATUSES)
    .describe(
      "Whether the record is integrated in the timeline. Definitions: vocabulary.json#/timeline_statuses.",
    ),
  date: DateRange.describe(
    "Date of the fact with explicit precision; distinct from the date of its discovery, attribution, judgment or publication.",
  ),
  title: LocalizedText.describe("Short title."),
  description: LocalizedText.describe(
    "Description of the record. Event, perpetrator, sponsor, motive and impact are distinct claims.",
  ),
  /** Original free-text category: the reference for `themes`. */
  category: LocalizedText.nullable().describe(
    "Original free-text category, the reference for themes; null when absent.",
  ),
  /** Editorial themes for filtering (src/pipeline/baseline/themes.ts). */
  themes: z
    .array(z.enum(THEMES))
    .min(1)
    .describe(
      "Editorial themes for filtering, assigned from the original category. Definitions: vocabulary.json#/themes.",
    ),
  /** Original free-text geography: the reference for `places`. */
  geography: LocalizedText.nullable().describe(
    "Original free-text geography, the reference for places; null when absent.",
  ),
  /** Countries named by the geography (src/pipeline/baseline/places.ts); areas without a country stay out. */
  places: z
    .array(CountryCode)
    .describe(
      "ISO 3166-1 alpha-2 codes of countries named by the geography; areas without a country stay out, no coordinates.",
    ),
  /** Original free-text evidence assessment of the timeline record. */
  evidence_note: LocalizedText.nullable().describe(
    "Original free-text evidence assessment of the record; null when absent.",
  ),
  evidence_level: z
    .enum(EVIDENCE_LEVELS)
    .nullable()
    .describe(
      "Evidence level when assigned, else null. Levels are kinds of basis, not a ranking. Definitions: vocabulary.json#/evidence_levels.",
    ),
  publisher: z
    .string()
    .min(1)
    .nullable()
    .describe("Publisher of the reference document, as given by the corpus; null when absent."),
  url: Url.nullable().describe("URL of the reference document; null when absent."),
  sources: sourceRefs,
  known_issues: z.array(KnownIssue).describe("Issues the corpus itself reports about this record."),
  review,
  provenance,
});

export const Entity = z.strictObject({
  id: EntityId.describe(
    "Stable local ID. A two-letter ID is not necessarily a country code: read kind and country.",
  ),
  kind: z.enum(ENTITY_KINDS).describe("Kind of node. Definitions: vocabulary.json#/entity_kinds."),
  name: LocalizedText.describe("Display name."),
  domain: z
    .enum(ENTITY_DOMAINS)
    .describe("Thematic domain from Fonte_07. Definitions: vocabulary.json#/entity_domains."),
  /** ISO country code of a `state` entity; null for every other kind. */
  country: CountryCode.nullable().describe(
    "ISO 3166-1 alpha-2 code of a state entity; null for every other kind.",
  ),
  review,
  provenance,
});

export const Relationship = z.strictObject({
  id: RelationshipId.describe("Stable record ID (G-####); never renumbered or reused."),
  subject: NodeId.describe("Entity or event ID the statement is about."),
  /** Original predicate, to be read literally. */
  predicate: z
    .string()
    .regex(/^[A-Z][A-Z0-9_]*$/)
    .describe(
      "Original predicate, to be read literally (Italian or English as in the corpus); never translated.",
    ),
  object: NodeId.describe("Entity or event ID the subject is related to."),
  relation_class: z
    .enum(RELATION_CLASSES)
    .describe(
      "Original class from Fonte_07. Participation is presence or role, not control, financing or coordination. Definitions: vocabulary.json#/relation_classes.",
    ),
  evidence_level: z
    .enum(RELATIONSHIP_EVIDENCE_LEVELS)
    .describe(
      "Evidence level (E1-E4) of this statement. Kinds of basis, not a ranking: E2 is not stronger or weaker than E3; E2 is an attribution, not a conviction. Definitions: vocabulary.json#/evidence_levels.",
    ),
  evidence_status: z
    .enum(RELATIONSHIP_EVIDENCE_STATUSES)
    .describe(
      "Original Fonte_07 evidence code; it pairs one-to-one with evidence_level and is not an independent assessment. Definitions: vocabulary.json#/evidence_statuses.",
    ),
  events: z.array(EventId).describe("Events this relationship was recorded in."),
  valid_from: PartialDate.nullable().describe(
    "Start of validity when stated by a source; null when unknown.",
  ),
  valid_to: PartialDate.nullable().describe(
    "End of validity when stated by a source; null when unknown or ongoing.",
  ),
  primary_url: Url.nullable().describe(
    "URL of the primary document supporting the statement; null when not linked.",
  ),
  caveat: LocalizedText.nullable().describe(
    "Limits of the statement; a caveat that negates an inference must be kept with the relationship.",
  ),
  sources: sourceRefs,
  review,
  provenance,
});

export const Hypothesis = z.strictObject({
  id: HypothesisId.describe("Stable record ID (H##); never renumbered or reused."),
  subject: NodeId.describe("Anchor entity or event of the question; not a claimed link."),
  object: NodeId.describe("Second anchor of the question; not a claimed link."),
  hypothesis_type: z
    .string()
    .regex(/^[A-Z][A-Z0-9_]*$/)
    .describe("Original hypothesis type code, to be read literally."),
  question: LocalizedText.describe("Open verification question (evidence level E5)."),
  current_limit: LocalizedText.describe("What is currently not established."),
  priority: z
    .enum(HYPOTHESIS_PRIORITIES)
    .describe(
      "Editorial priority of verification, not a probability. Definitions: vocabulary.json#/hypothesis_priorities.",
    ),
  evidence_needed: LocalizedText.describe("Evidence that would be needed to answer the question."),
  events: z.array(EventId).describe("Related events."),
  external_url: Url.nullable().describe("External reference URL; null when absent."),
  status: z
    .enum(HYPOTHESIS_STATUSES)
    .describe("Status of the question. Definitions: vocabulary.json#/hypothesis_statuses."),
  sources: sourceRefs,
  review,
  provenance,
});

export const Source = z.strictObject({
  id: SourceId.describe("Source code (S##, F##, P##, WEB, WEB-EXT-###)."),
  type: z
    .enum(SOURCE_TYPES)
    .describe("Kind of source. Definitions: vocabulary.json#/source_types."),
  title: LocalizedText.describe("Title of the source."),
  publisher: z.string().min(1).nullable().describe("Publisher of the source; null when unknown."),
  /** Repository files of a corpus document. */
  files: z
    .array(z.string().startsWith("sources/"))
    .describe("Repository files of a corpus document."),
  urls: z.array(Url).describe("Public URLs of the source; empty when none is known."),
  /** Corpus documents that cite this reference. */
  cited_in: sourceRefs.describe("Corpus documents that cite this reference."),
  review,
  provenance,
});

export const Measure = z.strictObject({
  label: LocalizedText.describe("What the value is."),
  value: z.number().describe("Numeric value as given by the source."),
  unit: z.enum(MEASURE_UNITS).describe("Unit. Definitions: vocabulary.json#/measure_units."),
  qualifier: z
    .enum(MEASURE_QUALIFIERS)
    .describe(
      "How the source qualifies the value. Definitions: vocabulary.json#/measure_qualifiers.",
    ),
  /** Denominator for counts ("19 of 20"), when the source gives one. */
  out_of: z
    .number()
    .positive()
    .nullable()
    .describe('Denominator for counts ("19 of 20") when the source gives one, else null.'),
  /** Reference period as stated by the source (`2024`, `2024-2026`), else null. */
  period: z
    .string()
    .regex(/^\d{4}(-\d{4})?$/)
    .nullable()
    .describe("Reference period as stated by the source (2024, 2024-2026), else null."),
});

/** A quantified strategic dependency, with the scope of its denominator. */
export const Exposure = z.strictObject({
  id: ExposureId.describe("Stable record ID (X-###); not an entity ID."),
  sector: LocalizedText.describe("Sector concerned."),
  /** Original indicator text. */
  indicator: LocalizedText.describe("Original indicator text."),
  measures: z
    .array(Measure)
    .min(1)
    .describe("Quantified values; values from different universes are not comparable."),
  /** What the value measures: denominator, universe, data series. */
  scope: LocalizedText.describe("What the value measures: denominator, universe, data series."),
  consequence: LocalizedText.describe("Consequence stated by the source."),
  status: z
    .enum(EXPOSURE_STATUSES)
    .describe("observed value or planned target. Definitions: vocabulary.json#/exposure_statuses."),
  sources: sourceRefs,
  review,
  provenance,
});

export type LocalizedText = z.infer<typeof LocalizedText>;
export type ProvenanceEntry = z.infer<typeof ProvenanceEntry>;
export type Review = z.infer<typeof Review>;
export type KnownIssue = z.infer<typeof KnownIssue>;
export type Event = z.infer<typeof Event>;
export type Entity = z.infer<typeof Entity>;
export type Relationship = z.infer<typeof Relationship>;
export type Hypothesis = z.infer<typeof Hypothesis>;
export type Source = z.infer<typeof Source>;
export type Exposure = z.infer<typeof Exposure>;
export type Measure = z.infer<typeof Measure>;

/** Collections in `data/<name>/<id>.json`. */
export const COLLECTIONS = {
  events: Event,
  entities: Entity,
  relationships: Relationship,
  hypotheses: Hypothesis,
  sources: Source,
  exposures: Exposure,
} as const;

export type CollectionName = keyof typeof COLLECTIONS;
export const COLLECTION_NAMES = Object.keys(COLLECTIONS) as CollectionName[];

export type Dataset = {
  events: Event[];
  entities: Entity[];
  relationships: Relationship[];
  hypotheses: Hypothesis[];
  sources: Source[];
  exposures: Exposure[];
};
