import { z } from "zod";
import { UtcTimestamp } from "../temporal/snapshots.ts";

export const COUNTERMEASURE_STAGES = [
  "adoption",
  "entry_into_force",
  "implementation",
  "observed_effectiveness",
] as const;
export type CountermeasureStage = (typeof COUNTERMEASURE_STAGES)[number];

export const CountermeasureStageEventSchema = z
  .strictObject({
    stage: z.enum(COUNTERMEASURE_STAGES).describe("Countermeasure lifecycle stage."),
    recorded_at: UtcTimestamp.describe("UTC timestamp when this stage was reached."),
    evidence_refs: z
      .array(z.string().min(1))
      .describe("Supporting official or observational source references."),
    note: z.string().min(1).describe("Concise factual note describing this stage."),
  })
  .describe("Recorded transition to one of the four countermeasure stages.");
export type CountermeasureStageEvent = z.infer<typeof CountermeasureStageEventSchema>;

export const CountermeasureSchema = z
  .strictObject({
    countermeasure_id: z.string().min(1).describe("Unique countermeasure identifier."),
    case_id: z.string().min(1).describe("Linked case, event, or entity identifier."),
    title: z.string().min(1).describe("Short title of the countermeasure."),
    actor: z.string().min(1).describe("Target threat actor or mitigated vector."),
    country: z.string().min(1).describe("Implementing country or EU/regional institution."),
    theme: z.string().min(1).describe("Policy or threat theme (e.g., sanctions, cyber, media)."),
    stage: z.enum(COUNTERMEASURE_STAGES).describe("Current declared stage of the countermeasure."),
    declared_at: UtcTimestamp.describe(
      "UTC timestamp when the countermeasure was first adopted/declared.",
    ),
    stage_history: z
      .array(CountermeasureStageEventSchema)
      .min(1)
      .describe("Chronological progression across the four countermeasure stages."),
    effectiveness_note: z
      .string()
      .min(1)
      .optional()
      .describe("Observed impact note, required once observed_effectiveness is reached."),
  })
  .describe("Case-linked countermeasure tracked across four distinct lifecycle stages.");
export type Countermeasure = z.infer<typeof CountermeasureSchema>;

export function advanceCountermeasureStage(
  countermeasure: Countermeasure,
  event: CountermeasureStageEvent,
): Countermeasure {
  const parsed = CountermeasureSchema.parse(countermeasure);
  const parsedEvent = CountermeasureStageEventSchema.parse(event);
  const currentIdx = COUNTERMEASURE_STAGES.indexOf(parsed.stage);
  const nextIdx = COUNTERMEASURE_STAGES.indexOf(parsedEvent.stage);
  if (nextIdx < currentIdx) {
    throw new Error(
      `Cannot regress countermeasure "${parsed.countermeasure_id}" from ${parsed.stage} to ${parsedEvent.stage}.`,
    );
  }
  return CountermeasureSchema.parse({
    ...parsed,
    stage: parsedEvent.stage,
    stage_history: [...parsed.stage_history, parsedEvent],
    ...(parsedEvent.stage === "observed_effectiveness"
      ? { effectiveness_note: parsedEvent.note }
      : {}),
  });
}

export function summarizeCountermeasuresByStage(
  countermeasures: readonly Countermeasure[],
): Record<CountermeasureStage, number> {
  const counts: Record<CountermeasureStage, number> = {
    adoption: 0,
    entry_into_force: 0,
    implementation: 0,
    observed_effectiveness: 0,
  };
  for (const raw of countermeasures) {
    const cm = CountermeasureSchema.parse(raw);
    counts[cm.stage] += 1;
  }
  return counts;
}
