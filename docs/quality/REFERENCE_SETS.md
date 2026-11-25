# PK-02 Reference Sets & Access Boundaries

This document defines the three-tier reference set architecture built on top of `docs/audit/baseline/benchmark-cases.v1.json` (`B1`–`B20`).

> **Methodological limit (26 November 2026).** All three tiers are public files in the repository. The role guards in code stop cooperating callers from reading solutions, but any agent with repository access can read them. The `holdout` tier is therefore a **held-out public split, not an independent holdout** (`HOLDOUT_IS_INDEPENDENT = false`); the quality report states it (`holdout_aggregate.independent: false`). Independent validation needs a fresh case set never exposed to the evaluated agent, or an external evaluator; such a set is not stored in this repository (`holdout_evaluation` cannot reach it).

## Tiers

| Tier | Case Range | Purpose | Solution Access |
| :--- | :--- | :--- | :--- |
| `dev` | `B1`–`B10` | Rapid iteration, local debugging, unit tests | Open (`implementation_agent`, `evaluator`, `human_reviewer`) |
| `validation` | `B11`–`B15` | Prompt-change tuning and cross-model comparison | `evaluator` and `human_reviewer` only (prompts-only for agents) |
| `holdout` | `B16`–`B20` | Held-out public split for pre-release checks (not independent) | Blocked in code for `implementation_agent`; `evaluator` returns aggregate metrics only |

## Scorer self-check vs agent metrics

`pnpm quality:report` scores the dev set's **expected** answers only to check the scorer (`scorer_self_check_pass_rate`). These are never agent results: `agent_metrics.measured` stays `false` until answers from a recorded agent run are scored.

## Access-Boundary Enforcement

Enforced in `src/quality/reference-sets.ts`:

1. `getReferenceSetSolutions(tier, role)` throws `ReferenceSetAccessError` whenever `role === "implementation_agent"` requests `holdout` or `validation`.
2. `getReferenceSetPrompts(tier, role)` blocks `implementation_agent` from inspecting `holdout` prompts as well, preventing targeted prompt overfitting.
3. `evaluateHoldoutAggregate(answers, role, knownIds)` rejects `implementation_agent` and, for `evaluator` / `human_reviewer`, returns **only aggregate metrics** (`total_cases`, `answered`, `passed`, `pass_rate`, `abstention_rate`, `forbidden_hits`, `invented_ids`, `mean_completeness`, `rotation_id`, `evaluated_at`) with zero per-case identifiers or expected answers.

## Rotation Policy

Holdout epochs are tracked via `RotationRecordSchema`:

- Each epoch has a `max_evaluations` budget (default `25` in `docs/quality/thresholds.v1.json`).
- `needsRotation(record)` triggers when `status === "scheduled"`, `contamination_risk === "high"`, or `evaluations_count >= max_evaluations`.
- `advanceRotation(current, newRotationId, reason)` retires the current epoch with a timestamp and opens a fresh active epoch.
