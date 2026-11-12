import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import type { z } from "zod";
import {
  Article,
  ArticleFrontMatterEn,
  ArticleFrontMatterIt,
  type Dataset,
  FIXTURE_ARTICLE_ID,
  FIXTURE_TITLE_PREFIX,
} from "../model/index.ts";
import { repoPath } from "./paths.ts";
import { sourceHash, translationProblem } from "./translations.ts";
import type { Issue } from "./validate.ts";

/**
 * Editorial articles live in `content/articles/` as `<ID>.it.md` (canonical)
 * and an optional `<ID>.en.md` translation, each with YAML front matter.
 * Loading and validation never throw for content problems: every issue is
 * reported so one run lists everything.
 */
export const ARTICLES_DIR = repoPath("content/articles");

/** An article file as stored on disk; `path` is relative to the repository root. */
export type ArticleFile = { path: string; text: string };

export function readArticleFiles(dir = ARTICLES_DIR): ArticleFile[] {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }
  return names
    .filter((name) => name.endsWith(".md") && name !== "README.md")
    .sort()
    .map((name) => ({
      path: `content/articles/${name}`,
      text: readFileSync(path.join(dir, name), "utf8"),
    }));
}

/** Split `---\n<yaml>\n---\n<body>`; null when the file has no front matter. */
export function splitFrontMatter(text: string): { data: unknown; body: string } | null {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!match) return null;
  return { data: parseYaml(match[1] ?? ""), body: (match[2] ?? "").trim() };
}

/** Problems with a Markdown body that the renderer would hide or mangle. */
export function bodyProblems(body: string): string[] {
  const problems: string[] = [];
  if (body.length === 0) problems.push("empty body");
  // Raw HTML is escaped by the renderer; reject it so authors see the problem.
  if (/<\/?[a-zA-Z][\w-]*(\s[^>]*)?\/?>/.test(body)) problems.push("raw HTML is not allowed");
  // The page title is the only h1.
  if (/^#\s/m.test(body)) problems.push("level-1 heading in body (start sections at ##)");
  return problems;
}

/** Fingerprint of the Italian title, summary and body (the `source_hash` of `<ID>.en.md`). */
export function articleSourceHash(it: { title: string; summary: string; body: string }): string {
  return sourceHash({
    title: { it: it.title },
    summary: { it: it.summary },
    body: { it: it.body },
  });
}

export type ArticleValidation = { articles: Article[]; issues: Issue[] };

/**
 * Parse and validate article files against the schema and the canonical
 * dataset: every linked event, entity, relationship, hypothesis and source
 * code must exist. Publication rules are applied separately (src/site/articles.ts).
 */
export function validateArticleFiles(files: ArticleFile[], dataset: Dataset): ArticleValidation {
  const issues: Issue[] = [];
  const error = (file: string, message: string) =>
    issues.push({ severity: "error", file, message });

  type Parsed<T> = { file: string; data: T; body: string };
  const italian = new Map<string, Parsed<ArticleFrontMatterIt>>();
  const english = new Map<string, Parsed<ArticleFrontMatterEn>>();

  for (const file of files) {
    const name = file.path.split("/").pop() ?? file.path;
    const nameMatch = /^(.+)\.(it|en)\.md$/.exec(name);
    if (!nameMatch) {
      error(file.path, "file name must be <ID>.it.md or <ID>.en.md");
      continue;
    }
    const [, id = "", lang] = nameMatch;
    let split: ReturnType<typeof splitFrontMatter>;
    try {
      split = splitFrontMatter(file.text);
    } catch (cause) {
      error(file.path, `invalid YAML front matter: ${(cause as Error).message}`);
      continue;
    }
    if (!split) {
      error(file.path, "missing YAML front matter (--- ... ---)");
      continue;
    }
    const schema: z.ZodType = lang === "it" ? ArticleFrontMatterIt : ArticleFrontMatterEn;
    const parsed = schema.safeParse(split.data);
    if (!parsed.success) {
      for (const problem of parsed.error.issues) {
        error(file.path, `${problem.path.join(".") || "(front matter)"}: ${problem.message}`);
      }
      continue;
    }
    const data = parsed.data as ArticleFrontMatterIt | ArticleFrontMatterEn;
    if (data.id !== id) error(file.path, `front matter id ${data.id} does not match file name`);
    for (const problem of bodyProblems(split.body)) error(file.path, problem);
    if (lang === "it") {
      italian.set(id, { file: file.path, data: data as ArticleFrontMatterIt, body: split.body });
    } else {
      english.set(id, { file: file.path, data: data as ArticleFrontMatterEn, body: split.body });
    }
  }

  for (const [id, en] of english) {
    if (!italian.has(id)) error(en.file, "English translation without the canonical Italian file");
  }

  const ids = {
    events: new Set(dataset.events.map((r) => r.id)),
    entities: new Set(dataset.entities.map((r) => r.id)),
    relationships: new Set(dataset.relationships.map((r) => r.id)),
    hypotheses: new Set(dataset.hypotheses.map((r) => r.id)),
    sources: new Set(dataset.sources.map((r) => r.id)),
  };

  const articles: Article[] = [];
  for (const [id, it] of [...italian].sort(([a], [b]) => a.localeCompare(b))) {
    const en = english.get(id);
    const { data } = it;
    const file = it.file;

    // Test content must be unmistakable: flag, ID namespace and title prefix agree.
    const fixtureId = FIXTURE_ARTICLE_ID.test(id);
    if (data.fixture !== fixtureId) {
      error(file, "fixture: true is required exactly for ART-DEMO-NNN IDs");
    }
    if (data.fixture) {
      for (const [lang, title] of [
        ["it", data.title],
        ["en", en?.data.title],
      ] as const) {
        if (title !== undefined && !title.startsWith(FIXTURE_TITLE_PREFIX)) {
          error(file, `fixture title (${lang}) must start with "${FIXTURE_TITLE_PREFIX}"`);
        }
      }
      if (data.generated_by.kind !== "fixture")
        error(file, "fixture requires generated_by.kind: fixture");
      if (data.review.status === "reviewed") error(file, "a fixture can never be reviewed");
    } else if (data.generated_by.kind === "fixture") {
      error(file, "generated_by.kind: fixture is reserved for fixtures");
    }

    for (const collection of ["events", "entities", "relationships", "hypotheses"] as const) {
      const links = data.links[collection];
      for (const ref of links) {
        if (!ids[collection].has(ref)) error(file, `links.${collection}: unknown ID ${ref}`);
      }
      if (new Set(links).size !== links.length) error(file, `links.${collection}: duplicate ID`);
    }
    for (const reference of data.references) {
      if ("source" in reference && !ids.sources.has(reference.source)) {
        error(file, `references: unknown source ${reference.source}`);
      }
    }
    if (data.updated !== null && data.updated < data.date) error(file, "updated is before date");

    const record = {
      id,
      fixture: data.fixture,
      title: { it: data.title, ...(en && { en: en.data.title }) },
      summary: { it: data.summary, ...(en && { en: en.data.summary }) },
      body: { it: it.body, ...(en && { en: en.body }) },
      date: data.date,
      updated: data.updated,
      generated_by: data.generated_by,
      links: data.links,
      references: data.references,
      review: {
        status: data.review.status,
        notes: data.review.notes,
        ...(en && { translations: { en: en.data.translation } }),
      },
    };
    const parsed = Article.safeParse(record);
    if (!parsed.success) {
      for (const problem of parsed.error.issues) {
        error(file, `${problem.path.join(".")}: ${problem.message}`);
      }
      continue;
    }
    const article = parsed.data;
    if (en) {
      const problem = translationProblem(article);
      if (problem) error(en.file, problem);
    }
    articles.push(article);
  }
  return { articles, issues };
}
