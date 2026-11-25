# External AI Findability & Interpretation Benchmarks (PK-23)

This directory documents the external AI benchmark protocol implemented in `src/audit/ai-benchmark.ts`.

## 1. Benchmark Modes

1. **Findability (`findability`)**: External assistants queried with live web search enabled (`web_search_used: true`) to test whether public portal pages and canonical IDs are retrieved and cited.
2. **Interpretation (`interpretation`)**: External models given the public corpus directly (`corpus_available: true`, `access_mode: "direct_corpus"`) to test whether they preserve evidentiary caveats, distinguish E2 attribution from E1 conviction, and respect E5 hypotheses.

## 2. Required Trial Metadata

Every trial in `AiBenchmarkRunSchema` records:

- `corpus_available`, `web_search_used`, `language` (`it` | `en`)
- `model`, `model_version`, `access_mode` (`web_search` | `direct_corpus` | `hybrid`)
- `prompt`, `run_date` (`YYYY-MM-DD`), `repeat_index` (1-based, for repeat variability)
- `cited_urls`, `cited_ids`, `answer_text`, `passed`

## 3. Missing-Citation Causes vs Misinterpretations

Missing citations are classified separately from misinterpretations, and **verified** causes are strictly separated from **hypothesized** causes:

- **Cause kinds**: `poor_indexing`, `irrelevant_corpus`, `search_engine_policy`, `consulted_not_cited`, `unknown`.
- **Certainty**: `verified` (directly observed, e.g. search logs or crawler response) vs `hypothesized` (inferred explanation).
- **Misinterpretations**: `unsupported_inference`, `attribution_as_conviction`, `hypothesis_as_fact`, `invented_id`, `omitted_caveat`, `other`.

## 4. Non-Mutation Policy

**A single bad answer never triggers a page mutation.** `scoreAiBenchmarkRun` always sets `requires_page_mutation: false` and only surfaces `review_candidates` when a verified failure recurs across multiple trials. Monthly runs are compared with `compareMonthlyRuns`.
