import { isDeepStrictEqual } from "node:util";
import {
  ArticleFrontMatterEn,
  ArticleFrontMatterIt,
  FIXTURE_ARTICLE_ID,
  hasAiVerificationNote,
} from "../model/index.ts";
import { type ArticleFile, splitFrontMatter } from "./articles.ts";
import type { Flag } from "./diff.ts";

/**
 * Evidence diff of `content/articles/`: an article is authored analysis, not a
 * canonical record. Human `reviewed` remains a distinct authorization;
 * `ai_verified` requires C provenance, only safe status transitions and
 * a further exact-HEAD D review. Pure: callers pass before and after files.
 */

type Side = {
  it: { text: string; front: ArticleFrontMatterIt; body: string } | null;
  en: { text: string; front: ArticleFrontMatterEn; body: string } | null;
  broken: string[];
  files: Map<string, string>;
};

export type ArticleDiffOptions = {
  /** `ID`s of linked canonical records that are `reviewed`, to spot links to unreviewed material. */
  reviewedRecords?: Set<string>;
};

const LINK_KINDS = ["events", "entities", "relationships", "hypotheses"] as const;

function sideOf(files: ArticleFile[], id: string, historical = false): Side {
  const side: Side = { it: null, en: null, broken: [], files: new Map() };
  for (const file of files) {
    const name = file.path.split("/").pop() ?? "";
    const match = /^(.+)\.(it|en)\.md$/.exec(name);
    if (!match || match[1] !== id) continue;
    side.files.set(match[2] ?? "", file.text);
    try {
      const split = splitFrontMatter(file.text);
      const schema =
        match[2] === "it"
          ? ArticleFrontMatterIt
          : historical
            ? ArticleFrontMatterEn.extend({
                translation: ArticleFrontMatterEn.shape.translation.extend({
                  target_hash: ArticleFrontMatterEn.shape.translation.shape.target_hash.optional(),
                }),
              })
            : ArticleFrontMatterEn;
      const parsed = split ? schema.safeParse(split.data) : null;
      if (!split || !parsed?.success) {
        side.broken.push(file.path);
        continue;
      }
      if (match[2] === "it") {
        side.it = { text: file.text, front: parsed.data as ArticleFrontMatterIt, body: split.body };
      } else {
        side.en = { text: file.text, front: parsed.data as ArticleFrontMatterEn, body: split.body };
      }
    } catch {
      side.broken.push(file.path);
    }
  }
  return side;
}

/** Article ID of a `content/articles/<ID>.<lang>.md` path, or null. */
export function articleIdOf(file: string): string | null {
  const match = /^content\/articles\/(.+)\.(?:it|en)\.md$/.exec(file);
  return match?.[1] ?? null;
}

export function diffArticles(
  before: ArticleFile[],
  after: ArticleFile[],
  options: ArticleDiffOptions = {},
): Flag[] {
  const flags: Flag[] = [];
  const err = (id: string, message: string, waivable = true) =>
    flags.push({ severity: "error", id, message, ...(waivable ? {} : { waivable: false }) });
  const note = (id: string, message: string) => flags.push({ severity: "attention", id, message });
  const idsOf = (files: ArticleFile[]) => files.flatMap((f) => articleIdOf(f.path) ?? []);

  for (const id of [...new Set([...idsOf(before), ...idsOf(after)])].sort()) {
    const was = sideOf(before, id, true);
    const is = sideOf(after, id);
    for (const path of is.broken)
      err(path, "front matter cannot be parsed or fails its schema", false);

    const changedFile = ["it", "en"].some((l) => was.files.get(l) !== is.files.get(l));
    if (!changedFile) continue;

    for (const lang of ["it", "en"]) {
      if (was.files.has(lang) && !is.files.has(lang)) err(id, `article file .${lang}.md deleted`);
    }

    // Reviewed article edited, in any language.
    if (was.it?.front.review.status === "reviewed") {
      err(id, "modifies an article already marked as reviewed");
    }

    if (is.it) {
      const front = is.it.front;
      const status = front.review.status;
      if (!was.it && status === "reviewed") {
        err(
          id,
          `new article with review.status "${status}" (expected "needs_review" or "ai_verified")`,
        );
      }
      if (status === "ai_verified" && !hasAiVerificationNote(front.review.notes)) {
        err(id, "ai_verified without structured Task C provenance", false);
      }
      if (front.fixture && status === "ai_verified") {
        err(id, "fixtures cannot be ai_verified", false);
      }
      if (was.it && was.it.front.review.status !== "reviewed" && status === "reviewed") {
        err(id, 'sets review.status to "reviewed": only a human reviewer may do this');
      }
      if (front.fixture !== FIXTURE_ARTICLE_ID.test(id)) {
        err(id, `fixture: ${front.fixture} does not match the ID (only ART-DEMO-* are fixtures)`);
      }
      if (was.it && was.it.front.fixture !== front.fixture) err(id, "fixture flag changed");
    }
    if (
      is.en?.front.translation.status === "reviewed" &&
      was.en?.front.translation.status !== "reviewed"
    ) {
      err(id, 'marks the translation as "reviewed": only a human reviewer may do this');
    }

    if (!was.it || !is.it) continue;
    const a = was.it.front;
    const b = is.it.front;
    // AI promotion of a merged draft may change only status and review notes.
    // Every substantive edit must first revert to needs_review for new scrutiny.
    if (a.review.status !== "ai_verified" && b.review.status === "ai_verified") {
      const { review: _oldReview, ...oldContent } = a;
      const { review: _newReview, ...newContent } = b;
      if (
        !isDeepStrictEqual(oldContent, newContent) ||
        was.it.body !== is.it.body ||
        was.en?.text !== is.en?.text
      ) {
        err(id, "ai_verified promotion must preserve all article content and translation", false);
      }
    }
    if (a.review.status === "ai_verified" && b.review.status === "ai_verified") {
      if (
        was.it.body !== is.it.body ||
        was.en?.text !== is.en?.text ||
        !isDeepStrictEqual(a.links, b.links) ||
        !isDeepStrictEqual(a.references, b.references) ||
        a.title !== b.title ||
        a.summary !== b.summary ||
        a.date !== b.date ||
        a.updated !== b.updated
      ) {
        err(id, "editing ai_verified content requires resetting status to needs_review", false);
      }
    }
    for (const kind of LINK_KINDS) {
      const removed = a.links[kind].filter((x) => !b.links[kind].includes(x));
      if (removed.length > 0) note(id, `links.${kind} removed: ${removed.join(", ")}`);
      const unreviewed = b.links[kind].filter(
        (x) => !a.links[kind].includes(x) && !options.reviewedRecords?.has(x),
      );
      if (unreviewed.length > 0) {
        note(id, `links.${kind} added to records not reviewed: ${unreviewed.join(", ")}`);
      }
    }
    if (b.references.length < a.references.length) {
      note(id, `references reduced from ${a.references.length} to ${b.references.length}`);
    }
    if (!isDeepStrictEqual(a.review.notes, b.review.notes)) note(id, "review.notes changed");
    if (!isDeepStrictEqual(a.generated_by, b.generated_by)) note(id, "generated_by changed");
    if (a.date !== b.date || a.updated !== b.updated) note(id, "date or updated changed");
    const italianSame =
      a.title === b.title && a.summary === b.summary && was.it.body === is.it.body;
    if (was.en && is.en) {
      const englishChanged =
        was.en.front.title !== is.en.front.title ||
        was.en.front.summary !== is.en.front.summary ||
        was.en.body !== is.en.body;
      if (englishChanged && italianSame) {
        note(id, "English text changed while the Italian text did not");
      }
      if (was.en.front.translation.target_hash !== is.en.front.translation.target_hash) {
        note(id, "translation.target_hash changed");
      }
      if (was.en.front.translation.source_hash !== is.en.front.translation.source_hash) {
        note(id, "translation.source_hash changed");
      }
    }
  }
  return flags;
}

/** Independent editorial approvals needed for changes; B02 flags remain unchanged. */
export function requiredArticleApprovals(before: ArticleFile[], after: ArticleFile[]) {
  const publication: string[] = [];
  const translation: string[] = [];
  const ids = [...new Set([...before, ...after].flatMap((f) => articleIdOf(f.path) ?? []))].sort();
  for (const id of ids) {
    const was = sideOf(before, id, true);
    const current = sideOf(after, id);
    if (current.broken.length || was.broken.length) throw new Error(`Cannot assess article ${id}`);
    const changed = ["it", "en"].some((lang) => was.files.get(lang) !== current.files.get(lang));
    if (!changed) continue;
    if (
      was.it?.front.review.status === "reviewed" ||
      current.it?.front.review.status === "reviewed"
    )
      publication.push(id);
    if (
      (current.en?.front.translation.status === "reviewed" &&
        was.en?.front.translation.status !== "reviewed") ||
      (was.en?.front.translation.status === "reviewed" &&
        was.files.get("en") !== current.files.get("en"))
    )
      translation.push(id);
  }
  return { publication, translation };
}
