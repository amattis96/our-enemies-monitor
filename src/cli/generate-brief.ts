import { existsSync, readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import {
  type AlarmRecord,
  AlarmRecordSchema,
  type BriefEvidenceItem,
  BriefEvidenceItemSchema,
  type Countermeasure,
  CountermeasureSchema,
  formatBriefMarkdown,
  generateDailyAlert,
  generateWeeklyBrief,
} from "../briefs/index.ts";
import { type RunManifest, RunManifestSchema } from "../runs/schema.ts";

function usage(): string {
  return [
    "Usage: node src/cli/generate-brief.ts [options]",
    "",
    "Options:",
    "  --mode <weekly|daily>      Brief cadence mode (default: weekly)",
    "  --country <name>           Filter by country",
    "  --actor <name>             Filter by actor",
    "  --theme <name>             Filter by theme",
    "  --window-from <utc>        UTC start timestamp",
    "  --window-to <utc>          UTC end timestamp",
    "  --items <path>             JSON array of BriefEvidenceItem objects",
    "  --alarms <path>            JSON array of AlarmRecord objects",
    "  --countermeasures <path>   JSON array of Countermeasure objects",
    "  --manifests <path>         JSON array of PK-08 RunManifest objects",
    "  --format <json|markdown>   Output format (default: json)",
    "  --dry-run                  Generate brief without writing files",
    "  -h, --help                 Show this help message",
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
      mode: { type: "string", default: "weekly" },
      country: { type: "string" },
      actor: { type: "string" },
      theme: { type: "string" },
      "window-from": { type: "string" },
      "window-to": { type: "string" },
      items: { type: "string" },
      alarms: { type: "string" },
      countermeasures: { type: "string" },
      manifests: { type: "string" },
      format: { type: "string", default: "json" },
      "dry-run": { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
  });

  if (values.help) {
    console.log(usage());
    return;
  }

  const now = new Date();
  const windowTo = values["window-to"] ?? now.toISOString().replace(/\.\d{3}Z$/, "Z");
  const windowFromDate = new Date(
    now.getTime() - (values.mode === "daily" ? 24 : 7 * 24) * 60 * 60 * 1000,
  );
  const windowFrom =
    values["window-from"] ?? windowFromDate.toISOString().replace(/\.\d{3}Z$/, "Z");

  const items: BriefEvidenceItem[] = readJsonArray(values.items, (raw) =>
    BriefEvidenceItemSchema.parse(raw),
  );
  const alarms: AlarmRecord[] = readJsonArray(values.alarms, (raw) => AlarmRecordSchema.parse(raw));
  const countermeasures: Countermeasure[] = readJsonArray(values.countermeasures, (raw) =>
    CountermeasureSchema.parse(raw),
  );
  const manifests: RunManifest[] = readJsonArray(values.manifests, (raw) =>
    RunManifestSchema.parse(raw),
  );

  const filter = {
    ...(values.country !== undefined ? { country: values.country } : {}),
    ...(values.actor !== undefined ? { actor: values.actor } : {}),
    ...(values.theme !== undefined ? { theme: values.theme } : {}),
  };

  const brief =
    values.mode === "daily"
      ? generateDailyAlert({
          window_from: windowFrom,
          window_to: windowTo,
          items,
          alarms,
          countermeasures,
          manifests,
          filter,
        })
      : generateWeeklyBrief({
          window_from: windowFrom,
          window_to: windowTo,
          items,
          alarms,
          countermeasures,
          manifests,
          filter,
        });

  if (values.format === "markdown") {
    console.log(formatBriefMarkdown(brief));
    return;
  }

  console.log(
    JSON.stringify(
      {
        dry_run: values["dry-run"],
        brief,
      },
      null,
      2,
    ),
  );
}

run();
