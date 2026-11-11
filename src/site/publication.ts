import type { Dataset, Review } from "../model/index.ts";

/**
 * Build a public projection without changing the canonical Git archive.
 * The legacy imported baseline remains visible but is explicitly provisional.
 * Unreviewed proposals, pending events and unsourced person links do not publish.
 */
export function publishedDataset(dataset: Dataset): Dataset {
  const eligible = (record: { review: Review }) => record.review.status !== "needs_review";
  const events = dataset.events.filter(
    (event) => eligible(event) && event.timeline_status === "integrated",
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
      linked(relation) &&
      (relation.primary_url !== null ||
        (!persons.has(relation.subject) && !persons.has(relation.object))),
  );
  const hypotheses = dataset.hypotheses.filter(
    (hypothesis) => eligible(hypothesis) && linked(hypothesis),
  );
  const exposures = dataset.exposures.filter(eligible);

  // A published claim may cite a source whose metadata is still under review.
  // Keep that reference with its real review status instead of breaking links.
  const cited = new Set(
    [...events, ...relationships, ...hypotheses, ...exposures].flatMap((record) => record.sources),
  );
  const selected = dataset.sources.filter((source) => eligible(source) || cited.has(source.id));
  const sourceIds = new Set(selected.map((source) => source.id));
  const sources = selected.map((source) => ({
    ...source,
    cited_in: source.cited_in.filter((id) => sourceIds.has(id)),
  }));
  return { events, entities, relationships, hypotheses, sources, exposures };
}
