import { parseArgs } from "node:util";
import { runGeneratorRegistry } from "../discovery/generators/registry.ts";
import {
  acquireLease,
  EPISTEMIC_OUTCOMES,
  type EpistemicOutcome,
  enqueueCandidates,
  finalizeItem,
  QUEUE_DISPOSITIONS,
  type QueueDisposition,
  startResearch,
} from "../discovery/queue/index.ts";
import { loadDiscoveryQueue, saveDiscoveryQueue } from "../discovery/queue/store.ts";
import { ENGINE_VERSION } from "../engine/version.ts";

// pnpm discovery:queue <command> — operate the discovery queue stored in
// docs/discovery/ (PK-09, D1). Every command loads the stored queue, applies
// one state-machine transition and saves with the optimistic store check.
// Commit the result on an agent/discovery-* branch.
//
//   list
//   enqueue --run <run_id>          generators whose activation is not shadow/disabled
//   lease <id> --run <run_id> [--seconds 7200]
//   start <id> --run <run_id>
//   finalize <id> --run <run_id> --status in_review|closed|failed_technical
//            [--disposition accepted|duplicate|forbidden|discarded]
//            [--outcome confirmed|contradicted|insufficient_evidence|undeterminable]
//            [--refs ID,ID] [--reason text]

const now = () => new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    run: { type: "string" },
    seconds: { type: "string" },
    status: { type: "string" },
    disposition: { type: "string" },
    outcome: { type: "string" },
    refs: { type: "string" },
    reason: { type: "string" },
  },
});
const [command, itemId] = positionals;

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}
function need<T>(value: T | undefined, name: string): T {
  if (value === undefined) fail(`missing --${name}`);
  return value;
}

const { queue: base, issues } = loadDiscoveryQueue();
if (issues.length > 0)
  fail(`stored queue is invalid; run pnpm validate:discovery (${issues.length} issue(s))`);
const item = itemId ? base.items.find((i) => i.id === itemId) : undefined;
if (itemId && !item) fail(`queue item ${itemId} not found`);

switch (command) {
  case "list": {
    for (const i of base.items) {
      console.log(
        `${i.id}\t${i.status}\trev=${i.revision}\tgen=${i.lease_generation}\tp=${i.priority}\t${i.visibility}\t${i.method}`,
      );
    }
    console.log(`${base.items.length} item(s), ${base.negative_memory.length} negative record(s)`);
    break;
  }
  case "enqueue": {
    const run = need(values.run, "run");
    const result = await runGeneratorRegistry({
      snapshot_id: "repository-head",
      dataset_hash: "repository-head",
      engine_version: ENGINE_VERSION,
      generated_at: now(),
      run_id: run,
    });
    // Shadow and disabled generators never feed the stored queue (plan §5.13).
    const next = enqueueCandidates(base, result.active_candidates, {
      originRunId: run,
      inputSnapshot: "repository-head",
      now: now(),
      engineVersion: ENGINE_VERSION,
    });
    const saved = saveDiscoveryQueue(next.queue, base);
    console.log(
      `enqueued ${next.added_ids.length} (duplicates ${next.duplicate_keys.length}; shadow candidates not enqueued: ${result.shadow_candidates.length}); wrote ${saved.written.length} file(s)`,
    );
    break;
  }
  case "lease": {
    if (!item) fail("usage: lease <id> --run <run_id>");
    const result = acquireLease(base, {
      itemId: item.id,
      runId: need(values.run, "run"),
      expectedRevision: item.revision,
      now: now(),
      leaseDurationSeconds: Number(values.seconds ?? 7200),
    });
    if (!result.ok) fail(`lease refused: ${result.reason}`);
    saveDiscoveryQueue(result.queue, base);
    console.log(
      `leased ${item.id} rev=${result.item.revision} gen=${result.item.lease_generation} until ${result.item.lease_expires_at}`,
    );
    break;
  }
  case "start": {
    if (!item) fail("usage: start <id> --run <run_id>");
    const result = startResearch(base, {
      itemId: item.id,
      runId: need(values.run, "run"),
      expectedRevision: item.revision,
      leaseGeneration: item.lease_generation,
      now: now(),
    });
    if (!result.ok) fail(`start refused: ${result.reason}`);
    saveDiscoveryQueue(result.queue, base);
    console.log(`researching ${item.id} rev=${result.item.revision}`);
    break;
  }
  case "finalize": {
    if (!item) fail("usage: finalize <id> --run <run_id> --status ...");
    const status = need(values.status, "status");
    if (status !== "in_review" && status !== "closed" && status !== "failed_technical") {
      fail("--status must be in_review, closed or failed_technical");
    }
    const disposition = values.disposition as QueueDisposition | undefined;
    if (disposition && !QUEUE_DISPOSITIONS.includes(disposition)) fail("invalid --disposition");
    const outcome = values.outcome as EpistemicOutcome | undefined;
    if (outcome && !EPISTEMIC_OUTCOMES.includes(outcome)) fail("invalid --outcome");
    const result = finalizeItem(base, {
      itemId: item.id,
      runId: need(values.run, "run"),
      expectedRevision: item.revision,
      leaseGeneration: item.lease_generation,
      now: now(),
      targetStatus: status,
      ...(disposition ? { disposition } : {}),
      ...(outcome ? { epistemic_outcome: outcome } : {}),
      ...(values.refs ? { outcome_refs: values.refs.split(",").filter(Boolean) } : {}),
      ...(values.reason ? { reason: values.reason } : {}),
    });
    // A rejected (late or stale) output is still saved in late_outputs.
    saveDiscoveryQueue(result.queue, base);
    if (!result.ok) fail(`finalize refused: ${result.reason}; output preserved in late_outputs`);
    console.log(`finalized ${item.id} -> ${result.item.status}`);
    break;
  }
  default:
    fail("usage: pnpm discovery:queue list|enqueue|lease|start|finalize ...");
}
