import type { InferenceRegistry } from "../editorial/inferences.ts";
import {
  EVIDENCE_LEVELS,
  type EvidenceLevel,
  type LocalizedText,
  type RelationGroup,
} from "../model/index.ts";
import {
  auditedPairs,
  CATEGORY_DEFINITIONS,
  type CounterInferenceAudit,
  counterInferenceAudit,
  type PathStep,
  type PublicForbiddenInference,
} from "./inferences.ts";
import { evidenceGraph, type ReadModel } from "./read-model.ts";
import { EVIDENCE_SHORT } from "./visual.ts";

/**
 * B16 «Tracciato» (FABLE C §5.1): the path between two actors as an ordered
 * list with the caveat of every step, the steps where the chain is
 * interrupted, the open hypotheses on the same pair and a summary of what the
 * path does not say. Path finding and caveat classification are the B15 audit
 * (`auditedPairs`); this module only orders, summarises and words them.
 * Only the public evidence graph is used: restricted person relationships and
 * withheld records never appear.
 */

export type TraceStep = PathStep & {
  evidence_level: EvidenceLevel;
  group: RelationGroup;
};

export type TraceHypothesis = {
  id: string;
  question: LocalizedText;
  current_limit: LocalizedText;
};

export type NotSaidKind =
  | "no_path"
  | "chain"
  | "interruption"
  | "weakest"
  | "participation"
  | "hypothesis"
  | "forbidden"
  | "shortest_only";

export type NotSaid = {
  kind: NotSaidKind;
  text: LocalizedText;
  /** Record the statement is about (relationship, hypothesis or forbidden-inference ID). */
  ref: string | null;
  /** True when it rests on a classification that no human has reviewed. */
  unreviewed: boolean;
};

export type Trace = {
  /** Origin ID: the hypothesis (or public forbidden inference) the pair comes from. */
  id: string;
  origin: "hypothesis" | "forbidden_inference";
  pair: [string, string];
  steps: TraceStep[];
  /** Relationship IDs whose caveat interrupts composition, in path order. */
  interrupted_at: string[];
  weakest: { level: EvidenceLevel; count: number; total: number } | null;
  hypotheses: TraceHypothesis[];
  forbidden: PublicForbiddenInference[];
  not_said: NotSaid[];
};

/** Weakest link: the highest evidence code among the steps (E1 is strongest). */
export function weakestLink(levels: EvidenceLevel[]): Trace["weakest"] {
  if (levels.length === 0) return null;
  const rank = (l: EvidenceLevel) => EVIDENCE_LEVELS.indexOf(l);
  const weakest = levels.reduce((a, b) => (rank(b) > rank(a) ? b : a));
  return {
    level: weakest,
    count: levels.filter((l) => l === weakest).length,
    total: levels.length,
  };
}

const both = (it: string, en: string): LocalizedText => ({ it, en });

/** The «what this trace does not say» list, from the structure of the trace alone. */
export function notSaid(trace: Omit<Trace, "not_said">): NotSaid[] {
  const out: NotSaid[] = [];
  const add = (kind: NotSaidKind, text: LocalizedText, ref: string | null, unreviewed = false) =>
    out.push({ kind, text, ref, unreviewed });
  const n = trace.steps.length;

  if (n === 0) {
    add(
      "no_path",
      both(
        "Nel grafo pubblico non c'è alcun cammino fra i due estremi. Non significa che un legame non esista: significa che il corpus pubblico non ne documenta uno.",
        "The public graph has no path between the two ends. This does not mean no link exists: it means the public corpus documents none.",
      ),
      null,
    );
  } else if (n === 1) {
    add(
      "chain",
      both(
        "Il cammino è una sola relazione diretta: vale quanto dicono il suo predicato, il suo livello di evidenza e il suo caveat, non di più.",
        "The path is a single direct relationship: it holds as far as its predicate, evidence level and caveat say, no further.",
      ),
      null,
    );
  } else {
    add(
      "chain",
      both(
        `${n} relazioni documentate in fila non sono una relazione documentata fra gli estremi.`,
        `${n} documented relationships in a row are not a documented relationship between the ends.`,
      ),
      null,
    );
  }

  for (const step of trace.steps.filter((s) => s.interrupts_composition)) {
    const labels = (lang: "it" | "en") =>
      step.categories
        .map((c) => (CATEGORY_DEFINITIONS[c].label[lang] ?? "").toLowerCase())
        .join(", ");
    add(
      "interruption",
      both(
        `${step.relationship}: la catena si interrompe qui (${labels("it")}). Il passaggio non trasferisce il legame precedente a quello successivo.`,
        `${step.relationship}: the chain is interrupted here (${labels("en")}). The step does not carry the previous link over to the next.`,
      ),
      step.relationship,
      step.classification_state !== "revisionata",
    );
  }

  if (trace.weakest && n > 1) {
    const { level, count, total } = trace.weakest;
    const label = EVIDENCE_SHORT[level];
    add(
      "weakest",
      both(
        `Anello più debole: ${level} (${label.it.toLowerCase()}), ${count} passaggi su ${total}. Il cammino non è più solido del suo tratto meno solido.`,
        `Weakest link: ${level} (${label.en.toLowerCase()}), ${count} of ${total} steps. A path is no stronger than its weakest stretch.`,
      ),
      null,
    );
  }

  if (trace.steps.some((s) => s.group === "participation")) {
    add(
      "participation",
      both(
        "Il cammino passa per la partecipazione a un evento: partecipare allo stesso evento non è controllo, finanziamento né coordinamento.",
        "The path goes through participation in an event: taking part in the same event is not control, financing or coordination.",
      ),
      null,
    );
  }

  for (const h of trace.hypotheses) {
    add(
      "hypothesis",
      both(
        `${h.id}: ipotesi aperta (E5) sulla stessa coppia. Non è un fatto accertato né una relazione documentata, e il cammino qui sopra non la dimostra.`,
        `${h.id}: open hypothesis (E5) on the same pair. It is neither an established fact nor a documented relationship, and the path above does not demonstrate it.`,
      ),
      h.id,
    );
  }

  for (const f of trace.forbidden) {
    add(
      "forbidden",
      both(
        `${f.id}: inferenza vietata sulla coppia. Il cammino non la autorizza.`,
        `${f.id}: forbidden inference on the pair. The path does not license it.`,
      ),
      f.id,
      f.state !== "revisionata",
    );
  }

  if (n > 0) {
    add(
      "shortest_only",
      both(
        "È il cammino più breve nel grafo pubblico, non l'unico né il più solido. Le relazioni con restrizioni su persone non fanno parte del grafo pubblico: un altro cammino può esistere fuori da qui.",
        "It is the shortest path in the public graph, not the only one nor the strongest. Relationships restricted for named persons are not in the public graph: another path may exist outside it.",
      ),
      null,
    );
  }
  return out;
}

/**
 * One trace per sensitive pair of the B15 audit (hypothesis endpoints and
 * public forbidden pairs), in audit order. Pairs with no path in the public
 * graph still get a trace that says so.
 */
export function buildTraces(
  registry: InferenceRegistry,
  model: ReadModel,
  audit: CounterInferenceAudit = counterInferenceAudit(registry, model),
): Trace[] {
  const edges = new Map(evidenceGraph(model).edges.map((e) => [e.id, e]));
  const hypotheses = model.dataset.hypotheses;
  return auditedPairs(registry, model).map((annotation) => {
    const [a, b] = annotation.pair;
    const onPair = hypotheses
      .filter(
        (h) =>
          annotation.hypotheses.includes(h.id) ||
          (h.subject === a && h.object === b) ||
          (h.subject === b && h.object === a),
      )
      .sort((x, y) => x.id.localeCompare(y.id))
      .map(({ id, question, current_limit }) => ({ id, question, current_limit }));
    const steps = annotation.path.map((step): TraceStep => {
      const edge = edges.get(step.relationship);
      if (!edge) throw new Error(`edge ${step.relationship} missing from the evidence graph`);
      return { ...step, evidence_level: edge.evidence_level, group: edge.group };
    });
    const partial = {
      id: annotation.origin.id,
      origin: annotation.origin.kind,
      pair: annotation.pair,
      steps,
      interrupted_at: annotation.interrupted_at,
      weakest: weakestLink(steps.map((s) => s.evidence_level)),
      hypotheses: onPair,
      forbidden: audit.forbidden_inferences.filter((f) => annotation.forbidden_by.includes(f.id)),
    };
    return { ...partial, not_said: notSaid(partial) };
  });
}

export function traceFor(traces: Trace[], id: string): Trace | undefined {
  return traces.find((t) => t.id === id);
}
