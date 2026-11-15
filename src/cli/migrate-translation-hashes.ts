import { writeFileSync } from "node:fs";
import path from "node:path";
import { ArticleFrontMatterEn, ArticleFrontMatterIt, COLLECTIONS } from "../model/index.ts";
import {
  ARTICLES_DIR,
  articleSourceHash,
  articleTargetHash,
  readArticleFiles,
  splitFrontMatter,
  validateArticleFiles,
} from "../pipeline/articles.ts";
import { readDataFiles } from "../pipeline/load.ts";
import { DATA_DIR } from "../pipeline/paths.ts";
import { serializeRecord } from "../pipeline/serialize.ts";
import { updateTranslationYaml } from "../pipeline/translation-yaml.ts";
import {
  localizedTexts,
  sourceHash,
  targetHash,
  translationProblem,
} from "../pipeline/translations.ts";
import { validateDataFiles } from "../pipeline/validate.ts";

const args = process.argv.slice(2);
if (args.some((arg) => arg !== "--write"))
  throw new Error("usage: migrate-translation-hashes [--write]");
const plan: { file: string; text: string }[] = [];
for (const file of readDataFiles()) {
  const record = JSON.parse(file.text);
  const state = record.review?.translations?.en;
  if (state) {
    const texts = localizedTexts(record);
    if (
      !texts.length ||
      texts.some((t) => !t.en?.trim()) ||
      state.source_hash !== sourceHash(record)
    )
      throw new Error(`${file.path}: incomplete or stale translation`);
    const hash = targetHash(record);
    if (state.target_hash !== undefined && state.target_hash !== hash)
      throw new Error(`${file.path}: conflicting target_hash`);
    if (state.target_hash === undefined) state.target_hash = hash;
  }
  const parsed = COLLECTIONS[file.collection].parse(record);
  const problem = translationProblem(parsed as never);
  if (problem) throw new Error(`${file.path}: ${problem}`);
  const text = serializeRecord(parsed);
  if (state && JSON.parse(file.text).review.translations.en.target_hash === undefined)
    plan.push({ file: path.join(DATA_DIR, file.path), text });
}
const articles = readArticleFiles();
for (const file of articles.filter((f) => f.path.endsWith(".en.md"))) {
  const id = path.basename(file.path).slice(0, -6);
  const itFile = articles.find((f) => f.path.endsWith(`${id}.it.md`));
  const it = itFile && splitFrontMatter(itFile.text);
  const en = splitFrontMatter(file.text);
  const italian = ArticleFrontMatterIt.parse(it?.data);
  if (!it || !en) throw new Error(`${id}: missing article`);
  const legacy = ArticleFrontMatterEn.extend({
    translation: ArticleFrontMatterEn.shape.translation.extend({
      target_hash: ArticleFrontMatterEn.shape.translation.shape.target_hash.optional(),
    }),
  }).parse(en.data);
  if (
    ![legacy.title, legacy.summary, en.body].every((s) => s.trim()) ||
    legacy.translation.source_hash !== articleSourceHash({ ...italian, body: it.body })
  )
    throw new Error(`${id}: incomplete or stale translation`);
  const hash = articleTargetHash({ ...legacy, body: en.body });
  if (legacy.translation.target_hash !== undefined && legacy.translation.target_hash !== hash)
    throw new Error(`${id}: conflicting target_hash`);
  if (legacy.translation.target_hash === undefined) {
    const text = updateTranslationYaml(file.text, { target_hash: hash });
    ArticleFrontMatterEn.parse(splitFrontMatter(text)?.data);
    plan.push({ file: path.join(ARTICLES_DIR, path.basename(file.path)), text });
  }
}
const planned = new Map(plan.map((item) => [item.file, item.text]));
const dataResult = validateDataFiles(
  readDataFiles().map((file) => ({
    ...file,
    text: planned.get(path.join(DATA_DIR, file.path)) ?? file.text,
  })),
);
const articleResult = validateArticleFiles(
  articles.map((file) => ({
    ...file,
    text: planned.get(path.join(ARTICLES_DIR, path.basename(file.path))) ?? file.text,
  })),
  dataResult.dataset,
);
const errors = [...dataResult.issues, ...articleResult.issues].filter(
  (issue) => issue.severity === "error",
);
if (errors.length)
  throw new Error(
    `preflight failed:\n${errors.map((issue) => `${issue.file}: ${issue.message}`).join("\n")}`,
  );
console.log(
  `${plan.length} file(s) planned${args.includes("--write") ? " for writing" : " (dry run)"}`,
);
if (args.includes("--write")) for (const item of plan) writeFileSync(item.file, item.text);
