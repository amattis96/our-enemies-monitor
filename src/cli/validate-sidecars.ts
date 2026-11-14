import { existsSync } from "node:fs";
import { checkArchive, INCREMENTAL_DIR, readArchive } from "../pipeline/ingest/archive.ts";
import { readDataFiles } from "../pipeline/load.ts";
import { repoPath } from "../pipeline/paths.ts";
import { validateDataFiles } from "../pipeline/validate.ts";

// Checks every archived proposals sidecar in sources/incremental/ (part of
// pnpm check): contract, file naming, uniqueness of Fonte_NN, code and file,
// and no collision with a corpus document registered for another file.
// Warnings list Markdown sources without a sidecar (from Fonte_12) and the
// queue of sidecars not yet ingested. Exit code 1 on errors.

const dir = repoPath(INCREMENTAL_DIR);
const archive = existsSync(dir)
  ? readArchive(dir)
  : { names: [], sidecars: [], invalid: [], markdown: new Map<string, string>() };
const { dataset } = validateDataFiles(readDataFiles());
const issues = checkArchive(archive, dataset);
const errors = issues.filter((i) => i.severity === "error");
const warnings = issues.filter((i) => i.severity === "warning");

for (const issue of warnings) console.warn(`warning  ${issue.file}: ${issue.message}`);
for (const issue of errors) console.error(`error    ${issue.file}: ${issue.message}`);
console.log(
  `${archive.sidecars.length + archive.invalid.length} sidecar(s), ${archive.markdown.size} Markdown source(s): ${errors.length} error(s), ${warnings.length} warning(s)`,
);
process.exit(errors.length > 0 ? 1 : 0);
