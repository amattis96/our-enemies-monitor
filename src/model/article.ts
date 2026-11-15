import { z } from "zod";
import {
  EntityId,
  EventId,
  HypothesisId,
  LocalizedText,
  RelationshipId,
  Review,
  SourceId,
  TranslationState,
  Url,
} from "./schemas.ts";

// ---------------------------------------------------------------------------
// Editorial articles (M6 Task B). Stored as Markdown in `content/articles/`,
// not in `data/`: an article is an authored analysis that cites canonical
// records, not a canonical record itself. See docs/ARCHITECTURE.md.

/** Real articles `ART-0001`…; demo/test fixtures `ART-DEMO-001`…. */
export const ARTICLE_ID = /^ART-(\d{4}|DEMO-\d{3})$/;
export const FIXTURE_ARTICLE_ID = /^ART-DEMO-\d{3}$/;
/** Mandatory prefix of every fixture title, in every language. */
export const FIXTURE_TITLE_PREFIX = "DEMO / TEST";

export const ArticleId = z.string().regex(ARTICLE_ID);

/** Full calendar date `YYYY-MM-DD` (an article is published on a known day). */
export const DayDate = z.iso.date();

export const ARTICLE_GENERATORS = ["human", "ai", "fixture"] as const;

/** Who or what produced the text. Never a person's private data. */
export const ArticleGeneration = z.strictObject({
  /** `ai` for ChatGPT Task B drafts, `human` for editors, `fixture` for test content. */
  kind: z.enum(ARTICLE_GENERATORS),
  /** Tool or task name, e.g. "ChatGPT scheduled task B"; null for human authors. */
  tool: z.string().min(1).nullable(),
  /** Date of the research run that produced the draft, if any. */
  run_date: DayDate.nullable(),
});

/** Canonical records the article discusses. Every ID must exist in `data/`. */
export const ArticleLinks = z.strictObject({
  events: z.array(EventId),
  entities: z.array(EntityId),
  relationships: z.array(RelationshipId),
  hypotheses: z.array(HypothesisId),
});

/** A bibliographic reference: a corpus source code or an external URL. */
export const ArticleReference = z.union([
  z.strictObject({
    source: SourceId,
    /** What the article uses this source for (Italian). */
    note: z.string().min(1).nullable().default(null),
  }),
  z.strictObject({
    url: Url,
    title: z.string().min(1),
    publisher: z.string().min(1).nullable(),
    /** Publication date of the referenced document, as precise as known. */
    published: z
      .string()
      .regex(/^\d{4}(-\d{2}(-\d{2})?)?$/)
      .nullable(),
    /** Date the URL was last checked. */
    accessed: DayDate,
  }),
]);

/**
 * Article-specific statuses, deliberately separate from canonical record Review.
 * ai_verified means automated editorial examination, NOT human approval.
 */
export const ARTICLE_REVIEW_STATUSES = ["needs_review", "ai_verified", "reviewed"] as const;
export const AI_VERIFICATION_NOTE =
  /^AI-Verification: Task C; reviewed_head=[0-9a-f]{40}; date=\d{4}-\d{2}-\d{2}; basis=.{20,}$/;

export function hasAiVerificationNote(notes: readonly string[]): boolean {
  return notes.some((note) => AI_VERIFICATION_NOTE.test(note));
}

export const ArticleReview = Review.safeExtend({
  status: z.enum(ARTICLE_REVIEW_STATUSES).describe(
    "Editorial review status of the record. imported_unreviewed is provisional, not verified. Definitions: vocabulary.json#/review_statuses.",
  ),
});

/** Front matter of the canonical Italian file `content/articles/<ID>.it.md`. */
export const ArticleFrontMatterIt = z.strictObject({
  id: ArticleId,
  lang: z.literal("it"),
  /** Mandatory: true only for demo/test content (ID `ART-DEMO-NNN`). */
  fixture: z.boolean(),
  title: z.string().min(1),
  summary: z.string().min(1),
  /** Publication date. */
  date: DayDate,
  /** Date of the last substantive revision, if any. */
  updated: DayDate.nullable(),
  generated_by: ArticleGeneration,
  links: ArticleLinks,
  references: z.array(ArticleReference).min(1),
  review: z.strictObject({
    status: z.enum(ARTICLE_REVIEW_STATUSES),
    notes: z.array(z.string().min(1)),
  }),
});

/** Front matter of the English translation `content/articles/<ID>.en.md`. */
export const ArticleFrontMatterEn = z.strictObject({
  id: ArticleId,
  lang: z.literal("en"),
  title: z.string().min(1),
  summary: z.string().min(1),
  /** `source_hash` = fingerprint of the Italian title, summary and body. */
  translation: TranslationState,
});

/** An article as assembled from its language files. */
export const Article = z.strictObject({
  id: ArticleId,
  fixture: z.boolean(),
  title: LocalizedText,
  summary: LocalizedText,
  /** Markdown body (no front matter). */
  body: LocalizedText,
  date: DayDate,
  updated: DayDate.nullable(),
  generated_by: ArticleGeneration,
  links: ArticleLinks,
  references: z.array(ArticleReference).min(1),
  review: ArticleReview,
});

export type ArticleGeneration = z.infer<typeof ArticleGeneration>;
export type ArticleLinks = z.infer<typeof ArticleLinks>;
export type ArticleReference = z.infer<typeof ArticleReference>;
export type ArticleFrontMatterIt = z.infer<typeof ArticleFrontMatterIt>;
export type ArticleFrontMatterEn = z.infer<typeof ArticleFrontMatterEn>;
export type Article = z.infer<typeof Article>;

/** JSON Schemas published next to the collection schemas (see `pnpm schemas`). */
export const ARTICLE_SCHEMAS = {
  articles: Article,
  "article-it-front-matter": ArticleFrontMatterIt,
  "article-en-front-matter": ArticleFrontMatterEn,
} as const;
