# B12 — Baseline di misura e benchmark: analisi

Data: 15 novembre 2026 (Europe/Rome). Ramo `audit/fable-2026-11-implementation`; HEAD iniziale `85c92c54adfb45cc0c2ec3d2c38b00228d6b85da` (B11). Esecuzione non sorvegliata su mandato del manutentore. Nessun fetch, nessuna API esterna, nessun modello interrogato.

Fonti rilette: scheda B12 (§2, §3, §5 di [IMPLEMENTATION_BLOCKS.md](../IMPLEMENTATION_BLOCKS.md)); FABLE A §11 e appendice A; FABLE D §9.1–9.3 e §13 (A13). Formato: B11 e B05.

## 1. Stato verificato

| Punto | Stato all'ingresso |
| --- | --- |
| Riproduzione di A E1–E10 | Solo lo script Python dell'appendice A, non nel repository, non deterministico per E5 (`random` di Python, seme 7 ma algoritmo diverso da qualsiasi PRNG TS) |
| Riproduzione di D T1–T11 | Eseguita dall'autore di D contro il sito pubblico con uno script non archiviato; nessun comando nel repository |
| Batteria B1–B20 | B1–B10 descritte in D §9.3; B11–B20 solo come categorie («varianti su traduzione, date, entità omonime (`EC`), record inesistenti, relazioni fra persone») |
| Valori di D B5 | D dice «11 ipotesi pubbliche»: dopo B05 sono **22 pubbliche, 10 trattenute** (`pnpm audit:publication`). La batteria va scritta sui dati correnti, non sul rapporto |
| Valori di D T1b, T5 | Dopo B07 `graph.json` porta il caveat (4/5 archi del cammino Kerimov→SpaceX); dopo B05 `H08` è pubblica. La baseline B12 misura quindi lo stato *dopo* B03–B11, non quello degli audit |
| Archivio risultati | Nessuna cartella dedicata; `docs/audit/` contiene solo `M5_2026-11-12.json` e i rapporti |

## 2. Perimetro e piano file per file

| File | Contenuto |
| --- | --- |
| `src/audit/baseline.ts` | Funzioni pure E1–E6 e T1–T11 (+ dimensioni di contesto D §9.1). BFS non orientata con vicini in ordine di ID, PRNG `mulberry32` seme 7, 500 esecuzioni × 10·\|E\| scambi; matcher E6 identico all'appendice A |
| `src/audit/benchmark.ts` | Schemi Zod del file casi e del file risposte, `scoreAnswer`/`scoreAnswers` |
| `src/cli/benchmark.ts` | `measure` e `score`; script `pnpm benchmark:measure`, `pnpm benchmark:score` |
| `docs/audit/baseline/benchmark-cases.v1.json` | B1–B20 con domanda IT/EN, risposta attesa, ID di supporto, frasi obbligatorie (gruppi di alternative) e vietate, errore tipico |
| `docs/audit/baseline/answers.template.json` | Modello del file risposte (modello, data, commit dei dati letti, accesso, testo, richieste, caratteri) |
| `docs/audit/baseline/baseline-2026-11-15-85c92c5.json` | Baseline datata |
| `test/benchmark.test.ts` | 6 test: copertura B1–B20 e ID esistenti; ogni risposta attesa supera il proprio caso; errori tipici, ID inventati e negazione; BFS indipendente dall'ordine; caveat negativi; riproducibilità del seme |
| Documentazione | `docs/ARCHITECTURE.md` (layout e sezione «Measurement baseline and benchmark»), `README.md` (comandi, roadmap), `AGENTS.md` (comandi, dove stanno le cose, regola per gli agenti) |

Fuori perimetro: E7–E10 di A (E7 richiede `derived_from`, E8 l'analisi dei marcatori di traduzione, E9 un metodo da testare, E10 tre commit), T9 (indice Pagefind dal vivo), le misure «precisione dell'attribuzione» e «correttezza delle citazioni» di D §9.3, che richiedono un valutatore umano.

## 3. Scelte di misura (euristiche dichiarate nell'output)

- **E1**: «solo corpus» = tutte le fonti della relazione corrispondono a `S\d{2,3}`; F/P mai citati da eventi, relazioni, ipotesi o esposizioni.
- **E3**: record `imported_unreviewed` presenti in `publicationReport().withheld`, con i motivi.
- **E4**: cammino minimo fra soggetto e oggetto di ogni ipotesi sul grafo delle relazioni **pubbliche**; caveat negativo = testo italiano con `non|nessun[ao]?|né` e che non inizia con il testo standard «Relazione di presenza/ruolo» delle partecipazioni. Le ipotesi con arco diretto (H03–H05) contano come cammino di un arco.
- **E5/E6**: dati canonici, come in A.
- **T1–T11**: calcolati dalle esportazioni pubbliche in memoria (`exportFiles(publicationReport)`), cioè gli stessi byte di `data/v1/`; nessuna rete. T11 solo con `--pages` su una build dello stesso commit.
- **Punteggio**: completezza = ID di supporto citati / attesi; un caso passa se ogni gruppo obbligatorio è soddisfatto, nessuna frase vietata è affermata (corrispondenza a parola intera, ignorata se nei 20 caratteri precedenti c'è una negazione) e nessun ID strutturato citato è assente dal repository (esclusi quelli della domanda, per B14). È un primo filtro per un valutatore umano.

## 4. Decisioni (esecuzione non sorvegliata, 2026-11-15)

Adottate dall'orchestratore su mandato del manutentore, **da confermare**.

| # | Decisione | Opzioni | Adottata e motivo |
| --- | --- | --- | --- |
| D-B12-1 | Quali modelli e chi li esegue | (a) Claude esegue un modello ora; (b) strumento + modello delle risposte, esecuzione al manutentore | **(b)**: interrogare un modello esterno è un effetto esterno e un costo; il repository non chiama API (regola M6). Si consiglia almeno un modello con ID e versione esatti, accesso ai soli URL pubblici, stesso commit dei dati |
| D-B12-2 | Dove archiviare | (a) `docs/audit/baseline/`; (b) `docs/audit/fable-2026-11/` | **(a)**: le baseline sono successive all'audit e servono B13, B16, B19; un file per esecuzione, nome `baseline-<data commit>-<hash corto>.json`; mai modificare un file archiviato |
| D-B12-3 | Su quale stato misurare | (a) commit corrente (dopo B03–B11); (b) ricostruire `d1f6a97` | **(a)**: la scheda chiede il commit corrente; i valori di A/D al commit `d1f6a97` restano nei rapporti come riferimento storico. E10 (stabilità su più commit) resta possibile rieseguendo il comando su un checkout |
| D-B12-4 | Determinismo | (a) nessun orario nell'output, seme fisso; (b) data di esecuzione | **(a)**: stesso commit → stesso file byte per byte (verificato); data = data del commit |
| D-B12-5 | Risposte attese di B11–B20 | Scritte su record verificati nel repository a `as_of_commit` | Ogni ID di supporto esiste (test); nessuna affermazione fuori dai dati. Un cambio dei dati che le altera richiede `benchmark-cases.v2.json` |
| D-B12-6 | Nel `pnpm check`? | (a) solo test del file casi; (b) anche confronto con la baseline | **(a)**: la baseline è una fotografia, non una soglia; confrontarla in CI bloccherebbe ogni cambio dei dati |

## 5. Rischi e limiti

- Le frasi obbligatorie/vietate sono euristiche: una risposta corretta formulata diversamente può fallire e una sbagliata può passare. Il rapporto serve a guidare la lettura umana, non a sostituirla.
- La baseline non ha `worktree` pulito su `src/` perché il codice B12 non era ancora committato; i dati e gli schemi lo erano (`data_worktree_clean: true`). Rieseguendo dopo il commit B12 si ottiene lo stesso contenuto con `commit` aggiornato.
- Le modifiche concorrenti non committate a `src/site/publication.ts` (review in corso) non alterano l'output: confronto byte per byte prima/dopo identico.
- T11 conta i marcatori in `web/dist` costruito alle 02:43 durante la verifica B11 (stesso contenuto di `85c92c5`).

## 6. Esito

**Fatto.** Comando di misura e scorer, file casi v1 (20 casi), modello delle risposte, baseline datata, test e documentazione.

Valori principali della baseline al commit `85c92c5`:

| Misura | Valore | Riferimento del rapporto (`d1f6a97`) |
| --- | --- | --- |
| E1 relazioni solo corpus | 429 / 458; F/P mai citati 40 / 41 | 429 / 458; 40 / 41 |
| E2 coppie livello–stato | 4 | 4 |
| E3 baseline trattenuti | 15 (4 eventi `EXT-001–004`, 11 relazioni: `G-0230` persona, 10 per estremo trattenuto) | 11 ipotesi, 10 relazioni, `G-0230` |
| E4 cammini attraverso caveat negativo | 12 su 19 ipotesi con cammino (32 ipotesi; 44 caveat negativi pubblici, 62 canonici) | 3 su 3 coppie provate |
| E5 coppie con ≥ 2 eventi | 15; nullo media 4,42, p95 8, max 11 | 15; 4,5; 10–12 |
| E6 menzioni senza arco (matcher semplificato) | 111 su 69 eventi | 111 |
| T1 / T1b | cammino di 5 archi; caveat 4/5 in entrambi | T1b: 0 caveat |
| T5 | `H08` pubblica | assente |
| T7 | ultimo evento pubblico 2026-10-21, scarto 25 giorni, nessun campo di freschezza | 24 giorni |
| T8 / T10 / T11 | 0 descrizioni nello schema; 0 endpoint per record; 885 pagine, 0 JSON-LD, 0 canonical, 2 con `<time>` | 0; 404; 0 su 9 |
| Contesto | `all.json` 1.586.090 byte; 310.900 caratteri solo italiano senza provenance/review | 1.526.538; 305.830 |

**Verifica (15/11, albero con modifiche concorrenti della review non committate).** `pnpm check` verde: lint, typecheck, 243 test in 22 suite (6 nuovi in `test/benchmark.test.ts`), validate 0 errori/23 avvisi, sidecar, articoli, schemi, M5, contrasto. Due esecuzioni consecutive di `pnpm benchmark:measure` producono output identico byte per byte; `pnpm benchmark:score` sul modello vuoto dà 20 casi, 0 risposte. Nessun file del sito, di `data/`, `sources/` o degli schemi modificato: build e `data:diff` non necessari. `biome.json` esclude `docs/audit/baseline/baseline-*.json` (file generati, come `data/` e `schemas/`), senza toccare regole di lint.

**Azioni per il manutentore.**

1. Scegliere uno o più modelli (ID e versione esatti) ed eseguire B1–B20 dando al modello **solo** gli URL pubblici di `data/v1/` del commit indicato; copiare `answers.template.json`, compilare testo, richieste e caratteri letti, poi `pnpm benchmark:score <file> --out docs/audit/baseline/score-<data>-<modello>.json`.
2. Rileggere a mano i casi segnalati e le misure non automatizzate (precisione dell'attribuzione, correttezza delle citazioni).
3. Confermare D-B12-1…6; rivedere le risposte attese di B11–B20 (scritte dall'agente sui record, non da un revisore umano).
4. Eseguire T9 sul sito pubblicato (ricerca «Kerimov finanzia SpaceX») e annotare il primo risultato.
