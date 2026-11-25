# Public Boundary & External AI Service Policy (`PUBLIC_BOUNDARY.md`)

> **Core Principle**: *That a model or tool can read a datum does not mean it is authorized to receive it.*

The confidentiality boundary applies **before** any branch push, pull request, PR comment, CI log, workflow artifact, search index, or external AI/embedding API call.

## 1. Content Classes

| Class | Description | Examples |
| :--- | :--- | :--- |
| `public_publishable` | Verified, publication-eligible records and public editorial content. | `reviewed` records, `imported_unreviewed` with `sources/original/` provenance, published articles, sanitized public manifests. |
| `editorial_draft` | Work-in-progress articles and translations derived only from public/reviewed facts. | Unreviewed `content/articles/*` drafts without private leads. |
| `private_investigative` | Quarantined sources, `needs_review` records, unpublished leads, sensitive evidence, unredacted PII. | `sources/incremental/*` raw captures, `sources/thematic/*`, private discovery queue items. |
| `restricted_operational` | Internal run manifests, raw queries, operational error logs, security thresholds. | `docs/runs/` private manifests, raw query logs, CI debug traces. |
| `holdout_evaluation` | Evaluation holdout sets and ground-truth test answers. | `docs/quality/sets/` holdout fixtures, private benchmark answers. |

## 2. Destination & External AI Service Matrix

| Destination | `public_publishable` | `editorial_draft` | `private_investigative` | `restricted_operational` | `holdout_evaluation` |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Public Repo / Site / Exports / Search Index** | Allowed | **Denied** | **Denied** | **Denied** | **Denied** |
| **Private Repo** | Allowed | Allowed | Allowed | Allowed | Allowed |
| **CI Logs / Workflow Artifacts** | Allowed | **Denied** | **Denied** | **Denied** | **Denied** |
| **ChatGPT / Claude Subscription (Consumer/Team)** | Allowed | Allowed | **Denied** | **Denied** | **Denied** |
| **ChatGPT / Claude API (Standard / Retaining)** | Allowed | **Denied** | **Denied** | **Denied** | **Denied** |
| **ChatGPT / Claude API (Zero Data Retention / ZDR)** | Allowed | Allowed | Allowed | **Denied** | **Denied** |
| **Local Embedding Service (Self-hosted)** | Allowed | Allowed | Allowed | Allowed | **Denied** |
| **External Embedding Service (ZDR)** | Allowed | Allowed | **Denied** | **Denied** | **Denied** |
| **External Embedding Service (Retaining)** | Allowed | **Denied** | **Denied** | **Denied** | **Denied** |
| **External Notebooks / Third-Party Tools** | Allowed | **Denied** | **Denied** | **Denied** | **Denied** |

## 3. Provider Retention, Logs, Caches & Context Separation

1. **API Retention**: Standard consumer or non-ZDR API tiers retain prompts/completions for abuse monitoring or model training. `private_investigative` data may **only** be sent to enterprise/API endpoints with contractual Zero Data Retention (ZDR) and zero training opt-in.
2. **Embedding Services**: Never send `private_investigative`, `restricted_operational`, or `holdout_evaluation` material to external embedding APIs. Use local/self-hosted embeddings for private corpora.
3. **Provider & CI Logs**: Never log raw prompts, investigative queries, or `private_investigative` records in CI stdout/stderr, workflow artifacts, or PR comments.
4. **Separated Caches & Agent Contexts**:
   - Agent sessions, prompt caches, and vector stores **must** be strictly separated by confidentiality domain.
   - An agent context holding `private_investigative` or `holdout_evaluation` data must never be reused for `public_publishable` or `editorial_draft` generation.
   - Enforced programmatically in `src/security/boundary.ts` (`createProviderGuard`, `createEmbeddingGuard`).

## 4. Publication gateway rules (`src/security/gateway.ts`)

The gateway (`publish-gateway.yml`, after CI on `main`) fails closed on schema errors, non-publishable records in the projection, inconsistent evidence level/status, M5 person-link violations, unsanitized hypothesis notes and export leaks. Two clarifications keep it aligned with the rest of the repository:

- **Archive paths.** `sources/original/` and `sources/incremental/` paths are a leak anywhere in a public record **except** `provenance` (imported rows, hard rule 3) and a corpus source's `files` (the archived documents). Both are public by design on record pages and in `data/v1`.
- **Corpus-only E1** (ADR-05) is reported as a non-blocking warning in the gateway summary, with the same severity as in `pnpm validate`; it is an editorial review item, not a publication block.
