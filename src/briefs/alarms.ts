import { z } from "zod";
import { UtcTimestamp } from "../temporal/snapshots.ts";

export const ALARM_OUTCOMES = [
  "open",
  "confirmed_true",
  "false_alarm",
  "inconclusive",
  "expired",
] as const;
export type AlarmOutcome = (typeof ALARM_OUTCOMES)[number];

export const ALARM_SEVERITIES = ["low", "medium", "high", "critical"] as const;
export type AlarmSeverity = (typeof ALARM_SEVERITIES)[number];

export const PreRegisteredForecastSchema = z
  .strictObject({
    probability: z
      .number()
      .min(0)
      .max(1)
      .describe(
        "Optional pre-registered probability in [0, 1]; zero incentive to emit percentages.",
      ),
    verifiable_event: z
      .string()
      .min(1)
      .describe("Specific observable event that determines resolution."),
    horizon_end: UtcTimestamp.describe("UTC deadline by which the event must occur."),
    resolution_rule: z
      .string()
      .min(1)
      .describe("Unambiguous rule mapping observable evidence to confirmed_true vs false_alarm."),
    registered_at: UtcTimestamp.describe(
      "UTC timestamp when the forecast was registered (must precede outcome resolution).",
    ),
  })
  .describe("Optional pre-registered forecast eligible for Brier scoring.");
export type PreRegisteredForecast = z.infer<typeof PreRegisteredForecastSchema>;

export const AlarmRecordSchema = z
  .strictObject({
    alarm_id: z.string().min(1).describe("Unique alarm identifier."),
    title: z.string().min(1).describe("Short descriptive title of the alarm."),
    created_at: UtcTimestamp.describe("UTC timestamp when the alarm was raised."),
    country: z.string().min(1).describe("Primary target country or jurisdiction."),
    actor: z.string().min(1).describe("Primary threat actor or entity."),
    theme: z.string().min(1).describe("Thematic domain (e.g., disinformation, cyber, energy)."),
    severity: z.enum(ALARM_SEVERITIES).describe("Operational severity of the alarm."),
    outcome: z
      .enum(ALARM_OUTCOMES)
      .default("open")
      .describe("Current resolution state of the alarm."),
    resolved_at: UtcTimestamp.nullable()
      .optional()
      .describe("UTC timestamp when the alarm was resolved, or null while open."),
    resolution_note: z
      .string()
      .min(1)
      .optional()
      .describe("Explanation of why the alarm was confirmed, falsified, or closed."),
    what_triggered_it: z
      .string()
      .min(1)
      .optional()
      .describe("Initial signal or indicator that triggered the alarm."),
    lesson_learned: z
      .string()
      .min(1)
      .optional()
      .describe("Negative-reference lesson recorded if this alarm proved false."),
    case_refs: z
      .array(z.string().min(1))
      .default([])
      .describe("Related entity, event, or case identifiers."),
    run_id: z
      .string()
      .min(1)
      .optional()
      .describe("PK-08 run_id that emitted or updated this alarm."),
    forecast: PreRegisteredForecastSchema.optional().describe(
      "Optional pre-registered forecast; omitted by default with zero penalty.",
    ),
  })
  .describe(
    "Alarm register entry tracking outcome/open state and optional pre-registered Brier forecast.",
  );
export type AlarmRecord = z.infer<typeof AlarmRecordSchema>;

export const FalseAlarmNegativeExampleSchema = z
  .strictObject({
    alarm_id: z.string().min(1).describe("Identifier of the false alarm."),
    title: z.string().min(1).describe("Title of the false alarm."),
    country: z.string().min(1).describe("Country in scope."),
    actor: z.string().min(1).describe("Actor in scope."),
    theme: z.string().min(1).describe("Theme in scope."),
    what_triggered_it: z.string().min(1).describe("Signal that caused the false positive."),
    why_it_was_false: z.string().min(1).describe("Evidence or reasoning that falsified the alarm."),
    lesson_learned: z.string().min(1).describe("Guardrail for future triage and discovery."),
    resolved_at: UtcTimestamp.nullable().describe("UTC timestamp when marked false_alarm."),
  })
  .describe("False-alarm record formatted as a negative reference example.");
export type FalseAlarmNegativeExample = z.infer<typeof FalseAlarmNegativeExampleSchema>;

/**
 * Compute Brier score (p - y)^2 ONLY for alarms with a pre-registered forecast
 * registered strictly before or at resolution, and with binary outcome
 * (confirmed_true -> 1, false_alarm -> 0). Returns null otherwise.
 */
export function computeBrierScore(alarm: AlarmRecord): number | null {
  const parsed = AlarmRecordSchema.parse(alarm);
  if (!parsed.forecast) return null;
  if (parsed.outcome !== "confirmed_true" && parsed.outcome !== "false_alarm") {
    return null;
  }
  if (!parsed.resolved_at) return null;

  const registeredMs = Date.parse(parsed.forecast.registered_at);
  const resolvedMs = Date.parse(parsed.resolved_at);
  if (Number.isNaN(registeredMs) || Number.isNaN(resolvedMs) || registeredMs > resolvedMs) {
    return null;
  }

  const y = parsed.outcome === "confirmed_true" ? 1 : 0;
  const diff = parsed.forecast.probability - y;
  return Number((diff * diff).toFixed(6));
}

/**
 * Extract resolved false alarms as negative reference examples so future
 * discovery and triage avoid repeating false-positive patterns.
 */
export function extractFalseAlarmExamples(
  alarms: readonly AlarmRecord[],
): FalseAlarmNegativeExample[] {
  const examples: FalseAlarmNegativeExample[] = [];
  for (const raw of alarms) {
    const alarm = AlarmRecordSchema.parse(raw);
    if (alarm.outcome !== "false_alarm") continue;
    examples.push(
      FalseAlarmNegativeExampleSchema.parse({
        alarm_id: alarm.alarm_id,
        title: alarm.title,
        country: alarm.country,
        actor: alarm.actor,
        theme: alarm.theme,
        what_triggered_it: alarm.what_triggered_it ?? "Unspecified initial signal",
        why_it_was_false: alarm.resolution_note ?? "Falsified during verification",
        lesson_learned:
          alarm.lesson_learned ??
          "Require independent corroboration before escalating similar signals.",
        resolved_at: alarm.resolved_at ?? null,
      }),
    );
  }
  return examples;
}

export function summarizeAlarms(alarms: readonly AlarmRecord[]): {
  total: number;
  by_outcome: Record<AlarmOutcome, number>;
  scored_forecasts: number;
  mean_brier_score: number | null;
  false_alarm_examples: FalseAlarmNegativeExample[];
} {
  const byOutcome: Record<AlarmOutcome, number> = {
    open: 0,
    confirmed_true: 0,
    false_alarm: 0,
    inconclusive: 0,
    expired: 0,
  };
  let brierSum = 0;
  let scoredCount = 0;

  for (const raw of alarms) {
    const alarm = AlarmRecordSchema.parse(raw);
    byOutcome[alarm.outcome] += 1;
    const brier = computeBrierScore(alarm);
    if (brier !== null) {
      brierSum += brier;
      scoredCount += 1;
    }
  }

  return {
    total: alarms.length,
    by_outcome: byOutcome,
    scored_forecasts: scoredCount,
    mean_brier_score: scoredCount > 0 ? Number((brierSum / scoredCount).toFixed(6)) : null,
    false_alarm_examples: extractFalseAlarmExamples(alarms),
  };
}
