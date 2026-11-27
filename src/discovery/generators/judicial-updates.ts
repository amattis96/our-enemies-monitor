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
 * PK-11: Detects new judicial/procedural acts that touch entities or events
 * already covered by existing attributions (`ACCUSED_OF`, `ATTRIBUTED_BY_AUTHORITY`,
 * or E2/E4 relationships).
 */
export function createJudicialUpdatesGenerator(deps?: GeneratorDeps): DiscoveryGenerator {
  return {
    metadata: {
      id: "judicial_updates",
      version: "1.0.0",
      description:
        "Detects new judicial or procedural acts affecting entities/events with existing attributions.",
    },
    generate(_context: GeneratorContext): GeneratedCandidate[] {
      const { dataset } = resolveGeneratorDeps(deps);
      const nodeMap = buildNodeMap(dataset);
      const eventsById = new Map(dataset.events.map((e) => [e.id, e]));

      const attributionRels = dataset.relationships.filter((r) => {
        const pred = classifyRelationship(r).mapping.canonical_predicate;
        return (
          pred === "ACCUSED_OF" ||
          pred === "ATTRIBUTED_BY_AUTHORITY" ||
          r.evidence_level === "E2" ||
          r.evidence_level === "E4"
        );
      });

      const justiceEvents = dataset.events.filter((e) => e.themes.includes("justice"));
      const proceduralRecords = deps?.proceduralRecords ?? [];

      const candidates: GeneratedCandidate[] = [];
      const seenKeys = new Set<string>();
      const push = (c: GeneratedCandidate) => {
        if (c.dedup_key && !seenKeys.has(c.dedup_key)) {
          seenKeys.add(c.dedup_key);
          candidates.push(c);
        }
      };

      // Check procedural records against existing attributions
      for (const proc of proceduralRecords) {
        for (const attr of attributionRels) {
          if (attr.subject !== proc.entity_id && attr.object !== proc.entity_id) continue;
          if (attr.valid_from && comparePartialDates(proc.date, attr.valid_from) < 0) continue;

          push(
            makeCandidate({
              method: "judicial_updates",
              method_version: "1.0.0",
              priority: 82,
              question: `New procedural record ${proc.id} (${proc.status} on ${proc.date}) affects ${resolveNodeLabel(nodeMap, proc.entity_id)} in existing attribution ${attr.id}. Does it update or confirm the attribution?`,
              refs: [proc.id, attr.id, proc.entity_id, attr.subject, attr.object],
              evidences: [attr.id, proc.id],
              alternative_explanations: [
                "Procedural act relates to a separate matter involving the same entity.",
              ],
              falsifiers: [
                "Court docket showing procedural record is unrelated to the attributed conduct.",
              ],
              estimated_cost: 2,
            }),
          );
        }
      }

      // Check justice events linked to entities in attribution relationships
      for (const jev of justiceEvents) {
        const linkedRels = dataset.relationships.filter((r) => r.events.includes(jev.id));
        const jevEntities = new Set(linkedRels.flatMap((r) => [r.subject, r.object]));

        for (const attr of attributionRels) {
          if (attr.events.includes(jev.id)) continue;
          const sharedEntity = jevEntities.has(attr.subject)
            ? attr.subject
            : jevEntities.has(attr.object)
              ? attr.object
              : null;
          if (!sharedEntity) continue;

          const attrDate =
            attr.valid_from ??
            attr.events.map((id) => eventsById.get(id)?.date.start).find((d): d is string => !!d);
          if (attrDate && comparePartialDates(jev.date.start, attrDate) < 0) continue;

          push(
            makeCandidate({
              method: "judicial_updates",
              method_version: "1.0.0",
              priority: 76,
              question: `Justice event ${jev.id} (${jev.date.start}: ${jev.title.it}) involves ${resolveNodeLabel(nodeMap, sharedEntity)}, which has existing attribution ${attr.id}. Does ${jev.id} update the evidentiary status of ${attr.id}?`,
              refs: [jev.id, attr.id, sharedEntity],
              evidences: [jev.id, attr.id],
              alternative_explanations: [
                `Justice event ${jev.id} concerns a distinct proceeding for ${sharedEntity}.`,
              ],
              falsifiers: [
                "Primary judicial summary confirming no overlap with attribution facts.",
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

export const judicialUpdatesGenerator: DiscoveryGenerator = createJudicialUpdatesGenerator();
