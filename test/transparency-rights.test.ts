import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_ENGINE_CHANGELOG_PATH,
  diffEngineManifests,
  renderEngineChangelogMarkdown,
} from "../src/engine/changelog.ts";
import {
  checkEngineManifestCoherence,
  loadPublicRunManifests,
  projectPublicEngineManifest,
  readEngineManifest,
} from "../src/engine/manifest.ts";
import { ENGINE_VERSION } from "../src/engine/version.ts";
import { repoPath } from "../src/pipeline/paths.ts";
import { readRetractionRegister } from "../src/retractions/register.ts";
import { RunManifestSchema } from "../src/runs/schema.ts";

describe("PK-16 Engine transparency", () => {
  it("validates engine.manifest.json and passes semantic coherence against code", () => {
    const manifest = readEngineManifest();
    expect(manifest.engine_version).toBe(ENGINE_VERSION);
    expect(manifest.operational_metrics).toBeDefined();
    expect(manifest.thresholds.code_thresholds).toBeDefined();
    expect(manifest.thresholds.security_thresholds).toBeDefined();

    const result = checkEngineManifestCoherence(manifest);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.checked.motore_page_present).toBe(true);
  });

  it("fails semantic coherence check when a code threshold or engine_version drifts", () => {
    const manifest = readEngineManifest();

    const driftedGrace = structuredClone(manifest);
    driftedGrace.thresholds.code_thresholds.missed_run_grace_minutes = 45;
    const graceCheck = checkEngineManifestCoherence(driftedGrace);
    expect(graceCheck.ok).toBe(false);
    expect(graceCheck.errors.some((e) => e.includes("missed_run_grace_minutes drift"))).toBe(true);

    const driftedQuality = structuredClone(manifest);
    driftedQuality.thresholds.code_thresholds.quality_min_precision = 0.75;
    const qualityCheck = checkEngineManifestCoherence(driftedQuality);
    expect(qualityCheck.ok).toBe(false);
    expect(qualityCheck.errors.some((e) => e.includes("quality_min_precision drift"))).toBe(true);

    const driftedVersion = structuredClone(manifest);
    driftedVersion.engine_version = "9.9.9";
    const versionCheck = checkEngineManifestCoherence(driftedVersion);
    expect(versionCheck.ok).toBe(false);
    expect(versionCheck.errors.some((e) => e.includes("engine_version drift"))).toBe(true);
  });

  it("strips security thresholds, protection details, investigative queries, and detection mechanics in public projection", () => {
    const manifest = readEngineManifest();
    const pub = projectPublicEngineManifest(manifest);
    const serialized = JSON.stringify(pub);

    expect(serialized).not.toContain("security_thresholds");
    expect(serialized).not.toContain("protection_details");
    expect(serialized).not.toContain("investigative_queries");
    expect(serialized).not.toContain("detection_mechanics");
    expect(serialized).not.toContain("quarantine_marker_prefix");
    expect(serialized).not.toContain("internal-only query template");

    expect(pub.methods.length).toBe(manifest.methods.length);
    expect(pub.public_thresholds).toEqual(manifest.thresholds.code_thresholds);
    expect(pub.roles.length).toBe(manifest.roles.length);
  });

  it("generates deterministic ENGINE_CHANGELOG.md from manifest diffs", () => {
    const manifest = readEngineManifest();
    const initialEntry = diffEngineManifests(null, manifest);
    const initialMd = renderEngineChangelogMarkdown([initialEntry]);
    const onDisk = readFileSync(DEFAULT_ENGINE_CHANGELOG_PATH, "utf8");
    expect(onDisk).toBe(initialMd);

    const next = structuredClone(manifest);
    next.engine_version = "0.2.0";
    next.updated_at = "2026-12-01";
    const firstMethod = next.methods[0];
    if (!firstMethod) {
      throw new Error("Expected at least one method in engine manifest");
    }
    next.methods[0] = {
      ...firstMethod,
      version: "1.1.0",
    };
    next.thresholds.code_thresholds.missed_run_grace_minutes = 20;

    const upgradeEntry = diffEngineManifests(manifest, next);
    expect(upgradeEntry.method_changes).toHaveLength(1);
    expect(upgradeEntry.threshold_changes).toEqual([
      { key: "missed_run_grace_minutes", before: 30, after: 20 },
    ]);
    const rendered = renderEngineChangelogMarkdown([upgradeEntry, initialEntry]);
    expect(rendered).toContain("## v0.2.0 (2026-12-01) — from v0.1.0");
    expect(rendered).toContain("`missed_run_grace_minutes`: `30` -> `20`");
  });

  it("loads and sanitizes run manifests including missed runs for /stato", () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), "oem-runs-"));
    try {
      const missedRun = RunManifestSchema.parse({
        run_id: "missed-slot-01",
        slot_id: "slot-01",
        task: "task_a_osint_ingest",
        role: "acquisition",
        provider: "openai-chatgpt",
        model: "scheduled-automation",
        scheduled_at: "2026-11-25T00:30:00Z",
        started_at: null,
        finished_at: null,
        engine_version: ENGINE_VERSION,
        queries: ["secret investigative query"],
        sources_consulted: ["https://private.example/source"],
        errors: [
          {
            code: "MISSED_RUN",
            message: "Scheduled slot slot-01 did not record a manifest.",
            sensitive: false,
            stage: "scheduler_reconciliation",
          },
        ],
        status: "missed",
        notes: "private diagnostic note",
      });

      writeFileSync(path.join(tempDir, "missed.json"), JSON.stringify(missedRun), "utf8");
      const loaded = loadPublicRunManifests(tempDir);
      expect(loaded).toHaveLength(1);
      expect(loaded[0]?.status).toBe("missed");
      const serialized = JSON.stringify(loaded[0]);
      expect(serialized).not.toContain("secret investigative query");
      expect(serialized).not.toContain("https://private.example/source");
      expect(serialized).not.toContain("private diagnostic note");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("provides bilingual /metodo/motore and /stato Astro pages", () => {
    const motore = readFileSync(repoPath("web/src/pages/[...lang]/metodo/motore.astro"), "utf8");
    expect(motore).toContain("languageFromParam(Astro.params.lang)");
    expect(motore).toContain("projectPublicEngineManifest");
    expect(motore).toContain("ai_verified");
    expect(motore).toContain("reviewed");

    const stato = readFileSync(repoPath("web/src/pages/[...lang]/stato.astro"), "utf8");
    expect(stato).toContain("languageFromParam(Astro.params.lang)");
    expect(stato).toContain("loadPublicRunManifests");
    expect(stato).toContain("missed");
  });
});

describe("PK-17 Corrections and right of reply", () => {
  it("documents bilingual right-of-reply procedure with response times, moderation, D12, and evidence channels", () => {
    const doc = readFileSync(repoPath("docs/editorial/RIGHT_OF_REPLY.md"), "utf8");
    expect(doc).toContain("48 ore");
    expect(doc).toContain("48 hours");
    expect(doc).toContain("D12");
    expect(doc).toContain("Porta un'evidenza");
    expect(doc).toContain("Bring evidence");
    expect(doc).toContain("https://github.com/amattis96/our-enemies-monitor/issues/new");
  });

  it("connects /rettifiche to PK-07 retraction register and includes bilingual content and sample reply linkage", () => {
    const register = readRetractionRegister();
    expect(register.registry).toBe("retractions");

    const rettifiche = readFileSync(repoPath("web/src/pages/[...lang]/rettifiche.astro"), "utf8");
    expect(rettifiche).toContain("languageFromParam(Astro.params.lang)");
    expect(rettifiche).toContain("readRetractionRegister");
    expect(rettifiche).toContain("Porta un'evidenza su GitHub");
    expect(rettifiche).toContain("Bring evidence on GitHub");
    expect(rettifiche).toContain("D12");
    expect(rettifiche).toContain("TL-0001");
    expect(rettifiche).toContain("href(SAMPLE_LINKED_REPLY.target_path, lang)");
  });
});
