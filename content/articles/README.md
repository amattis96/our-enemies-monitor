# Editorial articles

Authored analyses that cite canonical records in `data/`. They are not
canonical records themselves.

- `<ID>.it.md` — canonical Italian text; its YAML front matter holds every
  field (links, references, review).
- `<ID>.en.md` — optional English translation (title, summary, body and
  `translation: { status, source_hash }`).
- `ART-NNNN` — real editorial articles. `ART-DEMO-NNN` is reserved for testing;
  demonstration fixtures were removed from the published collection when real
  articles were approved (2026-11-13).

The full contract (fields, body rules, source hash, publication gate) is in
[docs/M6_CHATGPT_OSINT_WORKFLOW.md](../../docs/M6_CHATGPT_OSINT_WORKFLOW.md#article-contract-what-task-b-must-output).
Publication is an explicit editorial decision recorded in `review.notes`; merging an
article with `needs_review` does not publish it. AI-produced English translations
retain `translation.status: machine` until independently reviewed.

Check with `pnpm validate:articles`; set English hashes with
`pnpm articles:hash --write`.
