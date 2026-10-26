import type { KnownIssue } from "../../model/index.ts";

/**
 * Normalization anomalies already reported by the corpus itself
 * (Fonte_07 §11, Fonte_08 §20.2). They are recorded on the affected events,
 * not silently corrected: fixing them is an editorial task.
 */
export const KNOWN_ISSUES: Record<string, KnownIssue[]> = {
  "TL-0113": [
    {
      code: "date_reflects_publication",
      note: {
        it: "Rokh Solis è datato 2026-06 (pubblicazione del rapporto VIGINUM), ma le municipali francesi si sono svolte nel marzo 2026: separare data dell'evento e data di pubblicazione.",
      },
      reported_in: ["S07", "S08"],
    },
  ],
  "TL-0035": [
    {
      code: "misclassified_category",
      note: {
        it: "Alert MI5/Christine Lee classificato «Cyber / spionaggio»: riclassificare come interferenza politica/intelligence, mantenendo l'attribuzione MI5.",
      },
      reported_in: ["S07", "S08"],
    },
  ],
  "TL-0048": [
    {
      code: "misclassified_category",
      note: {
        it: "Mandati della CPI classificati «Spyware / diritti»: riclassificare come giustizia internazionale/diplomazia.",
      },
      reported_in: ["S07", "S08"],
    },
  ],
};

/** Timeline rows that are dataset metadata, not geopolitical events. */
export const DATASET_METADATA_EVENTS = new Set(["TL-0147"]);
