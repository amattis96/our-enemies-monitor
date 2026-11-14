import { readM5References } from "../editorial/m5.ts";
import type { Dataset } from "../model/index.ts";
import {
  type M5References,
  personReference,
  publicationEligible,
} from "../pipeline/evidence-policy.ts";

/**
 * Build a public projection without changing the canonical Git archive.
 * The legacy imported baseline remains visible but is explicitly provisional.
 * Unreviewed proposals, pending events and unsourced person links do not publish.
 */
export function publishedDataset(
  dataset: Dataset,
  references: M5References = readM5References(),
): Dataset {
  const invalidSources = new Set(
    dataset.sources
      .filter(
        (source) => source.review.status === "imported_unreviewed" && !publicationEligible(source),
      )
      .map((source) => source.id),
  );
  const eligible = publicationEligible;
  const sourcesValid = (record: { sources: string[] }) =>
    record.sources.every((id) => !invalidSources.has(id));
  const events = dataset.events.filter(
    (event) => eligible(event) && sourcesValid(event) && event.timeline_status === "integrated",
  );
  const entities = dataset.entities.filter(eligible);
  const eventIds = new Set(events.map((event) => event.id));
  const nodeIds = new Set([...eventIds, ...entities.map((entity) => entity.id)]);
  const persons = new Set(
    dataset.entities.filter((entity) => entity.kind === "person").map((entity) => entity.id),
  );
  const linked = (record: { subject: string; object: string; events: string[] }) =>
    nodeIds.has(record.subject) &&
    nodeIds.has(record.object) &&
    record.events.every((id) => eventIds.has(id));
  const relationships = dataset.relationships.filter(
    (relation) =>
      eligible(relation) &&
      sourcesValid(relation) &&
      linked(relation) &&
      ((!persons.has(relation.subject) && !persons.has(relation.object)) ||
        !["missing", "unregistered"].includes(
          personReference(relation, dataset.sources, references),
        )),
  );
  const hypotheses = dataset.hypotheses.filter(
    (hypothesis) => eligible(hypothesis) && sourcesValid(hypothesis) && linked(hypothesis),
  );
  const exposures = dataset.exposures.filter((record) => eligible(record) && sourcesValid(record));

  // A published claim may cite a source whose metadata is still under review.
  // Keep that reference with its real review status instead of breaking links.
  const cited = new Set(
    [...events, ...relationships, ...hypotheses, ...exposures].flatMap((record) => record.sources),
  );
  const selected = dataset.sources.filter(
    (source) =>
      eligible(source) || (source.review.status === "needs_review" && cited.has(source.id)),
  );
  const sourceIds = new Set(selected.map((source) => source.id));
  const sources = selected.map((source) => ({
    ...source,
    cited_in: source.cited_in.filter((id) => sourceIds.has(id)),
  }));
  return { events, entities, relationships, hypotheses, sources, exposures };
}
