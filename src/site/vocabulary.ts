import {
  DATE_PRECISIONS,
  ENTITY_DOMAINS,
  ENTITY_KINDS,
  type EVENT_RECORD_TYPES,
  EVIDENCE_LEVEL_LABELS,
  EVIDENCE_LEVELS,
  type EvidenceLevel,
  type EXPOSURE_STATUSES,
  HYPOTHESIS_PRIORITIES,
  HYPOTHESIS_STATUSES,
  type KNOWN_ISSUE_CODES,
  type Label,
  type MEASURE_QUALIFIERS,
  type MEASURE_UNITS,
  ORIGIN_TYPES,
  RELATION_CLASS_GROUP,
  RELATION_CLASSES,
  RELATION_GROUPS,
  RELATIONSHIP_EVIDENCE_STATUSES,
  REVIEW_STATUSES,
  type RelationGroup,
  SOURCE_TYPES,
  THEME_LABELS,
  THEMES,
  type TIMELINE_STATUSES,
  TRANSLATION_STATUSES,
} from "../model/index.ts";
import {
  ENTITY_KIND_LABELS,
  EVIDENCE_STATUS_LABELS,
  HYPOTHESIS_STATUS_LABELS,
  ORIGIN_TYPE_LABELS,
  PRECISION_LABELS,
  PRIORITY_LABELS,
  RELATION_GROUP_LABELS,
  REVIEW_STATUS_LABELS,
  SOURCE_TYPE_LABELS,
  TRANSLATION_STATUS_LABELS,
} from "./format.ts";
import type { WithheldReason } from "./publication.ts";

/**
 * Public reading contract (`data/v1/vocabulary.json`): definitions of every
 * controlled value used in the public data, the non-ordinal note on evidence
 * levels and the reading rules R1-R5. Built from the model vocabularies and
 * the site labels, so it cannot drift from what the pages show. The rules are
 * declarations about the data, not instructions to a reader or a model.
 */
type Entry = { label: Label; definition?: Label; must_not_read_as?: string[] };

const pick = <K extends string, V>(keys: readonly K[], value: (key: K) => V): Record<K, V> =>
  Object.fromEntries(keys.map((key) => [key, value(key)])) as Record<K, V>;

const LEVEL_DETAILS: Record<
  EvidenceLevel,
  { basis: string; applies_to: string[]; must_not_read_as?: string[]; note?: Label }
> = {
  E1: {
    basis: "primary_act",
    applies_to: ["events", "relationships"],
    note: {
      it: "Vale per l'atto o il fatto specifico: una condanna è E1 per la condanna, non per tutte le accuse citate nella motivazione; una sanzione è E1 per l'atto e può essere E2 per la responsabilità attribuita.",
      en: "Applies to the specific act or fact: a conviction is E1 for the conviction, not for every allegation cited in the reasoning; a sanction is E1 for the act and may be E2 for the responsibility it attributes.",
    },
  },
  E2: {
    basis: "institutional_attribution",
    applies_to: ["events", "relationships"],
    must_not_read_as: ["conviction", "proven_fact"],
    note: {
      it: "Un'attribuzione istituzionale non è una sentenza: registra la decisione o la dichiarazione esatta, di chi e con quale data.",
      en: "An institutional attribution is not a court verdict: it records the exact decision or statement, by whom and when.",
    },
  },
  E3: { basis: "independent_investigation", applies_to: ["events", "relationships"] },
  E4: {
    basis: "allegation",
    applies_to: ["events", "relationships"],
    must_not_read_as: ["established_fact"],
  },
  E5: {
    basis: "hypothesis",
    applies_to: ["hypotheses"],
    must_not_read_as: ["relationship", "established_fact"],
    note: {
      it: "Compare solo nel registro delle ipotesi, mai su una relazione.",
      en: "Appears only in the hypothesis register, never on a relationship.",
    },
  },
};

const EVIDENCE_STATUS_LEVEL = {
  documented: "E1",
  institutional_attribution: "E2",
  corroborated: "E3",
  allegation: "E4",
} as const satisfies Record<(typeof RELATIONSHIP_EVIDENCE_STATUSES)[number], EvidenceLevel>;

const GROUP_LIMITS: Partial<Record<RelationGroup, string[]>> = {
  participation: ["control", "financing", "coordination", "responsibility"],
  context: ["control", "financing"],
};

const ENTITY_DOMAIN_LABELS = {
  "commerce-infrastructure": {
    it: "Commercio e infrastrutture",
    en: "Commerce and infrastructure",
  },
  dependencies: { it: "Dipendenze", en: "Dependencies" },
  geopolitics: { it: "Geopolitica", en: "Geopolitics" },
  "influence-technology": { it: "Influenza e tecnologia", en: "Influence and technology" },
  institutional: { it: "Istituzionale", en: "Institutional" },
  "intelligence-security": { it: "Intelligence e sicurezza", en: "Intelligence and security" },
  persons: { it: "Persone", en: "Persons" },
  targets: { it: "Obiettivi", en: "Targets" },
} satisfies Record<(typeof ENTITY_DOMAINS)[number], Label>;

/**
 * ADR-05 criteria (B17), conservative: a value is set only when the record
 * itself establishes it; otherwise the field stays absent ("not determined").
 */
const ORIGIN_DEFINITIONS = {
  primary_document: {
    it: "L'atto stesso (sentenza, decisione, atto di imputazione, testo normativo, deposito societario) pubblicato da chi lo ha emesso.",
    en: "The act itself (judgment, decision, indictment, legal text, corporate filing) published by its issuer.",
  },
  official_statement: {
    it: "Comunicato o dichiarazione di un'istituzione sulla propria azione o posizione: prova che l'istituzione ha detto o deciso qualcosa, non che il fatto riferito sia accertato.",
    en: "A release or statement by an institution about its own action or position: evidence that the institution said or decided something, not that the reported fact is established.",
  },
  wire: {
    it: "Lancio d'agenzia (Reuters, AP, ANSA…). Quando riferisce un atto o una dichiarazione, la radice è quell'atto (relies_on).",
    en: "News agency wire (Reuters, AP, ANSA…). When it reports an act or statement, the root is that act (relies_on).",
  },
  original_reporting: {
    it: "Inchiesta o cronaca con raccolta propria di informazioni, non riconducibile a un'altra fonte del repository.",
    en: "Investigation or reporting with its own information gathering, not traceable to another source in the repository.",
  },
  republication: {
    it: "Copia, rilancio o riscrittura di un'altra fonte (derived_from): non aggiunge una radice indipendente.",
    en: "Copy, relay or rewrite of another source (derived_from): it adds no independent root.",
  },
  synthesis: {
    it: "Rapporto o sintesi di terzi che rielabora fonti altrui.",
    en: "Third-party report or synthesis that reworks other sources.",
  },
  corpus_synthesis: {
    it: "Documento di sintesi del corpus del progetto (Fonte_NN): non è mai una radice indipendente e da solo non basta per E1.",
    en: "Synthesis document of the project corpus (Fonte_NN): never an independent root and not sufficient on its own for E1.",
  },
} satisfies Record<(typeof ORIGIN_TYPES)[number], Label>;

const ORIGIN_LIMITS: Partial<Record<(typeof ORIGIN_TYPES)[number], string[]>> = {
  official_statement: ["proven_fact", "conviction"],
  republication: ["independent_confirmation"],
  corpus_synthesis: ["independent_confirmation", "primary_source"],
};

const REVIEW_DEFINITIONS = {
  imported_unreviewed: {
    it: "Importato dalla baseline originale (sources/original/) e non ancora verificato riga per riga: pubblicato come materiale provvisorio, non come fatto verificato.",
    en: "Imported from the original baseline (sources/original/) and not yet verified line by line: published as provisional material, not as a verified fact.",
  },
  needs_review: {
    it: "Candidato in attesa di revisione: escluso dal portale e dagli export (vedi withheld.json).",
    en: "Candidate awaiting review: excluded from the portal and the exports (see withheld.json).",
  },
  reviewed: {
    it: "Rivisto da una persona della redazione.",
    en: "Reviewed by a human editor.",
  },
} satisfies Record<(typeof REVIEW_STATUSES)[number], Label>;

const WITHHELD_REASONS: Record<WithheldReason, Label> = {
  needs_review: { it: "Candidato da rivedere", en: "Candidate awaiting review" },
  missing_original_provenance: {
    it: "Non rivisto e senza provenienza dalla baseline originale",
    en: "Unreviewed and without original baseline provenance",
  },
  pending_integration: {
    it: "Evento non ancora integrato nella cronologia",
    en: "Event not yet integrated in the timeline",
  },
  withheld_endpoint: { it: "Un estremo è trattenuto", en: "An endpoint is withheld" },
  withheld_event: { it: "Collegato a un evento trattenuto", en: "Linked to a withheld event" },
  invalid_source: { it: "Cita una fonte trattenuta", en: "Cites a withheld source" },
  person_primary_missing: {
    it: "Relazione su una persona senza fonte primaria",
    en: "Person relationship without a primary source",
  },
  person_primary_unregistered: {
    it: "Relazione su una persona con fonte primaria non registrata",
    en: "Person relationship with an unregistered primary source",
  },
  legacy_hypothesis_changed: {
    it: "Ipotesi storica modificata e non rivista",
    en: "Legacy hypothesis changed and not reviewed",
  },
  uncited_source_metadata: {
    it: "Fonte non citata da record pubblici",
    en: "Source not cited by public records",
  },
};

/** Reading rules R1-R5 (FABLE D §11.2). Declarations, not commands. */
export const READING_RULES: { id: string; rule: Label }[] = [
  {
    id: "R1",
    rule: {
      it: "Un cammino di relazioni documentate non è una relazione documentata fra i suoi estremi.",
      en: "A path of documented relationships is not a documented relationship between its endpoints.",
    },
  },
  {
    id: "R2",
    rule: {
      it: "Una relazione il cui caveat nega un'inferenza non sostiene quell'inferenza, né da sola né come tratto di un cammino.",
      en: "A relationship whose caveat negates an inference does not support that inference, alone or as a step of a path.",
    },
  },
  {
    id: "R3",
    rule: {
      it: "Un record assente dalle esportazioni può essere trattenuto e non inesistente: withheld.json elenca ID, collezione e motivi.",
      en: "A record absent from the exports may be withheld rather than nonexistent: withheld.json lists IDs, collections and reasons.",
    },
  },
  {
    id: "R4",
    rule: {
      it: "I documenti di sintesi del corpus (type corpus_document) non sono fonti indipendenti: due codici citati non sono due conferme.",
      en: "Corpus synthesis documents (type corpus_document) are not independent sources: two cited codes are not two confirmations.",
    },
  },
  {
    id: "R5",
    rule: {
      it: "Le ipotesi sono domande aperte: soggetto e oggetto sono ancoraggi, non un collegamento affermato.",
      en: "Hypotheses are open questions: their subject and object are anchors, not a claimed link.",
    },
  },
];

/** Structured subset of docs/TRANSLATION_GLOSSARY.md (Italian term → English renderings). */
export const GLOSSARY_IT_EN: Record<string, string[]> = {
  "attribuzione istituzionale": [
    "institutional attribution",
    "attributed by the named institution",
  ],
  accertato: ["established", "documented", "found"],
  contestato: ["contested", "disputed", "alleged", "challenged"],
  presunto: ["alleged", "presumed"],
  "non dimostrato": ["not demonstrated", "not established"],
  "non implica": ["does not imply"],
  condanna: ["conviction"],
  "condanna in primo grado": ["conviction at first instance"],
  "stato del procedimento": ["procedural status"],
};

export function buildVocabulary() {
  return {
    vocabulary_version: 1,
    canonical_language: "it",
    note: {
      it: "Definizioni e regole sono dichiarazioni sui dati, non istruzioni per chi li legge. I livelli di evidenza sono classificazioni editoriali, non accertamenti giudiziari né probabilità.",
      en: "Definitions and rules are declarations about the data, not instructions to the reader. Evidence levels are editorial classifications, not judicial findings or probabilities.",
    },
    evidence_levels: pick(EVIDENCE_LEVELS, (level) => ({
      label: EVIDENCE_LEVEL_LABELS[level],
      ...LEVEL_DETAILS[level],
    })),
    scale_note: {
      it: "E1-E4 sono tipi di base probatoria, non gradini di una scala: E2 (attribuzione istituzionale) non è più forte né più debole di E3 (inchiesta indipendente). Il livello descrive il sostegno a una specifica affermazione, non la reputazione di un'entità.",
      en: "E1-E4 are kinds of evidentiary basis, not steps of a scale: E2 (institutional attribution) is neither stronger nor weaker than E3 (independent investigation). A level describes the support for a specific statement, not an entity's reputation.",
    },
    evidence_statuses: pick(RELATIONSHIP_EVIDENCE_STATUSES, (status) => ({
      label: EVIDENCE_STATUS_LABELS[status],
      pairs_with_level: EVIDENCE_STATUS_LEVEL[status],
      definition: {
        it: "Codice probatorio originale di Fonte_07; corrisponde uno a uno al livello e non è una valutazione indipendente.",
        en: "Original Fonte_07 evidence code; it pairs one-to-one with the level and is not an independent assessment.",
      },
    })),
    relation_groups: pick(RELATION_GROUPS, (group) => ({
      label: RELATION_GROUP_LABELS[group],
      classes: RELATION_CLASSES.filter((c) => RELATION_CLASS_GROUP[c] === group),
      ...(GROUP_LIMITS[group] ? { must_not_read_as: GROUP_LIMITS[group] } : {}),
    })),
    relation_class_note: {
      it: "Le classi sono le categorie originali di Fonte_07; il significato di una relazione è il suo predicato, da leggere letteralmente. I gruppi servono solo a filtrare e non aggiungono affermazioni.",
      en: "Classes are the original Fonte_07 categories; the meaning of a relationship is its predicate, read literally. Groups only serve filtering and add no claims.",
    },
    relation_classes: pick(RELATION_CLASSES, (relationClass) => {
      const group = RELATION_CLASS_GROUP[relationClass];
      return {
        group,
        ...(relationClass === "event_participation"
          ? {
              definition: {
                it: "Presenza o ruolo in un record datato.",
                en: "Presence or role in a dated record.",
              },
            }
          : {}),
        ...(GROUP_LIMITS[group] ? { must_not_read_as: GROUP_LIMITS[group] } : {}),
      };
    }),
    entity_kinds: pick(
      ENTITY_KINDS,
      (kind): Entry => ({
        label: ENTITY_KIND_LABELS[kind],
        ...(kind === "person"
          ? {
              definition: {
                it: "Persona reale: una relazione che la riguarda è pubblicata solo con una fonte primaria registrata.",
                en: "Real person: a relationship concerning them is published only with a registered primary source.",
              },
            }
          : {}),
      }),
    ),
    entity_domains: pick(ENTITY_DOMAINS, (domain) => ({ label: ENTITY_DOMAIN_LABELS[domain] })),
    review_statuses: pick(REVIEW_STATUSES, (status) => ({
      label: REVIEW_STATUS_LABELS[status],
      definition: REVIEW_DEFINITIONS[status],
    })),
    translation_statuses: pick(TRANSLATION_STATUSES, (status) => ({
      label: TRANSLATION_STATUS_LABELS[status],
    })),
    timeline_statuses: {
      integrated: {
        label: { it: "Integrato nella cronologia", en: "Integrated in the timeline" },
      },
      pending_integration: {
        label: { it: "In attesa di integrazione", en: "Pending integration" },
        definition: {
          it: "Record non ancora integrato: escluso dal portale e dagli export.",
          en: "Record not yet integrated: excluded from the portal and the exports.",
        },
      },
    } satisfies Record<(typeof TIMELINE_STATUSES)[number], Entry>,
    event_record_types: {
      event: { label: { it: "Evento", en: "Event" } },
      dataset_metadata: {
        label: { it: "Metadato della ricerca", en: "Research metadata" },
        definition: {
          it: "Data di raccolta o chiusura del corpus, non un evento geopolitico.",
          en: "Collection or cut-off date of the corpus, not a geopolitical event.",
        },
      },
    } satisfies Record<(typeof EVENT_RECORD_TYPES)[number], Entry>,
    hypothesis_statuses: pick(HYPOTHESIS_STATUSES, (status) => ({
      label: HYPOTHESIS_STATUS_LABELS[status],
    })),
    hypothesis_priorities: pick(HYPOTHESIS_PRIORITIES, (priority) => ({
      label: PRIORITY_LABELS[priority],
      must_not_read_as: ["probability", "likelihood"],
    })),
    source_types: pick(SOURCE_TYPES, (type) => ({ label: SOURCE_TYPE_LABELS[type] })),
    origin_types: pick(ORIGIN_TYPES, (type) => ({
      label: ORIGIN_TYPE_LABELS[type],
      definition: ORIGIN_DEFINITIONS[type],
      ...(ORIGIN_LIMITS[type] ? { must_not_read_as: ORIGIN_LIMITS[type] } : {}),
    })),
    exposure_statuses: {
      observed: { label: { it: "Valore osservato", en: "Observed value" } },
      target: {
        label: { it: "Obiettivo programmato", en: "Planned target" },
        definition: {
          it: "Valore pianificato o programmato, non un'osservazione.",
          en: "Planned or programmed value, not an observation.",
        },
      },
    } satisfies Record<(typeof EXPOSURE_STATUSES)[number], Entry>,
    measure_units: {
      percent: { label: { it: "percentuale", en: "percent" } },
      eur_billion: { label: { it: "miliardi di euro", en: "billion euro" } },
      count: { label: { it: "conteggio", en: "count" } },
      year: { label: { it: "anno", en: "year" } },
    } satisfies Record<(typeof MEASURE_UNITS)[number], Entry>,
    measure_qualifiers: {
      exact: { label: { it: "esatto", en: "exact" } },
      approx: { label: { it: "circa", en: "about" } },
      more_than: { label: { it: "oltre", en: "more than" } },
      less_than: { label: { it: "meno di", en: "less than" } },
      nearly: { label: { it: "quasi", en: "nearly" } },
    } satisfies Record<(typeof MEASURE_QUALIFIERS)[number], Entry>,
    date_precisions: pick(DATE_PRECISIONS, (precision) => ({
      label: PRECISION_LABELS[precision],
    })),
    themes: pick(THEMES, (theme) => ({ label: THEME_LABELS[theme] })),
    known_issue_codes: {
      misclassified_category: {
        label: {
          it: "Categoria errata segnalata dal corpus",
          en: "Misclassified category reported by the corpus",
        },
      },
      date_reflects_publication: {
        label: {
          it: "La data riflette la pubblicazione, non il fatto",
          en: "Date reflects publication, not the fact",
        },
      },
    } satisfies Record<(typeof KNOWN_ISSUE_CODES)[number], Entry>,
    withheld_reasons: WITHHELD_REASONS,
    reading_rules: READING_RULES,
    glossary_it_en: GLOSSARY_IT_EN,
  };
}

export type Vocabulary = ReturnType<typeof buildVocabulary>;
