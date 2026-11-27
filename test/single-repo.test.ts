import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { generateQualityReport } from "../src/cli/quality-report.ts";
import type { GeneratedCandidate } from "../src/discovery/generators/interface.ts";
import { DEFAULT_ACTIVATION_MAP } from "../src/discovery/generators/registry.ts";
import {
  acquireLease,
  createEmptyQueue,
  enqueueCandidates,
  finalizeItem,
  projectPublicQueue,
  startResearch,
} from "../src/discovery/queue/index.ts";
import {
  loadDiscoveryQueue,
  QueueStoreConflict,
  saveDiscoveryQueue,
} from "../src/discovery/queue/store.ts";
import {
  createCriticSession,
  finalizeCriticReview,
  submitBlindEvaluation,
} from "../src/orchestration/devil-advocate.ts";
import { pathViolation } from "../src/pipeline/auto-merge.ts";
import type { PathChange } from "../src/pipeline/changes.ts";
import { REPO_ROOT } from "../src/pipeline/paths.ts";
import { checkPolicy } from "../src/pipeline/policy.ts";
import { minimizeRunManifest } from "../src/runs/minimize.ts";
import type { RunManifest } from "../src/runs/schema.ts";
import { loadRunManifests, recordRunManifest } from "../src/runs/store.ts";
import {
  checkBoundary,
  classifyRecord,
  validatePublicationGateway,
} from "../src/security/index.ts";
import { publicationReport } from "../src/site/publication.ts";
import { loadReadModel } from "../src/site/read-model.ts";

// Owner decision of 26 November 2026 (D1, D12, D14): one public repository.
// Each block maps to a property required by the architecture review.

const tmp = mkdtempSync(path.join(tmpdir(), "oem-single-repo-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const canonical = loadReadModel().dataset;
const T0 = "2026-11-26T10:00:00Z";

const manifest = (over: Partial<RunManifest> = {}): RunManifest => ({
  run_id: "task-a-20261126T003000Z",
  task: "task-a",
  role: "acquisition_and_ingest",
  provider: "openai-chatgpt",
  model: "unverified",
  scheduled_at: "2026-11-26T00:30:00Z",
  started_at: "2026-11-26T00:30:00Z",
  finished_at: "2026-11-26T01:10:00Z",
  engine_version: "0.1.0",
  queries: ["Baltic cable sabotage investigation November 2026"],
  sources_consulted: ["https://www.consilium.europa.eu/en/press/"],
  errors: [],
  status: "completed_no_results",
  ...over,
});

const candidate = (question: string): GeneratedCandidate => ({
  method: "contradictions",
  method_version: "1.0.0",
  priority: 50,
  question,
  refs: ["RU"],
  evidences: ["e"],
  alternative_explanations: ["a"],
  falsifiers: ["f"],
});

describe("1, 12. The OSINT engine needs no private repository or ZDR service", () => {
  it("has no code path that targets a private repository, ZDR tier or hidden local store", () => {
    let hits = "";
    try {
      hits = execFileSync(
        "git",
        [
          "grep",
          "-nE",
          "private_repo|_api_zdr|embedding_external_zdr|\\.private/",
          "--",
          "src",
          "packages",
        ],
        { cwd: REPO_ROOT, encoding: "utf8" },
      );
    } catch {
      hits = ""; // git grep exits 1 when nothing matches
    }
    expect(hits).toBe("");
  });

  it("stores the queue and run manifests in repository directories with plain files", () => {
    const run = recordRunManifest(manifest(), path.join(tmp, "runs"));
    expect(run.status).toBe("written");
    const base = createEmptyQueue(T0);
    const { queue } = enqueueCandidates(base, [candidate("Q1?")], {
      originRunId: "task-e-1",
      inputSnapshot: "snap",
      now: T0,
    });
    expect(saveDiscoveryQueue(queue, base, path.join(tmp, "dq1")).written).toHaveLength(1);
    expect(loadDiscoveryQueue(path.join(tmp, "dq1")).queue.items).toHaveLength(1);
  });
});

describe("2, 3. Candidates live in the repository without being presented as facts", () => {
  const report = publicationReport(canonical);
  const pending = canonical.events.filter((e) => e.review.status === "needs_review");

  it("keeps needs_review candidates in data/ but out of every public projection", () => {
    expect(pending.length).toBeGreaterThan(0);
    const published = new Set(report.dataset.events.map((e) => e.id));
    for (const e of pending) {
      expect(published.has(e.id)).toBe(false);
      expect(report.withheld.some((w) => w.id === e.id)).toBe(true);
    }
  });

  it("the gateway admits no needs_review record and is not weakened by repository storage", () => {
    const verdict = validatePublicationGateway(canonical);
    expect(verdict.checks.visibility_enforced).toBe(true);
    const projected = verdict.public_dataset ?? report.dataset;
    for (const collection of ["events", "entities", "relationships", "hypotheses"] as const) {
      expect(projected[collection].every((r) => r.review.status !== "needs_review")).toBe(true);
    }
  });

  it("classifies pending material as investigative, never as public", () => {
    expect(classifyRecord({ status: "needs_review" })).toBe("investigative_pending");
    expect(checkBoundary("investigative_pending", "public_site").allowed).toBe(false);
    expect(checkBoundary("investigative_pending", "public_export").allowed).toBe(false);
  });
});

describe("4. The Laboratory projection follows its publication rules", () => {
  it("shows only publishable, non-redacted queue items", () => {
    const base = createEmptyQueue(T0);
    const { queue } = enqueueCandidates(
      base,
      [
        { ...candidate("Internal lead?"), visibility: "private" },
        { ...candidate("Public question?"), visibility: "publishable" },
      ],
      { originRunId: "task-e-1", inputSnapshot: "snap", now: T0 },
    );
    const projected = projectPublicQueue(queue);
    expect(projected.items.map((i) => i.question)).toEqual(["Public question?"]);
  });
});

describe("5, 6. Ordinary AI may process OSINT; sensitive material stays protected", () => {
  it("lets subscription and API AIs process pending OSINT, drafts and operational data", () => {
    for (const dataClass of ["investigative_pending", "editorial_draft", "operational"] as const) {
      expect(checkBoundary(dataClass, "ai_subscription").allowed).toBe(true);
      expect(checkBoundary(dataClass, "ai_api").allowed).toBe(true);
      expect(checkBoundary(dataClass, "embedding_external").allowed).toBe(true);
    }
  });

  it("redacts credentials, URL authentication and sensitive errors, keeping OSINT queries", () => {
    const minimized = minimizeRunManifest(
      manifest({
        queries: ["GRU unit 29155 indictment", "token=ghp_abcdefghijklmnopqrstuvwxyz1234"],
        sources_consulted: ["https://user:pw@example.org/doc?id=3&access_token=xyz"],
        errors: [
          { code: "E1", message: "fetch failed for https://example.org", sensitive: false },
          { code: "E2", message: "personal phone of a witness", sensitive: true },
        ],
        notes: "used Bearer abcdefghijklmnopqrstuv for the API",
      }),
    );
    expect(minimized.queries[0]).toBe("GRU unit 29155 indictment");
    expect(minimized.queries[1]).not.toContain("ghp_");
    expect(minimized.sources_consulted[0]).not.toContain("user:pw");
    expect(minimized.sources_consulted[0]).not.toContain("access_token=xyz");
    expect(minimized.sources_consulted[0]).toContain("id=3");
    expect(minimized.errors[0]?.message).toBe("fetch failed for https://example.org");
    expect(minimized.errors[1]?.message).toBe("[REDACTED]");
    expect(minimized.notes).not.toContain("abcdefghijklmnopqrstuv");
  });

  it("denies holdout answers and future confidential material to AI services and the repository", () => {
    for (const dataClass of ["holdout_evaluation", "private_investigative"] as const) {
      expect(checkBoundary(dataClass, "ai_subscription").allowed).toBe(false);
      expect(checkBoundary(dataClass, "repository").allowed).toBe(false);
    }
  });
});

describe("7. Run manifests are recorded without extra infrastructure", () => {
  const dir = path.join(tmp, "manifests");

  it("writes once, accepts an identical rewrite and refuses a different one", () => {
    expect(recordRunManifest(manifest(), dir).status).toBe("written");
    expect(recordRunManifest(manifest(), dir).status).toBe("unchanged");
    expect(() => recordRunManifest(manifest({ status: "failed" }), dir)).toThrow(/append-only/);
    const loaded = loadRunManifests(dir);
    expect(loaded.issues).toEqual([]);
    expect(loaded.manifests).toHaveLength(1);
  });

  it("rejects unsafe run ids and flags a stored file that still carries a secret", () => {
    expect(() => recordRunManifest(manifest({ run_id: "../escape" }), dir)).toThrow();
    const bad = manifest({ run_id: "task-b-1", notes: "ghp_abcdefghijklmnopqrstuvwxyz1234" });
    writeFileSync(path.join(dir, "task-b-1.json"), `${JSON.stringify(bad, null, 2)}\n`);
    expect(loadRunManifests(dir).issues.some((i) => i.message.includes("credential"))).toBe(true);
  });

  it("validates the repository's own manifests and benchmark runs", () => {
    expect(loadRunManifests().issues).toEqual([]);
  });
});

describe("8. The stored discovery queue keeps integrity, concurrency and dedup guarantees", () => {
  const dir = path.join(tmp, "dq8");
  const setup = () => {
    const empty = createEmptyQueue(T0);
    const { queue } = enqueueCandidates(empty, [candidate("Who ordered X?")], {
      originRunId: "task-e-1",
      inputSnapshot: "snap",
      now: T0,
    });
    saveDiscoveryQueue(queue, empty, dir);
    return loadDiscoveryQueue(dir).queue;
  };

  it("does not duplicate a regenerated candidate", () => {
    const base = setup();
    const again = enqueueCandidates(base, [candidate("Who ordered X?")], {
      originRunId: "task-e-2",
      inputSnapshot: "snap",
      now: T0,
    });
    expect(again.added_ids).toEqual([]);
    expect(again.duplicate_keys).toHaveLength(1);
  });

  it("lets only one concurrent run take the lease and refuses the stale writer", () => {
    const base = loadDiscoveryQueue(dir).queue;
    const item = base.items[0];
    if (!item) throw new Error("missing item");
    const params = {
      itemId: item.id,
      expectedRevision: item.revision,
      now: T0,
      leaseDurationSeconds: 600,
    };
    const a = acquireLease(base, { ...params, runId: "run-a" });
    const b = acquireLease(base, { ...params, runId: "run-b" });
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    saveDiscoveryQueue(a.queue, base, dir);
    expect(() => saveDiscoveryQueue(b.queue, base, dir)).toThrow(QueueStoreConflict);
    expect(loadDiscoveryQueue(dir).queue.items[0]?.assigned_run_id).toBe("run-a");
  });

  it("keeps a late result from an expired lease without overwriting the outcome", () => {
    const base = loadDiscoveryQueue(dir).queue;
    const item = base.items[0];
    if (!item) throw new Error("missing item");
    const started = startResearch(base, {
      itemId: item.id,
      runId: "run-a",
      expectedRevision: item.revision,
      leaseGeneration: item.lease_generation,
      now: T0,
    });
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    const late = finalizeItem(started.queue, {
      itemId: item.id,
      runId: "run-a",
      expectedRevision: started.item.revision,
      leaseGeneration: started.item.lease_generation,
      now: "2026-11-27T10:00:00Z",
      targetStatus: "closed",
      disposition: "accepted",
      epistemic_outcome: "confirmed",
    });
    expect(late.ok).toBe(false);
    const after = late.queue.items[0];
    expect(after?.epistemic_outcome ?? null).toBeNull();
    expect(after?.late_outputs.length).toBe(1);
  });

  it("refuses to delete items", () => {
    const base = loadDiscoveryQueue(dir).queue;
    expect(() => saveDiscoveryQueue({ ...base, items: [] }, base, dir)).toThrow(
      /cannot be deleted/,
    );
  });

  it("never enqueues from shadow generators: every default activation is shadow", () => {
    expect(new Set(Object.values(DEFAULT_ACTIVATION_MAP))).toEqual(new Set(["shadow"]));
  });
});

describe("9. Corrections still propagate to the public projection", () => {
  it("withholds a suspended record from the projection", () => {
    const target = publicationReport(canonical).dataset.events[0];
    if (!target) throw new Error("no public event");
    const report = publicationReport(canonical, undefined, new Set([target.id]));
    expect(report.dataset.events.some((e) => e.id === target.id)).toBe(false);
    expect(report.withheld.find((w) => w.id === target.id)?.reasons).toContain(
      "retraction_suspended",
    );
  });
});

describe("10. Evidentiary, editorial and auto-merge gates are not weakened", () => {
  const change = (p: string, status: PathChange["status"] = "A"): PathChange =>
    ({ path: p, status, mode: "100644" }) as PathChange;

  it("runs and discovery branches are limited to their own directories", () => {
    expect(
      checkPolicy("agent/runs-task-a-2026-W48", [change("docs/runs/manifests/x.json")]),
    ).toEqual([]);
    expect(
      checkPolicy("agent/runs-task-a-2026-W48", [change("data/events/TL-0001.json", "M")]).length,
    ).toBe(1);
    expect(
      checkPolicy("agent/runs-task-a-2026-W48", [change("docs/runs/manifests/x.json", "M")]).length,
    ).toBe(1);
    expect(
      checkPolicy("agent/discovery-20261126", [change("docs/discovery/queue/dq-1.json", "M")]),
    ).toEqual([]);
    expect(
      checkPolicy("agent/discovery-20261126", [change("docs/discovery/queue/dq-1.json", "D")])
        .length,
    ).toBe(1);
    expect(checkPolicy("agent/discovery-20261126", [change("AGENTS.md", "M")]).length).toBe(1);
  });

  it("auto-merge accepts the new branches only inside their paths", () => {
    const f = (p: string, status = "added") => [{ path: p, status, blob: "x" }];
    expect(pathViolation("agent/runs-task-a-2026-W48", f("docs/runs/manifests/x.json"))).toBeNull();
    expect(
      pathViolation("agent/runs-task-a-2026-W48", f(".github/workflows/ci.yml")),
    ).not.toBeNull();
    expect(
      pathViolation("agent/discovery-20261126", f("docs/discovery/meta.json", "modified")),
    ).toBeNull();
    expect(
      pathViolation("agent/discovery-20261126", f("data/events/TL-0001.json", "modified")),
    ).not.toBeNull();
  });

  it("the gateway still fails closed on a token in a public record", () => {
    const ds = structuredClone(canonical);
    const first = publicationReport(ds).dataset.entities[0];
    const target = ds.entities.find((e) => e.id === first?.id);
    if (!target) throw new Error("no public entity");
    target.name = { it: "x", en: "ghp_abcdefghijklmnopqrstuvwxyz1234" };
    expect(validatePublicationGateway(ds).passed).toBe(false);
  });
});

describe("Benchmarks and critic: no simulated independence", () => {
  it("reports no agent metric from expected answers and marks the public split not independent", () => {
    const report = generateQualityReport();
    expect(report.agent_metrics.measured).toBe(false);
    expect(report.reference_sets.holdout_aggregate.independent).toBe(false);
  });

  it("claims cross-model review only when the platform reports both models", () => {
    const session = submitBlindEvaluation(
      createCriticSession({
        session_id: "s1",
        target_id: "ART-0001",
        claim_question: "q?",
        is_major_verification: true,
        sources: [{ source_id: "S1", title: "t", excerpt: "e" }],
        author_conclusion: {
          author_provider: "openai",
          author_model: "model-a",
          verdict: "supported",
          summary: "s",
          cited_source_ids: ["S1"],
        },
        candidates: [
          {
            provider: "anthropic",
            model: "model-b",
            benchmark_score: 0.9,
            eligible_for_critic: true,
          },
        ],
      }),
      {
        independent_verdict: "supported",
        source_assessments: [
          { source_id: "S1", reliability: "high", supports_claim: true, notes: "n" },
        ],
        alternative_hypotheses: ["alt"],
        confidence: "medium",
      },
    );
    const declared = finalizeCriticReview(session).report;
    expect(declared?.cross_model_verified).toBe(false);
    expect(declared?.independence_limit).toMatch(/not verified/);
    const reported = finalizeCriticReview(session, {
      model_attestation: "platform_reported",
    }).report;
    expect(reported?.cross_model_verified).toBe(true);
  });
});

describe("11. Documentation matches the code", () => {
  const scripts = Object.keys(
    (JSON.parse(readFileSync(path.join(REPO_ROOT, "package.json"), "utf8")) as { scripts: object })
      .scripts,
  );
  it("every pnpm command in the AGENTS.md command block exists", () => {
    const agents = readFileSync(path.join(REPO_ROOT, "AGENTS.md"), "utf8");
    const block = agents.slice(
      agents.indexOf("## Commands"),
      agents.indexOf("## Where things are"),
    );
    const used = [...block.matchAll(/^pnpm ([a-z0-9:-]+)/gm)].map((m) => m[1] as string);
    const builtins = new Set(["install"]);
    expect(used.filter((c) => !builtins.has(c) && !scripts.includes(c))).toEqual([]);
  });

  it("the security and runs docs describe the single repository, not a private one", () => {
    for (const file of ["docs/security/PUBLIC_BOUNDARY.md", "docs/runs/README.md"]) {
      const text = readFileSync(path.join(REPO_ROOT, file), "utf8");
      expect(text).not.toMatch(/Private Repo\b|private repository\)|Zero Data Retention \(ZDR\)/);
      expect(text).toMatch(/single|one public repository|single repository/i);
    }
  });
});
