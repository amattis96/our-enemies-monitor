import { z } from "zod";
import type { PathGrammar } from "../discovery/generators/open-triads.ts";
import type { DiscoveryQueue } from "../discovery/queue/schema.ts";
import type { CasePilot } from "../editorial/cases.ts";
import type {
  EvidenceLevel,
  Language,
  LocalizedText,
  RelationClass,
  RelationGroup,
} from "../model/index.ts";
import type { StalenessCheckResult } from "../retractions/policy.ts";
import type { DataCommit } from "../site/history.ts";
import type { CounterInferenceAudit } from "../site/inferences.ts";
import type { PublicationReport } from "../site/publication.ts";
import type { ReadModel } from "../site/read-model.ts";

export const QUERY_COMPLEXITY_LIMITS = {
  defaultLimit: 20,
  maxLimit: 100,
  maxOffset: 10_000,
  maxQueryLength: 200,
  defaultPathDepth: 4,
  maxPathDepth: 6,
  defaultMaxPaths: 5,
  maxPaths: 10,
  defaultMaxVisitedNodes: 250,
  maxVisitedNodes: 500,
} as const;

export class QueryComplexityError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "QueryComplexityError";
    this.code = code;
  }
}

export const QueryCollectionSchema = z
  .enum(["events", "entities", "relationships", "hypotheses", "sources", "exposures"])
  .describe("Public dataset collection name.");
export type QueryCollection = z.infer<typeof QueryCollectionSchema>;

export const EvidenceDepthSchema = z
  .enum(["summary", "standard", "full"])
  .describe("Progressive evidence retrieval depth: summary, standard, or full.");
export type EvidenceDepth = z.infer<typeof EvidenceDepthSchema>;

export const SnapshotInfoSchema = z.strictObject({
  snapshot_id: z.string().nullable().describe("Latest accepted or published snapshot identifier."),
  status: z.string().nullable().describe("Lifecycle status of the snapshot, if tracked."),
  generated_at: z
    .string()
    .nullable()
    .describe("UTC timestamp when the local snapshot index was generated."),
  commit: z.string().nullable().describe("Git commit SHA associated with the snapshot or export."),
  dataset_hash: z.string().nullable().describe("Deterministic SHA-256 dataset hash, if available."),
});
export type SnapshotInfo = z.infer<typeof SnapshotInfoSchema>;

export type SourceSummary = {
  id: string;
  type: string;
  title: LocalizedText;
  publisher: string | null;
  urls: string[];
};

export type QueryCaveat = {
  code: string;
  text: string;
  record_id?: string | undefined;
};

export type PaginationMeta = {
  offset: number;
  limit: number;
  total: number;
  has_more: boolean;
  next_offset: number | null;
};

export type QueryEnvelope<T> = {
  data: T;
  canonical_ids: string[];
  snapshot: SnapshotInfo;
  staleness: StalenessCheckResult;
  sources: SourceSummary[];
  caveats: QueryCaveat[];
  pagination?: PaginationMeta | undefined;
};

export type SearchRecordsParams = {
  query?: string | undefined;
  collections?: QueryCollection[] | undefined;
  domain?: string | undefined;
  relation_class?: RelationClass | undefined;
  relation_group?: RelationGroup | undefined;
  from?: string | number | undefined;
  to?: string | number | undefined;
  evidence_level?: EvidenceLevel | undefined;
  theme?: string | undefined;
  place?: string | undefined;
  lang?: Language | undefined;
  offset?: number | undefined;
  limit?: number | undefined;
};

export type SearchHit = {
  id: string;
  collection: QueryCollection;
  label: string;
  summary: string | null;
  evidence_level: EvidenceLevel | null;
  date: string | null;
  domain: string | null;
  relation_class: string | null;
  relation_group: RelationGroup | null;
  themes: string[];
  places: string[];
  sources: string[];
  caveat: string | null;
};

export type GetRelationsParams = {
  node_id?: string | undefined;
  relation_class?: RelationClass | undefined;
  relation_group?: RelationGroup | undefined;
  evidence_level?: EvidenceLevel | undefined;
  from?: string | number | undefined;
  to?: string | number | undefined;
  include_participation?: boolean | undefined;
  lang?: Language | undefined;
  offset?: number | undefined;
  limit?: number | undefined;
};

export type GetTimelineParams = {
  theme?: string | undefined;
  from?: number | undefined;
  to?: number | undefined;
  query?: string | undefined;
  pending?: boolean | undefined;
  metadata?: boolean | undefined;
  order?: "newest" | "oldest" | undefined;
  place?: string | undefined;
  evidence_level?: EvidenceLevel | undefined;
  lang?: Language | undefined;
  offset?: number | undefined;
  limit?: number | undefined;
};

export type FindPathsParams = {
  from: string;
  to: string;
  max_steps?: number | undefined;
  max_paths?: number | undefined;
  max_visited_nodes?: number | undefined;
  include_participation?: boolean | undefined;
  apply_grammar?: boolean | undefined;
  lang?: Language | undefined;
};

export type QueryPathStep = {
  relationship: string;
  subject: string;
  subject_label: string;
  predicate: string;
  object: string;
  object_label: string;
  relation_class: RelationClass;
  group: RelationGroup;
  evidence_level: EvidenceLevel;
  evidence_status: string;
  valid_from: string | null;
  valid_to: string | null;
  primary_url: string | null;
  caveat: LocalizedText | null;
  sources: SourceSummary[];
  b15: {
    categories: string[];
    interrupts_composition: boolean;
    classification_state: "proposta" | "revisionata" | null;
  };
};

export type QueryPath = {
  from: string;
  to: string;
  steps: QueryPathStep[];
  interrupted_at: string[];
  forbidden_by: string[];
  grammar_applied: boolean;
  grammar_rules_matched: string[];
  caveats: string[];
};

export type FindPathsResult = {
  from: string;
  to: string;
  paths: QueryPath[];
  step_limit: {
    max_steps: number;
    max_paths: number;
    max_visited_nodes: number;
    visited_nodes: number;
    truncated: boolean;
  };
  b15_forbidden_for_pair: string[];
};

export type QueryEngineOptions = {
  /** Override canonical dataset (will still pass through publicationReport). */
  dataset?: PublicationReport["dataset"] | undefined;
  /** Override suspended record IDs (PK-07); defaults to suspendedRecordIds(). */
  suspendedIds?: ReadonlySet<string> | undefined;
  /** Override precomputed publication report. */
  report?: PublicationReport | undefined;
  /** Override read model (must be built from report.dataset). */
  model?: ReadModel | undefined;
  /** Override B15 counter-inference audit. */
  audit?: CounterInferenceAudit | undefined;
  /** Override PK-11 path grammar. */
  pathGrammar?: PathGrammar | undefined;
  /** Override case pilot data. */
  casePilot?: CasePilot | undefined;
  /** Override discovery queue for open questions. */
  discoveryQueue?: DiscoveryQueue | undefined;
  /** Override git change history. */
  history?: DataCommit[] | undefined;
  /** Override snapshot info. */
  snapshot?: SnapshotInfo | undefined;
  /** Override current time for staleness check (ISO-8601 or Date). */
  now?: string | Date | undefined;
  /** Override PK-07 max staleness threshold in seconds. */
  maxStalenessSeconds?: number | undefined;
};
