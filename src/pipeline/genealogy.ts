import type { Source } from "../model/index.ts";

/**
 * Source genealogy (ADR-05, B17). Pure functions over the optional
 * `origin_type`, `derived_from` and `relies_on` fields of source records.
 *
 * A root is where a chain of sources ends. `derived_from` (copy, relay,
 * rewrite, consolidation) and `relies_on` (the act or statement a source
 * reports) both point towards the root; a source with neither is its own
 * root, except a corpus synthesis, which is never a root. Two references
 * with the same root count once. A source whose origin is not determined is
 * still counted as its own root but listed as `undetermined`: absence of the
 * fields is "not known", never "primary".
 */

export type GenealogySource = Pick<
  Source,
  "id" | "type" | "origin_type" | "derived_from" | "relies_on"
>;

export type GenealogyIssue = { severity: "error" | "warning"; id: string; message: string };

const parentsOf = (source: GenealogySource): string[] => [
  ...(source.derived_from ?? []),
  ...(source.relies_on ?? []),
];

/** Structural checks: references, self-links, type coherence and cycles. */
export function genealogyIssues(sources: readonly GenealogySource[]): GenealogyIssue[] {
  const byId = new Map(sources.map((s) => [s.id, s]));
  const issues: GenealogyIssue[] = [];
  for (const source of sources) {
    for (const field of ["derived_from", "relies_on"] as const) {
      for (const ref of source[field] ?? []) {
        if (ref === source.id)
          issues.push({ severity: "error", id: source.id, message: `${field} cites itself` });
        else if (!byId.has(ref))
          issues.push({
            severity: "error",
            id: source.id,
            message: `${field} "${ref}" does not exist`,
          });
      }
    }
    const corpus = source.type === "corpus_document";
    if (source.origin_type === "corpus_synthesis" && !corpus)
      issues.push({
        severity: "error",
        id: source.id,
        message: "origin_type corpus_synthesis is reserved for corpus documents",
      });
    if (corpus && source.origin_type && source.origin_type !== "corpus_synthesis")
      issues.push({
        severity: "error",
        id: source.id,
        message: `corpus document with origin_type "${source.origin_type}"`,
      });
    if (source.origin_type === "republication" && !source.derived_from?.length)
      issues.push({
        severity: "warning",
        id: source.id,
        message: "republication without derived_from: counted as its own root",
      });
  }
  for (const cycle of genealogyCycles(sources)) {
    issues.push({
      severity: "error",
      id: cycle[0] as string,
      message: `circular genealogy: ${[...cycle, cycle[0]].join(" → ")}`,
    });
  }
  return issues;
}

/** Every distinct cycle through derived_from/relies_on, rotated to its smallest ID. */
export function genealogyCycles(sources: readonly GenealogySource[]): string[][] {
  const byId = new Map(sources.map((s) => [s.id, s]));
  const state = new Map<string, "open" | "done">();
  const stack: string[] = [];
  const found = new Map<string, string[]>();
  const visit = (id: string) => {
    state.set(id, "open");
    stack.push(id);
    const source = byId.get(id);
    for (const next of source ? parentsOf(source) : []) {
      if (next === id || !byId.has(next)) continue; // self-links are reported separately
      if (state.get(next) === "open") {
        const cycle = stack.slice(stack.indexOf(next));
        const start = cycle.indexOf([...cycle].sort()[0] as string);
        const rotated = [...cycle.slice(start), ...cycle.slice(0, start)];
        found.set(rotated.join(" "), rotated);
      } else if (!state.has(next)) visit(next);
    }
    stack.pop();
    state.set(id, "done");
  };
  for (const id of [...byId.keys()].sort()) if (!state.has(id)) visit(id);
  return [...found.values()].sort((a, b) => a.join(" ").localeCompare(b.join(" ")));
}

export type RootCount = {
  /** Distinct references cited, as given. */
  references: string[];
  /** Independent roots behind the references, sorted. */
  roots: string[];
  /** Roots whose origin_type is not determined (counted, but not known). */
  undetermined: string[];
  /** True when every reference is a corpus synthesis. */
  corpus_only: boolean;
};

/** Roots behind a list of cited source codes. Cycles are cut, not followed. */
export function independentRoots(
  refs: readonly string[],
  sources: readonly GenealogySource[],
): RootCount {
  const byId = new Map(sources.map((s) => [s.id, s]));
  const roots = new Set<string>();
  const seen = new Set<string>();
  const resolve = (id: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    const source = byId.get(id);
    const parents = source ? parentsOf(source).filter((p) => byId.has(p)) : [];
    if (parents.length > 0) for (const parent of parents) resolve(parent);
    else if (source?.origin_type !== "corpus_synthesis") roots.add(id);
  };
  const references = [...new Set(refs)];
  for (const ref of references) resolve(ref);
  const sorted = [...roots].sort();
  return {
    references,
    roots: sorted,
    undetermined: sorted.filter((id) => !byId.get(id)?.origin_type),
    corpus_only:
      references.length > 0 &&
      references.every((ref) => byId.get(ref)?.origin_type === "corpus_synthesis"),
  };
}

/**
 * IDs of E1 records whose cited sources are all corpus syntheses (ADR-05:
 * a corpus synthesis alone is not enough for E1). Sources without a
 * determined origin_type are never assumed to be syntheses.
 */
export function corpusOnlyE1(
  records: readonly { id: string; evidence_level: string | null; sources: string[] }[],
  sources: readonly GenealogySource[],
): string[] {
  return records
    .filter((r) => r.evidence_level === "E1" && independentRoots(r.sources, sources).corpus_only)
    .map((r) => r.id)
    .sort();
}
