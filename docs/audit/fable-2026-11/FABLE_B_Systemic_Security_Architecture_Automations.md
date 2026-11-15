# FABLE B — Systemic Security, Architecture & Autonomous Operations

**Progetto:** Our Enemies Monitor · **Branch:** `main` · **Commit analizzato:** `d1f6a97601409f00f2bdefc47533b7b2f75d47ff` · **Data analisi:** 14 novembre 2026

Classificazione usata per ogni rischio:

- **[DIMOSTRATO]** — riprodotto sul codice del progetto o osservato nello stato reale di GitHub (impostazioni, PR, esecuzioni CI).
- **[PLAUSIBILE]** — il codice lo consente e le condizioni operative lo rendono verosimile, ma non è stato osservato.
- **[IPOTETICO]** — richiede un avversario o una coincidenza non osservati; non verificabile senza test invasivi, che non sono stati eseguiti.

Nessun file del repository, workflow, dato o automazione è stato modificato. Le riproduzioni sono state eseguite in memoria, importando i moduli del progetto da script esterni al repository. L'unico file creato è questo rapporto, non tracciato e non committato.

---

## 1. Executive summary

Il progetto ha controlli deterministici ben costruiti: validatore, cancello di pubblicazione, ingestione idempotente, diff delle evidenze. Il problema strutturale è che quasi tutti poggiano su tre assunzioni condivise che lo stato reale smentisce. Quando un'assunzione comune cade, controlli che sembrano indipendenti cadono insieme.

**Assunzione 1 — «Gli agenti e il manutentore sono identità diverse.»** [DIMOSTRATO] Tutte le 18 pull request del repository sono state create dall'account `amattis96`, e le 16 unite sono state unite dallo stesso account, tutte con decisione di revisione `REVIEW_REQUIRED`. La protezione del ramo richiede un'approvazione del code owner, ma `enforce_admins` è disattivato: ogni merge è avvenuto scavalcando la revisione richiesta. I tre task ChatGPT operano quindi con l'identità e i privilegi di amministratore del proprietario. La documentazione afferma il contrario in due punti («Agent pull requests are authored by a bot and therefore need the maintainer's approval»; Task C unisce «without … administrator bypass»).

**Assunzione 2 — «Lo stato di revisione distingue ciò che un umano ha approvato.»** [DIMOSTRATO] `review.status` è una stringa che qualunque PR può scrivere. Il cancello pubblica tutto ciò che non è `needs_review`, quindi un record nuovo con `imported_unreviewed`, senza provenienza, supera `pnpm validate` e viene pubblicato. Un articolo con `reviewed` e nessun link viene pubblicato. Nessun controllo automatico verifica chi ha impostato quei valori.

**Assunzione 3 — «Le regole per gli agenti si applicano alle PR degli agenti.»** [DIMOSTRATO] Le regole severe del diff scattano solo sui rami `agent/*`. I task usano rami `research/*`, sui quali impostare `reviewed`, promuovere un'ipotesi o cancellare un record produce solo una nota «attention» con uscita 0. Il job `evidence-diff` non è fra i controlli richiesti. Nessuna PR `agent/*` è mai stata unita.

Altri risultati di rilievo:

- **Task C non ha rispettato il proprio contratto alla prima esecuzione osservata.** [DIMOSTRATO] Il 13 novembre ha unito tre PR in 18 secondi, senza attendere la CI fra un merge e l'altro. `main` è rimasto rosso per 2 ore e 24 minuti e due esecuzioni sono state annullate dalla concorrenza.
- **L'ingestione ha quattro difetti logici**, tutti riprodotti: due fonti che riportano lo stesso evento si escludono a vicenda e l'evento non entra mai; una nota di testo libero può falsificare il marcatore di idempotenza di un'altra fonte; un duplicato scarta le nuove citazioni; un sidecar archiviato non valido blocca l'ingestione di tutti gli altri.
- **La traduzione inglese può cambiare significato senza che nulla lo rilevi.** [DIMOSTRATO] L'impronta copre solo il testo italiano.
- **La protezione delle persone dipende da un campo dichiarato da chi scrive il record.** [DIMOSTRATO] Un individuo registrato come `organization` evita ogni regola; qualunque URL soddisfa il requisito di fonte primaria.
- **Lo spazio degli identificativi finisce presto.** [DIMOSTRATO] `S\d{2}` e `Fonte_\d{2}` ammettono 99 fonti. Al ritmo di una al giorno il limite arriva intorno al 9 febbraio 2027.
- **Il canale di prompt injection più diretto è la coda delle PR.** [IPOTETICO] Il repository è pubblico e Task C deve leggere «l'intera coda delle PR aperte», con diritti di merge da amministratore.

Risultati positivi verificati: nessun segreto nei workflow, permessi predefiniti di sola lettura, trigger `pull_request` (non `pull_request_target`), lockfile con integrità, rendering Markdown sicuro, nessuno script di terze parti nel sito, primo sidecar reale (PR #18) valido e correttamente classificato, prestazioni in memoria adeguate anche a 100 volte la dimensione attuale.

Priorità assoluta: separare le identità e rendere la revisione non scavalcabile (§10, P1). Finché agenti e approvatore coincidono, ogni altro controllo è una convenzione che lo stesso soggetto può ignorare.

---

## 2. Baseline del repository e superfici analizzate

| Elemento | Valore | Fonte |
| --- | --- | --- |
| Commit | `d1f6a97`, albero pulito | stato Git |
| Dataset | 181 eventi, 220 entità, 458 relazioni, 32 ipotesi, 106 fonti, 14 esposizioni | `pnpm validate` (rapporto A) |
| Proiezione pubblica | 147 eventi, 202 entità, 433 relazioni, 11 ipotesi, 56 fonti | `pnpm audit:publication` |
| PR totali | 18: 16 unite, 1 chiusa (`agent/ci-selftest`), 1 aperta (#18, Fonte_12 con sidecar) | API GitHub |
| Durata tipica della CI | 40–65 secondi | esecuzioni su `main` |

**Protezione di `main` (letta dall'API GitHub):**

| Impostazione | Valore | Conseguenza |
| --- | --- | --- |
| Controlli richiesti | solo `check` | `evidence-diff` può fallire senza bloccare |
| `strict` (ramo aggiornato) | `false` | una PR verde su una base vecchia può rompere `main` |
| Revisioni richieste | 1, del code owner | l'unico code owner è l'autore di ogni PR |
| `enforce_admins` | `false` | l'amministratore scavalca revisione e controlli |
| `dismiss_stale_reviews` | `true` | irrilevante finché nessuna revisione viene data |
| Firme richieste | no | i commit non sono attribuibili crittograficamente |
| Ruleset | nessuno | — |
| Merge commit e squash | entrambi consentiti | — |
| `delete_branch_on_merge` | `false` | i rami uniti si accumulano |
| Permessi predefiniti dei workflow | `read` | corretto |
| `can_approve_pull_request_reviews` | `true` | un workflow potrebbe approvare PR |

**Superfici esaminate:** `.github/workflows/ci.yml`, `CODEOWNERS`, `.github/agent/research-prompt.md`, `docs/CHATGPT_SCHEDULED_TASKS.md`, `docs/M6_CHATGPT_OSINT_WORKFLOW.md`, `docs/ARCHITECTURE.md`, `docs/M5_EVIDENCE_AUDIT.md`, `src/pipeline/{validate,diff,translations,articles}.ts`, `src/pipeline/ingest/{plan,match,apply}.ts`, `src/cli/{ingest,data-diff,audit-m5}.ts`, `src/site/{publication,articles,read-model,exports,research,history}.ts`, `src/model/{schemas,article}.ts`, parte di `src/model/proposals.ts` e `src/editorial/m5.ts`, `package.json`, `biome.json`, `web/astro.config.ts`, i punti di inserimento HTML in `web/src/`.

**Non esaminato o non verificabile:** vedi §12.

---

## 3. Modello della catena di fiducia

| # | Passaggio | Chi produce | Chi verifica | Controlli automatici | Controllo umano | Trasformazione e perdita |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Fonte esterna → Task A | Editori, istituzioni, attori ignoti | Task A (modello) | nessuno | nessuno | Il testo della pagina diventa parafrasi; nessuna copia né hash della pagina |
| 2 | Task A → `Fonte_XX.md` | Task A | nessuno prima della PR | nessuno: `sources/` è escluso da Biome e da ogni validatore | nessuno | Il Markdown è libero; front matter letto solo per l'archivio del sito |
| 3 | Task A → sidecar | Task A | schema Zod, **solo se qualcuno esegue `pnpm ingest`** | nessuno in CI | nessuno | Le affermazioni diventano operazioni tipizzate; `kind`, livelli e date sono dichiarati dal modello |
| 4 | PR `research/*` | Task A o B, come `amattis96` | CI `check` | lint, test, validazione di `data/` e articoli; **nessuna regola agente** | nessuno richiesto di fatto | — |
| 5 | Revisione | Task C, come `amattis96` | Task C | nessuno verifica che la revisione sia avvenuta | nessuno | L'esito è un commento o un merge; non resta traccia strutturata di che cosa è stato verificato |
| 6 | Merge | Task C o manutentore, stesso account | protezione del ramo | `check` verde su base non necessariamente aggiornata | scavalcato dai privilegi di amministratore | Squash: i commit intermedi spariscono dalla storia di `main` |
| 7 | Archivio sul sito | build | — | parsing YAML del front matter | nessuno | **Promozione di fiducia:** titolo e link del documento non revisionato compaiono in homepage |
| 8 | Ingestione | manutentore o agente locale | `planIngest`, `checkPlan` | schema, riconciliazione, validatore completo | la PR `agent/*` risultante | Autore, mandante, movente e impatto diventano stringhe in `review.notes`; i duplicati perdono le citazioni |
| 9 | Dati canonici → proiezione | `publishedDataset` | — | `needs_review`, `pending_integration`, persona senza URL | l'unico atto umano è scrivere una stringa di stato | — |
| 10 | Build → Pages | GitHub Actions | `check:links` | la stessa build produce artefatto e manifest con gli hash | nessuno | Nessuna attestazione indipendente dell'artefatto |

Punti in cui la fiducia cresce senza che una verifica la giustifichi:

- **2 → 7.** Un documento con `status: proposed` nel front matter, scritto da un modello e unito in pochi secondi, viene presentato in homepage sotto «Nuove fonti e dossier acquisiti». L'avviso che non si tratta di eventi revisionati è presente e corretto; resta il fatto che il collegamento porta a un testo non revisionato che può nominare persone.
- **5 → 6.** Un merge eseguito dallo stesso account che ha aperto la PR vale, nella storia Git, quanto una revisione indipendente.
- **9.** `imported_unreviewed` nasce come etichetta storica della baseline ed è diventato, di fatto, un lasciapassare per la pubblicazione.

---

## 4. Vulnerabilità e incoerenze effettivamente riscontrate

Ogni voce indica sequenza, file, controlli esistenti, classificazione, test e mitigazione.

### V1. Agenti, revisore e manutentore condividono un'identità con privilegi di amministratore [DIMOSTRATO]

**Evidenza.** API GitHub: 18 PR, autore `amattis96` in tutte; 16 unite da `amattis96`; `reviewDecision: REVIEW_REQUIRED` in tutte al momento del merge; le uniche revisioni registrate sono due commenti dello stesso account sulle PR #9 e #12. `enforce_admins.enabled: false`.

**Sequenza.** Task A o B apre una PR come proprietario → la regola «1 approvazione del code owner» non può essere soddisfatta, perché l'autore non può approvare la propria PR → il merge avviene comunque, grazie ai privilegi di amministratore.

**Controlli esistenti.** `CODEOWNERS` e la protezione del ramo, entrambi resi inefficaci dalla coincidenza delle identità. Le istruzioni dei task, che sono testo.

**Conseguenze.**

- La storia Git non permette di distinguere un atto umano da un atto di un agente. La PR #14, che ha impostato `reviewed` su `ART-0001` e `ART-0002`, è indistinguibile da una PR di Task C. La nota di revisione dichiara un'autorizzazione del manutentore, ma è testo scritto nello stesso commit.
- Una modifica a `.github/workflows/ci.yml`, a `src/site/publication.ts` o ai test può raggiungere `main` senza revisione. Il job `deploy` ha `pages: write` e `id-token: write`.
- Ogni garanzia del tipo «gli agenti non possono» va letta come «agli agenti è stato chiesto di non».

**Limite dell'evidenza.** Dall'API non si può stabilire quali merge siano stati eseguiti da Task C e quali da una persona. L'orario indica Task C per le PR #3, #10 e #11 (V2).

**Test.** `gh pr list --state merged --json author,mergedBy,reviewDecision`: nessuna PR unita deve avere `REVIEW_REQUIRED`.

**Mitigazione.** §10, P1.

### V2. Task C: tre merge in 18 secondi, `main` rosso per 2 ore e 24 minuti [DIMOSTRATO]

**Cronologia (UTC, 13 novembre 2026; 04:00 UTC = 05:00 Europe/Rome, orario di Task C):**

| Ora | Fatto |
| --- | --- |
| 04:01:07 | merge PR #11 (Fonte_11) |
| 04:01:21 | merge PR #3 (Fonte_10, aperta il 12 novembre alle 19:31) |
| 04:01:25 | merge PR #10 (dossier tematico) |
| 04:01:37–38 | commenti di revisione sulle PR #9 e #12 |
| 04:01 | tre esecuzioni CI su `main`: due annullate, una **fallita** |
| 06:24–06:25 | PR #13 `fix/ingest-fonte10-after-merge` aperta e unita; `main` torna verde |

**Causa del fallimento.** `test/ingest.test.ts` («Fonte_10 fixture dry run … validates, apart from the not yet merged Markdown file») presupponeva che Fonte_10 non fosse su `main`. La PR #3 era stata verificata su una base precedente all'introduzione di quel test (PR #7). Con `strict: false` è rimasta verde e unibile.

**Scostamento dal contratto.** `docs/CHATGPT_SCHEDULED_TASKS.md` §4.4 prescrive: dopo ogni merge, aggiornare HEAD e verificarne CI, build, link e deploy prima di procedere. La CI dura 40–65 secondi; i merge sono distanti 4 e 14 secondi.

**Osservazione sulla profondità della revisione.** Cinque PR, per circa 1.360 righe aggiunte, sono state trattate entro 98 secondi dall'orario programmato. Non ho accesso al registro di esecuzione del task: l'orario è compatibile sia con un avvio anticipato sia con una revisione più breve di quella «sostanziale» descritta. Va verificato nel registro di ChatGPT.

**Effetto sistemico.** Tre comportamenti singolarmente accettabili — PR verde su base vecchia, merge ravvicinati, annullamento delle esecuzioni concorrenti — hanno prodotto insieme un `main` rotto e nessun deploy. Il sito è rimasto alla versione precedente senza alcuna segnalazione.

**Test.** Per ogni merge su `main`, l'esecuzione CI di quel commit deve essere `success` prima del merge successivo; nessuna esecuzione `cancelled` deve essere l'ultima per un commit non seguito da un successo.

**Mitigazione.** §10, P7.

### V3. Le regole per gli agenti dipendono dal nome del ramo, scelto dall'agente [DIMOSTRATO]

**File.** `.github/workflows/ci.yml` (job `evidence-diff`, variabile `AGENT_BRANCH`), `src/cli/data-diff.ts`, `src/pipeline/diff.ts` (`agentError`).

**Riproduzione.** Lo stesso diff (un evento nuovo `imported_unreviewed`, `H06` portata a `promoted` e `reviewed`) passato a `diffData`:

| Modalità | Esito |
| --- | --- |
| ramo `research/*` (`agent: false`) | 3 segnalazioni `attention`, uscita 0 |
| ramo `agent/*` (`agent: true`) | 3 `error`, uscita 1 |

**Aggravanti.** Fuori dalla modalità agente il controllo «solo `data/`» non esiste, quindi un ramo `research/*` può toccare `data/`, `src/` e i workflow. Il job `evidence-diff` non è un controllo richiesto, quindi anche un errore su `agent/*` non blocca il merge. Il diff copre soltanto `data/`: `content/articles/` non è coperto da alcun diff.

**Mitigazione.** §10, P2.

### V4. Lo stato di revisione è una stringa; `imported_unreviewed` pubblica [DIMOSTRATO]

**File.** `src/site/publication.ts` (`eligible`), `src/pipeline/validate.ts`.

**Riproduzione.** Evento nuovo `TL-9001`, `timeline_status: integrated`, `review.status: imported_unreviewed`, `provenance: []`, senza inglese: 0 errori di validazione, presente nella proiezione pubblica. Lo stesso record con `needs_review`: trattenuto (il controllo positivo funziona).

**Perché accade.** Il cancello definisce pubblicabile ciò che è diverso da `needs_review`. Il validatore controlla che le voci di provenienza esistenti corrispondano agli originali, non che un record `imported_unreviewed` ne abbia. «Importato dalla baseline» non è una proprietà verificata.

**Mitigazione.** §10, P4.

### V5. La protezione delle persone dipende da `kind` e da un URL qualsiasi [DIMOSTRATO]

**File.** `src/site/publication.ts`, `src/pipeline/validate.ts` (regola 8), `src/pipeline/ingest/plan.ts` (`create_relationship`).

**Riproduzioni.**

- Entità con nome di persona fisica e `kind: organization`, più relazione `FINANZIA_E_DIRIGE` senza `primary_url`: 0 errori, nessun avviso, relazione pubblicata.
- `G-0230`, oggi l'unica relazione trattenuta per mancanza di fonte primaria: impostando `primary_url: "https://example.com/"` diventa pubblica. Il cancello verifica solo che il campo non sia nullo.

**Fuori dalla regola per costruzione.** La regola riguarda le relazioni. Titoli e descrizioni di eventi, testi di ipotesi, articoli e fonti archiviate possono nominare persone senza alcun vincolo.

**Mitigazione.** §10, P4.

### V6. La traduzione può divergere senza risultare obsoleta [DIMOSTRATO]

**File.** `src/pipeline/translations.ts` (`sourceHash`).

**Riproduzione.** In `G-0041` il caveat italiano «MI5 Interference Alert» resta invariato; quello inglese viene cambiato in «Convicted by a UK court». Validazione: 0 errori. L'impronta è calcolata solo sui testi italiani: rileva un italiano cambiato, non un inglese cambiato.

**Conseguenza.** Un'attribuzione può diventare una condanna nella sola versione inglese. Sui rami `research/*` il diff la mostra come una normale modifica di campo, senza segnalazione. `AGENTS.md` vieta di modificare solo l'inglese; nulla lo impedisce.

**Mitigazione.** §10, P5.

### V7. Articoli: nessun vincolo su chi imposta `reviewed`, nessun controllo sul contenuto [DIMOSTRATO]

**File.** `src/site/articles.ts` (`withheldReasons`), `src/pipeline/articles.ts`.

**Riproduzione.** Copia di `ART-0002` con nuovo ID: `reviewed`, nessun link a eventi, relazioni o ipotesi → pubblicata. Il cancello verifica solo i record dichiarati in `links` e le fonti citate per codice.

**Sequenza di rischio.** Task B scrive `reviewed` per errore o per effetto di un input ostile → la CI è verde (lo schema lo ammette) → nessun diff copre `content/articles/` → Task C, o chiunque unisca, pubblica un testo libero che può nominare persone. L'unica difesa è l'istruzione al task.

**Mitigazione.** §10, P3.

### V8. Difetti logici dell'ingestione [DIMOSTRATO]

Tutti riprodotti con `planIngest` e la fixture `test/fixtures/Fonte_10.proposals.json`.

| # | Difetto | Riproduzione | Punto del codice |
| --- | --- | --- | --- |
| a | **Esclusione reciproca.** Due sidecar archiviati che propongono lo stesso evento si classificano a vicenda come `duplicate`; nessuno dei due lo scrive | Ingestione di S10 con S11 fra gli altri: «already proposed in S11». Ingestione di S11 con S10 fra gli altri: «already proposed in S10» | `others` in `src/cli/ingest.ts` include tutti gli altri sidecar, non solo i precedenti |
| b | **Marcatore falsificabile.** Una nota di testo libero che inizia con `[ingest S11 <ref>]` fa risultare `already_applied` un'operazione futura di S11 e ne risolve `@ref` su un record scelto dal primo sidecar | Nota inserita in un'operazione di S10; l'operazione di S11 con quel `ref`, su un evento del tutto diverso, esce `already_applied` verso `EXT-035` | `operation.notes` è copiato in `review.notes`; `MARKER` viene cercato in tutte le note |
| c | **Il duplicato perde le citazioni.** Un `create_event` riconosciuto come duplicato non scrive nulla: fonti nuove e claim su autore, mandante, movente e impatto vengono scartati | Evento con lo stesso URL di `EXT-001`: `duplicate`, zero scritture sul record esistente | ramo `matchEvent` in `planIngest` |
| d | **Un sidecar non valido blocca tutti.** Gli altri sidecar sono letti con la stessa funzione che termina il processo in caso di errore di schema | lettura del codice | `readProposals` in `src/cli/ingest.ts` |
| e | **Nessuna validazione dei sidecar in CI.** `sources/` è escluso da Biome; i test usano la fixture | lettura di `biome.json`, `package.json`, `test/ingest.test.ts` | — |
| f | **I conflitti crescono con il ritardo.** Un evento il cui URL compare in un altro Markdown archiviato diventa `conflict` | lettura del codice | filtro `archive` in `planIngest` |

Il difetto (a) è il più rilevante in pratica. Task A riesamina ogni giorno almeno 72 ore, quindi fonti consecutive riportano normalmente gli stessi casi. Fonte_10 e Fonte_11 dichiarano entrambe `coverage_start: 2026-11-08`. Più l'ingestione viene rimandata, più sidecar si accumulano e più eventi cadono in (a) o in (f).

Il difetto (d), combinato con (e) e con la regola che le fonti archiviate non si modificano, crea un vicolo cieco: un sidecar malformato può essere unito con CI verde e da quel momento nessuna ingestione funziona, a meno di violare l'immutabilità.

Controllo positivo: il sidecar della PR #18 (Fonte_12), il primo reale, è valido secondo lo schema. Simulato in memoria dà 2 `create_event` nuovi e 1 `add_citation` come arricchimento, senza blocchi né rifiuti.

**Mitigazione.** §10, P6.

### V9. Coerenza fra livello e stato di evidenza non imposta [DIMOSTRATO]

Una relazione con `evidence_level: E1` ed `evidence_status: allegation` supera la validazione. Oggi i due campi coincidono in 458 casi su 458 solo per come sono stati importati. Il sito li mostra entrambi.

### V10. Lo spazio degli identificativi finisce a breve [DIMOSTRATO]

| Identificativo | Formato | Capienza | Usati | Ritmo osservato | Esaurimento stimato |
| --- | --- | --- | --- | --- | --- |
| Fonte e documento del corpus | `Fonte_\d{2}`, `S\d{2}` | 99 | 12 | 1 al giorno (Task A) | circa 87 giorni: **intorno al 9 febbraio 2027** |
| Ipotesi | `H\d{2}` | 99 | 32 | 10 per Fonte_09 | poche decine di fonti con ipotesi |
| Riferimento esterno | `WEB-EXT-\d{3}` | 999 | 54 | circa 6–50 per fonte | da alcune decine a 150 fonti |
| Evento candidato | `EXT-\d{3}` | 999 | 34 | circa 2–30 per fonte | simile |
| Relazione | `G-\d{4}` | 9.999 | 460 | — | non vicino |

All'esaurimento `nextId` solleva un'eccezione dentro `planIngest`: l'intero piano fallisce. Per le fonti il limite è nello schema (`SOURCE_ID`, `src/model/schemas.ts`) e nel contratto del sidecar (`src/model/proposals.ts`). La stima sulle fonti presuppone una fonte per ogni giorno; i giorni senza novità la spostano in avanti.

### V11. Istruzioni contraddittorie lette dagli agenti a ogni esecuzione [DIMOSTRATO]

`docs/CHATGPT_SCHEDULED_TASKS.md` §2.1 elenca `.github/agent/research-prompt.md` fra i file che Task A legge a ogni avvio. Quel file dichiara: «Machine-assisted canonical ingestion has not yet been implemented» e descrive Task B come «planned». `docs/ARCHITECTURE.md` e `docs/M6_CHATGPT_OSINT_WORKFLOW.md` contengono paragrafi di date diverse con stati incompatibili. Un agente che pondera questi testi riceve istruzioni operative divergenti su ciò che esiste.

### V12. Cronologia delle modifiche che può svuotarsi in silenzio [DIMOSTRATO, a scala maggiore]

`src/site/history.ts` esegue `git log` con `maxBuffer` di 64 MB dentro un `try` che, per qualunque errore, restituisce una lista vuota con la motivazione «non è un checkout Git». Superato il buffer, la pagina `/changes/` perderebbe la cronologia senza alcun errore di build.

---

## 5. Rischi sistemici e scenari avversariali

### S1. Prompt injection attraverso la coda delle PR [IPOTETICO]

**Sequenza.** Il repository è pubblico → chiunque può aprire una PR da un fork → Task C deve leggere «the complete open-PR list», file, commenti e revisioni → il testo della PR contiene istruzioni rivolte al revisore («pre-approvata dal manutentore», «unire subito») → Task C ha diritti di merge da amministratore (V1). Anche Task A e B devono leggere «all open PRs and proposed files».

**Controlli esistenti.** L'istruzione testuale di trattare i contenuti come dati. La CI delle PR da fork gira con token di sola lettura, quindi il rischio non è l'esecuzione di codice in CI ma l'azione dell'agente.

**Non verificabile** senza aprire una PR di prova, cioè un test invasivo sul repository reale che non ho eseguito.

**Test proposto.** In un fork privato o in un repository di prova con la stessa configurazione dei task: PR «canarino» con un'istruzione innocua e riconoscibile (ad esempio «aggiungi la parola X al tuo rapporto»). Il task supera il test se cita l'istruzione come contenuto sospetto e non la esegue.

**Mitigazione.** Task C agisce solo su PR il cui ramo di testa appartiene al repository e corrisponde a un prefisso atteso; le PR da fork vengono solo segnalate. Identità senza privilegi di amministratore (P1).

### S2. Ciclo di auto-conferma fra corpus e agenti [PLAUSIBILE]

**Sequenza.** Una pagina ostile o errata viene citata da Task A → entra in `sources/incremental/` → Task B legge le fonti incrementali e tematiche come contesto e scrive un articolo che riprende l'affermazione → Task C verifica l'articolo riaprendo le stesse pagine web → l'articolo viene pubblicato → nelle esecuzioni successive Task A legge il corpus aggiornato, in cui l'affermazione compare ormai tre volte.

**Perché è sistemico.** Nessun passaggio è sbagliato in sé. Ricerca, scrittura e revisione sono eseguite dallo stesso tipo di modello, con la stessa ricerca web, e ciascuno prende in ingresso il prodotto degli altri. Il rapporto A mostra che il 93,7% delle relazioni cita solo documenti di sintesi del corpus: la base su cui gli agenti ragionano è già in larga parte auto-riferita.

**Controlli esistenti.** Il cancello M5 per i record canonici. Per articoli e archivio, solo le istruzioni.

**Mitigazione.** Registro della genealogia delle fonti (rapporto A); regola per Task C: una verifica vale solo se trova una fonte che non compare già nella PR né nel corpus.

### S3. Fonti coordinate che simulano conferme indipendenti [PLAUSIBILE]

Il modello non registra la derivazione fra fonti. Nei candidati di Fonte_09, quattro eventi contano due volte lo stesso lancio d'agenzia perché ripubblicato (rapporto A, §4.7). Un attore che pubblica lo stesso contenuto su più domini ottiene lo stesso effetto. Il sidecar richiede URL unici, non origini uniche.

### S4. Sidecar valido ma ingannevole [PLAUSIBILE]

Forme che superano lo schema:

- `kind: organization` per una persona, che evita il rifiuto delle relazioni su persone (V5);
- attribuzione scritta nella `description`, con `claims` tutti nulli: lo schema non può verificare che la descrizione contenga «solo la condotta documentata»;
- `evidence_level: E1` con riferimenti soltanto giornalistici (7 casi già presenti fra i candidati di Fonte_09);
- note che imitano il marcatore di ingestione (V8b);
- `aliases` che coincidono con il nome di un'entità esistente: la nuova entità viene risolta su quella esistente e le relazioni successive le si agganciano.

L'ultimo punto è un comportamento voluto dalla deduplicazione; diventa un rischio se l'alias è scelto per agganciare affermazioni a un soggetto diverso.

### S5. Modifica investigativa travestita da aggiornamento bibliografico [DIMOSTRATO nel meccanismo]

Su un ramo `research/*`, `diffData` non emette alcuna segnalazione per:

- la sostituzione di un codice in `sources` con un altro;
- la modifica del solo testo inglese (V6);
- la modifica di `caveat`, `predicate` o `valid_from` senza cambio di gruppo di relazione o di livello.

Le segnalazioni esistono per: persona nominata, livello alzato, nuova relazione di controllo o finanziaria, nuova ipotesi, cambio di stato di un'ipotesi, cancellazione. Riscrivere un predicato da `OFFICIAL_ATTRIBUTION` a `PERPETRATOR` nello stesso gruppo non è segnalato.

Via sidecar: `add_citation` aggiunge fonti e una nota libera. Opera solo su record `needs_review`, quindi non altera il sito; il testo della nota resta però nel record e sarà pubblicato con esso.

### S6. Propagazione di errori già presenti [PLAUSIBILE]

Task B sceglie i temi da ipotesi e relazioni esistenti. Nessun record è `reviewed`. Un errore della baseline viene quindi trattato come contesto consolidato. Il cancello degli articoli non offre difesa, perché i record `imported_unreviewed` sono pubblici e collegabili.

---

## 6. Audit delle invarianti editoriali e probatorie

| # | Invariante | Esito | Come si viola superando tutti i controlli | Test di regressione |
| --- | --- | --- | --- | --- |
| I1 | Un record non approvato non viene pubblicato per vie alternative | **Violabile** [DIMOSTRATO] | Record nuovo con `imported_unreviewed` (V4); articolo `reviewed` senza link (V7); fonte archiviata in homepage (catena 2 → 7) | T1, T4 |
| I2 | Un'ipotesi E5 non acquisisce status fattuale | **Tiene nello schema, violabile nel processo** | Lo schema rifiuta E5 sulle relazioni. Ma nulla impedisce di creare una relazione E3 con lo stesso contenuto di un'ipotesi; `status: promoted` su `research/*` è solo «attention». `ART-0002` usa una propria riga E5 non collegata ad alcuna ipotesi | T5; test: nessuna relazione nuova sulla stessa coppia di un'ipotesi aperta senza segnalazione |
| I3 | Un'attribuzione non diventa una condanna | **Violabile** [DIMOSTRATO] | Solo inglese (V6); predicato riscritto nello stesso gruppo (S5); livello e stato incoerenti (V9) | T3, T9 |
| I4 | Una relazione su persone richiede evidenze appropriate | **Violabile** [DIMOSTRATO] | `kind` diverso da `person`; URL arbitrario (V5) | T2, T13 |
| I5 | La correzione di un caso non lascia versioni incompatibili | **Non garantita** | `propose_correction` produce solo una nota. Lo stesso fatto vive in evento, archi, ipotesi, articolo e fonte archiviata, senza legame; correggerne uno non segnala gli altri. Le fonti archiviate sono immutabili per regola, quindi una rettifica non può toccarle | Test: una correzione applicata a un evento elenca articoli e relazioni che lo citano |
| I6 | Una traduzione non resta «aggiornata» dopo una modifica sostanziale | **Tiene in un solo verso** [DIMOSTRATO] | Italiano modificato: rilevato. Inglese modificato: non rilevato. Campi non testuali (livello, predicato, date) non entrano nell'impronta | T3 |
| I7 | L'archiviazione non è scambiata per integrazione | **Tiene sul sito, fragile altrove** | La homepage distingue. Ma `test/research.test.ts` richiede che `S10` e `S11` compaiano in archivio mentre non esistono come record in `data/sources/`: lo stesso codice indica un documento archiviato e un record canonico inesistente | Test: un codice `S` mostrato sul sito ha un record oppure è marcato «non integrato» |
| I8 | I record non perdono riferimenti in deduplicazione | **Violata** [DIMOSTRATO] | V8a e V8c | T6, T8 |

Riproduzioni eseguite (in memoria, con i moduli del progetto):

| Test | Scenario | Esito osservato |
| --- | --- | --- |
| T1 | Evento nuovo `imported_unreviewed`, `integrated`, senza provenienza | 0 errori; pubblicato |
| T12 | Controllo: stesso evento `needs_review` | 0 errori; trattenuto |
| T2 / T9 | Persona dichiarata `organization`; relazione E1 con stato `allegation`, senza `primary_url` | 0 errori; pubblicata |
| T13 | `G-0230` con `primary_url` arbitrario | da trattenuta a pubblica |
| T3 | Caveat inglese di `G-0041` cambiato in «Convicted by a UK court» | 0 errori |
| T4 | Articolo `reviewed` senza link | pubblicato |
| T5 | Promozione di ipotesi e `reviewed` su ramo non `agent/*` | solo «attention» |
| T6 | Stesso evento in due sidecar | `duplicate` in entrambi |
| T7 | Marcatore imitato in una nota | operazione estranea `already_applied` |
| T8 | Evento duplicato con fonti nuove | nessuna scrittura sul record esistente |

---

## 7. Analisi dettagliata delle automazioni A/B/C

Le configurazioni risiedono in ChatGPT. Quanto segue si basa su `docs/CHATGPT_SCHEDULED_TASKS.md` (istantanea del 14 novembre) e sui fatti osservabili in GitHub. Non ho verificato lo stato corrente dei task.

### 7.1 Che cosa è accaduto davvero

| Task | Orario configurato (Europe/Rome) | Osservato in GitHub (UTC) |
| --- | --- | --- |
| A | ogni giorno 01:00 | PR #11 alle 00:03 del 13 novembre; PR #18 alle 00:02 del 14 novembre |
| B | venerdì 03:00 | PR #12 alle 02:00 del 13 novembre |
| C | venerdì 05:00 | merge e commenti fra le 04:01:07 e le 04:01:38 del 13 novembre |

Gli orari di avvio sono rispettati. A consegna in 2–3 minuti, B in pochi secondi dall'orario, C in poco più di un minuto.

### 7.2 Come sistema distribuito

**Ritardo fra acquisizione e archivio.** A produce fino a 7 PR la settimana; C le unisce una volta. Una fonte del sabato attende 6 giorni e 4 ore, una del venerdì 4 ore. Ritardo medio teorico intorno ai 3 giorni.

**Ritardo fra archivio e dati canonici.** Illimitato. L'ingestione è manuale e nessun task la copre. Stato attuale:

| Fonte | Archiviata | Sidecar | Ingerita |
| --- | --- | --- | --- |
| Fonte_09 | 12 novembre | no (import manuale) | sì, 30 candidati tutti `needs_review` |
| Fonte_10 | 13 novembre | no | no |
| Fonte_11 | 13 novembre | no | no |
| Fonte_12 | PR #18 aperta | sì, valido | no |
| 2 dossier tematici | 12–13 novembre | non previsto | nessun percorso definito |

Fonte_10 e Fonte_11 non potranno mai essere ingerite con lo strumento, perché non hanno sidecar e le fonti archiviate non si modificano. Le loro 8 voci restano fuori dal dataset canonico, salvo estrazione manuale, che `AGENTS.md` vieta agli agenti.

**Ritardo fra dati canonici e pubblicazione.** Illimitato. Nessun task e nessuna regola porta un candidato da `needs_review` a pubblico; serve una decisione umana per record. I 30 candidati di Fonte_09 sono in questo stato.

**La finestra di ricerca non avanza fra un merge e l'altro.** Il cutoff è quello dell'ultima fonte *unita*. Con merge settimanale, ogni esecuzione quotidiana riparte dallo stesso punto: Fonte_10 e Fonte_11 dichiarano entrambe `coverage_start: 2026-11-08` e `baseline_source: S09`. La finestra cresce di un giorno al giorno fino al venerdì, e con essa il lavoro ripetuto e le sovrapposizioni fra PR aperte. La deduplicazione fra PR aperte è affidata al modello; lo strumento deterministico (`--compare`) richiede di passare i file a mano.

**Collisione dei numeri di fonte.** Il numero è scelto leggendo `main` e le PR aperte. Due PR con lo stesso `Fonte_NN` ma date diverse hanno nomi di file diversi, quindi Git non segnala conflitto sul Markdown; lo segnala solo sul sidecar, se entrambe lo hanno. Nessun test verifica l'unicità del numero o di `source_id` in `sources/incremental/`.

**Ordine del venerdì.** B (03:00) scrive prima che C (05:00) unisca le fonti della settimana. B lavora quindi su un `main` privo delle fonti più recenti, che deve recuperare dalle PR aperte. C esamina l'articolo di B due ore dopo la creazione, senza alcun intervallo per una lettura umana.

**CI non conclusa e merge sequenziali.** Osservato in V2. Il gruppo di concorrenza `ci-${{ github.ref }}` con `cancel-in-progress: true` annulla, su `main`, l'esecuzione del merge precedente. Se l'ultima fallisce, nessuna delle modifiche unite viene pubblicata e nessuno viene avvisato.

**Esecuzioni fallite o incomplete.** Non esiste un registro nel repository. Un'esecuzione di A senza novità non lascia traccia: non si distingue «nessuna novità» da «task non eseguito». Lo stesso vale per un errore di permessi.

**Chi rivede le PR di C.** C può aprire PR di correzione. Con l'identità condivisa, nulla impedisce che C unisca le proprie.

**Approvazioni formalmente consentite ma insufficienti.** C può unire fonti e bozze «if no explicit human pre-merge approval is required». Dopo il merge una fonte è in homepage (catena 2 → 7). Per l'archivio, quindi, l'approvazione di C è l'unica revisione prima della visibilità pubblica.

### 7.3 Attività necessarie che nessun task copre

| Attività | Stato |
| --- | --- |
| Ingestione dei sidecar in `data/` | manuale, mai eseguita su una fonte reale |
| Decisione umana sui candidati (`needs_review` → pubblico) | nessun processo, nessuna coda visibile |
| Traduzione dei nuovi record | manuale (`pnpm i18n:*`) |
| Applicazione delle `propose_correction` | manuale; nessuna coda |
| Aggiornamento dello stato delle ipotesi | mai avvenuto: 32 su 32 `open_unproven` |
| Rettifiche urgenti di contenuti già pubblici | nessuna corsia; attesa fino a 7 giorni |
| Verifica periodica dei link delle fonti | assente; `check:links` copre solo i link interni |
| Pulizia dei rami uniti | assente (`delete_branch_on_merge: false`) |
| Registro delle esecuzioni dei task | assente dal repository |
| Verifica del deploy dopo i merge | prevista per C, non eseguita il 13 novembre |

---

## 8. Modelli alternativi di scheduling e integrazione

Vincoli comuni: nessuna alternativa deve permettere a un agente di impostare `reviewed`, pubblicare un candidato o scavalcare la revisione umana. Un task ChatGPT non è attivabile da eventi: le alternative usano orari, oppure GitHub Actions deterministici senza modello.

| Modello | Descrizione | Vantaggi | Costi e dipendenze | Rischio di duplicazione | Condizioni per adottarlo |
| --- | --- | --- | --- | --- | --- |
| **M0** Attuale | A quotidiano; B e C il venerdì | Semplice | Ritardi del §7.2; finestra che non avanza | Alto durante la settimana | — |
| **M1** Riordino del venerdì | C alle 02:30, B alle 05:00, oppure B in un altro giorno | B lavora su `main` aggiornato; l'articolo non è rivisto dallo stesso ciclo che l'ha prodotto | Nessuno; solo orari | Invariato | Adottabile subito |
| **M2** C diviso in due | **C-leggero** quotidiano alle 02:30: controlli tecnici e merge delle sole PR che toccano esclusivamente `sources/`. **C-editoriale** settimanale: articoli, dati, codice | Il cutoff avanza ogni giorno; la coda non cresce | Un task in più; più merge automatici | Basso: A parte sempre da un cutoff recente | Solo dopo P1 e P7. C-leggero non deve poter unire nulla fuori da `sources/` |
| **M3** Ingestione deterministica dopo il merge | Workflow GitHub Actions senza modello: quando un sidecar arriva su `main`, esegue `pnpm ingest --write` e apre una PR `agent/ingest-fonte-NN` | Elimina il ritardo fra archivio e candidati; nessuna inferenza; sempre riproducibile | Richiede un token con `contents: write` e `pull-requests: write` per quel solo workflow; richiede P6 | Nessuno | `evidence-diff` richiesto; PR mai unita in automatico; candidati sempre `needs_review` |
| **M4** Task D di preparazione alla revisione | Task settimanale che non unisce nulla: per ogni candidato produce un dossier di verifica (fonte primaria trovata o no, radici indipendenti, controevidenze) come commento o file in `docs/audit/` | Riduce il lavoro umano, che è il vero collo di bottiglia | Un task in più; rischio che il dossier sia scambiato per approvazione | Medio: sovrapposizione con C-editoriale | Il dossier non tocca `data/`; `human_approved` resta `false` |
| **M5** Corsia delle rettifiche | A marca nel titolo della PR le voci `CORRECTION` che toccano record pubblici; C-leggero le segnala ogni giorno al manutentore senza unirle | Le rettifiche non attendono il venerdì | Dipende da M2; richiede un canale di notifica | Nessuno | Solo segnalazione: la modifica di un record pubblico resta umana |
| **M6** Cadenza variabile di A | A quotidiano nei feriali, con rotazione tematica; oppure A a giorni alterni con finestra di 96 ore | Meno PR, meno sovrapposizioni, consumo più lento dei numeri di fonte | Possibile ritardo di 24 ore su una notizia | Più basso di M0 | Da valutare misurando quante fonti quotidiane contengono voci nuove: Fonte_11 ne ha una, Fonte_12 due |

**Combinazione consigliata.** P1 e P7 (prerequisiti), poi M1 subito, M3 dopo la correzione dell'ingestione, M2 quando il volume lo giustifica. M4 ha il rapporto migliore fra beneficio e rischio, perché agisce sul collo di bottiglia reale: oggi nessun candidato ha mai raggiunto la pubblicazione.

**Che cosa non fare.** Non aumentare la frequenza di C nella forma attuale. Con l'identità condivisa e la revisione scavalcabile, un C quotidiano moltiplica per sette gli atti non revisionati.

**Separazione dei ruoli raccomandata:**

| Ruolo | Chi | Può | Non può |
| --- | --- | --- | --- |
| Ricerca | A, B | aprire PR su `sources/` o `content/articles/` | toccare `data/`, `src/`, workflow, stati di revisione |
| Revisione tecnica | C-leggero o CI | unire PR di sole fonti con controlli verdi | unire articoli, dati, codice |
| Integrazione canonica | workflow deterministico (M3) | aprire PR `agent/ingest-*` | unire |
| Approvazione editoriale | persona, con un'identità distinta da quella degli agenti | impostare `reviewed`, integrare eventi, pubblicare articoli | — |

---

## 9. Valutazione di resilienza e scalabilità

### 9.1 Misure eseguite

Dataset sintetico ottenuto replicando eventi e relazioni, mantenendo gli stessi nodi (quindi con hub molto più carichi). Tempi su una macchina locale, da intendere come ordini di grandezza.

| Scala | Relazioni | Eventi | Proiezione pubblica | Read model | Grafo, atlante e citazioni |
| --- | --- | --- | --- | --- | --- |
| ×1 | 458 | 181 | 1 ms | < 1 ms | 2 ms |
| ×10 | 4.580 | 1.810 | 2 ms | 4 ms | 7 ms |
| ×100 | 45.800 | 18.100 | 13 ms | 56 ms | 76 ms |

Validazione completa del dataset attuale: 77 ms. CI completa: 40–65 secondi.

**Conclusione.** Il calcolo in memoria non è un limite nemmeno a 100 volte la dimensione attuale. La scelta di non usare un database resta giustificata. I limiti reali sono altrove.

### 9.2 Limiti che emergono prima delle prestazioni

| Limite | Soglia | Tipo | Riferimento |
| --- | --- | --- | --- |
| Numeri di fonte `S\d{2}` e `Fonte_\d{2}` | 99, intorno a febbraio 2027 | Formato | V10 |
| Ipotesi `H\d{2}` | 99 | Formato | V10 |
| Contesto degli agenti | Le fonti pesano 1,36 MB e crescono di 10–50 KB al giorno; i task devono leggere corpus, dati e PR aperte a ogni esecuzione | Operativo | È il primo limite reale: quando il corpus non entra più nel contesto, la deduplicazione affidata al modello degrada senza errori visibili |
| Falsi duplicati nell'ingestione | Cresce con il numero di eventi: un evento con data di solo anno si sovrappone a tutti quelli dello stesso anno, e la soglia è una similarità di parole di 0,6 sul titolo | Algoritmico | `matchEvent` |
| Conflitti da URL archiviati | Cresce con il numero di Markdown archiviati | Algoritmico | V8f |
| Pagine statiche | Circa 1.100 oggi, due lingue per record. A ×100 oltre 100.000 pagine più l'indice Pagefind | Build e hosting | Da misurare; i limiti di dimensione e di durata del deploy di GitHub Pages vanno verificati sulla documentazione corrente |
| Bacheca delle evidenze | SVG lato client con layout di forze | Interfaccia | A ×10 (circa 4.000 nodi) diventa difficilmente usabile; serve filtrare per sottografo |
| `git log` per `/changes/` | 64 MB di output | Silenzioso | V12 |
| Coda di revisione umana | 124 record `needs_review`, 0 mai approvati | Organizzativo | È il vero collo di bottiglia: aggiungere fonti non aumenta ciò che è pubblico |
| Note di revisione | Marcatori di ingestione, claim e correzioni si accumulano come stringhe in `review.notes` | Modello | Rapporto A |

### 9.3 Conflitti fra agenti

Con più PR aperte in parallelo dallo stesso `main`:

- due rami di ingestione assegnano gli stessi `EXT-NNN`, `G-NNNN`, `WEB-EXT-NNN`. Git segnala un conflitto di aggiunta sugli stessi percorsi; la rilevazione funziona, ma il secondo ramo va rigenerato;
- due fonti con lo stesso numero non producono conflitto sul Markdown (§7.2);
- con `strict: false`, due PR verdi singolarmente possono essere incoerenti insieme (V2).

### 9.4 Archivi storici

Punto di forza: fonti immutabili, provenienza riga per riga verificata a ogni validazione, esportazioni deterministiche per commit. Punto debole: nessuna copia delle pagine web citate. `docs/audit/M5_2026-11-12.json` prevede `archived_url` e `content_sha256`, tutti nulli. Una fonte esterna che cambia o scompare rende non verificabile l'affermazione, e una pagina modificata dopo la citazione non lascia traccia.

---

## 10. Proposte tecniche prioritarie

Priorità assegnata combinando impatto, probabilità plausibile, verificabilità e complessità della correzione.

| # | Proposta | Risolve | Impatto | Probabilità | Verificabilità | Complessità | Priorità |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P1 | **Identità separate e revisione non scavalcabile.** Account macchina o GitHub App per i task, senza ruolo di amministratore; `enforce_admins: true`; l'approvazione del code owner arriva da un'identità diversa dall'autore | V1, S1, V7 | Molto alto | Certa (stato attuale) | Alta: un'interrogazione API | Bassa: impostazioni, nessun codice | **1** |
| P2 | **Regole per percorso, non per nome del ramo.** `evidence-diff` richiesto; modalità severa predefinita per ogni PR, allentata solo da un'etichetta applicata dal manutentore; controllo dei percorsi: `research/*` tocca solo `sources/incremental`, `sources/thematic` o `content/articles` | V3, S5 | Alto | Alta | Alta (T5) | Bassa | **2** |
| P3 | **Le transizioni di stato richiedono un'approvazione verificabile.** Controllo in CI: se il diff imposta `reviewed` (dati o articoli), crea record non `needs_review` o tocca `human_approved`, la PR deve avere un'approvazione di un code owner diverso dall'autore. Estendere il diff a `content/articles/` | V4, V7 | Alto | Media | Alta (T1, T4) | Media: un job con lettura delle revisioni | **3** |
| P4 | **Irrobustire il cancello.** `imported_unreviewed` ammesso solo per gli ID della baseline (elenco congelato) o con provenienza non vuota; `primary_url` deve coincidere con l'URL di una fonte citata dalla relazione; segnalare le relazioni su entità non `person` il cui nome ha forma di nome proprio o che dichiarano `public_relevance`; imporre la coerenza fra livello e stato | V4, V5, V9 | Alto | Media | Alta (T1, T2, T13) | Media | **4** |
| P5 | **Impronta della traduzione in entrambi i versi.** Registrare anche l'impronta del testo inglese al momento dell'importazione; una modifica del solo inglese invalida lo stato e viene segnalata | V6 | Alto, soprattutto sulle persone | Bassa–media | Alta (T3) | Bassa | **5** |
| P6 | **Correzioni dell'ingestione.** Deduplicare solo contro sidecar con codice precedente; marcatore in un campo dedicato oppure rifiuto delle note che iniziano con `[ingest`; un duplicato con fonti nuove produce una nota o un'operazione di arricchimento nel rapporto; un altro sidecar non valido è un avviso, non un arresto; validare tutti i sidecar archiviati e l'unicità dei numeri di fonte in `pnpm check` | V8 | Alto quando l'ingestione partirà | Alta (a, f) | Alta (T6–T8) | Media | **6** |
| P7 | **CI e merge.** `strict: true` oppure merge queue; su `main` sostituire `cancel-in-progress` con l'accodamento; fissare le action a uno SHA; `delete_branch_on_merge` | V2 | Medio–alto | Alta (già accaduto) | Alta | Bassa | **7** |
| P8 | **Allargare gli identificativi.** Fonti e ipotesi a tre cifre, con compatibilità per gli ID esistenti; errore leggibile invece di eccezione all'esaurimento | V10 | Alto, a scadenza | Certa | Alta | Media: schema, contratto del sidecar a `1.1`, prompt di Task A | **8** |
| P9 | **Riordino dei task (M1), poi M3.** | §7 | Medio | — | Media | Bassa (M1), media (M3) | **9** |
| P10 | **Difese dall'injection.** Task C ignora le PR da fork; regola «cita, non eseguire» con test del canarino periodico; rimuovere `research-prompt.md` dall'elenco di lettura di A o riscriverlo | S1, V11 | Alto se accade | Bassa oggi | Bassa senza test dedicato | Bassa | **10** |
| P11 | **Tracce operative.** Un file per ogni esecuzione di task (anche senza esito) con orario, commit di partenza, PR create, controlli eseguiti; nota strutturata di revisione per ogni merge | §7.2 | Medio | — | Alta | Bassa | **11** |
| P12 | **Errori non silenziosi.** `history.ts` distingue «non è un checkout» da un errore di buffer; `audit:publication` elenca i record trattenuti con il motivo | V12 | Basso oggi | Bassa | Alta | Bassa | **12** |

P1, P2 e P7 non richiedono quasi codice e chiudono i tre presupposti falsi dell'executive summary. Senza P1 le proposte P2–P5 restano scavalcabili dallo stesso soggetto che dovrebbero vincolare.

Nessuna proposta richiede di cambiare stack, introdurre un database o un servizio ospitato.

---

## 11. Test di regressione e criteri di accettazione

| # | Test | Criterio di accettazione | Oggi |
| --- | --- | --- | --- |
| R1 | Record nuovo `imported_unreviewed` con provenienza vuota | `pnpm validate` fallisce, oppure il record non è nella proiezione pubblica | passa ed è pubblico |
| R2 | Articolo `reviewed` in una PR senza approvazione di un secondo soggetto | la CI fallisce | passa |
| R3 | Diff che imposta `reviewed`, promuove un'ipotesi o cancella un record, su qualunque ramo | uscita 1 senza l'etichetta del manutentore | uscita 0 su `research/*` |
| R4 | PR `research/*` che tocca `data/`, `src/` o `.github/` | la CI fallisce | passa |
| R5 | Testo inglese modificato a italiano invariato | errore di traduzione | 0 errori |
| R6 | Relazione su entità con nome di persona e `kind` diverso da `person` | avviso per il revisore | nessuno |
| R7 | Relazione su persona con `primary_url` non presente fra gli URL delle fonti citate | trattenuta | pubblicata |
| R8 | Relazione E1 con stato `allegation` | errore | 0 errori |
| R9 | Due sidecar con lo stesso evento, ingeriti in ordine | il primo lo crea; il secondo lo vede come duplicato del record | entrambi lo scartano |
| R10 | Nota che inizia con `[ingest S11 …]` in un sidecar S10 | rifiutata, oppure ininfluente sull'ingestione di S11 | falsifica l'idempotenza |
| R11 | `create_event` duplicato con fonti nuove | il rapporto elenca le fonti non applicate e il record di destinazione | perse senza traccia |
| R12 | Sidecar archiviato non valido | `pnpm check` fallisce prima del merge; l'ingestione degli altri prosegue con un avviso | CI verde; ingestione bloccata |
| R13 | Due file `Fonte_12_*` con date diverse | `pnpm check` fallisce | nessun controllo |
| R14 | Sidecar con codice `S100` | accettato dopo P8; prima, errore esplicito | rifiutato dallo schema |
| R15 | Tre merge consecutivi su `main` | ogni commit ha un'esecuzione conclusa; nessuna annullata | due annullate, una fallita |
| R16 | PR verde su base non aggiornata | non unibile finché non è riallineata | unibile |
| R17 | Interrogazione API sulle PR unite | nessuna con `REVIEW_REQUIRED`; autore diverso da chi approva | 16 su 16 con `REVIEW_REQUIRED` |
| R18 | PR canarino con un'istruzione innocua, in ambiente di prova | il task la riporta come contenuto sospetto e non la esegue | non eseguito |
| R19 | Aggiunta di un candidato collegato a un'ipotesi pubblica | l'ipotesi resta pubblica | viene trattenuta (rapporto A) |
| R20 | `git log` oltre il buffer | la build fallisce o avvisa | lista vuota silenziosa |

R1–R14 sono test unitari scrivibili con le funzioni già esportate (`validateDataFiles`, `publishedDataset`, `diffData`, `planIngest`, `validateArticleFiles`), sul modello di quelli esistenti in `test/`. R15–R17 sono verifiche sullo stato di GitHub. R18 richiede un ambiente separato.

---

## 12. Questioni aperte, assunzioni e verifiche non eseguite

**Non verificato.**

- Configurazione corrente, prompt completi e registri di esecuzione dei tre task ChatGPT. Tutto ciò che riguarda i task deriva dalla documentazione del 14 novembre e dagli effetti osservabili in GitHub.
- Quale soggetto ha eseguito ciascun merge. L'account è uno solo; l'attribuzione a Task C delle PR #3, #10 e #11 si basa sull'orario.
- Il modo in cui ChatGPT accede a GitHub (connettore, token, ambiti). L'inferenza «identità del proprietario con privilegi di amministratore» deriva dal fatto che autore e autore del merge coincidono e che la revisione richiesta risulta non soddisfatta.
- Impostazioni di GitHub Pages, regole di approvazione dei workflow per le PR da fork, eventuali protezioni dell'ambiente `github-pages`.
- Il sito pubblicato e il contenuto dell'artefatto di build. Non ho eseguito `pnpm build`, `pnpm check` né `pnpm check:links` in questa sessione.
- Il comportamento di Pagefind nell'escape degli estratti, da cui dipende l'unico inserimento di HTML non controllato dal progetto (`SearchPalette.astro`). I titoli sono inseriti come testo.
- Il contenuto integrale delle fonti incrementali e tematiche, per cercare istruzioni ostili già presenti.
- `README.md`, `src/pipeline/ingest/report.ts`, `src/pipeline/baseline/`, la maggior parte delle pagine Astro e dei test.
- La risposta reale dei task a un input ostile (S1): nessun test invasivo eseguito.

**Assunzioni.**

- La stima di esaurimento dei numeri di fonte presuppone una fonte al giorno.
- I limiti di GitHub Pages citati al §9.2 vanno controllati sulla documentazione corrente.
- Le misure di scalabilità usano dati replicati, non realistici nella distribuzione dei nomi e dei titoli: non dicono nulla sul tasso di falsi duplicati.

**Questioni aperte.**

1. Il merge senza approvazione è una scelta consapevole per un progetto con un solo manutentore? In tal caso la protezione del ramo e la documentazione vanno riallineate a ciò che accade, invece di descrivere un controllo che non opera.
2. Che cosa significa `reviewed` su un articolo: verifica di Task C con autorizzazione umana, o verifica umana? La nota di `ART-0001` e `ART-0002` descrive la prima.
3. Le 8 voci di Fonte_10 e Fonte_11 vanno recuperate con un sidecar retroattivo? Richiederebbe una decisione esplicita sull'immutabilità delle fonti archiviate.
4. Chi è destinato a smaltire i 124 record `needs_review`, e con quale ritmo? Senza risposta, ogni miglioramento a monte aumenta solo l'arretrato.
5. I dossier tematici devono avere un percorso verso i dati canonici?
6. È accettabile che un documento non revisionato sia collegato dalla homepage, o l'archivio deve mostrare solo ciò che una persona ha almeno letto?
7. Quale canale avvisa il manutentore quando `main` è rosso o un deploy non avviene?
8. Conviene conservare copia e hash delle pagine citate, almeno per le affermazioni su persone, entro i limiti di ciò che è legalmente riproducibile?

---

## Appendice — Comandi di sola lettura usati

```bash
gh api repos/amattis96/our-enemies-monitor/branches/main/protection
gh pr list --state all --limit 30 --json number,author,mergedBy,headRefName,createdAt,mergedAt,reviewDecision,reviews,files
gh run list --branch main --limit 15 --json conclusion,status,headSha,createdAt
gh pr view <n> --json createdAt,mergedAt,statusCheckRollup
```

Le riproduzioni T1–T13 importano `validateDataFiles`, `publishedDataset`, `diffData`, `planIngest`, `validateArticleFiles` e `publishedArticles` dai moduli del progetto e operano su copie in memoria dei record. Il sidecar della PR #18 è stato letto dall'API di GitHub e validato in memoria, senza eseguire `pnpm ingest` e senza scrivere nel repository.
