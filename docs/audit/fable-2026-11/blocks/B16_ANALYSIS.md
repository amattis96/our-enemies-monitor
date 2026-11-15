# B16 — Tracciato: analisi

Data: 15 novembre 2026 (Europe/Rome). Ramo `audit/fable-2026-11-implementation`; HEAD iniziale `519b428` (B15). Esecuzione non sorvegliata su mandato del manutentore. Nessuna scrittura in `data/`, `sources/` o `provenance`; nessun fetch o API esterna.

Fonti rilette: scheda B16 (§3 di [IMPLEMENTATION_BLOCKS.md](../IMPLEMENTATION_BLOCKS.md)); FABLE C §5.1 (Tracciato), §8.1, §12 (compito E1), §12.4; FABLE D §10 (`trace(from, to)`); B15 (codice e analisi); baseline B12 (`baseline-2026-11-15-85c92c5.json`, T1/E4 e `benchmark-cases.v1.json`, caso B1).

## 1. Stato verificato

| Punto | Stato all'ingresso |
| --- | --- |
| Cammino e classificazione dei caveat | Già in `src/site/inferences.ts` (B15): `counterInferenceAudit` calcola il cammino minimo per le coppie sensibili ma restituisce **solo** i cammini segnalati; i cammini senza interruzione non sono accessibili |
| Pagina | Nessuna pagina `trace`. Le pagine delle ipotesi mostrano solo la sezione «Limiti di inferenza» (`InferencePath.astro`) per i cammini segnalati |
| Livello di evidenza dei passi | Non in `PathStep`; presente negli archi del grafo pubblico (`evidenceGraph`) |
| Ipotesi pubbliche | 22; coppie `H06` KERIMOV–HAL9001, `H07` X–US, `H15` PROTEST26–RU, `H08` STARSHIELD–US (cammino di 3 passi senza interruzioni) |
| Coppia Kerimov–SpaceX (compito E1 di C) | Nessuna ipotesi pubblica la usa come coppia (`H06` ha estremi KERIMOV–HAL9001 e cita SpaceX nel testo); `FI-011`, la sola voce che la nomina, è privata perché tocca una persona ed è `proposta` |

## 2. Piano file per file

| File | Intervento |
| --- | --- |
| `src/site/inferences.ts` | Refactoring senza cambio di comportamento: `publicEntriesOf` e `auditedPairs` (tutte le coppie con cammino, vuoto se non connesse); `counterInferenceAudit` filtra i segnalati. `inferences.json` invariato |
| `src/site/trace.ts` (nuovo) | `buildTraces` (una traccia per coppia: passi con livello e gruppo di relazione, interruzioni, anello più debole, ipotesi e inferenze vietate pubbliche sulla coppia), `notSaid` (riepilogo «che cosa non dice» bilingue), `weakestLink`, `traceFor` |
| `web/src/lib/model.ts` | `getTraces()` memorizzato per build |
| `web/src/components/TracePath.astro` (nuovo) | Lista ordinata `<ol>`, marcatore di interruzione, caveat, blocco «Che cosa questo tracciato non dice»; solo presentazione |
| `web/src/pages/[...lang]/trace/index.astro`, `[id].astro` (nuovi) | Indice e una pagina statica per coppia, IT/EN, `href()`/`languagePaths()`; nessuna isola |
| Collegamenti | Pagina e indice delle ipotesi; la voce Archivio del menu resta attiva su `trace/` |
| `web/src/styles/global.css` | Classi `trace-*` con soli token semantici; nessun colore fisso; icona `ui-close` esistente (nessun nuovo simbolo nello sprite) |
| `test/trace.test.ts` (nuovo) | 10 test (vedi §5) |
| Documentazione | `docs/ARCHITECTURE.md` (sezione B16, tabella delle rotte), `README.md`, `AGENTS.md` (dove stanno le cose) |

Fuori perimetro: ricerca di una coppia arbitraria (richiederebbe un'isola e i dati del grafo nel browser); esportazione JSON delle tracce (D §10 `trace` come API); fili interrotti sulla bacheca; N6 «Tavolo dell'ipotesi».

## 3. Regole del Tracciato

- **Fonte unica.** Cammino, classificazione e stato di revisione vengono da `auditedPairs` (B15); `trace.ts` aggiunge solo ordinamento, livello/gruppo dall'arco pubblico e testo. Solo archi di `graph.json`: le relazioni ristrette su persone non compaiono e i record trattenuti non sono mai nominati (test).
- **Interruzione.** Il marcatore precede il passo il cui caveat interrompe la composizione (come in C §5.1) e porta categorie e, se non rivista, «proposta non rivista».
- **«Che cosa non dice».** Generato dalla struttura: catena di *n* relazioni ≠ relazione fra gli estremi; ogni interruzione; anello più debole (codice più alto, quanti passi); partecipazione a un evento ≠ controllo/finanziamento/coordinamento (regola 6 di AGENTS.md); ipotesi E5 e inferenze vietate sulla coppia; «cammino più breve, non l'unico né il più solido»; se non c'è cammino: assenza nel corpus pubblico, non assenza di legame.
- **Coppie.** Estremi delle ipotesi pubbliche + coppie vietate pubbliche (stesso perimetro di B15); una coppia vietata già presente come ipotesi si fonde con quella.

## 4. Decisioni (esecuzione non sorvegliata, 2026-11-15)

Adottate dall'orchestratore su mandato del manutentore, **da confermare**.

| ID | Domanda | Opzioni | Adottata e motivo |
| --- | --- | --- | --- |
| D-B16-1 | Isola o pagine statiche | (a) isola con ricerca di coppia arbitraria; (b) pagine statiche per le coppie delle ipotesi | **(b)**: accessibile, stampabile, nessun grafo nel browser; una ricerca arbitraria sposterebbe la responsabilità di caveat e restrizioni nell'isola. Reversibile aggiungendo un'isola in seguito |
| D-B16-2 | Riuso della logica B15 | duplicare il calcolo; estrarre `auditedPairs` | **Estrarre**: il cammino e la classificazione esistono una volta; `inferences.json` invariato (test B15 verdi) |
| D-B16-3 | Chiave della pagina | coppia di nodi; ID dell'origine | **ID dell'origine** (`H06`, o `FI-…` se pubblica): URL stabile, nessuna enumerazione combinatoria |
| D-B16-4 | Coppie senza cammino | omettere la pagina; pagina esplicita | **Pagina esplicita**: «nessun cammino» è un'informazione, ma non è assenza di legame |
| D-B16-5 | Esportare le tracce in JSON | sì; no | **No**: le informazioni sono già in `inferences.json` e `graph.json`; un'API `trace` è D §10 |
| D-B16-6 | Etichetta di revisione | omettere; mantenere | **Mantenere «proposta non rivista»** su marcatore e riepilogo finché le classificazioni sono `proposta` |
| D-B16-7 | Icona dell'interruzione | nuovo simbolo nello sprite; `ui-close` | **`ui-close`** con etichetta di testo e tono cautela (mai solo colore); nessun cambio al sistema di design |

## 5. Test

`test/trace.test.ts`: una traccia per ogni ipotesi pubblica e per ogni coppia auditata; cammino ordinato dal primo al secondo estremo, passo per passo; `H06` (`G-0087`), `H07` (`G-0078`, `G-0072`), `H15` (`G-0429`, `G-0427`) con interruzione, ipotesi, catena e interruzione nel riepilogo, e passi uguali a quelli dell'audit B15; etichetta «non rivista» coerente con lo stato; anello più debole; «nessun cammino»; regola di partecipazione; testi presenti in IT e EN; nessun ID trattenuto né relazione ristretta; inferenza vietata pubblica sulla coppia (fixture). I test B15 restano verdi senza modifiche (refactoring neutro).

## 6. Confronto con la baseline B12 sul compito E1 di C

Compito E1 (C §12.2): «Esiste un legame finanziario documentato fra Kerimov e SpaceX?» Risposta attesa: no, esiste una catena di relazioni distinte con un'interruzione esplicita e un'ipotesi aperta. Il caso B1 del benchmark B12 («Kerimov ha finanziato SpaceX?») ha la stessa risposta attesa («Non stabilito…»). La baseline B12 **non contiene risposte di modelli** (il modello è esterno, B12 §Azioni), quindi il confronto è strutturale, non una misura di accuratezza; i file di baseline archiviati non sono modificati.

| Aspetto | Baseline B12 (commit `85c92c5`, prima di B15/B16) | Dopo B16 |
| --- | --- | --- |
| Cammino Kerimov→SpaceX (T1/T1b) | 5 relazioni `G-0088…G-0084`, 4 con caveat, 2 con caveat negativo (rilevatore lessicale); nessuna indicazione sul sito | Nessuna pagina per questa coppia (non è una coppia di ipotesi pubblica) |
| Cammino dell'ipotesi `H06` (KERIMOV–HAL9001) | E4: percorso `G-0088, G-0087, G-0086` con `G-0087` negativo; nessuna annotazione pubblica | `/trace/H06/`: stessi 3 passi in ordine, interruzione su `G-0087` («negazione del claim», proposta non rivista), `H06` mostrata con «Limite attuale: NESSUNA prova nel corpus», riepilogo «3 relazioni in fila non sono una relazione fra gli estremi» e anello più debole E3 (2 passi su 3) |
| `H07`, `H15` | E4: cammini attraverso caveat negativi, non annotati | `/trace/H07/` (2 interruzioni), `/trace/H15/` (2 interruzioni, 3 passi), ciascuno con l'ipotesi aperta |
| Lettura della bacheca | Schede vicine senza lista ordinata; il caveat è nel pannello di una relazione alla volta | Lista ordinata con caveat, interruzione e «che cosa non dice» sulla stessa pagina |

Accettazione C §8.1: **soddisfatta** per `H06`, `H07`, `H15` (interruzione e ipotesi mostrate, verificate dai test e nel browser IT/EN, desktop e 375 px). **Non soddisfatta per la coppia esatta Kerimov–SpaceX**: il Tracciato mostra i primi tre dei cinque passi (Kerimov→HAL9001) e la rimanenza `G-0085`, `G-0084` (HAL9001→Tomales Bay→SpaceX) non ha una pagina perché non esiste una coppia pubblica che la nomini. L'ipotesi «Tracciato riduce le inferenze indebite su E1» (C §12.4) resta **da validare** con utenti o con la misura del benchmark su un modello (B12 azione 1).

## 7. Rischi e limiti

- Si mostra il solo cammino minimo non orientato: un altro cammino senza interruzioni resta invisibile; il testo lo dice, il registro incompleto non è una garanzia (B15).
- Il marcatore è «proposta non rivista» finché il manutentore non riclassifica: una classificazione errata sposta l'avviso sulla pagina.
- La leggibilità del segnale di interruzione («qui il legame non passa», non «qui c'è qualcosa di nascosto», C §12.4 n. 2) non è stata verificata con utenti.
- Il predicato resta in italiano in inglese (regola esistente); i nomi dei nodi usano il testo localizzato.

## 8. Azioni per il manutentore

1. Confermare o correggere D-B16-1…7.
2. Se si vuole la pagina Kerimov–SpaceX: rivedere `FI-011` (`revisionata`, con il vincolo sulle persone di AGENTS.md regola 7) o dichiarare una coppia pubblica; `auditedPairs` la include allora automaticamente e `/trace/FI-011/` nasce senza altro codice. In alternativa, decidere un'isola di ricerca di coppia (D-B16-1).
3. Eseguire B1–B20 su un modello pinnato (B12) per misurare E1 con e senza Tracciato.

## 9. Esito

**Fatto.** Pagine `/trace/` e `/trace/<ID>/` (IT/EN, statiche, senza isola) con lista ordinata, caveat, marcatori di interruzione, ipotesi e inferenze vietate sulla coppia e riepilogo «che cosa non dice»; logica in `src/site/trace.ts` sopra `auditedPairs` estratto da B15; collegamenti da ipotesi e indice; documentazione aggiornata. Nessun cambio a `data/`, `sources/`, schemi, stati di revisione o regole di validazione; `inferences.json` invariato.

**Verifica.**

- `pnpm check` verde: 279 test in 26 suite (10 nuovi in `test/trace.test.ts`); `validate` 0 errori, 23 avvisi invariati.
- `pnpm build` verde; `pnpm check:links`: 931 pagine (885 + 46: indice e 22 tracce per lingua), 175.279 link interni, 0 problemi.
- Browser (anteprima locale): `/trace/H06/` IT desktop e `/en/trace/H15/` a 375 px: 3 passi, interruzioni, riepilogo presente, nessuno scorrimento orizzontale (`scrollWidth` = 375).
- `data/` non modificata: `pnpm data:diff` non necessario.

**Resta.** Revisione umana delle classificazioni (B15 §6); pagina per la coppia esatta Kerimov–SpaceX e validazione con utenti (§8); misura del benchmark su un modello.
