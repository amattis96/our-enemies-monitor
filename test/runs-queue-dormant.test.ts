import { describe, expect, it } from "vitest";
import {
  closeDormantHypothesis,
  type DormantHypothesis,
  DormantHypothesisSchema,
  evaluateReactivation,
  type ReactivationSignal,
} from "../src/discovery/dormant.ts";
import type {
  DiscoveryGenerator,
  GeneratedCandidate,
} from "../src/discovery/generators/interface.ts";
import {
  acquireLease,
  createEmptyQueue,
  enqueueCandidates,
  finalizeItem,
  markStaleSnapshotsForReview,
  projectPublicQueue,
  redactItemD12,
  startResearch,
} from "../src/discovery/queue/index.ts";
import { ENGINE_VERSION } from "../src/engine/version.ts";
import type { GenealogySource } from "../src/pipeline/genealogy.ts";
import {
  detectMissedRuns,
  type RunManifest,
  RunManifestSchema,
  type ScheduledSlot,
  sanitizeRunManifest,
} from "../src/runs/index.ts";

describe("PK-08: RunManifest, sanitization, and missed-run detection", () => {
  it("strips private queries, sources_consulted, and sensitive error messages in sanitizeRunManifest", () => {
    const manifest: RunManifest = RunManifestSchema.parse({
      run_id: "run-2026-11-25-001",
      slot_id: "slot-daily-a",
      task: "task-a-discovery",
      role: "discovery",
      provider: "openai",
      model: "gpt-5",
      scheduled_at: "2026-11-25T06:00:00Z",
      started_at: "2026-11-25T06:00:12Z",
      finished_at: "2026-11-25T06:04:00Z",
      input_commit_sha: "abc1234",
      output_commit_sha: "def5678",
      engine_version: ENGINE_VERSION,
      window: {
        from: "2026-11-24T00:00:00Z",
        to: "2026-11-25T00:00:00Z",
      },
      queries: ["secret entity query", "private sanctions check"],
      sources_consulted: ["sources/incremental/private-doc.pdf", "https://internal.example/doc"],
      estimated_cost: 0.42,
      errors: [
        {
          code: "UPSTREAM_TIMEOUT",
          message: "Timed out after 30s",
          sensitive: false,
          stage: "fetch",
        },
        {
          code: "AUTH_ERROR",
          message: "Failed with Bearer secret-token-123 on sources/incremental/x.json",
          sensitive: true,
          stage: "auth",
        },
      ],
      status: "partial",
      notes: "Internal operator note",
    });

    const pub = sanitizeRunManifest(manifest) as Record<string, unknown>;
    expect(pub.queries).toBeUndefined();
    expect(pub.sources_consulted).toBeUndefined();
    expect(pub.notes).toBeUndefined();
    expect(pub.engine_version).toBe(ENGINE_VERSION);
    expect(pub.status).toBe("partial");

    const errors = pub.errors as Array<{ code: string; redacted: boolean; message?: string }>;
    expect(errors).toHaveLength(2);
    expect(errors[0]).toEqual({
      code: "UPSTREAM_TIMEOUT",
      stage: "fetch",
      redacted: false,
      message: "Timed out after 30s",
    });
    expect(errors[1]).toEqual({
      code: "AUTH_ERROR",
      stage: "auth",
      redacted: true,
    });
  });

  it("detects missed runs independently when scheduled slots have no recorded manifest past grace window", () => {
    const slots: ScheduledSlot[] = [
      {
        slot_id: "slot-01",
        task: "task-a",
        role: "discovery",
        provider: "github",
        model: "none",
        scheduled_at: "2026-11-25T06:00:00Z",
        grace_minutes: 30,
      },
      {
        slot_id: "slot-02",
        task: "task-b",
        role: "verifier",
        provider: "github",
        model: "none",
        scheduled_at: "2026-11-25T07:00:00Z",
        grace_minutes: 30,
      },
      {
        slot_id: "slot-03",
        task: "task-c",
        role: "discovery",
        provider: "github",
        model: "none",
        scheduled_at: "2026-11-25T08:50:00Z",
        grace_minutes: 30,
      },
    ];

    const recorded: RunManifest[] = [
      RunManifestSchema.parse({
        run_id: "run-slot-01",
        slot_id: "slot-01",
        task: "task-a",
        role: "discovery",
        provider: "github",
        model: "none",
        scheduled_at: "2026-11-25T06:00:00Z",
        started_at: "2026-11-25T06:01:00Z",
        finished_at: "2026-11-25T06:05:00Z",
        engine_version: ENGINE_VERSION,
        status: "completed_no_results",
      }),
    ];

    const result = detectMissedRuns(slots, recorded, {
      now: "2026-11-25T09:00:00Z",
    });

    expect(result.matched_slot_ids).toEqual(["slot-01"]);
    expect(result.pending_slot_ids).toEqual(["slot-03"]);
    expect(result.missed).toHaveLength(1);
    expect(result.missed[0]?.status).toBe("missed");
    expect(result.missed[0]?.slot_id).toBe("slot-02");
    expect(result.missed[0]?.started_at).toBeNull();
  });
});

describe("PK-09: Discovery queue, optimistic concurrency, deduplication, and projections", () => {
  const sampleGenerator: DiscoveryGenerator = {
    metadata: {
      id: "open-triad-v1",
      version: "1.0.0",
      description: "Test generator",
    },
    generate(): readonly GeneratedCandidate[] {
      return [
        {
          method: "open-triad-v1",
          method_version: "1.0.0",
          priority: 80,
          question: "Does Entity A control Entity B through Intermediary C?",
          refs: ["ent:a", "ent:b", "ent:c"],
          evidences: ["src:1"],
          alternative_explanations: ["Shared commercial vendor"],
          falsifiers: ["Independent registry showing distinct ownership"],
          visibility: "publishable",
        },
      ];
    },
  };

  it("allows only one of two concurrent runs to acquire a lease", () => {
    const candidates = sampleGenerator.generate({
      snapshot_id: "snap-1",
      dataset_hash: "a".repeat(64),
      engine_version: ENGINE_VERSION,
      generated_at: "2026-11-25T10:00:00Z",
      run_id: "gen-1",
    }) as readonly GeneratedCandidate[];

    const enqueued = enqueueCandidates(createEmptyQueue("2026-11-25T10:00:00Z"), candidates, {
      originRunId: "gen-1",
      inputSnapshot: "snap-1",
      now: "2026-11-25T10:00:00Z",
    });
    const itemId = enqueued.added_ids[0] as string;

    const firstLease = acquireLease(enqueued.queue, {
      itemId,
      runId: "worker-1",
      expectedRevision: 0,
      now: "2026-11-25T10:01:00Z",
      leaseDurationSeconds: 300,
    });
    expect(firstLease.ok).toBe(true);
    if (!firstLease.ok) return;

    const secondLease = acquireLease(firstLease.queue, {
      itemId,
      runId: "worker-2",
      expectedRevision: 0,
      now: "2026-11-25T10:01:05Z",
      leaseDurationSeconds: 300,
    });
    expect(secondLease.ok).toBe(false);
    if (!secondLease.ok) {
      expect(secondLease.reason).toBe("revision_conflict");
    }
  });

  it("rejects late finalization after lease expiry and reassignment without overwriting authoritative outcome", () => {
    const candidates = sampleGenerator.generate({
      snapshot_id: "snap-1",
      dataset_hash: "a".repeat(64),
      engine_version: ENGINE_VERSION,
      generated_at: "2026-11-25T10:00:00Z",
      run_id: "gen-1",
    }) as readonly GeneratedCandidate[];

    const enqueued = enqueueCandidates(createEmptyQueue("2026-11-25T10:00:00Z"), candidates, {
      originRunId: "gen-1",
      inputSnapshot: "snap-1",
      now: "2026-11-25T10:00:00Z",
    });
    const itemId = enqueued.added_ids[0] as string;

    // Worker 1 acquires lease (gen=1, rev=1, expires at 10:06:00Z)
    const lease1 = acquireLease(enqueued.queue, {
      itemId,
      runId: "worker-1",
      expectedRevision: 0,
      now: "2026-11-25T10:01:00Z",
      leaseDurationSeconds: 300,
    });
    expect(lease1.ok).toBe(true);
    if (!lease1.ok) return;

    const started1 = startResearch(lease1.queue, {
      itemId,
      runId: "worker-1",
      expectedRevision: lease1.item.revision,
      leaseGeneration: lease1.item.lease_generation,
      now: "2026-11-25T10:01:30Z",
    });
    expect(started1.ok).toBe(true);
    if (!started1.ok) return;

    // Lease expires at 10:06:00Z; Worker 2 reclaims at 10:07:00Z (gen=2)
    const lease2 = acquireLease(started1.queue, {
      itemId,
      runId: "worker-2",
      expectedRevision: started1.item.revision,
      now: "2026-11-25T10:07:00Z",
      leaseDurationSeconds: 300,
    });
    expect(lease2.ok).toBe(true);
    if (!lease2.ok) return;
    expect(lease2.item.lease_generation).toBe(2);

    // Worker 2 finalizes cleanly
    const finalized2 = finalizeItem(lease2.queue, {
      itemId,
      runId: "worker-2",
      expectedRevision: lease2.item.revision,
      leaseGeneration: 2,
      now: "2026-11-25T10:08:00Z",
      targetStatus: "closed",
      disposition: "accepted",
      epistemic_outcome: "confirmed",
      outcome_refs: ["claim:valid-1"],
    });
    expect(finalized2.ok).toBe(true);
    if (!finalized2.ok) return;

    // Worker 1 arrives late with stale generation=1 and tries to overwrite with contradicted
    const lateFinalize1 = finalizeItem(finalized2.queue, {
      itemId,
      runId: "worker-1",
      expectedRevision: started1.item.revision,
      leaseGeneration: 1,
      now: "2026-11-25T10:09:00Z",
      targetStatus: "closed",
      disposition: "accepted",
      epistemic_outcome: "contradicted",
      outcome_refs: ["claim:stale-1"],
    });
    expect(lateFinalize1.ok).toBe(false);
    if (!lateFinalize1.ok) {
      expect(lateFinalize1.late_output_saved).toBe(true);
    }

    const finalItem = lateFinalize1.queue.items[0];
    expect(finalItem?.epistemic_outcome).toBe("confirmed");
    expect(finalItem?.outcome_refs).toEqual(["claim:valid-1"]);
    expect(finalItem?.late_outputs).toHaveLength(1);
    expect(finalItem?.late_outputs[0]?.run_id).toBe("worker-1");
  });

  it("prevents duplicates on queue regeneration and separates status, disposition, and epistemic_outcome", () => {
    const candidates = sampleGenerator.generate({
      snapshot_id: "snap-1",
      dataset_hash: "a".repeat(64),
      engine_version: ENGINE_VERSION,
      generated_at: "2026-11-25T10:00:00Z",
      run_id: "gen-1",
    }) as readonly GeneratedCandidate[];

    const firstPass = enqueueCandidates(createEmptyQueue("2026-11-25T10:00:00Z"), candidates, {
      originRunId: "gen-1",
      inputSnapshot: "snap-1",
      now: "2026-11-25T10:00:00Z",
    });
    expect(firstPass.added_ids).toHaveLength(1);

    const secondPass = enqueueCandidates(firstPass.queue, candidates, {
      originRunId: "gen-2",
      inputSnapshot: "snap-1",
      now: "2026-11-25T10:05:00Z",
    });
    expect(secondPass.added_ids).toHaveLength(0);
    expect(secondPass.duplicate_keys).toHaveLength(1);

    const itemId = firstPass.added_ids[0] as string;
    const lease = acquireLease(secondPass.queue, {
      itemId,
      runId: "worker-1",
      expectedRevision: 0,
      now: "2026-11-25T10:06:00Z",
      leaseDurationSeconds: 300,
    });
    if (!lease.ok) throw new Error("Expected lease");

    // Technical failure must not fabricate an epistemic_outcome
    const techFail = finalizeItem(lease.queue, {
      itemId,
      runId: "worker-1",
      expectedRevision: lease.item.revision,
      leaseGeneration: lease.item.lease_generation,
      now: "2026-11-25T10:07:00Z",
      targetStatus: "failed_technical",
      retryDelaySeconds: 60,
      reason: "provider_503",
    });
    expect(techFail.ok).toBe(true);
    if (!techFail.ok) return;
    expect(techFail.item.status).toBe("failed_technical");
    expect(techFail.item.epistemic_outcome).toBeNull();

    // Re-lease after retry delay and close with insufficient_evidence
    const retryLease = acquireLease(techFail.queue, {
      itemId,
      runId: "worker-2",
      expectedRevision: techFail.item.revision,
      now: "2026-11-25T10:09:00Z",
      leaseDurationSeconds: 300,
    });
    if (!retryLease.ok) throw new Error("Expected retry lease");

    const closed = finalizeItem(retryLease.queue, {
      itemId,
      runId: "worker-2",
      expectedRevision: retryLease.item.revision,
      leaseGeneration: retryLease.item.lease_generation,
      now: "2026-11-25T10:10:00Z",
      targetStatus: "closed",
      disposition: "accepted",
      epistemic_outcome: "insufficient_evidence",
      outcome_refs: ["note:gap-1"],
    });
    if (!closed.ok) throw new Error("Expected close");

    expect(closed.queue.negative_memory).toHaveLength(1);
    expect(projectPublicQueue(closed.queue).items).toHaveLength(1);

    // Stale snapshot returns item to in_review
    const stale = markStaleSnapshotsForReview(closed.queue, {
      currentSnapshotId: "snap-2",
      affectedRefs: ["ent:a"],
      now: "2026-11-25T11:00:00Z",
      actorRunId: "snapshot-watcher",
    });
    expect(stale.flagged_ids).toEqual([itemId]);
    expect(stale.queue.items[0]?.status).toBe("in_review");

    // D12 redaction keeps negative memory minimal trace and removes from public projection
    const redacted = redactItemD12(stale.queue, {
      itemId,
      minimalTrace: "Removed per D12 retention policy",
      now: "2026-11-25T12:00:00Z",
      actorRunId: "d12-sweeper",
    });
    expect(redacted.negative_memory).toHaveLength(1);
    expect(redacted.negative_memory[0]?.redacted_d12).toBe(true);
    expect(projectPublicQueue(redacted).items).toHaveLength(0);
  });
});

describe("PK-10: Dormant hypotheses and material novelty reactivation", () => {
  const baseHypothesis: DormantHypothesis = DormantHypothesisSchema.parse({
    hypothesis_id: "hyp-001",
    status: "dormant",
    fingerprint: {
      entities: ["ent:alpha", "ent:beta"],
      places: ["place:geneva"],
      themes: ["theme:sanctions-evasion"],
      period: { from: "2025-01-01", to: "2025-12-31" },
      techniques: ["shell-company-layering"],
    },
    known_source_ids: ["src:orig-1"],
    known_root_ids: ["src:root-1"],
    last_checked_at: "2026-11-01T00:00:00Z",
    min_recheck_interval_hours: 168,
    novelty_threshold: 0.5,
  });

  const genealogy: GenealogySource[] = [
    { id: "src:root-1", type: "external_reference", origin_type: "primary_document" },
    {
      id: "src:reprise-1",
      type: "external_reference",
      origin_type: "republication",
      derived_from: ["src:root-1"],
    },
    { id: "src:root-2", type: "external_reference", origin_type: "primary_document" },
    {
      id: "src:same-inst-repub",
      type: "external_reference",
      origin_type: "republication",
      derived_from: ["src:root-1"],
    },
    {
      id: "src:same-inst-new",
      type: "external_reference",
      origin_type: "primary_document",
    },
  ];

  const cases: Array<{
    name: string;
    signal: ReactivationSignal;
    expectedReactivate: boolean;
    expectedTriggerKind: "scheduled_cold_case_check" | "evidentiary_reopening";
  }> = [
    {
      name: "news reprise never reactivates",
      signal: {
        signal_id: "sig-1",
        trigger_kind: "evidentiary_reopening",
        signal_type: "news_reprise",
        source_id: "src:reprise-1",
        observed_at: "2026-11-25T10:00:00Z",
        summary: "Newspaper syndicates old report",
      },
      expectedReactivate: false,
      expectedTriggerKind: "evidentiary_reopening",
    },
    {
      name: "irrelevant source never reactivates",
      signal: {
        signal_id: "sig-2",
        trigger_kind: "evidentiary_reopening",
        signal_type: "irrelevant_source",
        source_id: "src:root-2",
        observed_at: "2026-11-25T10:00:00Z",
        summary: "Unrelated maritime notice",
      },
      expectedReactivate: false,
      expectedTriggerKind: "evidentiary_reopening",
    },
    {
      name: "periodic check without novelty never reactivates",
      signal: {
        signal_id: "sig-3",
        trigger_kind: "scheduled_cold_case_check",
        signal_type: "periodic_check",
        source_id: "src:orig-1",
        observed_at: "2026-11-25T10:00:00Z",
        summary: "Monthly cold-case sweep",
      },
      expectedReactivate: false,
      expectedTriggerKind: "scheduled_cold_case_check",
    },
    {
      name: "independent discriminating evidence reactivates",
      signal: {
        signal_id: "sig-4",
        trigger_kind: "evidentiary_reopening",
        signal_type: "independent_discriminating_evidence",
        source_id: "src:root-2",
        is_discriminating: true,
        fingerprint_match_score: 0.9,
        observed_at: "2026-11-25T10:00:00Z",
        summary: "Independent court filing names beneficial owner",
      },
      expectedReactivate: true,
      expectedTriggerKind: "evidentiary_reopening",
    },
    {
      name: "substantive source retraction reactivates",
      signal: {
        signal_id: "sig-5",
        trigger_kind: "evidentiary_reopening",
        signal_type: "source_retraction",
        source_id: "src:root-1",
        substantive_retraction: true,
        observed_at: "2026-11-25T10:00:00Z",
        summary: "Original publisher retracted key attribution",
      },
      expectedReactivate: true,
      expectedTriggerKind: "evidentiary_reopening",
    },
    {
      name: "documented refutation reactivates",
      signal: {
        signal_id: "sig-6",
        trigger_kind: "evidentiary_reopening",
        signal_type: "documented_refutation",
        source_id: "src:root-2",
        documented_refutation: true,
        observed_at: "2026-11-25T10:00:00Z",
        summary: "Registry audit disproves ownership link",
      },
      expectedReactivate: true,
      expectedTriggerKind: "evidentiary_reopening",
    },
    {
      name: "same-institution republication sharing root does not reactivate",
      signal: {
        signal_id: "sig-7",
        trigger_kind: "evidentiary_reopening",
        signal_type: "same_institution_document",
        source_id: "src:same-inst-repub",
        institution_id: "inst:ministry-x",
        same_institution_new_facts: true,
        observed_at: "2026-11-25T10:00:00Z",
        summary: "Re-issued circular from same root",
      },
      expectedReactivate: false,
      expectedTriggerKind: "evidentiary_reopening",
    },
    {
      name: "same-institution new primary document with new discriminating facts reactivates",
      signal: {
        signal_id: "sig-8",
        trigger_kind: "evidentiary_reopening",
        signal_type: "same_institution_document",
        source_id: "src:same-inst-new",
        institution_id: "inst:ministry-x",
        same_institution_new_facts: true,
        is_discriminating: true,
        observed_at: "2026-11-25T10:00:00Z",
        summary: "New primary enforcement annex from same institution",
      },
      expectedReactivate: true,
      expectedTriggerKind: "evidentiary_reopening",
    },
  ];

  for (const tc of cases) {
    it(tc.name, () => {
      const outcome = evaluateReactivation(baseHypothesis, tc.signal, {
        sourcesGraph: genealogy,
      });
      expect(outcome.reactivate).toBe(tc.expectedReactivate);
      expect(outcome.trigger_kind).toBe(tc.expectedTriggerKind);
      expect(outcome.hypothesis.reactivation_history).toHaveLength(1);
      expect(outcome.hypothesis.status).toBe(tc.expectedReactivate ? "reactivated" : "dormant");
    });
  }

  it("enforces motivated closures only (refuted or closed_insufficient)", () => {
    const closed = closeDormantHypothesis(baseHypothesis, {
      reason: "closed_insufficient",
      rationale: "No independent corroboration after two cold-case cycles.",
      closed_at: "2026-11-25T12:00:00Z",
    });
    expect(closed.status).toBe("closed_insufficient");
    expect(closed.closure_reason).toBe("closed_insufficient");

    expect(() =>
      closeDormantHypothesis(baseHypothesis, {
        reason: "refuted",
        rationale: "   ",
        closed_at: "2026-11-25T12:00:00Z",
      }),
    ).toThrow();
  });
});
