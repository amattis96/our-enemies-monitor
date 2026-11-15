import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { COLLECTION_NAMES, type CollectionName } from "../model/index.ts";
import { articleIdOf, diffArticles } from "../pipeline/article-diff.ts";
import type { ArticleFile } from "../pipeline/articles.ts";
import { collectChanges, git, mergeBase, showAt } from "../pipeline/changes.ts";
import { diffData, diffMarkdown, type Flag, relaxFlags } from "../pipeline/diff.ts";
import { type DataFile, readDataFiles } from "../pipeline/load.ts";
import { REPO_ROOT } from "../pipeline/paths.ts";
import { checkPolicy, controlPlaneFlags } from "../pipeline/policy.ts";

// Evidence diff of a branch against its merge base with a Git ref.
//
//   pnpm data:diff [--base <ref>] [--branch <head_ref>] [--relaxed [--waived-by <login>]]
//                  [--out <file.md>]
//
// Strict on every branch: changes an agent must never make are errors (exit 1),
// plus the path policy of the branch prefix (src/pipeline/policy.ts), immutable
// sources and symbolic links. --relaxed (maintainer waiver label) lowers only
// the waivable errors. Exit 2: Git could not produce the diff (fail closed).
// The Markdown report is printed, written to --out and appended to
// $GITHUB_STEP_SUMMARY when set. --agent is a deprecated no-op (strict is the default).

const args = process.argv.slice(2);
const option = (name: string) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const base = option("--base") ?? "origin/main";
const relaxed = args.includes("--relaxed");
const waivedBy = option("--waived-by");
const out = option("--out");
if (args.includes("--agent")) {
  process.stderr.write("warning: --agent is deprecated; strict rules are now the default.\n");
}

function run(): { markdown: string; failed: boolean } {
  const anchor = mergeBase(REPO_ROOT, base);
  const branch = option("--branch") ?? git(REPO_ROOT, "rev-parse", "--abbrev-ref", "HEAD").trim();
  const changes = collectChanges(REPO_ROOT, anchor);
  const touched = [...new Set(changes.map((c) => c.path))];

  const dataPaths = touched.filter((p) => /^data\/[a-z]+\/[^/]+\.json$/.test(p));
  const collectionOf = (file: string) => file.split("/")[1] as CollectionName;
  const before: DataFile[] = dataPaths.flatMap((file) => {
    const text = showAt(REPO_ROOT, anchor, file);
    return text === null || !COLLECTION_NAMES.includes(collectionOf(file))
      ? []
      : [{ collection: collectionOf(file), path: file.slice(5), text }];
  });
  const current = new Map(readDataFiles().map((f) => [f.path, f]));
  const after = dataPaths.flatMap((file) => current.get(file.slice(5)) ?? []);
  const persons = new Set(
    [...current.values()]
      .filter((f) => f.collection === "entities" && JSON.parse(f.text).kind === "person")
      .map((f) => JSON.parse(f.text).id as string),
  );
  const reviewedRecords = new Set(
    [...current.values()].flatMap((f) => {
      const record = JSON.parse(f.text);
      return record.review?.status === "reviewed" ? [record.id as string] : [];
    }),
  );
  const report = diffData(before, after, { persons });

  const articleIds = [...new Set(touched.flatMap((p) => articleIdOf(p) ?? []))];
  const articleFiles = (read: (file: string) => string | null): ArticleFile[] =>
    articleIds.flatMap((id) =>
      ["it", "en"].flatMap((lang) => {
        const file = `content/articles/${id}.${lang}.md`;
        const text = read(file);
        return text === null ? [] : [{ path: file, text }];
      }),
    );
  const worktree = (file: string) => {
    try {
      return readFileSync(path.join(REPO_ROOT, file), "utf8");
    } catch {
      return null;
    }
  };
  const flags: Flag[] = [
    ...checkPolicy(branch, changes),
    ...controlPlaneFlags(changes),
    ...report.flags,
    ...diffArticles(
      articleFiles((file) => showAt(REPO_ROOT, anchor, file)),
      articleFiles(worktree),
      { reviewedRecords },
    ),
  ];
  report.flags = relaxed ? relaxFlags(flags) : flags;

  const markdown = diffMarkdown(
    report,
    `Evidence diff against \`${base}\` (merge base \`${anchor.slice(0, 9)}\`, branch \`${branch}\`)${
      relaxed ? ` — maintainer waiver${waivedBy ? ` by ${waivedBy}` : ""}` : ""
    }`,
  );
  return { markdown, failed: report.flags.some((f) => f.severity === "error") };
}

try {
  const { markdown, failed } = run();
  process.stdout.write(markdown);
  if (out) writeFileSync(out, markdown);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
  process.exit(failed ? 1 : 0);
} catch (cause) {
  process.stderr.write(`data:diff could not compute the diff: ${(cause as Error).message}\n`);
  process.exit(2);
}
