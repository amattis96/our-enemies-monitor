import { createHash } from "node:crypto";
import { z } from "zod";
import { checkBoundary, type DataClass, type Destination } from "../security/boundary.ts";

export const INDEX_VISIBILITIES = ["public", "private"] as const;
export type IndexVisibility = (typeof INDEX_VISIBILITIES)[number];

export const SearchChunkMetadataSchema = z
  .strictObject({
    embedding_model: z.string().min(1).describe("Identifier of the embedding model used."),
    model_version: z.string().min(1).describe("Version of the embedding model."),
    content_hash: z
      .string()
      .regex(/^[0-9a-f]{64}$/)
      .describe("SHA-256 hash of the chunk text content."),
    segmentation_version: z.string().min(1).describe("Chunking/segmentation algorithm version."),
    language: z.string().min(2).describe("ISO 639-1 language code of the chunk."),
    visibility: z
      .enum(INDEX_VISIBILITIES)
      .describe(
        "public: may appear in public search projections; private: internal OSINT kept in the repository (pending, drafts), never in public indexes. Not a confidentiality class.",
      ),
  })
  .describe("Provenance and boundary metadata attached to every indexed chunk.");
export type SearchChunkMetadata = z.infer<typeof SearchChunkMetadataSchema>;

export const SearchChunkStructuredSchema = z
  .strictObject({
    entity_kinds: z
      .array(z.string().min(1))
      .default([])
      .describe("Entity kinds referenced in chunk."),
    date: z.string().min(4).optional().describe("Primary date associated with the chunk."),
    source_id: z.string().min(1).optional().describe("Source ID backing the chunk."),
    tags: z.array(z.string().min(1)).default([]).describe("Structured topic/theme tags."),
    caveats: z
      .array(z.string().min(1))
      .default([])
      .describe("Epistemic caveats that must be preserved in retrieval results."),
  })
  .describe("Structured metadata fields for hybrid filtering and caveat preservation.");
export type SearchChunkStructured = z.infer<typeof SearchChunkStructuredSchema>;

export const SearchChunkInputSchema = z
  .strictObject({
    chunk_id: z.string().min(1).describe("Unique chunk identifier."),
    record_id: z.string().min(1).describe("Parent record/document identifier."),
    text: z.string().min(1).describe("Chunk text content."),
    metadata: SearchChunkMetadataSchema.describe("Chunk embedding and boundary metadata."),
    structured: SearchChunkStructuredSchema.default({
      entity_kinds: [],
      tags: [],
      caveats: [],
    }).describe("Structured fields and caveats."),
  })
  .describe("Input chunk for building the hybrid search index.");
export type SearchChunkInput = z.infer<typeof SearchChunkInputSchema>;

export type IndexedChunk = SearchChunkInput & {
  tokens: string[];
  vector: number[];
};

export type HybridSearchIndex = {
  index_id: string;
  visibility: IndexVisibility;
  data_class: DataClass;
  embedding_model: string;
  model_version: string;
  segmentation_version: string;
  chunks: IndexedChunk[];
};

export type SearchQueryFilters = {
  language?: string;
  entity_kind?: string;
  source_id?: string;
  tag?: string;
  date_from?: string;
  date_to?: string;
};

export type SearchResultItem = {
  chunk_id: string;
  record_id: string;
  score: number;
  lexical_score: number;
  vector_score: number;
  structured_score: number;
  language: string;
  visibility: IndexVisibility;
  caveats: string[];
  suggestion_only: true;
  creates_edges: false;
};

const EMBEDDING_DIM = 64;

export function computeContentHash(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9\u00c0-\u024f\u0400-\u04ff]+/i)
    .filter((t) => t.length >= 2);
}

/**
 * Deterministic local character/token n-gram embedding (no external vector DB or network).
 * Produces an L2-normalized unit vector for reproducible offline evaluation.
 */
export function computeDeterministicEmbedding(text: string, dims = EMBEDDING_DIM): number[] {
  const vec = new Array<number>(dims).fill(0);
  const tokens = tokenize(text);

  for (const tok of tokens) {
    const features = [tok];
    for (let i = 0; i <= tok.length - 3; i += 1) {
      features.push(tok.slice(i, i + 3));
    }
    for (const feat of features) {
      const digest = createHash("sha256").update(feat).digest();
      const idx = (digest.readUInt32BE(0) ?? 0) % dims;
      const sign = ((digest.readUInt8(4) ?? 0) & 1) === 0 ? 1 : -1;
      vec[idx] = (vec[idx] ?? 0) + sign;
    }
  }

  let normSq = 0;
  for (const v of vec) normSq += v * v;
  const norm = Math.sqrt(normSq);
  if (norm === 0) return vec;
  return vec.map((v) => Number((v / norm).toFixed(6)));
}

function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  let dot = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    dot += (a[i] ?? 0) * (b[i] ?? 0);
  }
  return Math.max(0, dot);
}

const visibilityClass = (v: IndexVisibility): DataClass =>
  v === "public" ? "public_publishable" : "investigative_pending";

/**
 * Public and internal indexes are separate, rebuildable projections (PK-28):
 * internal material never enters or is served from a public index, and the
 * two are not mixed in one query context.
 */
function assertVisibilityBoundary(
  indexVisibility: IndexVisibility,
  chunkVisibility: IndexVisibility,
): void {
  const dest: Destination = indexVisibility === "public" ? "public_export" : "repository";
  const check = checkBoundary(visibilityClass(chunkVisibility), dest);
  if (!check.allowed) {
    throw new Error(`Strict public/internal index boundary violation: ${check.reason}`);
  }
  if (indexVisibility !== chunkVisibility) {
    throw new Error(
      `Strict public/internal index boundary violation: ${chunkVisibility} material cannot share a ${indexVisibility} index or query context`,
    );
  }
}

/**
 * Build or rebuild a hybrid lexical+vector+structured search index from chunks.
 * Enforces strict separation between public and private indexes/contexts.
 */
export function buildHybridSearchIndex(input: {
  index_id: string;
  visibility: IndexVisibility;
  embedding_model?: string;
  model_version?: string;
  segmentation_version?: string;
  chunks: readonly SearchChunkInput[];
}): HybridSearchIndex {
  const embeddingModel = input.embedding_model ?? "oem-local-ngram-v1";
  const modelVersion = input.model_version ?? "1.0.0";
  const segmentationVersion = input.segmentation_version ?? "seg-v1";
  const indexedChunks: IndexedChunk[] = [];

  for (const raw of input.chunks) {
    const chunk = SearchChunkInputSchema.parse(raw);
    assertVisibilityBoundary(input.visibility, chunk.metadata.visibility);
    const tokens = tokenize(chunk.text);
    const vector = computeDeterministicEmbedding(chunk.text);
    indexedChunks.push({
      ...chunk,
      tokens,
      vector,
    });
  }

  return {
    index_id: input.index_id,
    visibility: input.visibility,
    data_class: visibilityClass(input.visibility),
    embedding_model: embeddingModel,
    model_version: modelVersion,
    segmentation_version: segmentationVersion,
    chunks: indexedChunks,
  };
}

function matchesFilters(chunk: IndexedChunk, filters?: SearchQueryFilters): boolean {
  if (!filters) return true;
  if (filters.language && chunk.metadata.language !== filters.language) return false;
  if (filters.entity_kind && !chunk.structured.entity_kinds.includes(filters.entity_kind)) {
    return false;
  }
  if (filters.source_id && chunk.structured.source_id !== filters.source_id) return false;
  if (filters.tag && !chunk.structured.tags.includes(filters.tag)) return false;
  if (filters.date_from && (!chunk.structured.date || chunk.structured.date < filters.date_from)) {
    return false;
  }
  if (filters.date_to && (!chunk.structured.date || chunk.structured.date > filters.date_to)) {
    return false;
  }
  return true;
}

/**
 * Search an index using lexical, vector, or hybrid scoring.
 * Never mixes public/private contexts and never creates graph edges.
 */
export function searchHybridIndex(
  index: HybridSearchIndex,
  input: {
    query: string;
    context_visibility: IndexVisibility;
    mode?: "hybrid" | "lexical_only" | "vector_only";
    top_k?: number;
    filters?: SearchQueryFilters;
  },
): SearchResultItem[] {
  assertVisibilityBoundary(input.context_visibility, index.visibility);

  const mode = input.mode ?? "hybrid";
  const topK = input.top_k ?? 10;
  const queryTokens = tokenize(input.query);
  const queryTokenSet = new Set(queryTokens);
  const queryVec = computeDeterministicEmbedding(input.query);

  const scored: SearchResultItem[] = [];

  for (const chunk of index.chunks) {
    if (!matchesFilters(chunk, input.filters)) continue;

    const chunkTokenSet = new Set(chunk.tokens);
    let overlap = 0;
    for (const qt of queryTokenSet) {
      if (chunkTokenSet.has(qt)) overlap += 1;
    }
    const lexicalScore =
      queryTokenSet.size > 0 ? Number((overlap / queryTokenSet.size).toFixed(4)) : 0;
    const vectorScore = Number(cosineSimilarity(queryVec, chunk.vector).toFixed(4));
    const structuredScore = input.filters ? 0.1 : 0;

    let finalScore = 0;
    if (mode === "lexical_only") {
      finalScore = lexicalScore;
    } else if (mode === "vector_only") {
      finalScore = vectorScore;
    } else {
      finalScore = Number((0.5 * lexicalScore + 0.4 * vectorScore + structuredScore).toFixed(4));
    }

    if (finalScore <= 0 && queryTokens.length > 0) continue;

    scored.push({
      chunk_id: chunk.chunk_id,
      record_id: chunk.record_id,
      score: finalScore,
      lexical_score: lexicalScore,
      vector_score: vectorScore,
      structured_score: structuredScore,
      language: chunk.metadata.language,
      visibility: chunk.metadata.visibility,
      caveats: [...chunk.structured.caveats],
      suggestion_only: true,
      creates_edges: false,
    });
  }

  return scored
    .sort((a, b) => b.score - a.score || a.chunk_id.localeCompare(b.chunk_id))
    .slice(0, topK);
}

export type ValidationQuery = {
  query_id: string;
  query: string;
  relevant_record_ids: string[];
  required_caveats?: Record<string, string[]>;
  filters?: SearchQueryFilters;
};

export type RetrievalModeMetrics = {
  mode: "hybrid" | "lexical_only";
  precision_at_k: number;
  recall_at_k: number;
  ndcg_at_k: number;
  latency_ms: number;
  estimated_cost: number;
  caveat_preservation: number;
};

export type HybridEvaluationReport = {
  k: number;
  queries_evaluated: number;
  hybrid: RetrievalModeMetrics;
  lexical_only: RetrievalModeMetrics;
  hybrid_beats_or_ties_lexical_ndcg: boolean;
};

function computeNdcg(
  retrievedRecordIds: readonly string[],
  relevant: Set<string>,
  k: number,
): number {
  let dcg = 0;
  for (let i = 0; i < Math.min(k, retrievedRecordIds.length); i += 1) {
    const id = retrievedRecordIds[i];
    if (id && relevant.has(id)) {
      dcg += 1 / Math.log2(i + 2);
    }
  }
  const idealHits = Math.min(k, relevant.size);
  let idcg = 0;
  for (let i = 0; i < idealHits; i += 1) {
    idcg += 1 / Math.log2(i + 2);
  }
  return idcg > 0 ? dcg / idcg : 0;
}

/**
 * Offline deterministic evaluator comparing hybrid vs lexical-only retrieval
 * across precision@k, recall@k, nDCG@k, latency, cost, and caveat preservation.
 */
export function evaluateHybridVsLexical(
  index: HybridSearchIndex,
  validationSet: readonly ValidationQuery[],
  options?: { k?: number; context_visibility?: IndexVisibility },
): HybridEvaluationReport {
  const k = options?.k ?? 5;
  const contextVisibility = options?.context_visibility ?? index.visibility;

  const evalMode = (mode: "hybrid" | "lexical_only"): RetrievalModeMetrics => {
    let sumP = 0;
    let sumR = 0;
    let sumNdcg = 0;
    let totalRequiredCaveats = 0;
    let preservedCaveats = 0;
    const start = performance.now();

    for (const vq of validationSet) {
      const results = searchHybridIndex(index, {
        query: vq.query,
        context_visibility: contextVisibility,
        mode,
        top_k: k,
        ...(vq.filters !== undefined ? { filters: vq.filters } : {}),
      });

      const relevantSet = new Set(vq.relevant_record_ids);
      const uniqueRetrieved = [...new Set(results.map((r) => r.record_id))];
      const hits = uniqueRetrieved.filter((id) => relevantSet.has(id)).length;

      sumP += k > 0 ? hits / k : 0;
      sumR += relevantSet.size > 0 ? hits / relevantSet.size : 0;
      sumNdcg += computeNdcg(uniqueRetrieved, relevantSet, k);

      if (vq.required_caveats) {
        for (const r of results) {
          const req = vq.required_caveats[r.record_id] ?? [];
          for (const cav of req) {
            totalRequiredCaveats += 1;
            if (r.caveats.includes(cav)) preservedCaveats += 1;
          }
        }
      }
    }

    const elapsedMs = Number(Math.max(0.01, performance.now() - start).toFixed(4));
    const n = validationSet.length || 1;
    const costPerQuery = mode === "hybrid" ? 0.0002 : 0.00005;

    return {
      mode,
      precision_at_k: Number((sumP / n).toFixed(4)),
      recall_at_k: Number((sumR / n).toFixed(4)),
      ndcg_at_k: Number((sumNdcg / n).toFixed(4)),
      latency_ms: elapsedMs,
      estimated_cost: Number((validationSet.length * costPerQuery).toFixed(6)),
      caveat_preservation:
        totalRequiredCaveats > 0 ? Number((preservedCaveats / totalRequiredCaveats).toFixed(4)) : 1,
    };
  };

  const hybrid = evalMode("hybrid");
  const lexical_only = evalMode("lexical_only");

  return {
    k,
    queries_evaluated: validationSet.length,
    hybrid,
    lexical_only,
    hybrid_beats_or_ties_lexical_ndcg: hybrid.ndcg_at_k >= lexical_only.ndcg_at_k,
  };
}
