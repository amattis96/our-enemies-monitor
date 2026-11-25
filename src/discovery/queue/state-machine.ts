import { ENGINE_VERSION } from "../../engine/version.ts";
import { computeDedupKey, type GeneratedCandidate } from "../generators/interface.ts";
import {
  type DiscoveryQueue,
  DiscoveryQueueSchema,
  type EpistemicOutcome,
  type LateOutputReason,
  type PublicQueue,
  PublicQueueSchema,
  type QueueDisposition,
  type QueueItem,
  type QueueStatus,
} from "./schema.ts";

export function createEmptyQueue(now: string): DiscoveryQueue {
  return DiscoveryQueueSchema.parse({
    schema_version: "1.0.0",
    updated_at: now,
    items: [],
    negative_memory: [],
  });
}

function addSecondsIso(iso: string, seconds: number): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) {
    throw new Error(`Invalid UTC timestamp: ${iso}`);
  }
  return new Date(ms + seconds * 1000).toISOString().replace(/\.\d{3}Z$/, "Z");
}

function nextTransitionSeq(item: QueueItem): number {
  return item.transitions.length;
}

export type EnqueueResult = {
  queue: DiscoveryQueue;
  added_ids: string[];
  duplicate_keys: string[];
};

/**
 * Add generated candidates to the authoritative queue deterministically.
 * Deduplicates against existing items and permanent negative memory so
 * regenerating the queue never creates duplicates.
 */
export function enqueueCandidates(
  queue: DiscoveryQueue,
  candidates: readonly GeneratedCandidate[],
  options: {
    originRunId: string;
    inputSnapshot: string;
    now: string;
    engineVersion?: string;
    allowReopenDedupKeys?: ReadonlySet<string>;
  },
): EnqueueResult {
  const existingKeys = new Set(queue.items.map((item) => item.dedup_key));
  const negativeKeys = new Set(queue.negative_memory.map((entry) => entry.dedup_key));
  const allowReopen = options.allowReopenDedupKeys ?? new Set<string>();

  const nextItems = [...queue.items];
  const added_ids: string[] = [];
  const duplicate_keys: string[] = [];
  const engineVersion = options.engineVersion ?? ENGINE_VERSION;

  for (const candidate of candidates) {
    const dedupKey =
      candidate.dedup_key ??
      computeDedupKey({
        method: candidate.method,
        question: candidate.question,
        refs: candidate.refs,
      });

    if (existingKeys.has(dedupKey) || (negativeKeys.has(dedupKey) && !allowReopen.has(dedupKey))) {
      duplicate_keys.push(dedupKey);
      continue;
    }

    existingKeys.add(dedupKey);
    const id = `dq-${dedupKey.slice(0, 12)}`;
    const item: QueueItem = {
      id,
      method: candidate.method,
      method_version: candidate.method_version,
      engine_version: engineVersion,
      priority: candidate.priority,
      question: candidate.question,
      refs: [...candidate.refs],
      evidences: [...(candidate.evidences ?? [])],
      alternative_explanations: [...(candidate.alternative_explanations ?? [])],
      falsifiers: [...(candidate.falsifiers ?? [])],
      dedup_key: dedupKey,
      estimated_cost: candidate.estimated_cost ?? null,
      origin_run_id: options.originRunId,
      visibility: candidate.visibility ?? "private",
      status: "queued",
      disposition: null,
      epistemic_outcome: null,
      revision: 0,
      lease_generation: 0,
      assigned_run_id: null,
      lease_expires_at: null,
      input_snapshot: options.inputSnapshot,
      retry_count: 0,
      next_eligible_at: null,
      outcome_refs: [],
      transitions: [
        {
          seq: 0,
          at: options.now,
          from_status: null,
          to_status: "queued",
          actor_run_id: options.originRunId,
          lease_generation: 0,
          reason: "enqueued",
          snapshot_id: options.inputSnapshot,
        },
      ],
      late_outputs: [],
      d12_redacted: false,
      d12_minimal_trace: null,
      re_review_reason: null,
    };
    nextItems.push(item);
    added_ids.push(id);
  }

  return {
    queue: DiscoveryQueueSchema.parse({
      ...queue,
      updated_at: options.now,
      items: nextItems,
    }),
    added_ids,
    duplicate_keys,
  };
}

export type LeaseFailureReason =
  | "not_found"
  | "revision_conflict"
  | "already_leased"
  | "invalid_status"
  | "not_yet_eligible";

export type LeaseResult =
  | { ok: true; queue: DiscoveryQueue; item: QueueItem }
  | { ok: false; reason: LeaseFailureReason; queue: DiscoveryQueue };

/**
 * Single deterministic allocator with optimistic concurrency (`expectedRevision`).
 * Allows acquiring a lease from `queued`, `failed_technical` (when eligible), or
 * reclaiming an expired `leased` / `researching` item.
 */
export function acquireLease(
  queue: DiscoveryQueue,
  params: {
    itemId: string;
    runId: string;
    expectedRevision: number;
    now: string;
    leaseDurationSeconds: number;
  },
): LeaseResult {
  const index = queue.items.findIndex((entry) => entry.id === params.itemId);
  if (index === -1) {
    return { ok: false, reason: "not_found", queue };
  }

  const item = queue.items[index] as QueueItem;
  if (item.revision !== params.expectedRevision) {
    return { ok: false, reason: "revision_conflict", queue };
  }

  if (item.next_eligible_at && item.next_eligible_at > params.now) {
    return { ok: false, reason: "not_yet_eligible", queue };
  }

  const isExpiredActiveLease =
    (item.status === "leased" || item.status === "researching") &&
    item.lease_expires_at !== null &&
    item.lease_expires_at <= params.now;

  if ((item.status === "leased" || item.status === "researching") && !isExpiredActiveLease) {
    return { ok: false, reason: "already_leased", queue };
  }

  if (item.status !== "queued" && item.status !== "failed_technical" && !isExpiredActiveLease) {
    return { ok: false, reason: "invalid_status", queue };
  }

  const nextGeneration = item.lease_generation + 1;
  const updatedItem: QueueItem = {
    ...item,
    status: "leased",
    revision: item.revision + 1,
    lease_generation: nextGeneration,
    assigned_run_id: params.runId,
    lease_expires_at: addSecondsIso(params.now, params.leaseDurationSeconds),
    transitions: [
      ...item.transitions,
      {
        seq: nextTransitionSeq(item),
        at: params.now,
        from_status: item.status,
        to_status: "leased",
        actor_run_id: params.runId,
        lease_generation: nextGeneration,
        reason: isExpiredActiveLease ? "reclaimed_expired_lease" : "lease_acquired",
      },
    ],
  };

  const nextItems = [...queue.items];
  nextItems[index] = updatedItem;

  return {
    ok: true,
    queue: DiscoveryQueueSchema.parse({
      ...queue,
      updated_at: params.now,
      items: nextItems,
    }),
    item: updatedItem,
  };
}

export function startResearch(
  queue: DiscoveryQueue,
  params: {
    itemId: string;
    runId: string;
    expectedRevision: number;
    leaseGeneration: number;
    now: string;
  },
): { ok: true; queue: DiscoveryQueue; item: QueueItem } | { ok: false; reason: string } {
  const index = queue.items.findIndex((entry) => entry.id === params.itemId);
  if (index === -1) return { ok: false, reason: "not_found" };

  const item = queue.items[index] as QueueItem;
  if (item.revision !== params.expectedRevision) return { ok: false, reason: "revision_conflict" };
  if (item.status !== "leased") return { ok: false, reason: "invalid_status" };
  if (item.lease_generation !== params.leaseGeneration) {
    return { ok: false, reason: "stale_lease_generation" };
  }
  if (item.assigned_run_id !== params.runId) return { ok: false, reason: "mismatched_run_id" };
  if (item.lease_expires_at !== null && item.lease_expires_at <= params.now) {
    return { ok: false, reason: "lease_expired" };
  }

  const updatedItem: QueueItem = {
    ...item,
    status: "researching",
    revision: item.revision + 1,
    transitions: [
      ...item.transitions,
      {
        seq: nextTransitionSeq(item),
        at: params.now,
        from_status: item.status,
        to_status: "researching",
        actor_run_id: params.runId,
        lease_generation: item.lease_generation,
        reason: "research_started",
      },
    ],
  };

  const nextItems = [...queue.items];
  nextItems[index] = updatedItem;

  return {
    ok: true,
    queue: DiscoveryQueueSchema.parse({
      ...queue,
      updated_at: params.now,
      items: nextItems,
    }),
    item: updatedItem,
  };
}

export type FinalizeParams = {
  itemId: string;
  runId: string;
  expectedRevision: number;
  leaseGeneration: number;
  now: string;
  targetStatus: "in_review" | "closed" | "failed_technical";
  disposition?: QueueDisposition;
  epistemic_outcome?: EpistemicOutcome;
  outcome_refs?: readonly string[];
  retryDelaySeconds?: number;
  reason?: string;
};

export type FinalizeResult =
  | { ok: true; queue: DiscoveryQueue; item: QueueItem }
  | {
      ok: false;
      reason: LateOutputReason | "not_found";
      queue: DiscoveryQueue;
      late_output_saved: boolean;
    };

/**
 * Finalize a leased/researching item with optimistic concurrency AND active lease
 * checks (`expectedRevision`, `leaseGeneration`, `assigned_run_id`, non-expired lease).
 * Late or conflicting outputs are preserved in `late_outputs` for re-evaluation
 * without overwriting the authoritative state or outcome.
 */
export function finalizeItem(queue: DiscoveryQueue, params: FinalizeParams): FinalizeResult {
  const index = queue.items.findIndex((entry) => entry.id === params.itemId);
  if (index === -1) {
    return { ok: false, reason: "not_found", queue, late_output_saved: false };
  }

  const item = queue.items[index] as QueueItem;

  let rejectionReason: LateOutputReason | null = null;
  if (item.status !== "leased" && item.status !== "researching") {
    rejectionReason = "not_active_lease";
  } else if (item.lease_generation !== params.leaseGeneration) {
    rejectionReason = "stale_lease_generation";
  } else if (item.assigned_run_id !== params.runId) {
    rejectionReason = "mismatched_run_id";
  } else if (item.lease_expires_at !== null && item.lease_expires_at <= params.now) {
    rejectionReason = "lease_expired";
  } else if (item.revision !== params.expectedRevision) {
    rejectionReason = "revision_conflict";
  }

  if (rejectionReason !== null) {
    const lateRecord = {
      run_id: params.runId,
      lease_generation: params.leaseGeneration,
      received_at: params.now,
      ...(params.disposition !== undefined ? { disposition: params.disposition } : {}),
      ...(params.epistemic_outcome !== undefined
        ? { epistemic_outcome: params.epistemic_outcome }
        : {}),
      outcome_refs: [...(params.outcome_refs ?? [])],
      reason: rejectionReason,
      ...(params.reason !== undefined ? { note: params.reason } : {}),
    };

    const updatedItem: QueueItem = {
      ...item,
      revision: item.revision + 1,
      late_outputs: [...item.late_outputs, lateRecord],
    };
    const nextItems = [...queue.items];
    nextItems[index] = updatedItem;

    return {
      ok: false,
      reason: rejectionReason,
      late_output_saved: true,
      queue: DiscoveryQueueSchema.parse({
        ...queue,
        updated_at: params.now,
        items: nextItems,
      }),
    };
  }

  const nextOutcome = params.epistemic_outcome ?? item.epistemic_outcome ?? null;
  const nextDisposition = params.disposition ?? item.disposition ?? null;
  const nextOutcomeRefs = params.outcome_refs ? [...params.outcome_refs] : [...item.outcome_refs];
  const isTechnicalFailure = params.targetStatus === "failed_technical";

  const updatedItem: QueueItem = {
    ...item,
    status: params.targetStatus,
    disposition: nextDisposition,
    epistemic_outcome: isTechnicalFailure ? (item.epistemic_outcome ?? null) : nextOutcome,
    outcome_refs: nextOutcomeRefs,
    revision: item.revision + 1,
    assigned_run_id: null,
    lease_expires_at: null,
    retry_count: isTechnicalFailure ? item.retry_count + 1 : item.retry_count,
    next_eligible_at:
      isTechnicalFailure && params.retryDelaySeconds !== undefined
        ? addSecondsIso(params.now, params.retryDelaySeconds)
        : null,
    transitions: [
      ...item.transitions,
      {
        seq: nextTransitionSeq(item),
        at: params.now,
        from_status: item.status,
        to_status: params.targetStatus,
        actor_run_id: params.runId,
        lease_generation: item.lease_generation,
        ...(params.reason !== undefined ? { reason: params.reason } : {}),
      },
    ],
  };

  const nextItems = [...queue.items];
  nextItems[index] = updatedItem;

  const nextNegativeMemory = [...queue.negative_memory];
  if (
    !isTechnicalFailure &&
    (nextOutcome === "contradicted" ||
      nextOutcome === "insufficient_evidence" ||
      nextOutcome === "undeterminable")
  ) {
    const existingNegIdx = nextNegativeMemory.findIndex(
      (entry) => entry.dedup_key === item.dedup_key,
    );
    const negEntry = {
      id: item.id,
      dedup_key: item.dedup_key,
      epistemic_outcome: nextOutcome,
      recorded_at: params.now,
      outcome_refs: nextOutcomeRefs,
      redacted_d12: item.d12_redacted,
      ...(item.d12_minimal_trace ? { redaction_note: item.d12_minimal_trace } : {}),
    };
    if (existingNegIdx >= 0) {
      nextNegativeMemory[existingNegIdx] = negEntry;
    } else {
      nextNegativeMemory.push(negEntry);
    }
  }

  return {
    ok: true,
    queue: DiscoveryQueueSchema.parse({
      ...queue,
      updated_at: params.now,
      items: nextItems,
      negative_memory: nextNegativeMemory,
    }),
    item: updatedItem,
  };
}

/**
 * Return closed or in_review items produced against an older snapshot back to
 * `in_review` when pertinent data changes occur.
 */
export function markStaleSnapshotsForReview(
  queue: DiscoveryQueue,
  params: {
    currentSnapshotId: string;
    affectedRefs?: readonly string[];
    now: string;
    actorRunId: string;
    reason?: string;
  },
): { queue: DiscoveryQueue; flagged_ids: string[] } {
  const affectedSet = params.affectedRefs ? new Set(params.affectedRefs) : null;
  const flagged_ids: string[] = [];

  const nextItems = queue.items.map((item) => {
    if (item.input_snapshot === params.currentSnapshotId) return item;
    if (item.status !== "closed" && item.status !== "in_review") return item;
    if (affectedSet && !item.refs.some((ref) => affectedSet.has(ref))) return item;

    flagged_ids.push(item.id);
    const nextStatus: QueueStatus = "in_review";
    return {
      ...item,
      status: nextStatus,
      revision: item.revision + 1,
      re_review_reason: params.reason ?? `stale_snapshot:${item.input_snapshot}`,
      transitions: [
        ...item.transitions,
        {
          seq: nextTransitionSeq(item),
          at: params.now,
          from_status: item.status,
          to_status: nextStatus,
          actor_run_id: params.actorRunId,
          lease_generation: item.lease_generation,
          reason: params.reason ?? `stale_snapshot:${item.input_snapshot}`,
          snapshot_id: params.currentSnapshotId,
        },
      ],
    };
  });

  return {
    queue: DiscoveryQueueSchema.parse({
      ...queue,
      updated_at: params.now,
      items: nextItems,
    }),
    flagged_ids,
  };
}

/**
 * D12 minimal-trace redaction: removes sensitive/personal details while
 * preserving the item's administrative trace and permanent negative-verification
 * memory entry.
 */
export function redactItemD12(
  queue: DiscoveryQueue,
  params: {
    itemId: string;
    minimalTrace: string;
    now: string;
    actorRunId: string;
  },
): DiscoveryQueue {
  const nextItems = queue.items.map((item) => {
    if (item.id !== params.itemId) return item;
    return {
      ...item,
      question: "[REDACTED D12]",
      refs: [],
      evidences: [],
      alternative_explanations: [],
      falsifiers: [],
      late_outputs: [],
      visibility: "private" as const,
      d12_redacted: true,
      d12_minimal_trace: params.minimalTrace,
      revision: item.revision + 1,
      transitions: [
        ...item.transitions,
        {
          seq: nextTransitionSeq(item),
          at: params.now,
          from_status: item.status,
          to_status: item.status,
          actor_run_id: params.actorRunId,
          lease_generation: item.lease_generation,
          reason: `d12_redacted:${params.minimalTrace}`,
        },
      ],
    };
  });

  const targetItem = queue.items.find((item) => item.id === params.itemId);
  const nextNegativeMemory = queue.negative_memory.map((entry) => {
    if (entry.id !== params.itemId && entry.dedup_key !== targetItem?.dedup_key) return entry;
    return {
      ...entry,
      outcome_refs: [],
      redacted_d12: true,
      redaction_note: params.minimalTrace,
    };
  });

  return DiscoveryQueueSchema.parse({
    ...queue,
    updated_at: params.now,
    items: nextItems,
    negative_memory: nextNegativeMemory,
  });
}

/**
 * Project only publishable, non-redacted queue items into the sanitized public
 * projection, stripping private operational fields.
 */
export function projectPublicQueue(queue: DiscoveryQueue): PublicQueue {
  const publishable = queue.items
    .filter((item) => item.visibility === "publishable" && !item.d12_redacted)
    .map((item) => ({
      id: item.id,
      method: item.method,
      method_version: item.method_version,
      engine_version: item.engine_version,
      question: item.question,
      status: item.status,
      disposition: item.disposition ?? null,
      epistemic_outcome: item.epistemic_outcome ?? null,
      outcome_refs: [...item.outcome_refs],
      input_snapshot: item.input_snapshot,
    }));

  return PublicQueueSchema.parse({
    schema_version: "1.0.0",
    updated_at: queue.updated_at,
    items: publishable,
  });
}
