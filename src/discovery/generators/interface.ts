import { createHash } from "node:crypto";
import { canonicalizeValue } from "../../temporal/hash.ts";

export type QueueVisibility = "private" | "publishable";

export type GeneratorMetadata = {
  id: string;
  version: string;
  description: string;
};

export type GeneratorContext = {
  snapshot_id: string;
  dataset_hash: string;
  engine_version: string;
  generated_at: string;
  run_id: string;
};

export type GeneratedCandidate = {
  method: string;
  method_version: string;
  priority: number;
  question: string;
  refs: string[];
  evidences?: string[];
  alternative_explanations?: string[];
  falsifiers?: string[];
  dedup_key?: string;
  estimated_cost?: number | null;
  visibility?: QueueVisibility;
};

export type DiscoveryGenerator = {
  readonly metadata: GeneratorMetadata;
  generate(
    context: GeneratorContext,
  ): Promise<readonly GeneratedCandidate[]> | readonly GeneratedCandidate[];
};

/**
 * Compute a deterministic deduplication key for a discovery candidate so
 * regenerating the queue never creates duplicate items.
 */
export function computeDedupKey(input: {
  method: string;
  question: string;
  refs: readonly string[];
}): string {
  const normalized = canonicalizeValue({
    method: input.method.trim(),
    question: input.question.trim().toLowerCase(),
    refs: [...new Set(input.refs)].sort(),
  });
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}
