import { readFileSync } from "node:fs";
import { repoPath } from "../../../src/pipeline/paths.ts";

/**
 * Design assets are read from docs/design/ (the single source of truth of the
 * Dossier design system) at build time.
 */
export function designAsset(path: string): string {
  return readFileSync(repoPath(`docs/design/assets/${path}`), "utf8");
}

const cache = new Map<string, string>();

/**
 * Inline SVG markup of an explanatory illustration or of the logo, made
 * decorative (aria-hidden, no title) and with IDs prefixed so the same file
 * can appear twice on a page.
 */
export function inlineSvg(path: string, prefix = ""): string {
  const key = `${path}|${prefix}`;
  const hit = cache.get(key);
  if (hit) return hit;
  let svg = designAsset(path)
    .replace(/<title[^>]*>.*?<\/title>/s, "")
    .replace(/\s(role|aria-labelledby)="[^"]*"/g, "")
    .replace(/<!--.*?-->/gs, "");
  if (!svg.includes("aria-hidden")) svg = svg.replace("<svg ", '<svg aria-hidden="true" ');
  if (prefix) {
    svg = svg
      .replace(/id="([^"]+)"/g, `id="${prefix}-$1"`)
      .replace(/href="#([^"]+)"/g, `href="#${prefix}-$1"`)
      .replace(/url\(#([^)]+)\)/g, `url(#${prefix}-$1)`);
  }
  cache.set(key, svg);
  return svg;
}
