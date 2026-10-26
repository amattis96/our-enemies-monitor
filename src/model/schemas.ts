import { z } from "zod";
import {
  DATE_PRECISIONS,
  ENTITY_DOMAINS,
  ENTITY_KINDS,
  EVENT_RECORD_TYPES,
  EVIDENCE_LEVELS,
  HYPOTHESIS_PRIORITIES,
  HYPOTHESIS_STATUSES,
  KNOWN_ISSUE_CODES,
  RELATION_CLASSES,
  RELATIONSHIP_EVIDENCE_LEVELS,
  RELATIONSHIP_EVIDENCE_STATUSES,
  REVIEW_STATUSES,
  SOURCE_TYPES,
  TIMELINE_STATUSES,
} from "./vocabularies.ts";

// ---------------------------------------------------------------------------
// Identifiers. Namespaces are disjoint, so a reference resolves by ID alone.

export const EVENT_ID = /^(TL-\d{4}|EXT-\d{3})$/;
export const ENTITY_ID = /^[A-Z][A-Z0-9_]*$/;
export const RELATIONSHIP_ID = /^G-\d{4}$/;
export const HYPOTHESIS_ID = /^H\d{2}$/;
export const SOURCE_ID = /^(S\d{2}|F\d{2}|P\d{2}|WEB|WEB-EXT-\d{3})$/;

export const EventId = z.string().regex(EVENT_ID);
export const EntityId = z.string().regex(ENTITY_ID);
export const RelationshipId = z.string().regex(RELATIONSHIP_ID);
export const HypothesisId = z.string().regex(HYPOTHESIS_ID);
export const SourceId = z.string().regex(SOURCE_ID);
/** Endpoint of a relationship or hypothesis: an entity or an event. */
export const NodeId = z.union([EntityId, EventId]);

// ---------------------------------------------------------------------------
// Shared building blocks

/** Free text. Italian (`it`) is canonical; other keys are translations. */
export const LocalizedText = z.strictObject({
  it: z.string().min(1),
  en: z.string().min(1).optional(),
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
    start: PartialDate,
    end: PartialDate.nullable(),
    precision: DatePrecision,
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
    file: z.string().startsWith("sources/"),
    row: z.int().positive(),
    original: z.record(z.string(), z.string()),
  }),
  z.strictObject({
    file: z.string().startsWith("sources/"),
    line: z.int().positive(),
    original: z.strictObject({ text: z.string() }),
  }),
]);

export const Review = z.strictObject({
  status: z.enum(REVIEW_STATUSES),
  notes: z.array(z.string().min(1)),
});

export const KnownIssue = z.strictObject({
  code: z.enum(KNOWN_ISSUE_CODES),
  note: LocalizedText,
  reported_in: z.array(SourceId).min(1),
});

const sourceRefs = z.array(SourceId);

// ---------------------------------------------------------------------------
// Records

export const Event = z.strictObject({
  id: EventId,
  record_type: z.enum(EVENT_RECORD_TYPES),
  timeline_status: z.enum(TIMELINE_STATUSES),
  date: DateRange,
  title: LocalizedText,
  description: LocalizedText,
  /** Original free-text category; normalized themes come later (M2). */
  category: LocalizedText.nullable(),
  /** Original free-text geography; normalized places come later (M3). */
  geography: LocalizedText.nullable(),
  /** Original free-text evidence assessment of the timeline record. */
  evidence_note: LocalizedText.nullable(),
  evidence_level: z.enum(EVIDENCE_LEVELS).nullable(),
  publisher: z.string().min(1).nullable(),
  url: Url.nullable(),
  sources: sourceRefs,
  known_issues: z.array(KnownIssue),
  review: Review,
  provenance: z.array(ProvenanceEntry),
});

export const Entity = z.strictObject({
  id: EntityId,
  kind: z.enum(ENTITY_KINDS),
  name: LocalizedText,
  domain: z.enum(ENTITY_DOMAINS),
  review: Review,
  provenance: z.array(ProvenanceEntry),
});

export const Relationship = z.strictObject({
  id: RelationshipId,
  subject: NodeId,
  /** Original predicate, to be read literally. */
  predicate: z.string().regex(/^[A-Z][A-Z0-9_]*$/),
  object: NodeId,
  relation_class: z.enum(RELATION_CLASSES),
  evidence_level: z.enum(RELATIONSHIP_EVIDENCE_LEVELS),
  evidence_status: z.enum(RELATIONSHIP_EVIDENCE_STATUSES),
  events: z.array(EventId),
  valid_from: PartialDate.nullable(),
  valid_to: PartialDate.nullable(),
  primary_url: Url.nullable(),
  caveat: LocalizedText.nullable(),
  sources: sourceRefs,
  review: Review,
  provenance: z.array(ProvenanceEntry),
});

export const Hypothesis = z.strictObject({
  id: HypothesisId,
  subject: NodeId,
  object: NodeId,
  hypothesis_type: z.string().regex(/^[A-Z][A-Z0-9_]*$/),
  question: LocalizedText,
  current_limit: LocalizedText,
  priority: z.enum(HYPOTHESIS_PRIORITIES),
  evidence_needed: LocalizedText,
  events: z.array(EventId),
  external_url: Url.nullable(),
  status: z.enum(HYPOTHESIS_STATUSES),
  sources: sourceRefs,
  review: Review,
  provenance: z.array(ProvenanceEntry),
});

export const Source = z.strictObject({
  id: SourceId,
  type: z.enum(SOURCE_TYPES),
  title: LocalizedText,
  publisher: z.string().min(1).nullable(),
  /** Repository files of a corpus document. */
  files: z.array(z.string().startsWith("sources/")),
  urls: z.array(Url),
  /** Corpus documents that cite this reference. */
  cited_in: sourceRefs,
  review: Review,
  provenance: z.array(ProvenanceEntry),
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

/** Collections in `data/<name>/<id>.json`. */
export const COLLECTIONS = {
  events: Event,
  entities: Entity,
  relationships: Relationship,
  hypotheses: Hypothesis,
  sources: Source,
} as const;

export type CollectionName = keyof typeof COLLECTIONS;
export const COLLECTION_NAMES = Object.keys(COLLECTIONS) as CollectionName[];

export type Dataset = {
  events: Event[];
  entities: Entity[];
  relationships: Relationship[];
  hypotheses: Hypothesis[];
  sources: Source[];
};
