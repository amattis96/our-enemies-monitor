# `@our-enemies-monitor/mcp`

Read-only Model Context Protocol (MCP) server over the Our Enemies Monitor public query library (`src/query/`).

## Design Principles

- **Public projection only**: All queries run through `publicationReport` + `buildReadModel` + `suspendedRecordIds()` (PK-07). Withheld, unreviewed, suspended, and restricted person records are never exposed, nor are PK-05 private `acquired`/`verified` modes.
- **Zero duplicated query logic**: Every MCP tool validates inputs with Zod and delegates directly to `QueryEngine` in `src/query/index.ts`.
- **Staleness awareness (PK-07)**: Every response includes `snapshot`, `staleness`, `canonical_ids`, `sources`, and `caveats`. When the local snapshot exceeds `DEFAULT_MAX_STALENESS_SECONDS` (24 hours), `staleness.stale` is `true` and a staleness warning is attached.
- **Complexity limits**: Pagination limits (`limit <= 100`, `offset <= 10000`), query length limits (`<= 200`), and graph path limits (`max_steps <= 6`, `max_paths <= 10`, `max_visited_nodes <= 500`) are enforced.

## Tools

- `search_records` — Search public records with domain, relation class/group, period, evidence level, theme, and place filters.
- `get_entity` — Retrieve a public entity with unrestricted relationships and hypotheses.
- `get_event` — Retrieve a public event with citing relationships.
- `get_case` — Retrieve a public editorial case and its public claims.
- `get_relations` — Query unrestricted public relationships.
- `get_evidence` — Progressive evidence retrieval (`summary`, `standard`, `full`).
- `find_paths` — Documented relationship paths with sources, B15 caveat interruptions, step limits, and optional PK-11 path grammar.
- `get_timeline` — Chronological timeline with site-parity filters.
- `get_changes` — Public Git change history.
- `get_methodology` — E1–E5 evidence levels, B15 rules, and glossary.
- `get_open_questions` — Extension tool for public E5 hypotheses and discovery queue questions.
- `get_coverage` — Extension tool for public corpus coverage counts.

## Running

```bash
node packages/mcp/src/server.ts
```
