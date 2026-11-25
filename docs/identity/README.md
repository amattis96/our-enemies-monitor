# Entity Identity & Resolution (PK-04)

This directory stores persisted entity linkage decisions and reversible entity lifecycle history.

## Principles

1. **Qualified External Identifiers First**: Primary matching relies on ISO 17442 LEI, national `registry_number + jurisdiction`, `wikidata_qid`, and `official_website`. Name similarity is secondary.
2. **Non-destructive Transliteration**: Cyrillic-to-Latin transliteration and accent/punctuation normalization are computed purely for comparison; canonical entity names are never overwritten.
3. **Zero Automatic Merges**: `audit:entities` (`src/cli/audit-entities.ts`) only emits candidate pairs (`same`, `uncertain`, `distinct`). Merges and splits require explicit human confirmation and reviewer attribution.
4. **Persisted `distinct` Respect**: Pairs marked `distinct` in `decisions.v1.json` are never proposed for merge or auto-merged.
5. **Reversible Lifecycle**: Every merge and split records a full `snapshot_before` and `RedirectRecord` entries in `redirects.v1.json` so operations can be reverted cleanly.
6. **Person Data Minimization**: Person entities allow only relevant public-interest attributes (`public_roles`, `sanctions_listed`, `external_ids`, `aliases`) and reject sensitive personal data.

## Usage

```bash
node src/cli/audit-entities.ts
node src/cli/audit-entities.ts --min-score 0.6 --limit 20
```
