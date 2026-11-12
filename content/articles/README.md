# Editorial articles

Authored analyses that cite canonical records in `data/`. They are not
canonical records themselves.

- `<ID>.it.md` — canonical Italian text; its YAML front matter holds every
  field (links, references, review).
- `<ID>.en.md` — optional English translation (title, summary, body and
  `translation: { status, source_hash }`).
- `ART-NNNN` — real articles. `ART-DEMO-NNN` — demo/test fixtures, always
  `fixture: true` with `DEMO / TEST` titles; delete them once real articles
  are published.

The full contract (fields, body rules, source hash, publication gate) is in
[docs/M6_CHATGPT_OSINT_WORKFLOW.md](../../docs/M6_CHATGPT_OSINT_WORKFLOW.md#article-contract-what-task-b-must-output).
Check with `pnpm validate:articles`; set English hashes with
`pnpm articles:hash --write`.
