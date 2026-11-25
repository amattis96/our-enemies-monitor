# Engine Changelog

<!-- Generated from docs/automation/engine.manifest.json via src/engine/changelog.ts. Do not edit manually. -->

This file tracks versioned changes to engine methods, public thresholds, cadences, roles, and model assignments.
Security thresholds, protection details, investigative queries, and exact detection mechanics are excluded.

## v0.1.0 (2026-11-25) — initial manifest

### Methods
- **m5_evidentiary_gate** (added): Initial registration: m5_evidentiary_gate v1.0.0 (active)
- **missed_run_reconciliation** (added): Initial registration: missed_run_reconciliation v1.0.0 (active)
- **dormant_hypothesis_reactivation** (added): Initial registration: dormant_hypothesis_reactivation v1.0.0 (shadow)
- **retraction_containment** (added): Initial registration: retraction_containment v1.0.0 (active)

### Cadences
- Registered task_a_osint_ingest (Daily 00:30 Europe/Rome, active)
- Registered task_b_editorial (Mon/Wed/Fri 02:00 Europe/Rome, active)
- Registered task_c_review_fix (Daily 03:30 and 04:30 Europe/Rome, active)
- Registered task_d_legacy_merge (Paused 2026-11-21 (replaced by auto-merge.yml) Europe/Rome, paused)
- Registered auto_merge_workflow (On verified C handoff + green CI UTC, event_driven)
- Registered task_e_discovery (Daily 06:00 Europe/Rome, active)
- Registered task_f_ai_benchmark (Sunday 07:00 Europe/Rome, active)

### Roles
- Registered role task_a_osint_ingest
- Registered role task_b_editorial
- Registered role task_c_review_fix
- Registered role auto_merge_workflow
- Registered role human_maintainer
- Registered role task_e_discovery
- Registered role task_f_ai_benchmark

### Models
- task_a_osint_ingest: openai-chatgpt/scheduled-automation
- task_b_editorial: openai-chatgpt/scheduled-automation
- task_c_review_fix: openai-chatgpt/scheduled-automation
- task_e_discovery: openai-chatgpt/scheduled-automation
- task_f_ai_benchmark: openai-chatgpt/scheduled-automation
