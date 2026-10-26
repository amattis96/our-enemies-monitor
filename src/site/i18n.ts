import type { Language, LocalizedText } from "../model/index.ts";

export type { Language };

/** Interface strings. Record content comes from the data, not from here. */
const UI = {
  it: {
    siteTagline:
      "Mappatura basata su evidenze di interferenze straniere, minacce ibride, pressioni geopolitiche e dipendenze strategiche che riguardano l'Europa.",
    skipToContent: "Vai al contenuto",
    mainNav: "Sezioni principali",
    navTimeline: "Cronologia",
    navNetwork: "Rete",
    navAtlas: "Atlante",
    navDependencies: "Dipendenze",
    navEntities: "Entità",
    navHypotheses: "Ipotesi",
    navSources: "Fonti",
    navMethodology: "Metodologia",
    navData: "Dati",
    navSearch: "Cerca",
    switchLanguage: "English",
    switchLanguageLabel: "Read this page in English",
    footerDisclaimer:
      "Progetto di ricerca OSINT indipendente. La presenza nel database non implica illecito, intento ostile o complicità. Cutoff della baseline: 21 ottobre 2026.",
    footerCode: "Codice",
    footerData: "dati e ricerca originali",
    footerSource: "sorgenti su GitHub",
    translationNotice:
      "Traduzione automatica dall'italiano, non ancora rivista. Il testo italiano è il riferimento.",
    originalItalian: "testo originale in italiano",
    notFoundTitle: "Pagina non trovata",
    reviewTitle: "Revisione e provenienza",
    reviewStatus: "Stato",
    canonicalRecord: "Record canonico",
    dataRow: "riga dati",
    line: "riga",
    sourcesNone: "nessuna fonte indicata",
    subject: "Soggetto",
    relationship: "Relazione (predicato letterale)",
    object: "Oggetto",
    evidence: "Evidenza",
    sources: "Fonti",
    primarySource: "Fonte primaria",
    restricted:
      "Relazione riservata: riguarda una persona e non ha ancora una fonte primaria collegata. Sarà pubblicata dopo la revisione editoriale.",
  },
  en: {
    siteTagline:
      "Evidence-based mapping of foreign interference, hybrid threats, geopolitical pressure and strategic dependencies affecting Europe.",
    skipToContent: "Skip to content",
    mainNav: "Main sections",
    navTimeline: "Timeline",
    navNetwork: "Network",
    navAtlas: "Atlas",
    navDependencies: "Dependencies",
    navEntities: "Entities",
    navHypotheses: "Hypotheses",
    navSources: "Sources",
    navMethodology: "Methodology",
    navData: "Data",
    navSearch: "Search",
    switchLanguage: "Italiano",
    switchLanguageLabel: "Leggi questa pagina in italiano",
    footerDisclaimer:
      "Independent OSINT research project. Appearing in the database does not imply wrongdoing, hostile intent or complicity. Baseline cut-off: 21 October 2026.",
    footerCode: "Code",
    footerData: "original data and research",
    footerSource: "source on GitHub",
    translationNotice:
      "Machine translation from Italian, not yet reviewed. The Italian text is the reference.",
    originalItalian: "original Italian text",
    notFoundTitle: "Page not found",
    reviewTitle: "Review and provenance",
    reviewStatus: "Status",
    canonicalRecord: "Canonical record",
    dataRow: "data row",
    line: "line",
    sourcesNone: "no source given",
    subject: "Subject",
    relationship: "Relationship (literal predicate)",
    object: "Object",
    evidence: "Evidence",
    sources: "Sources",
    primarySource: "Primary source",
    restricted:
      "Restricted relationship: it concerns a person and has no primary source linked yet. It will be published after editorial review.",
  },
} as const;

export type UiKey = keyof (typeof UI)["it"];

export function ui(lang: Language): Record<UiKey, string> {
  return UI[lang];
}

/** A localized text in the requested language, falling back to Italian. */
export function pick(
  text: LocalizedText,
  lang: Language,
): { value: string; lang: Language; fallback: boolean } {
  if (lang === "en" && text.en !== undefined)
    return { value: text.en, lang: "en", fallback: false };
  return { value: text.it, lang: "it", fallback: lang !== "it" };
}

export function textOf(text: LocalizedText, lang: Language): string {
  return pick(text, lang).value;
}

export function languageFromParam(param: string | undefined): Language {
  return param === "en" ? "en" : "it";
}

/** `getStaticPaths` entries for every language (`undefined` = Italian at the root). */
export function languagePaths(): { params: { lang: string | undefined } }[] {
  return [{ params: { lang: undefined } }, { params: { lang: "en" } }];
}

export function langParam(lang: Language): string | undefined {
  return lang === "it" ? undefined : lang;
}

/** Inline choice for short page-specific strings. */
export function choose<T>(lang: Language, it: T, en: T): T {
  return lang === "it" ? it : en;
}
