import {
  RELATIONSHIP_EVIDENCE_LEVELS,
  type RelationGroup,
  type Relationship,
} from "../model/index.ts";
import { type ReadModel, relationGroup } from "./read-model.ts";
import { RELATION_GROUP_ORDER } from "./visual.ts";

/**
 * Matrice dei ruoli (B19, FABLE C §5.4) of one node: its public relationships
 * counted by existing relation group (rows) and evidence level (columns). No
 * new role class is introduced: the participation row lists the literal
 * predicates instead of classifying them. Every count carries its
 * denominator (`total`) and the period covered by the linked events.
 */

type Level = (typeof RELATIONSHIP_EVIDENCE_LEVELS)[number];

export type RoleRow = { group: RelationGroup; total: number; byLevel: Record<Level, number> };

export type RoleMatrix = {
  total: number;
  rows: RoleRow[];
  byLevel: Record<Level, number>;
  /** Literal predicates of participation relationships, most frequent first. */
  predicates: { predicate: string; count: number }[];
  /**
   * Restricted relationships (named person without a registered primary
   * source): counted by level only, never by group or predicate, as on the
   * entity page.
   */
  restricted: number;
  /** Span of the start dates of linked events; null when no relationship links an event. */
  period: { from: string; to: string } | null;
  /** Relationships with no linked event, outside `period`. */
  undated: number;
};

const zero = (): Record<Level, number> =>
  Object.fromEntries(RELATIONSHIP_EVIDENCE_LEVELS.map((l) => [l, 0])) as Record<Level, number>;

/** Event IDs a relationship is tied to: its `events` and an event endpoint. */
function linkedEvents(model: ReadModel, r: Relationship): string[] {
  const ends = [r.subject, r.object].filter((id) => model.event(id));
  return [...new Set([...r.events, ...ends])];
}

export function roleMatrix(model: ReadModel, nodeId: string): RoleMatrix {
  const relationships = model.relationshipsOf(nodeId);
  const rows = new Map<RelationGroup, RoleRow>();
  const byLevel = zero();
  const predicates = new Map<string, number>();
  let restricted = 0;
  let undated = 0;
  const dates: string[] = [];
  for (const r of relationships) {
    byLevel[r.evidence_level] += 1;
    const starts = linkedEvents(model, r).flatMap((id) => model.event(id)?.date.start ?? []);
    if (starts.length === 0) undated += 1;
    dates.push(...starts);
    if (model.isRestricted(r)) {
      restricted += 1;
      continue;
    }
    const group = relationGroup(r);
    const row = rows.get(group) ?? { group, total: 0, byLevel: zero() };
    row.total += 1;
    row.byLevel[r.evidence_level] += 1;
    rows.set(group, row);
    if (group === "participation")
      predicates.set(r.predicate, (predicates.get(r.predicate) ?? 0) + 1);
  }
  dates.sort();
  const from = dates[0];
  const to = dates.at(-1);
  return {
    total: relationships.length,
    rows: RELATION_GROUP_ORDER.flatMap((g) => rows.get(g) ?? []),
    byLevel,
    predicates: [...predicates]
      .map(([predicate, count]) => ({ predicate, count }))
      .sort((a, b) => b.count - a.count || a.predicate.localeCompare(b.predicate)),
    restricted,
    period: from && to ? { from, to } : null,
    undated,
  };
}
