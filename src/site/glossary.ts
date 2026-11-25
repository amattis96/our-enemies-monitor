import type { EvidenceLevel, Language } from "../model/index.ts";

export type BilingualText = { it: string; en: string };

export type GlossaryCategory = "method" | "evidence" | "technical" | "governance";

export type GlossaryEntry = {
  id: string;
  term: BilingualText;
  short: BilingualText;
  definition: BilingualText;
  category: GlossaryCategory;
  seeAlso?: string;
};

export const GLOSSARY_CATEGORY_LABELS: Record<GlossaryCategory, BilingualText> = {
  method: { it: "Metodo e dati", en: "Method and data" },
  evidence: { it: "Livelli di evidenza", en: "Evidence levels" },
  technical: { it: "Termini tecnici e domini", en: "Technical and domain terms" },
  governance: { it: "Revisione e tracciabilità", en: "Review and traceability" },
};

/**
 * Plain-language definitions for E1–E5 displayed next to every EvidenceStamp badge.
 */
export const EVIDENCE_PLAIN_LABELS: Record<
  EvidenceLevel,
  { short: BilingualText; plain: BilingualText }
> = {
  E1: {
    short: { it: "Atto primario", en: "Primary act" },
    plain: {
      it: "Documento ufficiale, sentenza o fatto tecnico verificato",
      en: "Official record, court ruling or verified technical fact",
    },
  },
  E2: {
    short: { it: "Attribuzione", en: "Attribution" },
    plain: {
      it: "Dichiarazione formale di governo, intelligence o ente pubblico",
      en: "Formal statement by a government, intelligence service or public body",
    },
  },
  E3: {
    short: { it: "Corroborato", en: "Corroborated" },
    plain: {
      it: "Inchiesta giornalistica originale o analisi tecnica indipendente",
      en: "Original journalistic investigation or independent technical analysis",
    },
  },
  E4: {
    short: { it: "Accusa", en: "Allegation" },
    plain: {
      it: "Accusa o segnalazione non ancora confermata da prove indipendenti",
      en: "Allegation or claim not yet confirmed by independent evidence",
    },
  },
  E5: {
    short: { it: "Ipotesi", en: "Hypothesis" },
    plain: {
      it: "Domanda investigativa aperta da verificare, non un fatto accertato",
      en: "Open investigative question to verify, not an established fact",
    },
  },
};

export function evidencePlainDefinition(level: EvidenceLevel, lang: Language): string {
  return EVIDENCE_PLAIN_LABELS[level].plain[lang];
}

export const GLOSSARY: readonly GlossaryEntry[] = [
  {
    id: "osint",
    term: { it: "OSINT (Open-Source Intelligence)", en: "OSINT (Open-Source Intelligence)" },
    short: {
      it: "ricerca basata su fonti pubbliche",
      en: "research from publicly available sources",
    },
    definition: {
      it: "Raccolta e analisi di informazioni provenienti da fonti aperte e accessibili al pubblico (atti ufficiali, bilanci societari, sentenze, inchieste giornalistiche, dati tecnici), senza accesso a materiale riservato.",
      en: "Collection and analysis of information from publicly accessible sources (official records, corporate filings, court rulings, investigative journalism, technical data), without access to classified material.",
    },
    category: "method",
    seeAlso: "methodology/",
  },
  {
    id: "fimi",
    term: {
      it: "FIMI (Manipolazione e interferenza informativa straniera)",
      en: "FIMI (Foreign Information Manipulation and Interference)",
    },
    short: {
      it: "campagne coordinate di manipolazione informativa dall'estero",
      en: "coordinated foreign information manipulation campaigns",
    },
    definition: {
      it: "Attività intenzionale e coordinata, spesso non dichiarata, con cui attori stranieri manipolano l'ecosistema informativo europeo attraverso reti di siti, profili falsi, finanziamenti opachi o amplificazione artificiale.",
      en: "Intentional, coordinated and often undisclosed activity by foreign actors to manipulate the European information environment through networks of outlets, fake accounts, opaque funding or artificial amplification.",
    },
    category: "technical",
    seeAlso: "timeline/?tema=disinformation",
  },
  {
    id: "baseline",
    term: { it: "Baseline", en: "Baseline" },
    short: {
      it: "archivio iniziale di partenza del progetto",
      en: "initial starting dataset of the project",
    },
    definition: {
      it: "Il nucleo storico iniziale di documenti e schede importato all'avvio del monitor. I record della baseline portano la dicitura «importato dalla baseline, non ancora rivisto» finché un revisore umano non li verifica riga per riga.",
      en: "The initial historical corpus of documents and records imported when the monitor launched. Baseline records carry an “imported from baseline, not yet reviewed” notice until a human editor verifies them line by line.",
    },
    category: "governance",
    seeAlso: "methodology/",
  },
  {
    id: "cutoff",
    term: { it: "Cutoff (data di chiusura)", en: "Cut-off date" },
    short: {
      it: "data limite dei dati consolidati",
      en: "closing date of consolidated data",
    },
    definition: {
      it: "La data fino alla quale un insieme di dati è stato consolidato (ad esempio 21 ottobre 2026 per la baseline). Gli eventi successivi entrano solo dopo acquisizione, verifica ed esplicita integrazione.",
      en: "The date up to which a dataset has been consolidated (for example, 21 October 2026 for the baseline). Later events appear only after acquisition, verification and explicit integration.",
    },
    category: "method",
    seeAlso: "changes/",
  },
  {
    id: "canonical_records",
    term: { it: "Record canonici", en: "Canonical records" },
    short: {
      it: "schede strutturate e versionate nel database",
      en: "structured, versioned records in the database",
    },
    definition: {
      it: "Le schede ufficiali del database (entità, eventi, relazioni, ipotesi e fonti) archiviate una per file e controllate da regole automatiche di coerenza. Un documento appena acquisito non diventa record canonico finché non viene integrato e revisionato.",
      en: "The official database entries (entities, events, relationships, hypotheses and sources) stored one per file and checked by automated consistency rules. A newly acquired document does not become a canonical record until integrated and reviewed.",
    },
    category: "governance",
    seeAlso: "data/",
  },
  {
    id: "gnss",
    term: { it: "GNSS", en: "GNSS" },
    short: {
      it: "sistemi satellitari di navigazione come GPS e Galileo",
      en: "satellite navigation systems such as GPS and Galileo",
    },
    definition: {
      it: "Global Navigation Satellite System: l'insieme dei sistemi satellitari usati per posizionamento e navigazione (GPS, Galileo, GLONASS). Le interferenze (jamming e spoofing) disturbano il traffico aereo e marittimo.",
      en: "Global Navigation Satellite System: satellite constellations used for positioning and navigation (GPS, Galileo, GLONASS). Interference such as jamming and spoofing disrupts air and maritime traffic.",
    },
    category: "technical",
    seeAlso: "timeline/?tema=cyber",
  },
  {
    id: "ubo",
    term: { it: "UBO (Titolare effettivo)", en: "UBO (Ultimate Beneficial Owner)" },
    short: {
      it: "persona fisica che controlla o beneficia di una società",
      en: "natural person who ultimately owns or controls a company",
    },
    definition: {
      it: "Ultimate Beneficial Owner: la persona fisica che, in ultima istanza, possiede o controlla un'impresa o un trust, anche attraverso catene di società schermo o fiduciarie in più giurisdizioni.",
      en: "Ultimate Beneficial Owner: the natural person who ultimately owns or controls a legal entity or trust, even through chains of shell companies or nominees across jurisdictions.",
    },
    category: "technical",
    seeAlso: "entities/",
  },
  {
    id: "e1",
    term: { it: "Livello E1 — Atto primario", en: "Level E1 — Primary act" },
    short: EVIDENCE_PLAIN_LABELS.E1.plain,
    definition: {
      it: "Il massimo livello di sostegno documentale: sentenza definitiva o provvedimento giudiziario, atto normativo, sanzione ufficiale, bilancio depositato o dato tecnico direttamente verificato.",
      en: "The strongest documentary support: final court judgment or judicial order, legislative act, official sanction, filed financial statement or directly verified technical data.",
    },
    category: "evidence",
    seeAlso: "methodology/",
  },
  {
    id: "e2",
    term: {
      it: "Livello E2 — Attribuzione istituzionale",
      en: "Level E2 — Institutional attribution",
    },
    short: EVIDENCE_PLAIN_LABELS.E2.plain,
    definition: {
      it: "Attribuzione formale pronunciata da un governo, da un'agenzia di sicurezza nazionale, da un'istituzione europea o dalla NATO. Non equivale automaticamente a una condanna giudiziaria.",
      en: "Formal attribution issued by a government, national security agency, European institution or NATO. It is not automatically equivalent to a court conviction.",
    },
    category: "evidence",
    seeAlso: "methodology/",
  },
  {
    id: "e3",
    term: { it: "Livello E3 — Corroborato", en: "Level E3 — Corroborated" },
    short: EVIDENCE_PLAIN_LABELS.E3.plain,
    definition: {
      it: "Inchiesta giornalistica originale basata su documenti o testimonianze verificate, oppure analisi forense indipendente confermata da più riscontri convergenti.",
      en: "Original investigative reporting grounded in verified documents or testimony, or independent forensic analysis confirmed by multiple converging findings.",
    },
    category: "evidence",
    seeAlso: "methodology/",
  },
  {
    id: "e4",
    term: { it: "Livello E4 — Accusa non corroborata", en: "Level E4 — Uncorroborated allegation" },
    short: EVIDENCE_PLAIN_LABELS.E4.plain,
    definition: {
      it: "Dichiarazione, esposto o accusa pubblica che non dispone ancora di conferme documentali o forensi indipendenti. Viene registrata come posizione riferita, non come fatto.",
      en: "Public claim, complaint or allegation that does not yet have independent documentary or forensic confirmation. Recorded as a reported position, not an established fact.",
    },
    category: "evidence",
    seeAlso: "methodology/",
  },
  {
    id: "e5",
    term: { it: "Livello E5 — Ipotesi aperta", en: "Level E5 — Open hypothesis" },
    short: EVIDENCE_PLAIN_LABELS.E5.plain,
    definition: {
      it: "Domanda investigativa falsificabile o pista di lavoro. Le ipotesi E5 vivono in un registro separato, non compaiono nel grafo delle relazioni accertate e non diventano mai fatti senza fonte primaria e revisione umana.",
      en: "Falsifiable investigative question or working lead. E5 hypotheses live in a separate register, never appear in the established relationship graph, and never become facts without a primary source and human review.",
    },
    category: "evidence",
    seeAlso: "hypotheses/",
  },
  {
    id: "provenance",
    term: { it: "Provenienza", en: "Provenance" },
    short: {
      it: "origine esatta di ogni dato pubblicato",
      en: "exact origin of every published data point",
    },
    definition: {
      it: "Il riferimento al file sorgente, alla riga o al documento originale da cui deriva una scheda, insieme allo stato di revisione editoriale. Permette a chiunque di risalire alla fonte.",
      en: "The reference to the source file, row or original document a record derives from, together with its editorial review status. It lets any reader trace a claim back to its source.",
    },
    category: "governance",
    seeAlso: "sources/",
  },
  {
    id: "caveat",
    term: { it: "Caveat (avvertenza)", en: "Caveat" },
    short: {
      it: "limite esplicito di ciò che una fonte dimostra",
      en: "explicit limit on what a source demonstrates",
    },
    definition: {
      it: "Nota che precisa cosa una relazione o un documento NON dimostra (ad esempio: un contatto o un contratto non provano controllo operativo o mandato politico).",
      en: "Note specifying what a relationship or document does NOT prove (for example, a contact or contract does not prove operational control or a political mandate).",
    },
    category: "method",
    seeAlso: "trace/",
  },
];

const BY_ID = new Map(GLOSSARY.map((entry) => [entry.id.toLowerCase(), entry]));

export function glossaryEntry(id: string): GlossaryEntry | undefined {
  return BY_ID.get(id.toLowerCase());
}

export function sortedGlossary(lang: Language): GlossaryEntry[] {
  return [...GLOSSARY].sort((a, b) =>
    a.term[lang].localeCompare(b.term[lang], lang === "it" ? "it-IT" : "en-GB"),
  );
}

/**
 * Pure helper to track first occurrence of glossary terms within a document/page render.
 */
export function firstOccurrenceTracker() {
  const seen = new Set<string>();
  return {
    isFirst(id: string): boolean {
      const key = id.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    },
    reset() {
      seen.clear();
    },
  };
}

/**
 * Clean technical export labels and raw file-path details for human readers.
 */
export function cleanExportLabel(label: string, lang: Language): string {
  if (label === "Scheda in JSON (pacchetto del record)") {
    return lang === "it" ? "Scheda completa (dati strutturati)" : "Full record (structured data)";
  }
  if (label === "Record as JSON (record package)") {
    return "Full record (structured data)";
  }
  return label;
}

export function cleanExportDetail(detail: string | undefined, lang: Language): string | undefined {
  if (!detail) return undefined;
  if (/^records\/[A-Za-z0-9_-]+\.json$/.test(detail)) {
    return lang === "it"
      ? "File JSON scaricabile con fonti e revisione"
      : "Downloadable JSON file with sources and review";
  }
  return detail;
}
