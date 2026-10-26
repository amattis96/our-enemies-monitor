import type { Exposure, Measure } from "../../model/index.ts";

/**
 * Editorial transcription of the exposure matrix in Fonte_08 §12.2. Each row
 * is located by its table line (the importer checks that the line starts
 * with the sector), the original line is kept as provenance, and every
 * measure keeps the source's qualifier ("circa", "oltre", "quasi"). Periods
 * are recorded only where the row states them.
 */
type Row = {
  id: string;
  line: number;
  sector: string;
  status: Exposure["status"];
  measures: {
    label: string;
    value: number;
    unit: Measure["unit"];
    qualifier: Measure["qualifier"];
    out_of?: number;
    period?: string;
  }[];
};

const m = (
  label: string,
  value: number,
  unit: Measure["unit"],
  qualifier: Measure["qualifier"],
  extra: { out_of?: number; period?: string } = {},
) => ({ label, value, unit, qualifier, ...extra });

export const EXPOSURE_ROWS = [
  {
    id: "X-001",
    line: 572,
    sector: "Magneti alle terre rare destinati all'UE",
    status: "observed",
    measures: [
      m("Domanda UE di magneti coperta da importazioni dalla Cina", 98, "percent", "exact"),
    ],
  },
  {
    id: "X-002",
    line: 573,
    sector: "Terre rare magnetiche, raffinazione",
    status: "observed",
    measures: [
      m("Quota cinese della produzione mondiale", 91, "percent", "exact", { period: "2024" }),
    ],
  },
  {
    id: "X-003",
    line: 574,
    sector: "Magneti permanenti sinterizzati",
    status: "observed",
    measures: [
      m("Quota cinese della produzione mondiale", 94, "percent", "exact", { period: "2024" }),
    ],
  },
  {
    id: "X-004",
    line: 575,
    sector: "Terre rare magnetiche, estrazione",
    status: "observed",
    measures: [
      m("Quota cinese della produzione mondiale", 60, "percent", "exact", { period: "2024" }),
    ],
  },
  {
    id: "X-005",
    line: 576,
    sector: "Minerali energetici strategici",
    status: "observed",
    measures: [
      m("Categorie IEA in cui la Cina è primo raffinatore", 19, "count", "exact", { out_of: 20 }),
    ],
  },
  {
    id: "X-006",
    line: 577,
    sector: "Celle di batterie",
    status: "observed",
    measures: [
      m("Quota cinese della produzione mondiale", 80, "percent", "more_than", { period: "2025" }),
    ],
  },
  {
    id: "X-007",
    line: 578,
    sector: "Materiali catodici / anodici",
    status: "observed",
    measures: [
      m("Quota cinese dei materiali catodici", 85, "percent", "approx"),
      m("Quota cinese dei materiali anodici", 90, "percent", "more_than"),
    ],
  },
  {
    id: "X-008",
    line: 579,
    sector: "Farmaceutica / API chimici",
    status: "observed",
    measures: [
      m("Siti di API chimici usati nell'UE situati fuori dall'UE", 75, "percent", "approx"),
    ],
  },
  {
    id: "X-009",
    line: 580,
    sector: "Semiconduttori UE",
    status: "observed",
    measures: [m("Quota UE del mercato mondiale", 9, "percent", "approx", { period: "2024-2026" })],
  },
  {
    id: "X-010",
    line: 581,
    sector: "Consumo e import di semiconduttori UE",
    status: "observed",
    measures: [
      m("Consumo UE di semiconduttori", 55, "eur_billion", "approx", { period: "2024" }),
      m("Importazioni UE di semiconduttori", 43.6, "eur_billion", "approx"),
    ],
  },
  {
    id: "X-011",
    line: 582,
    sector: "Gas russo / domanda UE",
    status: "observed",
    measures: [
      m("Quota russa della domanda di gas UE", 40, "percent", "nearly", { period: "2021" }),
      m("Quota russa della domanda di gas UE", 10, "percent", "approx", { period: "2025" }),
    ],
  },
  {
    id: "X-012",
    line: 583,
    sector: "LNG / offerta UE di gas",
    status: "observed",
    measures: [
      m("Quota LNG nell'offerta di gas UE (prima)", 20, "percent", "less_than"),
      m("Quota LNG nell'offerta di gas UE (dopo)", 45, "percent", "nearly"),
    ],
  },
  {
    id: "X-013",
    line: 584,
    sector: "Connettività satellitare sovrana",
    status: "target",
    measures: [
      m("IRIS²: primi lanci previsti", 2029, "year", "exact"),
      m("IRIS²: avvio dei servizi previsto", 2030, "year", "exact"),
    ],
  },
  {
    id: "X-014",
    line: 585,
    sector: "Porti UE",
    status: "observed",
    measures: [m("Porti UE con partecipazioni o gestione cinese", 14, "count", "exact")],
  },
] as const satisfies readonly Row[];
