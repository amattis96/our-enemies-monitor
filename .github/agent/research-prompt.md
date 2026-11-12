# Legacy research agent prompt (retired)

The weekly GitHub Actions research agent that invoked `anthropics/claude-code-action`
and required `ANTHROPIC_API_KEY` has been **retired** as part of the M6
architecture decision (2026-11-12). This filename is retained only so that
older references do not accidentally instruct an agent to run an obsolete
API-based research pipeline.

**Current authority:**

1. [AGENTS.md](../../AGENTS.md) for immutable-source, evidence,
   publication and contribution rules.
2. [M6 ChatGPT OSINT workflow](../../docs/M6_CHATGPT_OSINT_WORKFLOW.md)
   for scheduled Task A, planned Task B and deterministic ingestion.
3. [Architecture](../../docs/ARCHITECTURE.md) for the actual data model.

Do **not** use the old instructions that generated `data/` directly on a
weekly GitHub-hosted LLM run. ChatGPT Task A currently proposes a new
`sources/incremental/Fonte_XX*.md` on a separate PR. Machine-assisted
canonical ingestion has not yet been implemented.
