import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ArticleFrontMatterIt } from "../model/index.ts";
import { ARTICLES_DIR, articleSourceHash, splitFrontMatter } from "../pipeline/articles.ts";
import { repoPath } from "../pipeline/paths.ts";

// Print the Italian source hash of every article that has an English file.
// With --write, set `translation.source_hash` in each `<ID>.en.md` to it
// (after a human or AI has re-translated the changed Italian text).
const write = process.argv.includes("--write");

for (const name of readdirSync(ARTICLES_DIR)
  .filter((n) => n.endsWith(".en.md"))
  .sort()) {
  const id = name.slice(0, -".en.md".length);
  const italian = splitFrontMatter(readFileSync(path.join(ARTICLES_DIR, `${id}.it.md`), "utf8"));
  const front = ArticleFrontMatterIt.safeParse(italian?.data);
  if (!italian || !front.success) {
    console.error(`${id}: invalid or missing ${id}.it.md (run pnpm validate:articles)`);
    process.exitCode = 1;
    continue;
  }
  const hash = articleSourceHash({ ...front.data, body: italian.body });
  const file = repoPath(`content/articles/${name}`);
  const text = readFileSync(file, "utf8");
  const updated = text.replace(/^(\s+source_hash:\s*)"?[0-9a-z]*"?\s*$/m, `$1"${hash}"`);
  if (write && updated !== text) writeFileSync(file, updated);
  console.log(`${id} ${hash}${updated === text ? "" : write ? " (written)" : " (stale)"}`);
}
