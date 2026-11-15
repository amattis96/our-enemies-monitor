import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { articleIdOf, requiredArticleApprovals } from "../pipeline/article-diff.ts";
import { checkArticleReview } from "../pipeline/article-review.ts";
import type { ArticleFile } from "../pipeline/articles.ts";
import { collectChanges, git, mergeBase, showAt } from "../pipeline/changes.ts";
import { REPO_ROOT } from "../pipeline/paths.ts";

try {
  const { REPO, PR_NUMBER, HEAD_SHA, REVIEWERS, BASE_REF } = process.env;
  if (
    !REPO ||
    !/^[\w.-]+\/[\w.-]+$/.test(REPO) ||
    !PR_NUMBER ||
    !/^\d+$/.test(PR_NUMBER) ||
    !HEAD_SHA ||
    !REVIEWERS ||
    !BASE_REF ||
    !/^[a-f0-9]{40}$/i.test(HEAD_SHA)
  )
    throw new Error("Missing or invalid CI environment");
  // Comma-separated GitHub logins; malformed or empty entries fail closed.
  const reviewers = REVIEWERS.split(",").map((r) => r.trim());
  if (!reviewers.every((r) => /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(r)))
    throw new Error("Invalid reviewer list");
  const api = (endpoint: string): unknown =>
    JSON.parse(
      execFileSync("gh", ["api", endpoint], {
        encoding: "utf8",
        maxBuffer: 8 * 1024 * 1024,
        stdio: ["ignore", "pipe", "pipe"],
      }),
    );
  const pr = () => {
    const v = api(`repos/${REPO}/pulls/${PR_NUMBER}`) as {
      head?: { sha?: unknown };
      user?: { login?: unknown; type?: unknown };
    };
    if (
      !v ||
      v.head?.sha !== HEAD_SHA ||
      typeof v.user?.login !== "string" ||
      !["User", "Bot"].includes(String(v.user.type))
    )
      throw new Error("PR HEAD changed or PR identity malformed");
    return v.user.login;
  };
  const author = pr();
  if (git(REPO_ROOT, "rev-parse", "HEAD").trim() !== HEAD_SHA)
    throw new Error("Checkout is not the expected HEAD");
  const anchor = mergeBase(REPO_ROOT, `origin/${BASE_REF}`);
  const ids = [
    ...new Set(collectChanges(REPO_ROOT, anchor).flatMap((c) => articleIdOf(c.path) ?? [])),
  ];
  const files = (read: (file: string) => string | null): ArticleFile[] =>
    ids.flatMap((id) =>
      ["it", "en"].flatMap((lang) => {
        const file = `content/articles/${id}.${lang}.md`;
        const text = read(file);
        return text === null ? [] : [{ path: file, text }];
      }),
    );
  const requirements = requiredArticleApprovals(
    files((file) => showAt(REPO_ROOT, anchor, file)),
    files((file) => {
      try {
        return readFileSync(path.join(REPO_ROOT, file), "utf8");
      } catch {
        return null;
      }
    }),
  );
  const reviews: unknown[] = [];
  for (let page = 1; ; page++) {
    if (page > 100) throw new Error("Review pagination limit exceeded");
    const batch = api(`repos/${REPO}/pulls/${PR_NUMBER}/reviews?per_page=100&page=${page}`);
    if (!Array.isArray(batch) || batch.length > 100) throw new Error("Malformed reviews page");
    reviews.push(...batch);
    if (batch.length < 100) break;
  }
  const result = checkArticleReview(requirements, reviews, reviewers, author, HEAD_SHA);
  if (pr() !== author) throw new Error("PR author changed during review check");
  console.log(result);
} catch (cause) {
  console.error(`Article review check failed: ${(cause as Error).message}`);
  process.exitCode = 1;
}
