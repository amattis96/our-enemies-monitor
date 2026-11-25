# Public Boundary & AI Service Policy (`PUBLIC_BOUNDARY.md`)

**Owner decision of 26 November 2026 (D1, D12, D14).** OEM is a public OSINT
project kept in **one public repository**. Material that is not yet
publishable is ordinary investigative work, not confidential. Being in the
repository never means being validated, approved, part of the factual graph
or published: the **publication gateway** and the **M5 gate** decide, record by
record, what reaches the public projections.

Three questions stay separate, each with its own field:

| Dimension | Where it lives |
| --- | --- |
| Evidentiary state | `evidence_level` E1–E5, `evidence_status`, caveats |
| Editorial state | `review.status` (`imported_unreviewed`, `needs_review`, `ai_verified`, `reviewed`), translation status |
| Publication eligibility | `src/site/publication.ts` + `src/security/gateway.ts` (withheld reasons) |
| Material class (this document) | `src/security/boundary.ts` (`DATA_CLASSES`, `classifyPath`, `classifyRecord`) |

`needs_review` does **not** imply confidentiality: it means "not yet qualified".

## 1. Material classes

| Class | Meaning | Examples |
| :--- | :--- | :--- |
| `public_publishable` | Canonical material eligible for public projections, still filtered record by record by the gateway. | `reviewed` and `imported_unreviewed` records, published articles. |
| `investigative_pending` | OSINT not yet qualified. | `sources/incremental/`, `sources/thematic/`, `needs_review` candidates, hypotheses, leads, `docs/discovery/` queue and negative verifications. |
| `editorial_draft` | Article drafts and translations. | `content/articles/*` with `needs_review`. |
| `operational` | Run manifests, metrics, reports, logs (minimized). | `docs/runs/manifests/`, `docs/quality/`, CI logs. |
| `private_investigative` | **Future, optional**: confidential human investigations. | None. Disabled: no confidential store exists. |
| `holdout_evaluation` | Answers that must stay unseen by the evaluated agent. | None in the repository (a public file is not a holdout). |

**Not simulated.** Directories, labels or branches of a public repository are
logical separation, not access control. `private_investigative` is denied to
every destination until the owner takes a new explicit decision that provides
a real confidential store.

## 2. Destinations

| Destination | `public_publishable` | `investigative_pending` / `editorial_draft` / `operational` | `holdout_evaluation` | `private_investigative` |
| :--- | :---: | :---: | :---: | :---: |
| Repository (public Git) | Allowed | Allowed | **Denied** | **Denied** |
| Public projections: site, graph, timeline, API, MCP, exports, feeds, sitemap, social metadata, search indexes | Allowed, through the gateway | **Denied** | **Denied** | **Denied** |
| CI logs and artifacts | Allowed | Allowed | **Denied** | **Denied** |
| AI subscriptions (ChatGPT, Claude, Codex, Claude Code, Gemini) | Allowed | Allowed | **Denied** | **Denied** |
| AI APIs (any retention tier; no ZDR required) | Allowed | Allowed | **Denied** | **Denied** |
| Embedding services, local or external | Allowed | Allowed | **Denied** | **Denied** |
| External tools and notebooks | Allowed | Allowed | **Denied** | **Denied** |
| Independent external evaluator | Allowed | Allowed | Allowed | **Denied** |

Using an AI provider never changes the evidentiary or editorial status of the
material it processes. Enforced in `src/security/boundary.ts`
(`createProviderGuard`, `createEmbeddingGuard`; tested in `test/security.test.ts`).

## 3. What stays protected (D12)

Minimization applies to what is genuinely sensitive, everywhere (files, PRs,
comments, CI logs, manifests, prompts):

1. **Credentials and secrets**: tokens, API keys, passwords, signed URLs. Never
   written anywhere; `src/runs/minimize.ts` redacts them in run manifests and the
   gateway fails on token patterns in public projections.
2. **Unnecessary personal data**: only publicly relevant data about named
   persons, with a specific primary source, exact procedural status and date.
3. **URLs with authentication**: userinfo and auth query parameters are stripped.
4. **Genuinely sensitive operational detail**: errors flagged `sensitive`.
5. **Isolated contexts**: a context holding `holdout_evaluation` material is not
   mixed with other material.

Open sources are not automatically free to reproduce in full, aggregate or
redistribute: relevance, minimization, traceability and respect for the
sources still apply.

## 4. Publication gateway rules (`src/security/gateway.ts`)

The gateway (`publish-gateway.yml`, after CI on `main`) is the evidentiary, editorial and application boundary between the repository and its public projections, not a transfer between repositories. It fails closed on schema errors, non-publishable records in the projection, inconsistent evidence level/status, M5 person-link violations, unsanitized hypothesis notes and export leaks. Two clarifications keep it aligned with the rest of the repository:

- **Archive paths.** `sources/original/` and `sources/incremental/` paths are a leak anywhere in a public record **except** `provenance` (imported rows, hard rule 3) and a corpus source's `files` (the archived documents). Both are public by design on record pages and in `data/v1`.
- **Corpus-only E1** (ADR-05) is reported as a non-blocking warning in the gateway summary, with the same severity as in `pnpm validate`; it is an editorial review item, not a publication block.
