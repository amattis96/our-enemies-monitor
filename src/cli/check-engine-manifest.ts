import { parseArgs } from "node:util";
import {
  checkEngineManifestCoherence,
  DEFAULT_ENGINE_MANIFEST_PATH,
  readEngineManifest,
} from "../engine/manifest.ts";

function usage(): string {
  return [
    "Usage: node src/cli/check-engine-manifest.ts [options]",
    "",
    "Options:",
    "  --manifest <path>   Path to engine.manifest.json (default: docs/automation/engine.manifest.json)",
    "  -h, --help          Show this help message",
  ].join("\n");
}

function run(): void {
  const { values } = parseArgs({
    options: {
      manifest: { type: "string", default: DEFAULT_ENGINE_MANIFEST_PATH },
      help: { type: "boolean", short: "h", default: false },
    },
  });

  if (values.help) {
    console.log(usage());
    return;
  }

  const manifest = readEngineManifest(values.manifest);
  const result = checkEngineManifestCoherence(manifest);
  console.log(JSON.stringify(result, null, 2));

  if (!result.ok) {
    process.exitCode = 1;
  }
}

run();
