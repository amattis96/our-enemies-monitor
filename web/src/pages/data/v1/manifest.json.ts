import { getExports } from "../../../lib/model.ts";

/** Export manifest: counts, commit and SHA-256 of every published data file. */
export function GET() {
  return new Response(`${JSON.stringify(getExports().manifest, null, 2)}\n`, {
    headers: { "Content-Type": "application/json" },
  });
}
