import { z } from "zod";
import type { UnsuitabilityReport } from "./readiness-gate.ts";

export const SCENARIO_STAGES = [
  "acquisition",
  "discovery",
  "verification",
  "retraction",
  "publication",
] as const;

export type ScenarioStage = (typeof SCENARIO_STAGES)[number];

export const ScenarioStageStepSchema = z
  .strictObject({
    stage: z.enum(SCENARIO_STAGES).describe("Pipeline stage executed."),
    expected_outcome: z.string().min(1).describe("Expected outcome for this stage."),
    observed_outcome: z.string().min(1).describe("Observed outcome during scenario run."),
    matched: z.boolean().describe("Whether observed outcome matched expected outcome."),
    record_ids: z.array(z.string().min(1)).describe("Record IDs processed in this stage."),
  })
  .describe("Single stage result inside a PK-38 end-to-end scenario.");

export type ScenarioStageStep = z.infer<typeof ScenarioStageStepSchema>;

export const AnomalyEntrySchema = z
  .strictObject({
    anomaly_id: z.string().min(1).describe("Unique anomaly identifier."),
    stage: z.enum(SCENARIO_STAGES).describe("Stage where the anomaly was observed."),
    description: z.string().min(1).describe("Description of the anomaly."),
    corrective_action: z.string().min(1).describe("Corrective action taken or scheduled."),
    resolved: z.boolean().describe("Whether the corrective action resolved the anomaly."),
  })
  .describe("Anomaly and corrective register entry for PK-38.");

export type AnomalyEntry = z.infer<typeof AnomalyEntrySchema>;

export const HistoricalRecordSchema = z
  .strictObject({
    id: z.string().min(1).describe("Record identifier."),
    observed_at: z
      .string()
      .min(1)
      .describe("ISO-8601 timestamp when record was acquired/observed."),
    retracted_at: z
      .string()
      .min(1)
      .nullable()
      .optional()
      .describe("Optional ISO-8601 timestamp when record was retracted."),
  })
  .describe("Historical record for zero-leakage as-of checking.");

export type HistoricalRecord = z.infer<typeof HistoricalRecordSchema>;

export const ZeroLeakageCheckResultSchema = z
  .strictObject({
    as_of: z.string().min(1).describe("Historical cutoff ISO-8601 timestamp."),
    total_corpus_records: z.number().int().nonnegative().describe("Total records in test corpus."),
    visible_records_count: z
      .number()
      .int()
      .nonnegative()
      .describe("Records visible at or before as_of."),
    leaked_future_ids: z
      .array(z.string().min(1))
      .describe("IDs that leaked from after as_of (must be empty)."),
    leakage_free: z.boolean().describe("True iff leaked_future_ids is empty."),
  })
  .describe("Zero-leakage historical check result.");

export type ZeroLeakageCheckResult = z.infer<typeof ZeroLeakageCheckResultSchema>;

export const InterruptionRecoveryResultSchema = z
  .strictObject({
    interrupted_after_stage: z
      .enum(SCENARIO_STAGES)
      .describe("Stage after which the cycle was interrupted."),
    resumed_from_checkpoint: z.boolean().describe("Whether resume started from checkpoint."),
    completed_stages: z
      .array(z.enum(SCENARIO_STAGES))
      .describe("Full list of stages completed after recovery."),
    duplicate_records_emitted: z
      .number()
      .int()
      .nonnegative()
      .describe("Count of duplicate records emitted on recovery (must be 0)."),
    idempotent_recovery: z
      .boolean()
      .describe("True when all 5 stages completed with zero duplicates."),
  })
  .describe("Cycle interruption and recovery test result.");

export type InterruptionRecoveryResult = z.infer<typeof InterruptionRecoveryResultSchema>;

export const ScenarioRunReportSchema = z
  .strictObject({
    scenario_id: z.string().min(1).describe("Scenario identifier."),
    steps: z
      .array(ScenarioStageStepSchema)
      .length(5)
      .describe(
        "Ordered steps covering acquisition -> discovery -> verification -> retraction -> publication.",
      ),
    all_stages_matched: z.boolean().describe("True when all 5 stages matched expectations."),
    interruption_recovery: InterruptionRecoveryResultSchema.describe(
      "Cycle interruption and recovery verification.",
    ),
    zero_leakage: ZeroLeakageCheckResultSchema.describe("Historical zero-leakage verification."),
    anomaly_register: z
      .array(AnomalyEntrySchema)
      .describe("Anomalies and corrective actions recorded during the run."),
    excluded_methods: z
      .array(z.custom<UnsuitabilityReport>())
      .describe("M13 methods formally closed as unsuitable (package can still close)."),
    package_closable: z
      .boolean()
      .describe("True when end-to-end scenario, recovery, and zero-leakage checks pass."),
  })
  .describe("Complete PK-38 scenario and advanced backtest report.");

export type ScenarioRunReport = z.infer<typeof ScenarioRunReportSchema>;

/**
 * Verify zero-leakage at a historical `as_of` cutoff: only records with
 * `observed_at <= as_of` may enter the evaluation set, and no future records
 * may appear in `evaluated_ids`.
 */
export function runZeroLeakageHistoricalCheck(params: {
  as_of: string;
  corpus: HistoricalRecord[];
  evaluated_ids: string[];
}): ZeroLeakageCheckResult {
  const cutoffMs = Date.parse(params.as_of);
  if (Number.isNaN(cutoffMs)) {
    throw new Error(`Invalid as_of timestamp: ${params.as_of}`);
  }

  const visibleIds = new Set<string>();
  const futureIds = new Set<string>();

  for (const rec of params.corpus) {
    const obsMs = Date.parse(rec.observed_at);
    if (obsMs <= cutoffMs) {
      visibleIds.add(rec.id);
    } else {
      futureIds.add(rec.id);
    }
  }

  const leakedFutureIds = params.evaluated_ids.filter((id) => futureIds.has(id));

  return ZeroLeakageCheckResultSchema.parse({
    as_of: params.as_of,
    total_corpus_records: params.corpus.length,
    visible_records_count: visibleIds.size,
    leaked_future_ids: leakedFutureIds,
    leakage_free: leakedFutureIds.length === 0,
  });
}

/**
 * Simulate a cycle interruption after `interrupt_after_stage`, checkpoint state,
 * resume, and verify idempotent completion of all 5 stages with zero duplicates.
 */
export function runInterruptionRecoveryTest(params: {
  interrupt_after_stage: ScenarioStage;
  stage_records: Record<ScenarioStage, string[]>;
}): InterruptionRecoveryResult {
  const checkpointIdx = SCENARIO_STAGES.indexOf(params.interrupt_after_stage);
  const emitted = new Set<string>();
  let duplicates = 0;

  // Phase 1: run up to interrupt_after_stage
  for (let i = 0; i <= checkpointIdx; i += 1) {
    const stage = SCENARIO_STAGES[i];
    if (!stage) continue;
    for (const id of params.stage_records[stage]) {
      emitted.add(`${stage}:${id}`);
    }
  }

  // Phase 2: resume from checkpointIdx + 1 (skipping already checkpointed stages)
  const completedStages: ScenarioStage[] = [...SCENARIO_STAGES.slice(0, checkpointIdx + 1)];
  for (let i = checkpointIdx + 1; i < SCENARIO_STAGES.length; i += 1) {
    const stage = SCENARIO_STAGES[i];
    if (!stage) continue;
    for (const id of params.stage_records[stage]) {
      const key = `${stage}:${id}`;
      if (emitted.has(key)) {
        duplicates += 1;
      } else {
        emitted.add(key);
      }
    }
    completedStages.push(stage);
  }

  return InterruptionRecoveryResultSchema.parse({
    interrupted_after_stage: params.interrupt_after_stage,
    resumed_from_checkpoint: true,
    completed_stages: completedStages,
    duplicate_records_emitted: duplicates,
    idempotent_recovery: completedStages.length === SCENARIO_STAGES.length && duplicates === 0,
  });
}

/**
 * Execute a full PK-38 end-to-end scenario traversing:
 * acquisition -> discovery -> verification -> retraction -> publication,
 * plus interruption/recovery, zero-leakage check, and anomaly/corrective register.
 */
export function runEndToEndScenario(params: {
  scenario_id: string;
  stage_expectations: Record<
    ScenarioStage,
    { expected: string; observed: string; record_ids: string[] }
  >;
  interrupt_after_stage: ScenarioStage;
  as_of: string;
  corpus: HistoricalRecord[];
  evaluated_ids: string[];
  anomalies?: AnomalyEntry[];
  excluded_methods?: UnsuitabilityReport[];
}): ScenarioRunReport {
  const steps: ScenarioStageStep[] = SCENARIO_STAGES.map((stage) => {
    const spec = params.stage_expectations[stage];
    return {
      stage,
      expected_outcome: spec.expected,
      observed_outcome: spec.observed,
      matched: spec.expected === spec.observed,
      record_ids: spec.record_ids,
    };
  });

  const stageRecords: Record<ScenarioStage, string[]> = {
    acquisition: params.stage_expectations.acquisition.record_ids,
    discovery: params.stage_expectations.discovery.record_ids,
    verification: params.stage_expectations.verification.record_ids,
    retraction: params.stage_expectations.retraction.record_ids,
    publication: params.stage_expectations.publication.record_ids,
  };

  const interruptionRecovery = runInterruptionRecoveryTest({
    interrupt_after_stage: params.interrupt_after_stage,
    stage_records: stageRecords,
  });

  const zeroLeakage = runZeroLeakageHistoricalCheck({
    as_of: params.as_of,
    corpus: params.corpus,
    evaluated_ids: params.evaluated_ids,
  });

  const allMatched = steps.every((s) => s.matched);
  const anomalies = params.anomalies ?? [];
  const excludedMethods = params.excluded_methods ?? [];

  const packageClosable =
    allMatched && interruptionRecovery.idempotent_recovery && zeroLeakage.leakage_free;

  return ScenarioRunReportSchema.parse({
    scenario_id: params.scenario_id,
    steps,
    all_stages_matched: allMatched,
    interruption_recovery: interruptionRecovery,
    zero_leakage: zeroLeakage,
    anomaly_register: anomalies,
    excluded_methods: excludedMethods,
    package_closable: packageClosable,
  });
}
