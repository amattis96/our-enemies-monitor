# Contributing to Our Enemies Monitor

*Italiano più sotto.*

Thank you for helping. This project lives or dies on evidentiary discipline:
every contribution must make clear **what a source establishes, who says it,
when, and what remains unknown**.

## Ways to contribute

| You want to… | Use |
| --- | --- |
| Report an error, a retraction, an acquittal or an outdated status | [Correction issue](https://github.com/amattis96/our-enemies-monitor/issues/new?template=correction.yml) |
| Propose a new event, relationship or source | [New evidence issue](https://github.com/amattis96/our-enemies-monitor/issues/new?template=new-evidence.yml) |
| Improve an English translation | Pull request editing the `en` text, or an issue |
| Change code, schemas or the site | Pull request (read [AGENTS.md](AGENTS.md) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)) |

## Evidence rules (summary)

- Cite **primary sources** whenever possible: judgments, official decisions,
  sanction acts, technical reports. Journalism is welcome but recorded as such.
- Use the evidence levels E1–E5 described on the
  [methodology page](https://amattis96.github.io/our-enemies-monitor/en/methodology/).
  An institutional attribution (E2) is not a conviction (E1).
- Keep **event, perpetrator, sponsor, motive and impact** as separate claims.
- **Named people:** give the exact act, its date and the legal or procedural
  status. Do not submit personal data without public relevance, and never
  propose links based on nationality, ideology or association.
- **Hypotheses** (E5) go in the hypothesis register, never in the graph.
- No invented precision: unknown dates, places or figures stay unknown.
- Include **contrary evidence** you are aware of.

## Pull requests that change data

1. Edit only `data/` (one JSON file per record). Never edit `sources/original/`.
2. New records from contributors use `review.status: "needs_review"`.
   New events start as `EXT-###` (pending timeline integration); new sources
   as `WEB-EXT-###` with their URL.
3. Run `pnpm install`, then `pnpm format:data` and `pnpm check`.
4. Fill in the pull request template. CI publishes an **evidence diff** of
   your data changes in the job summary; maintainers review it before merging.

Changing the Italian text of a translated record makes its English
translation stale: re-translate it (see AGENTS.md › Translations).

## Licensing

By contributing you agree that your code is released under the
[MIT License](LICENSE) and your original data, research and documentation
under [CC0 1.0](LICENSE-DATA.md), to the extent you hold the rights. Do not
submit third-party material you are not allowed to share.

---

## In italiano

Grazie per il contributo. Il valore del progetto dipende dal rigore sulle
prove: ogni contributo deve chiarire **cosa stabilisce una fonte, chi lo
afferma, quando, e cosa resta ignoto**.

- Errori, rettifiche, assoluzioni o stati superati: apri una
  [segnalazione di correzione](https://github.com/amattis96/our-enemies-monitor/issues/new?template=correction.yml).
- Nuovi eventi, relazioni o fonti: apri una
  [proposta di nuova evidenza](https://github.com/amattis96/our-enemies-monitor/issues/new?template=new-evidence.yml).
- Cita fonti primarie, usa i livelli E1–E5, separa evento, autore, mandante,
  motivo e impatto, indica lo stato procedurale esatto per le persone nominate,
  tieni le ipotesi fuori dal grafo e segnala le prove contrarie.
- Nelle pull request modifica solo `data/`, imposta `review.status` a
  `needs_review` per i nuovi record ed esegui `pnpm format:data` e `pnpm check`.
- Contribuendo accetti la licenza MIT per il codice e CC0 1.0 per dati e
  ricerca originali, nei limiti dei diritti che detieni.
