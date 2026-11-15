import { COLLECTION_NAMES, type Dataset } from "../model/index.ts";
import type { Withheld } from "./publication.ts";

/**
 * Leak guard for the machine-readable surface (packages, feeds, article index,
 * sitemap, JSON-LD; FABLE D A15). A withheld ID may legitimately occur inside
 * free text or a free field of a public record (an entity ID such as `AP` is
 * also a publisher name), so the guard looks for it only where an ID is
 * structural: a string under an ID-bearing key (or inside an array under one),
 * or a path-like string (`records/<ID>.json`, `.../events/<ID>/`, `#<ID>`).
 * Verbatim `provenance` rows are skipped (their `id` is a legacy row ID).
 */
const ID_KEYS = new Set([
  "id",
  "subject",
  "object",
  "events",
  "entities",
  "relationships",
  "hypotheses",
  "sources",
  "exposures",
  "cited_in",
  "reported_in",
]);

/** IDs of the withheld registry that are not also public IDs. */
export function withheldIdSet(withheld: readonly Withheld[], published: Dataset): Set<string> {
  const publicIds = new Set(COLLECTION_NAMES.flatMap((n) => published[n].map((r) => r.id)));
  return new Set(withheld.map((w) => w.id).filter((id) => !publicIds.has(id)));
}

const pathLike = (value: string) =>
  !/\s/.test(value) && (/[#]/.test(value) || /(\/|\.(json|md|html))$/.test(value));

function pathIds(value: string): string[] {
  return value
    .split(/[/#?]/)
    .map((part) => part.replace(/(\.(it|en))?\.(json|md|html)$/, ""))
    .filter(Boolean);
}

/** Withheld IDs found in structural positions of a JSON value. */
export function leakedIds(value: unknown, withheld: ReadonlySet<string>): string[] {
  const found = new Set<string>();
  const visit = (node: unknown, key: string | null) => {
    if (typeof node === "string") {
      if (key !== null && ID_KEYS.has(key) && withheld.has(node)) found.add(node);
      if (pathLike(node)) for (const part of pathIds(node)) if (withheld.has(part)) found.add(part);
    } else if (Array.isArray(node)) {
      for (const item of node) visit(item, key);
    } else if (node && typeof node === "object") {
      for (const [k, item] of Object.entries(node)) {
        // `provenance` holds verbatim rows of the original files: their `id` is the
        // legacy row identifier (e.g. `EXT-001`), not a reference to a record.
        if (k !== "provenance") visit(item, k);
      }
    }
  };
  visit(value, null);
  return [...found].sort();
}

/** Withheld IDs among the `<loc>` URLs of a sitemap. */
export function leakedInSitemap(xml: string, withheld: ReadonlySet<string>): string[] {
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1] ?? "");
  return leakedIds(locs, withheld);
}
