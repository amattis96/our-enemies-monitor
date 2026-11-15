# Scheduled task run log contract

Applies to **Tasks A, B, C and D**. The task's visible ChatGPT result is
mandatory; a dedicated maintainer-selected GitHub issue may receive
**one structured comment per execution** only once configured and
writable. As of 15 November 2026 no such issue has been configured.
An absent destination means `log_delivery: not_configured`, not
failure of the research itself; never create an issue or move logs to
another location without authorization. Logs and PR comments can be
edited and are not cryptographically independent evidence.

Each attempt gets a stable Run-ID containing its task identifier and
actual UTC start time, with an optional attempt suffix. Record the
scheduled trigger separately from actual execution. Missing values are
`null` or explicitly `unverified`; never invent timestamps, source
coverage, tests, approvals or GitHub actions.

```yaml
run_id: <A|B|C|D>-<actual-UTC-start>-<attempt>
task: <A|B|C|D>
trigger_scheduled: <ISO timestamp with offset or null>
started: <ISO timestamp with offset or null>
finished: <ISO timestamp with offset or null>
main_start_sha: <SHA or null>
instructions_commit: <SHA or null>
coverage_planned: <window or null>
coverage_actual: <actual window and limitations or null>
questions_and_queries: []
sources_consulted: []
new_material_and_duplicates: []
candidates_discarded_and_reasons: []
prs_created_or_reviewed: [] # URL, category, head/base SHA, changed files
excluded_pr_metadata: [] # C/D: URL, number, SHA, reason; no payload inspection
corrections_and_commits: [] # C: files and new SHA; D: merge commit SHA
review_handoffs: [] # C verdict and exact SHA, D verification of that handoff
checks: [] # status, conclusion, URL and exact checked SHA; pending/not run explicit
main_ci_and_deploy: [] # D: each merge's resulting main SHA and final CI/deploy
obstacles: []
remaining_actions: []
outcome: <findings|no_material_update|partial|blocked|failed>
log_delivery: <delivered|failed|not_configured>
```

Use `no_material_update` only after the planned coverage was actually
completed and found no defensible material. An interrupted search or
unverifiable CI is `partial` or `blocked`, not a negative scan.
Report outcomes of acquisition and ingest separately when A performs both.

For **C**, also write one PR-local handoff comment beginning
`OEM Task C | Review & Fix` per reviewed eligible PR. It identifies
PR URL, exact reviewed head SHA, base SHA, evidence checked, changes
and fixes, check URLs/conclusions and one of:
`READY_FOR_D`, `PENDING_CHECKS`, `BLOCKED_HUMAN`,
`BLOCKED_EVIDENCE`, `BLOCKED_TECHNICAL`, `STALE`.
Only mark READY when the necessary checks are green for the current SHA.
This handoff is **not** GitHub APPROVE or editorial authorization.

For **D**, independently confirm the handoff and live GitHub data and
record `MERGED`, `PENDING_C`, `STALE`, `PENDING_CHECKS`,
`PENDING_MAIN_CI`, `BLOCKED_POLICY`, `BLOCKED_EVIDENCE`,
`BLOCKED_EDITORIAL`, `BLOCKED_TECHNICAL` or `EXCLUDED`
for each PR. Report the merge SHA and observed post-merge CI/deploy,
never just a generic success. If a relevant check is still running,
stop further merges and report `PENDING_MAIN_CI`.

URLs document consultation, not proof that the quoted source supports a
claim. Never include secrets or unnecessary personal information in logs,
and never put run-log files inside research PRs or source archives.
