import { describe, expect, it } from "vitest";
import { diffArticles } from "../src/pipeline/article-diff.ts";
import type { ArticleFile } from "../src/pipeline/articles.ts";

const ID = "ART-0042";
type Opts = {
  id?: string;
  status?: string;
  fixture?: boolean;
  links?: string[];
  refs?: number;
  notes?: string[];
  body?: string;
  translation?: string;
  enBody?: string;
  hash?: string;
};

function files(o: Opts = {}): ArticleFile[] {
  const id = o.id ?? ID;
  const refs = Array.from(
    { length: o.refs ?? 2 },
    (_, i) => `  - source: S0${i + 1}\n    note: null`,
  ).join("\n");
  const it = `---
id: ${id}
lang: it
fixture: ${o.fixture ?? false}
title: Titolo
summary: Sommario
date: 2026-11-10
updated: null
generated_by:
  kind: ai
  tool: ChatGPT scheduled task B
  run_date: 2026-11-10
links:
  events: [${(o.links ?? []).join(", ")}]
  entities: []
  relationships: []
  hypotheses: []
references:
${refs}
review:
  status: ${o.status ?? "needs_review"}
  notes: [${(o.notes ?? []).map((n) => `"${n}"`).join(", ")}]
---
${o.body ?? "## Corpo\n\nTesto."}
`;
  const en = `---
id: ${id}
lang: en
title: Title
summary: Summary
translation:
  status: ${o.translation ?? "machine"}
  source_hash: ${o.hash ?? "0123456789abcdef"}
  target_hash: 0123456789abcdef
---
${o.enBody ?? "## Body\n\nText."}
`;
  return [
    { path: `content/articles/${id}.it.md`, text: it },
    { path: `content/articles/${id}.en.md`, text: en },
  ];
}

const run = (before: ArticleFile[], after: ArticleFile[]) => diffArticles(before, after);
const errs = (flags: ReturnType<typeof run>) =>
  flags.filter((f) => f.severity === "error").map((f) => f.message);
const notes = (flags: ReturnType<typeof run>) =>
  flags.filter((f) => f.severity === "attention").map((f) => f.message);

describe("article diff", () => {
  it("accepts a new needs_review article silently", () => {
    expect(run([], files())).toEqual([]);
  });

  it("rejects a new article already reviewed, and a needs_review -> reviewed transition", () => {
    expect(errs(run([], files({ status: "reviewed" })))).toContainEqual(
      expect.stringContaining("expected"),
    );
    expect(errs(run(files(), files({ status: "reviewed" })))).toContainEqual(
      expect.stringContaining("only a human reviewer"),
    );
  });

  it("permits AI-only approval with a C provenance note, never as human reviewed", () => {
    const note =
      "AI-Verification: Task C; reviewed_head=0123456789abcdef0123456789abcdef01234567; date=2026-11-15; basis=Primary evidence and independent counter-checks";
    expect(errs(run([], files({ status: "ai_verified", notes: [note] })))).toEqual([]);
    expect(errs(run(files(), files({ status: "ai_verified", notes: [note] })))).toEqual([]);
    expect(errs(run(files(), files({ status: "ai_verified" })))).toContainEqual(
      expect.stringContaining("without structured Task C provenance"),
    );
    expect(
      errs(
        run(
          files(),
          files({ status: "ai_verified", notes: [note], body: "## Changed\n\nContent." }),
        ),
      ),
    ).toContainEqual(expect.stringContaining("must preserve all article content"));
    expect(
      errs(
        run(
          files({ status: "ai_verified", notes: [note] }),
          files({ status: "ai_verified", notes: [note], body: "## Changed\n\nContent." }),
        ),
      ),
    ).toContainEqual(expect.stringContaining("requires resetting status"));
    expect(errs(run([], files({ status: "reviewed" })))).toContainEqual(
      expect.stringContaining("expected"),
    );
  });

  it("rejects a reviewed translation", () => {
    expect(errs(run(files(), files({ translation: "reviewed" })))).toContainEqual(
      expect.stringContaining("translation"),
    );
  });

  it("rejects deletion and modification of a reviewed article", () => {
    expect(errs(run(files(), []))).toContainEqual(expect.stringContaining("deleted"));
    expect(
      errs(
        run(
          files({ status: "reviewed" }),
          files({ status: "reviewed", body: "## Altro\n\nNuovo." }),
        ),
      ),
    ).toContainEqual(expect.stringContaining("already marked as reviewed"));
  });

  it("rejects fixture mismatches", () => {
    expect(errs(run([], files({ id: "ART-DEMO-009", fixture: false })))).toContainEqual(
      expect.stringContaining("fixture"),
    );
    expect(errs(run(files(), files({ fixture: true })))).toContainEqual(
      expect.stringContaining("fixture"),
    );
  });

  it("reports unparseable front matter as a non-waivable error", () => {
    const broken = [{ path: `content/articles/${ID}.it.md`, text: "no front matter" }];
    const flags = run([], broken);
    expect(flags[0]).toMatchObject({ severity: "error", waivable: false });
  });

  it("flags removed and added links, fewer references and changed notes", () => {
    const flags = run(
      files({ links: ["TL-0001"], refs: 3 }),
      files({ links: ["TL-0002"], refs: 2, notes: ["x"] }),
    );
    expect(errs(flags)).toEqual([]);
    const messages = notes(flags).join("\n");
    expect(messages).toContain("links.events removed: TL-0001");
    expect(messages).toContain("links.events added to records not reviewed: TL-0002");
    expect(messages).toContain("references reduced from 3 to 2");
    expect(messages).toContain("review.notes changed");
  });

  it("flags an English-only change and a source_hash change, but not a joint change", () => {
    const flags = run(files(), files({ enBody: "## Body\n\nEdited.", hash: "fedcba9876543210" }));
    expect(notes(flags)).toContainEqual(
      expect.stringContaining("English text changed while the Italian"),
    );
    expect(notes(flags)).toContainEqual(expect.stringContaining("source_hash"));
    expect(
      notes(run(files(), files({ body: "## Corpo\n\nNuovo.", enBody: "## Body\n\nNew." }))),
    ).not.toContainEqual(expect.stringContaining("English text changed while"));
  });
});

it("reads historical translations without target hash while keeping the current side strict", () => {
  const before = files().map((f) => ({
    ...f,
    text: f.text.replace("  target_hash: 0123456789abcdef\n", ""),
  }));
  const after = files({ enBody: "## Body\n\nEdited." });
  expect(notes(run(before, after))).toContainEqual(expect.stringContaining("English text changed"));
  expect(notes(run(before, after))).toContain("translation.target_hash changed");
  expect(errs(run(after, before))).toContainEqual(expect.stringContaining("fails its schema"));
});
