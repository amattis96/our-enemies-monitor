import { describe, expect, it } from "vitest";
import {
  analyzeCoOccurrenceWithNullModel,
  analyzeIncidentCampaignSignals,
  backtestSequentialFalseAlarmRate,
  buildUnsuitabilityReport,
  computeAalenJohansenAttributionTiming,
  computeCoverageAdjustedSeries,
  createObservationalPilotDataset,
  estimateCaptureRecapture,
  evaluateHawkesProcess,
  evaluateReadinessGate,
  getPlatformAdapter,
  guardPublicSpatialAggregation,
  pilotDatasetToGateInput,
  type ReadinessGateDecision,
  registerPlatformAdapter,
  runEndToEndScenario,
  runInterruptionRecoveryTest,
  runKulldorffSpaceTimeScan,
  runSequentialDetection,
  runZeroLeakageHistoricalCheck,
} from "../src/statistics/index.ts";

function makePassingGate(method: ReadinessGateDecision["method"]): ReadinessGateDecision {
  return evaluateReadinessGate({
    method,
    elapsed_months: 14,
    missing_period_ratio: 0.02,
    source_discontinuities: 0,
    denominator_present: true,
    denominator_coherent: true,
    usable_observations: 60,
    observed_cycles: 2,
    collection_criteria_changes: 0,
    independent_test_period_available: true,
    independent_test_observations: 18,
  });
}

describe("Data Readiness Gate (M13)", () => {
  it("blocks activation when elapsed_months >= 12 but statistical criteria fail", () => {
    const decision = evaluateReadinessGate({
      method: "pk34_cusum_ewma",
      elapsed_months: 24,
      missing_period_ratio: 0.35,
      source_discontinuities: 3,
      denominator_present: false,
      denominator_coherent: false,
      usable_observations: 12,
      observed_cycles: 1,
      collection_criteria_changes: 2,
      independent_test_period_available: false,
      independent_test_observations: 0,
    });

    expect(decision.administrative_minimum_met).toBe(true);
    expect(decision.elapsed_months_sufficient_alone).toBe(false);
    expect(decision.activated).toBe(false);
    expect(decision.outcome).toBe("blocked");
    expect(decision.failed_criteria).toEqual([
      "completeness",
      "denominator",
      "volume",
      "seasonality",
      "stability",
      "validability",
    ]);
  });

  it("activates only when all 6 criteria pass and emits valid unsuitability reports", () => {
    const passing = makePassingGate("pk34_poisson_nb_baseline");
    expect(passing.activated).toBe(true);
    expect(passing.outcome).toBe("activated");
    expect(passing.failed_criteria).toEqual([]);

    const unsuitable = evaluateReadinessGate({
      method: "pk36_hawkes_process",
      elapsed_months: 18,
      missing_period_ratio: 0.05,
      source_discontinuities: 0,
      denominator_present: true,
      denominator_coherent: true,
      usable_observations: 10,
      observed_cycles: 1,
      collection_criteria_changes: 0,
      independent_test_period_available: false,
      independent_test_observations: 0,
      permanent_data_limitation: true,
      limitation_reason: "Insufficient high-resolution event timestamps for Hawkes excitation.",
    });

    expect(unsuitable.activated).toBe(false);
    expect(unsuitable.outcome).toBe("unsuitable");
    expect(unsuitable.unsuitability_report?.valid_closing_outcome).toBe(true);
    expect(unsuitable.unsuitability_report?.report_type).toBe("unsuitability_report");
  });
});

describe("PK-32: Incident-campaign coupling", () => {
  it("registers modular adapters and enforces zero automatic attribution from temporal correlation", () => {
    registerPlatformAdapter({
      platform: "bluesky",
      provenance_terms: "Public ATProto firehose subset under research terms.",
      extractPosts: () => [],
    });
    expect(getPlatformAdapter("telegram")).toBeDefined();
    expect(getPlatformAdapter("bluesky")).toBeDefined();

    const result = analyzeIncidentCampaignSignals({
      incident_id: "INC-2026-01",
      incident_at: "2026-05-01T10:00:00Z",
      window_hours: 6,
      coordination_gap_minutes: 5,
      ordinary_baseline_rate_per_hour: 1,
      simple_reference_threshold: 2,
      posts: [
        {
          post_id: "p1",
          platform: "telegram",
          account_id: "acct-1",
          published_at: "2026-05-01T10:10:00Z",
          content_hash: "hash-coord",
        },
        // Duplicate on same account/platform/hash should be deduplicated
        {
          post_id: "p1-dup",
          platform: "telegram",
          account_id: "acct-1",
          published_at: "2026-05-01T10:11:00Z",
          content_hash: "hash-coord",
        },
        {
          post_id: "p2",
          platform: "telegram",
          account_id: "acct-2",
          published_at: "2026-05-01T10:12:00Z",
          content_hash: "hash-coord",
        },
        // Negative controls
        {
          post_id: "p3",
          platform: "rss_news",
          account_id: "wire-1",
          published_at: "2026-05-01T10:15:00Z",
          content_hash: "hash-wire",
          negative_control: "wire_service",
        },
        {
          post_id: "p4",
          platform: "rss_news",
          account_id: "news-1",
          published_at: "2026-05-01T10:20:00Z",
          content_hash: "hash-repub",
          negative_control: "news_republication",
        },
      ],
    });

    expect(result.signal_only).toBe(true);
    expect(result.proof_status).toBe("signal_not_proof");
    expect(result.automatic_attribution).toBe(false);
    expect(result.deduplicated_post_count).toBe(4);
    expect(result.negative_control_counts.wire_service).toBe(1);
    expect(result.negative_control_counts.news_republication).toBe(1);
    expect(result.incident_to_amplification_lag_minutes).toBe(10);
    expect(result.coordination_clusters).toHaveLength(1);
    expect(result.lifecycle_mode).toBe("shadow");
  });

  it("downgrades spikes explained by negative controls and closes unsuitable if benchmark fails", () => {
    const gate = makePassingGate("pk32_incident_campaign");
    const result = analyzeIncidentCampaignSignals({
      incident_id: "INC-2026-02",
      incident_at: "2026-05-02T10:00:00Z",
      window_hours: 4,
      coordination_gap_minutes: 5,
      ordinary_baseline_rate_per_hour: 2,
      simple_reference_threshold: 2,
      gate_decision: gate,
      posts: [
        {
          post_id: "n1",
          platform: "rss_news",
          account_id: "alert-bot",
          published_at: "2026-05-02T10:02:00Z",
          content_hash: "hash-alert",
          negative_control: "automated_alert",
        },
        {
          post_id: "n2",
          platform: "telegram",
          account_id: "public-ch",
          published_at: "2026-05-02T10:04:00Z",
          content_hash: "hash-spont",
          negative_control: "spontaneous_peak",
        },
      ],
    });

    expect(result.benchmark_passed).toBe(false);
    expect(result.lifecycle_mode).toBe("unsuitable");
    expect(result.unsuitability_report?.valid_closing_outcome).toBe(true);
    expect(result.automatic_attribution).toBe(false);
  });
});

describe("PK-33: Observational pilot dataset", () => {
  it("tracks public denominators, ordinary non-hostile events, and coverage-adjusted rates", () => {
    const dataset = createObservationalPilotDataset({
      domain: "subsea_cable_baltic",
      denominator_name: "maritime_vessel_transits",
      documented_criteria: "AIS-correlated Baltic subsea cable contact events v1",
      observations: [
        {
          id: "obs-1",
          period: "2025-01",
          domain: "subsea_cable_baltic",
          classification: "ordinary_non_hostile",
          incident_count: 2,
          denominator_value: 10000,
          denominator_unit: "transits",
          retrospective_comparable: true,
          collection_criteria_version: "v1",
        },
        {
          id: "obs-2",
          period: "2025-02",
          domain: "subsea_cable_baltic",
          classification: "contested",
          incident_count: 4,
          denominator_value: 10000,
          denominator_unit: "transits",
          retrospective_comparable: true,
          collection_criteria_version: "v1",
        },
      ],
      coverage_log: [
        { period: "2025-01", coverage_ratio: 0.5, active_sources: 3, criteria_version: "v1" },
        { period: "2025-02", coverage_ratio: 1.0, active_sources: 6, criteria_version: "v1" },
      ],
    });

    expect(dataset.storage_scope).toBe("observational_pilot");
    expect(dataset.distinct_from_curated_corpus).toBe(true);

    const series = computeCoverageAdjustedSeries(dataset);
    // Doubling coverage from 0.5 to 1.0 while incidents double from 2 to 4 keeps coverage-adjusted rate constant (4 per 10k).
    expect(series[0]?.coverage_adjusted_rate_per_10k).toBe(4);
    expect(series[1]?.coverage_adjusted_rate_per_10k).toBe(4);

    const gateInput = pilotDatasetToGateInput({
      dataset,
      method: "pk34_poisson_nb_baseline",
      elapsed_months: 12,
      expected_periods: 2,
      observed_cycles: 1,
      independent_test_observations: 0,
    });
    expect(gateInput.denominator_present).toBe(true);
    expect(evaluateReadinessGate(gateInput).activated).toBe(false);
  });
});

describe("PK-34: Sequential detection", () => {
  it("blocks execution when gate fails and emits internal-only queue items when gate passes", () => {
    const blockedGate = evaluateReadinessGate({
      method: "pk34_cusum_ewma",
      elapsed_months: 15,
      missing_period_ratio: 0.25,
      source_discontinuities: 0,
      denominator_present: true,
      denominator_coherent: true,
      usable_observations: 40,
      observed_cycles: 2,
      collection_criteria_changes: 0,
      independent_test_period_available: true,
      independent_test_observations: 15,
    });

    const blockedRes = runSequentialDetection({
      domain: "gnss_interference_air",
      model_type: "negative_binomial",
      baseline_rate_per_unit: 0.001,
      dispersion: 0.2,
      target_arl0: 200,
      cusum_shift_multiplier: 2,
      ewma_lambda: 0.25,
      multiple_testing_control: "arl_conditioned_stopping",
      gate_decision: blockedGate,
      observations: [
        {
          period: "2025-01",
          observed_count: 5,
          denominator: 5000,
          seasonality_factor: 1,
          coverage_ratio: 1,
        },
      ],
    });
    expect(blockedRes.status).toBe("blocked");
    expect(blockedRes.queue_items).toEqual([]);

    const passingGate = makePassingGate("pk34_cusum_ewma");
    const activeRes = runSequentialDetection({
      domain: "gnss_interference_air",
      model_type: "negative_binomial",
      baseline_rate_per_unit: 0.001,
      dispersion: 0.1,
      target_arl0: 200,
      cusum_shift_multiplier: 2,
      ewma_lambda: 0.3,
      multiple_testing_control: "alpha_spending_lan_demets",
      gate_decision: passingGate,
      observations: [
        {
          period: "2025-01",
          observed_count: 5,
          denominator: 5000,
          seasonality_factor: 1,
          coverage_ratio: 1,
        },
        {
          period: "2025-02",
          observed_count: 5,
          denominator: 5000,
          seasonality_factor: 1,
          coverage_ratio: 1,
        },
        {
          period: "2025-03",
          observed_count: 35,
          denominator: 5000,
          seasonality_factor: 1,
          coverage_ratio: 1,
        },
      ],
    });

    expect(activeRes.status).toBe("executed");
    expect(activeRes.visibility).toBe("internal_only");
    expect(activeRes.queue_items.length).toBeGreaterThan(0);
    expect(activeRes.queue_items.every((q) => q.visibility === "internal_only")).toBe(true);

    const backtest = backtestSequentialFalseAlarmRate({
      result: activeRes,
      in_control_periods: ["2025-01", "2025-02"],
    });
    expect(backtest.within_tolerance).toBe(true);
    expect(backtest.false_alarms).toBe(0);
  });

  it("rejects naive Benjamini-Hochberg on sequential tests", () => {
    const passingGate = makePassingGate("pk34_cusum_ewma");
    expect(() =>
      runSequentialDetection({
        domain: "gnss_interference_air",
        model_type: "poisson",
        baseline_rate_per_unit: 0.001,
        dispersion: 0,
        target_arl0: 200,
        cusum_shift_multiplier: 2,
        ewma_lambda: 0.25,
        // @ts-expect-error naive_benjamini_hochberg must be rejected
        multiple_testing_control: "naive_benjamini_hochberg",
        gate_decision: passingGate,
        observations: [
          {
            period: "2025-01",
            observed_count: 2,
            denominator: 2000,
            seasonality_factor: 1,
            coverage_ratio: 1,
          },
        ],
      }),
    ).toThrow();
  });
});

describe("PK-35: Spatial analysis & disclosure guard", () => {
  it("runs gated Kulldorff scan and strips operational details from public atlas", () => {
    const gate = makePassingGate("pk35_kulldorff_scan");
    const scan = runKulldorffSpaceTimeScan({
      gate_decision: gate,
      baseline_rate: 0.001,
      min_cell_count_for_public: 5,
      observations: [
        {
          cell_id: "baltic-grid-42",
          region_code: "BAL-N",
          period: "2025-03",
          observed_incidents: 12,
          infrastructure_density: 1000,
          ordinary_activity: 2000,
          geolocation_precision: "grid_10km",
          facility_id: "SUBSEA-NODE-99",
          coordinates: { lat: 59.4, lon: 24.7 },
        },
        {
          cell_id: "baltic-grid-07",
          region_code: "BAL-S",
          period: "2025-03",
          observed_incidents: 2,
          infrastructure_density: 1000,
          ordinary_activity: 2000,
          geolocation_precision: "exact_facility",
          facility_id: "SUBSEA-NODE-07",
        },
      ],
    });

    expect(scan.status).toBe("executed");
    expect(scan.visibility).toBe("internal_only");
    expect(scan.top_llr).toBeGreaterThan(0);

    const publicAtlas = guardPublicSpatialAggregation({
      scan_result: scan,
      min_cell_count: 5,
    });
    expect(publicAtlas).toHaveLength(2);
    const balN = publicAtlas.find((a) => a.region_code === "BAL-N");
    const balS = publicAtlas.find((a) => a.region_code === "BAL-S");
    expect(balN?.aggregated_incidents).toBe(12);
    expect(balN?.relative_risk_band).toBe("elevated");
    expect(balN?.operational_details_stripped).toBe(true);
    // Small cell < 5 is suppressed
    expect(balS?.aggregated_incidents).toBe(0);
    expect(balS?.relative_risk_band).toBe("suppressed");
    expect(JSON.stringify(publicAtlas)).not.toContain("SUBSEA-NODE-99");
    expect(JSON.stringify(publicAtlas)).not.toContain("59.4");
  });
});

describe("PK-36: Experimental methods & unsuitability reports", () => {
  it("enforces method caveats and gate conditioning across all 4 experimental methods", () => {
    const aj = computeAalenJohansenAttributionTiming({
      cohort_definition: "Verified European subsea incidents 2024-2025",
      gate_decision: makePassingGate("pk36_aalen_johansen"),
      subjects: [
        { case_id: "C1", time_days: 10, outcome: "attributed" },
        { case_id: "C2", time_days: 20, outcome: "retracted_or_non_hostile" },
        { case_id: "C3", time_days: 30, outcome: "censored" },
      ],
    });
    expect(aj.status).toBe("executed");
    expect(aj.estimator).toBe("aalen_johansen_competing_risks");
    expect(aj.cold_case_reopening_estimated).toBe(false);
    expect(aj.cumulative_incidence.length).toBe(2);

    const cr = estimateCaptureRecapture({
      phenomenon: "GNSS spoofing events",
      territory: "Eastern Baltic",
      gate_decision: makePassingGate("pk36_capture_recapture"),
      list_a_count: 20,
      list_b_count: 15,
      overlap_count: 5,
      genealogically_independent: true,
    });
    expect(cr.status).toBe("executed");
    expect(cr.genealogical_independence_not_statistical_independence).toBe(true);
    expect(cr.chapman_estimate).toBeGreaterThan(30);

    const cooc = analyzeCoOccurrenceWithNullModel({
      gate_decision: makePassingGate("pk36_cooccurrence_null"),
      total_cases: 100,
      edges: [
        {
          entity_a: "E1",
          entity_b: "E2",
          observed_cooccurrences: 12,
          degree_a: 20,
          degree_b: 10,
          shared_case_structure_weight: 1.0,
        },
      ],
    });
    expect(cooc.status).toBe("executed");
    expect(cooc.internal_quality_check_only).toBe(true);
    expect(cooc.public_export_forbidden).toBe(true);
    expect(cooc.scored_pairs[0]?.significant_beyond_hub_degree).toBe(true);

    const hawkes = evaluateHawkesProcess({
      gate_decision: makePassingGate("pk36_hawkes_process"),
      event_times_days: [1, 1.5, 2.2, 8, 8.3, 15],
      homogeneous_poisson_aic: 50,
      external_common_cause_aic: 45,
      mu: 0.3,
      alpha: 0.4,
      beta: 1.0,
    });
    expect(hawkes.status).toBe("executed");
    expect(hawkes.causal_proof).toBe(false);
  });
});

describe("PK-38: End-to-end scenarios, interruption/recovery, zero-leakage", () => {
  it("runs full pipeline scenario, verifies idempotent recovery, zero-leakage, and anomaly register", () => {
    const excluded = buildUnsuitabilityReport({
      method: "pk36_hawkes_process",
      elapsed_months: 12,
      failed_criteria: ["volume", "validability"],
      rationale: "Insufficient event density for self-exciting process.",
    });

    const report = runEndToEndScenario({
      scenario_id: "SCEN-2026-BALTIC-01",
      stage_expectations: {
        acquisition: { expected: "2_records", observed: "2_records", record_ids: ["R1", "R2"] },
        discovery: { expected: "1_candidate", observed: "1_candidate", record_ids: ["D1"] },
        verification: { expected: "1_verified", observed: "1_verified", record_ids: ["V1"] },
        retraction: { expected: "1_retracted", observed: "1_retracted", record_ids: ["RET-001"] },
        publication: { expected: "1_snapshot", observed: "1_snapshot", record_ids: ["SNAP-01"] },
      },
      interrupt_after_stage: "verification",
      as_of: "2026-03-01T00:00:00Z",
      corpus: [
        { id: "R1", observed_at: "2026-01-15T00:00:00Z" },
        { id: "R2", observed_at: "2026-02-10T00:00:00Z" },
        { id: "R3-future", observed_at: "2026-04-01T00:00:00Z" },
      ],
      evaluated_ids: ["R1", "R2"],
      anomalies: [
        {
          anomaly_id: "ANOM-01",
          stage: "retraction",
          description: "Delayed mirror purge on secondary cache",
          corrective_action: "Added explicit staleness check before publication",
          resolved: true,
        },
      ],
      excluded_methods: [excluded],
    });

    expect(report.all_stages_matched).toBe(true);
    expect(report.interruption_recovery.idempotent_recovery).toBe(true);
    expect(report.interruption_recovery.duplicate_records_emitted).toBe(0);
    expect(report.zero_leakage.leakage_free).toBe(true);
    expect(report.package_closable).toBe(true);

    // Also verify zero-leakage detector catches future record leakage
    const leaked = runZeroLeakageHistoricalCheck({
      as_of: "2026-03-01T00:00:00Z",
      corpus: [
        { id: "R1", observed_at: "2026-01-15T00:00:00Z" },
        { id: "R3-future", observed_at: "2026-04-01T00:00:00Z" },
      ],
      evaluated_ids: ["R1", "R3-future"],
    });
    expect(leaked.leakage_free).toBe(false);
    expect(leaked.leaked_future_ids).toEqual(["R3-future"]);

    const recovery = runInterruptionRecoveryTest({
      interrupt_after_stage: "discovery",
      stage_records: {
        acquisition: ["A1"],
        discovery: ["D1"],
        verification: ["V1"],
        retraction: ["RET1"],
        publication: ["PUB1"],
      },
    });
    expect(recovery.completed_stages).toEqual([
      "acquisition",
      "discovery",
      "verification",
      "retraction",
      "publication",
    ]);
  });
});
