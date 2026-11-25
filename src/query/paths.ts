import { classifyRelationship } from "../claims/canonical-predicates.ts";
import type { PathGrammar, PathGrammarRule } from "../discovery/generators/open-triads.ts";
import { pairKey } from "../editorial/inferences.ts";
import type { Language, Relationship, Source } from "../model/index.ts";
import type { CounterInferenceAudit } from "../site/inferences.ts";
import { type ReadModel, relationGroup } from "../site/read-model.ts";
import {
  type FindPathsParams,
  type FindPathsResult,
  QUERY_COMPLEXITY_LIMITS,
  QueryComplexityError,
  type QueryPath,
  type QueryPathStep,
  type SourceSummary,
} from "./types.ts";

function toSourceSummary(s: Source): SourceSummary {
  return {
    id: s.id,
    type: s.type,
    title: s.title,
    publisher: s.publisher,
    urls: [...s.urls],
  };
}

function datesOverlap(
  aStart: string | null,
  aEnd: string | null,
  bStart: string | null,
  bEnd: string | null,
): boolean {
  if (!aStart && !aEnd) return true;
  if (!bStart && !bEnd) return true;
  const s1 = aStart ?? aEnd ?? "";
  const e1 = aEnd ?? "9999-12-31";
  const s2 = bStart ?? bEnd ?? "";
  const e2 = bEnd ?? "9999-12-31";
  return s1 <= e2 && s2 <= e1;
}

function datesSequentialOrOverlap(
  aStart: string | null,
  aEnd: string | null,
  bStart: string | null,
  bEnd: string | null,
): boolean {
  if (datesOverlap(aStart, aEnd, bStart, bEnd)) return true;
  const e1 = aEnd ?? aStart;
  const s2 = bStart ?? bEnd;
  if (!e1 || !s2) return true;
  return e1 <= s2;
}

function matchGrammarRule(
  rule: PathGrammarRule,
  firstPred: string,
  secondPred: string,
  sourceKind: string | undefined,
  bridgeKind: string | undefined,
  targetKind: string | undefined,
  r1: Relationship,
  r2: Relationship,
): boolean {
  const forwardMatch = rule.first_predicate === firstPred && rule.second_predicate === secondPred;
  const reverseMatch =
    rule.direction === "bidirectional" &&
    rule.first_predicate === secondPred &&
    rule.second_predicate === firstPred;
  if (!forwardMatch && !reverseMatch) return false;

  if (sourceKind && !rule.allowed_node_kinds.source.includes(sourceKind as never)) return false;
  if (bridgeKind && !rule.allowed_node_kinds.bridge.includes(bridgeKind as never)) return false;
  if (targetKind && !rule.allowed_node_kinds.target.includes(targetKind as never)) return false;

  if (rule.temporal_compatibility === "overlap_required") {
    return datesOverlap(r1.valid_from, r1.valid_to, r2.valid_from, r2.valid_to);
  }
  if (rule.temporal_compatibility === "sequential_or_overlap") {
    return datesSequentialOrOverlap(r1.valid_from, r1.valid_to, r2.valid_from, r2.valid_to);
  }
  return true;
}

function evaluateTwoHopGrammar(
  grammar: PathGrammar,
  r1: Relationship,
  r2: Relationship,
  sourceNode: string,
  bridgeNode: string,
  targetNode: string,
  model: ReadModel,
): { allowed: boolean; matchedRuleIds: string[] } {
  const c1 = classifyRelationship(r1);
  const c2 = classifyRelationship(r2);
  if (
    !c1.mapping.canonical_predicate ||
    !c2.mapping.canonical_predicate ||
    grammar.excluded_classification_statuses.includes(c1.mapping.classification_status as never) ||
    grammar.excluded_classification_statuses.includes(c2.mapping.classification_status as never)
  ) {
    return { allowed: false, matchedRuleIds: [] };
  }

  const sourceKind = model.nodeKind(sourceNode);
  const bridgeKind = model.nodeKind(bridgeNode);
  const targetKind = model.nodeKind(targetNode);
  const matchedRuleIds: string[] = [];

  for (const rule of grammar.rules) {
    if (
      matchGrammarRule(
        rule,
        c1.mapping.canonical_predicate,
        c2.mapping.canonical_predicate,
        sourceKind,
        bridgeKind,
        targetKind,
        r1,
        r2,
      )
    ) {
      if (rule.status === "forbidden") {
        return { allowed: false, matchedRuleIds: [rule.id] };
      }
      matchedRuleIds.push(rule.id);
    }
  }

  return { allowed: matchedRuleIds.length > 0, matchedRuleIds };
}

export function findPublicPaths(
  model: ReadModel,
  audit: CounterInferenceAudit,
  params: FindPathsParams,
  grammar?: PathGrammar,
): FindPathsResult {
  const maxSteps = params.max_steps ?? QUERY_COMPLEXITY_LIMITS.defaultPathDepth;
  const maxPaths = params.max_paths ?? QUERY_COMPLEXITY_LIMITS.defaultMaxPaths;
  const maxVisitedNodes =
    params.max_visited_nodes ?? QUERY_COMPLEXITY_LIMITS.defaultMaxVisitedNodes;
  const includeParticipation = params.include_participation ?? true;
  const applyGrammar = params.apply_grammar ?? false;
  const lang: Language = params.lang ?? "it";

  if (
    !Number.isInteger(maxSteps) ||
    maxSteps < 1 ||
    maxSteps > QUERY_COMPLEXITY_LIMITS.maxPathDepth
  ) {
    throw new QueryComplexityError(
      "PATH_DEPTH_EXCEEDED",
      `max_steps must be an integer between 1 and ${QUERY_COMPLEXITY_LIMITS.maxPathDepth}.`,
    );
  }
  if (!Number.isInteger(maxPaths) || maxPaths < 1 || maxPaths > QUERY_COMPLEXITY_LIMITS.maxPaths) {
    throw new QueryComplexityError(
      "MAX_PATHS_EXCEEDED",
      `max_paths must be an integer between 1 and ${QUERY_COMPLEXITY_LIMITS.maxPaths}.`,
    );
  }
  if (
    !Number.isInteger(maxVisitedNodes) ||
    maxVisitedNodes < 1 ||
    maxVisitedNodes > QUERY_COMPLEXITY_LIMITS.maxVisitedNodes
  ) {
    throw new QueryComplexityError(
      "VISITED_LIMIT_EXCEEDED",
      `max_visited_nodes must be an integer between 1 and ${QUERY_COMPLEXITY_LIMITS.maxVisitedNodes}.`,
    );
  }
  if (applyGrammar && !grammar) {
    throw new QueryComplexityError(
      "GRAMMAR_UNAVAILABLE",
      "apply_grammar was requested but no PK-11 path grammar is loaded.",
    );
  }

  const forbiddenByPair = new Map<string, string[]>();
  for (const f of audit.forbidden_inferences) {
    for (const pair of f.pairs) {
      const key = pairKey(pair[0], pair[1]);
      forbiddenByPair.set(key, [...(forbiddenByPair.get(key) ?? []), f.id]);
    }
  }
  const pairForbiddenIds = forbiddenByPair.get(pairKey(params.from, params.to)) ?? [];

  const caveatClassByRel = new Map(audit.caveat_classifications.map((c) => [c.relationship, c]));

  // Build deterministic adjacency list over unrestricted public relationships.
  type EdgeEntry = { rel: Relationship; next: string };
  const adj = new Map<string, EdgeEntry[]>();
  const sortedRels = [...model.dataset.relationships]
    .filter((r) => {
      if (model.isRestricted(r)) return false;
      if (!includeParticipation && relationGroup(r) === "participation") return false;
      if (applyGrammar && grammar) {
        const mapped = classifyRelationship(r);
        if (
          grammar.excluded_classification_statuses.includes(
            mapped.mapping.classification_status as never,
          )
        ) {
          return false;
        }
      }
      return true;
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  for (const r of sortedRels) {
    adj.set(r.subject, [...(adj.get(r.subject) ?? []), { rel: r, next: r.object }]);
    if (r.subject !== r.object) {
      adj.set(r.object, [...(adj.get(r.object) ?? []), { rel: r, next: r.subject }]);
    }
  }

  type QueueState = {
    node: string;
    rels: Relationship[];
    nodes: string[];
    rules: string[];
  };

  const found: { rels: Relationship[]; rules: string[] }[] = [];
  const visitedNodes = new Set<string>([params.from]);
  let truncated = false;

  if (
    params.from !== params.to &&
    !(applyGrammar && grammar?.enforce_b15_forbidden_pairs && pairForbiddenIds.length > 0)
  ) {
    const queue: QueueState[] = [{ node: params.from, rels: [], nodes: [params.from], rules: [] }];
    let head = 0;

    while (head < queue.length && found.length < maxPaths) {
      const current = queue[head++];
      if (!current) break;
      if (current.rels.length >= maxSteps) {
        truncated = true;
        continue;
      }

      const neighbors = adj.get(current.node) ?? [];
      for (const edge of neighbors) {
        if (current.nodes.includes(edge.next)) continue;

        let nextRules = current.rules;
        if (applyGrammar && grammar && current.rels.length > 0) {
          const prevRel = current.rels[current.rels.length - 1];
          const prevNode = current.nodes[current.nodes.length - 2];
          if (prevRel && prevNode) {
            const check = evaluateTwoHopGrammar(
              grammar,
              prevRel,
              edge.rel,
              prevNode,
              current.node,
              edge.next,
              model,
            );
            if (!check.allowed) continue;
            nextRules = [...new Set([...current.rules, ...check.matchedRuleIds])];
          }
        }

        const nextRels = [...current.rels, edge.rel];
        if (edge.next === params.to) {
          found.push({ rels: nextRels, rules: nextRules });
          if (found.length >= maxPaths) break;
          continue;
        }

        if (!visitedNodes.has(edge.next)) {
          if (visitedNodes.size >= maxVisitedNodes) {
            truncated = true;
            continue;
          }
          visitedNodes.add(edge.next);
        }

        queue.push({
          node: edge.next,
          rels: nextRels,
          nodes: [...current.nodes, edge.next],
          rules: nextRules,
        });
      }
    }
  }

  const paths: QueryPath[] = found.map(({ rels, rules }) => {
    const steps: QueryPathStep[] = rels.map((r) => {
      const cls = caveatClassByRel.get(r.id);
      const sources = r.sources
        .map((id) => model.source(id))
        .filter((s): s is Source => s !== undefined)
        .map(toSourceSummary);

      return {
        relationship: r.id,
        subject: r.subject,
        subject_label: model.nodeLabel(r.subject, lang),
        predicate: r.predicate,
        object: r.object,
        object_label: model.nodeLabel(r.object, lang),
        relation_class: r.relation_class,
        group: relationGroup(r),
        evidence_level: r.evidence_level,
        evidence_status: r.evidence_status,
        valid_from: r.valid_from,
        valid_to: r.valid_to,
        primary_url: r.primary_url,
        caveat: r.caveat,
        sources,
        b15: {
          categories: cls ? [...cls.categories] : [],
          interrupts_composition: cls?.interrupts_composition ?? false,
          classification_state: cls?.state ?? null,
        },
      };
    });

    const interruptedAt = steps
      .filter((s) => s.b15.interrupts_composition)
      .map((s) => s.relationship);

    const caveats: string[] = [
      steps.length === 1
        ? "Single documented relationship: holds only within its predicate, evidence level, and caveat."
        : `${steps.length} documented relationships in sequence do not constitute a documented relationship between endpoints.`,
    ];
    if (interruptedAt.length > 0) {
      caveats.push(
        `B15 caveat interruption at ${interruptedAt.join(", ")}: composition across this chain is interrupted.`,
      );
    }
    if (pairForbiddenIds.length > 0) {
      caveats.push(
        `B15 forbidden inference (${pairForbiddenIds.join(", ")}): direct inference between these endpoints is forbidden.`,
      );
    }

    return {
      from: params.from,
      to: params.to,
      steps,
      interrupted_at: interruptedAt,
      forbidden_by: pairForbiddenIds,
      grammar_applied: applyGrammar,
      grammar_rules_matched: rules,
      caveats,
    };
  });

  return {
    from: params.from,
    to: params.to,
    paths,
    step_limit: {
      max_steps: maxSteps,
      max_paths: maxPaths,
      max_visited_nodes: maxVisitedNodes,
      visited_nodes: visitedNodes.size,
      truncated,
    },
    b15_forbidden_for_pair: pairForbiddenIds,
  };
}
