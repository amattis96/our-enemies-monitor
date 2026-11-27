import { activePairKeys, pairKey } from "../../editorial/inferences.ts";
import type { Event } from "../../model/index.ts";
import type { DiscoveryGenerator, GeneratedCandidate, GeneratorContext } from "./interface.ts";
import {
  buildDirectPairSet,
  buildEligibleMappedRelationships,
  buildNodeMap,
  type GeneratorDeps,
  makeCandidate,
  resolveGeneratorDeps,
  resolveNodeLabel,
} from "./open-triads.ts";

/**
 * PK-11: Identifies missing links in documented chains:
 * 1. Events with documented participants or attributions lacking a COMMISSIONED/CONTROLLED link.
 * 2. Documented FUNDED/OWNED chains reaching an intermediary without a direct link to the target event.
 */
export function createMissingLinksGenerator(deps?: GeneratorDeps): DiscoveryGenerator {
  return {
    metadata: {
      id: "missing_links",
      version: "1.0.0",
      description:
        "Finds missing structural links in documented operational or attribution chains while excluding forbidden pairs and unmapped predicates.",
    },
    generate(_context: GeneratorContext): GeneratedCandidate[] {
      const { dataset, inferenceRegistry } = resolveGeneratorDeps(deps);
      const nodeMap = buildNodeMap(dataset);
      const directPairs = buildDirectPairSet(dataset);
      const forbiddenPairs = activePairKeys(inferenceRegistry);
      const eligible = buildEligibleMappedRelationships(dataset, inferenceRegistry);

      const eventsById = new Map<string, Event>(dataset.events.map((e) => [e.id, e]));
      const candidates: GeneratedCandidate[] = [];
      const seenKeys = new Set<string>();
      const push = (c: GeneratedCandidate) => {
        if (c.dedup_key && !seenKeys.has(c.dedup_key)) {
          seenKeys.add(c.dedup_key);
          candidates.push(c);
        }
      };

      // Pattern 1: Event has PARTICIPATED_IN or ATTRIBUTED_BY_AUTHORITY but no COMMISSIONED/CONTROLLED link
      const eventLinks = new Map<
        string,
        { hasCommissionOrControl: boolean; participants: string[]; relIds: string[] }
      >();
      for (const item of eligible) {
        const pred = item.mapping.canonical_predicate;
        const target = item.relationship.object;
        if (!eventsById.has(target)) continue;
        const entry = eventLinks.get(target) ?? {
          hasCommissionOrControl: false,
          participants: [],
          relIds: [],
        };
        if (pred === "COMMISSIONED" || pred === "CONTROLLED") {
          entry.hasCommissionOrControl = true;
        } else if (pred === "PARTICIPATED_IN" || pred === "ATTRIBUTED_BY_AUTHORITY") {
          entry.participants.push(item.relationship.subject);
          entry.relIds.push(item.relationship.id);
        }
        eventLinks.set(target, entry);
      }

      for (const [eventId, info] of eventLinks.entries()) {
        if (info.hasCommissionOrControl || info.participants.length === 0) continue;
        const ev = eventsById.get(eventId);
        if (!ev || ev.record_type === "dataset_metadata") continue;
        const primaryActor = info.participants[0];
        if (!primaryActor || forbiddenPairs.has(pairKey(primaryActor, eventId))) continue;

        push(
          makeCandidate({
            method: "missing_links",
            method_version: "1.0.0",
            priority: 62,
            question: `Event ${ev.id} (${ev.title.it}) has documented participation/attribution (${info.relIds.join(", ")}) but lacks a documented commissioning or operational control link. Is there a missing upstream sponsor/executor link?`,
            refs: [ev.id, ...info.participants, ...info.relIds],
            evidences: info.relIds,
            alternative_explanations: [
              "Event occurred without centralized tasking or attribution remains unestablished.",
            ],
            falsifiers: [
              "Primary investigation confirming autonomous action or lack of upstream tasking.",
            ],
            estimated_cost: 2,
          }),
        );
      }

      // Pattern 2: Documented CONTROLLED/OWNED(A->B) + PARTICIPATED_IN(B->Event) without A->Event
      const controlEdges = eligible.filter(
        (i) =>
          i.mapping.canonical_predicate === "CONTROLLED" ||
          i.mapping.canonical_predicate === "OWNED",
      );
      const partEdges = eligible.filter(
        (i) =>
          i.mapping.canonical_predicate === "PARTICIPATED_IN" &&
          eventsById.has(i.relationship.object),
      );

      for (const ctrl of controlEdges) {
        for (const part of partEdges) {
          if (ctrl.relationship.object !== part.relationship.subject) continue;
          const source = ctrl.relationship.subject;
          const bridge = ctrl.relationship.object;
          const targetEvent = part.relationship.object;
          const pair = pairKey(source, targetEvent);
          if (directPairs.has(pair) || forbiddenPairs.has(pair)) continue;

          push(
            makeCandidate({
              method: "missing_links",
              method_version: "1.0.0",
              priority: 66,
              question: `${resolveNodeLabel(nodeMap, source)} controls/owns ${resolveNodeLabel(nodeMap, bridge)} (${ctrl.relationship.id}), which participated in ${targetEvent} (${part.relationship.id}): is a direct operational or awareness link for ${source} missing?`,
              refs: [source, bridge, targetEvent, ctrl.relationship.id, part.relationship.id],
              evidences: [ctrl.relationship.id, part.relationship.id],
              alternative_explanations: [
                `${bridge} acted within routine operations without specific direction from ${source} for ${targetEvent}.`,
              ],
              falsifiers: [
                `Governance or operational records showing ${source} had no involvement in ${targetEvent}.`,
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

export const missingLinksGenerator: DiscoveryGenerator = createMissingLinksGenerator();
