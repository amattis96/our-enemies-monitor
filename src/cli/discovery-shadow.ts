import { runGeneratorRegistry } from "../discovery/generators/registry.ts";
import { ENGINE_VERSION } from "../engine/version.ts";
import { createDefaultLifecycleRegistry } from "../orchestration/index.ts";
import { readDataFiles } from "../pipeline/load.ts";
import { validateDataFiles } from "../pipeline/validate.ts";

// Scheduled shadow run of the deterministic discovery generators (PK-11/12).
// Read-only: it never writes data/, opens PRs or persists candidates; it
// prints only counts and gate metrics, never candidate questions or refs.
const registry = createDefaultLifecycleRegistry();
const gate = registry.canExecute("discovery-engine");
if (!gate.allowed || gate.mutates_production) {
  console.error(`discovery engine must run in non-mutating shadow mode: ${JSON.stringify(gate)}`);
  process.exit(1);
}
const { dataset: data, issues } = validateDataFiles(readDataFiles());
if (issues.some((i) => i.severity === "error")) {
  console.error("canonical data validation failed; shadow run aborted");
  process.exit(1);
}
const now = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
const result = await runGeneratorRegistry({
  snapshot_id: "shadow",
  dataset_hash: "shadow",
  engine_version: ENGINE_VERSION,
  generated_at: now,
  run_id: `shadow-${now}`,
});
console.log(
  JSON.stringify(
    {
      mode: gate.effective_mode,
      mutates_production: gate.mutates_production,
      engine_version: ENGINE_VERSION,
      entities_loaded: data.entities.length,
      events_loaded: data.events.length,
      active_candidates: result.active_candidates.length,
      shadow_candidates: result.shadow_candidates.length,
      generators: result.metrics.map((m) => ({
        id: m.id,
        activation: m.activation,
        candidates: m.candidate_count,
        eligible_for_promotion: m.eligible_for_promotion,
      })),
    },
    null,
    2,
  ),
);
