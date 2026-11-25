# Citability, OG Previews & Zenodo DOI Policy (PK-21)

This document describes how pages, records, and dataset snapshots of Our Enemies Monitor are made citable.

## 1. Build-Time Deterministic OG Preview SVGs

- Generator: `src/site/og-image.ts` (`renderOgSvg`, `ogCardInputFromModel`).
- Static endpoint: `web/src/pages/og/[id].svg.ts` (builds `/og/<ID>.svg` for every public event, entity, and hypothesis).
- Cards are 1200×630 deterministic SVGs using the Dossier palette, XML-escaped text, record ID badge, evidence level/kind badge, and an explicit E5 caveat on hypotheses.

## 2. `CiteThisPage.astro`

`web/src/components/CiteThisPage.astro` renders:

- **Generation date** (`generatedAt`, from snapshot or commit metadata—never wall-clock time).
- **Snapshot permalink** and optional **Zenodo DOI**.
- **Superseded / withdrawn notice** (`snapshotStatusNotice`): when `snapshotStatus` is `"superseded"` or `"withdrawn"`, displays a prominent warning banner with a link to `supersededByUrl`.
- **APA** and **BibTeX** citations (`formatApaCitation`, `formatBibtexCitation` in `src/site/seo.ts`).

## 3. `CITATION.cff` & Zenodo DOI Release Policy

`CITATION.cff` at the repository root follows Citation File Format 1.2.0 (`CC0-1.0`).

- **When to mint a Zenodo DOI**: Mint DOIs **only** for periodic milestone releases or methodologically significant releases (never on every routine data commit).
- **Release steps**:
  1. Verify `pnpm check` and `pnpm build` pass on the release commit.
  2. Record the snapshot transition in `docs/snapshots/` via `src/temporal/snapshots.ts`.
  3. Create the signed/annotated Git release tag and archive the release on Zenodo.
  4. Record the minted DOI in the release notes and `CITATION.cff` (if applicable).

## 4. DOI & Snapshot Withdrawal Procedure

If a published snapshot or DOI-backed release contains a critical evidentiary, legal, or privacy defect:

1. **Append a `snapshot.withdrawn` transition** in `docs/snapshots/` (via `src/temporal/snapshots.ts`) with a clear `reason`, or `snapshot.superseded` when replaced by a corrected release.
2. **Update `CiteThisPage.astro` metadata** for that snapshot so `snapshotStatus="withdrawn"` (or `"superseded"`) and `supersededByUrl` point to the current valid version.
3. **Zenodo tombstone**: Do not delete the Zenodo record silently; update the Zenodo metadata/description with a formal withdrawal or supersession notice linking to the replacement DOI.
