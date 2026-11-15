# B14 — Coda testo–grafo (solo rapporto): analisi

Data: 15 novembre 2026 (Europe/Rome). Ramo `audit/fable-2026-11-implementation`; HEAD iniziale `ab870b80c7ab5bd14e950a5406f7bdf7aac7656c` (B12). Esecuzione non sorvegliata su mandato del manutentore. Nessun fetch, nessuna API esterna, nessuna scrittura in `data/`.

Fonti rilette: scheda B14 (§2, §3, §5 di [IMPLEMENTATION_BLOCKS.md](../IMPLEMENTATION_BLOCKS.md)); FABLE A §4.6, §9 (tabella di valutazione), §11 (E6) e appendice A; CONSOLIDATED_FINDINGS §3.4 (CF-015). Formato: B12 e B11.

## 1. Stato verificato

| Punto | Stato all'ingresso |
| --- | --- |
| Matcher E6 | `e6MentionsWithoutEdge` in `src/audit/baseline.ts` (B12): segmenti del nome italiano di almeno 5 caratteri, normalizzati, parola intera, su titolo + descrizione; esclude le entità già collegate all'evento da un arco `event_participation`. Restituisce 111 menzioni in 69 eventi, 56 entità. Nessuna lista di esclusione, nessun contesto, nessun esito |
| Differenza con A | A cita 134 (matcher con lista di esclusione costruita a mano, non archiviata) e 111 con l'appendice semplificata; A stesso dice che 134 è un limite superiore e che circa 6 di 38 menzioni non statali sono falsi positivi |
| Revisione | Nessun file di esiti, nessun comando che produca un elenco leggibile |
| Collegamenti già esistenti | Il matcher guarda solo gli archi di classe `event_participation`; 26 delle menzioni in coda riguardano un'entità con una relazione di **altra classe** che cita già l'evento in `events` (es. `G-0447`, `G-0457`, `G-0056`): informazione utile al revisore, assente dal rapporto E6 |
| Segmenti generici | `WAGNER` («Rete Wagner / collegati») genera 5 menzioni dal solo segmento «collegati»; `TUR_BRA_MOR` («Mercati Turchia, Brasile, Marocco (diesel russo)») duplica gli Stati `BR`/`MA` e una merce; `FOXTROT` ha il segmento «organizzazione criminale» |

## 2. Perimetro e piano file per file

| File | Contenuto |
| --- | --- |
| `src/audit/mentions.ts` (nuovo) | Matcher condiviso (`scanMentions`, `participationEdges`, `entitySegments`, `foldText`) spostato qui da `baseline.ts` senza cambiarne il comportamento; schemi Zod della lista di esclusione e del file di revisione; `buildMentionReport` (coda, escluse, precisione campionata con intervallo di Wilson 95 %, anomalie); `renderMentionReportMarkdown` |
| `src/audit/baseline.ts` | `e6MentionsWithoutEdge` ora delega a `scanMentions`; output di `pnpm benchmark:measure` per `A` verificato identico prima/dopo (confronto del JSON) |
| `src/cli/mentions.ts` (nuovo), `package.json` | `pnpm audit:mentions [--format md\|json] [--out <file>]`. `--out` rifiuta percorsi sotto `data/`, `sources/`, `schemas/`. Exit non zero se una esclusione non corrisponde a un segmento reale o se una revisione riguarda una coppia non più in coda |
| `docs/audit/mentions/exclusions.v1.json` | 5 esclusioni di segmento, ciascuna con motivo; file versionato (un cambio = `exclusions.v2.json`) |
| `docs/audit/mentions/review.v1.json` | Esiti `documented-role` / `context-only` / `false-positive` / `needs-evidence` per coppia (evento, entità), con `state` `proposta` o `revisionata` (quest'ultimo richiede `reviewer` e `reviewed_on`, imposto dallo schema). 26 voci, tutte `proposta` |
| `docs/audit/mentions/queue-2026-11-15-ab870b8.md` | Rapporto datato generato dal comando |
| `test/mentions.test.ts` | 9 test: matcher identico a E6; esclusioni applicate e menzioni escluse sempre elencate; nessuna esclusione o revisione orfana; unicità e validità delle voci, `proposta` mai con revisore; schema rifiuta stati incoerenti; segmentazione; precisione solo dalle voci; determinismo e avviso nel rapporto; dataset non modificato |
| Documentazione | `docs/ARCHITECTURE.md` (layout e sezione «Text–graph mention queue (B14)»), `README.md` (comando, roadmap), `AGENTS.md` (comando; gli agenti inseriscono solo `proposta`, mai `revisionata`, mai relazioni dalla coda) |

Fuori perimetro: creare archi o ipotesi; alias dei nomi (il matcher usa solo `name.it`); scansione di `description` di entità o relazioni; la classificazione completa delle 104 righe (compito del revisore).

## 3. Risultati verificati

| Misura | Valore |
| --- | --- |
| Menzioni grezze (E6, nessuna esclusione) | 111 (A: 111 semplificato / 134) |
| Escluse dalla lista versionata | 7 (`WAGNER` 5, `TUR_BRA_MOR` 2) |
| **Coda** | **104 menzioni, 65 eventi, 54 entità** (50 Stati, 19 organizzazioni, 13 istituzioni, 11 aziende, 9 persone, 2 asset) |
| Entità in coda senza alcuna relazione | 7 |
| Menzioni con relazione dell'entità che cita già l'evento | 26 |
| Campione (una riga ogni quattro, posizioni 0, 4, …, 100) | 26 righe (25 %) |
| Esiti proposti nel campione | `documented-role` 13, `context-only` 9, `needs-evidence` 4, `false-positive` 0 |

**Precisione campionata, dichiarata onestamente.** Le 26 classificazioni sono **proposte non riviste**, ricavate dalla sola lettura del titolo e della descrizione del record, senza consultare le fonti. In questo campione nessuna menzione è un falso positivo del matcher (26/26, Wilson 95 %: 87,1–100 %): questo dato è dopo le 7 esclusioni, che sono proprio la classe di falsi positivi lessicali che il campione non ha più trovato. Il dato che conta per chi cerca archi è un altro: solo 13/26 = 50 % (Wilson 95 %: 32,1–67,9 %) hanno un ruolo documentato nel testo, e **per ogni esito `documented-role` il revisore deve ancora decidere se e come modellarlo** (alcuni sono già coperti da relazioni non di partecipazione, altri sono valutazioni negative come «VIGINUM non attribuisce»). Il campione è sistematico, non casuale: non permette di estrapolare con certezza al resto della coda.

Osservazione che orienta la revisione: 50 righe su 104 sono Stati. In molti casi l'entità compare in un elenco di Paesi o come luogo (`context-only` nelle proposte); questo pone una decisione editoriale di politica (Stato come bersaglio/giurisdizione: arco sì o no?) che riguarda metà della coda e conviene prendere una volta sola.

## 4. Decisioni (esecuzione non sorvegliata, 2026-11-15)

Adottate dall'orchestratore su mandato del manutentore, **da confermare**.

| # | Decisione | Opzioni | Adottata e motivo |
| --- | --- | --- | --- |
| D-B14-1 | Dove vive il matcher | (a) duplicare in B14; (b) estrarre in `src/audit/mentions.ts` e importarlo da `baseline.ts` | **(b)**, come richiesto: una sola definizione, output di E6 verificato identico |
| D-B14-2 | Forma della lista di esclusione | (a) elenco di coppie (evento, entità); (b) segmenti per entità | **(b)**: la lista corregge il *lessico* del matcher, mentre il giudizio sulla singola coppia è un esito di revisione; così nessuna menzione viene nascosta per scelta editoriale. Le menzioni escluse restano elencate con il motivo; il numero grezzo (111) resta riproducibile |
| D-B14-3 | Formato del rapporto | (a) solo JSON; (b) Markdown di default, JSON con `--format json` | **(b)**: il Markdown è leggibile da un revisore, il JSON per strumenti. Rapporto archiviato datato come le baseline (mai modificato dopo: se ne produce uno nuovo) |
| D-B14-4 | Come rappresentare «proposta» e «revisionata» | (a) un solo campo; (b) `state` con vincoli di schema | **(b)**: lo schema impedisce una `proposta` con revisore e una `revisionata` senza revisore e data; l'agente non può registrare un esito come verificato |
| D-B14-5 | Dimensione del campione | (a) tutte le 104 righe; (b) campione piccolo | **(b)**, per l'indicazione «piccolo campione» e perché classificare tutto dal testo darebbe l'illusione di una revisione. Una riga ogni quattro: deterministico, ripetibile |
| D-B14-6 | `pnpm check` | (a) aggiungere il comando; (b) solo test | **(b)**: la coda è una fotografia, non una soglia; i test garantiscono coerenza di esclusioni e revisioni con i dati e il riuso del matcher E6 |
| D-B14-7 | Arricchire con relazioni che citano l'evento | (a) no; (b) sì, come colonna informativa | **(b)**: costo basso, riduce il lavoro del revisore (26 menzioni già parzialmente coperte). Nessun effetto sul conteggio |

## 5. Rischi e limiti

- Il matcher è lessicale e usa solo `name.it`: perde alias («SGDSN», «DOJ» ecc.) e sigle sotto 5 caratteri (`AP`, `EC`, `GB` compaiono solo col nome esteso); la coda è quindi un **limite inferiore** per le entità con sigle, mentre è un limite superiore per chi la legge come elenco di archi.
- La lista di esclusione può essere usata male per far sparire una coda scomoda: per questo ogni esclusione è nel rapporto con il motivo, è per segmento e non per coppia, e un test verifica che corrisponda a un segmento reale.
- Un esito `proposta` può essere scambiato per verificato: il rapporto lo ripete in testa, in tabella (`(proposta)`) e nella sezione precisione.
- Le proposte su persone (`MAJID`, `TRUMP`) non autorizzano alcuna relazione: vale la regola 7 di AGENTS.md (fonte primaria, stato giuridico, data).
- Il rapporto archiviato dipende dal commit dei dati e dal file di revisione; una modifica successiva richiede un nuovo rapporto datato.

## 6. Esito

**Fatto.** Matcher estratto e condiviso, comando di sola lettura, lista di esclusione versionata, file di revisione con schema, 26 proposte non riviste, rapporto datato, 9 test, documentazione.

**Verifica (15/11).** `pnpm check` verde: lint, typecheck, **252 test in 23 suite** (9 nuovi in `test/mentions.test.ts`), validate 0 errori/23 avvisi, sidecar, articoli, schemi, M5, contrasto. `pnpm benchmark:measure` prima e dopo l'estrazione: sezione `A` identica (inclusa E6, 111 menzioni). `--out data/x.md` rifiutato con exit 1 e nessun file creato. Nessun file di `data/`, `sources/`, `schemas/`, del sito o degli originali modificato: `pnpm build`, `pnpm check:links` e `pnpm data:diff` non necessari. Il file di baseline archiviato non è stato toccato.

**Azioni per il manutentore.**

1. Confermare D-B14-1…7.
2. Rivedere le 26 proposte e classificare le restanti 78 righe (passare `state` a `revisionata` con `reviewer` e `reviewed_on`); su `documented-role` decidere se e come modellare, nel rispetto di AGENTS.md (fonti primarie, regola 7 per le persone, E5 solo in ipotesi).
3. Decidere la politica sugli Stati (bersaglio, giurisdizione, luogo: arco o no) che riguarda 50 righe su 104.
4. Valutare alias per le entità con sigle brevi (`VIGINUM / SGDSN`, `DOJ`, …) in un'eventuale versione 2 della lista, con nuovo file e non modificando quello archiviato.
