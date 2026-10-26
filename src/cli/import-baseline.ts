import { readdirSync } from "node:fs";
import { importBaseline } from "../pipeline/baseline/import.ts";
import { datasetToFiles, readDataFiles, writeDataFiles } from "../pipeline/load.ts";
import { DATA_DIR } from "../pipeline/paths.ts";
import { summarize } from "../pipeline/validate.ts";

// One-time import of sources/original/ into data/. Overwriting existing data
// would discard editorial changes, so it requires --force.
const force = process.argv.includes("--force");
const existing = readDataFiles();
if (existing.length > 0 && !force) {
  console.error(
    `data/ already contains ${existing.length} records. The baseline import is one-time;\n` +
      "re-running it would discard editorial changes. Pass --force only if that is intended.",
  );
  process.exit(1);
}

const dataset = importBaseline();
writeDataFiles(datasetToFiles(dataset));
console.log(`Imported baseline into ${DATA_DIR}:`, summarize(dataset));
console.log("Collections:", readdirSync(DATA_DIR).join(", "));
