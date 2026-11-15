import { shortestPath } from "../audit/baseline.ts";
import {
  activePairKeys,
  CAVEAT_CATEGORIES,
  type CaveatCategory,
  type InferenceRegistry,
  pairKey,
} from "../editorial/inferences.ts";
import type { Dataset, LocalizedText } from "../model/index.ts";
import { evidenceGraph, type ReadModel } from "./read-model.ts";

/**
 * B15 counter-inference audit (FABLE A §A7, E4): for every sensitive pair —
 * the endpoints of each public hypothesis and each public forbidden pair — the
 * shortest path in the public evidence graph is annotated when it crosses a
 * relationship whose caveat interrupts composition, or when the pair itself is
 * a forbidden inference. Only public records are named; registry entries that
 * reference withheld records are counted, never listed.
 */

export const CATEGORY_DEFINITIONS: Record<
  CaveatCategory,
  { label: LocalizedText; definition: LocalizedText }
> = {
  claim_negation: {
    label: { it: "Negazione del claim", en: "Claim negation" },
    definition: {
      it: "Il caveat nega proprio l'affermazione che un lettore ricaverebbe dalla relazione o da un cammino che la attraversa.",
      en: "The caveat denies the very statement a reader would draw from the relationship or from a path through it.",
    },
  },
  transitivity_limit: {
    label: { it: "Limite alla transitività", en: "Transitivity limit" },
    definition: {
      it: "La relazione esiste, ma non si estende ad altri membri, episodi o attori, né a un legame più forte (comando, alleanza, controllo, mandato).",
      en: "The relationship holds but does not extend to other members, episodes or actors, nor to a stronger link (command, alliance, control, mandate).",
    },
  },
  denial: {
    label: { it: "Smentita", en: "Denial" },
    definition: {
      it: "Un soggetto coinvolto nega il fatto o l'attribuzione; la smentita è una posizione, non una prova contraria.",
      en: "A party involved denies the fact or the attribution; a denial is a position, not contrary evidence.",
    },
  },
  not_established: {
    label: { it: "Non stabilito", en: "Not established" },
    definition: {
      it: "Un elemento del fatto (autore, mandante, dolo, effetto, stato giuridico) non è stabilito allo stato attuale.",
      en: "An element of the fact (author, principal, intent, effect, legal status) is not established at present.",
    },
  },
  reported_position: {
    label: { it: "Posizione riferita", en: "Reported position" },
    definition: {
      it: "La fonte riferisce l'attribuzione, l'accusa o la stima di un altro soggetto, non un fatto accertato dal corpus.",
      en: "The source reports another party's attribution, charge or estimate, not a fact established by the corpus.",
    },
  },
  scope_precision: {
    label: { it: "Precisione di portata", en: "Scope precision" },
    definition: {
      it: "La negazione precisa tempo, quantità o portata della relazione; non limita da sola la composizione.",
      en: "The negation specifies time, quantity or scope of the relationship; by itself it does not limit composition.",
    },
  },
};

export const INTERRUPT_RULE: LocalizedText = {
  it: "Una relazione interrompe la composizione quando il suo caveat dice che non autorizza l'affermazione che un cammino attraverso di essa produrrebbe: il claim negato, l'estensione ad altri membri, episodi o a un legame più forte, oppure l'elemento mancante (autore, mandante, dolo, denaro, effetto) che il cammino fornirebbe. È un giudizio per relazione: la sola parola «non» non basta.",
  en: "A relationship interrupts composition when its caveat says it does not license the statement a path through it would produce: the negated claim, an extension to other members, episodes or a stronger link, or the missing element (author, principal, intent, money, effect) the path would supply. It is a per-relationship judgement: the word “not” alone is not enough.",
};

export const AUTHORITY_RULE: LocalizedText = {
  it: "Un'inferenza è vietata solo se la dichiara una fonte citata o il manutentore; non scade automaticamente e decade solo quando il manutentore la ritira citando una fonte nuova. Gli agenti possono solo proporre voci.",
  en: "An inference is forbidden only when a cited source or the maintainer declares it; it does not expire automatically and lapses only when the maintainer lifts it citing a new source. Agents may only propose entries.",
};

export type PathStep = {
  relationship: string;
  subject: string;
  predicate: string;
  object: string;
  caveat: LocalizedText | null;
  categories: CaveatCategory[];
  interrupts_composition: boolean;
  classification_state: "proposta" | "revisionata" | null;
};

export type PathAnnotation = {
  origin: { kind: "hypothesis" | "forbidden_inference"; id: string };
  pair: [string, string];
  hypotheses: string[];
  path: PathStep[];
  interrupted_at: string[];
  forbidden_by: string[];
};

export type PublicForbiddenInference = Omit<
  InferenceRegistry["forbidden_inferences"][number],
  "proposed_by" | "note"
>;

export type CounterInferenceAudit = {
  registry_version: 1;
  authority_rule: LocalizedText;
  interrupt_rule: LocalizedText;
  categories: { id: CaveatCategory; label: LocalizedText; definition: LocalizedText }[];
  review_note: LocalizedText;
  forbidden_inferences: PublicForbiddenInference[];
  forbidden_inferences_not_public: number;
  caveat_classifications: {
    relationship: string;
    categories: CaveatCategory[];
    interrupts_composition: boolean;
    state: "proposta" | "revisionata";
  }[];
  audit: {
    graph: string;
    pairs_audited: number;
    pairs_with_path: number;
    paths_flagged: number;
  };
  flagged_paths: PathAnnotation[];
};

function publicIds(dataset: Dataset): Set<string> {
  return new Set(
    (Object.keys(dataset) as (keyof Dataset)[]).flatMap((name) => dataset[name].map((r) => r.id)),
  );
}

type PublicEntry = InferenceRegistry["forbidden_inferences"][number];

/** Registry entries whose every ID is public (unreviewed proposals also name no person). */
function publicEntriesOf(registry: InferenceRegistry, dataset: Dataset): PublicEntry[] {
  const visible = publicIds(dataset);
  const persons = new Set(dataset.entities.filter((e) => e.kind === "person").map((e) => e.id));
  const hypothesisNodes = new Map(dataset.hypotheses.map((h) => [h.id, [h.subject, h.object]]));
  const isPublic = (entry: PublicEntry) => {
    const ids = [
      ...entry.pairs.flat(),
      ...entry.hypotheses,
      entry.declared_by.source,
      entry.declared_by.record,
    ];
    if (!ids.every((id) => id === null || visible.has(id))) return false;
    if (entry.state === "revisionata") return true;
    // Unreviewed proposals stay private when they name no canonical node (free
    // text about actors) or touch a named person (AGENTS.md rule 7).
    if (entry.pairs.length === 0) return false;
    const touched = [
      ...entry.pairs.flat(),
      ...entry.hypotheses.flatMap((h) => hypothesisNodes.get(h) ?? []),
    ];
    return !touched.some((id) => persons.has(id));
  };
  return registry.forbidden_inferences.filter(isPublic);
}

/**
 * Every sensitive pair of the audit with its shortest path in the public
 * graph (`path` is empty when the endpoints are not connected). Shared by the
 * counter-inference audit (flagged pairs only) and the B16 traces (all pairs),
 * so path finding and caveat classification exist once.
 */
export function auditedPairs(registry: InferenceRegistry, model: ReadModel): PathAnnotation[] {
  const dataset = model.dataset;
  const graph = evidenceGraph(model);
  const edges = new Map(graph.edges.map((e) => [e.id, e]));
  const classes = new Map(registry.caveat_classifications.map((c) => [c.relationship, c]));
  const active = activePairKeys(registry);
  const publicEntries = publicEntriesOf(registry, dataset);
  const publicActive = new Map(
    [...active].map(([key, ids]) => [
      key,
      ids.filter((id) => publicEntries.some((e) => e.id === id)),
    ]),
  );

  const pairs: {
    origin: PathAnnotation["origin"];
    pair: [string, string];
    hypotheses: string[];
  }[] = [];
  for (const h of [...dataset.hypotheses].sort((a, b) => a.id.localeCompare(b.id))) {
    pairs.push({
      origin: { kind: "hypothesis", id: h.id },
      pair: [h.subject, h.object],
      hypotheses: [h.id],
    });
  }
  const seen = new Map(pairs.map((p) => [pairKey(p.pair[0], p.pair[1]), p]));
  for (const entry of publicEntries) {
    if (entry.lifted) continue;
    for (const pair of entry.pairs) {
      const key = pairKey(pair[0], pair[1]);
      const existing = seen.get(key);
      if (existing) {
        existing.hypotheses = [...new Set([...existing.hypotheses, ...entry.hypotheses])].sort();
        continue;
      }
      const record = {
        origin: { kind: "forbidden_inference" as const, id: entry.id },
        pair,
        hypotheses: [...entry.hypotheses],
      };
      pairs.push(record);
      seen.set(key, record);
    }
  }

  return pairs.map(({ origin, pair, hypotheses }) => {
    const ids =
      shortestPath(
        graph.edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
        pair[0],
        pair[1],
      ) ?? [];
    const path = ids.map((id): PathStep => {
      const edge = edges.get(id);
      const c = classes.get(id);
      if (!edge) throw new Error(`edge ${id} missing from the evidence graph`);
      return {
        relationship: id,
        subject: edge.source,
        predicate: edge.predicate,
        object: edge.target,
        caveat: edge.caveat,
        categories: c?.categories ?? [],
        interrupts_composition: c?.interrupts_composition ?? false,
        classification_state: c?.state ?? null,
      };
    });
    return {
      origin,
      pair,
      hypotheses,
      path,
      interrupted_at: path.filter((s) => s.interrupts_composition).map((s) => s.relationship),
      forbidden_by: publicActive.get(pairKey(pair[0], pair[1])) ?? [],
    };
  });
}

export function counterInferenceAudit(
  registry: InferenceRegistry,
  model: ReadModel,
): CounterInferenceAudit {
  const dataset = model.dataset;
  const publicEntries = publicEntriesOf(registry, dataset);
  const pairs = auditedPairs(registry, model);
  const withPath = pairs.filter((p) => p.path.length > 0);
  const flagged = withPath.filter((p) => p.interrupted_at.length > 0 || p.forbidden_by.length > 0);

  const relationships = new Set(dataset.relationships.map((r) => r.id));
  const reviewed = [...registry.forbidden_inferences, ...registry.caveat_classifications].filter(
    (e) => e.state === "revisionata",
  ).length;
  return {
    registry_version: 1,
    authority_rule: AUTHORITY_RULE,
    interrupt_rule: INTERRUPT_RULE,
    categories: CAVEAT_CATEGORIES.map((id) => ({ id, ...CATEGORY_DEFINITIONS[id] })),
    review_note: {
      it: `Voci riviste dal manutentore: ${reviewed}. Le altre sono proposte non riviste: segnalano cautele già presenti nei record, non nuove affermazioni.`,
      en: `Entries reviewed by the maintainer: ${reviewed}. The others are unreviewed proposals: they point to cautions already present in the records, not new statements.`,
    },
    forbidden_inferences: publicEntries.map(({ proposed_by: _p, note: _n, ...rest }) => rest),
    forbidden_inferences_not_public: registry.forbidden_inferences.length - publicEntries.length,
    caveat_classifications: registry.caveat_classifications
      .filter((c) => relationships.has(c.relationship))
      .map((c) => ({
        relationship: c.relationship,
        categories: c.categories,
        interrupts_composition: c.interrupts_composition,
        state: c.state,
      })),
    audit: {
      graph:
        "public evidence graph (graph.json edges, undirected, participation included); deterministic shortest path",
      pairs_audited: pairs.length,
      pairs_with_path: withPath.length,
      paths_flagged: flagged.length,
    },
    flagged_paths: flagged,
  };
}

/** Flagged paths to show on a hypothesis page (its own pair and linked forbidden pairs). */
export function annotationsFor(
  audit: CounterInferenceAudit,
  hypothesisId: string,
): PathAnnotation[] {
  return audit.flagged_paths.filter((a) => a.hypotheses.includes(hypothesisId));
}

/** Public forbidden inferences linked to a hypothesis. */
export function forbiddenFor(
  audit: CounterInferenceAudit,
  hypothesisId: string,
): PublicForbiddenInference[] {
  return audit.forbidden_inferences.filter((e) => e.hypotheses.includes(hypothesisId));
}
