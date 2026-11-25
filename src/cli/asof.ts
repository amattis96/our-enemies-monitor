import { parseArgs } from "node:util";
import {
  ACCESS_SURFACES,
  type AccessSurface,
  ASOF_MODES,
  type AsofMode,
  PrivateDomainAccessError,
  resolveAsOf,
} from "../temporal/index.ts";

function usage(): string {
  return [
    "Usage: node src/cli/asof.ts <date> --mode <canonical|published|acquired|verified> [options]",
    "",
    "Options:",
    "  --mode <mode>             Reconstruction mode (canonical, published, acquired, verified)",
    "  --snapshots-dir <dir>     Override docs/snapshots directory",
    "  --revisions-dir <dir>     Override private revisions directory",
    "  --surface <surface>       Access surface (cli, private, public, portal, mcp)",
    "  --help                    Show this help message",
  ].join("\n");
}

function main(): void {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: true,
    options: {
      mode: { type: "string", default: "published" },
      "snapshots-dir": { type: "string" },
      "revisions-dir": { type: "string" },
      surface: { type: "string", default: "cli" },
      help: { type: "boolean", default: false },
    },
  });

  if (values.help || positionals.length === 0) {
    console.log(usage());
    process.exit(values.help ? 0 : 1);
  }

  const date = positionals[0];
  if (!date) {
    console.error("Missing <date> argument.\n");
    console.error(usage());
    process.exit(1);
  }

  const mode = values.mode as AsofMode;
  if (!ASOF_MODES.includes(mode)) {
    console.error(`Invalid --mode "${values.mode}". Expected one of: ${ASOF_MODES.join(", ")}`);
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
    const result = resolveAsOf({
      date,
      mode,
      surface,
      ...(values["snapshots-dir"] !== undefined ? { snapshotsDir: values["snapshots-dir"] } : {}),
      ...(values["revisions-dir"] !== undefined ? { revisionsDir: values["revisions-dir"] } : {}),
    });
    console.log(JSON.stringify(result, null, 2));
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

main();
