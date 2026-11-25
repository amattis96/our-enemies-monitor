import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import {
  BACKTEST_EXPERIMENTS,
  BACKTEST_MODES,
  type BacktestExperiment,
  type BacktestMode,
  runBacktestReport,
} from "../discovery/backtest.ts";
import {
  ACCESS_SURFACES,
  type AccessSurface,
  PrivateDomainAccessError,
} from "../temporal/index.ts";

function usage(): string {
  return [
    "Usage: node src/cli/backtest.ts [options]",
    "",
    "Options:",
    "  --dates <d1,d2,d3>        Comma-separated as-of dates (default: 2024-06-01,2025-01-01,2026-01-01)",
    "  --mode <canonical|acquired>  PK-05 asof mode (default: canonical)",
    "  --experiment <kind>       retrospective_backtest | historical_replay | both (default: both)",
    "  --surface <surface>       Access surface (cli, private, public, portal, mcp; default: cli)",
    "  --snapshots-dir <dir>     Override docs/snapshots directory",
    "  --revisions-dir <dir>     Override private revisions directory",
    "  --out <path>              Optional output JSON file path",
    "  --help                    Show this help message",
  ].join("\n");
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: false,
    options: {
      dates: { type: "string", default: "2024-06-01,2025-01-01,2026-01-01" },
      mode: { type: "string", default: "canonical" },
      experiment: { type: "string", default: "both" },
      surface: { type: "string", default: "cli" },
      "snapshots-dir": { type: "string" },
      "revisions-dir": { type: "string" },
      out: { type: "string" },
      help: { type: "boolean", default: false },
    },
  });

  if (values.help) {
    console.log(usage());
    process.exit(0);
  }

  const dates = (values.dates ?? "")
    .split(",")
    .map((d) => d.trim())
    .filter((d) => d.length > 0);
  if (dates.length === 0) {
    console.error("At least one date must be provided via --dates.");
    process.exit(1);
  }

  const mode = values.mode as BacktestMode;
  if (!BACKTEST_MODES.includes(mode)) {
    console.error(`Invalid --mode "${values.mode}". Expected one of: ${BACKTEST_MODES.join(", ")}`);
    process.exit(1);
  }

  const experiment = values.experiment as BacktestExperiment | "both";
  if (experiment !== "both" && !BACKTEST_EXPERIMENTS.includes(experiment)) {
    console.error(
      `Invalid --experiment "${values.experiment}". Expected one of: both, ${BACKTEST_EXPERIMENTS.join(", ")}`,
    );
    process.exit(1);
  }

  const surface = values.surface as AccessSurface;
  if (!ACCESS_SURFACES.includes(surface)) {
    console.error(
      `Invalid --surface "${values.surface}". Expected one of: ${ACCESS_SURFACES.join(", ")}`,
    );
    process.exit(1);
  }

  try {
    const report = await runBacktestReport({
      dates,
      mode,
      experiment,
      surface,
      ...(values["snapshots-dir"] !== undefined ? { snapshotsDir: values["snapshots-dir"] } : {}),
      ...(values["revisions-dir"] !== undefined ? { revisionsDir: values["revisions-dir"] } : {}),
    });

    const formatted = JSON.stringify(report, null, 2);
    if (values.out) {
      mkdirSync(path.dirname(values.out), { recursive: true });
      writeFileSync(values.out, `${formatted}\n`, "utf8");
    }
    console.log(formatted);
  } catch (error) {
    if (error instanceof PrivateDomainAccessError) {
      console.error(`Access denied: ${error.message}`);
      process.exit(1);
    }
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    process.exit(1);
  }
}

await main();
