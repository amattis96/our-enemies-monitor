import { designAsset } from "../lib/design.ts";

/** Favicon (adapts to the colour scheme), served from docs/design/assets/. */
export function GET(): Response {
  return new Response(designAsset("favicon.svg"), {
    headers: { "Content-Type": "image/svg+xml" },
  });
}
