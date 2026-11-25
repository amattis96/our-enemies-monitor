import { classifyRelationship } from "../../claims/canonical-predicates.ts";
import { comparePartialDates, type Entity, type Event } from "../../model/index.ts";
import type { DiscoveryGenerator, GeneratedCandidate, GeneratorContext } from "./interface.ts";
import {
  type AttributionClaimRecord,
  buildNodeMap,
  type GeneratorDeps,
  makeCandidate,
  type ProceduralRecord,
  resolveGeneratorDeps,
  resolveNodeLabel,
} from "./open-triads.ts";

const SCALING_BACK_STATUSES = new Set(["acquitted", "proceedings_closed"]);
const SCALING_BACK_TEXT_RE =
  /(assolto|assolta|prosciolt|archiviato|archiviazione|acquitted|dismissed|proceedings_closed|ridimensiona|scaled back)/i;

function entityLifespanBounds(entity: Entity): { minStart: string | null; maxEnd: string | null } {
  const aliases = entity.aliases ?? [];
  if (aliases.length === 0) return { minStart: null, maxEnd: null };
  let minStart: string | null = null;
  let maxEnd: string | null = null;
  let hasOpenEnd = false;

  for (const alias of aliases) {
    if (alias.valid_from) {
      if (!minStart || comparePartialDates(alias.valid_from, minStart) < 0) {
        minStart = alias.valid_from;
      }
    }
    if (alias.valid_to === null) {
      hasOpenEnd = true;
    } else if (alias.valid_to) {
      if (!maxEnd || comparePartialDates(alias.valid_to, maxEnd) > 0) {
        maxEnd = alias.valid_to;
      }
    }
  }
  return { minStart, maxEnd: hasOpenEnd ? null : maxEnd };
}

/**
 * PK-11: Extended B15 contradiction detector.
 * Detects:
 * 1. Incompatible roles on the same target/event
 * 2. Relations outside entity lifespan or event temporal bounds
 * 3. Judgments/procedural acts scaling back existing accusations
 * 4. Discordant attributions across executor / intermediary / sponsor / claim levels
 */
export function createContradictionsGenerator(deps?: GeneratorDeps): DiscoveryGenerator {
  return {
    metadata: {
      id: "contradictions",
      version: "1.0.0",
      description:
        "Detects extended B15 contradictions: incompatible roles, out-of-lifespan relations, judgments scaling back accusations, and discordant attributions.",
    },
    generate(_context: GeneratorContext): GeneratedCandidate[] {
      const { dataset } = resolveGeneratorDeps(deps);
      const nodeMap = buildNodeMap(dataset);
      const eventsById = new Map<string, Event>(dataset.events.map((e) => [e.id, e]));
      const entitiesById = new Map<string, Entity>(dataset.entities.map((e) => [e.id, e]));
      const proceduralRecords: readonly ProceduralRecord[] = deps?.proceduralRecords ?? [];
      const attributionClaims: readonly AttributionClaimRecord[] = deps?.attributionClaims ?? [];

      const candidates: GeneratedCandidate[] = [];
      const seenKeys = new Set<string>();
      const push = (candidate: GeneratedCandidate) => {
        if (candidate.dedup_key && !seenKeys.has(candidate.dedup_key)) {
          seenKeys.add(candidate.dedup_key);
          candidates.push(candidate);
        }
      };

      // 1. Incompatible roles: same pair or entity holding mutually incompatible predicates
      //    (e.g., ACCUSED_OF vs CONTROLLED/OWNED/COMMISSIONED on same target, or inverted accuser/target).
      const byPair = new Map<
        string,
        { id: string; pred: string | null; subject: string; object: string }[]
      >();
      for (const rel of dataset.relationships) {
        const mapped = classifyRelationship(rel);
        const key = [rel.subject, rel.object].sort().join("|");
        const list = byPair.get(key) ?? [];
        list.push({
          id: rel.id,
          pred: mapped.mapping.canonical_predicate,
          subject: rel.subject,
          object: rel.object,
        });
        byPair.set(key, list);
      }

      for (const [, rels] of byPair.entries()) {
        if (rels.length < 2) continue;
        const hasAccused = rels.find((r) => r.pred === "ACCUSED_OF");
        const hasControlOrCommission = rels.find(
          (r) => r.pred === "CONTROLLED" || r.pred === "COMMISSIONED",
        );
        if (
          hasAccused &&
          hasControlOrCommission &&
          hasAccused.subject === hasControlOrCommission.object
        ) {
          push(
            makeCandidate({
              method: "contradictions",
              method_version: "1.0.0",
              priority: 85,
              question: `Incompatible roles detected between ${resolveNodeLabel(nodeMap, hasAccused.subject)} and ${resolveNodeLabel(nodeMap, hasAccused.object)}: ${hasAccused.id} (ACCUSED_OF) vs ${hasControlOrCommission.id} (${hasControlOrCommission.pred}). Verify role assignment.`,
              refs: [
                hasAccused.id,
                hasControlOrCommission.id,
                hasAccused.subject,
                hasAccused.object,
              ],
              evidences: [hasAccused.id, hasControlOrCommission.id],
              alternative_explanations: [
                "Roles may apply to different time periods or distinct sub-events.",
              ],
              falsifiers: [
                "Primary documents confirming non-overlapping temporal scope or distinct roles.",
              ],
              estimated_cost: 2,
            }),
          );
        }
      }

      // 2. Relations outside entity lifespan or inverted/mismatched event dates
      for (const rel of dataset.relationships) {
        if (
          rel.valid_from &&
          rel.valid_to &&
          comparePartialDates(rel.valid_from, rel.valid_to) > 0
        ) {
          push(
            makeCandidate({
              method: "contradictions",
              method_version: "1.0.0",
              priority: 80,
              question: `Temporal contradiction on ${rel.id}: valid_from (${rel.valid_from}) is after valid_to (${rel.valid_to}).`,
              refs: [rel.id, rel.subject, rel.object],
              evidences: [rel.id],
              alternative_explanations: ["Transcription or date-precision error in source import."],
              falsifiers: ["Original source record showing corrected date bounds."],
              estimated_cost: 1,
            }),
          );
        }

        for (const endpointId of [rel.subject, rel.object]) {
          const entity = entitiesById.get(endpointId);
          if (!entity) continue;
          const bounds = entityLifespanBounds(entity);
          if (
            bounds.maxEnd &&
            rel.valid_from &&
            comparePartialDates(rel.valid_from, bounds.maxEnd) > 0
          ) {
            push(
              makeCandidate({
                method: "contradictions",
                method_version: "1.0.0",
                priority: 82,
                question: `Relation ${rel.id} starts at ${rel.valid_from}, outside the recorded lifespan of ${entity.name.it} (ended ${bounds.maxEnd}). Verify entity continuity or successor entity.`,
                refs: [rel.id, entity.id],
                evidences: [rel.id],
                alternative_explanations: [
                  "Entity continued operating under a new alias or unrecorded successor.",
                ],
                falsifiers: ["Corporate registry or official act extending entity existence."],
                estimated_cost: 2,
              }),
            );
          }
        }

        for (const evId of rel.events) {
          const ev = eventsById.get(evId);
          if (!ev) continue;
          if (rel.valid_to && comparePartialDates(ev.date.start, rel.valid_to) > 0) {
            push(
              makeCandidate({
                method: "contradictions",
                method_version: "1.0.0",
                priority: 75,
                question: `Relation ${rel.id} ended at ${rel.valid_to} but is linked to later event ${ev.id} (${ev.date.start}). Verify temporal validity.`,
                refs: [rel.id, ev.id, rel.subject, rel.object],
                evidences: [rel.id, ev.id],
                alternative_explanations: [
                  "The event is a retrospective report or judicial follow-up rather than the act itself.",
                ],
                falsifiers: ["Event date or relationship valid_to confirmed as retrospective."],
                estimated_cost: 1,
              }),
            );
          }
        }
      }

      // 3. Judgments scaling back accusations
      const accusationRels = dataset.relationships.filter((r) => {
        const pred = classifyRelationship(r).mapping.canonical_predicate;
        return pred === "ACCUSED_OF" || r.evidence_status === "allegation";
      });

      for (const acc of accusationRels) {
        const matchingProc = proceduralRecords.filter(
          (p) =>
            (p.entity_id === acc.subject || p.entity_id === acc.object) &&
            SCALING_BACK_STATUSES.has(p.status),
        );
        for (const proc of matchingProc) {
          push(
            makeCandidate({
              method: "contradictions",
              method_version: "1.0.0",
              priority: 90,
              question: `Judicial/procedural outcome ${proc.id} (${proc.status} on ${proc.date}) scales back accusation ${acc.id} (${acc.subject} -> ${acc.object}). Verify caveat and current status.`,
              refs: [acc.id, proc.id, acc.subject, acc.object],
              evidences: [acc.id, proc.id],
              alternative_explanations: [
                "Acquittal or closure may apply to a subset of charges while others remain open.",
              ],
              falsifiers: ["Full judgment text showing scope of acquittal vs remaining claims."],
              estimated_cost: 2,
            }),
          );
        }

        const justiceEvents = dataset.events.filter(
          (ev) =>
            ev.themes.includes("justice") &&
            (acc.events.includes(ev.id) ||
              SCALING_BACK_TEXT_RE.test(`${ev.title.it} ${ev.description.it}`)),
        );
        for (const jev of justiceEvents) {
          if (!SCALING_BACK_TEXT_RE.test(`${jev.title.it} ${jev.description.it}`)) continue;
          if (!acc.events.includes(jev.id)) continue;
          push(
            makeCandidate({
              method: "contradictions",
              method_version: "1.0.0",
              priority: 88,
              question: `Justice event ${jev.id} appears to scale back or dismiss allegation ${acc.id}. Verify whether ${acc.id} requires a caveat or status update.`,
              refs: [acc.id, jev.id, acc.subject, acc.object],
              evidences: [acc.id, jev.id],
              alternative_explanations: ["Appeal or parallel proceeding remains active."],
              falsifiers: ["Official court order confirming final disposition."],
              estimated_cost: 2,
            }),
          );
        }
      }

      // 4. Discordant attributions across executor / intermediary / sponsor / claim levels
      const claimsByTargetLevel = new Map<string, AttributionClaimRecord[]>();
      for (const claim of attributionClaims) {
        const key = `${claim.target_id}|${claim.level}`;
        const list = claimsByTargetLevel.get(key) ?? [];
        list.push(claim);
        claimsByTargetLevel.set(key, list);
      }

      for (const [key, claims] of claimsByTargetLevel.entries()) {
        if (claims.length < 2) continue;
        const [targetId, level] = key.split("|");
        const distinctActors = new Set(claims.map((c) => c.attributed_actor_id));
        const hasAttribution = claims.some((c) => c.stance === "attribution");
        const hasDenial = claims.some((c) => c.stance === "denial");

        if (distinctActors.size > 1 || (hasAttribution && hasDenial)) {
          const claimIds = claims.map((c) => c.id);
          const sourceIds = claims.map((c) => c.source_id);
          const actorIds = [...distinctActors];
          push(
            makeCandidate({
              method: "contradictions",
              method_version: "1.0.0",
              priority: 92,
              question: `Verification request (${level} level): discordant attributions for ${resolveNodeLabel(nodeMap, targetId ?? "")} across ${claimIds.join(", ")} (actors: ${actorIds.join(", ")}, sources: ${[...new Set(sourceIds)].join(", ")}).`,
              refs: [targetId ?? "", ...claimIds, ...actorIds, ...sourceIds].filter(Boolean),
              evidences: claimIds,
              alternative_explanations: [
                `Sources may refer to different ${level} roles or distinct phases of the same operation.`,
              ],
              falsifiers: [
                `Independent primary evidence reconciling the ${level}-level attribution for ${targetId ?? "target"}.`,
              ],
              estimated_cost: 3,
            }),
          );
        }
      }

      // Also detect discordant attribution relationships in dataset.relationships
      // (multiple distinct subjects claiming COMMISSIONED/ATTRIBUTED_BY_AUTHORITY/ACCUSED_OF for the same object/event)
      const attrByObject = new Map<string, typeof dataset.relationships>();
      for (const rel of dataset.relationships) {
        const pred = classifyRelationship(rel).mapping.canonical_predicate;
        if (
          pred === "COMMISSIONED" ||
          pred === "ATTRIBUTED_BY_AUTHORITY" ||
          pred === "ACCUSED_OF"
        ) {
          const list = attrByObject.get(rel.object) ?? [];
          list.push(rel);
          attrByObject.set(rel.object, list);
        }
      }

      for (const [targetId, rels] of attrByObject.entries()) {
        const distinctSubjects = new Set(rels.map((r) => r.subject));
        const distinctPreds = new Set(
          rels.map((r) => classifyRelationship(r).mapping.canonical_predicate),
        );
        if (distinctSubjects.size > 1 && distinctPreds.has("COMMISSIONED")) {
          const relIds = rels.map((r) => r.id);
          push(
            makeCandidate({
              method: "contradictions",
              method_version: "1.0.0",
              priority: 86,
              question: `Verification request (sponsor/executor level): multiple actors (${[...distinctSubjects].join(", ")}) linked to ${resolveNodeLabel(nodeMap, targetId)} via ${relIds.join(", ")}. Verify distinct roles vs discordant attribution.`,
              refs: [targetId, ...distinctSubjects, ...relIds],
              evidences: relIds,
              alternative_explanations: ["Joint operation or distinct sponsor vs executor roles."],
              falsifiers: ["Primary attribution document clarifying chain of command."],
              estimated_cost: 2,
            }),
          );
        }
      }

      return candidates.sort((a, b) => (a.dedup_key ?? "").localeCompare(b.dedup_key ?? ""));
    },
  };
}

export const contradictionsGenerator: DiscoveryGenerator = createContradictionsGenerator();
