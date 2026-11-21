import { describe, expect, it } from "vitest";
import {
  checkState,
  decidePull,
  mainState,
  type PullFacts,
  parseHandoff,
  pathViolation,
  plan,
  sameInventory,
} from "../src/pipeline/auto-merge.ts";

const A = "a".repeat(40);
const B = "b".repeat(40);
const MAIN = "c".repeat(40);
const ctx = { repo: "o/r", owner: "maint", canUpdate: true };
const ready = (sha: string, extra = "") => ({
  author: "maint",
  createdAt: "2026-11-21T02:00:00Z",
  body: `OEM Task C | Review & Fix\nMain: ${MAIN}\nC-reviewed HEAD: ${sha}\nStatus: READY_FOR_D${extra}`,
});
const source = [
  { path: "sources/incremental/Fonte_20.md", status: "added", blob: "1" },
  { path: "sources/incremental/Fonte_20.proposals.json", status: "added", blob: "2" },
];

const pull = (over: Partial<PullFacts> = {}): PullFacts => ({
  number: 45,
  headRef: "research/osint-1",
  headSha: A,
  headRepo: "o/r",
  baseRef: "main",
  draft: false,
  labels: [],
  mergeableState: "clean",
  comments: [ready(A)],
  commits: [A],
  files: source,
  reviewedFiles: null,
  checks: { check: "success", "evidence-diff": "success" },
  ...over,
});

describe("path policy", () => {
  it("accepts additions of sources and articles on research branches", () => {
    expect(pathViolation("research/x", source)).toBeNull();
  });
  it("rejects control-plane, original sources and unknown branches", () => {
    expect(
      pathViolation("research/x", [{ path: ".github/x.yml", status: "added", blob: "" }]),
    ).toMatch(/outside/);
    expect(
      pathViolation("research/x", [
        { path: "sources/incremental/F.md", status: "modified", blob: "" },
      ]),
    ).toMatch(/outside/);
    expect(
      pathViolation("agent/ingest-fonte-12", [{ path: "src/a.ts", status: "modified", blob: "" }]),
    ).toMatch(/outside/);
    expect(pathViolation("feature/x", source)).toMatch(/not an automated/);
    expect(pathViolation("research/x", [])).toBe("empty diff");
  });
  it("lets ingest change data/ and publish change articles only", () => {
    expect(
      pathViolation("agent/ingest-fonte-12", [
        { path: "data/events/E.json", status: "modified", blob: "" },
      ]),
    ).toBeNull();
    expect(
      pathViolation("agent/publish-ART-0006-x", [
        { path: "content/articles/ART-0006.it.md", status: "modified", blob: "" },
      ]),
    ).toBeNull();
  });
});

describe("Task C handoff", () => {
  it("reads the reviewed HEAD from a clean READY_FOR_D", () => {
    expect(parseHandoff([ready(A)], "maint", [A])).toEqual({ verdict: "ready", reviewedHead: A });
  });
  it("uses only the latest handoff and rejects negative verdicts", () => {
    const blocked = {
      ...ready(A, "\nNOT READY_FOR_D (BLOCKED_EVIDENCE)"),
      createdAt: "2026-11-21T03:00:00Z",
    };
    expect(parseHandoff([ready(A), blocked], "maint", [A]).verdict).toBe("not_ready");
  });
  it("ignores comments by other accounts or without the prefix", () => {
    expect(parseHandoff([{ ...ready(A), author: "someone" }], "maint", [A]).verdict).toBe("none");
    expect(parseHandoff([{ ...ready(A), body: "READY_FOR_D" }], "maint", [A]).verdict).toBe("none");
  });
  it("requires a commit of the PR", () => {
    expect(parseHandoff([ready(B)], "maint", [A]).verdict).toBe("not_ready");
  });
});

describe("decision", () => {
  it("merges a reviewed, green, clean PR", () => {
    expect(decidePull(pull(), ctx).action).toBe("merge");
  });
  it("skips drafts, holds, waivers and foreign heads", () => {
    expect(decidePull(pull({ draft: true }), ctx).action).toBe("skip");
    expect(decidePull(pull({ labels: ["automerge:hold"] }), ctx).action).toBe("skip");
    expect(decidePull(pull({ labels: ["evidence-waiver"] }), ctx).action).toBe("skip");
    expect(decidePull(pull({ headRepo: "fork/r" }), ctx).action).toBe("skip");
  });
  it("waits for checks and for the handoff", () => {
    expect(
      decidePull(pull({ checks: { check: "pending", "evidence-diff": "success" } }), ctx).action,
    ).toBe("wait");
    expect(decidePull(pull({ comments: [] }), ctx).action).toBe("wait");
    expect(
      decidePull(pull({ checks: { check: "failure", "evidence-diff": "success" } }), ctx).action,
    ).toBe("skip");
  });
  it("updates a behind branch only with a token that retriggers checks", () => {
    expect(decidePull(pull({ mergeableState: "behind" }), ctx).action).toBe("update");
    expect(
      decidePull(pull({ mergeableState: "behind" }), { ...ctx, canUpdate: false }).action,
    ).toBe("skip");
  });
  it("accepts a moved HEAD only with an identical file inventory", () => {
    const moved = { headSha: B, commits: [A, B] };
    expect(decidePull(pull({ ...moved, reviewedFiles: source }), ctx).action).toBe("merge");
    const changed = [source[0], { ...source[1], blob: "3" }] as typeof source;
    expect(decidePull(pull({ ...moved, reviewedFiles: changed }), ctx).action).toBe("skip");
    expect(decidePull(pull({ ...moved, reviewedFiles: null }), ctx).action).toBe("skip");
    expect(sameInventory(source, [...source].reverse())).toBe(true);
  });
});

describe("plan", () => {
  it("does nothing while main CI is not green, and dispatches CI when it is missing", () => {
    expect(plan("pending", [pull()], ctx).next).toBeNull();
    expect(plan("failure", [pull()], ctx).next).toBeNull();
    expect(plan("missing", [pull()], ctx).next?.action).toBe("dispatch-ci");
  });
  it("prefers a merge over an update, oldest PR first", () => {
    const result = plan(
      "success",
      [pull({ number: 50 }), pull({ number: 44, mergeableState: "behind" })],
      ctx,
    );
    expect(result.next).toMatchObject({ pr: 50, action: "merge" });
  });
});

describe("run states", () => {
  it("reads main CI from push or dispatch runs", () => {
    const run = (event: string, status: string, conclusion: string | null) => ({
      event,
      status,
      conclusion,
      created_at: "2026-11-21T00:00:00Z",
    });
    expect(mainState([run("workflow_dispatch", "completed", "success")])).toBe("success");
    expect(mainState([run("push", "in_progress", null)])).toBe("pending");
    expect(mainState([run("push", "completed", "failure")])).toBe("failure");
    expect(mainState([run("pull_request", "completed", "success")])).toBe("missing");
  });
  it("takes the latest GitHub Actions check run", () => {
    const cr = (id: number, conclusion: string, slug = "github-actions") => ({
      name: "check",
      status: "completed",
      conclusion,
      id,
      app: { slug },
    });
    expect(checkState([cr(1, "failure"), cr(2, "success")], "check")).toBe("success");
    expect(checkState([cr(3, "success", "other-app")], "check")).toBe("missing");
  });
});
