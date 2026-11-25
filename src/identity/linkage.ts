import type { IdentityEntityProfile, LinkageDecision, LinkageOutcome } from "./schema.ts";

// ---------------------------------------------------------------------------
// Non-destructive Transliteration & Comparison Normalization

const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "yo",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "kh",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "shch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
  і: "i",
  ї: "yi",
  є: "ye",
  ґ: "g",
  ў: "u",
  ђ: "dj",
  ј: "j",
  љ: "lj",
  њ: "nj",
  ћ: "c",
  џ: "dz",
};

const CYRILLIC_PATTERN = /[\u0400-\u04FF]/;

/**
 * Transliterates Cyrillic characters to Latin for comparison only.
 * Never mutates the source entity record.
 */
export function transliterateCyrillicToLatin(text: string): string {
  let out = "";
  for (const ch of text) {
    const lower = ch.toLowerCase();
    const mapped = CYRILLIC_TO_LATIN[lower];
    if (mapped !== undefined) {
      if (ch !== lower && mapped.length > 0) {
        out += mapped.charAt(0).toUpperCase() + mapped.slice(1);
      } else {
        out += mapped;
      }
    } else {
      out += ch;
    }
  }
  return out;
}

/**
 * Produces a normalized comparison string (accent-stripped, transliterated,
 * lowercased, punctuation-collapsed) without modifying the input.
 */
export function normalizeForComparison(text: string): string {
  const transliterated = transliterateCyrillicToLatin(text);
  return transliterated
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// Jaro-Winkler Similarity

/** Computes Jaro similarity in [0, 1] between two strings. */
export function jaroSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const lenA = a.length;
  const lenB = b.length;
  if (lenA === 0 || lenB === 0) return 0;

  const matchDistance = Math.max(0, Math.floor(Math.max(lenA, lenB) / 2) - 1);
  const aMatches = new Array<boolean>(lenA).fill(false);
  const bMatches = new Array<boolean>(lenB).fill(false);

  let matches = 0;
  for (let i = 0; i < lenA; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, lenB);
    for (let j = start; j < end; j++) {
      if (bMatches[j]) continue;
      if (a.charAt(i) !== b.charAt(j)) continue;
      aMatches[i] = true;
      bMatches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0;

  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < lenA; i++) {
    if (!aMatches[i]) continue;
    while (!bMatches[k]) k++;
    if (a.charAt(i) !== b.charAt(k)) transpositions++;
    k++;
  }

  return (matches / lenA + matches / lenB + (matches - transpositions / 2) / matches) / 3;
}

/** Computes Jaro-Winkler similarity in [0, 1] between two strings. */
export function jaroWinklerSimilarity(a: string, b: string, prefixScale = 0.1): number {
  const jaro = jaroSimilarity(a, b);
  let prefix = 0;
  const maxPrefix = Math.min(4, a.length, b.length);
  for (let i = 0; i < maxPrefix; i++) {
    if (a.charAt(i) === b.charAt(i)) {
      prefix++;
    } else {
      break;
    }
  }
  return Math.min(1, jaro + prefix * prefixScale * (1 - jaro));
}

export type NameComparisonResult = {
  similarity: number;
  normalized_a: string;
  normalized_b: string;
  transliterated: boolean;
};

/**
 * Compares two names non-destructively using both normalized Latin forms
 * and Cyrillic-to-Latin transliteration.
 */
export function compareNamesWithTransliteration(a: string, b: string): NameComparisonResult {
  const normA = normalizeForComparison(a);
  const normB = normalizeForComparison(b);
  const transliterated = CYRILLIC_PATTERN.test(a) || CYRILLIC_PATTERN.test(b);
  const similarity = jaroWinklerSimilarity(normA, normB);
  return {
    similarity,
    normalized_a: normA,
    normalized_b: normB,
    transliterated,
  };
}

// ---------------------------------------------------------------------------
// Fellegi-Sunter Record Linkage Scorer

export type ScoringOptions = {
  sameThreshold?: number;
  uncertainThreshold?: number;
};

export type PairScoreResult = {
  entity_a: string;
  entity_b: string;
  score: number;
  log_likelihood_ratio: number;
  outcome: LinkageOutcome;
  persisted_decision: boolean;
  auto_merge: false;
  matched_fields: string[];
  conflicting_fields: string[];
  best_name_similarity: number;
  transliteration_used: boolean;
};

const DEFAULT_SAME_THRESHOLD = 0.85;
const DEFAULT_UNCERTAIN_THRESHOLD = 0.55;

// Fellegi-Sunter log-likelihood weights (m vs u ratios)
const WEIGHTS = {
  lei_match: 8.5,
  lei_conflict: -7.0,
  registry_match: 7.0,
  wikidata_match: 6.5,
  wikidata_conflict: -6.0,
  website_match: 4.0,
  name_exact: 3.5,
  name_high: 2.2,
  name_moderate: 0.8,
  name_low: -2.0,
  kind_match: 0.6,
  kind_conflict: -3.5,
  country_match: 0.8,
  country_conflict: -1.5,
} as const;

function canonicalPairKey(a: string, b: string): string {
  return a < b ? `${a}::${b}` : `${b}::${a}`;
}

function orderedPair(a: string, b: string): [string, string] {
  return a.localeCompare(b) <= 0 ? [a, b] : [b, a];
}

function normalizeWebsiteHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return url.toLowerCase().trim();
  }
}

function collectNameStrings(entity: IdentityEntityProfile): string[] {
  const names = [entity.name.it];
  if (entity.name.en) names.push(entity.name.en);
  if (entity.aliases) {
    for (const alias of entity.aliases) {
      names.push(alias.name);
    }
  }
  return names;
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/**
 * Scores a pair of entity profiles using Fellegi-Sunter log-likelihood weights,
 * prioritizing qualified external identifiers over secondary name similarity.
 * Respects persisted `distinct` (and `same`) decisions unconditionally.
 */
export function scoreEntityPair(
  a: IdentityEntityProfile,
  b: IdentityEntityProfile,
  decisions: readonly LinkageDecision[] = [],
  options: ScoringOptions = {},
): PairScoreResult {
  const pairKey = canonicalPairKey(a.id, b.id);
  const existing = decisions.find((d) => canonicalPairKey(d.entity_a, d.entity_b) === pairKey);

  const sameThreshold = options.sameThreshold ?? DEFAULT_SAME_THRESHOLD;
  const uncertainThreshold = options.uncertainThreshold ?? DEFAULT_UNCERTAIN_THRESHOLD;

  let llr = -1.2; // conservative prior (most random pairs are distinct)
  const matchedFields: string[] = [];
  const conflictingFields: string[] = [];

  // 1. Primary criterion: Qualified External Identifiers
  const extA = a.external_ids;
  const extB = b.external_ids;

  if (extA?.lei && extB?.lei) {
    if (extA.lei === extB.lei) {
      llr += WEIGHTS.lei_match;
      matchedFields.push("external_ids.lei");
    } else {
      llr += WEIGHTS.lei_conflict;
      conflictingFields.push("external_ids.lei");
    }
  }

  if (extA?.registry_numbers?.length && extB?.registry_numbers?.length) {
    const keysA = new Set(
      extA.registry_numbers.map((r) => `${r.jurisdiction}:${r.number.trim().toUpperCase()}`),
    );
    const hasRegistryMatch = extB.registry_numbers.some((r) =>
      keysA.has(`${r.jurisdiction}:${r.number.trim().toUpperCase()}`),
    );
    if (hasRegistryMatch) {
      llr += WEIGHTS.registry_match;
      matchedFields.push("external_ids.registry_numbers");
    }
  }

  if (extA?.wikidata_qid && extB?.wikidata_qid) {
    if (extA.wikidata_qid === extB.wikidata_qid) {
      llr += WEIGHTS.wikidata_match;
      matchedFields.push("external_ids.wikidata_qid");
    } else {
      llr += WEIGHTS.wikidata_conflict;
      conflictingFields.push("external_ids.wikidata_qid");
    }
  }

  if (extA?.official_website && extB?.official_website) {
    if (
      normalizeWebsiteHost(extA.official_website) === normalizeWebsiteHost(extB.official_website)
    ) {
      llr += WEIGHTS.website_match;
      matchedFields.push("external_ids.official_website");
    }
  }

  // 2. Secondary criterion: Name & Alias Similarity (with transliteration)
  const namesA = collectNameStrings(a);
  const namesB = collectNameStrings(b);
  let bestSim = 0;
  let transliterationUsed = false;

  for (const na of namesA) {
    for (const nb of namesB) {
      const cmp = compareNamesWithTransliteration(na, nb);
      if (cmp.similarity > bestSim) {
        bestSim = cmp.similarity;
        transliterationUsed = cmp.transliterated;
      }
    }
  }

  if (bestSim >= 0.96) {
    llr += WEIGHTS.name_exact;
    matchedFields.push("name_exact_or_translit");
  } else if (bestSim >= 0.88) {
    llr += WEIGHTS.name_high;
    matchedFields.push("name_high_similarity");
  } else if (bestSim >= 0.78) {
    llr += WEIGHTS.name_moderate;
    matchedFields.push("name_moderate_similarity");
  } else {
    llr += WEIGHTS.name_low;
  }

  // 3. Structural attributes (kind, country)
  if (a.kind === b.kind) {
    llr += WEIGHTS.kind_match;
    matchedFields.push("kind");
  } else {
    llr += WEIGHTS.kind_conflict;
    conflictingFields.push("kind");
  }

  if (a.country && b.country) {
    if (a.country === b.country) {
      llr += WEIGHTS.country_match;
      matchedFields.push("country");
    } else {
      llr += WEIGHTS.country_conflict;
      conflictingFields.push("country");
    }
  }

  const score = Number(sigmoid(llr).toFixed(4));
  const [orderedA, orderedB] = orderedPair(a.id, b.id);

  // Persisted decisions always take precedence over computed scores.
  if (existing) {
    return {
      entity_a: orderedA,
      entity_b: orderedB,
      score,
      log_likelihood_ratio: Number(llr.toFixed(4)),
      outcome: existing.outcome,
      persisted_decision: true,
      auto_merge: false,
      matched_fields: matchedFields,
      conflicting_fields: conflictingFields,
      best_name_similarity: Number(bestSim.toFixed(4)),
      transliteration_used: transliterationUsed,
    };
  }

  let outcome: LinkageOutcome = "distinct";
  if (score >= sameThreshold) {
    outcome = "same";
  } else if (score >= uncertainThreshold) {
    outcome = "uncertain";
  }

  return {
    entity_a: orderedA,
    entity_b: orderedB,
    score,
    log_likelihood_ratio: Number(llr.toFixed(4)),
    outcome,
    persisted_decision: false,
    auto_merge: false,
    matched_fields: matchedFields,
    conflicting_fields: conflictingFields,
    best_name_similarity: Number(bestSim.toFixed(4)),
    transliteration_used: transliterationUsed,
  };
}

export type CandidateSearchOptions = ScoringOptions & {
  minScore?: number;
  includePersistedDistinct?: boolean;
};

/**
 * Scans all entity pairs and returns candidate linkage pairs sorted by score
 * descending. Never mutates entities and never performs automatic merges.
 */
export function findCandidatePairs(
  entities: readonly IdentityEntityProfile[],
  decisions: readonly LinkageDecision[] = [],
  options: CandidateSearchOptions = {},
): PairScoreResult[] {
  const minScore = options.minScore ?? options.uncertainThreshold ?? DEFAULT_UNCERTAIN_THRESHOLD;
  const includePersistedDistinct = options.includePersistedDistinct ?? false;
  const results: PairScoreResult[] = [];

  for (let i = 0; i < entities.length; i++) {
    const a = entities[i];
    if (!a) continue;
    for (let j = i + 1; j < entities.length; j++) {
      const b = entities[j];
      if (!b) continue;
      const scored = scoreEntityPair(a, b, decisions, options);
      if (scored.persisted_decision && scored.outcome === "distinct") {
        if (includePersistedDistinct) results.push(scored);
        continue;
      }
      if (scored.outcome !== "distinct" || scored.score >= minScore) {
        results.push(scored);
      }
    }
  }

  return results.sort((x, y) => y.score - x.score);
}
