import { z } from "zod";
import { type RunManifest, RunManifestSchema, type RunStatus } from "../runs/schema.ts";
import { UtcTimestamp } from "../temporal/snapshots.ts";
import {
  type AlarmRecord,
  AlarmRecordSchema,
  FalseAlarmNegativeExampleSchema,
  summarizeAlarms,
} from "./alarms.ts";
import {
  type Countermeasure,
  CountermeasureSchema,
  summarizeCountermeasuresByStage,
} from "./countermeasures.ts";

export * from "./alarms.ts";
export * from "./countermeasures.ts";

export const BriefFilterSchema = z
  .strictObject({
    country: z.string().min(1).optional().describe("Optional country filter (case-insensitive)."),
    actor: z.string().min(1).optional().describe("Optional actor filter (case-insensitive)."),
    theme: z.string().min(1).optional().describe("Optional theme filter (case-insensitive)."),
  })
  .describe("Filter criteria for weekly briefs and daily alerts.");
export type BriefFilter = z.infer<typeof BriefFilterSchema>;

export const BriefEvidenceItemSchema = z
  .strictObject({
    item_id: z.string().min(1).describe("Case, event, or article identifier."),
    title: z.string().min(1).describe("Headline or short summary."),
    country: z.string().min(1).describe("Primary country or jurisdiction."),
    actor: z.string().min(1).describe("Primary actor."),
    theme: z.string().min(1).describe("Thematic category."),
    severity: z.enum(["low", "medium", "high", "critical"]).describe("Assessed severity."),
    observed_at: UtcTimestamp.describe("UTC timestamp of observation."),
    conclusion: z.string().min(1).describe("Conclusion-first takeaway for this item."),
    source_refs: z.array(z.string().min(1)).describe("Supporting source references."),
    run_id: z
      .string()
      .min(1)
      .optional()
      .describe("PK-08 run_id that produced or verified this item."),
  })
  .describe("Structured intelligence item included in a brief or alert.");
export type BriefEvidenceItem = z.infer<typeof BriefEvidenceItemSchema>;

export const RunReconciliationSummarySchema = z
  .strictObject({
    total_runs: z.number().int().nonnegative().describe("Total PK-08 manifests reconciled."),
    by_status: z
      .record(z.string(), z.number().int().nonnegative())
      .describe("Count of runs grouped by PK-08 RunStatus."),
    run_ids: z.array(z.string().min(1)).describe("Reconciled PK-08 run identifiers."),
    missed_run_ids: z.array(z.string().min(1)).describe("Run IDs with status missed."),
    zero_result_run_ids: z
      .array(z.string().min(1))
      .describe("Run IDs with status completed_no_results."),
    unreconciled_item_run_ids: z
      .array(z.string().min(1))
      .describe("Item run_ids not found in the provided PK-08 manifests."),
  })
  .describe("PK-08 run manifest reconciliation summary attached to every brief.");
export type RunReconciliationSummary = z.infer<typeof RunReconciliationSummarySchema>;

export const IntelligenceBriefSchema = z
  .strictObject({
    brief_id: z.string().min(1).describe("Unique brief identifier."),
    kind: z.enum(["weekly_brief", "daily_alert"]).describe("Brief cadence kind."),
    title: z.string().min(1).describe("Brief title."),
    generated_at: UtcTimestamp.describe("UTC timestamp when the brief was generated."),
    window_from: UtcTimestamp.describe("UTC start of covered observation window."),
    window_to: UtcTimestamp.describe("UTC end of covered observation window."),
    filter: BriefFilterSchema.describe("Applied country/actor/theme filters."),
    executive_conclusion: z
      .string()
      .min(1)
      .describe("Conclusion-first synthesis placed at the top of the brief."),
    key_findings: z
      .array(BriefEvidenceItemSchema)
      .describe("Filtered, prioritized evidence items."),
    alarms_summary: z
      .strictObject({
        total: z.number().int().nonnegative().describe("Filtered alarm count."),
        open_count: z.number().int().nonnegative().describe("Currently open alarms."),
        confirmed_true_count: z.number().int().nonnegative().describe("Confirmed true alarms."),
        false_alarm_count: z.number().int().nonnegative().describe("Resolved false alarms."),
        mean_brier_score: z
          .number()
          .nullable()
          .describe("Mean Brier score across pre-registered resolved forecasts, or null."),
        false_alarm_negative_examples: z
          .array(FalseAlarmNegativeExampleSchema)
          .describe("False-alarm negative reference examples."),
      })
      .describe("Alarm register summary for the brief."),
    countermeasures_summary: z
      .strictObject({
        total: z.number().int().nonnegative().describe("Filtered countermeasure count."),
        by_stage: z
          .record(z.string(), z.number().int().nonnegative())
          .describe(
            "Counts across adoption, entry_into_force, implementation, observed_effectiveness.",
          ),
        items: z.array(CountermeasureSchema).describe("Filtered countermeasures."),
      })
      .describe("Case-linked countermeasures summary."),
    run_reconciliation: RunReconciliationSummarySchema.describe(
      "Reconciliation against PK-08 run manifests.",
    ),
  })
  .describe("Conclusion-first weekly brief or daily alert reconciled with PK-08 manifests.");
export type IntelligenceBrief = z.infer<typeof IntelligenceBriefSchema>;

function matchesFilter(
  record: { country: string; actor: string; theme: string },
  filter: BriefFilter,
): boolean {
  if (filter.country && record.country.toLowerCase() !== filter.country.toLowerCase()) {
    return false;
  }
  if (filter.actor && record.actor.toLowerCase() !== filter.actor.toLowerCase()) {
    return false;
  }
  if (filter.theme && record.theme.toLowerCase() !== filter.theme.toLowerCase()) {
    return false;
  }
  return true;
}

export function reconcileManifestsForBrief(
  manifests: readonly RunManifest[],
  referencedRunIds: readonly string[] = [],
): RunReconciliationSummary {
  const parsedManifests = manifests.map((m) => RunManifestSchema.parse(m));
  const byStatus: Record<RunStatus, number> = {
    completed_with_results: 0,
    completed_no_results: 0,
    partial: 0,
    failed: 0,
    cancelled: 0,
    missed: 0,
  };
  const knownIds = new Set<string>();
  const missedIds: string[] = [];
  const zeroResultIds: string[] = [];

  for (const manifest of parsedManifests) {
    byStatus[manifest.status] += 1;
    knownIds.add(manifest.run_id);
    if (manifest.status === "missed") {
      missedIds.push(manifest.run_id);
    }
    if (manifest.status === "completed_no_results") {
      zeroResultIds.push(manifest.run_id);
    }
  }

  const unreconciled = [...new Set(referencedRunIds)].filter((id) => !knownIds.has(id));

  return RunReconciliationSummarySchema.parse({
    total_runs: parsedManifests.length,
    by_status: byStatus,
    run_ids: [...knownIds],
    missed_run_ids: missedIds,
    zero_result_run_ids: zeroResultIds,
    unreconciled_item_run_ids: unreconciled,
  });
}

function buildExecutiveConclusion(input: {
  kind: "weekly_brief" | "daily_alert";
  items: readonly BriefEvidenceItem[];
  openAlarms: number;
  falseAlarms: number;
  countermeasuresCount: number;
  reconciliation: RunReconciliationSummary;
  filter: BriefFilter;
}): string {
  const scopeParts: string[] = [];
  if (input.filter.country) scopeParts.push(`country=${input.filter.country}`);
  if (input.filter.actor) scopeParts.push(`actor=${input.filter.actor}`);
  if (input.filter.theme) scopeParts.push(`theme=${input.filter.theme}`);
  const scope = scopeParts.length > 0 ? ` [${scopeParts.join(", ")}]` : "";
  const label = input.kind === "weekly_brief" ? "Weekly Brief" : "Daily Alert";

  if (input.items.length === 0) {
    return `${label}${scope}: No new qualifying findings in window. ${input.openAlarms} open alarm(s), ${input.falseAlarms} false alarm(s), ${input.countermeasuresCount} tracked countermeasure(s), reconciled across ${input.reconciliation.total_runs} PK-08 run(s) (${input.reconciliation.missed_run_ids.length} missed).`;
  }

  const topItem = input.items[0];
  return `${label}${scope}: ${input.items.length} finding(s) led by "${topItem?.title ?? "unknown"}" (${topItem?.severity ?? "medium"}). ${input.openAlarms} open alarm(s), ${input.countermeasuresCount} countermeasure(s), reconciled across ${input.reconciliation.total_runs} PK-08 run(s) (${input.reconciliation.missed_run_ids.length} missed).`;
}

function generateBriefInternal(
  kind: "weekly_brief" | "daily_alert",
  input: {
    brief_id?: string;
    title?: string;
    generated_at?: string;
    window_from: string;
    window_to: string;
    items: readonly BriefEvidenceItem[];
    alarms: readonly AlarmRecord[];
    countermeasures: readonly Countermeasure[];
    manifests: readonly RunManifest[];
    filter?: BriefFilter;
  },
): IntelligenceBrief {
  const filter = BriefFilterSchema.parse(input.filter ?? {});
  const items = input.items
    .map((i) => BriefEvidenceItemSchema.parse(i))
    .filter((i) => matchesFilter(i, filter));
  const alarms = input.alarms
    .map((a) => AlarmRecordSchema.parse(a))
    .filter((a) => matchesFilter(a, filter));
  const countermeasures = input.countermeasures
    .map((c) => CountermeasureSchema.parse(c))
    .filter((c) => matchesFilter(c, filter));

  const referencedRunIds = [
    ...items.flatMap((i) => (i.run_id ? [i.run_id] : [])),
    ...alarms.flatMap((a) => (a.run_id ? [a.run_id] : [])),
  ];
  const reconciliation = reconcileManifestsForBrief(input.manifests, referencedRunIds);
  const alarmSummary = summarizeAlarms(alarms);
  const cmByStage = summarizeCountermeasuresByStage(countermeasures);
  const generatedAt = input.generated_at ?? new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

  const executiveConclusion = buildExecutiveConclusion({
    kind,
    items,
    openAlarms: alarmSummary.by_outcome.open,
    falseAlarms: alarmSummary.by_outcome.false_alarm,
    countermeasuresCount: countermeasures.length,
    reconciliation,
    filter,
  });

  return IntelligenceBriefSchema.parse({
    brief_id: input.brief_id ?? `${kind}-${input.window_to.slice(0, 10)}`,
    kind,
    title:
      input.title ??
      (kind === "weekly_brief"
        ? `OEM Weekly Intelligence Brief (${input.window_from.slice(0, 10)} to ${input.window_to.slice(0, 10)})`
        : `OEM Daily Alert (${input.window_to.slice(0, 10)})`),
    generated_at: generatedAt,
    window_from: input.window_from,
    window_to: input.window_to,
    filter,
    executive_conclusion: executiveConclusion,
    key_findings: items,
    alarms_summary: {
      total: alarmSummary.total,
      open_count: alarmSummary.by_outcome.open,
      confirmed_true_count: alarmSummary.by_outcome.confirmed_true,
      false_alarm_count: alarmSummary.by_outcome.false_alarm,
      mean_brier_score: alarmSummary.mean_brier_score,
      false_alarm_negative_examples: alarmSummary.false_alarm_examples,
    },
    countermeasures_summary: {
      total: countermeasures.length,
      by_stage: cmByStage,
      items: countermeasures,
    },
    run_reconciliation: reconciliation,
  });
}

export function generateWeeklyBrief(input: {
  brief_id?: string;
  title?: string;
  generated_at?: string;
  window_from: string;
  window_to: string;
  items: readonly BriefEvidenceItem[];
  alarms: readonly AlarmRecord[];
  countermeasures: readonly Countermeasure[];
  manifests: readonly RunManifest[];
  filter?: BriefFilter;
}): IntelligenceBrief {
  return generateBriefInternal("weekly_brief", input);
}

export function generateDailyAlert(input: {
  brief_id?: string;
  title?: string;
  generated_at?: string;
  window_from: string;
  window_to: string;
  items: readonly BriefEvidenceItem[];
  alarms: readonly AlarmRecord[];
  countermeasures: readonly Countermeasure[];
  manifests: readonly RunManifest[];
  filter?: BriefFilter;
}): IntelligenceBrief {
  return generateBriefInternal("daily_alert", input);
}

export function formatBriefMarkdown(brief: IntelligenceBrief): string {
  const lines: string[] = [
    `# ${brief.title}`,
    "",
    `**Conclusion:** ${brief.executive_conclusion}`,
    "",
    `- **Window:** ${brief.window_from} -> ${brief.window_to}`,
    `- **PK-08 Runs Reconciled:** ${brief.run_reconciliation.total_runs} (missed: ${brief.run_reconciliation.missed_run_ids.length}, zero-results: ${brief.run_reconciliation.zero_result_run_ids.length})`,
    `- **Alarms:** ${brief.alarms_summary.total} total (${brief.alarms_summary.open_count} open, ${brief.alarms_summary.false_alarm_count} false alarms)`,
    `- **Countermeasures:** ${brief.countermeasures_summary.total} total`,
    "",
    "## Key Findings",
    ...(brief.key_findings.length === 0
      ? ["- None in filtered scope."]
      : brief.key_findings.map(
          (f) =>
            `- [${f.severity}] **${f.title}** (${f.country} / ${f.actor} / ${f.theme}): ${f.conclusion}`,
        )),
  ];
  return lines.join("\n");
}
