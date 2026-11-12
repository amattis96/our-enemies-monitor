import { comparePartialDates } from "../../model/index.ts";

type DateRange = { start: string; end: string | null };

/** Lowercase, without diacritics, punctuation and repeated spaces. */
export function normalizeName(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

// Short Italian/English function words that carry no identity.
const STOPWORDS = new Set(
  (
    "a ad al alla alle agli ai all che con da dal dalla dei del della delle dello di e ed " +
    "gli i il in l la le lo nei nel nella non o per sono su sul sulla tra un una uno " +
    "an and at by for from of on or the to with"
  ).split(" "),
);

function tokens(text: string): Set<string> {
  return new Set(
    normalizeName(text)
      .split(" ")
      .filter((token) => token.length > 1 && !STOPWORDS.has(token)),
  );
}

/** Jaccard similarity of the content words of two texts (0–1). */
export function textSimilarity(a: string, b: string): number {
  const left = tokens(a);
  const right = tokens(b);
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const token of left) if (right.has(token)) shared++;
  return shared / (left.size + right.size - shared);
}

/** Whether two partial date ranges overlap at their common precision. */
export function rangesOverlap(a: DateRange, b: DateRange): boolean {
  const aEnd = a.end ?? a.start;
  const bEnd = b.end ?? b.start;
  return comparePartialDates(a.start, bEnd) <= 0 && comparePartialDates(b.start, aEnd) <= 0;
}

/** URL identity for deduplication: no fragment, no trailing slash, lowercase host. */
export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    const path = parsed.pathname.replace(/\/+$/, "");
    return `${parsed.protocol}//${parsed.host.toLowerCase()}${path}${parsed.search}`;
  } catch {
    return url;
  }
}

/** Title similarity at or above which an overlapping event is a duplicate. */
export const DUPLICATE_THRESHOLD = 0.6;
/** Title similarity at or above which an overlapping event needs an editor (conflict). */
export const POSSIBLE_DUPLICATE_THRESHOLD = 0.35;
