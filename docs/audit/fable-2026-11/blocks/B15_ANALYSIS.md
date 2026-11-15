# B15 — Registro delle inferenze vietate e contro-inferenza: analisi

Data: 15 novembre 2026 (Europe/Rome). Ramo `audit/fable-2026-11-implementation`; HEAD iniziale `026c5ab` (B13). Esecuzione non sorvegliata su mandato del manutentore. Nessun fetch, nessuna API esterna, nessuna scrittura in `data/`, `sources/` o `provenance`.

Fonti rilette: scheda B15 (§2, §2.1, §3, §4 di [IMPLEMENTATION_BLOCKS.md](../IMPLEMENTATION_BLOCKS.md)); FABLE A §4.4, §A7, P3, E4, E9, §12 q.4; FABLE D §6.2–6.3, §14.2; FABLE C (fili interrotti, §§2, 5.1); CONSOLIDATED_FINDINGS §3.3 «Caveat e percorsi» e §3.5; Fonte_09 §8.3 (solo lettura). Misura di riferimento: E4 di B12 (`src/audit/baseline.ts`, baseline `baseline-2026-11-15-85c92c5.json`). Formato: B13, B14.

## 1. Stato verificato

| Punto | Stato all'ingresso |
| --- | --- |
| «Forbidden edge» di Fonte_09 | Solo testo: §8.3 elenca 10 righe; 9 coppie canoniche esistono come frasi inglesi in `review.notes` di nove eventi `EXT-*` (tutti `needs_review`) e in `test/fonte09.test.ts`, che verifica l'assenza di archi diretti. Z-Pentest e i Democratici USA non hanno nodo canonico. Nessuna struttura dati |
| Caveat negativi | Rilevatore lessicale B12 (`isNegativeCaveat`): 62 relazioni canoniche, 44 pubbliche (= i 44 di D). I 18 di A sono le relazioni dirette (classe ≠ `event_participation`) il cui caveat **inizia** con «Non»/«Nessun»: ricostruiti esattamente, tutti pubblici |
| E4 (B12) | 12 cammini minimi fra estremi di ipotesi attraversano un caveat negativo (lessicale), fra cui `H06` (`G-0087`), `H07` (`G-0078`, `G-0072`), `H15` (`G-0429`, `G-0427`). Nessuna annotazione pubblica |
| Caveat nelle esportazioni | Già in `graph.json` (B07); R2 di `vocabulary.json` (B13) dichiara che un caveat che nega un'inferenza non la sostiene «né da sola né come tratto di un cammino». Manca quali caveat lo fanno |
| Autorità (A §12 q.4) | Non definita |

## 2. Perimetro e piano file per file

| File | Intervento |
| --- | --- |
| `docs/audit/inferences/registry.v1.json` (nuovo) | Registro versionato: 11 inferenze vietate (`FI-001`…`FI-010` da Fonte_09 §8.3, `FI-011` da `H06`) e 62 classificazioni di caveat; tutte `proposta` |
| `src/editorial/inferences.ts` (nuovo) | Schema Zod, lettura, `validateInferenceRegistry` (errori/avvisi), rilevatore lessicale spostato qui da `baseline.ts` (che lo riesporta: misura B12 invariata) |
| `src/cli/validate.ts` | `pnpm validate` controlla anche il registro |
| `src/site/inferences.ts` (nuovo) | Definizioni bilingui delle sei categorie, regola d'interruzione, regola d'autorità; `counterInferenceAudit` sul grafo pubblico (stessi archi di `graph.json`, riuso di `shortestPath` di B12); proiezione pubblica senza ID trattenuti |
| `src/site/exports.ts` | `data/v1/inferences.json` (rotta generica, manifest, catalogo) |
| `web/src/components/InferencePath.astro` (nuovo), pagina ipotesi, `data.astro`, `web/src/lib/model.ts` | Sezione «Limiti di inferenza» / «Inference limits» nelle pagine delle ipotesi con cammino segnalato; collegamento da `/data/` |
| `test/inferences.test.ts` (nuovo), `test/ingest.test.ts` | Registro valido; 9 coppie di Fonte_09; copertura delle 62 classificazioni e presenza di non interruzioni; errore su arco diretto fra coppia vietata salvo `lifted`; regola d'autorità; E4 3/3; nessun ID trattenuto; export. Il test CLI di ingest copia il registro nel repository temporaneo (validate lo legge) |
| Documentazione | `docs/ARCHITECTURE.md` (sezione B15, elenco validazioni, endpoint, pagina ipotesi), `README.md`, `AGENTS.md` (nuova regola per gli agenti) |

Fuori perimetro: pagina Tracciato e fili interrotti sulla bacheca (B16); schede di affermazione con `polarity`/`modality` (D §6.3a, B20); claim atomici (B18); E9 come test di un metodo di scoperta (nessun metodo nuovo esiste).

## 3. Criterio di classificazione dei caveat

Ambito: ogni relazione il cui caveat italiano contiene «non», «nessun(o/a)» o «né» (rilevatore B12), cioè i 62 casi canonici, superinsieme dei 18 di A e dei 44 di D. Il rilevatore seleziona i casi da leggere; **non** decide nulla.

**Categorie** (una o più per relazione, la prima è la principale):

| Categoria | Quando | Esempio |
| --- | --- | --- |
| `claim_negation` (negazione del claim) | Il caveat nega proprio l'affermazione che il lettore ricaverebbe dalla relazione o da un cammino | `G-0087` «Non dimostra denaro Kerimov verso SpaceX» |
| `transitivity_limit` (limite alla transitività) | La relazione vale, ma non si estende ad altri membri, episodi o attori, né a un legame più forte (comando, alleanza, controllo, mandato) | `G-0065` «Non alleanza militare automatica»; `G-0427` |
| `denial` (smentita) | Un soggetto coinvolto nega; è una posizione, non una prova contraria | `G-0455` «nega le accuse» |
| `not_established` (non stabilito) | Un elemento del fatto (autore, mandante, dolo, effetto, stato giuridico) non è stabilito ora | `G-0419` «Dolo non provato» |
| `reported_position` (posizione altrui) | La fonte riferisce attribuzione, accusa o stima di un altro soggetto | `G-0457` proiezione AP |
| `scope_precision` (precisione di portata) | La negazione precisa tempo, quantità o portata; non è un limite d'inferenza | `G-0104` «non operativo alla baseline»; `G-0439` «canali anche non cinesi» |

`scope_precision` è aggiunta alle cinque del consolidamento §3.5 proprio per non mappare ogni «non» su un'interruzione.

**Interruzione (`interrupts_composition`)**, giudizio per relazione e separato dalla categoria: vale `true` quando il caveat dice che la relazione non autorizza l'affermazione che un cammino attraverso di essa produrrebbe — (i) il claim negato, (ii) l'estensione ad altri membri, episodi o a un legame più forte, (iii) l'elemento mancante (autore, mandante, dolo, denaro, effetto) che il cammino fornirebbe. Vale `false` quando la negazione precisa solo portata, tempo o quantità, registra una smentita o una posizione riferita senza limite di composizione, o riguarda lo stato giuridico della relazione stessa (es. `G-0040` «Nessuna condanna penale dichiarata»).

**Esito (proposta, non rivista).** 62 classificate: 52 interrompono, 10 no (`G-0040`, `G-0091`, `G-0098`, `G-0104`, `G-0404`, `G-0424`, `G-0439`, `G-0457`, `G-0459`, `G-0460`). Categoria principale: 17 `claim_negation`, 17 `transitivity_limit`, 15 `not_established`, 7 `reported_position`, 6 `scope_precision` (`denial` compare solo come categoria secondaria, 6 volte). Sui 18 di A: 16 interrompono (non `G-0040`, `G-0091`). Sui 44 di D: 38 interrompono, 6 no. Il dettaglio e le motivazioni brevi sono nel registro.

## 4. Decisioni (esecuzione non sorvegliata, 2026-11-15)

Adottate dall'orchestratore su mandato del manutentore, **da confermare**.

| ID | Domanda | Opzioni | Adottata e motivo |
| --- | --- | --- | --- |
| D-B15-1 | Dove vive il registro | (a) nuova collezione `data/`; (b) file `data/` fuori collezione; (c) file versionato in `docs/audit/` come M5 | **(c)** `docs/audit/inferences/registry.v1.json` + `src/editorial/inferences.ts`: nessun cambio a `Dataset`, loader, `data:diff`, storia delle modifiche (che legge `data/`) o ingest; precedente M5; controllato da `pnpm validate` |
| D-B15-2 | Chi dichiara e quando decade (A §12 q.4) | dichiarazione libera; solo fonte citata o manutentore; scadenza a tempo | **Solo fonte citata (record `S*` o record canonico) o manutentore; nessuna scadenza automatica; decade solo con `lifted` del manutentore con la fonte nuova; gli agenti propongono soltanto**. Una dichiarazione `maintainer` e un `lifted` richiedono `revisionata` (errore). L'identità non è verificabile tecnicamente: regola in AGENTS.md |
| D-B15-3 | Arco diretto fra una coppia vietata | ignorare; avviso; errore | **Errore** in `pnpm validate` per le voci `revisionata`, **avviso** per le `proposta` (corretto dopo la review): una proposta di agente non blocca i dati; le 9 coppie di Fonte_09 restano protette da `test/fonte09.test.ts`. Si sblocca solo con `lifted` |
| D-B15-4 | Categorie e interruzione | categoria → `traversable` automatico; giudizio per relazione | **Giudizio per relazione** (`interrupts_composition`) accanto alle categorie; sesta categoria `scope_precision`; caveat negativo non classificato = avviso |
| D-B15-5 | Coppie sensibili auditate | tutte le coppie di entità; estremi delle ipotesi + coppie vietate | **Estremi delle ipotesi pubbliche + coppie vietate pubbliche** (23 coppie): stesso perimetro di E4, nessuna enumerazione combinatoria |
| D-B15-6 | Grafo dell'audit | relazioni pubbliche (E4 B12); archi di `graph.json` | **Archi di `graph.json`** (esclude le relazioni ristrette su persone): l'annotazione pubblica non può citare archi non pubblici. Su questi dati coincide con E4 per `H06`, `H07`, `H15` |
| D-B15-7 | Visibilità delle voci | tutte; solo voci con ID pubblici | **Solo voci i cui ID (coppie, ipotesi, fonte, record) sono pubblici**; le altre contate in `forbidden_inferences_not_public` (oggi 10: le voci di Fonte_09 citano `S09`, `needs_review`). Le classificazioni pubbliche sono solo quelle di relazioni pubbliche (44) |
| D-B15-8 | Pubblicare annotazioni non riviste | attendere la revisione; pubblicare con etichetta | **Pubblicare con etichetta «proposte, non riviste»**: l'annotazione aggiunge cautela, cita solo caveat e limiti già pubblici, non crea affermazioni. È reversibile togliendo la sezione |
| D-B15-9 | Mappatura delle righe di Fonte_09 | come `test/fonte09.test.ts`; nuova | **Come il test**: «tutti gli allarmi bomba» → `EXT-012` e `EXT-013`; righe senza nodo canonico conservate senza coppia (nessuna precisione inventata) |

## 5. Rischi e limiti

- Le 62 classificazioni e le 11 trascrizioni sono giudizi di un agente sul solo testo dei record: un'interruzione mancante o di troppo cambia l'annotazione pubblica. Etichettate come proposte.
- Si annota solo il cammino minimo: un altro cammino di pari o maggiore lunghezza senza interruzioni resta non annotato. Il registro incompleto non è una garanzia (A P3).
- `FI-011` riguarda una persona (Kerimov): riproduce il limite già pubblico di `H06` e il caveat di `G-0087`, non aggiunge dati personali né relazioni.
- L'errore su arco diretto può bloccare un ingest futuro che proponga una coppia vietata: è voluto; la decisione resta al manutentore.
- Il rilevatore lessicale non vede negazioni senza «non/nessun/né» (es. «senza», «esclude»): queste sfuggono all'avviso di copertura.

## 6. Azioni per il manutentore

1. Confermare o correggere D-B15-1…9.
2. Rivedere le 11 voci `FI-` e le 62 classificazioni (`state` → `revisionata` con `reviewer` e `reviewed_on`), in particolare i 10 casi non interrompenti e la mappatura di Fonte_09.
3. Decidere se le voci di Fonte_09 debbano diventare pubbliche quando `S09` sarà rivista.

## 7. Esito

**Fatto.** Registro versionato con schema Zod e validazione in `pnpm validate`; criterio scritto e classificazione proposta dei 62 casi (superinsieme di A 18 / D 44); audit di contro-inferenza a build time sul grafo pubblico; annotazione pubblica nelle pagine delle ipotesi (IT/EN) e in `data/v1/inferences.json` (catalogo e manifest); regola d'autorità in AGENTS.md; documentazione aggiornata. Nessun cambio a `data/`, `sources/`, stati di revisione o regole di validazione esistenti.

**Verifica.**

- `pnpm check` verde: 269 test in 25 suite; `validate` 0 errori/23 avvisi (invariati: il registro non aggiunge avvisi).
- A E4: 3/3 — `H06` interrotto a `G-0087`, `H07` a `G-0078`/`G-0072`, `H15` a `G-0429`/`G-0427`. Audit (dopo le correzioni): 22 coppie, 12 cammini segnalati.
- `pnpm build` verde; `pnpm check:links`: 885 pagine, 167.035 link interni, 0 problemi. `inferences.json` presente, SHA-256 uguale al manifest; sezione presente in `/hypotheses/H06/`, `/en/hypotheses/H07/`, `/hypotheses/H15/`, assente dove nessun cammino è segnalato (es. `H01`); pagina `H06` controllata nel browser (anteprima locale).
- Misura E4 di B12 invariata (rilevatore spostato, stessa espressione).
- `data/` non modificata: `pnpm data:diff` non necessario.

**Correzioni post-review.** (1) Le voci `proposta` senza coppia canonica (`FI-003`, `FI-009`) non sono pubblicate; (2) le voci `proposta` che toccano una persona tramite coppie o ipotesi (`FI-011`, Kerimov) non sono pubblicate, quindi oggi nessuna voce `FI-` è pubblica (11 contate in `forbidden_inferences_not_public`); il cammino proprio di `H06` resta annotato tramite `G-0087`, la catena Kerimov→SpaceX non più; (3) ogni voce e classificazione `proposta` porta l'etichetta «proposta non rivista / unreviewed proposal»; (4) arco diretto su coppia vietata: errore solo per voci `revisionata`, avviso per le `proposta`; (5) una coppia vietata già presente come coppia di ipotesi unisce le proprie ipotesi alla riga esistente; (6) test dipendenti dai dati resi su fixture (E4 3/3 resta sui dati reali). Conteggi solo aggregati, calcolati sull'intero registro.

**Resta.** Revisione umana del registro (§6); fili interrotti e Tracciato in B16.
