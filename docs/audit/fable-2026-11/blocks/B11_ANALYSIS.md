# B11 — Spazio degli ID ed errori silenziosi: analisi

Data: 15 novembre 2026 (Europe/Rome). Ramo `audit/fable-2026-11-implementation`; HEAD iniziale `ca6a83c2eb8af82ba4853be4c47156ed66a0750d` (B10). Albero pulito all'ingresso; nessun WIP o file di analisi B11 precedente. Checkout locale, nessun fetch/pull o accesso alle API del repository. Analisi Sol: nessuna modifica a codice, dati, fonti, schemi o documentazione operativa. Il registro di avanzamento viene aggiornato alla consegna dello step.

Fonti rilette: scheda B11, §2/§2.1/§2.2/§5 del programma; FABLE B V10/V12, P8/P12, R14/R20 e §9.1; analisi B02/B04 come formato e decisioni B04 su compatibilità, ordine e idempotenza. B10 ha appena preparato i prompt: ogni aggiornamento di contratto deve modificarli insieme a M6, senza dichiararli applicati in ChatGPT.

## 1. Stato verificato

### 1.1 Gli ID a due cifre sono ancora un limite reale (V10, R14)

| Punto | Stato osservato | Impatto |
| --- | --- | --- |
| `src/model/schemas.ts` | HypothesisId = H + due cifre; SourceId ammette S/F/P a due cifre, WEB e WEB-EXT a tre | H100 e S100 rifiutati anche dai campi che li referenziano; articoli e schemi generati riusano questi validatori |
| `src/model/proposals.ts` | Un solo schema_version 1.0; source.code richiede S a due cifre; source.file ammette due cifre seguite da caratteri liberi; confronto estrae solo le prime due | S100 rifiutato; il file Fonte_100 può essere scambiato per Fonte_10 dal parser isolato |
| `src/pipeline/ingest/archive.ts` | Parser JSON unico su ProposalFile; controllo d'archivio rifiuta ogni numero con lunghezza diversa da due; ordinamento già numerico | Non basta allargare il modello: il controllo archivio fermerebbe ancora Fonte_100. L'ordinamento numerico di B04 va mantenuto |
| `src/cli/ingest.ts` | Validazione di --skip-pending su S a due cifre | Il formato deve riconoscere il nuovo namespace senza autorizzarne l'uso agli agenti |
| `src/pipeline/ingest/plan.ts` | MARKER legge S a due cifre; nextId prende una sola larghezza massima; ipotesi allocate con larghezza 2 | Un marcatore S100 non sarebbe riconosciuto al rerun; H99 esaurisce il namespace |
| `src/cli/schemas.ts` | Genera proposals.schema.json da ProposalFile e gli schemi canonici/articoli dai modelli | Runtime e contratto scaricabile devono essere allineati; niente JSON Schema modificati a mano |

I moduli di lettura del sito risolvono per ID intero, i path statici e i link non troncano S/H a due cifre. `src/site/research.ts` estrae già tutte le cifre da Fonte_NN. Gli importatori baseline contengono regex F/P/S a due cifre per leggere il corpus storico: non sono parser dei nuovi sidecar e non vanno allargati senza motivo. Fonte_00–08, data/, articoli e ID esistenti non richiedono migrazione.

Massimi del dataset canonico: H32 e S09. Il checkout archivia S09–S11; Fonte_12 è soltanto un'osservazione dello snapshot B10, non una fonte archiviata sul ramo. Non viene ripetuta come previsione attuale la data di esaurimento stimata dal rapporto: dipende dalla frequenza di nuove fonti e dalle acquisizioni effettive.

### 1.2 Allargare la larghezza fissa rinumererebbe i nuovi ID bassi

Cambiare semplicemente la chiamata nextId(..., H, 2) in larghezza 3 produrrebbe H033 dopo H32. La compatibilità richiesta è invece **H33, …, H99, H100**, senza H033 e senza alias S099/Fonte_099 per S99/Fonte_99. Raccomandazione: mantenere due cifre minime, ammettere tre cifre soltanto da 100 a 999; gli ID di due cifre già accettati, inclusi gli eventuali 00, restano accettati. Nessun ID reale viene rinominato o riutilizzato.

Il nome della fonte deve essere coerente per intero: S100 ↔ Fonte_100_<titolo>.md ↔ Fonte_100.proposals.json. Il separatore dopo il numero è obbligatorio; S10 + Fonte_100 non deve superare neppure il parser legacy. È una correzione di un falso positivo, non una riscrittura delle fonti archiviate.

### 1.3 Compatibilità 1.0: non sostituire semplicemente il literal con 1.1

La fixture storica `test/fixtures/Fonte_10.proposals.json` è 1.0; non è una fonte reale da recuperare. `parseSidecar`, lettura archivio, input e --compare devono continuare a leggere 1.0. Vari test usano 1.1 come versione sconosciuta: dopo il cambiamento quei casi vanno spostati a una versione davvero non supportata, conservando gli stessi assert di rifiuto/avviso/uscita.

Raccomandazione: **nuove proposte 1.1**, lettura esplicita di 1.0 e 1.1, rifiuto delle altre senza tentare il parser più permissivo. Conservare i vincoli 1.0 sui campi tipizzati fonte/ipotesi, non riutilizzare automaticamente i validatori canonici allargati nel ramo legacy. Il ramo 1.1 accetta gli ID estesi anche in citazioni, baseline_source, riferimenti a ipotesi, target di add_citation/propose_correction e link pertinenti. Regole E5, persone, @ref, citazioni e campi obbligatori restano identiche.

Il contratto pubblico proposals.schema.json può rappresentare entrambe le versioni con alternative discriminate da schema_version, mentre il prompt richiede esplicitamente 1.1 per i nuovi file. Un solo URL di schema e nessuna migrazione dei file 1.0. La restrizione dei nomi legacy malformati (S10 + Fonte_100, separatore assente) va documentata come fix; non garantire compatibilità con input che sfruttavano quel difetto. I nomi esistenti e la fixture valida rimangono accettati.

### 1.4 L'esaurimento interrompe il piano senza rapporto

nextId solleva Error all'esaurimento. Le quattro chiamate produttive sono per WEB-EXT (3), EXT (3), G (4), H (2). planIngest non cattura quell'errore e la CLI chiama direttamente il planner: non si ottiene il normale rapporto testuale/JSON. La modifica di H non elimina i limiti di EXT/WEB-EXT/G né il futuro limite H999.

Raccomandazione: riconoscere **solo l'errore specifico di esaurimento** e restituire un piano fatal, con namespace, limite e operazione/ref se applicabile; nessuna scrittura applicabile del piano parziale. Non basta classificare un'operazione come rejected: la CLI attuale non considera tutte le rejected un blocco globale, e potrebbe registrare il documento corpus come ingerito. Non catturare indistintamente bug e altri errori interni come se fossero esaurimenti. Il dataset passato resta intatto; applyPlan rifiuta già i piani fatal.

### 1.5 La cronologia nasconde overflow, Git mancante e altri guasti (V12, R20)

`src/site/history.ts:dataHistory` esegue git log --no-renames --name-status su data/ con maxBuffer 64 MiB, stderr ignorato e un catch generale che restituisce []. Non verifica prima se sia un checkout. `web/src/pages/[...lang]/changes.astro` mostra allora «Storia Git non disponibile», senza distinguere archivio sorgente da errore. L'unico test di cronologia attuale controlla il percorso positivo sul repository vero.

La riproduzione con un git simulato che emette 65 MiB causa realmente ENOBUFS e terminazione SIGTERM, poi la funzione restituisce []. Anche exit 128 simulato e git assente restituiscono []. Il checkout reale produce sei commit di dati; un archivio temporaneo senza Git produce legittimamente [].

Raccomandazione: controllare esplicitamente il contesto Git e **fallire la build per gli errori operativi** (buffer, Git non disponibile, accesso negato, repository danneggiato, git log fallito). Solo l'assenza effettiva di checkout mantiene [] con avviso esplicito. Non basta «exit 128»: lo stesso stato copre altri errori. Non usare il solo exists(.git): i worktree possono avere un file .git e Git può essere trovato in un antenato. Il probe deve distinguere il messaggio atteso di assenza repository, con locale controllato, da ogni altro errore; metadati Git presenti o contesto Git esplicito ma illeggibili non diventano un archivio valido. Nessun aumento del buffer e nessuna troncatura silenziosa.

Le scelte sono coerenti con le API documentate: Node termina il processo quando supera maxBuffer e la chiamata sincrona segnala gli errori; [Node child_process](https://nodejs.org/api/child_process.html#child_processexecfilesyncfile-args-options). Git espone probe del contesto di lavoro, senza garantire che qualunque errore equivalga a un non-checkout; [git rev-parse](https://git-scm.com/docs/git-rev-parse). Fonti ufficiali consultate il 15/11/2026; il risultato ENOBUFS è stato anche misurato localmente. Un checkout shallow che restituisce con successo una cronologia parziale rimane un limite separato; la CI usa già fetch-depth 0.

## 2. Riproduzioni e baseline

Script e risultati di sola lettura: `/private/tmp/b11-sol-repro/repro.mjs` e `results.json`. Fixture e dataset letti dal repository, mutazioni soltanto su copie in memoria; git simulato e archivio senza .git sotto la stessa directory temporanea. Nessun pnpm ingest --write, import o commit eseguito.

| Caso | Risultato attuale |
| --- | --- |
| SourceId S99 / S100 e HypothesisId H99 / H100 | Due cifre accettate, tre rifiutate |
| Fixture 1.0 / stessa fixture con versione 1.1 | 1.0 valida; 1.1 rifiutata sul literal |
| source.code S100 con Fonte_100 | Rifiuto, incluso messaggio errato di confronto con Fonte_10 |
| source.code S10 con Fonte_100 | Parser 1.0 accetta erroneamente; checkArchive rifiuta il numero a tre cifre |
| nextId dopo H32 / H99 | H33 / eccezione «ID space H99 exhausted» |
| nextId dopo EXT-999 e WEB-EXT-999 | Eccezione non trasformata in rapporto |
| planIngest con H99 sintetica e nuova ipotesi distinta | Eccezione prima del ritorno del piano |
| Cronologia reale | Sei commit, salvati in `/private/tmp/b11-sol-repro/history-before.json` |
| git exit 128 / git mancante / overflow reale | Tutti diventano [] silenziosa; overflow verificato anche direttamente: ENOBUFS, SIGTERM |
| Archivio sorgente senza checkout | []: comportamento da conservare, aggiungendo avviso |
| `pnpm check` | Exit 0, 20 suite / 222 test; 3 warning e 26 info Biome preesistenti; dati 0 errori / 23 avvisi; sidecar e articoli 0 errori / 0 avvisi |
| `pnpm data:diff` severo | **Exit 1**, esattamente i due errori ART-0001/ART-0002 reviewed ereditati da B06/B09; guardie non modificate |

Log: `/private/tmp/b11-sol-baseline-check.log`, `/private/tmp/b11-sol-baseline-data-diff.log`. Le riproduzioni dimostrano i difetti del codice attuale, non una correzione già implementata. Nessuna verifica live di impostazioni, task o PR.

## 3. Piano file per file, subordinato alle decisioni

### 3.1 Identificativi e contratto versionato

- **`src/model/schemas.ts`:** estendere soltanto S e H alla forma canonica di §1.2; mantenere F/P a due cifre e gli altri namespace invariati. Esporre/rifattorizzare un validatore di codice corpus riusabile per source.code, CLI e marcatori, senza allargare per errore F/P/WEB. Nessuna modifica a data/ o ID esistenti.
- **`src/model/proposals.ts`:** introdurre costante versione corrente 1.1 e schemi espliciti 1.0/1.1. Fattorizzare campi e regole comuni, con validatori S/H specifici per versione; evitare due copie divergenti delle regole probatorie. Esportare ProposalFile come contratto delle versioni supportate e conservare i tipi di operazione usati dal planner. Ogni ramo ha source.code/file coerenti per intero e un nome Markdown con separatore obbligatorio; il ramo 1.0 non assorbe nuovi ID per effetto di import condivisi. Gli endpoint che sono codici entità conservano la grammatica di EntityId: non vietare codici entità validi solo perché somigliano a un'altra categoria.
- **`src/pipeline/ingest/archive.ts`:** dispatch esplicito di parseSidecar per schema_version (messaggio leggibile su versione mancante/sconosciuta, nessun fallback); checkArchive/fonteNumber coerenti con due cifre o 100–999, nomi completi e assenza di alias. Preservare ordine numerico, precedenti obbligatori, collisioni, avvisi e confronto informativo. Il test S99/S100/S101 deve includere un archivio misto 1.0/1.1.
- **`src/cli/ingest.ts`:** validare il formato S esteso di --skip-pending, senza usarlo nelle prove dell'agente; preservare il carattere maintainer-only e i percorsi di errore/avviso per input, altri sidecar e --compare. Nessuna modifica di workflow o permessi.
- **`src/cli/schemas.ts` e `schemas/*.schema.json`:** generare lo schema di proposta per entrambe le versioni allo stesso URL; aggiornare tutti gli schemi canonici e di articolo che includono riferimenti SourceId/HypothesisId. Solo pnpm schemas scrive i file generati; nessuna modifica manuale. Nessuna nuova versione dell'export pubblico v1: il contenuto dei record attuali non cambia.

### 3.2 Allocazione e cronologia

- **`src/pipeline/ingest/plan.ts`:** nextId con larghezza minima distinta dal limite massimo (default invariato per gli altri namespace), H minimo 2 / massimo 3; errore specifico di esaurimento. Marcatore ancorato su codice corpus completo, con S100 riconosciuto e nessuna regressione su note falsificate o prive di fonte coerente. Trasformare l'esaurimento in fatal e writes vuote, conservando una diagnostica dell'operazione fallita e segnalando eventuali operazioni non elaborate. Nessun allargamento di EXT/WEB-EXT/G, nessuna applicazione parziale, nessun catch generale che nasconda errori di programmazione.
- **`src/site/history.ts`:** separare probe del checkout, lettura e parsing; API dataHistory() invariata per il chiamante. Archivio effettivo → [] più warning; checkout → lettura completa o errore di build contestualizzato. Gestire file .git dei worktree e antenati; Git assente, probe ambiguo, metadati danneggiati, stato nonzero, overflow o processo terminato → errore. Non stampare stdout potenzialmente enorme o incorporare un errore grezzo con l'intero buffer nei messaggi. Non aumentare maxBuffer e non introdurre troncature/limiti di commit.
- **`web/src/pages/[...lang]/changes.astro`:** nessuna modifica prevista: la condizione normale riceve la stessa lista, l'archivio conserva il messaggio attuale e l'errore operativo ferma la build prima di produrre una cronologia vuota. Se emerge necessità di cambiare l'interfaccia, riportarla prima di estendere il perimetro.

### 3.3 Test e documentazione nello stesso cambiamento

- **`test/ingest.test.ts`, `test/ingest-archive.test.ts`, `test/helpers/ingest.ts`:** regressioni di versioni, confini numerici, ordine e marcatori; tenere la fixture storica 1.0 valida e intatta. Sostituire le versioni 1.1 usate come input deliberatamente invalido con una versione sconosciuta. Rendere esplicita la versione nei builder sintetici; l'esempio documentale nuovo deve validare come 1.1.
- **Test modello / nuovo test focalizzato sugli ID:** verificare i confini e i riferimenti tipizzati anche in articoli e fonti; verificare che gli altri namespace mantengano i loro limiti.
- **`test/site.test.ts` e/o nuovo `test/history.test.ts`:** percorso positivo, archivio senza checkout con avviso, overflow, Git mancante/negato, repository danneggiato e metadati file di un worktree. Mock o runner isolato per gli errori: il test normale non deve emettere 65 MiB a ogni pnpm check; la riproduzione grande è già stata eseguita nell'analisi. Non introdurre variabili d'ambiente di produzione solo per simulare errori nei test.
- **`docs/ARCHITECTURE.md`:** tabella ID, allocazione, contratto e validazione sidecar, compatibilità 1.0, generazione schemi, esaurimento e cronologia non silenziosa. Stessi conteggi di dati; eventuali impronte degli schemi cambiano legittimamente.
- **`docs/M6_CHATGPT_OSINT_WORKFLOW.md` §2/§4:** nuovi file 1.1, forme S/H e Fonte_100, versione YAML illustrativa coerente per le nuove coppie, tabella campi, esempi 1.1 e lettura legacy 1.0; correggere limite a due cifre in §4.8 e il testo normativo Task A §4.6. Non riscrivere Markdown/sidecar archivistici. I metadati dei vecchi Markdown restano storici, non migrati.
- **`docs/automation/CHATGPT_TASK_PROMPTS.md`:** richiedere esplicitamente 1.1 per nuove proposte e lettura dei contratti/schema su main; aggiornamento esterno ancora pending maintainer. **`docs/CHATGPT_SCHEDULED_TASKS.md`** solo se necessario per il rimando alla nuova versione, senza alterare snapshot o cadenze.
- **`AGENTS.md`:** nuove forme dei nomi e compatibilità nelle sezioni M6/Sidecar contract changes, regola sull'esaurimento bloccante e mancata cronologia, stessi divieti. **`README.md`:** documentare nuovo contratto/ID e fallimento esplicito della build, con collegamenti ai dettagli tecnici.
- **Analisi e registro §5:** decisioni dopo approvazione, esiti reali, GPT nelle note e singolo commit; fissare l'hash B10 a ca6a83c.

Nessuna dipendenza nuova, modifica a workflow, impostazioni, stato reviewed/human_approved, dati canonici, articoli reali, sources/original o sources/incremental. Niente import o ingest write. Terra implementa dopo approvazione; review indipendente Sol prevista da §2.1.

## 4. Test di accettazione

| Caso | Risultato richiesto con le raccomandazioni |
| --- | --- |
| R14: 1.1 con S100/Fonte_100 | Parser, controllo archivio e dry run accettano la forma; nessuna confusione con S10 |
| 1.0 esistente e fixture storica | Accettati senza riscritture; testo/byte della fixture preservati |
| 1.0 con source.code S100 o target tipizzato H100; 1.2/2.0/versione assente | Rifiuto leggibile sul contratto corretto; nessun downgrade a un parser permissivo |
| 1.1 con S100 in citazioni/baseline_source e H100 in target/riferimenti ipotesi | Validazione coerente; risoluzione nel dataset sintetico corretta; i record inesistenti restano errori |
| S001/H099/Fonte_099, S1000/H1000, Fonte_1000, S10+Fonte_100, separatore assente | Rifiuto; nessun alias o troncamento del numero |
| S99 → S100 → S101 con sidecar misti e ordine di directory permutato | Ordine numerico stabile; predecessore non ingerito ancora fatal; duplicati numerici/codici/file restano errori |
| Marcatore S100 e rerun in memoria | already_applied, writes vuote; note falsificate ancora inefficaci e nessuna mutazione del dataset in ingresso |
| H32 → H33, H98 → H99, H99 → H100, H998 → H999 | Formato minimo invariato fino a 99; tre cifre da 100; nessun ID riusato |
| Esaurimento H999, EXT-999, WEB-EXT-999, G-9999, anche dopo operazioni precedenti | Piano fatal con motivo e operazione, writes vuote; CLI dry run exit 1 in testo/JSON, senza stack non gestito né file modificati; applyPlan rifiuta il piano |
| Regole probatorie e B04 | E5 soltanto ipotesi, persone, fonti, @ref, immutabilità, idempotenza e ordine invariati in entrambe le versioni |
| R20: ENOBUFS/errore Git in checkout | dataHistory e build falliscono esplicitamente; non compare una build verde con cronologia [] |
| Archivio senza checkout | [] con avviso distinto; nessuna eccezione operativa scambiata per archivio |
| Checkout standard / worktree con .git file | Stessi commit e record della baseline reale; sei commit sul ramo attuale, confronto con snapshot |
| Dataset e sito attuali | Data/, fonti, articoli, stati e impronte traduzioni identici; stessi ID/path di record pubblici e payload di collezioni/grafi; schema e metadati manifest possono variare in modo previsto |

Implementazione: pnpm schemas; pnpm check; pnpm build; pnpm check:links; pnpm validate:sidecars; pnpm data:diff severo con i due errori ereditati esplicitati. Sol ripete pnpm check e verifica diff/risultati prima del commit. Controllo delle pagine /changes/ IT/EN e dei link ai record, senza cambi di UI previsti; niente canarino GitHub o prove su task remoti. Gli eventuali test CLI usano copie temporanee e dry run: nessun pnpm ingest --write sul repository.

## 5. Rischi e limiti

1. **Compatibilità apparente:** allargare import condivisi può rilassare anche 1.0 senza accorgersene. Servono prove negative specifiche dei campi tipizzati legacy, oltre alla fixture positiva; i codici entità hanno una grammatica distinta.
2. **Alias numerici:** un semplice quantificatore 2–3 permette S099/H099 e può far divergere ordinamento, idempotenza e nome file. La forma proposta li esclude; gli ID esistenti non vengono normalizzati.
3. **Esaurimento parziale:** rifiutare solo la singola operazione può comunque far registrare il corpus. L'errore deve essere fatal per il piano intero; non si amplia silenziosamente un altro namespace.
4. **Cronologia e mirror:** il fallimento esplicito può fermare build che prima sembravano riuscire. È l'effetto voluto per un checkout guasto; il fallback per un archivio sorgente vero rimane disponibile e segnalato. Metadati Git corrotti non sono assenza di Git.
5. **Nuova capienza finita:** S/H arrivano a 999, non diventano illimitati; EXT/WEB-EXT/G restano ai limiti attuali con diagnostica corretta. Un ulteriore ampliamento richiederà un altro contratto.
6. **Schemi esportati:** cambiano schema e relativi hash del manifest, mentre record e grafi devono restare identici. Non pretendere un confronto byte-identico dell'intero export comprensivo di schemi modificati.
7. **Stato esterno:** il testo Task A aggiornato è preparato, non applicato in ChatGPT. Nessuna variazione di cadenza, identità o protezione; restrizione di ingest write finché B04 non è su main preservata.
8. **Guardie ereditate:** i due errori reviewed di data:diff non vengono nascosti per chiudere B11; nessuna etichetta di deroga o approvazione viene prodotta dall'agente.

## 6. Decisioni aperte per il manutentore

| ID | Opzioni | Raccomandazione |
| --- | --- | --- |
| **D-B11-1** | (a) estendere soltanto S/H a due cifre o 100–999, senza zeri aggiuntivi e mantenendo gli altri namespace; (b) ampliare anche altri namespace, specificandoli | **(a)**. H33 resta H33; H100/S100 diventano validi. Niente rinumerazioni, F/P storici invariati |
| **D-B11-2** | (a) nuove coppie 1.1, lettura esplicita 1.0+1.1 e un unico schema pubblico con i due rami; (b) stesso runtime ma schema pubblico 1.1 più schema legacy separato | **(a)**. URL e file esistenti conservati; parser legacy con vincoli propri e correzione del falso match Fonte_100→Fonte_10; nessuna migrazione dell'archivio |
| **D-B11-3** | (a) esaurimento di qualunque namespace = fatal per l'intero piano, senza writes; (b) rifiutare solo l'operazione e continuare, definendo come impedire falsa registrazione del corpus | **(a)**. Rapporto leggibile e CLI exit 1; nessuna applicazione parziale o perdita silenziosa |
| **D-B11-4** | (a) errore operativo Git/overflow = build fallita; solo archivio realmente senza checkout → [] con avviso; (b) anche gli errori operativi permettono la build con avviso evidente, accettando la cronologia mancante | **(a)**. Conservare l'uso da archivio sorgente senza nascondere guasti di un checkout |

**Stato alla consegna dell'analisi:** analisi conclusa; approvazione successiva registrata nel §7. Terra · alto implementa; Sol · medio rivede indipendentemente il diff; l'orchestratore verifica e crea il singolo commit locale.

## 7. Decisioni del manutentore (15 novembre 2026)

Il manutentore ha risposto «Procedi» alla richiesta esplicita di approvare tutte e quattro le raccomandazioni, autorizzando implementazione e chiusura B11 secondo il piano.

- **D-B11-1: (a).** Estesi soltanto S/H a due cifre o 100–999, senza rinumerazioni o zeri aggiuntivi; F/P e gli altri namespace restano invariati.
- **D-B11-2: (a).** Nuove coppie 1.1, lettura esplicita dei contratti 1.0 e 1.1 con validatori distinti e un unico schema pubblico con entrambi i rami; corretto anche il falso match legacy Fonte_100→Fonte_10. Nessuna migrazione dei file archivistici.
- **D-B11-3: (a).** Esaurimento di qualunque namespace fatal per l'intero piano, rapporto leggibile, CLI exit 1 e nessuna scrittura parziale.
- **D-B11-4: (a).** Guasti Git/overflow fanno fallire la build; [] con avviso soltanto per un archivio realmente privo di checkout.

Implementazione GPT-6.1 Terra · alto, review indipendente GPT-6.1 Sol · medio e verifica dell'orchestratore prima del singolo commit. Prompt aggiornato soltanto nel repository, applicazione esterna al manutentore; nessun push, impostazione o ingest write autorizzato.

## 8. Implementazione, review e verifica (15 novembre 2026)

**Esito:** D-B11-1…4 applicate da Terra · alto. ID S/H fino a 999 con forma canonica, allocazione H33/H99/H100 senza rinumerazioni, contratti 1.0/1.1 distinti e regole probatorie condivise. Un solo schema pubblico generato espone entrambi i rami. Archivio, parser, marcatori e CLI riconoscono i codici completi; gli altri namespace mantengono i limiti precedenti.

L'esaurimento tipizzato interrompe il piano intero con fatal e writes vuote, senza catturare errori estranei. La cronologia ora verifica il contesto Git: guasti del probe o di git log fanno fallire la build con diagnostica limitata; soltanto l'assenza verificata di checkout consente [] con avviso. Nessun aumento del buffer, troncamento o modifica dell'interfaccia del sito. Documentazione, prompt Task A e schemi aggiornati nello stesso cambiamento; l'applicazione esterna del prompt rimane pendente.

### 8.1 Review indipendente

Sol · medio ha letto il diff completo, incluso il nuovo test della cronologia e gli schemi generati. Un rilievo **B11-R1, P2 (test_gap)**: il test di compatibilità legacy combinava H100 e S100 nello stesso input, quindi il rifiuto di un solo campo avrebbe potuto nascondere un allargamento errato dell'altro. Terra ha isolato i tre casi (target H100, citazione S100, baseline_source S100) su un involucro 1.0 altrimenti valido, con i corrispondenti casi positivi 1.1.

Aggiunte anche le prove negative per contesto GIT_DIR esplicito e metadati soltanto nell'antenato, con ripristino dell'ambiente. Il controllo del delta Sol ha confermato R1 risolto e nessun ulteriore rilievo. Nessun difetto di produzione identificato dalla review; il reviewer non ha eseguito test o modifiche.

L'orchestratore ha inoltre richiesto la rimozione di sei nuovi warning Biome nei test tramite controlli espliciti delle collezioni vuote, senza soppressioni né assert indeboliti. La documentazione distingue ora espressamente assenza di checkout da assenza dell'eseguibile Git, che rimane un errore.

### 8.2 Verifiche reali dell'orchestratore

| Verifica | Esito |
| --- | --- |
| `pnpm check` | Exit 0; 21 suite / 234 test. Biome 3 warning / 26 info preesistenti; dati 0 errori / 23 avvisi; sidecar e articoli 0 errori / 0 avvisi |
| `pnpm build` | Exit 0 |
| `pnpm check:links` | Exit 0; 885 pagine, 166.643 link interni, 0 problemi |
| `pnpm schemas --check` | Schemi aggiornati, verificato nel check; generazione eseguita da Terra tramite pnpm schemas |
| `pnpm validate:sidecars`, Terra | Exit 0; nessun sidecar archivistico riscritto |
| `pnpm data:diff` severo | **Exit 1: esattamente i due errori ART-0001 e ART-0002 reviewed ereditati da B06/B09. Nessuna deroga o modifica delle guardie** |
| Confronto con snapshot prima di B11 | 1.040 file protetti identici, inclusi data/, tutte le fonti, articoli IT/EN, fixture 1.0, workflow, dipendenze/lock; nessuna aggiunta/rimozione in questi percorsi |
| Export e cronologia | Dieci export senza schemi identici byte per byte; lista completa dei sei commit/record identica; stessi 885 percorsi HTML. Schemi e relativi metadati del manifest cambiano come previsto |
| R20, prova autonoma su git simulato | Probe valido seguito da log con 65 MiB → errore ENOBUFS esplicito; log exit 128 e Git mancante → errori espliciti; archivio reale temporaneo senza checkout → [] con warning. Nessun buffer stampato o errore nascosto |
| Browser locale IT/EN | /changes/ mostra sei commit, dettagli dei record espandibili e link S00 nelle rispettive lingue; schede S00 raggiunte, asset caricati e nessun errore console nella verifica con server configurato al base path corretto |
| Markdown / whitespace | 53 collegamenti relativi a file verificati; git diff --check pulito |

Log dell'orchestratore `/private/tmp/b11-sol-final-{check,build,links,data-diff}.log`; log Terra `/private/tmp/b11-terra-*.log`, inclusi review-check e test-cleanup. Confronto ripetibile con `/private/tmp/b11-verify.mjs` rispetto a `/private/tmp/b11-before.json`. Le prove di errore usano runner simulati e copie in memoria/temporanee; nessun ingest write sul repository.

### 8.3 Chiusura e limiti residui

S/H restano limitati a 999, EXT/WEB-EXT/G ai limiti già esistenti. Gli archivi 1.0 validi restano leggibili; i falsi match di nomi malformati sono correttamente rifiutati. Un checkout shallow con comando Git riuscito può ancora avere una cronologia parziale; la CI conserva fetch-depth 0. Nessuna nuova identità, impostazione, schedulazione, attivazione del prompt o canarino GitHub è stata eseguita.

Unico commit locale previsto: `fix(pipeline): extend IDs and surface ingest and history failures`. Nel registro «questo commit» identifica il commit contenente la riga: il suo hash non può figurare nel proprio contenuto e sarà fissato dal blocco successivo. Nessun push, merge, approvazione o bypass.
