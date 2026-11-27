import { z } from "zod";
import { ORIGIN_TYPES } from "../model/vocabularies.ts";
import type { GenealogySource } from "../pipeline/genealogy.ts";

/**
 * PK-06B: Per-assertion provenance DAG genealogy and independence qualification.
 *
 * - Independence is computed per assertion, not per document.
 * - Multi-derivation DAG: a node may have multiple parents (`derived_from`, `relies_on`).
 * - Evidence is qualified by nature (`official_document`, `direct_testimony`,
 *   `investigation_relying_on_same_doc`, etc.).
 * - Unknown origin is NEVER counted as independent.
 * - New sources require explicit genealogy.
 */

export const EVIDENCE_NATURES = [
  "official_document",
  "direct_testimony",
  "original_investigation",
  "investigation_relying_on_same_doc",
  "intelligence_assessment",
  "media_report",
  "republication",
  "corpus_synthesis",
  "unknown",
] as const;
export type EvidenceNature = (typeof EVIDENCE_NATURES)[number];

export const ORIGIN_CERTAINTIES = ["established", "uncertain", "unknown"] as const;
export type OriginCertainty = (typeof ORIGIN_CERTAINTIES)[number];

export const PROVENANCE_NODE_KINDS = ["publication", "evidence", "source", "root"] as const;
export type ProvenanceNodeKind = (typeof PROVENANCE_NODE_KINDS)[number];

export const ProvenanceNode = z.strictObject({
  id: z.string().min(1).describe("Unique identifier of the publication, source, or root node."),
  kind: z
    .enum(PROVENANCE_NODE_KINDS)
    .describe("Role of the node in the assertion genealogy graph."),
  evidence_nature: z
    .enum(EVIDENCE_NATURES)
    .describe("Evidentiary nature of this node (official_document, direct_testimony, etc.)."),
  origin_type: z
    .enum([...ORIGIN_TYPES, "unknown"])
    .optional()
    .describe("Optional B17 origin_type; absent or 'unknown' means origin is not established."),
  origin_certainty: z
    .enum(ORIGIN_CERTAINTIES)
    .describe("Whether the node's origin is established, uncertain, or unknown."),
  derived_from: z
    .array(z.string().min(1))
    .describe("Parent node IDs this node copies, rewrites, or derives from (supports multiple)."),
  relies_on: z
    .array(z.string().min(1))
    .describe("Parent node IDs this node reports on or relies on (supports multiple)."),
  is_new_source: z
    .boolean()
    .optional()
    .describe("True when introduced as a new source requiring explicit genealogy."),
  note: z.string().nullable().optional().describe("Optional provenance qualification note."),
});
export type ProvenanceNode = z.infer<typeof ProvenanceNode>;

export const AssertionProvenanceGraph = z.strictObject({
  assertion_id: z.string().min(1).describe("ID of the assertion this genealogy DAG belongs to."),
  nodes: z
    .array(ProvenanceNode)
    .describe("DAG nodes representing publications, evidence items, sources, and roots."),
});
export type AssertionProvenanceGraph = z.infer<typeof AssertionProvenanceGraph>;

export type ProvenanceDagIssue = {
  severity: "error" | "warning";
  node_id: string;
  message: string;
};

const parentsOf = (node: ProvenanceNode): string[] => [...node.derived_from, ...node.relies_on];

/**
 * Validates the multi-derivation DAG structure and enforces obligatory genealogy for new sources.
 */
export function validateProvenanceDag(graph: AssertionProvenanceGraph): ProvenanceDagIssue[] {
  const issues: ProvenanceDagIssue[] = [];
  const byId = new Map<string, ProvenanceNode>();

  for (const node of graph.nodes) {
    if (byId.has(node.id)) {
      issues.push({ severity: "error", node_id: node.id, message: `duplicate node ${node.id}` });
    }
    byId.set(node.id, node);
  }

  for (const node of graph.nodes) {
    for (const parentId of parentsOf(node)) {
      if (parentId === node.id) {
        issues.push({ severity: "error", node_id: node.id, message: "node cites itself" });
      } else if (!byId.has(parentId)) {
        issues.push({
          severity: "error",
          node_id: node.id,
          message: `missing parent node ${parentId}`,
        });
      }
    }

    if (
      node.is_new_source &&
      parentsOf(node).length === 0 &&
      (node.origin_certainty === "unknown" ||
        node.evidence_nature === "unknown" ||
        node.origin_type === undefined ||
        node.origin_type === "unknown")
    ) {
      issues.push({
        severity: "error",
        node_id: node.id,
        message: "new source requires explicit genealogy (origin_type or parent derivations)",
      });
    }
  }

  // Cycle detection on the multi-derivation DAG
  const state = new Map<string, "open" | "done">();
  const stack: string[] = [];
  const visit = (id: string) => {
    state.set(id, "open");
    stack.push(id);
    const node = byId.get(id);
    for (const parentId of node ? parentsOf(node) : []) {
      if (parentId === id || !byId.has(parentId)) continue;
      if (state.get(parentId) === "open") {
        const cycle = stack.slice(stack.indexOf(parentId));
        issues.push({
          severity: "error",
          node_id: id,
          message: `circular derivation: ${[...cycle, parentId].join(" -> ")}`,
        });
      } else if (!state.has(parentId)) {
        visit(parentId);
      }
    }
    stack.pop();
    state.set(id, "done");
  };

  for (const node of graph.nodes) {
    if (!state.has(node.id)) visit(node.id);
  }

  return issues;
}

export type IndependenceAnalysis = {
  assertion_id: string;
  publication_count: number;
  independent_established_origins: string[];
  uncertain_origins: string[];
  unknown_origins: string[];
  /** Count of independent established origins; NEVER includes unknown origins. */
  independent_count: number;
  evidence_natures: Partial<Record<EvidenceNature, number>>;
  summary_it: string;
};

function isUnknownOrigin(node: ProvenanceNode): boolean {
  return (
    node.origin_certainty === "unknown" ||
    node.evidence_nature === "unknown" ||
    node.origin_type === "unknown"
  );
}

/**
 * Formats a concise Italian provenance summary, e.g.:
 * "6 pubblicazioni, 2 origini accertate, 2 incerte"
 * (and notes unknown origins when present without counting them as independent).
 */
export function formatProvenanceSummaryIt(params: {
  publicationCount: number;
  establishedCount: number;
  uncertainCount: number;
  unknownCount: number;
}): string {
  const pubLabel = params.publicationCount === 1 ? "pubblicazione" : "pubblicazioni";
  const estLabel = params.establishedCount === 1 ? "origine accertata" : "origini accertate";
  const uncLabel = params.uncertainCount === 1 ? "incerta" : "incerte";
  const parts = [
    `${params.publicationCount} ${pubLabel}`,
    `${params.establishedCount} ${estLabel}`,
    `${params.uncertainCount} ${uncLabel}`,
  ];
  if (params.unknownCount > 0) {
    const unkLabel = params.unknownCount === 1 ? "ignota" : "ignote";
    parts.push(`${params.unknownCount} ${unkLabel}`);
  }
  return parts.join(", ");
}

/**
 * Computes per-assertion independence over a multi-derivation DAG.
 *
 * Rules:
 * - Multiple publications deriving from or relying on the same root count once.
 * - A node with multiple parents (multi-derivation) propagates to ALL its parent roots.
 * - Corpus syntheses are never roots on their own.
 * - Unknown origin is NEVER counted as independent (`independent_count` excludes `unknown_origins`).
 */
export function analyzeAssertionIndependence(
  graph: AssertionProvenanceGraph,
  citedIds?: readonly string[],
): IndependenceAnalysis {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const startIds = citedIds
    ? [...new Set(citedIds)]
    : graph.nodes.filter((n) => n.kind === "publication" || n.kind === "evidence").map((n) => n.id);

  // Fallback if graph only contains source/root nodes without explicit publication/evidence leaves
  const entryIds = startIds.length > 0 ? startIds : graph.nodes.map((n) => n.id);

  const established = new Set<string>();
  const uncertain = new Set<string>();
  const unknown = new Set<string>();
  const visited = new Set<string>();

  const walk = (id: string) => {
    if (visited.has(id)) return;
    visited.add(id);
    const node = byId.get(id);
    if (!node) {
      unknown.add(id);
      return;
    }
    const validParents = parentsOf(node).filter((p) => byId.has(p));
    if (validParents.length > 0) {
      for (const parentId of validParents) {
        walk(parentId);
      }
      return;
    }
    if (node.evidence_nature === "corpus_synthesis" || node.origin_type === "corpus_synthesis") {
      return;
    }
    if (isUnknownOrigin(node)) {
      unknown.add(node.id);
    } else if (node.origin_certainty === "uncertain") {
      uncertain.add(node.id);
    } else {
      established.add(node.id);
    }
  };

  for (const id of entryIds) {
    walk(id);
  }

  const evidenceNatures: Partial<Record<EvidenceNature, number>> = {};
  for (const id of entryIds) {
    const nature = byId.get(id)?.evidence_nature ?? "unknown";
    evidenceNatures[nature] = (evidenceNatures[nature] ?? 0) + 1;
  }

  const independentEstablished = [...established].sort();
  const uncertainList = [...uncertain].sort();
  const unknownList = [...unknown].sort();

  return {
    assertion_id: graph.assertion_id,
    publication_count: entryIds.length,
    independent_established_origins: independentEstablished,
    uncertain_origins: uncertainList,
    unknown_origins: unknownList,
    independent_count: independentEstablished.length,
    evidence_natures: evidenceNatures,
    summary_it: formatProvenanceSummaryIt({
      publicationCount: entryIds.length,
      establishedCount: independentEstablished.length,
      uncertainCount: uncertainList.length,
      unknownCount: unknownList.length,
    }),
  };
}

/**
 * Converts B17 GenealogySource records into ProvenanceNode[] for per-assertion DAG analysis.
 */
export function fromB17GenealogySources(
  sources: readonly GenealogySource[],
  citedIds: readonly string[],
): ProvenanceNode[] {
  const citedSet = new Set(citedIds);
  return sources.map((source) => {
    const nature: EvidenceNature =
      source.origin_type === "primary_document"
        ? "official_document"
        : source.origin_type === "official_statement"
          ? "official_document"
          : source.origin_type === "original_reporting"
            ? "original_investigation"
            : source.origin_type === "republication"
              ? "republication"
              : source.origin_type === "corpus_synthesis"
                ? "corpus_synthesis"
                : source.origin_type === "wire" || source.origin_type === "synthesis"
                  ? "media_report"
                  : "unknown";

    const certainty: OriginCertainty = source.origin_type === undefined ? "unknown" : "established";

    return {
      id: source.id,
      kind: citedSet.has(source.id) ? "publication" : "source",
      evidence_nature: nature,
      origin_type: source.origin_type ?? "unknown",
      origin_certainty: certainty,
      derived_from: [...(source.derived_from ?? [])],
      relies_on: [...(source.relies_on ?? [])],
    };
  });
}
