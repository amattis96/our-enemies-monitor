import { classifyRelationship } from "../../claims/canonical-predicates.ts";
import type { DiscoveryGenerator, GeneratedCandidate, GeneratorContext } from "./interface.ts";
import {
  buildNodeMap,
  type GeneratorDeps,
  makeCandidate,
  resolveGeneratorDeps,
  resolveNodeLabel,
} from "./open-triads.ts";

/**
 * PK-11: Detects evidentiary gaps in the canonical dataset:
 * 1. E4 allegations without independent corroboration or primary URL.
 * 2. Unmapped / needs_review predicates requiring human canonical classification.
 * 3. High/critical open_unproven hypotheses lacking corroborating sources.
 */
export function createEvidentiaryGapsGenerator(deps?: GeneratorDeps): DiscoveryGenerator {
  return {
    metadata: {
      id: "evidentiary_gaps",
      version: "1.0.0",
      description:
        "Identifies evidentiary gaps: uncorroborated E4 allegations, unmapped predicates, and high-priority open hypotheses.",
    },
    generate(_context: GeneratorContext): GeneratedCandidate[] {
      const { dataset } = resolveGeneratorDeps(deps);
      const nodeMap = buildNodeMap(dataset);
      const candidates: GeneratedCandidate[] = [];

      for (const rel of dataset.relationships) {
        const mapped = classifyRelationship(rel);
        const subj = resolveNodeLabel(nodeMap, rel.subject);
        const obj = resolveNodeLabel(nodeMap, rel.object);

        if (mapped.mapping.classification_status !== "mapped") {
          candidates.push(
            makeCandidate({
              method: "evidentiary_gaps",
              method_version: "1.0.0",
              priority: 58,
              question: `Relationship ${rel.id} (${subj} -[${rel.predicate}]-> ${obj}) has classification status "${mapped.mapping.classification_status}". Review and map to a canonical predicate without forcing substance.`,
              refs: [rel.id, rel.subject, rel.object],
              evidences: [rel.id],
              alternative_explanations: [
                "Original predicate is domain-specific and intentionally kept unmapped pending taxonomy extension.",
              ],
              falsifiers: ["Editorial review confirming predicate remains outside v1 taxonomy."],
              estimated_cost: 1,
            }),
          );
          continue;
        }

        if (rel.evidence_level === "E4" && (rel.sources.length < 2 || rel.primary_url === null)) {
          candidates.push(
            makeCandidate({
              method: "evidentiary_gaps",
              method_version: "1.0.0",
              priority: 64,
              question: `Uncorroborated E4 allegation ${rel.id} (${subj} -> ${obj}) has ${rel.sources.length} source(s) and ${rel.primary_url ? "a" : "no"} primary URL. Is independent corroboration or a primary document available?`,
              refs: [rel.id, rel.subject, rel.object, ...rel.sources],
              evidences: [rel.id, ...rel.sources],
              alternative_explanations: [
                "Allegation remains single-source or uncorroborated in public records.",
              ],
              falsifiers: ["Independent E1/E3 primary documentation or judicial refutation."],
              estimated_cost: 2,
            }),
          );
        }
      }

      for (const hyp of dataset.hypotheses) {
        if (
          hyp.status === "open_unproven" &&
          (hyp.priority === "critical" || hyp.priority === "high")
        ) {
          candidates.push(
            makeCandidate({
              method: "evidentiary_gaps",
              method_version: "1.0.0",
              priority: hyp.priority === "critical" ? 78 : 65,
              question: `Open ${hyp.priority}-priority hypothesis ${hyp.id}: ${hyp.question.en ?? hyp.question.it} (needed: ${hyp.evidence_needed.en ?? hyp.evidence_needed.it})`,
              refs: [hyp.id, hyp.subject, hyp.object, ...hyp.events, ...hyp.sources],
              evidences: [hyp.id, ...hyp.sources],
              alternative_explanations: [hyp.current_limit.en ?? hyp.current_limit.it],
              falsifiers: ["Primary evidence establishing or refuting the hypothesis."],
              estimated_cost: 3,
            }),
          );
        }
      }

      return candidates.sort((a, b) => (a.dedup_key ?? "").localeCompare(b.dedup_key ?? ""));
    },
  };
}

export const evidentiaryGapsGenerator: DiscoveryGenerator = createEvidentiaryGapsGenerator();
