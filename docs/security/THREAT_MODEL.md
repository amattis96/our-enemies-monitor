# Threat Model (`PK-01`)

This document defines the threat model, trust boundaries, and accidental-publication response procedure for **our-enemies-monitor** under the single public repository architecture decided by the owner on 26 November 2026 (D1): the repository holds both canonical records and not-yet-qualified OSINT; the publication gateway separates it from the public projections.

## 1. System & Trust Boundaries

- **Untrusted external inputs**: OSINT sources (`sources/incremental/`, `sources/thematic/`), scraped web pages, PDFs, social media posts, and third-party feeds.
- **Repository, not yet public**: archived incremental and thematic sources, `needs_review` candidates, hypotheses, discovery queue (`docs/discovery/`), run manifests (`docs/runs/manifests/`), knowledge-time revisions (`docs/snapshots/revisions/`), drafts and reference sets. Ordinary OSINT (`investigative_pending`, `editorial_draft`, `operational`), not confidential. Genuinely confidential material (`private_investigative`) is a future, optional feature with no store today.
- **Control plane**: Workflow definitions (`.github/workflows/`), `.github/CODEOWNERS`, `src/pipeline/policy.ts`, `src/security/`, `src/site/publication.ts`, `schemas/`, `docs/roadmap/plan.v1.json`, `docs/quality/thresholds.v1.json`, `docs/audit/inferences/registry.v1.json`, `docs/security/`.
- **Public projections**: Published canonical records (`reviewed` or `imported_unreviewed` with `sources/original/` provenance), sanitized public projections, editorial articles, static site (`web/dist`), exports, sitemap, and search index.

Credentials, secrets and unnecessary personal data are excluded **before** any branch push, pull request, PR comment, CI log or workflow artifact; non-publishable records are excluded from every public projection by the gateway.

## 2. Threat Vectors & Mitigations

### 2.1 Data Poisoning
- **Threat**: Adversaries plant fabricated or manipulated claims, forged entity attributes, or corrupted timelines in external OSINT sources to distort canonical records or public articles.
- **Mitigations**:
  - No external source enters the public dataset automatically: `publicationEligible()` requires `review.status === "reviewed"` or original baseline provenance (`sources/original/`).
  - Immutable `sources/original/` and append-only `sources/incremental/` enforced globally in `src/pipeline/policy.ts` (`checkGlobal`).
  - `validateDataFiles()` and M5 evidentiary checks (`consistentEvidence`, `personReference`) block inconsistent or unattributed claims.
  - `src/security/gateway.ts` fails closed on any schema, visibility, evidentiary, or sanitization error.

### 2.2 Hidden Prompt Instructions (Prompt Injection)
- **Threat**: Hostile sources embed hidden instructions targeting LLM-based research or ingestion agents (e.g., `"ignore previous instructions"`, tool-calling directives, HTML comments, zero-width character smuggling, or delimiter breakout attempts) to exfiltrate private data, bypass review gates, or alter canonical files.
- **Mitigations**:
  - **Delimited quarantine** (`src/security/quarantine.ts`): all untrusted source text is wrapped in explicit non-executable markers (`<<<OEM_QUARANTINED_SOURCE ...>>>`) with SHA-256 integrity digests and pre-existing marker escaping.
  - **Instruction pattern detection**: `detectPromptInjection()` scans quarantined payloads for role overrides, tool/command hijacking, hidden HTML/markdown instruction comments, zero-width smuggling, and delimiter breakouts, marking high-severity payloads as unsafe for automated agent consumption.
  - **Privilege separation**: investigative agents only propose on `research/*` branches; they cannot approve PRs, modify the control plane, or access deployment secrets.

### 2.3 Artificial Corroboration (Source Laundering)
- **Threat**: Multiple outlets republish or paraphrase the same single primary claim (or cite each other circularly) to manufacture the appearance of independent corroboration (`E3` or `E1`).
- **Mitigations**:
  - **B17 source genealogy** (`src/pipeline/genealogy.ts`): tracks `origin_type`, `derived_from`, and `relies_on` across sources and rejects circular chains.
  - **Corroboration audit** (`checkArtificialCorroboration()` in `src/security/quarantine.ts`): collapses cited sources to their independent B17 roots, flags `corpus_only` E1 claims (`corpusOnlyE1`), and surfaces `undetermined` origins so unknown provenance is never counted as independent corroboration.

### 2.4 Supply Chain & CI/CD Compromise
- **Threat**: Compromised GitHub Actions, unpinned action tags, `pull_request_target` executing untrusted PR head code with write tokens, `CODEOWNERS` bypass, or overly broad PATs (`AUTOMERGE_TOKEN` tied to maintainer account) allowing unauthorized merges to `main` or control-plane tampering.
- **Mitigations**:
  - **SHA-pinned Actions**: every `uses:` in `.github/workflows/*.yml` is pinned to a full 40-hex commit SHA (verified by `src/security/workflows-audit.ts` and `test/workflows.test.ts`).
  - **Minimal permissions & job isolation**: top-level workflow permissions are read-only (`contents: read`); jobs that check out or run repository code never hold `write` permissions; no `pull_request_target` is permitted; `${{ }}` expressions are never interpolated into `run:` scripts.
  - **Publication gateway isolation**: `.github/workflows/publish-gateway.yml` runs only on trusted `main` (`workflow_run` / `workflow_dispatch`), never on PRs.
  - **Narrowed `CODEOWNERS` & extended `CONTROL_PLANE`**: `CODEOWNERS` protects only control-plane paths (including `.github/CODEOWNERS` itself) so ordinary content stays automergeable while control-plane changes require maintainer review.

### 2.5 Accidental Publication & External Boundary Leaks
- **Threat**: Non-publishable records (`needs_review`, withheld, unverified person links) reach a public projection presented as facts; or secrets, unnecessary personal data or holdout answers leak into the repository, PRs, CI logs, artifacts, search indexes or AI/embedding providers with data retention.
- **Mitigations**:
  - **Material classes & provider guard** (`src/security/boundary.ts`): ordinary OSINT may go to AI subscriptions, APIs and embeddings; only isolated classes (holdout answers, future confidential material) are rejected, and isolated contexts are not mixed.
  - **Publication gateway** (`src/security/gateway.ts`): boundary between the repository and its public projections, performing schema validation, visibility filtering, evidentiary checks, M5 gate, sanitization, and serialized export leak scanning.

## 3. Accidental Publication Response Procedure

If non-publishable, private, or sensitive material is accidentally published to the public repository, site, exports, or an unauthorized external service:

1. **Immediate Containment (T+0 to T+15m)**
   - Set repository variable `AUTOMERGE_ENABLED=false` to halt automated merges.
   - Cancel any in-flight `ci.yml` / `publish-gateway.yml` / `stage-ingest.yml` runs.
   - Disable or unpublish the affected public artifact/deployment if exposure is live.
2. **Retraction & Public Removal (T+15m to T+1h)**
   - Revert or remove the leaked records from the public branch and trigger a clean `ci.yml` build + deploy so the live site, `web/dist`, exports, and Pagefind index no longer serve the data.
   - Record a formal retraction entry if canonical IDs were already publicly referenced.
3. **Credential & Token Rotation (T+1h)**
   - Rotate all potentially exposed or involved credentials per `docs/security/BACKUP_AND_ROTATION.md` (GitHub App private keys, PATs, API keys, webhook secrets).
   - Audit GitHub audit logs and CI run logs for unauthorized access or exfiltration.
4. **Git History Rewrite Assessment (T+1h to T+4h)**
   - If the leak committed raw secrets, unredacted PII, or restricted operational data into public Git history, rewrite public history using `git filter-repo` (never on `sources/original/` in the private repo without backup verification) and force-push `main`, followed by CDN/cache invalidation.
5. **Communication & Uncontrollable Copies Declaration (T+4h to T+24h)**
   - Publish a concise transparency notice describing what was exposed, the exposure window, and the remediation taken.
   - Explicitly declare **uncontrollable copies** (GitHub forks, search engine caches, third-party mirrors, web archives, or external AI provider retention logs if applicable) that cannot be recalled after publication.
   - Conduct a post-mortem and add regression checks to `src/security/gateway.ts` and `test/security.test.ts`.
