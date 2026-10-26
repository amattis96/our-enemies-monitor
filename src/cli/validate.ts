import { readDataFiles } from "../pipeline/load.ts";
import { summarize, validateDataFiles } from "../pipeline/validate.ts";

const { issues, dataset } = validateDataFiles(readDataFiles());
const errors = issues.filter((i) => i.severity === "error");
const warnings = issues.filter((i) => i.severity === "warning");

for (const issue of warnings) console.warn(`warning  ${issue.file}: ${issue.message}`);
for (const issue of errors) console.error(`error    ${issue.file}: ${issue.message}`);

console.log("\nRecords:", summarize(dataset));
console.log(`${errors.length} error(s), ${warnings.length} warning(s)`);
process.exit(errors.length > 0 ? 1 : 0);
