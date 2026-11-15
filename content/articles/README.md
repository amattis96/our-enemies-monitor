# Editorial articles

Authored analyses that cite canonical records in `data/`. They are not
canonical records themselves.

- `<ID>.it.md` — canonical Italian text; its YAML front matter holds every
  field (links, references, review).
- `<ID>.en.md` — optional English translation (title, summary, body and
  `translation: { status, source_hash, target_hash }`).
- `ART-NNNN` — real editorial articles. `ART-DEMO-NNN` is reserved for testing;
  demonstration fixtures were removed from the published collection when real
  articles were approved (2026-11-13).

The full contract (fields, body rules, source hash, publication gate) is in
[docs/M6_CHATGPT_OSINT_WORKFLOW.md](../../docs/M6_CHATGPT_OSINT_WORKFLOW.md#article-contract-what-task-b-must-output).
Publication is an explicit editorial decision recorded in `review.notes`; merging an
article with `needs_review` does not publish it. AI-produced English translations
retain `translation.status: machine` until independently reviewed.

Check with `pnpm validate:articles`; set English hashes with
`pnpm articles:hash --write ART-NNNN` after translation. Both hashes detect text changes, not semantic fidelity or reviewer identity; stale reviewed translations require human review.

`reviewed` means human editorial authorization to publish the current article;
Task C can assist but cannot grant it. English review is separate. New or
promoted reviewed articles and changes to reviewed articles require a GitHub
review on the exact PR HEAD by the configured maintainer, distinct from the PR
author, with `Publication-Approval: ART-0001` (comma-separated IDs). A
promoted or changed reviewed English translation additionally requires
`Translation-Approval: ART-0001`. Front matter claims and generic code approval
are not proof. An owner cannot approve their own PR; a separate agent author
or another authorized human is needed. The technical evidence waiver does not
replace this check, and the approval does not waive the strict evidence diff. Marker lines must be at the top level, outside Markdown code fences and quotations.

Validation warns when an article has no event, relationship or hypothesis
links but mentions an entity structurally associated with a public event. This
is an editorial prompt, not proof of relevance or an automatic link; context
mentions and external investigations require judgment.
