## Summary

<!-- What changes and why. -->

## Data changes (if `data/` is touched)

- **Sources:** <!-- primary sources first: URL, publisher, date -->
- **Known vs. inferred:** <!-- what the sources establish / what is interpretation -->
- **Contrary evidence and limits:** <!-- or "none found" after searching -->

The CI job summary shows the **evidence diff** of this pull request. Check it.

## Checklist

- [ ] I edited only `data/` for data changes and never `sources/original/`.
- [ ] New records have `review.status: "needs_review"`; IDs are new and never reused.
- [ ] Named people: exact act, date and procedural status; a primary source is linked.
- [ ] Unproven links are hypotheses, not relationships; no invented dates, places or figures.
- [ ] `pnpm format:data` and `pnpm check` pass (and `pnpm build && pnpm check:links` for site changes).
- [ ] Documentation updated if behaviour, commands or rules changed (see AGENTS.md).
