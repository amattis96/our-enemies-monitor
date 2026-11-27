# Snapshots, Backup & Credential Rotation (`BACKUP_AND_ROTATION.md`)

This document defines the operational controls for **D14** (snapshots and backups, resolved by the owner on 26 November 2026) and **PK-01** credential hygiene.

## 1. Snapshot & Backup Taxonomy (D14)

- **Git history**: the single public repository is the authoritative record of data, sources, discovery queue, run manifests and knowledge-time revisions. Every change is a reviewed commit on `main`.
- **Snapshot register**: append-only transitions in `docs/snapshots/` (PK-05) state what was accepted and published at each moment.
- **Repository backup**: a periodic `git bundle --all` of the repository kept by the maintainer outside GitHub, so the project survives the loss of the GitHub account. No encryption is required: the content is already public.
- **Uncontrollable External Copies**: Forks, search caches, CDN mirrors, and external archives. These cannot be deleted after publication and must be declared in any incident disclosure.
- **No confidential estate**: there is no private repository to back up. If confidential human investigations are ever introduced (`private_investigative`, future and optional), their encrypted storage and restore drill will be defined by that new owner decision.

## 2. Backup Procedure

- **Frequency**: monthly, and before any history-sensitive maintenance (`git bundle create oem-YYYY-MM.bundle --all`).
- **Storage**: any storage under the maintainer's control outside GitHub, with the bundle SHA-256 recorded next to it.

## 3. Periodic Restore Drill (Quarterly)

Every quarter, the Maintainer executes a restore test in an isolated temporary directory:

1. Fetch the latest repository bundle.
2. Verify its SHA-256 checksum against the recorded value.
3. Clone/unbundle into a clean temporary directory and run `git fsck --full`.
4. Run `pnpm install --frozen-lockfile && pnpm validate && pnpm test` to verify repository integrity and schema validity.
5. Record the drill date, bundle SHA-256, and verification result in the maintainer's notes, then delete the temporary directory.

## 4. Credential Rotation Schedule

| Credential | Owner | Rotation Cadence | Immediate Rotation Trigger |
| :--- | :--- | :--- | :--- |
| **Auto-Merge GitHub App Private Key** | Maintainer | Every 90 days | Any accidental publication, CI compromise, or suspected leak |
| **Publication Gateway Token / App Key** | Maintainer | Every 90 days | Any gateway anomaly or unauthorized dispatch |
| **External AI / Embedding API Keys** | Maintainer | Every 90 days | Any boundary violation or provider incident |
| **Fine-grained PATs (legacy/fallback)** | Maintainer | Deprecate; 30 days max if temporary | Immediately upon migration to GitHub App |

## 5. Periodic Access Review (Quarterly)

- Audit repository collaborators, deploy keys, and installed GitHub Apps.
- Verify via GitHub API that the `main` branch ruleset is active, `CODEOWNERS` review is required, stale approvals are dismissed on new commits, and no unauthorized bypass actors exist.
- Verify `.github/CODEOWNERS` still includes `/.github/` (protecting itself) and does not reintroduce `*`.
