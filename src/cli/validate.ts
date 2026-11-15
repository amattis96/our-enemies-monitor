import { readInferenceRegistry, validateInferenceRegistry } from "../editorial/inferences.ts";
import { readDataFiles } from "../pipeline/load.ts";
import { type Issue, summarize, validateDataFiles } from "../pipeline/validate.ts";

const { issues, dataset } = validateDataFiles(readDataFiles());

/** B15: the forbidden-inference registry is checked against the same dataset. */
function registryIssues(): Issue[] {
  try {
    return validateInferenceRegistry(readInferenceRegistry(), dataset);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return [{ severity: "error", file: "docs/audit/inferences/registry.v1.json", message }];
  }
}
issues.push(...registryIssues());

const errors = issues.filter((i) => i.severity === "error");
const warnings = issues.filter((i) => i.severity === "warning");

for (const issue of warnings) console.warn(`warning  ${issue.file}: ${issue.message}`);
for (const issue of errors) console.error(`error    ${issue.file}: ${issue.message}`);

console.log("\nRecords:", summarize(dataset));
console.log(`${errors.length} error(s), ${warnings.length} warning(s)`);
process.exit(errors.length > 0 ? 1 : 0);
