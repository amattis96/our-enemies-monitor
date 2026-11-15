import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { collectChanges, mergeBase, type PathChange, parseRawZ } from "../src/pipeline/changes.ts";
import {
  branchClass,
  checkGlobal,
  checkPolicy,
  controlPlaneFlags,
  isControlPlane,
  type LabelEvent,
  pushLowerBound,
  type RunInfo,
  WAIVER_LABEL,
  waiverStatus,
} from "../src/pipeline/policy.ts";

const change = (status: PathChange["status"], file: string, mode = "100644"): PathChange => ({
  status,
  path: file,
  mode,
});
const errorPaths = (ref: string, changes: PathChange[]) =>
  checkPolicy(ref, changes).map((f) => f.id);

describe("branch path policy (R4)", () => {
  it("confines research/* to sources/incremental, sources/thematic and content/articles", () => {
    for (const bad of [
      "data/entities/RU.json",
      "src/pipeline/diff.ts",
      ".github/workflows/ci.yml",
      "docs/ARCHITECTURE.md",
      "schemas/proposals.schema.json",
      "package.json",
      "sources/original/Fonte_01.md",
    ]) {
      const flags = checkPolicy("research/x", [change("M", bad)]);
      expect(flags.map((f) => f.id)).toContain(bad);
      expect(flags.every((f) => f.severity === "error" && f.waivable === false)).toBe(true);
    }
  });

  it("allows the Task A pair and articles on research/*", () => {
    expect(
      checkPolicy("research/2026-11-14", [
        change("A", "sources/incremental/Fonte_12_x.md"),
        change("A", "sources/incremental/Fonte_12.proposals.json"),
        change("A", "sources/thematic/T_01.md"),
        change("M", "content/articles/ART-0003.it.md"),
      ]),
    ).toEqual([]);
  });

  it("refuses edits and deletions of archived sources, and deleted articles", () => {
    expect(errorPaths("research/x", [change("M", "sources/incremental/Fonte_09.md")])).toContain(
      "sources/incremental/Fonte_09.md",
    );
    expect(
      errorPaths("research/x", [change("D", "sources/incremental/Fonte_09.md")]).length,
    ).toBeGreaterThan(0);
    expect(errorPaths("research/x", [change("M", "sources/thematic/T_01.md")])).toContain(
      "sources/thematic/T_01.md",
    );
    expect(errorPaths("research/x", [change("D", "content/articles/ART-0001.it.md")])).toEqual([
      "content/articles/ART-0001.it.md",
    ]);
  });

  it("limits agent/ingest-* to data/ and leaves other agent/** and maintainer branches free", () => {
    expect(
      errorPaths("agent/ingest-fonte-12", [
        change("A", "data/events/TL-9999.json"),
        change("M", "docs/x.md"),
      ]),
    ).toEqual(["docs/x.md"]);
    for (const ref of ["agent/work", "fix/x", "feat/y", "audit/z", "HEAD"]) {
      expect(branchClass(ref)).toBe("free");
      expect(
        checkPolicy(ref, [
          change("M", "src/pipeline/diff.ts"),
          change("M", ".github/workflows/ci.yml"),
        ]),
      ).toEqual([]);
    }
  });

  it("confines dependabot GitHub Actions branches to workflows and dependabot.yml", () => {
    const ref = "dependabot/github_actions/actions/checkout-8";
    expect(
      checkPolicy(ref, [
        change("M", ".github/workflows/ci.yml"),
        change("M", ".github/dependabot.yml"),
      ]),
    ).toEqual([]);
    expect(errorPaths(ref, [change("M", "src/x.ts")])).toEqual(["src/x.ts"]);
  });

  it("never allows changes to sources/original or existing sources/incremental, on any branch", () => {
    for (const ref of ["research/x", "fix/x", "agent/work", "agent/ingest-fonte-12"]) {
      expect(errorPaths(ref, [change("M", "sources/original/Fonte_01.md")])).toContain(
        "sources/original/Fonte_01.md",
      );
      expect(errorPaths(ref, [change("D", "sources/incremental/Fonte_09.md")])).toContain(
        "sources/incremental/Fonte_09.md",
      );
    }
    expect(checkGlobal([change("A", "sources/incremental/Fonte_20.md")])).toEqual([]);
    expect(checkGlobal([change("A", "sources/original/new.md")])).toHaveLength(1);
  });

  it("refuses symbolic links and submodules, and escaping paths", () => {
    expect(checkGlobal([change("A", "content/articles/ART-0009.it.md", "120000")])).toHaveLength(1);
    expect(checkGlobal([change("A", "vendor/x", "160000")])).toHaveLength(1);
    expect(checkGlobal([change("D", "content/articles/x.md", "000000")])).toEqual([]);
    expect(checkGlobal([change("A", "../x")])).toHaveLength(1);
  });
});

describe("control-plane tripwire (final hardening)", () => {
  // controlPlaneFlags takes no branch name: renaming the branch cannot avoid it.
  it("flags a change to the checks, whatever the branch", () => {
    const changes = [
      change("M", ".github/workflows/evidence-diff.yml"),
      change("M", "src/pipeline/policy.ts"),
      change("M", "src/cli/check-article-review.ts"),
      change("M", "src/pipeline/article-review.ts"),
      change("M", "src/site/publication.ts"),
      change("M", "package.json"),
      change("A", ".github/CODEOWNERS"),
    ];
    expect(controlPlaneFlags(changes).map((f) => [f.severity, f.id])).toEqual(
      changes.map((c) => ["attention", c.path]),
    );
  });

  it("a research agent renaming its branch escapes the path policy but not the tripwire", () => {
    const attack = [change("M", "src/pipeline/policy.ts"), change("A", "sources/thematic/T_99.md")];
    expect(errorPaths("research/x", attack)).toContain("src/pipeline/policy.ts");
    expect(errorPaths("docs/x", attack)).toEqual([]); // the prefix is not an identity
    expect(controlPlaneFlags(attack).map((f) => f.id)).toEqual(["src/pipeline/policy.ts"]);
  });

  it("never blocks: data, docs and articles changes raise nothing, and flags are attention only", () => {
    expect(
      controlPlaneFlags([
        change("M", "data/events/TL-0001.json"),
        change("M", "docs/ARCHITECTURE.md"),
        change("A", "content/articles/ART-0099.it.md"),
        change("M", "src/site/trace.ts"),
      ]),
    ).toEqual([]);
    expect(isControlPlane("src/cli/validate-articles.ts")).toBe(true);
    expect(controlPlaneFlags([change("D", ".github/workflows/ci.yml")])[0]?.severity).toBe(
      "attention",
    );
  });
});

describe("maintainer waiver (R3)", () => {
  const OWNER = "amattis96";
  const event = (name: string, actor: string, at: string): LabelEvent => ({
    event: name,
    label: WAIVER_LABEL,
    actor,
    createdAt: at,
  });
  const base = {
    labels: [WAIVER_LABEL],
    owner: OWNER,
    action: "labeled",
    pushedAt: "2026-11-14T10:00:00Z",
  };

  it("is valid when the owner applied the label after the head commit", () => {
    expect(
      waiverStatus({ ...base, events: [event("labeled", OWNER, "2026-11-14T10:05:00Z")] }).valid,
    ).toBe(true);
  });

  it("ignores a label applied by another login, with the reason", () => {
    const status = waiverStatus({
      ...base,
      events: [event("labeled", "machine-bot", "2026-11-14T10:05:00Z")],
    });
    expect(status.valid).toBe(false);
    expect(status.reason).toContain("machine-bot");
  });

  it("ignores a label removed and reapplied by someone else, or with no matching event", () => {
    expect(
      waiverStatus({
        ...base,
        events: [
          event("labeled", OWNER, "2026-11-14T10:05:00Z"),
          event("unlabeled", OWNER, "2026-11-14T10:06:00Z"),
          event("labeled", "machine-bot", "2026-11-14T10:07:00Z"),
        ],
      }).valid,
    ).toBe(false);
    expect(waiverStatus({ ...base, events: [] }).valid).toBe(false);
    expect(
      waiverStatus({
        ...base,
        labels: [],
        events: [event("labeled", OWNER, "2026-11-14T10:05:00Z")],
      }).valid,
    ).toBe(false);
  });

  it("expires on a push: synchronize runs and labels older than the head commit are ignored", () => {
    const events = [event("labeled", OWNER, "2026-11-14T10:05:00Z")];
    expect(waiverStatus({ ...base, action: "synchronize", events }).valid).toBe(false);
    expect(waiverStatus({ ...base, pushedAt: "2026-11-14T10:30:00Z", events }).valid).toBe(false);
    expect(waiverStatus({ ...base, pushedAt: null, events }).valid).toBe(false);
  });
});

describe("waiver freshness (push date of the head commit)", () => {
  const CI = ".github/workflows/ci.yml@refs/pull/7/merge";
  const run = (
    createdAt: string,
    pullRequests: number[],
    over: Partial<RunInfo> = {},
  ): RunInfo => ({
    event: "pull_request",
    path: CI,
    createdAt,
    pullRequests,
    ...over,
  });
  const ctx = (pushedAt: string | null, labeledAt: string) => ({
    labels: [WAIVER_LABEL],
    owner: "amattis96",
    action: "labeled",
    pushedAt,
    events: [{ event: "labeled", label: WAIVER_LABEL, actor: "amattis96", createdAt: labeledAt }],
  });

  it("uses the latest run of this PR, so a force push back to an old SHA expires the waiver", () => {
    // day 1: SHA pushed; day 2: label applied on a different SHA; day 3: force push back to the day-1 SHA
    const runs = [run("2026-11-01T10:00:00Z", [7]), run("2026-11-03T10:00:00Z", [7])];
    const bound = pushLowerBound(runs, 7, "2026-11-01T09:00:00Z");
    expect(bound).toBe("2026-11-03T10:00:00Z");
    expect(waiverStatus(ctx(bound, "2026-11-02T10:00:00Z")).valid).toBe(false);
    expect(waiverStatus(ctx(bound, "2026-11-04T10:00:00Z")).valid).toBe(true);
  });

  it("ignores runs of the same SHA in another pull request", () => {
    const runs = [run("2026-11-05T10:00:00Z", [9]), run("2026-11-01T10:00:00Z", [7])];
    expect(pushLowerBound(runs, 7, null)).toBe("2026-11-01T10:00:00Z");
    expect(pushLowerBound([run("2026-11-05T10:00:00Z", [9])], 7, null)).toBeNull();
    expect(
      waiverStatus(
        ctx(pushLowerBound([run("2026-11-05T10:00:00Z", [9])], 7, null), "2026-11-06T10:00:00Z"),
      ).valid,
    ).toBe(false);
  });

  it("ignores runs of other events and workflows, and never goes below the commit date", () => {
    const runs = [
      run("2026-11-01T10:00:00Z", [7], { event: "push" }),
      run("2026-11-01T11:00:00Z", [7], {
        path: ".github/workflows/evidence-diff.yml@refs/pull/7/merge",
      }),
    ];
    expect(pushLowerBound(runs, 7, null)).toBeNull();
    expect(pushLowerBound([run("2026-11-01T10:00:00Z", [7])], 7, "2026-11-02T08:00:00Z")).toBe(
      "2026-11-02T08:00:00Z",
    );
  });

  it("treats a login other than MAINTAINER_LOGIN as not the maintainer", () => {
    const status = waiverStatus({
      ...ctx("2026-11-01T00:00:00Z", "2026-11-02T00:00:00Z"),
      owner: "someone-else",
    });
    expect(status.valid).toBe(false);
    expect(status.reason).toContain("someone-else");
  });
});

describe("collecting changes from Git (difetti 1.3)", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "oem-changes-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));
  const git = (...args: string[]) =>
    execFileSync(
      "git",
      [
        "-c",
        "user.name=t",
        "-c",
        "user.email=t@example.org",
        "-c",
        "commit.gpgsign=false",
        ...args,
      ],
      { cwd: dir, encoding: "utf8" },
    );
  const write = (file: string, text: string) => {
    mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    writeFileSync(path.join(dir, file), text);
  };

  it("parses raw -z output", () => {
    expect(
      parseRawZ(":100644 100644 aaa bbb M\0data/a.json\0:000000 100644 000 ccc A\0new file.md\0"),
    ).toEqual([
      { status: "M", path: "data/a.json", mode: "100644" },
      { status: "A", path: "new file.md", mode: "100644" },
    ]);
  });

  it("reports a rename out of data/ as deletion plus addition, anchored at the merge base", () => {
    git("init", "-q", "-b", "main");
    write("data/entities/RU.json", '{"id":"RU"}\n');
    write("README.md", "one\n");
    git("add", ".");
    git("commit", "-q", "-m", "base");
    git("checkout", "-q", "-b", "pr");
    git("mv", "data/entities/RU.json", "docs-RU.json");
    git("commit", "-q", "-am", "move");
    git("checkout", "-q", "main");
    write("main-only.md", "landed on main later\n");
    git("add", ".");
    git("commit", "-q", "-m", "main advances");
    git("checkout", "-q", "pr");
    symlinkSync("README.md", path.join(dir, "link.md"));

    const anchor = mergeBase(dir, "main");
    const changes = collectChanges(dir, anchor);
    const summary = changes.map((c) => `${c.status} ${c.path}`).sort();
    expect(summary).toEqual(["A docs-RU.json", "A link.md", "D data/entities/RU.json"]);
    expect(changes.find((c) => c.path === "link.md")?.mode).toBe("120000");
    // Comparing with the tip of main instead would attribute main's own commit to the PR.
    expect(collectChanges(dir, "main").map((c) => c.path)).toContain("main-only.md");
    expect(summary.join()).not.toContain("main-only.md");
  });

  it("fails closed when the base cannot be resolved", () => {
    expect(() => mergeBase(dir, "origin/does-not-exist")).toThrow();
  });
});
