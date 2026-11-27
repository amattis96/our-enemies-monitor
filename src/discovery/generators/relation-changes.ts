import { classifyRelationship } from "../../claims/canonical-predicates.ts";
import { comparePartialDates } from "../../model/index.ts";
import type { DiscoveryGenerator, GeneratedCandidate, GeneratorContext } from "./interface.ts";
import {
  buildNodeMap,
  type GeneratorDeps,
  makeCandidate,
  resolveGeneratorDeps,
  resolveNodeLabel,
} from "./open-triads.ts";

/**
 * PK-11: Detects relationship variations over time between the same pair of nodes
 * (predicate shifts, evidence_status progressions, or bounded-validity transitions).
 */
export function createRelationChangesGenerator(deps?: GeneratorDeps): DiscoveryGenerator {
  return {
    metadata: {
      id: "relation_changes",
      version: "1.0.0",
      description:
        "Detects temporal variations in relationships between the same node pair (predicate shifts, evidence status changes, or validity transitions).",
    },
    generate(_context: GeneratorContext): GeneratedCandidate[] {
      const { dataset } = resolveGeneratorDeps(deps);
      const nodeMap = buildNodeMap(dataset);
      const byPair = new Map<string, typeof dataset.relationships>();

      for (const rel of dataset.relationships) {
        const key = `${rel.subject}|${rel.object}`;
        const list = byPair.get(key) ?? [];
        list.push(rel);
        byPair.set(key, list);
      }

      const candidates: GeneratedCandidate[] = [];
      for (const [, rels] of byPair.entries()) {
        if (rels.length < 2) continue;
        const sorted = [...rels].sort((a, b) => {
          const da = a.valid_from ?? "";
          const db = b.valid_from ?? "";
          return da && db ? comparePartialDates(da, db) : a.id.localeCompare(b.id);
        });

        for (let i = 0; i < sorted.length - 1; i += 1) {
          const prev = sorted[i];
          const next = sorted[i + 1];
          if (!prev || !next) continue;

          const prevPred = classifyRelationship(prev).mapping.canonical_predicate ?? prev.predicate;
          const nextPred = classifyRelationship(next).mapping.canonical_predicate ?? next.predicate;
          const changedPredicate = prevPred !== nextPred;
          const changedStatus = prev.evidence_status !== next.evidence_status;
          const hasTransitionWindow = prev.valid_to !== null || next.valid_from !== null;

          if (!changedPredicate && !changedStatus && !hasTransitionWindow) continue;

          const subjLabel = resolveNodeLabel(nodeMap, prev.subject);
          const objLabel = resolveNodeLabel(nodeMap, prev.object);
          candidates.push(
            makeCandidate({
              method: "relation_changes",
              method_version: "1.0.0",
              priority: changedPredicate ? 68 : 54,
              question: `Relationship between ${subjLabel} and ${objLabel} changed from ${prev.id} (${prevPred}, ${prev.evidence_status}) to ${next.id} (${nextPred}, ${next.evidence_status}). Verify whether this reflects a real-world shift or an evidentiary update.`,
              refs: [prev.subject, prev.object, prev.id, next.id],
              evidences: [prev.id, next.id],
              alternative_explanations: [
                "Multiple concurrent aspects of the same relationship documented by different sources.",
              ],
              falsifiers: [
                "Chronological primary sources confirming continuity without structural change.",
              ],
              estimated_cost: 1,
            }),
          );
        }
      }

      return candidates.sort((a, b) => (a.dedup_key ?? "").localeCompare(b.dedup_key ?? ""));
    },
  };
}

export const relationChangesGenerator: DiscoveryGenerator = createRelationChangesGenerator();
