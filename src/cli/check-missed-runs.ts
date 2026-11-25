import { existsSync, readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import {
  detectMissedRuns,
  type RunManifest,
  RunManifestSchema,
  type ScheduledSlot,
  ScheduledSlotSchema,
} from "../runs/index.ts";

function usage(): string {
  return [
    "Usage: node src/cli/check-missed-runs.ts [options]",
    "",
    "Options:",
    "  --slots <path>           JSON file containing an array of ScheduledSlot objects",
    "  --manifests <path>       JSON file containing an array of RunManifest objects",
    "  --now <utc>              Reference UTC ISO-8601 timestamp (defaults to now)",
    "  --grace-minutes <n>      Default grace window in minutes (default: 30)",
    "  --dry-run                Evaluate and print JSON summary without writing files",
    "  -h, --help               Show this help message",
  ].join("\n");
}

function readJsonArray<T>(filePath: string | undefined, parseItem: (raw: unknown) => T): T[] {
  if (!filePath || !existsSync(filePath)) return [];
  const parsed = JSON.parse(readFileSync(filePath, "utf8")) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error(`Expected JSON array in ${filePath}`);
  }
  return parsed.map(parseItem);
}

function run(): void {
  const { values } = parseArgs({
    options: {
      slots: { type: "string" },
      manifests: { type: "string" },
      now: { type: "string" },
      "grace-minutes": { type: "string", default: "30" },
      "dry-run": { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
  });

  if (values.help) {
    console.log(usage());
    return;
  }

  const slots: ScheduledSlot[] = readJsonArray(values.slots, (raw) =>
    ScheduledSlotSchema.parse(raw),
  );
  const manifests: RunManifest[] = readJsonArray(values.manifests, (raw) =>
    RunManifestSchema.parse(raw),
  );
  const graceMinutes = Number.parseInt(values["grace-minutes"], 10);
  if (Number.isNaN(graceMinutes) || graceMinutes < 0) {
    throw new Error(`Invalid --grace-minutes value: ${values["grace-minutes"]}`);
  }

  const result = detectMissedRuns(slots, manifests, {
    ...(values.now !== undefined ? { now: values.now } : {}),
    defaultGraceMinutes: graceMinutes,
  });

  console.log(
    JSON.stringify(
      {
        dry_run: values["dry-run"],
        checked_at: result.checked_at,
        slots_checked: slots.length,
        matched_count: result.matched_slot_ids.length,
        pending_count: result.pending_slot_ids.length,
        missed_count: result.missed.length,
        missed: result.missed,
      },
      null,
      2,
    ),
  );
}

run();
