# B19 — Viste investigative: analisi

Data: 15 novembre 2026 (Europe/Rome). Ramo `audit/fable-2026-11-implementation`; HEAD iniziale `1375c68` (B18). Esecuzione non sorvegliata su mandato del manutentore. Nessuna scrittura in `sources/` o `provenance`; nessun fetch o API esterna.

Fonti rilette: scheda B19 (§3 di [IMPLEMENTATION_BLOCKS.md](../IMPLEMENTATION_BLOCKS.md)); FABLE C §C4, §§5.2–5.5, 8.2–8.3, 9, 11, 12.2; baseline B12 (`docs/audit/baseline/baseline-2026-11-15-85c92c5.json`); B18 (stato del pilota Case/Claim).

## 1. Stato verificato

| Punto | Stato all'ingresso |
| --- | --- |
| Esposizioni | 14 record `X-001…X-014` trascritti da Fonte_08 §12.2 (`src/pipeline/baseline/exposures.ts`); nessun campo di raggruppamento né ordine. `/dependencies/` mostra 14 schede indipendenti |
| Filiera terre rare | Quattro stadi già presenti: `X-004` estrazione 60% (2024), `X-002` raffinazione 91% (2024), `X-003` magneti 94% (2024) — tutti «Quota cinese della produzione mondiale» —, `X-001` 98% della domanda UE coperta da importazioni (periodo non indicato, altra grandezza) |
| Prima/dopo | Già dentro i record: `X-011` (quasi 40% nel 2021 → circa 10% nel 2025, stessa etichetta) e `X-012` (meno del 20% → quasi 45%, periodi non indicati; etichette «prima»/«dopo»). Non ricavabile in modo strutturale da `X-007`/`X-010`, che hanno due misure diverse con la stessa unità: serve il campo editoriale |
| Classi di ruolo | Non esistono. Esistono 30 classi originali di relazione e 8 gruppi di visualizzazione (`RELATION_CLASS_GROUP`, con le override di B07) e i livelli E1–E4. La classificazione dei predicati di partecipazione di C §5.4 («attribuita da un'istituzione», «parte in conflitto»…) sarebbe una classe nuova |
| Federazione Russa (`RU`) | 37 relazioni pubbliche: 15 dirette, 22 partecipazioni con 16 predicati letterali distinti (coerente con «16 ruoli diversi» di C E5) |
| Caso | Il pilota B18 (`docs/audit/cases/pilot.v1.json`) è `needs_review`, fuori da `data/` e dagli export; ADR-06 è proposta, non confermata |
| Domande | Nessun motore di query nel sito; la data dell'attribuzione non è un dato (C §9) |
| Baseline B12 | Misura A E1–E7 e D T1–T11; **non** contiene esecuzioni dei compiti utente di C §12.2 (servono partecipanti umani) |

## 2. Piano file per file

| File | Intervento |
| --- | --- |
| `src/model/vocabularies.ts` | `EXPOSURE_GROUP_KINDS` (`supply_chain`, `before_after`), `EXPOSURE_GROUP_KIND` (`rare_earth_magnets` → filiera, `eu_gas` → prima/dopo), `EXPOSURE_GROUPS` |
| `src/model/schemas.ts` | Campo **facoltativo** `group: { id, position }` su `Exposure`, con `.describe()`; `pnpm schemas` |
| `data/exposures/X-001…004, X-011, X-012` | Solo il campo `group` (6 record); testi, misure, fonti, stati e `provenance` invariati |
| `src/pipeline/exposure-groups.ts` (nuovo) + `validate.ts` | Controlli strutturali (errori): ≥ 2 membri, posizioni 1..n, una misura per stadio di filiera, due misure con la stessa unità per prima/dopo |
| `src/site/dependencies.ts` (nuovo) | `exposureGroupViews`: stadi ordinati, «stessa grandezza del precedente» (stessa unità e stessa etichetta italiana), stadio più concentrato solo fra stadi confrontabili con valori `exact`, con il denominatore; nessuna differenza o indice calcolato. Etichette bilingui dei gruppi |
| `src/site/roles.ts` (nuovo) | `roleMatrix`: relazioni pubbliche di un nodo per gruppo esistente × livello, totale, periodo (date d'inizio degli eventi collegati), relazioni senza evento, predicati letterali di partecipazione; relazioni riservate su persone contate solo per livello |
| `src/site/vocabulary.ts` | Sezione `exposure_groups` in `vocabulary.json` (etichetta, tipo, definizione, `must_not_read_as: measure, causal_link`) |
| `web/src/pages/[...lang]/dependencies.astro` | Sezione «Filiere e confronti prima/dopo» sopra le 14 schede (che restano) |
| `web/src/pages/[...lang]/entities/[id].astro` | Sezione «Matrice dei ruoli» per entità con ≥ 3 relazioni pubbliche |
| `test/views.test.ts` (nuovo), `test/vocabulary.test.ts` | 5 test nuovi + copertura del vocabolario |
| Documentazione | `docs/ARCHITECTURE.md` (sezione B19, modello, regola di validazione 16, rotte, layout), `README.md` (roadmap), `AGENTS.md` (regola sul campo `group`) |

Nessun nuovo simbolo nello sprite: nessun nuovo tipo di entità né gruppo di relazione; le icone dei gruppi esistono già (`RELATION_GROUP_ICON`). Solo token semantici (`--rule`, `--rule-strong`, `--ink`, `--paper-raised`), stadio evidenziato con bordo **e** testo, mai solo colore.

## 3. Regole delle viste

- **Nessuna misura senza denominatore, periodo e fonte.** Ogni stadio e ogni coppia mostrano valore con qualificatore, periodo (o «periodo non indicato dalla fonte»), «cosa misura» (il perimetro del record) e fonti. La matrice dei ruoli mostra base (n relazioni pubbliche), periodo e fonte (`data/v1/relationships.json`). Il flag «stadio più concentrato» porta il proprio denominatore («fra i 3 che misurano la stessa grandezza»).
- **Nessuna precisione inventata.** Nessuna differenza («salto di 31 punti»), rapporto, indice, scenario o elasticità. L'ordine degli stadi deriva dal nome del settore (estrazione → raffinazione → magneti → domanda UE), non da un dato nuovo.
- **Nessuna classe inventata.** La matrice usa solo gruppi e livelli esistenti; la riga di partecipazione si espande nei predicati letterali, non in classi di ruolo.

## 4. Decisioni (esecuzione non sorvegliata, 2026-11-15)

Adottate dall'orchestratore su mandato del manutentore, **da confermare**.

| ID | Decisione | Opzioni | Adottata e motivo |
| --- | --- | --- | --- |
| D-B19-1 | Forma del campo | (a) `group {id, position}` facoltativo con vocabolario chiuso; (b) campo testuale libero; (c) file editoriale fuori da `data/` | **(a)**: additivo, compatibile con `v1` (ADR-10), validabile, descritto nello schema e nel vocabolario |
| D-B19-2 | Quali gruppi | (a) solo terre rare + gas; (b) anche batterie (`X-005…X-007`) e semiconduttori (`X-009`, `X-010`) | **(a)**: sono gli unici due indicati da C; batterie e semiconduttori non sono stadi della stessa grandezza documentati come catena |
| D-B19-3 | Confronto fra stadi | (a) solo stessa unità + stessa etichetta + valori `exact`; (b) tutte le percentuali | **(a)**: rispetta C §8.3 («stessa unità e stesso universo»); `X-001` (domanda UE) viene segnalato come cambio di grandezza |
| D-B19-4 | Prima/dopo | (a) gruppo `before_after` con le misure nell'ordine del record, nessuna differenza; (b) calcolare la variazione | **(a)**: i qualificatori («quasi», «circa», «meno del») rendono la differenza una precisione inventata |
| D-B19-5 | Matrice dei ruoli | (a) gruppi esistenti × E1–E4 + predicati letterali; (b) classi di ruolo C §5.4 | **(a)**: le classi di C §5.4 sono una classificazione editoriale non approvata; restano «Azioni per il manutentore» |
| D-B19-6 | Relazioni riservate nella matrice | (a) contate solo per livello, riga separata; (b) per gruppo | **(a)**: la pagina dell'entità non mostra il gruppo delle relazioni riservate; oggi sono 0 nella proiezione pubblica |
| D-B19-7 | Fascicolo del caso | (a) rinviare; (b) costruirlo sul pilota B18 | **(a)**: il pilota è `needs_review`, fuori da `data/` e dagli export; dipende dalla conferma di ADR-06 |
| D-B19-8 | Domande strutturate | (a) rinviare; (b) pagine statiche per domanda | **(a)**: non economico (isola o molte pagine), e 2 domande su 5 richiedono dati assenti (data dell'attribuzione, fornitore come campo) |

## 5. Confronto con i compiti di C §12.2 e la baseline B12

La baseline B12 non contiene misure dei compiti utente di C §12.2: il confronto è strutturale (che cosa serve per rispondere prima e dopo), non un test con utenti.

| Compito | Prima (`1375c68`) | Dopo (B19) |
| --- | --- | --- |
| E3 Gill, fatto → giudizio | Cronologia; due schede evento | Invariato: Fascicolo rinviato (D-B19-7) |
| E4 Stadio più concentrato delle terre rare | Quattro schede separate, nessun ordine | Una sezione: 4 stadi ordinati; `X-003` (94%) indicato come più concentrato fra 3 stadi della stessa grandezza; `X-001` (98%) dichiarato cambio di grandezza — la risposta corretta di C cita il cambio di universo |
| E5 La Russia è responsabile di tutti gli eventi? | Elenco di 22 eventi con ruolo | Matrice: 37 relazioni pubbliche per gruppo × livello (22 partecipazioni: 8 E2, 14 E3), 16 predicati letterali distinti, periodo 2007-04 – 2026-10-20 (5 relazioni senza evento) |
| E8 Relazioni E2 su Voice of Europe | Navigazione manuale | Invariato: Domande rinviate (D-B19-8) |

## 6. Test

`test/views.test.ts`: controlli del campo `group` (lacune, singoletti, coppie malformate, stadi con più misure); confronto solo fra stadi della stessa grandezza `exact`; risposta a E4 sui dati pubblici (`X-004 → X-002 → X-003 → X-001`, `X-003` su 3, cambio di grandezza sull'ultimo); matrice di `RU` (righe + riservate = totale = somma per livello, predicati = partecipazioni, periodo ordinato); relazione riservata esclusa da gruppi e predicati (modello stub). `test/vocabulary.test.ts`: ogni `group.id` pubblico ha una voce in `exposure_groups`.

## 7. Rischi

- Il raggruppamento può essere letto come nesso causale fra stadi: mitigato dalla nota «non aggiunge valori né nessi causali» e da `must_not_read_as`.
- «Stadio più concentrato» dipende dall'uguaglianza delle etichette italiane: una correzione di etichetta può spegnere il confronto (comportamento prudente).
- Su 375 px la tabella dei ruoli scorre orizzontalmente nel suo contenitore (circa 44 px); la pagina non scorre.

## 8. Azioni per il manutentore

1. Confermare D-B19-1…8 e l'ordine degli stadi della filiera.
2. Se si vogliono le classi di ruolo di C §5.4: approvarle come vocabolario editoriale (blocco successivo); la matrice attuale ne prescinde.
3. Confermare ADR-06 e portare casi rivisti in `data/` prima del Fascicolo del caso.
4. Eseguire i compiti E3–E5, E8 di C §12.2 con utenti (baseline B12 non li copre).

## 9. Esito

Fatto: campo `group` additivo su 6 esposizioni con validazione, vocabolario e schema; Filiera e prima/dopo su `/dependencies/`; Matrice dei ruoli sulle pagine delle entità; Fascicolo e Domande rinviati e documentati.

Verifica: `pnpm check` verde (29 suite, 308 test; validate 0 errori/24 warning invariati); `pnpm build` e `pnpm check:links` verdi (931 pagine, 176.559 link, 0 problemi); `pnpm data:diff` solo i 2 errori ereditati `ART-0001`/`ART-0002` (le 6 esposizioni mostrano solo `group.*`); browser IT/EN, 1280 px scuro e 375 px chiaro su `/dependencies/` e `/entities/RU/`, nessuno scorrimento orizzontale di pagina.

Resta: Fascicolo del caso, Domande strutturate, classi di ruolo, test con utenti.
