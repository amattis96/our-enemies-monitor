# ADR-06 — Caso e claim come dati

- **Stato:** Proposta (non sorvegliata, da confermare)
- **Data:** 2026-11-15 · **Blocco:** B18
- **Riferimenti:** FABLE A §7.1, P6, P8; FABLE C §5.2; FABLE D §11.4; CF-013, CF-014; AGENTS.md regole 4–7; [B18](../blocks/B18_ANALYSIS.md)

## Contesto

Un evento della baseline unisce in una frase fatto, attribuzione, smentita e giudizio (`TL-0059`: «il governo polacco attribuisce l'ordine ai servizi russi, che negano»). Le fasi di un caso sono eventi separati (`TL-0015` pagamenti, `TL-0092` condanna) e possono sembrare due conferme indipendenti. ARCHITECTURE.md rinvia i claim «a quando esistono dati veri».

## Decisione proposta

Opzione **B incrementale** di FABLE A §7.1, con modello additivo (`src/model/cases.ts`):

- **`Case`** (`CASE-####`): raggruppamento editoriale di eventi come fasi, con `grouping_basis` scritto a partire dai record. Non aggiunge affermazioni proprie. Due fasi dello stesso caso contano una volta.
- **`Claim`** (`CL-####`): una proposizione atomica con `kind` (`fact`, `attribution`, `denial`, `judgment`), `aspect` (`occurrence`, `perpetrator`, `sponsor`, `motive`, `impact`: regola 6), `asserted_by`, `asserted_on`, `responds_to` (obbligatorio per la smentita), `supersedes`, `evidence_level` (ADR-04), `relationships`, `transcribed_from` (campi di record esistenti), `person_status`, `sources`, `review`, `provenance` sempre vuota.
- **Persone (regola 7):** se un soggetto o chi afferma è una `person`, il claim deve avere `person_status` con stato procedurale esatto (`vocabulary.json#/procedural_statuses`), data con la sua precisione reale, fonte primaria `external_reference` citata dal claim e URL registrato su quella fonte. Altrimenti il claim non si scrive.
- **Nessuna generazione automatica:** i claim si scrivono a mano da record e fonti esistenti; mai per conversione meccanica della baseline né da un modello in blocco.
- **Collocazione:** finché l'ADR non è confermata i record vivono in `docs/audit/cases/pilot.v1.json`, validati da `pnpm validate`, non caricati dal sito, non esportati. Alla conferma si spostano in `data/cases/` e `data/claims/` (un file per record), con loader, gate M5 e esportazione additiva (ADR-10).
- **Pubblicazione:** `needs_review` resta fuori dal portale come per gli altri candidati; solo il manutentore imposta `reviewed`.
- **Stati facoltativi:** `refuted`/`closed_insufficient` esistono già sulle ipotesi; non si aggiunge uno stato al claim. Una confutazione è un nuovo claim che `supersedes` o `responds_to` il precedente.

## Conseguenze

- Fatto, attribuzione, smentita e giudizio diventano distinguibili con query strutturate (`queryClaims`, `caseLanes`, `denialsOf`, `casesOf` in `src/editorial/cases.ts`).
- Le corsie vuote sono informazione («non registrata»), utile al Fascicolo del caso (B19).
- Costo editoriale alto: ogni caso richiede rilettura umana.

## Alternative scartate

- Solo campi aggiuntivi sugli eventi (opzione A): non separa le affermazioni di un evento con verdetto diviso.
- Collezioni canoniche subito in `data/`: anticiperebbe gate, esportazioni e diff prima della conferma dell'ADR.
- Triple store (opzione C): contrario a «Git è il database».
