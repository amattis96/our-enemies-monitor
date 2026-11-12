import { designAsset } from "../lib/design.ts";

/** The Dossier icon sprite, served from docs/design/assets/icons.svg. */
export function GET(): Response {
  const sprite = designAsset("icons.svg").replace(' style="display:none"', "");
  return new Response(sprite, { headers: { "Content-Type": "image/svg+xml" } });
}
