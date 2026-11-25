# Search & AI Discoverability (PK-20)

This document describes the automated SEO/GEO checks, crawl policy, structured data, and textual alternatives implemented for Our Enemies Monitor.

## 1. Automated Post-Build SEO Check (`src/cli/check-seo.ts`)

Run after `pnpm build`:

```bash
node src/cli/check-seo.ts [--dist web/dist] [--published-urls <file.json>]
```

### Blocking Errors (exit code 1)

1. **`withheld_leak`**: Any withheld or private record ID appearing in rendered HTML pages, `data/v1/` JSON/CSV exports, `sitemap*.xml`, `changes.feed.json`, social metadata (`og:*` / `twitter:*`), JSON-LD `<script type="application/ld+json">`, or Pagefind search index files.
2. **`missing_essential_caveat`**: Missing essential evidentiary caveats (e.g., E5 open-question notice on `/hypotheses/` pages, public-projection caveat on `/data/`, or pages marked `data-requires-caveat` without a `data-caveat` element).
3. **`invalid_canonical`**: Missing `<link rel="canonical">`, non-absolute URL, or canonical path mismatching the page path.
4. **`inconsistent_hreflang`**: Non-reciprocal `hreflang` alternates or missing `x-default` when alternates are declared.
5. **`invalid_jsonld`**: Malformed JSON-LD, missing `@context` (`https://schema.org`) or `@type`, missing `name`/`headline`, or misleading structured data (such as `ClaimReview`/`FactCheck` on a hypothesis page).
6. **`broken_essential_link`**: Broken internal `<link>` or essential `<a>` link in `web/dist`.
7. **`removed_url_without_redirect`**: A previously published URL removed from `web/dist` without a redirect or documented exception.

### Non-Blocking Warnings (exit code 0)

- **`title_length`**: `<title>` outside 15–65 characters.
- **`description_length`**: `<meta name="description">` outside 50–160 characters.
- **`lead_summary_too_long`**: `.lede` summary exceeding 40 words.
- **`missing_og_image`**: Missing `<meta property="og:image">`.

## 2. Content-Based `lastmod`

`isSignificantContentChange` and `contentLastmod` in `src/site/seo.ts` compute `lastmod` (`YYYY-MM-DD`) strictly from substantive content changes and Git/content dates—never from wall-clock time or formatting-only edits.

## 3. `robots.txt` & Decision D5

`web/public/robots.txt` explicitly separates search/citation indexing from bulk AI model training:

- **Allowed**: Standard search crawlers and search/citation assistants (`OAI-SearchBot`, `ChatGPT-User`, `PerplexityBot`, `Claude-SearchBot`).
- **Disallowed (provisional D5)**: Bulk training crawlers (`GPTBot`, `CCBot`, `Google-Extended`, `ClaudeBot`, `Bytespider`, `Applebot-Extended`), pending final maintainer Decision D5.

## 4. `llms.txt` (Item 106)

`web/public/llms.txt` provides a concise machine-readable index of the portal, evidentiary caveats (Italian canonical, E1–E5 levels, E5 hypotheses are not facts), and links to `data/v1/index.json`, `articles.json`, `changes.feed.json`, and `CITATION.cff`.

## 5. Textual Alternatives (`TextAlternative.astro`)

`web/src/components/TextAlternative.astro` renders structured, linkable textual lists for interactive views (`network`, `timeline`, `atlas`) so screen readers, non-JS clients, and crawlers can access every public relationship, timeline entry, and country summary.

## 6. Semantic JSON-LD (`src/site/jsonld.ts`)

- `datasetJsonLd` (`Dataset`) and `articleJsonLd` (`Article`, skipping `fixture: true`).
- `eventJsonLd` (`Event` for events; `CreativeWork` for `dataset_metadata`), using country-level `Country` locations only (never invented coordinates).
- `entityJsonLd` / `organizationJsonLd` / `personJsonLd` (`Person`, `Organization`, `Country`, or `Thing` depending on `entity.kind`).
- `sourceJsonLd` (`CreativeWork` with publisher and `sameAs` URLs).

## 7. Search Console, Bing Webmaster Tools & IndexNow (Decision D10)

Account registration and verification tokens for Google Search Console, Bing Webmaster Tools, and IndexNow remain under maintainer control (Decision D10) and are not stored in the repository.
