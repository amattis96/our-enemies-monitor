# Data Readiness Gate (M13)

No statistical method enters the Our Enemies Monitor engine without passing its **Data Readiness Gate** (`src/statistics/readiness-gate.ts`) and retrospective validation.

## Core Principles

1. **Elapsed time never activates a method alone.**
   Even if `elapsed_months >= 12` (the administrative minimum), a method remains `blocked` (or is closed as `unsuitable`) if any of the six statistical criteria fail.
2. **Unsuitability is a valid closing outcome.**
   Demonstrating that available data cannot support a statistical method closes the work cleanly via a formal `UnsuitabilityReport` without activating the algorithm.
3. **Separate observational pilot (`PK-33`).**
   Curated corpus records in `data/` are a selection, not a probability sample. Systematic frequency and spatial models read from the separate `observational_pilot` dataset (`src/statistics/observational-pilot.ts`), which tracks public denominators, ordinary non-hostile events, comparable retrospective series, and coverage over time.

## The 6 Readiness Criteria

| Criterion | Verification |
| --- | --- |
| `completeness` | Missing time periods (`missing_period_ratio`) and unmitigated `source_discontinuities` within bounds. |
| `denominator` | Public/systematic denominator present and methodologically coherent with the phenomenon. |
| `volume` | Sufficient number of usable observations (`usable_observations`) after deduplication. |
| `seasonality` | Sufficient complete seasonal cycles observed (`observed_cycles`). |
| `stability` | No breaking changes in collection criteria (`collection_criteria_changes`). |
| `validability` | Independent out-of-sample test period available with sufficient test observations. |

## Gated Methods

- **PK-32 (`incident-campaign.ts`)**: Platform-adapter coordination & lag signals; negative controls; zero automatic attribution from temporal correlation alone; shadow-only unless benchmark passes.
- **PK-34 (`sequential.ts`)**: Gate-conditioned Poisson / Negative Binomial baseline and ARL-calibrated CUSUM / EWMA with explicit repeated-testing control (naive Benjamini-Hochberg forbidden); internal queue items only.
- **PK-35 (`spatial.ts`)**: Gate-conditioned Kulldorff space-time scan statistic with exposure model and explicit geolocation precision; public-aggregation disclosure guard.
- **PK-36 (`experimental.ts`)**: Gate-conditioned Aalen-Johansen competing-risks attribution timing (no Kaplan-Meier cold-case reopening), capture-recapture (genealogical vs statistical independence caveat), co-occurrence with degree/case-structure null model (Louvain/Leiden internal-only), and Hawkes processes vs simpler baselines & external common causes (never causal proof).
- **PK-38 (`scenarios.ts`)**: End-to-end scenario runner (`acquisition -> discovery -> verification -> retraction -> publication`), interruption/recovery test, zero-leakage historical check, and anomaly/corrective register.
