import { z } from "zod";

export const CONTENT_TIERS = ["L1", "L2", "L3", "L4", "L5"] as const;
export type ContentTier = (typeof CONTENT_TIERS)[number];

export const CONTENT_TIER_DESCRIPTIONS: Record<ContentTier, string> = {
  L1: "Core UI navigation, shell chrome, legal/evidence labels, and essential caveats",
  L2: "Public summaries, lead paragraphs, dossier overviews, and Situation Room",
  L3: "Canonical record titles, event descriptions, entity names, and hypotheses",
  L4: "Editorial articles and long-form investigative reports",
  L5: "Technical annexes, methodology pages, and extended glossary",
};

/** Target European language rollout waves (PK-31). */
export const TARGET_LANGUAGE_ROLLOUT = [
  { wave: 1, languages: ["fr", "de", "pl"] as const, label: "Wave 1 (FR, DE, PL)" },
  { wave: 2, languages: ["uk", "es"] as const, label: "Wave 2 (UK, ES)" },
  { wave: 3, languages: ["ro"] as const, label: "Wave 3 (RO)" },
  { wave: 4, languages: ["lt", "lv", "et"] as const, label: "Wave 4 (Baltic: LT, LV, ET)" },
] as const;

export const EUROPEAN_TARGET_LANGUAGES = [
  "en",
  "fr",
  "de",
  "pl",
  "uk",
  "es",
  "ro",
  "lt",
  "lv",
  "et",
] as const;
export type TargetLanguage = (typeof EUROPEAN_TARGET_LANGUAGES)[number];

/** Russian (`ru`) is strictly acquisition-only under D7, never a public portal language. */
export const ACQUISITION_ONLY_LANGUAGES = ["ru"] as const;

export const EXTENDED_TRANSLATION_STATUSES = [
  "machine",
  "machine_flagged",
  "reviewed",
  "stale",
] as const;
export type ExtendedTranslationStatus = (typeof EXTENDED_TRANSLATION_STATUSES)[number];

export const TranslationEntrySchema = z
  .strictObject({
    status: z
      .enum(EXTENDED_TRANSLATION_STATUSES)
      .describe("Translation status; machine_flagged and stale are never publishable."),
    source_hash: z
      .string()
      .regex(/^[0-9a-f]{16}$/)
      .describe("Fingerprint of the canonical Italian text."),
    target_hash: z
      .string()
      .regex(/^[0-9a-f]{16}$/)
      .describe("Fingerprint of the translated text."),
    tier: z.enum(CONTENT_TIERS).describe("L1-L5 content tier of this translated unit."),
    flagged_reasons: z
      .array(z.string().min(1))
      .optional()
      .describe("Reasons recorded when qualifier or semantic checks flagged the translation."),
    reviewed_by: z
      .string()
      .min(1)
      .optional()
      .describe("Human native-speaker reviewer identifier (D11), never set by automation."),
  })
  .describe("Per-language translation state under review.translations.<lang>.");
export type TranslationEntry = z.infer<typeof TranslationEntrySchema>;

export type PublicationGates = {
  /** D7: Ukrainian prioritized for publication; Russian remains acquisition-only. */
  d7Enabled: boolean;
  /** D11: Native-speaker reviewer sign-off available for languages/tiers that require it. */
  d11ReviewerApproved: ReadonlySet<string>;
};

export const DEFAULT_PUBLICATION_GATES: PublicationGates = {
  d7Enabled: false,
  d11ReviewerApproved: new Set(),
};

/**
 * Evaluates whether a `review.translations.<lang>` entry can be published.
 * - `machine_flagged` is NEVER publishable.
 * - `stale` is NEVER publishable as an authentic translation.
 * - `ru` (acquisition-only) is NEVER publishable.
 * - `uk` requires D7 gate enabled.
 * - `L4` / `L5` or `reviewed` expectations in target European languages respect D11.
 */
export function isTranslationPublishable(
  lang: string,
  entry: TranslationEntry | undefined,
  gates: PublicationGates = DEFAULT_PUBLICATION_GATES,
): { publishable: boolean; reason: string | null } {
  if (!entry) {
    return { publishable: false, reason: "missing_translation" };
  }
  if ((ACQUISITION_ONLY_LANGUAGES as readonly string[]).includes(lang)) {
    return { publishable: false, reason: "d7_acquisition_only" };
  }
  if (entry.status === "machine_flagged") {
    return { publishable: false, reason: "machine_flagged" };
  }
  if (entry.status === "stale") {
    return { publishable: false, reason: "stale_translation" };
  }
  if (lang === "uk" && !gates.d7Enabled) {
    return { publishable: false, reason: "d7_gate_pending" };
  }
  if (
    lang !== "en" &&
    lang !== "it" &&
    (entry.tier === "L4" || entry.tier === "L5") &&
    !gates.d11ReviewerApproved.has(lang)
  ) {
    return { publishable: false, reason: "d11_native_reviewer_required" };
  }
  return { publishable: true, reason: null };
}

export type TierCoverage = {
  lang: TargetLanguage;
  completedTiers: ContentTier[];
  missingTiers: ContentTier[];
  flaggedCount: number;
  staleCount: number;
  l1ToL3Complete: boolean;
};

export function evaluateLanguageRollout(
  lang: TargetLanguage,
  entries: readonly TranslationEntry[],
): TierCoverage {
  const byTier = new Map<ContentTier, TranslationEntry[]>();
  for (const tier of CONTENT_TIERS) byTier.set(tier, []);
  let flaggedCount = 0;
  let staleCount = 0;

  for (const entry of entries) {
    if (entry.status === "machine_flagged") flaggedCount += 1;
    if (entry.status === "stale") staleCount += 1;
    const list = byTier.get(entry.tier);
    if (list) list.push(entry);
  }

  const completedTiers: ContentTier[] = [];
  const missingTiers: ContentTier[] = [];

  for (const tier of CONTENT_TIERS) {
    const tierEntries = byTier.get(tier) ?? [];
    const allValid =
      tierEntries.length > 0 &&
      tierEntries.every((e) => e.status === "machine" || e.status === "reviewed");
    if (allValid) completedTiers.push(tier);
    else missingTiers.push(tier);
  }

  const l1ToL3Complete = (["L1", "L2", "L3"] as const).every((t) => completedTiers.includes(t));

  return {
    lang,
    completedTiers,
    missingTiers,
    flaggedCount,
    staleCount,
    l1ToL3Complete,
  };
}
