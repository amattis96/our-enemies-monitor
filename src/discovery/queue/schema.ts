import { z } from "zod";
import { UtcTimestamp } from "../../temporal/snapshots.ts";

export const QUEUE_STATUSES = [
  "queued",
  "leased",
  "researching",
  "in_review",
  "closed",
  "failed_technical",
] as const;
export type QueueStatus = (typeof QUEUE_STATUSES)[number];

export const QUEUE_DISPOSITIONS = ["accepted", "duplicate", "forbidden", "discarded"] as const;
export type QueueDisposition = (typeof QUEUE_DISPOSITIONS)[number];

export const EPISTEMIC_OUTCOMES = [
  "confirmed",
  "contradicted",
  "insufficient_evidence",
  "undeterminable",
] as const;
export type EpistemicOutcome = (typeof EPISTEMIC_OUTCOMES)[number];

export const QUEUE_VISIBILITIES = ["private", "publishable"] as const;
export type QueueVisibility = (typeof QUEUE_VISIBILITIES)[number];

export const QueueTransitionSchema = z
  .strictObject({
    seq: z.number().int().nonnegative().describe("Monotonic sequence number of the transition."),
    at: UtcTimestamp.describe("UTC timestamp when the transition occurred."),
    from_status: z
      .enum(QUEUE_STATUSES)
      .nullable()
      .describe("Previous queue status, or null on initial creation."),
    to_status: z.enum(QUEUE_STATUSES).describe("New queue status after the transition."),
    actor_run_id: z.string().min(1).describe("Run ID that triggered the transition."),
    lease_generation: z
      .number()
      .int()
      .nonnegative()
      .describe("Lease generation active at the time of the transition."),
    reason: z.string().min(1).optional().describe("Optional human or machine reason."),
    snapshot_id: z
      .string()
      .min(1)
      .optional()
      .describe("Snapshot ID associated with this transition."),
  })
  .describe("Audit log entry for a discovery queue item state transition.");
export type QueueTransition = z.infer<typeof QueueTransitionSchema>;

export const LATE_OUTPUT_REASONS = [
  "revision_conflict",
  "stale_lease_generation",
  "mismatched_run_id",
  "lease_expired",
  "not_active_lease",
] as const;
export type LateOutputReason = (typeof LATE_OUTPUT_REASONS)[number];

export const LateOutputRecordSchema = z
  .strictObject({
    run_id: z.string().min(1).describe("Run ID that submitted the late or conflicting output."),
    lease_generation: z
      .number()
      .int()
      .nonnegative()
      .describe("Lease generation claimed by the late submission."),
    received_at: UtcTimestamp.describe("UTC timestamp when the late output was received."),
    disposition: z
      .enum(QUEUE_DISPOSITIONS)
      .optional()
      .describe("Disposition proposed by the late submission."),
    epistemic_outcome: z
      .enum(EPISTEMIC_OUTCOMES)
      .optional()
      .describe("Epistemic outcome proposed by the late submission."),
    outcome_refs: z
      .array(z.string().min(1))
      .default([])
      .describe("Evidence or artifact references produced by the late run."),
    reason: z
      .enum(LATE_OUTPUT_REASONS)
      .describe("Concurrency or lease mismatch reason that prevented overwriting."),
    note: z.string().min(1).optional().describe("Optional diagnostic note."),
  })
  .describe(
    "Preserved late output saved for re-evaluation without overwriting authoritative state.",
  );
export type LateOutputRecord = z.infer<typeof LateOutputRecordSchema>;

export const NegativeVerificationRecordSchema = z
  .strictObject({
    id: z.string().min(1).describe("Queue item ID associated with the negative verification."),
    dedup_key: z.string().min(1).describe("Deduplication key preventing redundant re-queueing."),
    epistemic_outcome: z
      .enum(["contradicted", "insufficient_evidence", "undeterminable"])
      .describe("Non-confirmed epistemic outcome preserved in permanent memory."),
    recorded_at: UtcTimestamp.describe("UTC timestamp when the negative outcome was recorded."),
    outcome_refs: z
      .array(z.string().min(1))
      .default([])
      .describe("References supporting the negative verification."),
    redacted_d12: z
      .boolean()
      .default(false)
      .describe("True if underlying personal or restricted content was redacted under D12."),
    redaction_note: z
      .string()
      .min(1)
      .optional()
      .describe("Minimal administrative trace retained after D12 redaction."),
  })
  .describe("Permanent negative-verification memory entry (never deleted, only D12-minimized).");
export type NegativeVerificationRecord = z.infer<typeof NegativeVerificationRecordSchema>;

export const QueueItemSchema = z
  .strictObject({
    id: z.string().min(1).describe("Unique identifier of the discovery queue item."),
    method: z.string().min(1).describe("Discovery generator method identifier."),
    method_version: z.string().min(1).describe("Version of the discovery generator method."),
    engine_version: z.string().min(1).describe("Engine version active when item was created."),
    priority: z.number().int().min(0).max(100).describe("Deterministic priority score (0-100)."),
    question: z.string().min(1).describe("Investigative question to verify."),
    refs: z.array(z.string().min(1)).default([]).describe("Referenced entity/event/source IDs."),
    evidences: z
      .array(z.string().min(1))
      .default([])
      .describe("Initial supporting evidence references."),
    alternative_explanations: z
      .array(z.string().min(1))
      .default([])
      .describe("Declared alternative explanations for falsifiability."),
    falsifiers: z
      .array(z.string().min(1))
      .default([])
      .describe("Conditions that would falsify the hypothesis."),
    dedup_key: z.string().min(1).describe("Deterministic key preventing duplicate queue entries."),
    estimated_cost: z
      .number()
      .nonnegative()
      .nullable()
      .optional()
      .describe("Estimated verification cost."),
    origin_run_id: z.string().min(1).describe("Run ID of the generator that created the item."),
    visibility: z
      .enum(QUEUE_VISIBILITIES)
      .default("private")
      .describe(
        "publishable: may appear in the public Laboratory; private: internal, kept in the repository and excluded from public projections (not confidential).",
      ),
    status: z.enum(QUEUE_STATUSES).describe("Operational workflow status of the queue item."),
    disposition: z
      .enum(QUEUE_DISPOSITIONS)
      .nullable()
      .optional()
      .describe("Triage disposition, separated from operational status and epistemic outcome."),
    epistemic_outcome: z
      .enum(EPISTEMIC_OUTCOMES)
      .nullable()
      .optional()
      .describe("Epistemic verification outcome, separated from operational status."),
    revision: z
      .number()
      .int()
      .nonnegative()
      .describe("Optimistic concurrency revision incremented on every mutation."),
    lease_generation: z
      .number()
      .int()
      .nonnegative()
      .describe("Monotonic lease generation counter incremented on each lease acquisition."),
    assigned_run_id: z
      .string()
      .min(1)
      .nullable()
      .describe("Run ID currently holding the lease, or null when unleased."),
    lease_expires_at: UtcTimestamp.nullable().describe(
      "UTC timestamp when the active lease expires, or null when unleased.",
    ),
    input_snapshot: z
      .string()
      .min(1)
      .describe("Snapshot ID against which this item was generated or verified."),
    retry_count: z
      .number()
      .int()
      .nonnegative()
      .default(0)
      .describe("Number of technical retries attempted."),
    next_eligible_at: UtcTimestamp.nullable()
      .optional()
      .describe("Earliest UTC timestamp when the item can next be leased."),
    outcome_refs: z
      .array(z.string().min(1))
      .default([])
      .describe("References to verification outcomes or resulting records."),
    transitions: z
      .array(QueueTransitionSchema)
      .default([])
      .describe("Append-only transition history."),
    late_outputs: z
      .array(LateOutputRecordSchema)
      .default([])
      .describe("Preserved late or conflicting outputs saved for re-evaluation."),
    d12_redacted: z
      .boolean()
      .default(false)
      .describe("True when sensitive content was redacted under D12."),
    d12_minimal_trace: z
      .string()
      .min(1)
      .nullable()
      .optional()
      .describe("Minimal administrative trace retained after D12 redaction."),
    re_review_reason: z
      .string()
      .min(1)
      .nullable()
      .optional()
      .describe("Reason the item was returned to in_review (e.g., stale snapshot)."),
  })
  .describe("Authoritative private discovery queue item.");
export type QueueItem = z.infer<typeof QueueItemSchema>;

export const DiscoveryQueueSchema = z
  .strictObject({
    schema_version: z.literal("1.0.0").describe("Schema version of the discovery queue."),
    updated_at: UtcTimestamp.describe("UTC timestamp of the last queue mutation."),
    items: z
      .array(QueueItemSchema)
      .default([])
      .describe("Queue items, stored one file per item in docs/discovery/queue/."),
    negative_memory: z
      .array(NegativeVerificationRecordSchema)
      .default([])
      .describe("Permanent negative-verification memory across runs."),
  })
  .describe(
    "Authoritative discovery queue with permanent negative memory, stored in docs/discovery/ of the single public repository (D1).",
  );
export type DiscoveryQueue = z.infer<typeof DiscoveryQueueSchema>;

export const PublicQueueItemSchema = z
  .strictObject({
    id: z.string().min(1).describe("Public identifier of the discovery item."),
    method: z.string().min(1).describe("Discovery method identifier."),
    method_version: z.string().min(1).describe("Discovery method version."),
    engine_version: z.string().min(1).describe("Engine version active when created."),
    question: z.string().min(1).describe("Publishable investigative question."),
    status: z.enum(QUEUE_STATUSES).describe("Operational status."),
    disposition: z.enum(QUEUE_DISPOSITIONS).nullable().optional().describe("Triage disposition."),
    epistemic_outcome: z
      .enum(EPISTEMIC_OUTCOMES)
      .nullable()
      .optional()
      .describe("Epistemic verification outcome."),
    outcome_refs: z.array(z.string().min(1)).default([]).describe("Public outcome references."),
    input_snapshot: z.string().min(1).describe("Snapshot ID associated with the item."),
  })
  .describe("Sanitized public projection of a publishable discovery queue item.");
export type PublicQueueItem = z.infer<typeof PublicQueueItemSchema>;

export const PublicQueueSchema = z
  .strictObject({
    schema_version: z.literal("1.0.0").describe("Schema version of the public queue projection."),
    updated_at: UtcTimestamp.describe("UTC timestamp of the underlying queue."),
    items: z
      .array(PublicQueueItemSchema)
      .default([])
      .describe("Publishable, non-redacted queue items."),
  })
  .describe("Sanitized public projection of the discovery queue.");
export type PublicQueue = z.infer<typeof PublicQueueSchema>;
