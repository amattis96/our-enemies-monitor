import { readFileSync } from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "../pipeline/paths.ts";
import type { TargetLanguage } from "./multilingual.ts";

export type GlossaryEntry = {
  id: string;
  iate_id: string;
  it: string;
  critical_qualifier: boolean;
  terms: Record<string, string[]>;
  notes?: string;
};

export type GlossaryFile = {
  version: string;
  canonical_language: string;
  target_languages: string[];
  entries: GlossaryEntry[];
};

export type QualifierIssueCode =
  | "missing_qualifier"
  | "number_mismatch"
  | "date_mismatch"
  | "negation_mismatch";

export type QualifierIssue = {
  code: QualifierIssueCode;
  detail: string;
  sourceToken: string;
};

export type QualifierCheckResult = {
  ok: boolean;
  status: "machine" | "machine_flagged";
  issues: QualifierIssue[];
};

const NEGATION_MARKERS: Record<string, RegExp> = {
  it: /\b(non|nessun[oa]?|mai|senza|né)\b/i,
  en: /\b(not|no|never|without|neither|nor|unproven|undemonstrated|n't)\b/i,
  fr: /\b(ne|n'|pas|aucun[e]?|jamais|sans|ni|non)\b/i,
  de: /\b(nicht|kein[e]?|nie|niemals|ohne|weder|unbewiesen)\b/i,
  pl: /\b(nie|żaden|żadna|żadne|nigdy|bez|ani|nieudowodniony)\b/i,
  uk: /(^|\s)(не|ні|ніколи|без|жодн)/i,
  es: /\b(no|ningún|ninguna|nunca|sin|ni)\b/i,
  ro: /\b(nu|niciun|nicio|niciodată|fără|nici|nedemonstrat)\b/i,
  lt: /\b(ne|joks|niekada|be|nei|neįrodytas)\b/i,
  lv: /\b(ne|nav|nekad|bez|neviens|nepierādīts)\b/i,
  et: /\b(ei|mitte|kunagi|ilma|ükski|tõendamata)\b/i,
};

let cachedGlossary: GlossaryFile | undefined;

export function loadIateGlossary(
  glossaryPath: string = path.join(REPO_ROOT, "docs/i18n/glossary.v1.json"),
): GlossaryFile {
  if (!cachedGlossary || glossaryPath !== path.join(REPO_ROOT, "docs/i18n/glossary.v1.json")) {
    const parsed = JSON.parse(readFileSync(glossaryPath, "utf8")) as GlossaryFile;
    if (glossaryPath === path.join(REPO_ROOT, "docs/i18n/glossary.v1.json")) {
      cachedGlossary = parsed;
    }
    return parsed;
  }
  return cachedGlossary;
}

function extractDates(text: string): string[] {
  return [...new Set(text.match(/\b\d{4}(?:-\d{2}(?:-\d{2})?)?\b/g) ?? [])].sort();
}

function extractNumbers(text: string): string[] {
  const withoutDates = text.replace(/\b\d{4}(?:-\d{2}(?:-\d{2})?)?\b/g, " ");
  return [...new Set(withoutDates.match(/\b\d+(?:[.,]\d+)?\b/g) ?? [])].sort();
}

/**
 * Verifies that critical Italian legal/evidentiary qualifiers, dates, numbers,
 * and negations are preserved in the translated text. Any mismatch yields
 * `status: "machine_flagged"` (never publishable).
 */
export function checkTranslationQualifiers(
  sourceIt: string,
  translatedText: string,
  targetLang: TargetLanguage,
  glossary: GlossaryFile = loadIateGlossary(),
): QualifierCheckResult {
  const issues: QualifierIssue[] = [];
  const lowerSource = sourceIt.toLowerCase();
  const lowerTarget = translatedText.toLowerCase();

  for (const entry of glossary.entries) {
    if (!entry.critical_qualifier) continue;
    const escaped = entry.it.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const sourcePattern = new RegExp(`\\b${escaped}\\b`, "i");
    if (!sourcePattern.test(lowerSource)) continue;

    const candidates = entry.terms[targetLang] ?? [];
    if (candidates.length === 0) continue;

    const matched = candidates.some((candidate) => lowerTarget.includes(candidate.toLowerCase()));
    if (!matched) {
      issues.push({
        code: "missing_qualifier",
        sourceToken: entry.it,
        detail: `Critical qualifier "${entry.it}" missing IATE-aligned ${targetLang} equivalent (${candidates.join(" / ")}).`,
      });
    }
  }

  const sourceDates = extractDates(sourceIt);
  const targetDates = new Set(extractDates(translatedText));
  for (const d of sourceDates) {
    if (!targetDates.has(d)) {
      issues.push({
        code: "date_mismatch",
        sourceToken: d,
        detail: `Date "${d}" from Italian source is missing or altered in ${targetLang} translation.`,
      });
    }
  }

  const sourceNumbers = extractNumbers(sourceIt);
  const targetNumbers = new Set(extractNumbers(translatedText).map((n) => n.replace(",", ".")));
  for (const num of sourceNumbers) {
    const normalized = num.replace(",", ".");
    if (!targetNumbers.has(normalized)) {
      issues.push({
        code: "number_mismatch",
        sourceToken: num,
        detail: `Number "${num}" from Italian source is missing or altered in ${targetLang} translation.`,
      });
    }
  }

  const itNegation = NEGATION_MARKERS.it;
  const targetNegation = NEGATION_MARKERS[targetLang];
  if (
    itNegation &&
    targetNegation &&
    itNegation.test(sourceIt) &&
    !targetNegation.test(translatedText)
  ) {
    issues.push({
      code: "negation_mismatch",
      sourceToken: "negation",
      detail: `Italian source contains a negation marker that is absent in the ${targetLang} translation.`,
    });
  }

  return {
    ok: issues.length === 0,
    status: issues.length === 0 ? "machine" : "machine_flagged",
    issues,
  };
}
