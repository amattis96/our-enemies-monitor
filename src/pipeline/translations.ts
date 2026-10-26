import { createHash } from "node:crypto";
import type { LocalizedText, Review } from "../model/index.ts";

/**
 * Every localized text of a record (objects with an `it` string), in a
 * stable traversal order. Provenance and review are excluded: they hold
 * original source values and editorial notes, not translatable content.
 */
export function localizedTexts(record: object): LocalizedText[] {
  const found: LocalizedText[] = [];
  const visit = (value: unknown, key: string) => {
    if (key === "provenance" || key === "review" || value === null || typeof value !== "object") {
      return;
    }
    if (!Array.isArray(value) && typeof (value as { it?: unknown }).it === "string") {
      found.push(value as LocalizedText);
      return;
    }
    for (const [childKey, child] of Object.entries(value)) visit(child, childKey);
  };
  visit(record, "");
  return found;
}

/** Fingerprint of the Italian texts a translation was made from. */
export function sourceHash(record: object): string {
  const texts = localizedTexts(record).map((text) => text.it);
  return createHash("sha256").update(JSON.stringify(texts)).digest("hex").slice(0, 16);
}

/** Problems with the English translation of a record, if any. */
export function translationProblem(record: { review: Review }): string | null {
  const texts = localizedTexts(record);
  const state = record.review.translations?.en;
  const translated = texts.filter((t) => t.en !== undefined).length;
  if (!state) {
    return translated > 0 ? "has English texts but no review.translations.en state" : null;
  }
  if (translated < texts.length) {
    return `English translation incomplete (${translated}/${texts.length} texts)`;
  }
  if (state.source_hash !== sourceHash(record)) {
    return "English translation is stale: the Italian text changed (re-translate or remove it)";
  }
  return null;
}
