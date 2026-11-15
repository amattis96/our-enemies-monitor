import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ArticleFrontMatterEn, ArticleFrontMatterIt } from "../model/index.ts";
import {
  ARTICLES_DIR,
  articleSourceHash,
  articleTargetHash,
  splitFrontMatter,
} from "../pipeline/articles.ts";
import { updateTranslationYaml } from "../pipeline/translation-yaml.ts";

const args = process.argv.slice(2);
const write = args.includes("--write");
const ids = args.filter((arg) => arg !== "--write");
if (args.some((arg) => arg.startsWith("--") && arg !== "--write") || (write && !ids.length))
  throw new Error("usage: articles:hash [--write ID ...] [ID ...]");
const available = readdirSync(ARTICLES_DIR)
  .filter((n) => n.endsWith(".en.md"))
  .map((n) => n.slice(0, -6))
  .sort();
const selected = ids.length ? [...new Set(ids)] : available;
const plan: { file: string; text: string }[] = [];
for (const id of selected) {
  if (!available.includes(id)) throw new Error(`${id}: article not found`);
  const it = splitFrontMatter(readFileSync(path.join(ARTICLES_DIR, `${id}.it.md`), "utf8"));
  const file = path.join(ARTICLES_DIR, `${id}.en.md`);
  const original = readFileSync(file, "utf8");
  const en = splitFrontMatter(original);
  const italian = ArticleFrontMatterIt.parse(it?.data);
  const english = ArticleFrontMatterEn.parse(en?.data);
  if (!it || !en) throw new Error(`${id}: invalid front matter`);
  const source = articleSourceHash({ ...italian, body: it.body });
  const target = articleTargetHash({ ...english, body: en.body });
  const stale =
    source !== english.translation.source_hash || target !== english.translation.target_hash;
  if (write && stale && english.translation.status === "reviewed")
    throw new Error(`${id}: stale reviewed translation requires human review`);
  if (write && stale) {
    const text = updateTranslationYaml(original, { source_hash: source, target_hash: target });
    ArticleFrontMatterEn.parse(splitFrontMatter(text)?.data);
    plan.push({ file, text });
  }
  console.log(`${id} source_hash=${source} target_hash=${target}${stale ? " (stale)" : ""}`);
}
for (const item of plan) writeFileSync(item.file, item.text);
