# Scheduled task run log contract

This is the adopted operational contract; external application is pending. It is not an implemented logger or a record of past runs. The maintainer selects and configures a dedicated GitHub issue and verifies comment permissions. Each task posts one structured comment per attempt and also returns the same report in ChatGPT. Comments are editable and do not independently prove execution. If the issue is unknown or unwritable, do not create it, change permissions or use an alternative channel: retain the report in ChatGPT, set `log_delivery: not_configured` or `failed`, and request maintainer action. Delivery failure is separate from the work outcome. Never include logs in research PRs or source archives.

Use a stable Run-ID for each attempt: task, actual UTC start timestamp and an optional attempt number. Record actual start and end with offsets; keep the scheduled trigger separate. Unknown or unobserved values are null or explicitly unverified. Outcomes are `findings`, `no_material_update`, `partial`, `blocked`, or `failed`. Use `no_material_update` only after the intended coverage was actually completed; unavailable sources or partial coverage are not a negative finding and do not justify `closed_insufficient`.

Copy this template for every run; omit secrets and unnecessary personal data:

```yaml
run_id: <task-actual-UTC-start-attempt>
task: <A|B|C>
trigger_scheduled: <timestamp with offset or null>
started: <actual timestamp with offset or null>
finished: <actual timestamp with offset or null>
main_start_sha: <sha or null>
instructions_commit: <sha or null>
coverage_planned: <window or null>
coverage_actual: <window and limitations or null>
questions_and_queries: []
sources_consulted: []
new_material_and_duplicates: []
candidates_discarded_and_reasons: []
prs_created_or_reviewed: [] # URL and exact head SHA
excluded_pr_metadata: [] # C: URL, number, SHA and reason; no payload
checks: [] # name, result, URL and SHA; identify pending and not run
obstacles: []
remaining_actions: []
outcome: <findings|no_material_update|partial|blocked|failed>
log_delivery: <delivered|failed|not_configured>
```

URLs document consultation, not support for a claim. Do not reconstruct missing runs or infer execution from silence. Examples below are **abstract illustrations**, not actual runs:

- Completed coverage with supported material: `outcome: findings`; describe sources and proposed PR with its SHA.
- Completed intended coverage with no material change: `outcome: no_material_update`; record actual window and queries.
- Incomplete coverage or an execution error: `outcome: partial` or `failed`; describe missing access and checks not run.
- A valid work report whose issue is unavailable: keep its actual outcome and set `log_delivery: not_configured` or `failed`.
