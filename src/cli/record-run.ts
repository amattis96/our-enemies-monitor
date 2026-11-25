import { readFileSync } from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "../pipeline/paths.ts";
import { recordRunManifest } from "../runs/store.ts";

// pnpm runs:record <manifest.json> [...]: minimize, validate and store run
// manifests in docs/runs/manifests/ (append-only). Commit them on an
// agent/runs-* branch; never inside source, ingest or article PRs.
const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("usage: pnpm runs:record <manifest.json> [...]");
  process.exit(2);
}
let failed = false;
for (const file of files) {
  try {
    const result = recordRunManifest(JSON.parse(readFileSync(file, "utf8")));
    console.log(`${result.status}: ${path.relative(REPO_ROOT, result.path)}`);
  } catch (error) {
    failed = true;
    console.error(`${file}: ${(error as Error).message}`);
  }
}
if (failed) process.exitCode = 1;
