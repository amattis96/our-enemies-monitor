import { buildCyberStixBundle, serializeCyberStixBundle } from "../../../../../src/site/stix.ts";
import { getPublication } from "../../../lib/model.ts";

/** Cyber-only STIX 2.1 bundle from the public projection (excludes non-cyber and withheld records). */
export function GET() {
  const bundle = buildCyberStixBundle(getPublication());
  return new Response(serializeCyberStixBundle(bundle), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
