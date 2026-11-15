# ADR-10 — Compatibilità di `data/v1`

- **Stato:** Proposta (non sorvegliata, da confermare)
- **Data:** 2026-11-15 · **Blocchi:** B13 (applicata come D-B13-6), B18, B20
- **Riferimenti:** FABLE D §11; CONSOLIDATED_FINDINGS M3 (criterio di uscita); [B13](../blocks/B13_ANALYSIS.md); [B18](../blocks/B18_ANALYSIS.md)

## Decisione proposta

1. **In `v1` solo aggiunte:** nuovi file, nuove sezioni di `vocabulary.json`, nuovi schemi in `schemas/`, nuovi campi facoltativi. Nessun campo esistente viene rinominato, rimosso o cambiato di significato o di tipo; nessun valore controllato esistente viene ridefinito.
2. **Rotture solo in `v2`:** un cambio incompatibile (per esempio rimuovere `evidence_status`, ADR-04) si pubblica in `data/v2/` in parallelo a `v1`, con un periodo di convivenza annunciato nel catalogo `index.json`; `v1` non si modifica retroattivamente.
3. **I candidati non entrano negli export:** record `needs_review` (inclusi casi e claim del pilota B18) non compaiono nei file di dati; il registro `withheld.json` resta l'unico segnale, per le collezioni canoniche.
4. **Casi e claim** entreranno, dopo la conferma di ADR-06, come file aggiunti (`cases.json`, `claims.json`) in `v1`.

## Applicazione in B18

- Aggiunti: `schemas/cases.schema.json`, `schemas/claims.schema.json` (pubblicati in `data/v1/schemas/`); sezioni `claim_kinds`, `claim_aspects`, `procedural_statuses` in `vocabulary.json`.
- Nessun file di dati cambia; un test verifica che gli ID del pilota non compaiano negli export.
