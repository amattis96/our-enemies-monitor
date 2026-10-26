/** Display formatting (Italian). Pure functions shared by pages and islands. */

const MONTHS = [
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
];

/** `2007` → "2007", `2007-04` → "aprile 2007", `2026-10-16` → "16 ottobre 2026". */
export function formatPartialDate(date: string): string {
  const [year, month, day] = date.split("-");
  if (!month) return year ?? date;
  const name = MONTHS[Number(month) - 1] ?? month;
  return day ? `${Number(day)} ${name} ${year}` : `${name} ${year}`;
}

export function formatDateRange(start: string, end: string | null): string {
  return end ? `${formatPartialDate(start)} – ${formatPartialDate(end)}` : formatPartialDate(start);
}

export const PRECISION_LABELS = {
  year: "data nota all'anno",
  month: "data nota al mese",
  day: "data nota al giorno",
} as const;

/** `GESTISCE_OCCULTAMENTE` → "gestisce occultamente" (the predicate stays literal). */
export function formatPredicate(predicate: string): string {
  return predicate.toLowerCase().replaceAll("_", " ");
}

export const ENTITY_KIND_LABELS = {
  state: "Stato",
  institution: "Istituzione",
  person: "Persona",
  organization: "Organizzazione",
  company: "Impresa",
  asset: "Asset / programma",
  event: "Evento",
} as const;

export const ENTITY_KIND_PLURALS = {
  state: "Stati",
  institution: "Istituzioni",
  person: "Persone",
  organization: "Organizzazioni",
  company: "Imprese",
  asset: "Asset e programmi",
} as const;

export const RELATION_GROUP_LABELS = {
  participation: "Partecipazione a eventi",
  control: "Controllo e direzione",
  financial: "Finanziamento",
  influence_information: "Influenza e informazione",
  security_intelligence: "Sicurezza e intelligence",
  economic_dependency: "Economia e dipendenze",
  institutional: "Istituzionale e normativo",
  context: "Contesto e conseguenze",
} as const;

export const EVIDENCE_STATUS_LABELS = {
  documented: "documentato",
  corroborated: "corroborato",
  institutional_attribution: "attribuzione istituzionale",
  allegation: "denuncia non corroborata",
} as const;

export const PRIORITY_LABELS = {
  critical: "Critica",
  high: "Alta",
  medium: "Media",
  low: "Bassa",
} as const;

export const HYPOTHESIS_STATUS_LABELS = {
  open_unproven: "Aperta, non dimostrata",
  under_review: "In verifica",
  promoted: "Promossa a relazione documentata",
  refuted: "Smentita",
  closed_insufficient: "Chiusa per prove insufficienti",
} as const;

export const REVIEW_STATUS_LABELS = {
  imported_unreviewed: "Importato dalla baseline, non ancora rivisto",
  needs_review: "Da rivedere",
  reviewed: "Rivisto",
} as const;

export const SOURCE_TYPE_LABELS = {
  corpus_document: "Documento del corpus",
  external_reference: "Riferimento esterno",
  unspecified_web: "Fonte web non specificata",
} as const;
