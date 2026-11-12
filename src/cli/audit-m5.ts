import { readM5Audit, validateM5Audit } from "../editorial/m5.ts";
import { readDataFiles } from "../pipeline/load.ts";
import { validateDataFiles } from "../pipeline/validate.ts";

const validated = validateDataFiles(readDataFiles());
const errors = validated.issues
  .filter((issue) => issue.severity === "error")
  .map((issue) => issue.file + ": " + issue.message);
if (errors.length === 0) {
  const audit = readM5Audit();
  errors.push(...validateM5Audit(audit, validated.dataset));
  console.log(JSON.stringify({
    version: audit.version,
    relationship_reviews: audit.relationship_reviews.length,
    unresolved_primary_sources: audit.relationship_reviews
      .filter((item) => item.assessment === "primary_not_found")
      .map((item) => item.id),
    fonte09_decisions: audit.fonte09_decisions.length,
    atomic_claims: audit.atomic_claims.length,
    approved_claims: audit.atomic_claims.filter((item) => item.human_approved).length,
    issues: errors,
  }, null, 2));
} else {
  for (const error of errors) console.error(error);
}
if (errors.length > 0) process.exitCode = 1;
