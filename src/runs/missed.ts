import { z } from "zod";
import { ENGINE_VERSION } from "../engine/version.ts";
import { UtcTimestamp } from "../temporal/snapshots.ts";
import { type RunManifest, RunManifestSchema, RunWindowSchema } from "./schema.ts";

export const ScheduledSlotSchema = z
  .strictObject({
    slot_id: z.string().min(1).describe("Unique identifier for the scheduled execution slot."),
    task: z.string().min(1).describe("Task name expected to run in this slot."),
    role: z.string().min(1).describe("Operational role expected to run in this slot."),
    provider: z
      .string()
      .min(1)
      .default("scheduled")
      .describe("Expected execution provider for the slot."),
    model: z.string().min(1).default("none").describe("Expected model identifier for the slot."),
    scheduled_at: UtcTimestamp.describe("UTC timestamp when the slot was scheduled to fire."),
    grace_minutes: z
      .number()
      .int()
      .nonnegative()
      .optional()
      .describe("Grace period in minutes before an unrecorded slot is marked missed."),
    window: RunWindowSchema.nullable()
      .optional()
      .describe("Optional time window assigned to the scheduled slot."),
  })
  .describe("Expected scheduled run slot used by the independent missed-run detector.");
export type ScheduledSlot = z.infer<typeof ScheduledSlotSchema>;

export type MissedRunDetectionOptions = {
  now?: string;
  defaultGraceMinutes?: number;
  engineVersion?: string;
};

export type MissedRunDetectionResult = {
  checked_at: string;
  missed: RunManifest[];
  matched_slot_ids: string[];
  pending_slot_ids: string[];
};

function slotMatchesManifest(slot: ScheduledSlot, manifest: RunManifest): boolean {
  if (manifest.slot_id && manifest.slot_id === slot.slot_id) return true;
  if (manifest.task === slot.task && manifest.scheduled_at === slot.scheduled_at) return true;
  return false;
}

/**
 * Independent missed-run detector (PK-08).
 * Compares expected scheduled slots against recorded run manifests and emits
 * `status: "missed"` manifests for any slot whose grace window has elapsed
 * without a recorded execution.
 */
export function detectMissedRuns(
  slots: readonly ScheduledSlot[],
  manifests: readonly RunManifest[],
  options?: MissedRunDetectionOptions,
): MissedRunDetectionResult {
  const nowIso = options?.now ?? new Date().toISOString();
  const nowMs = Date.parse(nowIso);
  if (Number.isNaN(nowMs)) {
    throw new Error(`Invalid now timestamp: ${nowIso}`);
  }
  const defaultGraceMinutes = options?.defaultGraceMinutes ?? 30;
  const engineVersion = options?.engineVersion ?? ENGINE_VERSION;

  const missed: RunManifest[] = [];
  const matched_slot_ids: string[] = [];
  const pending_slot_ids: string[] = [];

  for (const slot of slots) {
    const matched = manifests.some((manifest) => slotMatchesManifest(slot, manifest));
    if (matched) {
      matched_slot_ids.push(slot.slot_id);
      continue;
    }

    const scheduledMs = Date.parse(slot.scheduled_at);
    const graceMs = (slot.grace_minutes ?? defaultGraceMinutes) * 60_000;
    if (scheduledMs + graceMs > nowMs) {
      pending_slot_ids.push(slot.slot_id);
      continue;
    }

    const missedManifest = RunManifestSchema.parse({
      run_id: `missed-${slot.slot_id}`,
      slot_id: slot.slot_id,
      task: slot.task,
      role: slot.role,
      provider: slot.provider,
      model: slot.model,
      scheduled_at: slot.scheduled_at,
      started_at: null,
      finished_at: null,
      engine_version: engineVersion,
      window: slot.window ?? null,
      queries: [],
      sources_consulted: [],
      errors: [
        {
          code: "MISSED_RUN",
          message: `Scheduled slot ${slot.slot_id} (${slot.task}) did not record a manifest within ${slot.grace_minutes ?? defaultGraceMinutes}m grace window.`,
          sensitive: false,
          stage: "scheduler_reconciliation",
        },
      ],
      status: "missed",
    });

    missed.push(missedManifest);
  }

  return {
    checked_at: nowIso,
    missed,
    matched_slot_ids,
    pending_slot_ids,
  };
}
