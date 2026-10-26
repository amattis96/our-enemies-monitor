import {
  type Dataset,
  type Entity,
  type EntityKind,
  type Event,
  type Hypothesis,
  RELATION_CLASS_GROUP,
  type RelationGroup,
  type Relationship,
  type Source,
} from "../model/index.ts";
import { readDataFiles } from "../pipeline/load.ts";
import { validateDataFiles } from "../pipeline/validate.ts";

/**
 * Indexed, read-only view of the canonical data used to render the site.
 * Built once per build; all public-facing rules (restriction, ordering,
 * graph projections) live here so they are tested independently of the UI.
 */
export type ReadModel = {
  dataset: Dataset;
  /** Events sorted by start date, then ID. */
  events: Event[];
  event: (id: string) => Event | undefined;
  entity: (id: string) => Entity | undefined;
  source: (id: string) => Source | undefined;
  hypothesis: (id: string) => Hypothesis | undefined;
  /** Relationships where the node is subject or object. */
  relationshipsOf: (nodeId: string) => Relationship[];
  /** Direct relationships that cite the event in `events`. */
  relationshipsCiting: (eventId: string) => Relationship[];
  hypothesesOf: (nodeId: string) => Hypothesis[];
  /** Records of any collection that cite a source code. */
  citing: (sourceId: string) => {
    events: Event[];
    relationships: Relationship[];
    hypotheses: Hypothesis[];
  };
  isRestricted: (relationship: Relationship) => boolean;
  nodeLabel: (id: string) => string;
  nodeKind: (id: string) => EntityKind | "event" | undefined;
};

export function loadReadModel(): ReadModel {
  const { issues, dataset } = validateDataFiles(readDataFiles());
  const errors = issues.filter((i) => i.severity === "error");
  if (errors.length > 0) {
    const details = errors.slice(0, 10).map((e) => `${e.file}: ${e.message}`);
    throw new Error(`Invalid data, run pnpm validate:\n${details.join("\n")}`);
  }
  return buildReadModel(dataset);
}

export function buildReadModel(dataset: Dataset): ReadModel {
  const index = <T extends { id: string }>(records: T[]) => new Map(records.map((r) => [r.id, r]));
  const events = index(dataset.events);
  const entities = index(dataset.entities);
  const sources = index(dataset.sources);
  const hypotheses = index(dataset.hypotheses);

  const group = <T>(pairs: [string, T][]) => {
    const map = new Map<string, T[]>();
    for (const [key, value] of pairs) map.set(key, [...(map.get(key) ?? []), value]);
    return map;
  };
  const byNode = group(
    dataset.relationships.flatMap((r): [string, Relationship][] => [
      [r.subject, r],
      [r.object, r],
    ]),
  );
  const citingEvent = group(
    dataset.relationships
      .filter((r) => !isParticipation(r))
      .flatMap((r) => r.events.map((e): [string, Relationship] => [e, r])),
  );
  const hypothesesByNode = group(
    dataset.hypotheses.flatMap((h): [string, Hypothesis][] => [
      [h.subject, h],
      [h.object, h],
    ]),
  );
  const persons = new Set(dataset.entities.filter((e) => e.kind === "person").map((e) => e.id));

  return {
    dataset,
    events: [...dataset.events].sort(compareEvents),
    event: (id) => events.get(id),
    entity: (id) => entities.get(id),
    source: (id) => sources.get(id),
    hypothesis: (id) => hypotheses.get(id),
    relationshipsOf: (id) => byNode.get(id) ?? [],
    relationshipsCiting: (id) => citingEvent.get(id) ?? [],
    hypothesesOf: (id) => hypothesesByNode.get(id) ?? [],
    citing: (id) => ({
      events: dataset.events.filter((r) => r.sources.includes(id)),
      relationships: dataset.relationships.filter((r) => r.sources.includes(id)),
      hypotheses: dataset.hypotheses.filter((r) => r.sources.includes(id)),
    }),
    // Named-person relationships stay restricted until a primary source is linked.
    isRestricted: (r) =>
      r.primary_url === null && (persons.has(r.subject) || persons.has(r.object)),
    nodeLabel: (id) => entities.get(id)?.name.it ?? events.get(id)?.title.it ?? id,
    nodeKind: (id) => entities.get(id)?.kind ?? (events.has(id) ? "event" : undefined),
  };
}

export function isParticipation(relationship: Relationship): boolean {
  return relationGroup(relationship) === "participation";
}

export function relationGroup(relationship: Relationship): RelationGroup {
  return RELATION_CLASS_GROUP[relationship.relation_class];
}

function compareEvents(a: Event, b: Event): number {
  return a.date.start.localeCompare(b.date.start) || a.id.localeCompare(b.id);
}

// ---------------------------------------------------------------------------
// Graph projections (published as static JSON for the network view)

export type GraphNode = { id: string; label: string; kind: EntityKind | "event" };
export type GraphEdge = {
  id: string;
  source: string;
  target: string;
  predicate: string;
  group: RelationGroup;
  evidence_level: Relationship["evidence_level"];
};
export type Graph = { nodes: GraphNode[]; edges: GraphEdge[] };

/**
 * Evidence graph: every unrestricted relationship (participation included,
 * so the UI can toggle it). Hypotheses are never part of it.
 */
export function evidenceGraph(model: ReadModel): Graph {
  const edges = model.dataset.relationships
    .filter((r) => !model.isRestricted(r))
    .map((r) => ({
      id: r.id,
      source: r.subject,
      target: r.object,
      predicate: r.predicate,
      group: relationGroup(r),
      evidence_level: r.evidence_level,
    }));
  return { nodes: nodesOf(model, edges), edges };
}

export type HypothesisEdge = {
  id: string;
  source: string;
  target: string;
  hypothesis_type: string;
  priority: Hypothesis["priority"];
};

/** Exploratory graph of open hypotheses, published separately. */
export function hypothesisGraph(model: ReadModel): { nodes: GraphNode[]; edges: HypothesisEdge[] } {
  const edges = model.dataset.hypotheses.map((h) => ({
    id: h.id,
    source: h.subject,
    target: h.object,
    hypothesis_type: h.hypothesis_type,
    priority: h.priority,
  }));
  return { nodes: nodesOf(model, edges), edges };
}

function nodesOf(model: ReadModel, edges: { source: string; target: string }[]): GraphNode[] {
  const ids = [...new Set(edges.flatMap((e) => [e.source, e.target]))].sort();
  return ids.map((id) => ({ id, label: model.nodeLabel(id), kind: model.nodeKind(id) ?? "event" }));
}

// ---------------------------------------------------------------------------
// Timeline projection (props of the timeline island)

export type TimelineItem = {
  id: string;
  title: string;
  start: string;
  end: string | null;
  precision: Event["date"]["precision"];
  themes: Event["themes"];
  evidence_note: string | null;
  geography: string | null;
  pending: boolean;
  metadata: boolean;
};

export function timelineItems(model: ReadModel): TimelineItem[] {
  return model.events.map((e) => ({
    id: e.id,
    title: e.title.it,
    start: e.date.start,
    end: e.date.end,
    precision: e.date.precision,
    themes: e.themes,
    evidence_note: e.evidence_note?.it ?? null,
    geography: e.geography?.it ?? null,
    pending: e.timeline_status === "pending_integration",
    metadata: e.record_type === "dataset_metadata",
  }));
}
