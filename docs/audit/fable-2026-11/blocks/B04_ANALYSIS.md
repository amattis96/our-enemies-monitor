# B04 — Ingest M6: correttezza e validazione dei sidecar · Analisi

- **Blocco:** B04 (CF-005, parte di CF-022). Fonti: FABLE_B §4 V8 a–f, §7.2, §10 P6, §11 R9–R13, §6 T6–T8; FABLE_A §4.7.
- **Base verificata:** `main` @ `19b2533`; PR #18 (`research/osint-incremental-20261114`, head `d5e597f`, base `2ccb7a4`) letta in sola lettura con `git fetch` + `git show`.
- **Data:** 14 novembre 2026. Analisi in sola lettura: nessun file del repository modificato oltre a questo.
- **Script di riproduzione:** `/private/tmp/claude-501/b04-scratch/` (`repro.ts`, `pr18.ts`, `shift.ts`, radice temporanea `root/` usata con `OEM_REPO_ROOT`). Importano i moduli del progetto per percorso assoluto; nessuna scrittura in `data/` o `sources/`.

Stato di partenza: `pnpm validate` → 0 errori, 1 avviso; `pnpm test` → 11 file, 110 test passati.

---

## 1. Stato verificato

### 1.1 Riepilogo

| # | Difetto | Esito | Prova in una riga |
| --- | --- | --- | --- |
| a | Esclusione reciproca fra sidecar | **Confermato** (in memoria e via CLI) | Con Fonte_12 e Fonte_13 archiviati, ciascuno marca `duplicate` l'evento dell'altro; nessuno lo scrive |
| b | Marcatore di idempotenza falsificabile | **Confermato** | Nota `[ingest S11 …]` in un'operazione di S10 → l'operazione S11 omonima diventa `already_applied` verso `EXT-035`, e una relazione `@ref` di S11 viene agganciata a quell'evento estraneo |
| b′ | Variante: spazi iniziali | **Confermato** | `ItalianText`/`notes` usano `.trim()`: `"   [ingest S11 X]"` diventa `"[ingest S11 X]"` dopo il parsing |
| c | Duplicato che perde evidenze | **Confermato** | `create_event` con stesso URL di `EXT-034` (`needs_review`) o `EXT-001` (`imported_unreviewed`) + 2 riferimenti + claim sponsor → `duplicate`, 0 scritture sul record; le nuove fonti non vengono nemmeno registrate |
| d | Un sidecar non valido blocca tutti | **Confermato** | Altro sidecar con `schema_version: "1.1"` → exit 1 prima di pianificare; JSON malformato → `SyntaxError` non gestito |
| e | Nessuna validazione CI dei sidecar archiviati | **Confermato** (lettura) | `biome.json` esclude `sources`; `pnpm check` non legge `sources/incremental/*.proposals.json`; i test usano solo la fixture |
| f | Conflitti da Markdown archiviati crescenti | **Confermato** | Evento S13 con un URL che compare solo come riferimento in Fonte_12.md → `conflict` «check its records», anche se Fonte_12 sarebbe già stata ingerita; oggi 87 occorrenze di URL nei 3 Markdown archiviati |
| R13 | Unicità `Fonte_NN` / `source_id` non controllata | **Confermato** (lettura) | Nessun controllo nel codice; oggi i nomi sono unici (Fonte_09, 10, 11) |

Fatti nuovi emersi durante la verifica (non nel rapporto B):

- **N1. Un cambio di `schema_version` rompe tutto l'archivio.** `ProposalFile.schema_version` è `z.literal("1.0")`. Se il contratto passa a `1.1`, ogni sidecar archiviato `1.0` diventa non valido: con (d) blocca ogni ingest, e il nuovo controllo in `pnpm check` (e) fallirebbe su file immutabili. Qualsiasi soluzione che tocchi il contratto deve prima introdurre il parsing multi-versione.
- **N2. Il primo ingest reale rompe i test.** `test/ingest.test.ts` codifica gli ID calcolati sul dataset vivo (`EXT-035`, `G-0461`, `H32`, 22 scritture). Simulando l'ingest di Fonte_12 e poi la fixture, la fixture alloca `EXT-037…EXT-040` (script `shift.ts`). Dopo il merge di un ingest, `pnpm check` diventa rosso per motivi non legati al dato.
- **N3. Cascata sugli `@ref`.** Un `create_event` marcato `duplicate` da un *altro sidecar* ha `id: null` e non registra `local`; ogni `create_relationship`/`create_hypothesis` che lo cita con `@ref` diventa `rejected` («depends on @…, which was not accepted»). Con (a) l'esclusione reciproca si propaga quindi anche alle relazioni.
- **N4. Ambiguità del numero di fonte.** `ProposalSource.file` usa `Fonte_\d{2}[^/]*\.md` e il controllo di coerenza estrae `Fonte_(\d{2})`: `Fonte_100_x.md` passa come `S10`. Rilevante per R13 e per B11 (spazio degli ID).
- **N5. Nessun marcatore `[ingest` esiste oggi in `data/`** (`grep -rl "\[ingest" data` vuoto). Qualsiasi cambio della forma del marcatore non richiede migrazione.

### 1.2 Riproduzioni

Tutti i comandi da `/Users/antoniomattis/dev/our-enemies-monitor` salvo indicazione.

**Preparazione (sola lettura del repository).**

```bash
git fetch origin research/osint-incremental-20261114        # aggiorna solo FETCH_HEAD
git show FETCH_HEAD:sources/incremental/Fonte_12.proposals.json > /private/tmp/claude-501/b04-scratch/Fonte_12.proposals.json
git show FETCH_HEAD:sources/incremental/Fonte_12_Aggiornamento_OSINT_Eventi_Reti_Europa_2026-11-14.md > /private/tmp/claude-501/b04-scratch/Fonte_12.md
cd /private/tmp/claude-501/b04-scratch && node repro.ts
```

**(a) in memoria** — fixture S10 e un S11 sintetico con lo stesso primo `create_event`:

```text
[a] S10 with others=[S11]: [["OEM-20261112-001","duplicate",null,"already proposed in S11 S11-dup"]]
[a] S11 with others=[S10]: [["S11-dup","duplicate",null,"already proposed in S10 OEM-20261112-001"]]
```

**(a) via CLI** — radice temporanea `root/` (copia di `data/` e `sources/incremental/`, `sources/original` collegato), con Fonte_12 reale e un Fonte_13 che ripropone il suo primo evento:

```bash
OEM_REPO_ROOT=/private/tmp/claude-501/b04-scratch/root node src/cli/ingest.ts …/root/sources/incremental/Fonte_12.proposals.json
OEM_REPO_ROOT=… node src/cli/ingest.ts …/root/sources/incremental/Fonte_13.proposals.json
```

```text
== ingest Fonte_12 (dry run, both archived)
  [duplicate] OEM-20261114-001 create_event
      already proposed in S13 OEM-20261115-001
== ingest Fonte_13 (dry run, both archived)
  [duplicate] OEM-20261115-001 create_event
      already proposed in S12 OEM-20261114-001
```

**(b)** — la fixture S10 con `notes: ["[ingest S11 OEM-20261113-001] innocua nota"]` sul primo evento; il piano è applicato in memoria (`plannedFiles`), poi si pianifica un S11 con un evento diverso (Portogallo, altro URL) e una relazione che lo cita via `@ref`:

```text
[b] S11 after forged S10 write: [["OEM-20261113-001","already_applied","EXT-035","EXT-035 already carries [ingest S11 OEM-20261113-001]"],["OEM-20261113-001-rel","new","G-0462"]]
[b'] trimmed note: ["[ingest S11 X]"]
```

L'evento S11 non viene creato e la relazione `PL —COLLEGATO_A→ EXT-035` viene creata su un evento che S11 non ha mai citato. Punto del codice: `MARKER` (`plan.ts:100`) cercato su tutte le `review.notes` (`plan.ts:155-160`); `...operation.notes` copiato in `review.notes` in tutti e sei i rami (`plan.ts:396, 444, 507, 563, 627`).

**(c)** — `create_event` con lo stesso URL del record, `sources: ["R01","R02"]` e un claim sponsor su `R03`:

```text
[c] EXT-001 (imported_unreviewed) : [["dup-EXT-001","duplicate","EXT-001","same URL as EXT-001"]]
[c] writes touching EXT-001: 0 | all writes: S11
[c] EXT-034 (needs_review) : [["dup-EXT-034","duplicate","EXT-034","same URL as EXT-034"]]
[c] writes touching EXT-034: 0 | all writes: S11
```

Nessuna traccia nel rapporto delle fonti né del claim. Punto: ramo `matchEvent` (`plan.ts:332-337`).

**(d)** — nella radice temporanea, un `Fonte_13.proposals.json` con `schema_version: "1.1"`, poi con contenuto `{ broken`:

```text
…/Fonte_13.proposals.json: invalid proposals sidecar
  schema_version: Invalid input: expected "1.0"
exit=1
---
SyntaxError: Expected property name or '}' in JSON at position 2 (line 1 column 3)
```

Rimosso il file, l'ingest di Fonte_12 riprende (2 new, 1 enrichment). Punto: `readProposals` (`ingest.ts:43-53`) usato anche per gli altri sidecar (`ingest.ts:60-67`); `JSON.parse` fuori da ogni `try`.

**(e)** — lettura: `biome.json` `files.includes` contiene `"!sources"`; lo script `check` in `package.json` non ha passi su `sources/incremental`; `test/ingest.test.ts` legge solo `test/fixtures/Fonte_10.proposals.json` e l'esempio in M6 §4.7.

**(f)** — un evento S13 il cui `url` è un riferimento (non l'URL di un evento) di Fonte_12, con Fonte_12.md nell'archivio:

```text
[f] S13 event with URL https://www.it-daily.net/shortnews/bsi-danfoss-kuehlsteuerungen (reference-only in Fonte_12.md): [["s13","conflict",null,"URL already cited in sources/incremental/Fonte_12_x.md: check its records"]]
[f] URL occurrences in archived Markdown today: 87
```

Il filtro (`plan.ts:286-288, 349-355`) considera ogni Markdown archiviato tranne il proprio, inclusi quelli i cui eventi sono già in `data/` (e quindi già coperti da `matchEvent`). Il messaggio «check its records» è anche fuorviante per Fonte_10/11, che non hanno record.

**R13** — lettura: nessun controllo in `src/`. `ProposalFile.superRefine` verifica solo la coerenza `code`↔`Fonte_NN` interna al file.

**Controllo positivo PR #18.** Sidecar valido (`ProposalFile.safeParse` → `true`). Dry run CLI sul `main` attuale:

```bash
pnpm -s ingest /private/tmp/claude-501/b04-scratch/Fonte_12.proposals.json
```

```text
Operations: 2 new, 1 enrichment, 0 duplicate, 0 already_applied, 0 conflict, 0 rejected
BLOCKED: …Fonte_12_….md is not in the repository: merge the Markdown source before ingesting
  [new] OEM-20261114-001 create_event → EXT-035
  [new] OEM-20261114-002 create_event → EXT-036
  [enrichment] OEM-20261114-002-ext022 add_citation → EXT-022
Planned writes: 9 new, 1 updated
Validation: 1 error — sources/S12.json: file "…Fonte_12_….md" does not exist
```

Coincide con FABLE_B §V8 (2 `create_event`, 1 `add_citation`); l'unico blocco è atteso (Markdown non ancora su `main`). Nella radice temporanea con il Markdown presente il piano non ha blocchi.

**N2** — `node shift.ts`: piano di Fonte_12 applicato in memoria, poi la fixture: `OEM-20261112-001 → EXT-037` (il test si aspetta `EXT-035`), `-002 → EXT-038`, `-003 → EXT-039`, `-006 → EXT-040`.

---

## 2. Piano di modifica per file

Principio: **un solo ordine totale, e deduplicazione solo contro `data/`.** Se ogni sidecar precedente è già stato ingerito, i suoi eventi sono in `data/` e `matchEvent` li trova (stessi criteri di `sameEvent`: URL normalizzato, oppure date sovrapposte e similarità ≥ 0,6). Il confronto con altri sidecar serve quindi solo come informazione, mai come classificazione.

### 2.1 Ordine totale e «già ingerito» — nuovo `src/pipeline/ingest/archive.ts`

Funzioni pure, riusate da CLI, controllo di `pnpm check` e test:

- `fonteNumber(name)`: estrae `NN` da `Fonte_(\d+)_…\.md` o `Fonte_(\d+)\.proposals\.json` (con `_` o `.` dopo le cifre, per evitare N4).
- `orderKey(sidecar, fileName)` = `[Number(source.code.slice(1)), source.created_at, fileName]`; `compareSidecars` confronta in quest'ordine. Con R13 imposto, il numero basta; data e nome restano come spareggio difensivo.
- `isIngested(sidecar, dataset)`: vero se `dataset.sources` contiene `source.code` con `type: "corpus_document"` e `files` che include `source.file`. Lo crea il primo `--write` (che è tutto-o-niente: un piano bloccato non scrive nulla). Vale anche per Fonte_09 (`S09` registra il suo Markdown), coerentemente.
- `loadArchive(dir)`: legge Markdown e sidecar e restituisce `{ sidecars: {path, file}[], markdown: Map, warnings: string[] }`. Un sidecar non valido (JSON o schema) produce un avviso con i percorsi Zod e viene escluso, senza `process.exit`.
- `checkArchive(archive, dataset)`: le regole del controllo (§2.5), come `Issue[]`.

**Politica sui precedenti non ingeriti — tre opzioni.**

| Opzione | Comportamento | Pro | Contro |
| --- | --- | --- | --- |
| **G (gate, raccomandata)** | Se esiste un sidecar archiviato con chiave minore non ingerito → `fatal`: «ingest S12 first». | Ordine imposto, nessuno stato intermedio, deduplicazione solo contro `data/`; il caso «S12 e S13 propongono lo stesso evento» si risolve da sé (S12 crea, S13 trova il record). | Serializza gli ingest; un sidecar che non si riesce a ingerire (validazione) blocca i successivi finché non si corregge `data/`. Un sidecar tutto `conflict`/`rejected` si può comunque ingerire: registra il documento `S12` e sblocca. |
| P (pending) | I precedenti non ingeriti restano fonte di `duplicate` con riferimento «pending S12 ref». | Nessun blocco. | La classificazione dipende dal momento; il rerun di S13 dopo S12 cambia esito; due fonti di verità (sidecar e `data/`). |
| I (ignora) | Si deduplica solo contro `data/`; i precedenti non ingeriti sono ignorati. | Semplice. | Se S13 è ingerito prima di S12, S12 trova S13 in `data/` → ordine reale invertito rispetto alla numerazione; corretto ma non deterministico rispetto al calendario di lavoro. |

Con G, i sidecar **successivi** e i file `--compare` (PR aperte) non classificano più nulla: diventano voci di `attention` («also proposed by S13 OEM-…»), utili al revisore.

### 2.2 `src/cli/ingest.ts`

- Separare la lettura del sidecar in input (errore → exit 1, comportamento invariato) da quella degli altri, delegata a `loadArchive` (errori → `warnings`, mai exit). Catturare `JSON.parse` anche per l'input e i `--compare`, con un messaggio leggibile.
- Calcolare `predecessors` (archiviati con chiave minore) e `pending = predecessors.filter(p => !isIngested(p))`; passarli al piano. Se l'input stesso non è in `sources/incremental/` (caso `--compare`/fixture), la chiave si calcola comunque dal suo `source.code`.
- `later` = archiviati con chiave maggiore + `--compare` → contesto informativo.
- Markdown da passare al filtro (f): solo quelli **senza sidecar e non registrati come documento di corpus** (oggi Fonte_10 e Fonte_11). Fonte_09 esce (registrato come `S09`), Fonte_12 e successivi escono (hanno sidecar e, con G, sono già in `data/`). L'insieme smette di crescere.
- `warnings` passati a `buildReport`.

### 2.3 `src/pipeline/ingest/plan.ts`

1. **Contesto.** `IngestContext` diventa `{ dataset, pending?: string[], later?: ProposalFile[], legacyMarkdown?: Map<string,string>, fileExists }`. `pending` non vuoto → una voce `fatal` per sidecar. Il ciclo `elsewhere` (`plan.ts:338-348`) diventa una voce di `attention` per ogni `sameEvent` con un `later`, senza cambiare la classificazione.
2. **Marcatore non imitabile** (forma da decidere, §5 D1; raccomandata M1):
   - **M1 — prefisso alla copia (nessun cambio di contratto).** Ogni voce di `operation.notes` entra in `review.notes` come `Sidecar note: <testo>`. Solo il codice dell'importer produce note che iniziano con `[ingest `. Helper unico `sidecarNotes(operation)`, usato nei sei rami. Copre anche b′ (il prefisso si aggiunge dopo il `trim`).
   - **Difesa in profondità (consigliata con M1).** Il marcatore conta solo se il record è coerente con il codice: per eventi/relazioni/ipotesi `sources` contiene `code`; per le fonti `id === code` oppure `cited_in` contiene `code`; per le entità (senza `sources`) basta il marcatore. Un marcatore incoerente → `attention`, non `already_applied`.
   - `MARKER` resta ancorato (`^\[ingest (S\d{2})(?: ([^\]]+))?\]`); per N4 valutare `S\d{2,3}` solo con B11.
3. **Duplicato con evidenze nuove** (`create_event` → `matchEvent` di tipo `duplicate`, §5 D4):
   - calcolare con `preview` le citazioni dell'operazione e dei claim; `newCitations` = quelle che non risolvono a una fonte già in `target.sources` (un `null` = fonte da creare = nuova); `newClaims` = claim non nulli;
   - nessuna novità → `duplicate` come oggi;
   - novità e target `needs_review` → **`enrichment`**: stesse scritture di `add_citation` (`commitAll`, `sources` uniti con `code`, nota `${header} Duplicate of ${target.id}: adds sources …`, una nota per claim con livello e fonti, `Sidecar note:`), più una voce `attention`. Il rerun è `already_applied` grazie al marcatore nella nota;
   - novità e target pubblico (`imported_unreviewed`/`reviewed`) → **`conflict`** senza scritture, con l'elenco puntuale nel rapporto;
   - in tutti i casi le differenze di `date`/`title` rispetto al record diventano `reasons` (mai applicate);
   - nuovo campo opzionale `OperationOutcome.unapplied?: { target: string; citations: string[]; claims: string[] }` per tutto ciò che non viene scritto (conflitto o duplicato con target pubblico). Così R11 è verificabile sul JSON.
   - `local.set(ref, target.id)` resta, quindi N3 non si presenta più per i duplicati veri.
4. **Filtro (f).** Usa `legacyMarkdown`; messaggio: «URL quoted in Fonte_10 (Markdown without sidecar, not ingested): check whether the item is already described there». Resta `conflict`.
5. Estensione facoltativa, fuori dal minimo: anche `create_entity` duplicato scarta in silenzio alias e fonti. Si può riportare in `unapplied` con lo stesso meccanismo; non scrivere nulla.

### 2.4 `src/pipeline/ingest/report.ts`

- `IngestReport.warnings: string[]` (sidecar non validi, marcatori incoerenti) e resa testuale in una sezione «Warnings».
- Sezione «Evidence not applied» generata da `operations[].unapplied`.
- `summary` invariato nelle chiavi (nessuna nuova classificazione).

### 2.5 Controllo in `pnpm check` — nuovo `src/cli/validate-sidecars.ts`

Script `"validate:sidecars": "node src/cli/validate-sidecars.ts"`, inserito in `check` subito dopo `pnpm validate`. Regole (errori salvo indicazione):

1. ogni `sources/incremental/*.proposals.json` è JSON valido e passa `ProposalFile`;
2. il nome è `Fonte_NN.proposals.json` e `source.code === "S" + NN`;
3. `source.file` esiste, è in `sources/incremental/` e ha lo stesso `NN`;
4. **R13:** per ogni `NN` al massimo un Markdown `Fonte_NN_*.md` e al massimo un sidecar; `source.code` e `source.file` unici fra i sidecar; nessun nome `Fonte_\d{3,}` finché B11 non allarga gli ID (errore esplicito, vedi N4);
5. `source.code` non è già registrato in `data/sources` per un file diverso (la collisione che oggi è `fatal` solo all'ingest);
6. *avviso:* Markdown con `NN ≥ 12` senza sidecar (il contratto di Task A lo rende obbligatorio); *avviso:* sidecar archiviati non ancora ingeriti, in ordine (rende visibile la coda).

La CI già esegue `pnpm check` su ogni PR (`.github/workflows/ci.yml`), quindi anche sulle PR `research/*`. Con B02 (CI per percorso) occorre che `sources/incremental/**` attivi questo controllo.

Facoltativo, sconsigliato come errore: eseguire `planIngest` a secco su ogni sidecar non ingerito e segnalare `rejected`. Il risultato dipende da `data/`; al massimo un avviso.

### 2.6 `src/model/proposals.ts`

- **Con M1: nessuna modifica**, `schema_version` resta `"1.0"`, `schemas/proposals.schema.json` invariato.
- In ogni caso, preparazione a N1 (consigliata, non obbligatoria in B04): esportare `parseSidecar(json)` che legge `schema_version` e smista su un parser per versione (`SUPPORTED_SCHEMA_VERSIONS = ["1.0"]`). Quando si passerà a `1.1` (B11, oppure M3), i file `1.0` archiviati resteranno leggibili.
- Con M3 (alternativa): `notes` con `.refine(n => !n.startsWith("[ingest"))`, versione `1.1`, `pnpm schemas`, parsing multi-versione obbligatorio, aggiornamento del prompt di Task A §4.6.

### 2.7 `package.json`

Aggiunta di `validate:sidecars` e del passo in `check`. Nessuna dipendenza nuova.

### 2.8 `test/ingest.test.ts` (robustezza, N2)

Sostituire gli ID letterali dipendenti dal dataset vivo con valori calcolati (`nextId` sul dataset caricato, esportato da `plan.ts` o ricalcolato nel test) o con un dataset congelato in `test/fixtures/`. Raccomandato il calcolo: niente seconda copia di `data/` da mantenere. Il conteggio delle scritture del test CLI (22) resta stabile finché la fixture non incontra record ingeriti; va comunque espresso come «tutte le scritture del piano».

---

## 3. Test

Tutti con `planIngest` / `checkPlan` / `plannedFiles` sul modello dei test esistenti, più due test CLI con `OEM_REPO_ROOT` su una radice temporanea.

| ID | Mappa | Scenario | Esito atteso |
| --- | --- | --- | --- |
| T-a1 | R9, T6 | S12 e S13 con lo stesso evento; ingest S12, piano applicato, poi S13 | S12: `new` `EXT-x`; S13: `duplicate` di `EXT-x` (o `enrichment` se porta fonti nuove) |
| T-a2 | R9 | Ingest di S13 con S12 archiviato e non ingerito | `fatal` «ingest S12 first»; nessuna scrittura; exit 1 da CLI |
| T-a3 | R9 | Stessi file elencati in ordine diverso (`readdirSync` permutato) | piano identico (determinismo) |
| T-a4 | R9 | `--compare` e sidecar successivi con lo stesso evento | classificazione `new`; voce `attention` «also proposed by …» |
| T-a5 | N3 | S13 duplicato di un evento S12 ingerito, con relazione `@ref` | la relazione risolve sull'ID esistente, non `rejected` |
| T-b1 | R10, T7 | Nota `[ingest S11 X]` in S10; scrittura; poi S11 con ref `X` | S11 `X` è `new`; nel record S10 la nota è `Sidecar note: [ingest S11 X]` |
| T-b2 | R10 | Variante con spazi iniziali | stesso esito di T-b1 |
| T-b3 | R10 | Autoimitazione: nota `[ingest S10 Y]` su un'operazione di S10, poi rerun | `Y` non diventa `already_applied` verso il record sbagliato |
| T-b4 | difesa | Marcatore corretto su record che non cita il codice | `attention`, non `already_applied` |
| T-c1 | R11, T8 | Duplicato per URL di un evento `needs_review` con 2 fonti nuove e un claim | `enrichment`; `sources` del record + fonti + `code`; nota del claim; rerun `already_applied` senza scritture |
| T-c2 | R11 | Duplicato di `EXT-001` (`imported_unreviewed`) con fonti nuove | `conflict`; `unapplied.citations` e `claims` elencati; nessuna scrittura su `EXT-001`; proiezione M5 invariata |
| T-c3 | R11 | Duplicato senza novità | `duplicate`, nessuna scrittura (comportamento attuale) |
| T-d1 | R12 | Altro sidecar con schema non valido e altro con JSON rotto | ingest dell'input prosegue, exit 0 (salvo altri blocchi), `warnings` con file e percorso Zod |
| T-d2 | R12 | Input con JSON rotto | exit 1 con messaggio leggibile, senza stack |
| T-e1 | R12, e | `validate:sidecars` su una radice con un sidecar non valido | exit 1, errore che nomina file e campo |
| T-e2 | R12 | `validate:sidecars` sul repository | exit 0 (oggi nessun sidecar; dopo PR #18 uno valido) |
| T-r13a | R13 | `Fonte_12_a_2026-11-14.md` e `Fonte_12_b_2026-11-15.md` | errore di unicità |
| T-r13b | R13 | `Fonte_13.proposals.json` con `code: "S12"`; due sidecar con lo stesso `source.file` | errori |
| T-r13c | N4 | `Fonte_100_x.md` | errore esplicito (fino a B11) |
| T-f1 | f | URL presente solo in un Markdown con sidecar ingerito | non `conflict` |
| T-f2 | f | URL presente in Fonte_10.md (senza sidecar) | `conflict` con il nuovo messaggio |
| T-acc | accettazione | Dry run del sidecar di PR #18 (dopo il merge, o da fixture copiata) | 2 `new` `create_event`, 1 `enrichment` `add_citation`, nessun `fatal` con Markdown presente |
| T-n2 | N2 | Test della fixture con un dataset che contiene già `EXT-035` | passano (ID calcolati) |

Test esistenti da adattare: «detects duplicates across other incremental sources» (la parte `others` diventa T-a4, la parte Markdown diventa T-f2) e i letterali di «classifies every operation» e «writes only needs_review…» (T-n2).

---

## 4. Documentazione (stesso commit)

- `docs/ARCHITECTURE.md` — «Incremental ingest»: ordine totale e gate dei precedenti, deduplicazione solo contro `data/`, sidecar successivi e `--compare` solo come attenzione, marcatore e prefisso `Sidecar note:`, duplicato con evidenze nuove, filtro limitato ai Markdown senza sidecar; «Commands» e «Validation rules»: `pnpm validate:sidecars` e le sue regole.
- `docs/M6_CHATGPT_OSINT_WORKFLOW.md` §4: 4.1 (unicità `Fonte_NN`, controllo in CI), 4.3 (regole del controllo), 4.4 (tabella: `enrichment` anche da `create_event` duplicato; `conflict` con evidenze non applicate; «Across incremental sources» riscritto; idempotenza), 4.5 (ordine obbligatorio degli ingest, avvisi, `--compare` informativo), 4.8 (limiti residui). §4.6 (prompt di Task A) **solo** se si sceglie M3.
- `AGENTS.md`: elenco comandi (`pnpm validate:sidecars`); regola «Local coding agents — ingest»: ingerire i sidecar in ordine di numero, uno per PR, senza saltare un precedente.
- `README.md`: solo se elenca i comandi di `pnpm check`.
- `docs/audit/fable-2026-11/IMPLEMENTATION_BLOCKS.md`: stato di B04 nella tabella di avanzamento.

---

## 5. Decisioni aperte

| # | Decisione | Opzioni | Raccomandazione |
| --- | --- | --- | --- |
| D1 | Forma del marcatore | **M1** prefisso `Sidecar note:` alla copia delle note (+ coerenza marcatore/codice); **M2** campo tecnico `review.ingest: [{source, ref}]` nel modello canonico (schema di `data/`, `pnpm schemas`, sezione Data model); **M3** rifiuto via schema delle note che iniziano con `[ingest` (contratto `1.1`) | **M1**: chiude a, b′ e l'autoimitazione senza toccare né contratto né modello; nessuna migrazione (N5). M2 è più pulita a lungo termine e si può valutare con B13 (contratto di lettura). M3 è la più costosa per N1 |
| D2 | `schema_version` invariata in B04? | Sì (M1/M2) / No (M3) | **Sì, resta `1.0`.** Se in futuro serve `1.1` (B11), introdurre prima `parseSidecar` multi-versione (§2.6), altrimenti l'archivio diventa illeggibile |
| D3 | Precedenti non ingeriti | G gate / P pending / I ignora (§2.1) | **G**: l'unica che dà un esito indipendente dal momento dell'esecuzione |
| D4 | Duplicato con evidenze nuove su target `needs_review` | scrittura come `enrichment` (coerente con `add_citation`) / solo rapporto | **`enrichment`** con nota marcata e voce di attenzione; su target pubblico sempre `conflict` con elenco |
| D5 | Semantica di `--compare` | resta `duplicate` / diventa `attention` | **`attention`**: una PR aperta è per definizione successiva; non deve impedire la creazione |
| D6 | Backfill di Fonte_10/11 (solo inquadramento) | (i) sidecar nuovo e versionato `Fonte_10.proposals.json` aggiunto dopo, Markdown intatto; (ii) estrazione editoriale manuale da parte di un umano; (iii) lasciarle come solo archivio | Da decidere. Vincoli: `AGENTS.md` vieta agli agenti di estrarre record dal Markdown, quindi (i) richiede un autore designato e un'autorizzazione esplicita; con il gate G un sidecar tardivo con numero minore va ingerito subito dopo il merge, altrimenti blocca i successivi (oppure il gate considera solo i precedenti archiviati *prima* dell'ultimo ingerito: da specificare se si sceglie (i)); la fixture `test/fixtures/Fonte_10.proposals.json` è scritta a mano per i test e non è una revisione di Fonte_10 |
| D7 | PR #18 prima o dopo B04 | prima / dopo | **Il merge può avvenire prima**: i difetti si manifestano all'ingest, non al merge, e con un solo sidecar su `main` il piano di Fonte_12 è corretto (verificato). Ma: **nessun `pnpm ingest --write` finché B04 non è unito**, sia per (a) appena arriva Fonte_13, sia per N2 (il primo ingest rende rossi i test). Se serve ingerire Fonte_12 prima di B04, farlo solo con Fonte_12 come unico sidecar archiviato e aggiornare i test nello stesso PR |

---

## 6. Rischi e limiti

**Rischi della modifica.**

- Il gate G serializza gli ingest: con un sidecar al giorno, la coda cresce se gli ingest non tengono il ritmo. È un limite operativo (B21), non di correttezza; l'avviso «sidecar non ingeriti» in `validate:sidecars` lo rende visibile.
- Un precedente che non si riesce a ingerire perché `data/` non valida dopo il piano blocca tutto. Mitigazione: l'errore è esplicito e la correzione è in `data/`, mai nel sidecar.
- M1 cambia il testo delle note dei record futuri (`Sidecar note:`); nessun record esistente è interessato (N5).
- L'arricchimento da duplicato scrive su record `needs_review`: non cambia la proiezione pubblica (stessa regola di `add_citation`, già testata), ma aumenta le fonti di candidati non revisionati. FABLE_A §4.7 mostra che più riferimenti non significano più radici indipendenti: la nota di arricchimento deve riportare il `publisher` di ogni fonte aggiunta, così il revisore vede le ripubblicazioni.
- Il controllo R13 rende rossa una PR di Task A con numero duplicato: è voluto, ma Task A deve sapere come rinumerare (B10).

**Non verificato.**

- Il comportamento reale di Task A su numerazione e date (solo PR #18 osservata).
- Il gate non è stato prototipato: la riproduzione copre i difetti, non la correzione.
- I tempi di `validate:sidecars` su archivi grandi (trascurabili per decine di file; non misurati).
- Eventuali consumatori esterni del JSON del rapporto: nel repository nessuno; i campi nuovi sono additivi.
- Non è stato verificato se la PR #18 abbia check CI verdi né se `pnpm check` sul suo ramo passi; letti solo i due file.

**Stima del diff.** Circa 600–750 righe: `archive.ts` nuovo ~120, `validate-sidecars.ts` ~60, `plan.ts` +90/−35, `ingest.ts` +50/−25, `report.ts` +30, `package.json` +2, test +280/−30, documentazione +70. Un PR, più commit (`fix(ingest)`, `feat(ingest)`, `test(ingest)`, `docs`), nessuna modifica a `data/`, `sources/`, `schemas/` con M1.

## 7. Decisioni del manutentore (14 novembre 2026)

Approvate le raccomandazioni dell'analisi:

- **D1** — note copiate dal sidecar con prefisso `Sidecar note:`; marcatore di idempotenza non imitabile.
- **D2** — `schema_version` del contratto invariata (1.0) in B04; allargamento degli ID rinviato a B11.
- **D3** — gate sull'ordine: l'ingest rifiuta finché un sidecar precedente non è ingerito; deduplicazione solo contro `data/`.
- **D4** — duplicato con evidenze nuove: `enrichment` se il record è `needs_review`, altrimenti `conflict` con l'elenco delle evidenze non applicate.
- **D5** — `--compare` solo informativo.
- **D6** — fuori da B04: recupero di Fonte_10/11 rinviato (da riprendere con B10).
- **D7** — PR #18 unibile come sola fonte; nessun `pnpm ingest --write` finché B04 non è su `main`.
