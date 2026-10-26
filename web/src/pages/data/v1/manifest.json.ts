import { buildManifest, exportFiles } from "../../../../../src/site/exports.ts";
import { getModel } from "../../../lib/model.ts";

/** Export manifest: counts, commit and SHA-256 of every published data file. */
export function GET() {
  const dataset = getModel().dataset;
  const manifest = buildManifest(dataset, exportFiles(dataset));
  return new Response(`${JSON.stringify(manifest, null, 2)}\n`, {
    headers: { "Content-Type": "application/json" },
  });
}
