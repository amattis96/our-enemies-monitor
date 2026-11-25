# Accidental Publication Tabletop Drill (`INCIDENT_DRILL.md`)

This document records the tabletop incident response drill for accidental publication, satisfying `PK-01` acceptance criteria.

## 1. Drill Scenario

- **Trigger**: A misconfigured export or unguarded PR merges a `needs_review` investigative record containing unredacted personal contact details and an internal `holdout_evaluation` reference (`docs/quality/sets/`) into the public branch, and `ci.yml` deploys it to GitHub Pages.
- **Detection**: Automated post-deploy audit or maintainer review flags the leaked identifier in `web/dist` and the public JSON export.

## 2. Roles

| Role | Responsibility during drill |
| :--- | :--- |
| **Maintainer (`@amattis96`)** | Incident commander; toggles `AUTOMERGE_ENABLED=false`; approves emergency PRs; authorizes history rewrite and credential rotation. |
| **Gateway Operator** | Runs `validatePublicationGateway()` locally/in isolated runner to identify root cause and verify clean sanitized output. |
| **Investigator** | Assesses sensitivity of leaked data (PII, source protection, holdout integrity) and drafts retraction/notice text. |

## 3. Timed Execution Checklist

| Phase | Target Window | Actions | Verification |
| :--- | :--- | :--- | :--- |
| **1. Detection & Triage** | `T+0` to `T+15m` | Confirm leak scope (commit SHA, affected files, live URLs, search index, artifacts). | Scope list recorded in incident log. |
| **2. Containment** | `T+15m` to `T+30m` | Set `AUTOMERGE_ENABLED=false`; cancel active `ci.yml` / `publish-gateway.yml` runs; place `automerge:hold` on open PRs. | `gh run list` shows no active deploy; auto-merge halted. |
| **3. Retraction & Rebuild** | `T+30m` to `T+1h` | Remove leaked record from public repo, add leak pattern to `validatePublicationGateway()`, rebuild and redeploy clean `main`. | `validatePublicationGateway()` passes; live URL returns 404/clean state. |
| **4. Credential Rotation** | `T+1h` to `T+2h` | Rotate GitHub App private key / any exposed tokens per `BACKUP_AND_ROTATION.md`; audit access logs. | Old tokens revoked; new tokens verified. |
| **5. History Rewrite (if PII/secrets)** | `T+2h` to `T+4h` | Verify encrypted backup, run `git filter-repo` on public repo to purge leaked blob, force-push `main`, request cache purge. | `git log -S <leaked-token>` returns empty. |
| **6. Disclosure & Uncontrollable Copies** | `T+4h` to `T+24h` | Publish incident notice; explicitly list uncontrollable copies (forks, web archives, search caches, CDN mirrors). | Notice published; regression test added to `test/security.test.ts`. |

## 4. Drill Sign-Off Criteria

- [x] Containment steps execute without relying on `pull_request_target` or unpinned actions.
- [x] `validatePublicationGateway()` blocks the simulated leaked record before any public export is emitted.
- [x] Credential rotation and uncontrollable-copies declaration steps are documented and assigned.
