import { describe, expect, it } from "vitest";
import {
  type AlarmRecord,
  advanceCountermeasureStage,
  type BriefEvidenceItem,
  type Countermeasure,
  computeBrierScore,
  extractFalseAlarmExamples,
  generateDailyAlert,
  generateWeeklyBrief,
} from "../src/briefs/index.ts";
import {
  allocateBudget,
  buildM9TelemetrySnapshot,
  createCriticSession,
  createDefaultCapabilityRegistry,
  createDefaultLifecycleRegistry,
  evaluateBackpressure,
  type FourResourceBudget,
  finalizeCriticReview,
  generateCoverageBiasReport,
  getBlindEvaluationPayload,
  getProviderAdapter,
  M9TelemetrySnapshotSchema,
  type OemTaskContract,
  revealAuthorConclusion,
  shouldThrottleTask,
  submitBlindEvaluation,
  validateTaskOutput,
} from "../src/orchestration/index.ts";
import type { RunManifest } from "../src/runs/schema.ts";

describe("PK-12 Orchestration: Backpressure & 4-Resource Budget", () => {
  it("throttles P3/P4 under saturation while leaving P0/P1 untouched", () => {
    const bp = evaluateBackpressure({
      open_prs: 9,
      review_queue: 22,
      avg_wait_minutes: 240,
    });
    expect(bp.level).toBe("saturated");
    expect(bp.throttled_priorities).toEqual(["P3", "P4"]);
    expect(shouldThrottleTask("P0", bp).throttled).toBe(false);
    expect(shouldThrottleTask("P1", bp).throttled).toBe(false);
    expect(shouldThrottleTask("P2", bp).throttled).toBe(false);
    expect(shouldThrottleTask("P3", bp).throttled).toBe(true);
    expect(shouldThrottleTask("P4", bp).throttled).toBe(true);
  });

  it("enforces P0/P1 reserve and motivated soft-quota exceptions across 4 resources", () => {
    const initialBudget: FourResourceBudget = {
      window_label: "2026-W47",
      resources: {
        api_cost_usd: { total_limit: 100, used: 70, p0_p1_reserve: 20, soft_quota: 75 },
        subscription_units: { total_limit: 1000, used: 200, p0_p1_reserve: 200, soft_quota: 700 },
        agent_runtime_minutes: { total_limit: 500, used: 100, p0_p1_reserve: 100, soft_quota: 350 },
        review_capacity_items: { total_limit: 40, used: 10, p0_p1_reserve: 10, soft_quota: 25 },
      },
      exceptions: [],
    };

    // P3 cannot dip into P0/P1 reserve (70 + 15 = 85 > 100 - 20 = 80)
    const blockedReserve = allocateBudget(initialBudget, {
      resource: "api_cost_usd",
      priority: "P3",
      amount: 15,
      exceptionReason: "Extra sweep",
    });
    expect(blockedReserve.granted).toBe(false);

    // Crossing soft_quota without a motivated exception is rejected
    const missingReason = allocateBudget(initialBudget, {
      resource: "api_cost_usd",
      priority: "P2",
      amount: 8,
    });
    expect(missingReason.granted).toBe(false);

    // Crossing soft_quota with a motivated exception succeeds and logs it
    const withException = allocateBudget(initialBudget, {
      resource: "api_cost_usd",
      priority: "P2",
      amount: 8,
      exceptionReason: "Urgent EU election pre-event verification",
      timestamp: "2026-11-25T10:00:00Z",
    });
    expect(withException.granted).toBe(true);
    expect(withException.budget.exceptions).toHaveLength(1);

    // P0 can use the P0/P1 reserve
    const criticalAlloc = allocateBudget(withException.budget, {
      resource: "api_cost_usd",
      priority: "P0",
      amount: 15,
      exceptionReason: "P0 incident response",
      timestamp: "2026-11-25T10:05:00Z",
    });
    expect(criticalAlloc.granted).toBe(true);
    expect(criticalAlloc.budget.resources.api_cost_usd.used).toBe(93);

    const biasReport = generateCoverageBiasReport("2026-W47", [
      { country: "Germany", language: "de", actor_type: "state", source_type: "official" },
      { country: "Germany", language: "de", actor_type: "proxy", source_type: "osint" },
      { country: "France", language: "fr", actor_type: "state", source_type: "official" },
    ]);
    expect(biasReport.total_observations).toBe(3);
    expect(biasReport.warnings.length).toBeGreaterThan(0);

    const telemetry = buildM9TelemetrySnapshot({
      timestamp: "2026-11-25T10:10:00Z",
      metrics: { open_prs: 9, review_queue: 20, avg_wait_minutes: 200 },
      budget: criticalAlloc.budget,
      throttledCountsByPriority: { P0: 0, P1: 0, P2: 0, P3: 4, P4: 7 },
      coverageBias: biasReport,
    });
    expect(() => M9TelemetrySnapshotSchema.parse(telemetry)).not.toThrow();
    expect(telemetry.backpressure_level).toBe("saturated");
    expect(telemetry.active_exceptions).toBe(2);
  });
});

describe("PK-12 Orchestration: Component Lifecycle & Isolation", () => {
  it("suspends and rolls back an M8/M9 component without interrupting Tasks A-D", () => {
    const registry = createDefaultLifecycleRegistry("2026-11-25T08:00:00Z");

    // Tasks A-C start active; new M8/M9 components start in shadow mode
    expect(registry.canExecute("task-a").effective_mode).toBe("active");
    expect(registry.canExecute("discovery-engine").effective_mode).toBe("shadow");
    expect(registry.canExecute("discovery-engine").mutates_production).toBe(false);

    // Promote discovery-engine to experimental, then suspend & roll back
    registry.transitionComponent("discovery-engine", "experimental", {
      actor: "maintainer",
      reason: "Pilot promotion",
      timestamp: "2026-11-25T09:00:00Z",
    });
    const suspended = registry.suspendComponent("discovery-engine", "Queue spike", {
      actor: "orchestrator",
      timestamp: "2026-11-25T09:30:00Z",
    });
    expect(suspended.suspended).toBe(true);
    expect(suspended.state).toBe("shadow");
    expect(registry.canExecute("discovery-engine").allowed).toBe(false);

    // Legacy Tasks A-D remain completely uninterrupted
    const legacyHealth = registry.verifyLegacyTasksUninterrupted();
    expect(legacyHealth.uninterrupted).toBe(true);
    expect(registry.canExecute("task-a").allowed).toBe(true);
    expect(registry.canExecute("task-b").allowed).toBe(true);
    expect(registry.canExecute("task-c").allowed).toBe(true);

    // Rollback clears suspension and restores target state
    const rolledBack = registry.rollbackComponent("discovery-engine", "Return to shadow", {
      targetState: "shadow",
      timestamp: "2026-11-25T10:00:00Z",
    });
    expect(rolledBack.suspended).toBe(false);
    expect(rolledBack.state).toBe("shadow");
    expect(registry.canExecute("discovery-engine").allowed).toBe(true);
  });
});

describe("PK-12 Orchestration: Task Contract & Provider Adapters", () => {
  it("switches across ChatGPT, Claude, and Generic adapters with equivalent validated output", () => {
    const contract: OemTaskContract = {
      contract_version: "1.0",
      task_id: "discovery-shadow-01",
      role: "discovery",
      priority: "P2",
      input: {
        snapshot_id: "snap-2026-11-25",
        window_from: "2026-11-24T00:00:00Z",
        window_to: "2026-11-25T00:00:00Z",
        refs: ["ENT-001"],
        instructions: "Run actor maturation sweep in shadow mode.",
      },
      expected_output: {
        format: "oem_task_output_v1",
        require_findings: false,
        require_manifest: true,
      },
      policy: {
        allow_direct_push: false,
        allow_source_mutation: false,
        require_run_manifest: true,
        require_evidence_refs: true,
        max_cost_usd: 2.5,
        max_runtime_minutes: 15,
      },
      required_tools: ["git_read", "structured_json", "manifest_emit"],
    };

    const capRegistry = createDefaultCapabilityRegistry();
    for (const provider of ["chatgpt", "claude", "generic"] as const) {
      expect(capRegistry.checkCompatibility(contract, provider).compatible).toBe(true);

      const adapter = getProviderAdapter(provider);
      const formatted = adapter.formatPrompt(contract);
      expect(formatted.provider).toBe(provider);

      const rawJson = JSON.stringify({
        contract_version: "1.0",
        task_id: "discovery-shadow-01",
        status: "completed_with_results",
        summary: "Identified one actor maturation lead.",
        findings: [{ id: "F-1", title: "Subsidiary link", refs: ["Fonte_01"] }],
        manifest: {
          run_id: `run-${provider}-01`,
          task: "discovery-shadow-01",
          role: "discovery",
          provider,
          model: `${provider}-model`,
          scheduled_at: "2026-11-25T01:00:00Z",
          started_at: "2026-11-25T01:00:05Z",
          finished_at: "2026-11-25T01:02:00Z",
          engine_version: "0.1.0",
          status: "completed_with_results",
        },
      });

      const parsed = adapter.parseOutput(rawJson);
      const validated = validateTaskOutput(contract, parsed);
      expect(validated.valid).toBe(true);
      expect(validated.normalized?.findings).toEqual([
        { id: "F-1", title: "Subsidiary link", refs: ["Fonte_01"] },
      ]);
      expect(validated.normalized?.status).toBe("completed_with_results");
    }
  });
});

describe("PK-12 Devil's Advocate Anti-Anchoring Critic Protocol", () => {
  it("selects a different benchmark model and enforces blind source evaluation before author conclusion", () => {
    const session = createCriticSession({
      session_id: "critic-art-0042",
      target_id: "ART-0042",
      claim_question: "Did Actor X fund the regional media network?",
      is_major_verification: true,
      sources: [
        {
          source_id: "SRC-1",
          title: "Corporate Registry Filing",
          excerpt: "Registry lists shared director without direct shareholding transfer.",
        },
      ],
      author_conclusion: {
        author_provider: "openai",
        author_model: "gpt-5.4",
        verdict: "supported",
        summary: "Actor X directly funded the network.",
        cited_source_ids: ["SRC-1"],
      },
      candidates: [
        { provider: "openai", model: "gpt-5.4", benchmark_score: 0.91, eligible_for_critic: true },
        {
          provider: "anthropic",
          model: "claude-opus-4.5",
          benchmark_score: 0.89,
          eligible_for_critic: true,
        },
      ],
    });

    expect(session.critic_selection.model).toBe("claude-opus-4.5");
    expect(session.critic_selection.model).not.toBe(session.author_conclusion.author_model);

    const blindPayload = getBlindEvaluationPayload(session);
    expect(blindPayload.author_conclusion_redacted).toBe(true);

    // Attempting to reveal author conclusion or finalize before blind eval must fail
    expect(() => revealAuthorConclusion(session)).toThrow(/Anti-anchoring violation/);
    expect(() => finalizeCriticReview(session)).toThrow(/Anti-anchoring violation/);

    const afterBlind = submitBlindEvaluation(session, {
      independent_verdict: "partially_supported",
      source_assessments: [
        {
          source_id: "SRC-1",
          reliability: "high",
          supports_claim: false,
          notes: "Shows shared director only, not direct funding.",
        },
      ],
      alternative_hypotheses: ["Coincidental board overlap without financial transfer."],
      confidence: "medium",
      evaluated_at: "2026-11-25T11:00:00Z",
    });

    expect(revealAuthorConclusion(afterBlind).verdict).toBe("supported");
    const finalized = finalizeCriticReview(afterBlind, {
      discrepancies: ["Author overstated funding link from director overlap."],
      compared_at: "2026-11-25T11:05:00Z",
    });

    expect(finalized.report?.anchoring_risk_detected).toBe(true);
    expect(finalized.report?.agrees_with_author).toBe(false);
    expect(finalized.report?.final_recommendation).toBe("request_revision");
  });
});

describe("PK-13 Briefs, Alarms, Brier Scoring & Countermeasures", () => {
  const sampleManifests: RunManifest[] = [
    {
      run_id: "run-a-1",
      task: "task-a",
      role: "osint_ingest",
      provider: "chatgpt",
      model: "gpt-5.4",
      scheduled_at: "2026-11-24T00:30:00Z",
      started_at: "2026-11-24T00:30:10Z",
      finished_at: "2026-11-24T00:35:00Z",
      engine_version: "0.1.0",
      queries: ["disinformation germany"],
      sources_consulted: ["https://example.eu/report"],
      errors: [],
      status: "completed_with_results",
    },
    {
      run_id: "run-a-2",
      task: "task-a",
      role: "osint_ingest",
      provider: "chatgpt",
      model: "gpt-5.4",
      scheduled_at: "2026-11-25T00:30:00Z",
      started_at: "2026-11-25T00:30:05Z",
      finished_at: "2026-11-25T00:32:00Z",
      engine_version: "0.1.0",
      queries: ["infrastructure baltics"],
      sources_consulted: [],
      errors: [],
      status: "completed_no_results",
    },
    {
      run_id: "run-b-missed",
      task: "task-b",
      role: "editorial",
      provider: "chatgpt",
      model: "gpt-5.4",
      scheduled_at: "2026-11-25T02:00:00Z",
      started_at: null,
      finished_at: null,
      engine_version: "0.1.0",
      queries: [],
      sources_consulted: [],
      errors: [],
      status: "missed",
    },
  ];

  const sampleItems: BriefEvidenceItem[] = [
    {
      item_id: "CASE-101",
      title: "Coordinated portal network in Germany",
      country: "Germany",
      actor: "Actor-A",
      theme: "disinformation",
      severity: "high",
      observed_at: "2026-11-24T12:00:00Z",
      conclusion: "Network amplified election narratives across 4 domains.",
      source_refs: ["Fonte_15"],
      run_id: "run-a-1",
    },
    {
      item_id: "CASE-102",
      title: "Subsea cable telemetry anomaly",
      country: "Estonia",
      actor: "Actor-B",
      theme: "infrastructure",
      severity: "medium",
      observed_at: "2026-11-24T18:00:00Z",
      conclusion: "No sabotage confirmed; maintenance vessel logged.",
      source_refs: ["Fonte_16"],
      run_id: "run-a-1",
    },
  ];

  const sampleAlarms: AlarmRecord[] = [
    {
      alarm_id: "ALM-1",
      title: "Pre-election clone domain spike",
      created_at: "2026-11-10T09:00:00Z",
      country: "Germany",
      actor: "Actor-A",
      theme: "disinformation",
      severity: "high",
      outcome: "open",
      resolved_at: null,
      case_refs: ["CASE-101"],
      run_id: "run-a-1",
    },
    {
      alarm_id: "ALM-2",
      title: "Suspected GPS spoofing corridor",
      created_at: "2026-11-05T09:00:00Z",
      country: "Estonia",
      actor: "Actor-B",
      theme: "infrastructure",
      severity: "medium",
      outcome: "false_alarm",
      resolved_at: "2026-11-12T15:00:00Z",
      resolution_note: "Verified as routine military exercise NOTAM.",
      what_triggered_it: "Single ADS-B anomaly cluster.",
      lesson_learned: "Cross-check civil NOTAMs before raising infrastructure alarms.",
      case_refs: ["CASE-102"],
      run_id: "run-a-1",
      forecast: {
        probability: 0.2,
        verifiable_event: "Official aviation authority attributes spoofing to hostile actor",
        horizon_end: "2026-11-15T00:00:00Z",
        resolution_rule: "official_attribution_published",
        registered_at: "2026-11-05T09:05:00Z",
      },
    },
  ];

  const initialCountermeasure: Countermeasure = {
    countermeasure_id: "CM-1",
    case_id: "CASE-101",
    title: "EU DSA platform notice & domain takedown",
    actor: "Actor-A",
    country: "Germany",
    theme: "disinformation",
    stage: "adoption",
    declared_at: "2026-11-20T10:00:00Z",
    stage_history: [
      {
        stage: "adoption",
        recorded_at: "2026-11-20T10:00:00Z",
        evidence_refs: ["EU-DSA-2026-11"],
        note: "Regulatory order adopted.",
      },
    ],
  };

  it("tracks alarm outcomes, pre-registered Brier scores, false-alarm examples, and 4 countermeasure stages", () => {
    // Open alarm has no Brier score
    expect(computeBrierScore(sampleAlarms[0] as AlarmRecord)).toBeNull();
    // Pre-registered false alarm with p=0.2, y=0 -> (0.2 - 0)^2 = 0.04
    expect(computeBrierScore(sampleAlarms[1] as AlarmRecord)).toBe(0.04);

    // Post-hoc forecast registered AFTER resolution is rejected (returns null)
    const postHocAlarm: AlarmRecord = {
      ...(sampleAlarms[1] as AlarmRecord),
      forecast: {
        probability: 0.05,
        verifiable_event: "Attribution",
        horizon_end: "2026-11-15T00:00:00Z",
        resolution_rule: "official_attribution_published",
        registered_at: "2026-11-13T00:00:00Z",
      },
    };
    expect(computeBrierScore(postHocAlarm)).toBeNull();

    const negatives = extractFalseAlarmExamples(sampleAlarms);
    expect(negatives).toHaveLength(1);
    expect(negatives[0]?.alarm_id).toBe("ALM-2");

    // Advance countermeasure through all 4 distinct stages
    const cm2 = advanceCountermeasureStage(initialCountermeasure, {
      stage: "entry_into_force",
      recorded_at: "2026-11-21T10:00:00Z",
      evidence_refs: ["EU-OJ-2026"],
      note: "Entered into force.",
    });
    const cm3 = advanceCountermeasureStage(cm2, {
      stage: "implementation",
      recorded_at: "2026-11-22T10:00:00Z",
      evidence_refs: ["REG-LOG-1"],
      note: "Registrars suspended domains.",
    });
    const cm4 = advanceCountermeasureStage(cm3, {
      stage: "observed_effectiveness",
      recorded_at: "2026-11-24T10:00:00Z",
      evidence_refs: ["OBS-TRAFFIC-1"],
      note: "Referral traffic dropped 82%.",
    });
    expect(cm4.stage).toBe("observed_effectiveness");
    expect(cm4.effectiveness_note).toBe("Referral traffic dropped 82%.");
  });

  it("generates 4 conclusion-first briefs coherent with PK-08 manifests and filters", () => {
    const cmImplemented = advanceCountermeasureStage(initialCountermeasure, {
      stage: "implementation",
      recorded_at: "2026-11-22T10:00:00Z",
      evidence_refs: ["REG-LOG-1"],
      note: "Domains suspended.",
    });

    // Brief 1: Unfiltered weekly brief
    const weeklyAll = generateWeeklyBrief({
      window_from: "2026-11-18T00:00:00Z",
      window_to: "2026-11-25T23:59:59Z",
      items: sampleItems,
      alarms: sampleAlarms,
      countermeasures: [cmImplemented],
      manifests: sampleManifests,
    });
    expect(weeklyAll.kind).toBe("weekly_brief");
    expect(weeklyAll.key_findings).toHaveLength(2);
    expect(weeklyAll.run_reconciliation.total_runs).toBe(3);
    expect(weeklyAll.run_reconciliation.missed_run_ids).toEqual(["run-b-missed"]);
    expect(weeklyAll.run_reconciliation.zero_result_run_ids).toEqual(["run-a-2"]);
    expect(weeklyAll.executive_conclusion).toContain("Weekly Brief");

    // Brief 2: Country + theme filtered weekly brief (Germany / disinformation)
    const weeklyGermany = generateWeeklyBrief({
      window_from: "2026-11-18T00:00:00Z",
      window_to: "2026-11-25T23:59:59Z",
      items: sampleItems,
      alarms: sampleAlarms,
      countermeasures: [cmImplemented],
      manifests: sampleManifests,
      filter: { country: "Germany", theme: "disinformation" },
    });
    expect(weeklyGermany.key_findings).toHaveLength(1);
    expect(weeklyGermany.alarms_summary.open_count).toBe(1);
    expect(weeklyGermany.alarms_summary.false_alarm_count).toBe(0);
    expect(weeklyGermany.countermeasures_summary.by_stage.implementation).toBe(1);

    // Brief 3: Actor filtered daily alert (Actor-B)
    const dailyActorB = generateDailyAlert({
      window_from: "2026-11-24T00:00:00Z",
      window_to: "2026-11-25T00:00:00Z",
      items: sampleItems,
      alarms: sampleAlarms,
      countermeasures: [cmImplemented],
      manifests: sampleManifests,
      filter: { actor: "Actor-B" },
    });
    expect(dailyActorB.kind).toBe("daily_alert");
    expect(dailyActorB.key_findings).toHaveLength(1);
    expect(dailyActorB.alarms_summary.false_alarm_count).toBe(1);
    expect(dailyActorB.alarms_summary.mean_brier_score).toBe(0.04);

    // Brief 4: Empty-match filtered daily alert still reconciles PK-08 manifests cleanly
    const dailyEmpty = generateDailyAlert({
      window_from: "2026-11-24T00:00:00Z",
      window_to: "2026-11-25T00:00:00Z",
      items: sampleItems,
      alarms: sampleAlarms,
      countermeasures: [cmImplemented],
      manifests: sampleManifests,
      filter: { country: "Italy" },
    });
    expect(dailyEmpty.key_findings).toHaveLength(0);
    expect(dailyEmpty.run_reconciliation.total_runs).toBe(3);
    expect(dailyEmpty.executive_conclusion).toContain("No new qualifying findings");
  });
});
