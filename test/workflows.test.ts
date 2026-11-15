import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { REPO_ROOT } from "../src/pipeline/paths.ts";

// Contract of the GitHub workflows. The job names are the status check
// contexts the main ruleset requires: renaming one silently blocks every PR.

const dir = path.join(REPO_ROOT, ".github/workflows");
const names = readdirSync(dir).filter((f) => /\.ya?ml$/.test(f));
const read = (file: string) => readFileSync(path.join(dir, file), "utf8");
type Workflow = {
  permissions?: Record<string, string>;
  on: {
    pull_request?: { types?: string[]; paths?: unknown; "paths-ignore"?: unknown };
    push?: Record<string, unknown>;
  };
  concurrency?: { group: string; "cancel-in-progress": boolean | string };
  jobs: Record<
    string,
    {
      name?: string;
      if?: string;
      permissions?: Record<string, string>;
      concurrency?: { group: string; "cancel-in-progress": boolean };
      steps?: Array<Record<string, unknown>>;
    }
  >;
};
const workflow = (file: string) => parse(read(file)) as Workflow;

describe("workflow contract", () => {
  it("names the required checks explicitly", () => {
    const ci = workflow("ci.yml");
    const evidence = workflow("evidence-diff.yml");
    expect(ci.jobs.check?.name).toBe("check");
    expect(evidence.jobs["evidence-diff"]?.name).toBe("evidence-diff");
    const all = names.flatMap((f) =>
      Object.entries(workflow(f).jobs).map(([id, j]) => j.name ?? id),
    );
    expect(all.filter((n) => n === "check")).toHaveLength(1);
    expect(all.filter((n) => n === "evidence-diff")).toHaveLength(1);
  });

  it("runs evidence-diff on every pull request, re-running on label changes, with no path filters", () => {
    const evidence = workflow("evidence-diff.yml");
    expect(evidence.on.pull_request?.types).toEqual(
      expect.arrayContaining(["opened", "synchronize", "reopened", "labeled", "unlabeled"]),
    );
    for (const file of names) {
      const on = workflow(file).on;
      expect(on.pull_request?.paths).toBeUndefined();
      expect(on.pull_request?.["paths-ignore"]).toBeUndefined();
    }
    expect(evidence.jobs["evidence-diff"]?.if).toBeUndefined();
    expect(workflow("ci.yml").jobs.check?.if).toBeUndefined();
  });

  it("does not trigger the full CI on label events", () => {
    expect(workflow("ci.yml").on.pull_request?.types).toBeUndefined();
  });

  it("cancels superseded pull request runs but never a run on main (R15)", () => {
    const { concurrency } = workflow("ci.yml");
    expect(concurrency?.group).toContain("github.event.pull_request.number");
    expect(concurrency?.group).toContain("github.sha");
    expect(String(concurrency?.["cancel-in-progress"])).toBe(
      "${{ github.event_name == 'pull_request' }}",
    );
    expect(workflow("evidence-diff.yml").concurrency?.group).toContain("pull_request.number");
  });

  it("deploys only the tip of main, in a serialized pages-deploy group", () => {
    const deploy = workflow("ci.yml").jobs.deploy;
    expect(deploy?.concurrency).toEqual({ group: "pages-deploy", "cancel-in-progress": false });
    expect(read("ci.yml")).toContain("repos/$REPO/commits/main");
  });

  it("does not use pull_request_target", () => {
    for (const file of names) expect(read(file)).not.toContain("pull_request_target");
  });

  it("never interpolates ${{ }} into a run script: context values reach scripts through env", () => {
    // Prefer zero. Add an entry only for a value that is not attacker-controlled
    // and cannot be passed through env.
    const allowed: string[] = [];
    let scripts = 0;
    for (const file of names) {
      for (const job of Object.values(workflow(file).jobs)) {
        for (const step of job.steps ?? []) {
          if (typeof step.run !== "string") continue;
          scripts += 1;
          const expressions = step.run.match(/\$\{\{[^}]*\}\}/g) ?? [];
          for (const expression of expressions) {
            expect(allowed, `${file}: ${expression}`).toContain(expression);
          }
        }
      }
    }
    expect(scripts).toBeGreaterThan(5);
  });

  it("gives write scopes only to jobs that run no repository code", () => {
    const writes = (permissions: unknown) =>
      Object.values((permissions ?? {}) as Record<string, string>).includes("write");
    for (const file of names) {
      const wf = workflow(file);
      expect(writes(wf.permissions), `${file}: workflow-level write`).toBe(false);
      for (const [id, job] of Object.entries(wf.jobs)) {
        const steps = job.steps ?? [];
        const runsRepoCode = steps.some(
          (s) =>
            String(s.uses ?? "").startsWith("actions/checkout") ||
            /\bpnpm\b/.test(String(s.run ?? "")),
        );
        if (runsRepoCode) expect(writes(job.permissions), `${file}:${id} runs PR code`).toBe(false);
      }
    }
    const expire = workflow("evidence-diff.yml").jobs["expire-waiver"];
    expect(expire?.permissions).toEqual({ issues: "write" });
    expect(JSON.stringify(expire?.steps)).not.toMatch(/checkout|pnpm|setup-node/);
    expect(String(expire?.if)).toContain("synchronize");
    expect(String(expire?.if)).toContain("github.event_name == 'pull_request'");
    expect(String(expire?.if)).toContain(
      "contains(github.event.pull_request.labels.*.name, 'evidence-waiver')",
    );
    expect(JSON.stringify(expire?.steps)).toContain("HTTP 404");
  });

  it("lets the maintainer login be overridden by a repository variable", () => {
    expect(read("evidence-diff.yml")).toContain("vars.MAINTAINER_LOGIN || github.repository_owner");
  });

  it("keeps the article reviewer list separate from the waiver identity", () => {
    const wf = workflow("evidence-diff.yml");
    const steps = wf.jobs["evidence-diff"]?.steps as {
      name?: string;
      env?: Record<string, string>;
    }[];
    const step = (name: string) => steps.find((s) => s.name === name)?.env ?? {};
    const review = step("Editorial approval");
    expect(review.REVIEWERS).toContain("vars.ARTICLE_REVIEWERS");
    expect(review.REVIEWERS).toContain("github.repository_owner");
    expect(review.OWNER).toBeUndefined();
    expect(JSON.stringify(step("Maintainer waiver"))).not.toContain("ARTICLE_REVIEWERS");
    expect(JSON.stringify(step("Evidence diff"))).not.toContain("ARTICLE_REVIEWERS");
  });

  it("pins every action to a full commit SHA with a version comment", () => {
    for (const file of names) {
      const uses = read(file)
        .split("\n")
        .filter((l) => /^\s*-?\s*uses:/.test(l));
      expect(uses.length).toBeGreaterThan(0);
      for (const line of uses) {
        expect(line).toMatch(/uses:\s+[\w.-]+\/[\w.-]+@[0-9a-f]{40}\s+# v\d+\.\d+\.\d+\s*$/);
      }
    }
  });

  it("keeps Dependabot for GitHub Actions", () => {
    const config = parse(readFileSync(path.join(REPO_ROOT, ".github/dependabot.yml"), "utf8")) as {
      updates: Array<{ "package-ecosystem": string }>;
    };
    expect(config.updates.map((u) => u["package-ecosystem"])).toContain("github-actions");
  });
});
