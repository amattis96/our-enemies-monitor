import { writeFileSync } from "node:fs";
import path from "node:path";
import { COLLECTIONS } from "../model/index.ts";
import { type DataFile, readDataFiles } from "../pipeline/load.ts";
import { DATA_DIR } from "../pipeline/paths.ts";
import { serializeRecord } from "../pipeline/serialize.ts";

// Rewrite every valid data file in canonical form. Invalid files are left
// untouched and reported; run pnpm validate for details.
function parse(file: DataFile): unknown {
  try {
    const parsed = COLLECTIONS[file.collection].safeParse(JSON.parse(file.text));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

let changed = 0;
let invalid = 0;
for (const file of readDataFiles()) {
  const record = parse(file);
  if (record === undefined) {
    invalid++;
    console.error(`skipped invalid file ${file.path}`);
    continue;
  }
  const text = serializeRecord(record);
  if (text !== file.text) {
    writeFileSync(path.join(DATA_DIR, file.path), text);
    changed++;
  }
}
console.log(`${changed} file(s) reformatted, ${invalid} invalid file(s) skipped`);
process.exit(invalid > 0 ? 1 : 0);
