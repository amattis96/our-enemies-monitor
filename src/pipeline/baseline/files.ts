/** The original baseline files (cutoff 2026-10-21), repository-relative. */

const DIR = "sources/original";
const F07 = `${DIR}/Fonte_07_Ragnatela_Attori_Interessi_Relazioni_Europa_2026-10-21`;

export const BASELINE_FILES = {
  timelineCsv: `${DIR}/Fonte_06_Timeline_Cronologica_Eventi_Documentati_Europa_2007-2026_2026-10-21.csv`,
  nodesCsv: `${F07}_nodi.csv`,
  edgesCsv: `${F07}_archi.csv`,
  hypothesesCsv: `${F07}_ipotesi.csv`,
  newEvidenceCsv: `${F07}_nuove_evidenze.csv`,
  graphml: `${F07}.graphml`,
} as const;

/** Corpus documents S00–S08 and the files that make them up. */
export const CORPUS_DOCUMENTS: Record<string, string[]> = {
  S00: [`${DIR}/Fonte_00_Dossier_Ragnatela_Interferenze_Geopolitiche_Europa_2026-10-20.md`],
  S01: [
    `${DIR}/Fonte_01_DeepSearch_01 - Attori, reti, finanziamenti e infiltrazioni politiche in Europa.md`,
  ],
  S02: [
    `${DIR}/Fonte_02_DeepSearch_02 - Manipolazione informativa, elezioni e società in Europa.md`,
  ],
  S03: [`${DIR}/Fonte_03_DeepSearch_03 - Guerra ibrida, sabotaggi e sicurezza europea.md`],
  S04: [
    `${DIR}/Fonte_04_DeepSearch_04 - Dominio industriale, energia e dipendenze strategiche dell’Europa.md`,
  ],
  S05: [
    `${DIR}/Fonte_05_DeepSearch_05 - Strategie globali, convergenze geopolitiche e conseguenze europee.md`,
  ],
  S06: [
    `${DIR}/Fonte_06_Timeline_Cronologica_Eventi_Documentati_Europa_2007-2026_2026-10-21.md`,
    BASELINE_FILES.timelineCsv,
  ],
  S07: [
    `${F07}.md`,
    BASELINE_FILES.nodesCsv,
    BASELINE_FILES.edgesCsv,
    BASELINE_FILES.hypothesesCsv,
    BASELINE_FILES.newEvidenceCsv,
    BASELINE_FILES.graphml,
  ],
  S08: [`${DIR}/Fonte_08_Consolidamento_Strategico_Europa_Minacce_Reti_Dipendenze_2026-10-21.md`],
};

/** Where the cited external reference registries live. */
export const REFERENCE_REGISTRIES = {
  /** `- **[F01] Publisher**, title, date: url` in Fonte_00 §17. */
  F: { document: "S00", file: CORPUS_DOCUMENTS.S00?.[0] ?? "" },
  /** `- **P01 | Publisher, title (date).** description url` in Fonte_08 §23.2. */
  P: { document: "S08", file: CORPUS_DOCUMENTS.S08?.[0] ?? "" },
} as const;
