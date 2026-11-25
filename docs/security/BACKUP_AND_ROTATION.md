# Encrypted Backup, Restore Drill & Credential Rotation (`BACKUP_AND_ROTATION.md`)

This document defines the operational controls for **D14** (snapshots, backups, restore verification) and **PK-01** credential hygiene.

## 1. Snapshot & Backup Taxonomy (D14)

- **Public Snapshots**: Immutable, publicly verifiable releases of the sanitized public dataset (permanent unless formally retracted with notice).
- **Private Encrypted Backups**: Full encrypted archives of the private repository (`sources/original/`, `sources/incremental/`, private discovery queue, operational manifests, holdout sets, and Git history).
- **Uncontrollable External Copies**: Forks, search caches, CDN mirrors, and external archives. These cannot be deleted after publication and must be declared in any incident disclosure.

## 2. Encrypted Backup Procedure

- **Frequency**: Daily incremental + weekly full snapshot of the private repository (`git bundle --all`).
- **Encryption**: Client-side encryption using `age` (X25519 public-key encryption) or KMS-wrapped AES-256-GCM before leaving the host. Private decryption keys are stored offline / in a hardware-backed secret manager, never in CI.
- **Storage**: Off-site redundant object storage with versioning and object-lock enabled.

## 3. Periodic Restore Drill (Quarterly)

Every quarter, the Maintainer executes a full restore test in an isolated temporary directory:

1. Fetch the latest weekly encrypted backup bundle and decrypt using the offline recovery key.
2. Verify archive SHA-256 checksum against the signed backup manifest.
3. Clone/unbundle into a clean temporary directory and run `git fsck --full`.
4. Run `pnpm install --frozen-lockfile && pnpm validate && pnpm test` to verify repository integrity and schema validity.
5. Record the drill date, bundle SHA-256, and verification result in the private operational log, then securely wipe the temporary directory.

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
