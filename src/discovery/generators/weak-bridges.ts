import type { CanonicalPredicateId } from "../../claims/canonical-predicates.ts";
import { activePairKeys, pairKey } from "../../editorial/inferences.ts";
import type { Entity, Event, Relationship } from "../../model/index.ts";
import type { DiscoveryGenerator, GeneratedCandidate, GeneratorContext } from "./interface.ts";
import {
  buildEligibleMappedRelationships,
  buildNodeMap,
  type GeneratorDeps,
  makeCandidate,
  resolveGeneratorDeps,
  resolveNodeLabel,
} from "./open-triads.ts";

export const GRAPH_ALGORITHM_PURPOSES = [
  "weak_bridge",
  "weak_bridge_structural",
  "attribution_trace",
] as const;
export type GraphAlgorithmPurpose = (typeof GRAPH_ALGORITHM_PURPOSES)[number];

const PARTICIPATION_OR_POLITICAL_PREDICATES = new Set<CanonicalPredicateId>([
  "PARTICIPATED_IN",
  "CO_PRESENT_AT",
  "POLITICALLY_SUPPORTED",
  "ACCUSED_OF",
]);

const STRUCTURAL_PREDICATES = new Set<CanonicalPredicateId>([
  "CONTROLLED",
  "OWNED",
  "FUNDED",
  "COMMISSIONED",
  "SUPPLIED",
]);

/**
 * Predicate- and purpose-driven generic-node exclusion.
 * Never excludes a node by `entity.kind` alone: a `state` or `institution`
 * node is excluded as a generic hub for participation/political predicates in
 * `weak_bridge` discovery, but retained for structural predicates or
 * `attribution_trace` / `weak_bridge_structural` purposes.
 */
export function shouldExcludeGenericNode(input: {
  node: Entity | Event | undefined;
  predicate: CanonicalPredicateId;
  purpose: GraphAlgorithmPurpose;
  degree: number;
  hubThreshold?: number;
}): boolean {
  const { node, predicate, purpose, degree } = input;
  const hubThreshold = input.hubThreshold ?? 4;
  if (!node) return true;

  // Attribution traces never drop institutional/state nodes by kind.
  if (purpose === "attribution_trace") return false;

  // Structural bridge analysis retains state/institution nodes for structural predicates.
  if (purpose === "weak_bridge_structural" && STRUCTURAL_PREDICATES.has(predicate)) {
    return false;
  }

  // For participation/political/accusation predicates in weak_bridge discovery,
  // high-degree state/institution/geopolitics hubs create spurious bridges.
  if (PARTICIPATION_OR_POLITICAL_PREDICATES.has(predicate)) {
    const isMacroActor =
      "kind" in node &&
      (node.kind === "state" || node.kind === "institution") &&
      (node.domain === "geopolitics" || node.domain === "institutional" || degree >= hubThreshold);
    if (isMacroActor) return true;
  }

  // For supply/economic predicates, exclude ultra-high-degree generic hubs only when degree is excessive.
  if (predicate === "SUPPLIED" && degree >= hubThreshold * 3) {
    return true;
  }

  return false;
}

function findBridgeEdges(
  nodes: readonly string[],
  edges: readonly { id: string; u: string; v: string }[],
): { id: string; u: string; v: string }[] {
  const adj = new Map<string, { to: string; edgeId: string }[]>();
  for (const n of nodes) adj.set(n, []);
  for (const e of edges) {
    adj.get(e.u)?.push({ to: e.v, edgeId: e.id });
    adj.get(e.v)?.push({ to: e.u, edgeId: e.id });
  }

  const visited = new Set<string>();
  const tin = new Map<string, number>();
  const low = new Map<string, number>();
  let timer = 0;
  const bridgeIds = new Set<string>();

  function dfs(v: string, parentEdgeId: string | null): void {
    visited.add(v);
    timer += 1;
    tin.set(v, timer);
    low.set(v, timer);

    for (const next of adj.get(v) ?? []) {
      if (next.edgeId === parentEdgeId) continue;
      if (visited.has(next.to)) {
        const currentLow = low.get(v) ?? timer;
        const nextTin = tin.get(next.to) ?? timer;
        low.set(v, Math.min(currentLow, nextTin));
      } else {
        dfs(next.to, next.edgeId);
        const currentLow = low.get(v) ?? timer;
        const childLow = low.get(next.to) ?? timer;
        low.set(v, Math.min(currentLow, childLow));
        if (childLow > (tin.get(v) ?? 0)) {
          bridgeIds.add(next.edgeId);
        }
      }
    }
  }

  for (const n of nodes) {
    if (!visited.has(n)) dfs(n, null);
  }

  return edges.filter((e) => bridgeIds.has(e.id));
}

/**
 * PK-11: Weak-bridge generator on semantically homogeneous subgraphs
 * (grouped by `relation_group`), using predicate- and purpose-driven
 * generic-node exclusion and respecting B15 forbidden pairs.
 */
export function createWeakBridgesGenerator(
  deps?: GeneratorDeps & { purpose?: GraphAlgorithmPurpose; hubThreshold?: number },
): DiscoveryGenerator {
  return {
    metadata: {
      id: "weak_bridges",
      version: "1.0.0",
      description:
        "Detects structural weak bridges within semantically homogeneous relation_group subgraphs using predicate-driven generic-node exclusion.",
    },
    generate(_context: GeneratorContext): GeneratedCandidate[] {
      const { dataset, inferenceRegistry } = resolveGeneratorDeps(deps);
      const nodeMap = buildNodeMap(dataset);
      const forbiddenPairs = activePairKeys(inferenceRegistry);
      const eligible = buildEligibleMappedRelationships(dataset, inferenceRegistry);
      const purpose = deps?.purpose ?? "weak_bridge";

      // Compute total degree per node across eligible relationships
      const degrees = new Map<string, number>();
      for (const item of eligible) {
        degrees.set(item.relationship.subject, (degrees.get(item.relationship.subject) ?? 0) + 1);
        degrees.set(item.relationship.object, (degrees.get(item.relationship.object) ?? 0) + 1);
      }

      // Group into semantically homogeneous subgraphs by relation_group
      const byGroup = new Map<string, { rel: Relationship; pred: CanonicalPredicateId }[]>();
      for (const item of eligible) {
        const pred = item.mapping.canonical_predicate;
        if (!pred) continue;
        const subOk = !shouldExcludeGenericNode({
          node: nodeMap.get(item.relationship.subject),
          predicate: pred,
          purpose,
          degree: degrees.get(item.relationship.subject) ?? 0,
          ...(deps?.hubThreshold !== undefined ? { hubThreshold: deps.hubThreshold } : {}),
        });
        const objOk = !shouldExcludeGenericNode({
          node: nodeMap.get(item.relationship.object),
          predicate: pred,
          purpose,
          degree: degrees.get(item.relationship.object) ?? 0,
          ...(deps?.hubThreshold !== undefined ? { hubThreshold: deps.hubThreshold } : {}),
        });
        if (!subOk || !objOk) continue;

        const list = byGroup.get(item.relation_group) ?? [];
        list.push({ rel: item.relationship, pred });
        byGroup.set(item.relation_group, list);
      }

      const candidates: GeneratedCandidate[] = [];
      for (const [group, items] of byGroup.entries()) {
        if (items.length < 2) continue;
        const nodeSet = new Set<string>();
        const edges: {
          id: string;
          u: string;
          v: string;
          rel: Relationship;
          pred: CanonicalPredicateId;
        }[] = [];
        for (const item of items) {
          nodeSet.add(item.rel.subject);
          nodeSet.add(item.rel.object);
          edges.push({
            id: item.rel.id,
            u: item.rel.subject,
            v: item.rel.object,
            rel: item.rel,
            pred: item.pred,
          });
        }

        const bridges = findBridgeEdges([...nodeSet], edges);
        for (const b of bridges) {
          if (forbiddenPairs.has(pairKey(b.u, b.v))) continue;
          const uLabel = resolveNodeLabel(nodeMap, b.u);
          const vLabel = resolveNodeLabel(nodeMap, b.v);
          const edgeObj = edges.find((e) => e.id === b.id);
          if (!edgeObj) continue;

          candidates.push(
            makeCandidate({
              method: "weak_bridges",
              method_version: "1.0.0",
              priority: 55,
              question: `In the ${group} subgraph, ${edgeObj.rel.id} (${edgeObj.pred}) between ${uLabel} and ${vLabel} is a single-edge weak bridge: is there independent corroboration or a parallel link?`,
              refs: [b.u, b.v, b.id],
              evidences: [b.id],
              alternative_explanations: [
                `The ${group} connection between ${uLabel} and ${vLabel} may be isolated or an artifact of incomplete corpus coverage.`,
              ],
              falsifiers: [
                `Documented evidence showing no operational continuity across the bridge ${b.id}.`,
              ],
              estimated_cost: 2,
            }),
          );
        }
      }

      return candidates.sort((a, b) => (a.dedup_key ?? "").localeCompare(b.dedup_key ?? ""));
    },
  };
}

export const weakBridgesGenerator: DiscoveryGenerator = createWeakBridgesGenerator();
