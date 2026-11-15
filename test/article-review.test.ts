import { describe, expect, it } from "vitest";
import { requiredArticleApprovals } from "../src/pipeline/article-diff.ts";
import { checkArticleReview } from "../src/pipeline/article-review.ts";
import { readArticleFiles } from "../src/pipeline/articles.ts";

const head = "a".repeat(40);
const requirements = { publication: ["ART-0002"], translation: ["ART-0002"] };
const approval = {
  id: 1,
  html_url: "https://github.com/example/review/1",
  state: "APPROVED",
  commit_id: head,
  submitted_at: "2026-11-15T10:00:00Z",
  body: "Publication-Approval: ART-0002\nTranslation-Approval: ART-0002",
  user: { login: "maintainer", type: "User" },
};
const check = (reviews: unknown, author = "agent", reviewers = ["maintainer"]) =>
  checkArticleReview(requirements, reviews, reviewers, author, head);
describe("editorial review policy", () => {
  it("requires explicit separate markers from the human maintainer on HEAD", () => {
    expect(check([approval])).toContain("Review 1");
    for (const review of [
      { ...approval, commit_id: "b".repeat(40) },
      { ...approval, body: "Publication-Approval: ART-0002" },
      { ...approval, body: "Publication-Approval: ART-00020\nTranslation-Approval: ART-0002" },
      {
        ...approval,
        body: "Publication-Approval: ART-0002, garbage\nTranslation-Approval: ART-0002",
      },
      { ...approval, user: { login: "maintainer", type: "Bot" } },
      { ...approval, user: { login: "other", type: "User" } },
      {
        ...approval,
        body: "Example:\n```\nPublication-Approval: ART-0002\n```\nTranslation-Approval: ART-0002",
      },
      {
        ...approval,
        body: "~~~text\nPublication-Approval: ART-0002\n~~~\nTranslation-Approval: ART-0002",
      },
      { ...approval, body: "> Publication-Approval: ART-0002\nTranslation-Approval: ART-0002" },
    ])
      expect(() => check([review])).toThrow();
    expect(() => check([approval], "maintainer")).toThrow();
    expect(() => check([{}])).toThrow();
  });
  it("accepts a second listed reviewer when the owner authors the PR, never the author", () => {
    const second = { ...approval, id: 3, user: { login: "Second-Reviewer", type: "User" } };
    const list = ["maintainer", "second-reviewer"];
    expect(check([second], "maintainer", list)).toContain("by Second-Reviewer");
    expect(() => check([approval], "maintainer", list)).toThrow();
    expect(() => check([approval], "maintainer", ["maintainer"])).toThrow(
      /other than the PR author/,
    );
    expect(() => check([second], "agent", ["maintainer"])).toThrow();
    expect(() => check([second], "agent", [])).toThrow();
    expect(() => check([second], "agent", [""])).toThrow();
    const blocking = {
      ...approval,
      state: "CHANGES_REQUESTED",
      submitted_at: "2026-11-15T12:00:00Z",
    };
    expect(() => check([second, blocking], "agent", list)).toThrow(/requested changes/);
  });
  it("rejects markers in lazy quotes, HTML and code but accepts them after a closed quote", () => {
    const markers = "Publication-Approval: ART-0002\nTranslation-Approval: ART-0002";
    for (const body of [
      `> Example only, not editorial authorization:\n${markers}`,
      `<!--\n${markers}\n-->`,
      `Text <!--\n${markers}\n-->`,
      `<pre>\n${markers}\n</pre>`,
      `\`\`\`\n${markers}\n\`\`\``,
      `- Example only:\n${markers}`,
    ])
      expect(() => check([{ ...approval, body }])).toThrow();
    expect(check([{ ...approval, body: `> Example only\n\n${markers}` }])).toContain("Review 1");
  });
  it("uses the latest decisive state, ignoring comments", () => {
    const later = { ...approval, id: 2, submitted_at: "2026-11-15T11:00:00Z" };
    expect(check([approval, { ...later, state: "COMMENTED" }])).toContain("Review 1");
    for (const state of ["CHANGES_REQUESTED", "DISMISSED"])
      expect(() => check([approval, { ...later, state }])).toThrow();
  });
  it("detects reviewed article and reviewed translation changes without replacing B02", () => {
    const before = readArticleFiles();
    const changed = before.map((f) =>
      f.path.endsWith("ART-0002.it.md") ? { ...f, text: `${f.text}\n` } : f,
    );
    expect(requiredArticleApprovals(before, changed).publication).toContain("ART-0002");
    expect(requiredArticleApprovals(before, changed).translation).toEqual([]);
    const promoted = before.map((f) =>
      f.path.endsWith("ART-0002.en.md")
        ? { ...f, text: f.text.replace("status: machine", "status: reviewed") }
        : f,
    );
    expect(requiredArticleApprovals(before, promoted)).toEqual({
      publication: ["ART-0002"],
      translation: ["ART-0002"],
    });
  });
});
