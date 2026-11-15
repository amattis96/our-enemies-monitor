import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const dir = mkdtempSync(path.join(os.tmpdir(), "article-review-"));
const script = path.resolve("src/cli/check-article-review.ts");
const git = (...args: string[]) => execFileSync("git", args, { cwd: dir, encoding: "utf8" }).trim();
let base: string;
let head: string;
const run = (mode: string, sha = head) =>
  spawnSync(process.execPath, [script], {
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${dir}/bin:${process.env.PATH}`,
      OEM_REPO_ROOT: dir,
      REPO: "test/repo",
      PR_NUMBER: "1",
      HEAD_SHA: sha,
      REVIEWERS: "someone, owner",
      BASE_REF: "main",
      TEST_MODE: mode,
      COUNTER: `${dir}/counter`,
    },
  });
beforeAll(() => {
  mkdirSync(`${dir}/content/articles`, { recursive: true });
  mkdirSync(`${dir}/bin`);
  execFileSync("git", ["init", "-q", dir]);
  git("config", "user.name", "Test");
  git("config", "user.email", "test@example.org");
  writeFileSync(`${dir}/readme`, "base");
  git("add", ".");
  git("commit", "-qm", "base");
  base = git("rev-parse", "HEAD");
  git("update-ref", "refs/remotes/origin/main", base);
  const original = readFileSync("content/articles/ART-0002.it.md", "utf8");
  writeFileSync(`${dir}/content/articles/ART-0002.it.md`, original);
  git("add", ".");
  git("commit", "-qm", "article");
  head = git("rev-parse", "HEAD");
  writeFileSync(
    `${dir}/bin/gh`,
    `#!/usr/bin/env node
const fs = require('fs');
const endpoint = process.argv[3];
const mode = process.env.TEST_MODE;
if (mode === 'api-error') process.exit(1);
if (!endpoint.includes('/reviews?')) {
 let count = 0; try { count = Number(fs.readFileSync(process.env.COUNTER)); } catch {}
 fs.writeFileSync(process.env.COUNTER, String(count + 1));
 console.log(JSON.stringify({head:{sha: mode === 'head-change' && count > 0 ? 'b'.repeat(40) : process.env.HEAD_SHA}, user:{login:'agent-bot',type:'Bot'}}));
} else {
 const review = {id:1,html_url:'https://github.com/t/r/reviews/1',state:'APPROVED',commit_id:process.env.HEAD_SHA,submitted_at:'2026-11-15T10:00:00Z',body:'Publication-Approval: ART-0002',user:{login:'owner',type:'User'}};
 const page = endpoint.includes('page=2');
 if (mode === 'malformed') console.log('{}');
 else if (mode === 'pagination') console.log(JSON.stringify(page ? [review] : Array.from({length:100}, (_, i) => ({...review,id:i+2,state:'COMMENTED'}))));
 else console.log(JSON.stringify([review]));
}
`,
  );
  chmodSync(`${dir}/bin/gh`, 0o755);
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));
describe("article review CLI with read-only API stub", () => {
  it("accepts bot-authored PR with a human approval, including the second review page", () => {
    expect(run("pagination").status).toBe(0);
  });
  it("fails closed on API errors, malformed pages and a changed HEAD", () => {
    for (const mode of ["api-error", "malformed", "head-change"]) {
      rmSync(`${dir}/counter`, { force: true });
      expect(run(mode).status).toBe(1);
    }
  });
  it("accepts a bot-authored PR without article changes", () => {
    git("checkout", "-q", base);
    rmSync(`${dir}/counter`, { force: true });
    expect(run("normal", base).status).toBe(0);
    git("checkout", "-q", head);
  });
});
