import { readM5References } from "../editorial/m5.ts";
import { personReference } from "../pipeline/evidence-policy.ts";
import { readDataFiles } from "../pipeline/load.ts";
import { summarize, validateDataFiles } from "../pipeline/validate.ts";
import { publicationReport } from "../site/publication.ts";

const { issues, dataset } = validateDataFiles(readDataFiles());
const errors = issues.filter((issue) => issue.severity === "error");
if (errors.length > 0) {
  for (const issue of errors) console.error(issue);
  process.exitCode = 1;
} else {
  const report = publicationReport(dataset);
  const visible = report.dataset;
  const persons = new Set(
    dataset.entities.filter((entity) => entity.kind === "person").map((entity) => entity.id),
  );
  const missingPrimary = dataset.relationships
    .filter(
      (relation) =>
        relation.primary_url === null &&
        (persons.has(relation.subject) || persons.has(relation.object)),
    )
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((relation) => ({
      id: relation.id,
      subject: relation.subject,
      predicate: relation.predicate,
      object: relation.object,
      evidence_level: relation.evidence_level,
      evidence_status: relation.evidence_status,
      source_ids: relation.sources,
      review_status: relation.review.status,
      reason: "missing primary_url for a named-person relationship",
    }));
  const references = readM5References();
  const unregisteredPrimary = dataset.relationships
    .filter(
      (relation) =>
        (persons.has(relation.subject) || persons.has(relation.object)) &&
        personReference(relation, dataset.sources, references) === "unregistered",
    )
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((relation) => ({
      id: relation.id,
      primary_url: relation.primary_url,
      source_ids: relation.sources,
      reason: "primary_url is not registered for this relationship",
    }));
  const countsByReview = (collection: keyof typeof dataset) =>
    Object.fromEntries(
      ["imported_unreviewed", "needs_review", "reviewed"].map((status) => [
        status,
        dataset[collection].filter((record) => record.review.status === status).length,
      ]),
    );
  console.log(
    JSON.stringify(
      {
        policy: "M5 quarantine; historical imported baseline remains provisional",
        canonical: summarize(dataset),
        published: summarize(visible),
        withheld_counts: report.counts,
        withheld: report.withheld,
        hypothesis_projections: report.projections,
        review_states: Object.fromEntries(
          (Object.keys(dataset) as (keyof typeof dataset)[]).map((name) => [
            name,
            countsByReview(name),
          ]),
        ),
        named_person_relationships_missing_primary: missingPrimary,
        named_person_relationships_unregistered_primary: unregisteredPrimary,
      },
      null,
      2,
    ),
  );
}
