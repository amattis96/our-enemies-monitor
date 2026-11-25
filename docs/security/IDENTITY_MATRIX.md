# Identity & Permission Matrix (`IDENTITY_MATRIX.md`)

To prevent privilege escalation and self-approval (D13), **our-enemies-monitor** separates human, automated, and gateway identities. No single automated identity can both propose and approve/merge control-plane changes.

## 1. Identities

| Identity | Type | Purpose |
| :--- | :--- | :--- |
| **Investigative Agent** | Scheduled / Research Bot | Acquires OSINT sources, writes quarantined proposals and article drafts on `research/*` branches. |
| **Implementation Agent** | Engineering Bot | Proposes code, schema, and control-plane updates on feature/fix branches. |
| **Publication Gateway** | Isolated Workflow / App | Reads validated private artifacts on `main` and emits **only** sanitized public projections. |
| **Auto-Merge App** | GitHub App (replaces personal PAT `AUTOMERGE_TOKEN`) | Merges ordinary content/data PRs once all required checks pass and no control-plane paths are touched. |
| **Maintainer (`@amattis96`)** | Human Owner | Sole code owner of the control plane; sole authority for `evidence-waiver`, rulesets, and break-glass actions. |

## 2. Permission Matrix

| Capability | Investigative Agent | Implementation Agent | Publication Gateway | Auto-Merge App | Maintainer |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Propose `sources/incremental/*`, `content/articles/*`** | Yes (`research/*`) | Yes | No | No | Yes |
| **Propose `data/*` (via ingest)** | No | Yes | No | No | Yes |
| **Propose `CONTROL_PLANE` changes** | **No** | Yes (PR only) | **No** | **No** | Yes |
| **Approve `CONTROL_PLANE` PRs (`CODEOWNERS`)** | **No** | **No** | **No** | **No** | **Yes (Sole)** |
| **Merge ordinary content/data PRs** | **No** | **No** | **No** | Yes | Yes |
| **Merge `CONTROL_PLANE` PRs** | **No** | **No** | **No** | **Blocked by ruleset** | Yes |
| **Publish sanitized public projection** | **No** | **No** | Yes | **No** | Yes |
| **Apply `evidence-waiver` label** | **No** | **No** | **No** | **No** | **Yes (Sole)** |
| **Modify `sources/original/`** | **Forbidden** | **Forbidden** | **Forbidden** | **Forbidden** | **Forbidden** |

## 3. GitHub App Migration & Ruleset Enforcement

- **PAT Retirement**: Personal Access Tokens (`AUTOMERGE_TOKEN`) tied to the maintainer's personal account conflate automated merges with human maintainer authority. Auto-merge must use a dedicated **GitHub App** with scoped `contents: write` and `pull_requests: write` permissions.
- **Ruleset Requirements on `main`**:
  1. Require pull request before merging.
  2. Require review from Code Owners (`.github/CODEOWNERS`, narrowed to control-plane paths so ordinary content PRs remain automergeable).
  3. Dismiss stale pull request approvals when new commits are pushed.
  4. Require status checks to pass (`check`, `evidence-diff`).
  5. Restrict bypass list to Maintainer only (audited periodically).
