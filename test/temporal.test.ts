import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  computeDatasetHash,
  isExcludedFromDatasetHash,
  PrivateDomainAccessError,
  parseAsofDate,
  readSnapshotEvents,
  recordKnowledgeRevision,
  recordSnapshotTransition,
  resolveAsOf,
} from "../src/temporal/index.ts";

const tempDirs: string[] = [];

function makeTempDir(prefix: string): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  delete process.env.OEM_PUBLIC_SURFACE;
  delete process.env.OEM_MCP_PUBLIC;
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

const SAMPLE_VERSIONS = {
  dataset: "0.1.0",
  portal: "0.1.0",
  schema: "1.0.0",
  engine: "1.0.0",
};

const COMMIT_1 = "1111111111111111111111111111111111111111";
const COMMIT_2 = "2222222222222222222222222222222222222222";
const HASH_1 = "a".repeat(64);
const HASH_2 = "b".repeat(64);

describe("PK-05 deterministic dataset hashing", () => {
  it("produces identical SHA-256 hashes regardless of key or file ordering", () => {
    const buildA = computeDatasetHash({
      files: [
        { path: "events/TL-0001.json", text: '{"id":"TL-0001","b":2,"a":{"y":2,"x":1}}' },
        { path: "entities/ENT_A.json", text: '{"id":"ENT_A","kind":"state"}' },
      ],
    });
    const buildB = computeDatasetHash({
      files: [
        { path: "entities/ENT_A.json", text: '{\n  "kind": "state",\n  "id": "ENT_A"\n}\n' },
        { path: "events/TL-0001.json", text: '{"a":{"x":1,"y":2},"b":2,"id":"TL-0001"}' },
      ],
    });

    expect(buildA.hash).toBe(buildB.hash);
    expect(buildA.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(buildA.fileCount).toBe(2);
  });

  it("excludes docs/snapshots/ and operational manifests so hashes are never self-referential", () => {
    expect(isExcludedFromDatasetHash("docs/snapshots/index.json")).toBe(true);
    expect(isExcludedFromDatasetHash("docs/snapshots/events/0001.json")).toBe(true);
    expect(isExcludedFromDatasetHash("docs/roadmap/progress/active-work.json")).toBe(true);
    expect(isExcludedFromDatasetHash("docs/quality/reports/latest.json")).toBe(true);
    expect(isExcludedFromDatasetHash("pipeline.manifest.json")).toBe(true);
    expect(isExcludedFromDatasetHash("events/TL-0001.json")).toBe(false);

    const base = computeDatasetHash({
      files: [{ path: "events/TL-0001.json", text: '{"id":"TL-0001"}' }],
    });
    const withSnapshotsAndManifests = computeDatasetHash({
      files: [
        { path: "events/TL-0001.json", text: '{"id":"TL-0001"}' },
        { path: "docs/snapshots/index.json", text: '{"event_count":99}' },
        { path: "docs/snapshots/events/0001.json", text: '{"transition":"snapshot.published"}' },
        { path: "deploy.manifest.json", text: '{"run":1}' },
      ],
    });

    expect(withSnapshotsAndManifests.hash).toBe(base.hash);
    expect(withSnapshotsAndManifests.excludedPaths).toEqual([
      "deploy.manifest.json",
      "docs/snapshots/events/0001.json",
      "docs/snapshots/index.json",
    ]);
  });
});

describe("PK-05 snapshot transition registry & lifecycle", () => {
  it("handles idempotent retries without duplicating transition events", () => {
    const dir = makeTempDir("oem-snap-idem-");

    const first = recordSnapshotTransition(
      {
        snapshot_id: "snap-1",
        transition: "snapshot.accepted",
        commit: COMMIT_1,
        recorded_at: "2026-06-01T10:00:00Z",
        precision: "second",
        versions: SAMPLE_VERSIONS,
        dataset_hash: HASH_1,
      },
      dir,
    );
    const retry = recordSnapshotTransition(
      {
        snapshot_id: "snap-1",
        transition: "snapshot.accepted",
        commit: COMMIT_1,
        recorded_at: "2026-06-01T10:05:00Z",
        precision: "second",
        versions: SAMPLE_VERSIONS,
        dataset_hash: HASH_1,
      },
      dir,
    );

    expect(first.created).toBe(true);
    expect(retry.created).toBe(false);
    expect(retry.event.event_id).toBe(first.event.event_id);
    expect(readSnapshotEvents(dir)).toHaveLength(1);
    expect(readdirSync(path.join(dir, "events")).filter((f) => f.endsWith(".json"))).toHaveLength(
      1,
    );
  });

  it("reconstructs failed deploy, republish, supersede, and withdraw transitions accurately", () => {
    const dir = makeTempDir("oem-snap-lifecycle-");

    recordSnapshotTransition(
      {
        snapshot_id: "snap-1",
        transition: "snapshot.accepted",
        commit: COMMIT_1,
        recorded_at: "2026-06-01T09:00:00Z",
        versions: SAMPLE_VERSIONS,
        dataset_hash: HASH_1,
      },
      dir,
    );
    recordSnapshotTransition(
      {
        snapshot_id: "snap-1",
        transition: "deployment.failed",
        commit: COMMIT_1,
        recorded_at: "2026-06-01T10:00:00Z",
        versions: SAMPLE_VERSIONS,
        dataset_hash: HASH_1,
        reason: "CDN timeout",
      },
      dir,
    );
    recordSnapshotTransition(
      {
        snapshot_id: "snap-1",
        transition: "snapshot.published",
        commit: COMMIT_1,
        recorded_at: "2026-06-01T11:00:00Z",
        versions: SAMPLE_VERSIONS,
        dataset_hash: HASH_1,
      },
      dir,
    );
    recordSnapshotTransition(
      {
        snapshot_id: "snap-2",
        transition: "snapshot.accepted",
        commit: COMMIT_2,
        recorded_at: "2026-06-02T09:00:00Z",
        versions: SAMPLE_VERSIONS,
        dataset_hash: HASH_2,
      },
      dir,
    );
    recordSnapshotTransition(
      {
        snapshot_id: "snap-1",
        transition: "snapshot.superseded",
        commit: COMMIT_1,
        recorded_at: "2026-06-02T09:30:00Z",
        versions: SAMPLE_VERSIONS,
        dataset_hash: HASH_1,
        supersedes: "snap-2",
      },
      dir,
    );
    recordSnapshotTransition(
      {
        snapshot_id: "snap-2",
        transition: "snapshot.published",
        commit: COMMIT_2,
        recorded_at: "2026-06-02T10:00:00Z",
        versions: SAMPLE_VERSIONS,
        dataset_hash: HASH_2,
      },
      dir,
    );
    recordSnapshotTransition(
      {
        snapshot_id: "snap-2",
        transition: "snapshot.withdrawn",
        commit: COMMIT_2,
        recorded_at: "2026-06-03T12:00:00Z",
        versions: SAMPLE_VERSIONS,
        dataset_hash: HASH_2,
        reason: "Erroneous source link",
      },
      dir,
    );

    // At 10:30 on June 1: deployment failed, not yet republished -> published is null.
    const atFailed = resolveAsOf({
      date: "2026-06-01T10:30:00Z",
      mode: "published",
      snapshotsDir: dir,
    });
    expect(atFailed.domain).toBe("public");
    if (atFailed.domain === "public") {
      expect(atFailed.active_snapshot).toBeNull();
      expect(atFailed.failed_deployments.map((s) => s.snapshot_id)).toEqual(["snap-1"]);
    }

    // At 11:30 on June 1: republished -> snap-1 is active published.
    const atRepublish = resolveAsOf({
      date: "2026-06-01T11:30:00Z",
      mode: "published",
      snapshotsDir: dir,
    });
    if (atRepublish.domain === "public") {
      expect(atRepublish.active_snapshot?.snapshot_id).toBe("snap-1");
    }

    // On June 2: snap-2 is published (later withdrawal on June 3 does not leak).
    const atJune2 = resolveAsOf({
      date: "2026-06-02",
      mode: "published",
      snapshotsDir: dir,
    });
    if (atJune2.domain === "public") {
      expect(atJune2.active_snapshot?.snapshot_id).toBe("snap-2");
      expect(atJune2.withdrawn_snapshots).toEqual([]);
    }

    // On June 3: snap-2 is withdrawn -> not active in published or canonical.
    const atJune3 = resolveAsOf({
      date: "2026-06-03",
      mode: "published",
      snapshotsDir: dir,
    });
    if (atJune3.domain === "public") {
      expect(atJune3.active_snapshot).toBeNull();
      expect(atJune3.withdrawn_snapshots.map((s) => s.snapshot_id)).toEqual(["snap-2"]);
    }
  });
});

describe("PK-05 leakage, precision, retrospective_partial & private-domain guard", () => {
  it("prevents later corrections from leaking into earlier reconstructions across all 4 modes", () => {
    const snapshotsDir = makeTempDir("oem-leak-snap-");
    const revisionsDir = makeTempDir("oem-leak-rev-");

    // Public canonical & published snapshots at T1 and T2 (correction)
    recordSnapshotTransition(
      {
        snapshot_id: "snap-t1",
        transition: "snapshot.accepted",
        commit: COMMIT_1,
        recorded_at: "2026-05-01T08:00:00Z",
        versions: SAMPLE_VERSIONS,
        dataset_hash: HASH_1,
      },
      snapshotsDir,
    );
    recordSnapshotTransition(
      {
        snapshot_id: "snap-t1",
        transition: "snapshot.published",
        commit: COMMIT_1,
        recorded_at: "2026-05-01T09:00:00Z",
        versions: SAMPLE_VERSIONS,
        dataset_hash: HASH_1,
      },
      snapshotsDir,
    );
    recordSnapshotTransition(
      {
        snapshot_id: "snap-t2",
        transition: "snapshot.accepted",
        commit: COMMIT_2,
        recorded_at: "2026-05-10T08:00:00Z",
        versions: SAMPLE_VERSIONS,
        dataset_hash: HASH_2,
      },
      snapshotsDir,
    );
    recordSnapshotTransition(
      {
        snapshot_id: "snap-t2",
        transition: "snapshot.published",
        commit: COMMIT_2,
        recorded_at: "2026-05-10T09:00:00Z",
        versions: SAMPLE_VERSIONS,
        dataset_hash: HASH_2,
      },
      snapshotsDir,
    );

    // Private acquired & verified revisions at T1 and T2 (correction)
    recordKnowledgeRevision(
      {
        stage: "acquired",
        collection: "events",
        record_id: "TL-0001",
        recorded_at: "2026-05-01T07:00:00Z",
        record: { id: "TL-0001", title: { it: "Titolo iniziale acquisito" } },
      },
      revisionsDir,
    );
    recordKnowledgeRevision(
      {
        stage: "verified",
        collection: "events",
        record_id: "TL-0001",
        recorded_at: "2026-05-02T10:00:00Z",
        record: { id: "TL-0001", title: { it: "Titolo iniziale verificato" } },
      },
      revisionsDir,
    );
    // Later correction on May 10
    recordKnowledgeRevision(
      {
        stage: "acquired",
        collection: "events",
        record_id: "TL-0001",
        recorded_at: "2026-05-10T07:00:00Z",
        record: { id: "TL-0001", title: { it: "Titolo corretto acquisito" } },
      },
      revisionsDir,
    );
    recordKnowledgeRevision(
      {
        stage: "verified",
        collection: "events",
        record_id: "TL-0001",
        recorded_at: "2026-05-10T11:00:00Z",
        record: { id: "TL-0001", title: { it: "Titolo corretto verificato" } },
      },
      revisionsDir,
    );

    // Canonical at May 5 must NOT see snap-t2
    const canonicalMay5 = resolveAsOf({
      date: "2026-05-05",
      mode: "canonical",
      snapshotsDir,
    });
    expect(canonicalMay5.domain).toBe("public");
    if (canonicalMay5.domain === "public") {
      expect(canonicalMay5.active_snapshot?.snapshot_id).toBe("snap-t1");
      expect(canonicalMay5.snapshots_as_of.map((s) => s.snapshot_id)).toEqual(["snap-t1"]);
    }

    // Published at May 5 must NOT see snap-t2
    const publishedMay5 = resolveAsOf({
      date: "2026-05-05",
      mode: "published",
      snapshotsDir,
    });
    if (publishedMay5.domain === "public") {
      expect(publishedMay5.active_snapshot?.snapshot_id).toBe("snap-t1");
    }

    // Acquired at May 1 must NOT see May 10 correction
    const acquiredMay1 = resolveAsOf({
      date: "2026-05-01",
      mode: "acquired",
      revisionsDir,
    });
    expect(acquiredMay1.domain).toBe("private");
    if (acquiredMay1.domain === "private") {
      expect(acquiredMay1.record_count).toBe(1);
      expect(acquiredMay1.revisions[0]?.record).toEqual({
        id: "TL-0001",
        title: { it: "Titolo iniziale acquisito" },
      });
    }

    // Verified at May 1 is empty (not yet verified until May 2); at May 5 sees initial verified, not May 10
    const verifiedMay1 = resolveAsOf({
      date: "2026-05-01",
      mode: "verified",
      revisionsDir,
    });
    if (verifiedMay1.domain === "private") {
      expect(verifiedMay1.record_count).toBe(0);
    }

    const verifiedMay5 = resolveAsOf({
      date: "2026-05-05",
      mode: "verified",
      revisionsDir,
    });
    if (verifiedMay5.domain === "private") {
      expect(verifiedMay5.record_count).toBe(1);
      expect(verifiedMay5.revisions[0]?.record).toEqual({
        id: "TL-0001",
        title: { it: "Titolo iniziale verificato" },
      });
    }
  });

  it("preserves partial date precision without inventing a day and flags pre-inception reconstructions", () => {
    const dir = makeTempDir("oem-precision-");
    recordSnapshotTransition(
      {
        snapshot_id: "snap-inception",
        transition: "snapshot.accepted",
        commit: COMMIT_1,
        recorded_at: "2026-03-15T12:00:00Z",
        versions: SAMPLE_VERSIONS,
        dataset_hash: HASH_1,
      },
      dir,
    );

    const yearParsed = parseAsofDate("2025");
    expect(yearParsed.input).toBe("2025");
    expect(yearParsed.precision).toBe("year");

    const monthParsed = parseAsofDate("2026-02");
    expect(monthParsed.input).toBe("2026-02");
    expect(monthParsed.precision).toBe("month");

    const beforeInception = resolveAsOf({
      date: "2026-02",
      mode: "canonical",
      snapshotsDir: dir,
    });
    expect(beforeInception.as_of.input).toBe("2026-02");
    expect(beforeInception.as_of.precision).toBe("month");
    expect(beforeInception.retrospective_partial).toBe(true);

    const afterInception = resolveAsOf({
      date: "2026-03",
      mode: "canonical",
      snapshotsDir: dir,
    });
    expect(afterInception.retrospective_partial).toBe(false);
  });

  it("blocks acquired and verified modes on public, portal, and mcp surfaces", () => {
    const revisionsDir = makeTempDir("oem-guard-");
    for (const surface of ["public", "portal", "mcp"] as const) {
      expect(() =>
        resolveAsOf({ date: "2026-05-01", mode: "acquired", revisionsDir, surface }),
      ).toThrow(PrivateDomainAccessError);
      expect(() =>
        resolveAsOf({ date: "2026-05-01", mode: "verified", revisionsDir, surface }),
      ).toThrow(PrivateDomainAccessError);
    }

    process.env.OEM_MCP_PUBLIC = "1";
    expect(() =>
      resolveAsOf({ date: "2026-05-01", mode: "acquired", revisionsDir, surface: "cli" }),
    ).toThrow(PrivateDomainAccessError);
  });
});
