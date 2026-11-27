import { z } from "zod";
import type { InferenceRegistry } from "../editorial/inferences.ts";
import { readInferenceRegistry } from "../editorial/inferences.ts";
import {
  comparePartialDates,
  type Dataset,
  Entity,
  Event,
  Exposure,
  Hypothesis,
  Relationship,
  Source,
} from "../model/index.ts";
import { readDataFiles } from "../pipeline/load.ts";
import { validateDataFiles } from "../pipeline/validate.ts";
import {
  type AccessSurface,
  type AsofResult,
  type RecordRevision,
  resolveAsOf,
} from "../temporal/index.ts";
import type { AttributionClaimRecord, ProceduralRecord } from "./generators/open-triads.ts";
import {
  GENERATOR_ACTIVATION_STATES,
  type GeneratorActivationState,
  runGeneratorRegistry,
  type ValidationTarget,
} from "./generators/registry.ts";

export const BACKTEST_EXPERIMENTS = ["retrospective_backtest", "historical_replay"] as const;
export type BacktestExperiment = (typeof BACKTEST_EXPERIMENTS)[number];

export const BACKTEST_MODES = ["canonical", "acquired"] as const;
export type BacktestMode = (typeof BACKTEST_MODES)[number];

export const LLM_TEMPORAL_CONTAMINATION_DISCLAIMER =
  "TEMPORAL CONTAMINATION DISCLAIMER: Any LLM-assisted scoring, priors, or evaluation of historical dates may be affected by pretraining temporal contamination (knowledge of post-cutoff events). Deterministic generator backtests measure structural candidate generation only and must not be interpreted as contamination-free predictive accuracy.";

export const RETROSPECTIVE_PARTIAL_DISCLAIMER =
  "RETROSPECTIVE-PARTIAL RECONSTRUCTION DISCLAIMER: Reconstructions prior to registry inception or without contemporaneous snapshots are retrospective-partial approximations derived from later corpus records, not complete historical knowledge states.";

export const PerMethodYieldSchema = z
  .strictObject({
    method: z.string().min(1).describe("Discovery generator method identifier."),
    activation: z
      .enum(GENERATOR_ACTIVATION_STATES)
      .describe("Activation state of the generator during the run."),
    candidate_count: z
      .number()
      .int()
      .nonnegative()
      .describe("Total candidates produced by this method."),
    ex_ante_quality: z.number().min(0).max(1).describe("Ex-ante structural quality score (0-1)."),
    confirmed_hits: z
      .number()
      .int()
      .nonnegative()
      .describe("Confirmed validation targets matched by this method."),
    yield_rate: z
      .number()
      .min(0)
      .max(1)
      .describe("Ex-post yield rate (confirmed_hits / candidate_count, or 0 when empty)."),
  })
  .describe("Per-method yield and quality metrics for a single backtest date.");
export type PerMethodYield = z.infer<typeof PerMethodYieldSchema>;

export const ExperimentRunResultSchema = z
  .strictObject({
    experiment: z
      .enum(BACKTEST_EXPERIMENTS)
      .describe("Experiment kind: retrospective_backtest or historical_replay."),
    engine_version: z
      .string()
      .nullable()
      .describe("Engine version executed, or null when historical engine is not reconstructible."),
    reconstructible: z
      .boolean()
      .describe("Whether the requested engine/state was reconstructible at this date."),
    note: z
      .string()
      .nullable()
      .describe("Diagnostic note when reconstruction is partial or unavailable."),
    dataset_counts: z
      .strictObject({
        events: z.number().int().nonnegative().describe("Visible events as of date."),
        entities: z.number().int().nonnegative().describe("Visible entities as of date."),
        relationships: z.number().int().nonnegative().describe("Visible relationships as of date."),
        hypotheses: z.number().int().nonnegative().describe("Visible hypotheses as of date."),
      })
      .describe("Zero-leakage record counts visible at the as-of date."),
    total_candidates: z
      .number()
      .int()
      .nonnegative()
      .describe("Total candidates generated across all non-disabled methods."),
    per_method: z
      .array(PerMethodYieldSchema)
      .describe("Per-method candidate counts, quality, and yield."),
  })
  .describe("Result of running a single experiment at a specific historical date.");
export type ExperimentRunResult = z.infer<typeof ExperimentRunResultSchema>;

export const DateBacktestResultSchema = z
  .strictObject({
    date: z.string().min(1).describe("Requested as-of date."),
    asof: z
      .strictObject({
        domain: z.enum(["public", "private"]).describe("PK-05 domain used for reconstruction."),
        mode: z.enum(BACKTEST_MODES).describe("PK-05 asof mode (canonical or acquired)."),
        comparison_end_iso: z
          .string()
          .min(1)
          .describe("Resolved UTC upper bound for zero-leakage filtering."),
        retrospective_partial: z
          .boolean()
          .describe("True when date precedes registry inception or lacks full snapshot."),
        active_snapshot_id: z
          .string()
          .nullable()
          .describe("Active snapshot ID as of date in canonical mode, or null."),
        registry_inception_at: z
          .string()
          .nullable()
          .describe("Earliest recorded timestamp in the snapshot/revision registry."),
      })
      .describe("PK-05 as-of resolution metadata."),
    experiments: z
      .array(ExperimentRunResultSchema)
      .describe("Results for each requested experiment at this date."),
  })
  .describe("Backtest and replay results for a single historical date.");
export type DateBacktestResult = z.infer<typeof DateBacktestResultSchema>;

export const BacktestReportSchema = z
  .strictObject({
    report_version: z.literal(1).describe("Backtest report schema version."),
    generated_at: z.string().min(1).describe("UTC timestamp when the report was generated."),
    mode: z.enum(BACKTEST_MODES).describe("PK-05 reconstruction mode used."),
    experiment_selection: z
      .enum(["retrospective_backtest", "historical_replay", "both"])
      .describe("Which experiment(s) were executed."),
    disclaimers: z
      .strictObject({
        llm_temporal_contamination: z
          .string()
          .min(1)
          .describe("Explicit disclaimer on LLM temporal contamination."),
        retrospective_partial: z
          .string()
          .min(1)
          .describe("Explicit disclaimer on retrospective-partial reconstruction."),
      })
      .describe("Mandatory epistemic disclaimers included in every backtest report."),
    dates: z.array(DateBacktestResultSchema).min(1).describe("Per-date backtest results."),
    summary: z
      .strictObject({
        dates_evaluated: z
          .number()
          .int()
          .positive()
          .describe("Number of historical dates evaluated."),
        total_candidates_by_method: z
          .record(z.string(), z.number().int().nonnegative())
          .describe("Sum of candidates per method across evaluated dates."),
        average_yield_by_method: z
          .record(z.string(), z.number().min(0).max(1))
          .describe("Mean ex-post yield per method across evaluated dates."),
      })
      .describe("Aggregate summary across all evaluated dates."),
  })
  .describe("Multi-date PK-14 backtest and historical replay report.");
export type BacktestReport = z.infer<typeof BacktestReportSchema>;

export type HistoricalEngineConfig = {
  engine_version: string;
  activations?: Partial<Record<string, GeneratorActivationState>>;
};

export type BacktestOptions = {
  dates: readonly string[];
  mode?: BacktestMode;
  experiment?: BacktestExperiment | "both";
  surface?: AccessSurface;
  snapshotsDir?: string;
  revisionsDir?: string;
  dataset?: Dataset;
  inferenceRegistry?: InferenceRegistry;
  validationSet?: readonly ValidationTarget[];
  proceduralRecords?: readonly ProceduralRecord[];
  attributionClaims?: readonly AttributionClaimRecord[];
  currentEngineVersion?: string;
  historicalEnginesByVersion?: Readonly<Record<string, HistoricalEngineConfig>>;
};

function buildDatasetFromRevisions(revisions: readonly RecordRevision[]): Dataset | null {
  if (revisions.length === 0) return null;
  const dataset: Dataset = {
    events: [],
    entities: [],
    relationships: [],
    hypotheses: [],
    sources: [],
    exposures: [],
  };
  for (const rev of revisions) {
    if (rev.collection === "events") {
      const parsed = Event.safeParse(rev.record);
      if (parsed.success) dataset.events.push(parsed.data);
    } else if (rev.collection === "entities") {
      const parsed = Entity.safeParse(rev.record);
      if (parsed.success) dataset.entities.push(parsed.data);
    } else if (rev.collection === "relationships") {
      const parsed = Relationship.safeParse(rev.record);
      if (parsed.success) dataset.relationships.push(parsed.data);
    } else if (rev.collection === "hypotheses") {
      const parsed = Hypothesis.safeParse(rev.record);
      if (parsed.success) dataset.hypotheses.push(parsed.data);
    } else if (rev.collection === "sources") {
      const parsed = Source.safeParse(rev.record);
      if (parsed.success) dataset.sources.push(parsed.data);
    } else if (rev.collection === "exposures") {
      const parsed = Exposure.safeParse(rev.record);
      if (parsed.success) dataset.exposures.push(parsed.data);
    }
  }
  return dataset;
}

/**
 * Zero-leakage temporal filter: removes any event, relationship, hypothesis,
 * or future alias whose date or `first_reported` falls strictly after `asOfDay`.
 */
export function filterDatasetAsOf(dataset: Dataset, comparisonEndIso: string): Dataset {
  const asOfDay = comparisonEndIso.slice(0, 10);

  const events = dataset.events.filter((ev) => {
    if (comparePartialDates(ev.date.start, asOfDay) > 0) return false;
    if (ev.first_reported && comparePartialDates(ev.first_reported, asOfDay) > 0) return false;
    return true;
  });
  const visibleEventIds = new Set(events.map((e) => e.id));

  const entities = dataset.entities.map((entity) => {
    if (!entity.aliases) return entity;
    const filteredAliases = entity.aliases.filter(
      (a) => !a.valid_from || comparePartialDates(a.valid_from, asOfDay) <= 0,
    );
    return { ...entity, aliases: filteredAliases };
  });

  const relationships = dataset.relationships.filter((rel) => {
    if (rel.valid_from && comparePartialDates(rel.valid_from, asOfDay) > 0) return false;
    if (rel.events.length > 0 && !rel.events.some((id) => visibleEventIds.has(id))) {
      return false;
    }
    return true;
  });

  const hypotheses = dataset.hypotheses.filter((hyp) => {
    if (hyp.events.length > 0 && !hyp.events.some((id) => visibleEventIds.has(id))) {
      return false;
    }
    return true;
  });

  return {
    events,
    entities,
    relationships,
    hypotheses,
    sources: dataset.sources,
    exposures: dataset.exposures,
  };
}

function summarizeAsOf(asof: AsofResult, mode: BacktestMode): DateBacktestResult["asof"] {
  if (asof.domain === "public") {
    return {
      domain: "public",
      mode,
      comparison_end_iso: asof.as_of.comparisonEndIso,
      retrospective_partial: asof.retrospective_partial,
      active_snapshot_id: asof.active_snapshot?.snapshot_id ?? null,
      registry_inception_at: asof.registry_inception_at,
    };
  }
  return {
    domain: "private",
    mode,
    comparison_end_iso: asof.as_of.comparisonEndIso,
    retrospective_partial: asof.retrospective_partial,
    active_snapshot_id: null,
    registry_inception_at: asof.registry_inception_at,
  };
}

/**
 * PK-14: Runs `retrospective_backtest` (current engine on historical data) and/or
 * `historical_replay` (engine version available at the time, where reconstructible)
 * across multiple dates using PK-05 `resolveAsOf`.
 */
export async function runBacktestReport(options: BacktestOptions): Promise<BacktestReport> {
  if (options.dates.length === 0) {
    throw new Error("At least one date is required for backtest.");
  }

  const mode: BacktestMode = options.mode ?? "canonical";
  const experimentSelection = options.experiment ?? "both";
  const surface: AccessSurface = options.surface ?? "cli";
  const currentEngineVersion = options.currentEngineVersion ?? "1.0.0";
  const baseDataset = options.dataset ?? validateDataFiles(readDataFiles()).dataset;
  const inferenceRegistry = options.inferenceRegistry ?? readInferenceRegistry();
  const validationSet = options.validationSet ?? [];

  const experimentsToRun: BacktestExperiment[] =
    experimentSelection === "both"
      ? ["retrospective_backtest", "historical_replay"]
      : [experimentSelection];

  const dateResults: DateBacktestResult[] = [];
  const totalCandidatesByMethod: Record<string, number> = {};
  const yieldSamplesByMethod: Record<string, number[]> = {};

  for (const date of options.dates) {
    const asof = resolveAsOf({
      date,
      mode,
      surface,
      ...(options.snapshotsDir !== undefined ? { snapshotsDir: options.snapshotsDir } : {}),
      ...(options.revisionsDir !== undefined ? { revisionsDir: options.revisionsDir } : {}),
    });

    const asOfDay = asof.as_of.comparisonEndIso.slice(0, 10);
    const revisionDataset =
      asof.domain === "private" ? buildDatasetFromRevisions(asof.revisions) : null;
    const rawDataset = revisionDataset ?? baseDataset;
    const filteredDataset = filterDatasetAsOf(rawDataset, asof.as_of.comparisonEndIso);

    const filteredProcedural = (options.proceduralRecords ?? []).filter(
      (p) => comparePartialDates(p.date, asOfDay) <= 0,
    );
    const filteredClaims = (options.attributionClaims ?? []).filter(
      (c) => !c.date || comparePartialDates(c.date, asOfDay) <= 0,
    );

    const experimentResults: ExperimentRunResult[] = [];

    for (const exp of experimentsToRun) {
      if (exp === "historical_replay") {
        const historicalEngineVersion =
          asof.domain === "public" ? (asof.active_snapshot?.versions.engine ?? null) : null;
        if (!historicalEngineVersion) {
          experimentResults.push({
            experiment: "historical_replay",
            engine_version: null,
            reconstructible: false,
            note: "No contemporaneous snapshot engine version is reconstructible at this date.",
            dataset_counts: {
              events: filteredDataset.events.length,
              entities: filteredDataset.entities.length,
              relationships: filteredDataset.relationships.length,
              hypotheses: filteredDataset.hypotheses.length,
            },
            total_candidates: 0,
            per_method: [],
          });
          continue;
        }

        const histConfig = options.historicalEnginesByVersion?.[historicalEngineVersion];
        const run = await runGeneratorRegistry(
          {
            snapshot_id:
              asof.domain === "public"
                ? (asof.active_snapshot?.snapshot_id ?? `asof-${asOfDay}`)
                : `acquired-${asOfDay}`,
            dataset_hash:
              asof.domain === "public"
                ? (asof.active_snapshot?.dataset_hash ?? "0".repeat(64))
                : "0".repeat(64),
            engine_version: historicalEngineVersion,
            generated_at: asof.as_of.comparisonEndIso,
            run_id: `replay-${asOfDay}-${historicalEngineVersion}`,
          },
          {
            dataset: filteredDataset,
            inferenceRegistry,
            validationSet,
            proceduralRecords: filteredProcedural,
            attributionClaims: filteredClaims,
            ...(histConfig?.activations ? { activations: histConfig.activations } : {}),
          },
        );

        const perMethod: PerMethodYield[] = run.metrics.map((m) => ({
          method: m.id,
          activation: m.activation,
          candidate_count: m.candidate_count,
          ex_ante_quality: m.ex_ante.quality_score,
          confirmed_hits: m.ex_post.confirmed_hits,
          yield_rate: m.ex_post.yield_rate,
        }));

        experimentResults.push({
          experiment: "historical_replay",
          engine_version: historicalEngineVersion,
          reconstructible: true,
          note: null,
          dataset_counts: {
            events: filteredDataset.events.length,
            entities: filteredDataset.entities.length,
            relationships: filteredDataset.relationships.length,
            hypotheses: filteredDataset.hypotheses.length,
          },
          total_candidates: perMethod.reduce((sum, p) => sum + p.candidate_count, 0),
          per_method: perMethod,
        });
        continue;
      }

      // retrospective_backtest: current engine on historical data
      const run = await runGeneratorRegistry(
        {
          snapshot_id:
            asof.domain === "public"
              ? (asof.active_snapshot?.snapshot_id ?? `retrospective-${asOfDay}`)
              : `acquired-${asOfDay}`,
          dataset_hash:
            asof.domain === "public"
              ? (asof.active_snapshot?.dataset_hash ?? "0".repeat(64))
              : "0".repeat(64),
          engine_version: currentEngineVersion,
          generated_at: asof.as_of.comparisonEndIso,
          run_id: `retrospective-${asOfDay}`,
        },
        {
          dataset: filteredDataset,
          inferenceRegistry,
          validationSet,
          proceduralRecords: filteredProcedural,
          attributionClaims: filteredClaims,
        },
      );

      const perMethod: PerMethodYield[] = run.metrics.map((m) => {
        totalCandidatesByMethod[m.id] = (totalCandidatesByMethod[m.id] ?? 0) + m.candidate_count;
        const list = yieldSamplesByMethod[m.id] ?? [];
        list.push(m.ex_post.yield_rate);
        yieldSamplesByMethod[m.id] = list;
        return {
          method: m.id,
          activation: m.activation,
          candidate_count: m.candidate_count,
          ex_ante_quality: m.ex_ante.quality_score,
          confirmed_hits: m.ex_post.confirmed_hits,
          yield_rate: m.ex_post.yield_rate,
        };
      });

      experimentResults.push({
        experiment: "retrospective_backtest",
        engine_version: currentEngineVersion,
        reconstructible: true,
        note: asof.retrospective_partial
          ? "Pre-inception or partial snapshot: reconstructed from later canonical records."
          : null,
        dataset_counts: {
          events: filteredDataset.events.length,
          entities: filteredDataset.entities.length,
          relationships: filteredDataset.relationships.length,
          hypotheses: filteredDataset.hypotheses.length,
        },
        total_candidates: perMethod.reduce((sum, p) => sum + p.candidate_count, 0),
        per_method: perMethod,
      });
    }

    dateResults.push({
      date,
      asof: summarizeAsOf(asof, mode),
      experiments: experimentResults,
    });
  }

  const averageYieldByMethod: Record<string, number> = {};
  for (const [method, samples] of Object.entries(yieldSamplesByMethod)) {
    const sum = samples.reduce((a, b) => a + b, 0);
    averageYieldByMethod[method] = samples.length > 0 ? sum / samples.length : 0;
  }

  const report: BacktestReport = {
    report_version: 1,
    generated_at: new Date().toISOString(),
    mode,
    experiment_selection: experimentSelection,
    disclaimers: {
      llm_temporal_contamination: LLM_TEMPORAL_CONTAMINATION_DISCLAIMER,
      retrospective_partial: RETROSPECTIVE_PARTIAL_DISCLAIMER,
    },
    dates: dateResults,
    summary: {
      dates_evaluated: dateResults.length,
      total_candidates_by_method: totalCandidatesByMethod,
      average_yield_by_method: averageYieldByMethod,
    },
  };

  return BacktestReportSchema.parse(report);
}
