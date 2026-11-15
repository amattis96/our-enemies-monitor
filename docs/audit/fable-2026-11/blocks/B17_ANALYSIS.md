# B17 — Pilot fonti primarie e genealogia: analisi

Data: 15 novembre 2026 (Europe/Rome). Ramo `audit/fable-2026-11-implementation`; HEAD iniziale `4a6912b` (B16). Esecuzione non sorvegliata su mandato del manutentore. Nessun fetch o API esterna; nessun documento esterno letto; `sources/` e `provenance` intatti.

Fonti rilette: scheda B17 (§3 di [IMPLEMENTATION_BLOCKS.md](../IMPLEMENTATION_BLOCKS.md)); FABLE A §4.1, §4.7, §A2 e tabella §11 (E7); FABLE D §6.4; FABLE C N3; CONSOLIDATED_FINDINGS CF-009/CF-010; codice B12 (`src/audit/baseline.ts`) e B13 (`src/site/vocabulary.ts`, `test/vocabulary.test.ts`).

## 1. Stato verificato

| Punto | Stato all'ingresso |
| --- | --- |
| Modello `Source` | `id`, `type` (`corpus_document`, `external_reference`, `unspecified_web`), `title`, `publisher`, `files`, `urls`, `cited_in`; nessun campo di genealogia |
| Traccia della derivazione | Solo testo libero in `publisher` («Reuters (via Internazionale)», «Quartz (da Reuters)», «Associated Press (ripubblicato da The Washington Post)») |
| Documenti del corpus | S06, S07, S08 dichiarano nell'intestazione i propri input (Fonte_06 riga 6, Fonte_07 riga 7, Fonte_08 riga 9); S00–S05 e S09 sintetizzano fonti esterne non presenti come record |
| Relazioni E1 con sole fonti del corpus | 163 su 181 E1; nessun evento E1 nella stessa condizione |
| Eventi `EXT` con riferimenti esterni | 34, di cui 18 con un solo riferimento (coincide con A §4.7) |
| E7 nella misura B12 | Assente (B12 lo aveva escluso perché richiede `derived_from`) |
| Duplicati strutturali | Sei coppie di record con URL identico: F02/P02, F03/P04, F06/P09, F07/P06, F19/P10, WEB-EXT-001/002 |

## 2. Piano file per file

| File | Intervento |
| --- | --- |
| `src/model/vocabularies.ts` | `ORIGIN_TYPES` (7 valori di A §A2) |
| `src/model/schemas.ts` | `Source.origin_type`, `derived_from`, `relies_on`: opzionali, con `.describe()`; `pnpm schemas` aggiorna solo `schemas/sources.schema.json` |
| `src/site/format.ts`, `src/site/vocabulary.ts` | Etichette IT/EN, definizioni (criteri conservativi) e `must_not_read_as` in `vocabulary.json#/origin_types` |
| `src/pipeline/genealogy.ts` (nuovo) | `genealogyIssues`, `genealogyCycles`, `independentRoots`, `corpusOnlyE1`: funzioni pure |
| `src/pipeline/validate.ts` | Regola 14: riferimenti, auto-citazione, coerenza tipo/origine, cicli (errori); ripubblicazione senza `derived_from` e E1 su sole sintesi (avvisi) |
| `src/audit/baseline.ts`, `src/cli/benchmark.ts` | `e7IndependentRoots`: radici dai soli campi di genealogia; chiave `A.E7` additiva, baseline archiviata non toccata |
| `data/sources/S00–S09.json` | `origin_type: corpus_synthesis`; `derived_from` su S06/S07/S08; nota in `review.notes`; stato di revisione invariato |
| `docs/audit/sources/pilot.v1.json` (nuovo) | Proposta (`state: proposta`): 9 affermazioni sensibili, 7 genealogie candidate, 6 duplicati |
| `test/genealogy.test.ts` (nuovo), `test/vocabulary.test.ts` | 12 test; copertura del vocabolario per `origin_types` |
| Documentazione | `docs/ARCHITECTURE.md` (modello `Source`, regola 14, E7), `AGENTS.md` (regola sulla genealogia in «Adding or correcting data») |

Fuori perimetro: glifo delle radici sulle pagine (C N3), collegamenti `F*`/`P*` nelle relazioni, genealogia dei `WEB-EXT` nei dati, unificazione dei duplicati.

## 3. Regole di calcolo

- **Radice:** chiusura di `derived_from` ∪ `relies_on`; una fonte senza genitori è la propria radice, salvo `corpus_synthesis`, che non è mai radice. Due riferimenti con la stessa radice contano una volta. I cicli vengono interrotti nel calcolo e segnalati come errore dalla validazione.
- **Non determinato:** una fonte senza `origin_type` conta come propria radice ma è elencata in `undetermined`. L'assenza non significa mai «primaria».
- **E7:** per ogni evento `EXT`, riferimenti esterni (escluso il codice `S*`) → radici. `single_root` è il numero di eventi con una sola radice; `genealogy_coverage` dice quante fonti esterne hanno genealogia (oggi 0 su 96, quindi `single_root` = `single_reference` = 18).

## 4. Decisioni (esecuzione non sorvegliata, 2026-11-15)

Adottate dall'orchestratore su mandato del manutentore, da confermare.

| ID | Domanda | Opzioni | Adottata |
| --- | --- | --- | --- |
| D-B17-1 | Criteri di `origin_type` (ADR-05) | (a) liberi; (b) conservativi: valore solo se il repository lo stabilisce, assenza = non determinato | **(b)**. Definizioni in `vocabulary.json#/origin_types`; `official_statement` non si legge come fatto accertato o condanna |
| D-B17-2 | «Una sintesi del corpus non basta per E1» | avviso / errore | **Avviso**, uno per collezione con conteggio e primi 10 ID (163 relazioni). Un errore bloccherebbe il corpus senza una revisione umana. Elenco completo in `A.E7.e1_corpus_only` |
| D-B17-3 | Dati popolati | (a) nessuno; (b) solo S*; (c) anche `WEB-EXT` da `publisher` | **(b)**: `corpus_synthesis` deriva dal tipo del record, `derived_from` di S06–S08 dagli input dichiarati. (c) sarebbe un'euristica sul testo e richiede di stabilire quale record è l'originale: proposto in `pilot.v1.json` (GN-01…07) |
| D-B17-4 | `relies_on` partecipa ai cicli? | sì / solo `derived_from` | **Sì**: una citazione circolare è tale su entrambi i campi |
| D-B17-5 | Ripubblicazione senza `derived_from` | errore / avviso | **Avviso**: l'originale può mancare come record (GN-06, GN-07) |
| D-B17-6 | Conteggio delle radici a build time | (a) funzione pura; (b) anche glifo sulle pagine | **(a)**. Con i dati attuali le pagine mostrerebbero «0 radici» per le relazioni del corpus o radici non determinate: lettura fuorviante finché il pilota non è verificato. Il glifo passa a B19/B20 |
| D-B17-7 | Collegamenti `F*`/`P*` del campione | scrivere nei record / proposta | **Proposta** in `docs/audit/sources/pilot.v1.json` (`state: proposta`, `verified_by: null`): un test impedisce che il file risulti verificato o citi ID inesistenti |
| D-B17-8 | Versione della baseline B12 | incrementare / invariata | **Invariata (1)**: E7 è una chiave additiva; E1–E6 non cambiano |

## 5. Test

`test/genealogy.test.ts`: caso EXT-005 (dichiarazione + agenzia + ripubblicazione = una radice); sintesi del corpus mai radice; fonti senza genealogia contate come non determinate; cicli interrotti; ciclo segnalato una volta; riferimenti mancanti, auto-citazione e `corpus_synthesis` fuori posto; avviso sulla ripubblicazione; `corpusOnlyE1` solo sulle sintesi; dati canonici senza errori e con le derivazioni S06–S08; E7 da `derived_from` (applicando in memoria la genealogia di EXT-005, EXT-005 ed EXT-034 passano a una radice, +2); file del pilota rimane proposta e la genealogia proposta validerebbe.

## 6. Rischi

- I 163 avvisi sono aggregati in una riga: chi legge `pnpm validate` vede il problema ma non l'elenco completo (in E7).
- Le definizioni di `origin_type` non sono state rilette da un redattore.
- `independentRoots` presuppone che `relies_on` sostituisca la radice della fonte: un'agenzia che aggiunge cronaca propria va descritta con due fonti, non con una.

## 7. Azioni per il manutentore

1. Confermare o modificare D-B17-1…8, in particolare il livello (avviso/errore) di D-B17-2.
2. Per ciascuna voce PS-01…09 di `pilot.v1.json`: aprire il documento, cercare il passaggio indicato, compilare `verified_by`/`verified_on` e lo stato; solo dopo aggiornare `sources` dei record con una PR dedicata.
3. Verificare GN-01…07 (genealogia dei `WEB-EXT`) e, se confermate, scriverle nei record di fonte; poi `pnpm benchmark:measure` per ottenere A E7 da `derived_from` (A §4.7 riportava 20 eventi con una sola origine; il valore va ricalcolato, non imposto).
4. Decidere se unificare i sei duplicati di URL.

## Esito

- **Fatto:** campi additivi `origin_type`/`derived_from`/`relies_on` con descrizioni e voci di vocabolario; validazione dei cicli e della coerenza; `independentRoots` e `corpusOnlyE1`; avviso ADR-05 (163 relazioni E1 su sole sintesi); misura `A.E7` da sola genealogia; S00–S09 classificati `corpus_synthesis`, S06–S08 con `derived_from`; proposta del pilota con 9 affermazioni, 7 genealogie e 6 duplicati.
- **Verifica:** `pnpm check` verde, 291 test (27 suite); `pnpm validate` 0 errori, 24 avvisi (23 + 1 ADR-05); `pnpm build` e `pnpm check:links` verdi (931 pagine, 175.279 link, 0 problemi); `pnpm data:diff` exit 1 solo per i 2 errori ereditati su `ART-0001`/`ART-0002`, nessun errore nuovo (S00–S09 modificati senza toccare `provenance` o stato). E7 oggi: 34 eventi, 18 con un riferimento, 18 con una radice, copertura genealogica esterna 0/96.
- **Resta:** verifica umana dei collegamenti del campione e della genealogia dei `WEB-EXT`; acceptance «A E7 da `derived_from`» raggiungibile appena la genealogia è scritta nei dati, senza modifiche al codice; glifo delle radici sulle pagine (B19/B20).
