import { readFileSync } from "node:fs";
import { z } from "zod";
import type { Dataset, Relationship } from "../model/index.ts";
import { repoPath } from "../pipeline/paths.ts";
import type { Issue } from "../pipeline/validate.ts";

/**
 * B15 registry of forbidden inferences and of the reading of negative caveats.
 * A versioned editorial file (like the M5 audit), validated by `pnpm validate`
 * against the canonical data and projected publicly by `src/site/inferences.ts`.
 *
 * Authority rule (conservative): an inference is forbidden only when a cited
 * source or the maintainer declares it; nothing expires automatically; agents
 * may only add `proposta` entries. `revisionata` and `lifted` are set by the
 * maintainer.
 */

export const INFERENCE_REGISTRY_PATH = "docs/audit/inferences/registry.v1.json";

/** Generic participation caveat added by the baseline import (not a negation). */
export const PARTICIPATION_BOILERPLATE = "Relazione di presenza/ruolo";
export const NEGATION = /(?<![\p{L}])(non|nessun[ao]?|né)(?![\p{L}])/iu;

/** Lexical detector: a caveat containing a negation word. Not a classification. */
export function isNegativeCaveat(relation: Pick<Relationship, "caveat">): boolean {
  const text = relation.caveat?.it ?? "";
  return !text.startsWith(PARTICIPATION_BOILERPLATE) && NEGATION.test(text);
}

/** The five categories of CONSOLIDATED_FINDINGS §3.5, plus a scope precision. */
export const CAVEAT_CATEGORIES = [
  "claim_negation",
  "transitivity_limit",
  "denial",
  "not_established",
  "reported_position",
  "scope_precision",
] as const;
export type CaveatCategory = (typeof CAVEAT_CATEGORIES)[number];

const ReviewState = z.enum(["proposta", "revisionata"]);
const Text = z.strictObject({ it: z.string().min(10), en: z.string().min(10) });
const Day = z.iso.date();

const Declaration = z.strictObject({
  kind: z.enum(["source", "maintainer"]),
  /** Source record carrying the declaration (e.g. S09). */
  source: z.string().nullable(),
  /** Canonical record whose text carries the declaration (e.g. H06). */
  record: z.string().nullable(),
  locator: z.string().min(3),
});

const Lifted = z.strictObject({
  on: Day,
  by: z.literal("maintainer"),
  source: z.string().min(1),
  note: z.string().min(10),
});

const ForbiddenInference = z.strictObject({
  id: z.string().regex(/^FI-\d{3}$/),
  /** Canonical node pairs (unordered); empty when the source names no canonical node. */
  pairs: z.array(z.tuple([z.string().min(1), z.string().min(1)])),
  statement: Text,
  declared_by: Declaration,
  hypotheses: z.array(z.string().regex(/^H\d{2,3}$/)),
  note: z.string().nullable(),
  state: ReviewState,
  proposed_by: z.string().min(3),
  reviewer: z.string().nullable(),
  reviewed_on: Day.nullable(),
  lifted: Lifted.nullable(),
});

const CaveatClassification = z.strictObject({
  relationship: z.string().regex(/^G-\d{4}$/),
  categories: z.array(z.enum(CAVEAT_CATEGORIES)).min(1),
  interrupts_composition: z.boolean(),
  note: z.string().nullable(),
  state: ReviewState,
  proposed_by: z.string().min(3),
  reviewer: z.string().nullable(),
  reviewed_on: Day.nullable(),
});

export const InferenceRegistry = z.strictObject({
  registry: z.literal("forbidden-inferences"),
  version: z.literal(1),
  as_of_commit: z.string().regex(/^[a-f0-9]{7,40}$/),
  notes: z.array(z.string().min(10)),
  forbidden_inferences: z.array(ForbiddenInference),
  caveat_classifications: z.array(CaveatClassification),
});
export type InferenceRegistry = z.infer<typeof InferenceRegistry>;
export type ForbiddenInference = z.infer<typeof ForbiddenInference>;
export type CaveatClassification = z.infer<typeof CaveatClassification>;

export function readInferenceRegistry(): InferenceRegistry {
  return InferenceRegistry.parse(
    JSON.parse(readFileSync(repoPath(INFERENCE_REGISTRY_PATH), "utf8")),
  );
}

/** Forbidden pairs still in force (not lifted), as unordered keys. */
export function activePairKeys(registry: InferenceRegistry): Map<string, string[]> {
  const keys = new Map<string, string[]>();
  for (const entry of registry.forbidden_inferences) {
    if (entry.lifted) continue;
    for (const pair of entry.pairs) {
      const key = pairKey(pair[0], pair[1]);
      keys.set(key, [...(keys.get(key) ?? []), entry.id]);
    }
  }
  return keys;
}

export const pairKey = (a: string, b: string) => [a, b].sort().join("|");

function reviewIssues(
  label: string,
  item: { state: string; reviewer: string | null; reviewed_on: string | null },
): string[] {
  if (item.state === "revisionata" && (!item.reviewer || !item.reviewed_on)) {
    return [`${label}: revisionata requires reviewer and reviewed_on`];
  }
  if (item.state === "proposta" && (item.reviewer || item.reviewed_on)) {
    return [`${label}: proposta must not carry reviewer or reviewed_on`];
  }
  return [];
}

/**
 * Referential and policy checks against the canonical dataset. Errors: unknown
 * IDs, duplicates, review-state inconsistencies, a maintainer declaration or a
 * lift that is not `revisionata`, and a direct relationship joining a pair
 * forbidden by a `revisionata` entry still in force. Warnings: the same for a
 * `proposta` entry, and a negative caveat with no classification.
 */
export function validateInferenceRegistry(registry: InferenceRegistry, dataset: Dataset): Issue[] {
  const file = INFERENCE_REGISTRY_PATH;
  const errors: string[] = [];
  const warnings: string[] = [];
  const nodes = new Set([...dataset.entities, ...dataset.events].map((r) => r.id));
  const sources = new Set(dataset.sources.map((s) => s.id));
  const hypotheses = new Set(dataset.hypotheses.map((h) => h.id));
  const relationships = new Map(dataset.relationships.map((r) => [r.id, r]));
  const records = new Set([...nodes, ...hypotheses, ...relationships.keys()]);

  const ids = new Set<string>();
  for (const entry of registry.forbidden_inferences) {
    const label = entry.id;
    if (ids.has(entry.id)) errors.push(`duplicate forbidden inference ${entry.id}`);
    ids.add(entry.id);
    for (const [a, b] of entry.pairs) {
      for (const id of [a, b]) if (!nodes.has(id)) errors.push(`${label}: unknown node ${id}`);
      if (a === b) errors.push(`${label}: pair joins ${a} to itself`);
    }
    for (const h of entry.hypotheses) {
      if (!hypotheses.has(h)) errors.push(`${label}: unknown hypothesis ${h}`);
    }
    const d = entry.declared_by;
    if (d.source !== null && !sources.has(d.source)) {
      errors.push(`${label}: unknown declaring source ${d.source}`);
    }
    if (d.record !== null && !records.has(d.record)) {
      errors.push(`${label}: unknown declaring record ${d.record}`);
    }
    if (d.kind === "source" && d.source === null && d.record === null) {
      errors.push(`${label}: a source declaration needs a source or a record`);
    }
    if (d.kind === "maintainer" && entry.state !== "revisionata") {
      errors.push(`${label}: only the maintainer declares; a maintainer entry must be revisionata`);
    }
    if (entry.lifted && entry.state !== "revisionata") {
      errors.push(`${label}: only a revisionata entry can be lifted`);
    }
    errors.push(...reviewIssues(label, entry));
  }

  const active = activePairKeys(registry);
  const reviewed = new Set(
    registry.forbidden_inferences.filter((e) => e.state === "revisionata").map((e) => e.id),
  );
  for (const r of dataset.relationships) {
    const hits = active.get(pairKey(r.subject, r.object));
    if (!hits) continue;
    const message = `${r.id} joins ${r.subject} and ${r.object}, a pair forbidden by ${hits.join(", ")}: lift the entry (maintainer) or remove the relationship`;
    // Only a reviewed declaration blocks; an unreviewed proposal warns.
    if (hits.some((id) => reviewed.has(id))) errors.push(message);
    else warnings.push(message);
  }

  const classified = new Set<string>();
  for (const c of registry.caveat_classifications) {
    const label = `classification ${c.relationship}`;
    if (classified.has(c.relationship)) errors.push(`duplicate ${label}`);
    classified.add(c.relationship);
    const r = relationships.get(c.relationship);
    if (!r) errors.push(`${label}: unknown relationship`);
    else if (!r.caveat) errors.push(`${label}: relationship has no caveat`);
    if (new Set(c.categories).size !== c.categories.length) {
      errors.push(`${label}: repeated category`);
    }
    errors.push(...reviewIssues(label, c));
  }
  for (const r of dataset.relationships) {
    if (isNegativeCaveat(r) && !classified.has(r.id)) {
      warnings.push(
        `${r.id}: caveat contains a negation but has no classification in the registry`,
      );
    }
  }

  return [
    ...errors.map((message) => ({ severity: "error" as const, file, message })),
    ...warnings.map((message) => ({ severity: "warning" as const, file, message })),
  ];
}
