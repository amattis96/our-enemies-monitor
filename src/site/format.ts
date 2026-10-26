/** Display formatting and labels per language. Pure functions shared by pages and islands. */
import type { Language, Measure } from "../model/index.ts";

type Labels = { it: string; en: string };

const MONTHS: Record<Language, string[]> = {
  it: [
    "gennaio",
    "febbraio",
    "marzo",
    "aprile",
    "maggio",
    "giugno",
    "luglio",
    "agosto",
    "settembre",
    "ottobre",
    "novembre",
    "dicembre",
  ],
  en: [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ],
};

/** `2007` → "2007"; `2007-04` → "aprile 2007"; `2026-10-16` → "16 ottobre 2026". */
export function formatPartialDate(date: string, lang: Language = "it"): string {
  const [year, month, day] = date.split("-");
  if (!month) return year ?? date;
  const name = MONTHS[lang][Number(month) - 1] ?? month;
  return day ? `${Number(day)} ${name} ${year}` : `${name} ${year}`;
}

export function formatDateRange(start: string, end: string | null, lang: Language = "it"): string {
  return end
    ? `${formatPartialDate(start, lang)} – ${formatPartialDate(end, lang)}`
    : formatPartialDate(start, lang);
}

/** `GESTISCE_OCCULTAMENTE` → "gestisce occultamente" (the predicate stays literal, in Italian). */
export function formatPredicate(predicate: string): string {
  return predicate.toLowerCase().replaceAll("_", " ");
}

export const PRECISION_LABELS = {
  year: { it: "data nota all'anno", en: "date known to the year" },
  month: { it: "data nota al mese", en: "date known to the month" },
  day: { it: "data nota al giorno", en: "date known to the day" },
} satisfies Record<string, Labels>;

export const ENTITY_KIND_LABELS = {
  state: { it: "Stato", en: "State" },
  institution: { it: "Istituzione", en: "Institution" },
  person: { it: "Persona", en: "Person" },
  organization: { it: "Organizzazione", en: "Organisation" },
  company: { it: "Impresa", en: "Company" },
  asset: { it: "Asset / programma", en: "Asset / programme" },
  event: { it: "Evento", en: "Event" },
} satisfies Record<string, Labels>;

export const ENTITY_KIND_PLURALS = {
  state: { it: "Stati", en: "States" },
  institution: { it: "Istituzioni", en: "Institutions" },
  person: { it: "Persone", en: "People" },
  organization: { it: "Organizzazioni", en: "Organisations" },
  company: { it: "Imprese", en: "Companies" },
  asset: { it: "Asset e programmi", en: "Assets and programmes" },
} satisfies Record<string, Labels>;

export const RELATION_GROUP_LABELS = {
  participation: { it: "Partecipazione a eventi", en: "Participation in events" },
  control: { it: "Controllo e direzione", en: "Control and direction" },
  financial: { it: "Finanziamento", en: "Financing" },
  influence_information: { it: "Influenza e informazione", en: "Influence and information" },
  security_intelligence: { it: "Sicurezza e intelligence", en: "Security and intelligence" },
  economic_dependency: { it: "Economia e dipendenze", en: "Economy and dependencies" },
  institutional: { it: "Istituzionale e normativo", en: "Institutional and regulatory" },
  context: { it: "Contesto e conseguenze", en: "Context and consequences" },
} satisfies Record<string, Labels>;

export const EVIDENCE_STATUS_LABELS = {
  documented: { it: "documentato", en: "documented" },
  corroborated: { it: "corroborato", en: "corroborated" },
  institutional_attribution: { it: "attribuzione istituzionale", en: "institutional attribution" },
  allegation: { it: "denuncia non corroborata", en: "uncorroborated allegation" },
} satisfies Record<string, Labels>;

export const PRIORITY_LABELS = {
  critical: { it: "Critica", en: "Critical" },
  high: { it: "Alta", en: "High" },
  medium: { it: "Media", en: "Medium" },
  low: { it: "Bassa", en: "Low" },
} satisfies Record<string, Labels>;

export const HYPOTHESIS_STATUS_LABELS = {
  open_unproven: { it: "Aperta, non dimostrata", en: "Open, unproven" },
  under_review: { it: "In verifica", en: "Under review" },
  promoted: { it: "Promossa a relazione documentata", en: "Promoted to documented relationship" },
  refuted: { it: "Smentita", en: "Refuted" },
  closed_insufficient: {
    it: "Chiusa per prove insufficienti",
    en: "Closed, insufficient evidence",
  },
} satisfies Record<string, Labels>;

export const REVIEW_STATUS_LABELS = {
  imported_unreviewed: {
    it: "Importato dalla baseline, non ancora rivisto",
    en: "Imported from the baseline, not yet reviewed",
  },
  needs_review: { it: "Da rivedere", en: "Needs review" },
  reviewed: { it: "Rivisto", en: "Reviewed" },
} satisfies Record<string, Labels>;

export const TRANSLATION_STATUS_LABELS = {
  machine: { it: "traduzione automatica non rivista", en: "unreviewed machine translation" },
  reviewed: { it: "traduzione rivista", en: "reviewed translation" },
} satisfies Record<string, Labels>;

export const SOURCE_TYPE_LABELS = {
  corpus_document: { it: "Documento del corpus", en: "Corpus document" },
  external_reference: { it: "Riferimento esterno", en: "External reference" },
  unspecified_web: { it: "Fonte web non specificata", en: "Unspecified web source" },
} satisfies Record<string, Labels>;

const QUALIFIERS = {
  exact: { it: "", en: "" },
  approx: { it: "circa ", en: "about " },
  more_than: { it: "oltre ", en: "over " },
  less_than: { it: "meno di ", en: "less than " },
  nearly: { it: "quasi ", en: "almost " },
} satisfies Record<Measure["qualifier"], Labels>;

/** "circa 85%", "oltre €43,6 mld", "19 su 20", "2029". */
export function formatMeasure(measure: Measure, lang: Language): string {
  const number = new Intl.NumberFormat(lang === "it" ? "it-IT" : "en-GB").format(measure.value);
  const value =
    measure.unit === "percent"
      ? `${number}%`
      : measure.unit === "eur_billion"
        ? lang === "it"
          ? `€${number} mld`
          : `€${number} bn`
        : measure.unit === "year"
          ? String(measure.value)
          : measure.out_of !== null
            ? `${number} ${lang === "it" ? "su" : "of"} ${measure.out_of}`
            : number;
  return `${QUALIFIERS[measure.qualifier][lang]}${value}`;
}

/** Country name from an ISO code, in the page language. */
export function countryName(code: string, lang: Language): string {
  return new Intl.DisplayNames([lang], { type: "region" }).of(code) ?? code;
}
