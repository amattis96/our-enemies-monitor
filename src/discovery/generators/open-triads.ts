import { readFileSync } from "node:fs";
import { z } from "zod";
import {
  CANONICAL_PREDICATES,
  type CanonicalPredicateId,
  classifyRelationship,
  isEligibleForAutomaticInference,
  type MappedRelationship,
  NODE_KINDS,
  type NodeKind,
} from "../../claims/canonical-predicates.ts";
import {
  activePairKeys,
  type InferenceRegistry,
  pairKey,
  readInferenceRegistry,
} from "../../editorial/inferences.ts";
import {
  comparePartialDates,
  type Dataset,
  type Entity,
  type Event,
  type Relationship,
} from "../../model/index.ts";
import { readDataFiles } from "../../pipeline/load.ts";
import { repoPath } from "../../pipeline/paths.ts";
import { validateDataFiles } from "../../pipeline/validate.ts";
import {
  computeDedupKey,
  type DiscoveryGenerator,
  type GeneratedCandidate,
  type GeneratorContext,
} from "./interface.ts";

export const GENERATOR_ACTIVATION_STATES = [
  "disabled",
  "shadow",
  "experimental",
  "active",
] as const;
export type GeneratorActivationState = (typeof GENERATOR_ACTIVATION_STATES)[number];

export const ATTRIBUTION_LEVELS = ["executor", "intermediary", "sponsor", "claim"] as const;
export type AttributionLevel = (typeof ATTRIBUTION_LEVELS)[number];

export type ProceduralRecord = {
  id: string;
  entity_id: string;
  event_id?: string;
  status: string;
  date: string;
  note?: string;
};

export type AttributionClaimRecord = {
  id: string;
  target_id: string;
  level: AttributionLevel;
  attributed_actor_id: string;
  source_id: string;
  stance: "attribution" | "denial";
  date?: string;
};

export type GeneratorDeps = {
  dataset?: Dataset;
  inferenceRegistry?: InferenceRegistry;
  pathGrammarPath?: string;
  activation?: GeneratorActivationState;
  proceduralRecords?: readonly ProceduralRecord[];
  attributionClaims?: readonly AttributionClaimRecord[];
};

export const PathGrammarRuleSchema = z
  .strictObject({
    id: z.string().min(1).describe("Unique identifier of the path grammar rule."),
    status: z
      .enum(["allowed", "forbidden", "conditional"])
      .describe("Whether the predicate combination is allowed, forbidden, or conditional."),
    first_predicate: z.enum(CANONICAL_PREDICATES).describe("Canonical predicate of the first hop."),
    second_predicate: z
      .enum(CANONICAL_PREDICATES)
      .describe("Canonical predicate of the second hop."),
    direction: z
      .enum(["forward", "reverse", "bidirectional"])
      .describe("Directionality constraint across the two hops."),
    temporal_compatibility: z
      .enum(["overlap_required", "sequential_or_overlap", "any"])
      .describe("Temporal compatibility requirement between the two hops."),
    allowed_node_kinds: z
      .strictObject({
        source: z.array(z.enum(NODE_KINDS)).describe("Allowed node kinds for the source node."),
        bridge: z.array(z.enum(NODE_KINDS)).describe("Allowed node kinds for the bridge node."),
        target: z.array(z.enum(NODE_KINDS)).describe("Allowed node kinds for the target node."),
      })
      .describe("Allowed entity/event kinds for source, bridge, and target."),
    condition: z
      .string()
      .nullable()
      .describe("Explicit condition or non-forcing boundary, or null when unconditional."),
    question_template: z
      .strictObject({
        it: z.string().min(1).describe("Italian question template."),
        en: z.string().min(1).describe("English question template."),
      })
      .describe("Localized verification question template."),
    rationale: z.string().min(1).describe("Rationale for the grammar rule."),
  })
  .describe("A protected path grammar rule governing open-triad composition.");

export const PathGrammarSchema = z
  .strictObject({
    schema_version: z.literal("1.0.0").describe("Path grammar schema version."),
    grammar_version: z.string().min(1).describe("Semantic version of the grammar rules."),
    excluded_classification_statuses: z
      .array(z.enum(["unmapped", "needs_review"]))
      .describe("Classification statuses excluded from path composition."),
    enforce_b15_forbidden_pairs: z
      .boolean()
      .describe("Whether active B15 forbidden inference pairs must be excluded."),
    rules: z.array(PathGrammarRuleSchema).describe("Ordered list of path grammar rules."),
  })
  .describe("Protected path grammar for deterministic open-triad generation.");

export type PathGrammar = z.infer<typeof PathGrammarSchema>;
export type PathGrammarRule = z.infer<typeof PathGrammarRuleSchema>;

export const DEFAULT_PATH_GRAMMAR_PATH = repoPath("src/discovery/path-grammar.v1.json");

export function loadPathGrammar(grammarPath = DEFAULT_PATH_GRAMMAR_PATH): PathGrammar {
  const raw = JSON.parse(readFileSync(grammarPath, "utf8")) as unknown;
  return PathGrammarSchema.parse(raw);
}

export function resolveGeneratorDeps(deps?: GeneratorDeps): {
  dataset: Dataset;
  inferenceRegistry: InferenceRegistry;
  grammar: PathGrammar;
} {
  const dataset = deps?.dataset ?? validateDataFiles(readDataFiles()).dataset;
  const inferenceRegistry = deps?.inferenceRegistry ?? readInferenceRegistry();
  const grammar = loadPathGrammar(deps?.pathGrammarPath ?? DEFAULT_PATH_GRAMMAR_PATH);
  return { dataset, inferenceRegistry, grammar };
}

export function buildNodeKindMap(dataset: Dataset): Map<string, NodeKind> {
  const map = new Map<string, NodeKind>();
  for (const entity of dataset.entities) {
    map.set(entity.id, entity.kind);
  }
  for (const event of dataset.events) {
    map.set(event.id, "event");
  }
  return map;
}

export function buildNodeMap(dataset: Dataset): Map<string, Entity | Event> {
  const map = new Map<string, Entity | Event>();
  for (const entity of dataset.entities) {
    map.set(entity.id, entity);
  }
  for (const event of dataset.events) {
    map.set(event.id, event);
  }
  return map;
}

export function resolveNodeLabel(nodeMap: Map<string, Entity | Event>, id: string): string {
  const node = nodeMap.get(id);
  if (!node) return id;
  if ("name" in node) return node.name.it;
  return node.title.it;
}

export function buildDirectPairSet(dataset: Dataset): Set<string> {
  const pairs = new Set<string>();
  for (const r of dataset.relationships) {
    pairs.add(pairKey(r.subject, r.object));
  }
  return pairs;
}

export function buildInterruptingCaveatSet(registry: InferenceRegistry): Set<string> {
  const ids = new Set<string>();
  for (const c of registry.caveat_classifications) {
    if (c.interrupts_composition) {
      ids.add(c.relationship);
    }
  }
  return ids;
}

export function datesOverlap(
  aFrom: string | null,
  aTo: string | null,
  bFrom: string | null,
  bTo: string | null,
): boolean {
  if (aFrom && bTo && comparePartialDates(aFrom, bTo) > 0) return false;
  if (bFrom && aTo && comparePartialDates(bFrom, aTo) > 0) return false;
  return true;
}

export function isTemporallyCompatible(
  mode: PathGrammarRule["temporal_compatibility"],
  r1: Relationship,
  r2: Relationship,
): boolean {
  if (mode === "any") return true;
  if (mode === "overlap_required") {
    return datesOverlap(r1.valid_from, r1.valid_to, r2.valid_from, r2.valid_to);
  }
  // sequential_or_overlap: r1 must not start strictly after r2 ends (if both bounded)
  if (r1.valid_from && r2.valid_to && comparePartialDates(r1.valid_from, r2.valid_to) > 0) {
    return false;
  }
  return true;
}

export function buildEligibleMappedRelationships(
  dataset: Dataset,
  registry: InferenceRegistry,
): MappedRelationship<Relationship>[] {
  const interrupting = buildInterruptingCaveatSet(registry);
  const forbiddenPairs = activePairKeys(registry);
  const result: MappedRelationship<Relationship>[] = [];

  for (const r of dataset.relationships) {
    if (interrupting.has(r.id)) continue;
    if (forbiddenPairs.has(pairKey(r.subject, r.object))) continue;
    const mapped = classifyRelationship(r);
    if (!isEligibleForAutomaticInference(mapped.mapping)) continue;
    result.push({
      relationship: r,
      mapping: mapped.mapping,
      relation_group: mapped.relation_group,
    });
  }
  return result;
}

export function makeCandidate(input: {
  method: string;
  method_version: string;
  priority: number;
  question: string;
  refs: readonly string[];
  evidences?: readonly string[];
  alternative_explanations?: readonly string[];
  falsifiers?: readonly string[];
  estimated_cost?: number | null;
  visibility?: "private" | "publishable";
}): GeneratedCandidate {
  const uniqueRefs = [...new Set(input.refs)].sort();
  return {
    method: input.method,
    method_version: input.method_version,
    priority: Math.max(0, Math.min(100, Math.round(input.priority))),
    question: input.question,
    refs: uniqueRefs,
    ...(input.evidences ? { evidences: [...new Set(input.evidences)].sort() } : {}),
    ...(input.alternative_explanations
      ? { alternative_explanations: [...input.alternative_explanations] }
      : {}),
    ...(input.falsifiers ? { falsifiers: [...input.falsifiers] } : {}),
    dedup_key: computeDedupKey({
      method: input.method,
      question: input.question,
      refs: uniqueRefs,
    }),
    ...(input.estimated_cost !== undefined ? { estimated_cost: input.estimated_cost } : {}),
    visibility: input.visibility ?? "private",
  };
}

function findMatchingRule(
  grammar: PathGrammar,
  firstPred: CanonicalPredicateId,
  secondPred: CanonicalPredicateId,
  sourceKind: NodeKind,
  bridgeKind: NodeKind,
  targetKind: NodeKind,
): PathGrammarRule | null {
  for (const rule of grammar.rules) {
    if (rule.first_predicate !== firstPred || rule.second_predicate !== secondPred) continue;
    if (rule.status === "forbidden") return null;
    if (
      !rule.allowed_node_kinds.source.includes(sourceKind) ||
      !rule.allowed_node_kinds.bridge.includes(bridgeKind) ||
      !rule.allowed_node_kinds.target.includes(targetKind)
    ) {
      continue;
    }
    return rule;
  }
  return null;
}

function renderTemplate(
  template: string,
  values: { source: string; bridge: string; target: string },
): string {
  return template
    .replaceAll("{source}", values.source)
    .replaceAll("{bridge}", values.bridge)
    .replaceAll("{target}", values.target);
}

/**
 * PK-11: Constrained open-triad generator using `path-grammar.v1.json`.
 * Strictly excludes `unmapped` / `needs_review` relationships, interrupting
 * caveats, forbidden grammar rules, and B15 forbidden inference pairs.
 */
export function createOpenTriadsGenerator(deps?: GeneratorDeps): DiscoveryGenerator {
  return {
    metadata: {
      id: "open_triads",
      version: "1.0.0",
      description:
        "Generates verification questions from grammar-allowed open triads while excluding unmapped predicates and B15 forbidden pairs.",
    },
    generate(_context: GeneratorContext): GeneratedCandidate[] {
      const { dataset, inferenceRegistry, grammar } = resolveGeneratorDeps(deps);
      const nodeKinds = buildNodeKindMap(dataset);
      const nodeMap = buildNodeMap(dataset);
      const directPairs = buildDirectPairSet(dataset);
      const forbiddenPairs = grammar.enforce_b15_forbidden_pairs
        ? activePairKeys(inferenceRegistry)
        : new Map<string, string[]>();

      const eligible = buildEligibleMappedRelationships(dataset, inferenceRegistry);
      const candidates: GeneratedCandidate[] = [];
      const seenKeys = new Set<string>();

      // Index outgoing edges (and bidirectional reverse edges) by source node
      type Hop = {
        from: string;
        to: string;
        predicate: CanonicalPredicateId;
        rel: Relationship;
      };
      const outgoing = new Map<string, Hop[]>();
      const pushHop = (hop: Hop) => {
        const list = outgoing.get(hop.from) ?? [];
        list.push(hop);
        outgoing.set(hop.from, list);
      };

      for (const item of eligible) {
        const pred = item.mapping.canonical_predicate;
        if (!pred) continue;
        pushHop({
          from: item.relationship.subject,
          to: item.relationship.object,
          predicate: pred,
          rel: item.relationship,
        });
        if (item.mapping.direction === "bidirectional") {
          pushHop({
            from: item.relationship.object,
            to: item.relationship.subject,
            predicate: pred,
            rel: item.relationship,
          });
        }
      }

      for (const [source, firstHops] of outgoing.entries()) {
        const sourceKind = nodeKinds.get(source);
        if (!sourceKind) continue;

        for (const hop1 of firstHops) {
          const bridge = hop1.to;
          const bridgeKind = nodeKinds.get(bridge);
          if (!bridgeKind) continue;

          const secondHops = outgoing.get(bridge) ?? [];
          for (const hop2 of secondHops) {
            const target = hop2.to;
            if (target === source || target === bridge) continue;
            if (hop1.rel.id === hop2.rel.id) continue;

            const targetKind = nodeKinds.get(target);
            if (!targetKind) continue;

            const acKey = pairKey(source, target);
            if (directPairs.has(acKey)) continue;
            if (forbiddenPairs.has(acKey)) continue;

            const rule = findMatchingRule(
              grammar,
              hop1.predicate,
              hop2.predicate,
              sourceKind,
              bridgeKind,
              targetKind,
            );
            if (!rule) continue;
            if (!isTemporallyCompatible(rule.temporal_compatibility, hop1.rel, hop2.rel)) continue;

            const question = renderTemplate(rule.question_template.en, {
              source: resolveNodeLabel(nodeMap, source),
              bridge: resolveNodeLabel(nodeMap, bridge),
              target: resolveNodeLabel(nodeMap, target),
            });

            const candidate = makeCandidate({
              method: "open_triads",
              method_version: "1.0.0",
              priority: rule.status === "allowed" ? 65 : 50,
              question,
              refs: [source, bridge, target, hop1.rel.id, hop2.rel.id],
              evidences: [hop1.rel.id, hop2.rel.id],
              alternative_explanations: [
                `Independent relationships via ${bridge} without a direct link between ${source} and ${target}.`,
              ],
              falsifiers: [
                `Primary documentation confirming ${source} and ${target} acted independently without direct linkage.`,
              ],
              estimated_cost: 2,
            });

            if (candidate.dedup_key && !seenKeys.has(candidate.dedup_key)) {
              seenKeys.add(candidate.dedup_key);
              candidates.push(candidate);
            }
          }
        }
      }

      return candidates.sort((a, b) => (a.dedup_key ?? "").localeCompare(b.dedup_key ?? ""));
    },
  };
}

export const openTriadsGenerator: DiscoveryGenerator = createOpenTriadsGenerator();
