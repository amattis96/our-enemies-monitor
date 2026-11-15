import {
  EXPOSURE_GROUP_KIND,
  EXPOSURE_GROUPS,
  type Exposure,
  type ExposureGroup,
  type ExposureGroupKind,
  type Label,
  type Measure,
} from "../model/index.ts";

/**
 * Filiera and before/after views of the exposures (B19, FABLE C §§5.3, 8.3).
 * Pure functions over the public exposures and their editorial `group` field.
 * Nothing here computes a new quantity: no difference, ratio or index. The
 * only derived reading is which stage is the most concentrated, and only
 * among stages that measure the same quantity (same unit and same label) with
 * exact values; a change of quantity between consecutive stages is reported
 * instead of being compared.
 */

export const EXPOSURE_GROUP_LABELS: Record<ExposureGroup, Label> = {
  rare_earth_magnets: { it: "Magneti alle terre rare", en: "Rare-earth magnets" },
  eu_gas: { it: "Gas nell'UE", en: "Gas in the EU" },
};

export const EXPOSURE_GROUP_KIND_LABELS: Record<ExposureGroupKind, Label> = {
  supply_chain: { it: "Filiera", en: "Supply chain" },
  before_after: { it: "Prima / dopo", en: "Before / after" },
};

export const EXPOSURE_GROUP_KIND_DEFINITIONS: Record<ExposureGroupKind, Label> = {
  supply_chain: {
    it: "Stadi consecutivi della stessa catena, dal più a monte (posizione 1). La sequenza è editoriale; stadi con grandezze diverse non si confrontano.",
    en: "Consecutive stages of the same chain, from the most upstream (position 1). The sequence is editorial; stages measuring different quantities are not compared.",
  },
  before_after: {
    it: "Record le cui due misure sono la stessa grandezza prima e dopo, nell'ordine delle misure. Nessuna differenza è calcolata.",
    en: "Records whose two measures are the same quantity before and after, in measure order. No difference is computed.",
  },
};

/** Not documented in the corpus for any chain (FABLE C §C4). */
export const CHAIN_GAPS: Label = {
  it: "fornitori alternativi, scorte, tempi di sostituzione",
  en: "alternative suppliers, stocks, substitution times",
};

export type ChainStage = {
  exposure: Exposure;
  measure: Measure;
  /** null for the first stage; false when the quantity changes from the previous stage. */
  sameQuantityAsPrevious: boolean | null;
};

export type SupplyChain = {
  id: ExposureGroup;
  kind: "supply_chain";
  stages: ChainStage[];
  /** IDs of the most concentrated stage(s) among comparable exact stages; empty when none. */
  mostConcentrated: string[];
  /** Number of comparable stages behind `mostConcentrated` (its denominator). */
  comparedStages: number;
};

export type BeforeAfter = { exposure: Exposure; before: Measure; after: Measure };

export type BeforeAfterGroup = { id: ExposureGroup; kind: "before_after"; pairs: BeforeAfter[] };

export type ExposureGroupView = SupplyChain | BeforeAfterGroup;

const quantityKey = (m: Measure) => `${m.unit}\u0000${m.label.it}`;

/** Most concentrated stage among the largest set of stages measuring the same quantity. */
function mostConcentrated(stages: ChainStage[]): { ids: string[]; compared: number } {
  const byQuantity = new Map<string, ChainStage[]>();
  for (const stage of stages) {
    const key = quantityKey(stage.measure);
    byQuantity.set(key, [...(byQuantity.get(key) ?? []), stage]);
  }
  const [largest] = [...byQuantity.values()].sort((a, b) => b.length - a.length);
  if (!largest || largest.length < 2 || largest[0]?.measure.unit !== "percent")
    return { ids: [], compared: 0 };
  if (largest.some((s) => s.measure.qualifier !== "exact")) return { ids: [], compared: 0 };
  const max = Math.max(...largest.map((s) => s.measure.value));
  return {
    ids: largest.filter((s) => s.measure.value === max).map((s) => s.exposure.id),
    compared: largest.length,
  };
}

export function exposureGroupViews(exposures: readonly Exposure[]): ExposureGroupView[] {
  const views: ExposureGroupView[] = [];
  for (const id of EXPOSURE_GROUPS) {
    const members = exposures
      .filter((x) => x.group?.id === id)
      .sort((a, b) => (a.group?.position ?? 0) - (b.group?.position ?? 0));
    if (members.length < 2) continue;
    if (EXPOSURE_GROUP_KIND[id] === "supply_chain") {
      const stages = members.flatMap((exposure, i): ChainStage[] => {
        const measure = exposure.measures[0];
        if (!measure) return [];
        const previous = members[i - 1]?.measures[0];
        const same = previous ? quantityKey(previous) === quantityKey(measure) : null;
        return [{ exposure, measure, sameQuantityAsPrevious: same }];
      });
      const top = mostConcentrated(stages);
      views.push({
        id,
        kind: "supply_chain",
        stages,
        mostConcentrated: top.ids,
        comparedStages: top.compared,
      });
    } else {
      const pairs = members.flatMap((exposure): BeforeAfter[] => {
        const [before, after] = exposure.measures;
        return before && after ? [{ exposure, before, after }] : [];
      });
      views.push({ id, kind: "before_after", pairs });
    }
  }
  return views;
}
