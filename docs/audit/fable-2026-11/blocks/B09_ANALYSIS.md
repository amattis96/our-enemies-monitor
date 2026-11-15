# B09 — Articoli: link al corpus e transizioni di stato · Analisi

- **Blocco:** B09, CF-007. Rapporti: FABLE_B V7, P3, R2, T4 e §12 domanda 2; FABLE_A sintesi punto 4, §5/A1 e P12. La scheda cita A §4.4 p.4, ma il rilievo ART-0002 è nella sintesi e in A1; §4.4 tratta invece i cammini proibiti.
- **Base verificata:** ramo locale `audit/fable-2026-11-implementation` @ `14b7c091a5f48905417dbe3ab77157f8e84fc27f`, dopo B08. **Data:** 15 novembre 2026, Europe/Rome.
- **Ingresso:** working tree pulita, ramo corretto, nessuna operazione Git in corso; letti AGENTS, piano e ultimi 15 commit nell'ordine richiesto. B09 è il primo blocco non committato nella sequenza. Nessun file B09 precedente o WIP.
- **Modelli:** analisi Sol, implementazione prevista Terra · alto, review indipendente Sol prima della chiusura. Metodo evidence-first della skill mcp-technical-analyst.
- **Perimetro della fase:** lettura e simulazioni su copie in memoria; sola documentazione pubblica GitHub consultata per progettare il controllo delle review, senza API del repository o verifica di impostazioni remote. Nessuna modifica a codice, dati o documentazione operativa; soltanto questa analisi e registro alla consegna.

**Baseline reale:** `pnpm check` exit 0, **18 suite / 213 test**, dati 0 errori / 23 warning preesistenti; Biome 3 warning / 26 informazioni preesistenti; 2 articoli validi e pubblici. `pnpm data:diff` mantiene exit 1 per i due articoli reviewed modificati nei soli metadati da B06. Nessuna deroga. Log `/private/tmp/b09-analysis-{check,data-diff}.log`.

## 1. Stato verificato

### 1.1 R2 è già parzialmente coperto da B02, T4 persiste nel gate statico

`src/pipeline/articles.ts` verifica schema, ID, fonti dichiarate, fixture, date e doppia impronta B06. `src/site/articles.ts::withheldReasons` richiede reviewed (salvo fixture) e verifica soltanto record e fonti effettivamente dichiarati. Non analizza menzioni o omissioni.

Prova su copie IT/EN di ART-0002, rinominate ART-0099, mantenendo testi, hash e stato reviewed ma svuotando **tutte e quattro** le liste links:

```text
validateArticleFiles: 0 errori
withheldReasons: []                 → pubblicabile nel gate statico
diffArticles([], clone): error      → nuovo articolo reviewed rifiutato da B02
```

Il percorso «CI tutta verde» descritto da V7 non è più corretto dopo B02: il diff severo copre gli articoli su ogni ramo. Tuttavia quel controllo non verifica una review editoriale specifica; gli errori derogabili possono essere abbassati dal meccanismo del proprietario adottato in B02. Il nuovo controllo B09 deve essere distinto da quella deroga, non interpretarla come approvazione editoriale.

### 1.2 ART-0002 ha link a entità, ma nessun link a casi o affermazioni

Stato corrente:

| Articolo | Events | Entities | Relationships | Hypotheses | Stato articolo / traduzione |
| --- | --- | --- | --- | --- | --- |
| ART-0001 | 4 | 7 | 8 | 1 | reviewed / machine |
| ART-0002 | 0 | 7 | 0 | 0 | reviewed / machine |

Le sette entità di ART-0002 sono GRU, PL, LT, GB, DE, RU, EU. Quindi «nessun link» non può significare soltanto quattro liste tutte vuote: non rileverebbe il caso reale. Il segnale da controllare è l'assenza simultanea di **events, relationships e hypotheses**, pur in presenza di attori o record discussi nel testo.

TL-0064 riguarda i pacchi incendiari DHL/DPD del luglio 2024. H02 è la domanda aperta sui committenti e i canali dei sabotaggi logistici e mantiene il limite «una campagna strategica comune non implica direttiva identica per ogni episodio». Entrambi sono pubblici dopo B05; la proiezione H02 esclude EXT-024, fonti incrementali e note non revisionate.

**Simulazione dei soli due link proposti dalla scheda:** events `[TL-0064]`, hypotheses `[H02]`, lasciando invariato tutto il resto di ART-0002.it.md. Risultato: **0 errori**, entrambi gli articoli ancora pubblici, backlink ART-0002 su TL-0064 e H02. L'associazione all'ipotesi è un rimando alla domanda aperta, non la prova di una regia unica. Non si propone di aggiungere relazioni, fonti o contenuto fattuale.

### 1.3 Un rilevatore di menzioni può segnalare omissioni, non scegliere archi

Le entità canoniche hanno `name.it` e `name.en`, **nessun campo aliases**. Gli alias del contratto sidecar non sono una lista disponibile nel dataset canonico: non vanno inventati in data/.

Prototipo di sola lettura sui nomi IT/EN completi di almeno quattro caratteri e sugli ID di almeno tre caratteri presenti come token maiuscoli esatti, con confini Unicode. Una presenza di un evento è stata ricavata da estremi/eventi di relazioni pubbliche, non da somiglianze testuali. Nel corpus pubblico **160 entità** hanno almeno un collegamento strutturato a un evento pubblico.

| Articolo | Link events+relationships+hypotheses | Entità riconosciute dal prototipo |
| --- | --- | --- |
| ART-0001 | 13 | BE, CPS, EU24, EUROPARL, GB, GILL, MAR, MED, RU, UA, VOE, VOL |
| ART-0002 | 0 | DE, GB, GRU, LT, PL, UA |

Anche una menzione della nazionalità o una frase negativa può dare un riscontro: UA in ART-0002 non implica un ruolo dello Stato ucraino negli incendi. Il prototipo non stabilisce rilevanza, causalità o pertinenza di un evento specifico.

**Raccomandazione per la prima fase prevista dalla scheda («avviso, poi errore»):** avviso deterministico per articolo privo di tutti e tre i tipi di link di caso, quando nomina almeno un'entità con eventi strutturati. Elenco di ID corrispondenti e richiesta di verifica editoriale, senza aggiungere link automaticamente e senza bloccare un articolo solo sulla base del lessico. Eventuali alias/esclusioni devono essere pochi, espliciti e versionati. Non promettere copertura semantica completa; un link irrilevante può comunque soddisfare un controllo meramente quantitativo.

Un successivo blocco di errori basati sulle menzioni richiede una decisione sul trattamento di articoli realmente esterni al corpus e delle menzioni di solo contesto. Forzare un collegamento inventato per ottenere CI verde violerebbe la disciplina probatoria. Il controllo B09 delle autorizzazioni, invece, può essere subito bloccante e non dipende dal rilevatore lessicale.

### 1.4 Controlli di approvazione attuali e limite dell'identità condivisa

- `.github/workflows/evidence-diff.yml` esegue il diff severo e `check:pr`, che verifica solo la validità dell'etichetta del manutentore. Nessuna chiamata legge le review della PR.
- I job hanno già `pull-requests: read`; eseguono codice della PR con soli permessi di lettura. B02 ha deliberatamente rinviato l'esecuzione in contesto fidato. B09 non introduce pull_request_target o token di scrittura.
- `.github/CODEOWNERS` ha un solo code owner, amattis96. B01 ha adottato identità separata per agenti, ma la verifica del connettore e le impostazioni restano attività del manutentore, non confermate in questa analisi.
- Le note dei due articoli riportano autorizzazione umana del 13 novembre dopo il controllo di Task C; sono testo storico, non una firma verificabile o una nuova approvazione dell'HEAD corrente.

Un campo `approved_by: amattis96`, un URL di review o una stringa firmata soltanto per convenzione nel front matter possono essere copiati dall'autore. Non costituiscono da soli una verifica d'identità. Anche l'attore API è un account e non certifica chi lo sta usando: la separazione delle credenziali di B01 resta necessaria.

### 1.5 Documentazione GitHub verificata e dipendenza operativa

La [REST API delle review](https://docs.github.com/en/rest/pulls/reviews#list-reviews-for-a-pull-request) espone autore, stato, commit_id, submitted_at e URL della review, con paginazione; basta il permesso read sulle pull request. Sono dati adatti a controllare un'approvazione sull'HEAD esatta.

Gli eventi [pull_request_review](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request_review) permettono di rieseguire il controllo su submitted/edited/dismissed. Il SHA di evento è quello del merge ref: il codice deve continuare a usare esplicitamente `pull_request.head.sha` e verificare la HEAD live.

GitHub documenta che [l'autore non può approvare la propria PR](https://docs.github.com/en/pull-requests/how-tos/review-pull-requests/reviewing-proposed-changes-in-a-pull-request). Di conseguenza, la soluzione raccomandata con reviewer distinto **non funziona su una PR dell'account proprietario approvata dallo stesso proprietario**. Servono autore agente separato e approvazione umana, oppure un altro revisore umano autorizzato. Non si inventa un secondo soggetto e non si introduce un auto-approve. Il manutentore deve approvare consapevolmente questo limite prima dell'implementazione; la gestione della PR finale del programma rimane sua.

## 2. Riproduzioni essenziali

Tutte su copie in memoria, nessuna scrittura di stati umani nel repository:

```js
const clone = readArticleFiles()
  .filter(f => f.path.includes('ART-0002.'))
  .map(f => ({
    path: f.path.replace('ART-0002', 'ART-0099'),
    text: f.text.replace('id: ART-0002', 'id: ART-0099')
      .replace(/^  (events|entities|relationships|hypotheses): .*$/gm, '  $1: []')
  }));
const result = validateArticleFiles(clone, dataset);
// result.issues: []; withheldReasons(result.articles[0], published): []
// diffArticles([], clone): nuovo reviewed rifiutato
```

Per la proposta ART-0002 sostituire soltanto `events: []` e `hypotheses: []` nel front matter IT con i due ID del §1.2; validare l'intero insieme e calcolare publishedArticles/articleBacklinks. source_hash e target_hash restano validi: i metadati links non sono testi localizzati. Non eseguire articles:hash per questa correzione.

## 3. Piano file per file, subordinato alle decisioni

### 3.1 Semantica editoriale e controllo delle review

Definizione raccomandata: reviewed significa **autorizzazione editoriale umana alla pubblicazione del pacchetto corrente**, con responsabilità sulla separazione fra fatti, accuse e ipotesi. Task C può supportare la verifica; il suo rapporto non approva automaticamente la pubblicazione. Lo stato della traduzione resta distinto: un articolo reviewed può avere EN machine con avviso reale, come oggi. Nessun agente imposta reviewed o human_approved.

- **`src/pipeline/article-diff.ts`:** estrarre una funzione pura che individua gli articoli per cui serve autorizzazione: nuovo reviewed, transizione a reviewed, modifica di un articolo già reviewed in qualunque lingua/metadato, transizione a traduzione reviewed, modifica di una traduzione già reviewed. Restano intatte le guardie severe esistenti, incluse quelle sui metadati B06; nessuna eccezione target_hash.
- **Nuovo `src/pipeline/article-review.ts`:** policy pura su dati PR e review. Reviewer umano ammesso: i login in ARTICLE_REVIEWERS (default MAINTAINER_LOGIN/owner), distinti dall'autore della PR; nessun riconoscimento automatico di bot o di chiunque abbia write. Stato approvante valido sulla HEAD esatta, dopo la selezione dell'ultimo stato decisivo del reviewer. Commenti o review pendenti non sono approvazioni, review ritirate o sostituite da changes requested non valgono.
- Richiedere un'intenzione editoriale esplicita nella review, ad esempio una riga `Publication-Approval: ART-0001, ART-0002`; per una promozione/revisione umana della traduzione una riga distinta `Translation-Approval: ART-0001`. Una generica approvazione del codice non dichiara automaticamente una verifica editoriale. Parsing del corpo come dati, non istruzioni. Ogni ID richiesto dal diff deve essere coperto; un ID di un'altra PR o una vecchia HEAD non conta.
- **Nuovo `src/cli/check-article-review.ts`** (nome definitivo in implementazione): raccogliere diff con la stessa merge base di data:diff e head effettiva; leggere PR e review via API in sola lettura con paginazione e limite di buffer. Verificare head attesa/live, attore, stato, intenzione e tutti gli ID interessati. Errori API, payload incompleti o HEAD cambiata: uscita non zero, nessun consenso presunto. Riportare URL/ID review, reviewer, SHA e articoli coperti, senza esporre token o l'intero testo libero della review.
- **`package.json`:** comando CI dedicato e test della policy; non aggiungere API live a pnpm check locale. Nessuna nuova dipendenza necessaria.
- **`.github/workflows/evidence-diff.yml`:** step obbligatorio nello stesso job evidence-diff, senza condizioni su waiver o continue-on-error. Trigger pull_request_review submitted/dismissed (edited se si permette la modifica del marcatore); mantenere checkout HEAD, nomi check/evidence-diff e permessi read. Non modificare il job di scadenza dell'etichetta o i diritti di deploy.

**Rapporto con B02:** l'approvazione editoriale è una condizione aggiuntiva, non una deroga al diff. Il controllo B09 resta bloccante anche se il meccanismo B02 considera valida una deroga per altri errori. Una review valida non rende automaticamente verdi gli errori B02, e un'etichetta non sostituisce la review. Gli agenti non applicano etichette, non approvano PR, non cambiano impostazioni e non inviano messaggi di approvazione.

**R2 atteso:** PR con nuovo reviewed e nessuna review editoriale indipendente valida → CI rossa, anche in presenza di altre autorizzazioni tecniche. Su PR del manutentore con un solo code owner si fallisce in modo esplicito, finché non esiste un soggetto distinto ammesso o il manutentore sceglie un altro meccanismo verificabile. Non si risolve questa dipendenza con un fallback permissivo.

### 3.2 Diagnostica dei link mancanti

- **Nuovo helper puro**, ad esempio `src/pipeline/article-links.ts`: diagnosticare articoli con events/relationships/hypotheses tutti vuoti e menzioni di entità con eventi strutturati. Nomi IT/EN e ID con confini di parola; evitare corrispondenze per sottostringa, ID brevi ambiguamente comuni e liste di alias dedotte da fonti non strutturate. Eventuali esclusioni/alias espliciti versionati qui, senza cambiare data/.
- **`src/pipeline/articles.ts`:** integrare gli avvisi nella stessa Issue[]; calcolare il contesto pubblico con il gate condiviso quando necessario, senza cicli di import dal modulo site/articles. In alternativa passare il contesto al helper dal CLI; tutti i consumer di validazione devono essere coerenti.
- **`src/cli/validate-articles.ts`:** rendere visibile l'avviso con articolo e ID corrispondenti, chiarendo che è una coda editoriale; riepilogo warning oltre agli errori. Nessuna scrittura automatica o proposta di ruolo/catena causale.
- **`src/site/articles.ts`:** conservare il gate dei link dichiarati verso candidati e fonti trattenute; la fase warning non introduce nuove eccezioni alla pubblicazione. T4 deve produrre una diagnostica, mentre il suo nuovo stato reviewed rimane bloccato nella pipeline CI dall'autorizzazione indipendente. **Non dichiarare che il gate statico comprende semanticamente un testo senza link**.
- Se viene scelta la variante bloccante D-B09-3(b), serve prima specificare il trattamento delle inchieste esterne al corpus e delle menzioni contestuali; non usare un flag liberamente impostabile dall'agente come esenzione editoriale.

### 3.3 Correzione editoriale proposta e documentazione

- **`content/articles/ART-0002.it.md`, solo se D-B09-4 approvata:** aggiungere TL-0064 a links.events e H02 a links.hypotheses; conservare entità, testo, riferimenti, stato reviewed esistente, note, date e updated. Nessun nuovo fatto e nessuna promozione di un'ipotesi.
- **ART-0002.en.md:** nessuna modifica necessaria; source_hash/target_hash attuali restano validi. Nessuna modifica ad ART-0001 o data/.
- **`AGENTS.md`, `docs/M6_CHATGPT_OSINT_WORKFLOW.md` Article contract, `content/articles/README.md`:** definizione reviewed, responsabilità umana, marcatore richiesto nella review se scelto, messaggi sui link mancanti, limite identità e divieto di attestazioni autoreferenziali nel front matter. Aggiornare soltanto sezioni attinenti; riconciliazione generale dei testi obsoleti rimane B10.
- **`docs/ARCHITECTURE.md`, `README.md`:** documentare il nuovo controllo, i comandi e il rapporto con il gate statico e B02. Nessun nuovo schema/field di approvazione non verificato nella soluzione API raccomandata.
- **Questo file e IMPLEMENTATION_BLOCKS §5:** registrare decisioni dopo approvazione, esiti reali e commit; fissare il precedente hash B08 `14b7c09`.

## 4. Test e accettazione

| Prova | Esito richiesto con le raccomandazioni |
| --- | --- |
| R2: nuovo reviewed / transizione senza approvazione indipendente | Nuovo controllo CI fallisce; nessuna deroga implicita |
| T4: clone ART-0099 senza tutti i link | Avviso sulle menzioni; diff severo e controllo di autorizzazione impediscono l'introduzione senza decisione umana. Il gate statico da solo resta un controllo dichiarativo |
| Review su HEAD corrente, reviewer ammesso distinto, marcatore con tutti gli ID | Controllo editoriale positivo; stampata evidenza della review, nessuno stato riscritto |
| Vecchia HEAD, autore stesso della PR, bot/non autorizzato, marker generico o ID mancanti | Fallimento |
| APPROVED poi CHANGES_REQUESTED / DISMISSED, COMMENTED/PENDING | Nessuna approvazione valida; non recuperare un'approvazione precedente per aggirare lo stato più recente |
| COMMENTED dopo APPROVED | Il commento non sostituisce lo stato decisivo; comportamento definito nei test |
| API non leggibile, dati malformati, paginazione, HEAD cambiata | Fallimento esplicito; nessun verde per assenza di dati |
| PR senza cambiamenti che richiedono revisione editoriale | Nessun requisito editoriale aggiunto; altri controlli invariati |
| Due articoli / traduzione umana | Copertura di tutti gli ID e del tipo di autorizzazione, nessuna estensione automatica del consenso |
| Link mancanti | ART-0002 corrente rilevata pur avendo sette links.entities; dopo i due link approvati niente avviso vacuo; no match di sottostringhe/ID brevi, context-only mai trasformato in arco |
| ART-0002 con TL-0064 e H02 | 0 errori, due articoli ancora pubblici, backlink su entrambe le schede IT/EN |
| Link a un candidato / persona non pubblicabile | Articolo ancora trattenuto; nessuna deroga alle regole B03/B05 |
| B06 e guardie esistenti | Doppio hash resta efficace; gli errori su articoli reviewed modificati non scompaiono per una modifica a questa policy |

File: ampliare `test/articles.test.ts`, `test/article-diff.test.ts`; nuovi test puri della policy e integrazione CLI con gh simulato in ambiente temporaneo, senza rete o segreti. Coprire lo step workflow e il trigger con actionlint se disponibile. Non pubblicare approvazioni reali, neppure per fare una prova.

In implementazione: pnpm check, build e check:links, validate:articles, audit:publication e data:diff severo con esiti reali. Browser IT/EN di ART-0002, TL-0064 e H02 per rimandi, avvisi E5 e traduzione machine. Confronto dei JSON canonici/export per escludere cambi estranei. Review indipendente Sol sul diff dopo Terra; Sol ripete pnpm check prima del singolo commit.

Canarino GitHub da applicare dal manutentore, dopo autorizzazione al push e configurazione B01: PR distinta con reviewed senza review → rosso; review umana della HEAD con intento editoriale → step B09 verde; push o ritiro review → rosso. Durante questo blocco non si modificano account/ruleset/etichette e non si dichiara verificato il canarino senza eseguirlo.

## 5. Rischi e limiti

1. **Dipendenza dall'identità:** con l'attuale unico account condiviso non esiste separazione tecnica certa fra agente e umano. Il checker non la crea; su PR del proprietario l'auto-approvazione è esclusa.
2. **Codice del checker nella PR:** resta il limite B02: la PR può proporre modifiche al proprio workflow. Servono review del code owner e impostazioni effettivamente applicate; nessun salto automatico a pull_request_target.
3. **Stato statico e processo:** reviewed nel JSON non è una firma. La soluzione API controlla il processo CI delle modifiche, senza rendere ogni checkout dipendente da un servizio remoto. Le due autorizzazioni storiche non vengono fabbricate retroattivamente.
4. **Fatica da autorizzazione:** mantenere sia le guardie B02 sia il requisito editoriale comporta due controlli distinti. È deliberato per non indebolire regole; nessun errore ereditato viene nascosto per chiudere B09.
5. **Menzioni:** falsi positivi e falsi negativi sono inevitabili nel primo rilevatore. Il warning è un invito a verificare, non una classificazione del ruolo di una persona o una garanzia di completezza.
6. **Limite della fase warning:** la parte semantica di T4 resta una diagnostica, non un rifiuto statico universale. La scelta di bloccarla richiede la policy sugli articoli esterni; va approvata, non introdotta tacitamente.
7. **Correzione di articolo reviewed:** il solo aggiungere due link mantiene l'errore del diff severo, già presente dopo B06. I link non rinnovano né simulano un'approvazione GitHub, e non autorizzano a cambiare reviewed o hash.

## 6. Decisioni aperte per il manutentore

| ID | Opzioni | Raccomandazione |
| --- | --- | --- |
| **D-B09-1** | (a) reviewed = autorizzazione editoriale umana alla pubblicazione, anche con supporto di Task C, con stato EN separato; (b) reviewed = solo verifica tecnica, introducendo uno stato distinto di autorizzazione umana | **(a)**, coerente con la regola attuale; esplicitare la responsabilità senza promuovere automaticamente l'inglese |
| **D-B09-2** | (a) review GitHub sulla HEAD esatta, del manutentore distinto dall'autore, con intento editoriale e ID espliciti; controllo aggiuntivo non derogabile tramite il meccanismo B02; (b) artefatto firmato nel repository, con chiave umana esterna e verifica di firma da progettare, senza fidarsi del solo front matter | **(a)**. **Accettare esplicitamente che una PR dell'unico proprietario non può auto-approvarsi**: identità agente separata o altro umano autorizzato necessari. Nessun canarino o configurazione remota eseguiti dall'agente |
| **D-B09-3** | (a) prima fase con avvisi mirati di menzione senza link di caso, senza inferenze o autolink; (b) errori di pubblicazione fin da ora, definendo anche una policy umana per articoli esterni al corpus / menzioni contestuali | **(a)**, come prima fase prevista dalla scheda. Il controllo delle approvazioni è subito bloccante; il rilevatore lessicale resta diagnostico, senza dichiarare risolto un controllo semantico universale |
| **D-B09-4** | (a) aggiungere soltanto TL-0064 e H02 ai link di ART-0002, conservando stato e testi; (b) rinviare la correzione a un intervento editoriale separato | **(a)**: simulazione valida e due articoli ancora pubblici; approvazione esplicita dei metadati di un articolo già reviewed, nessun nuovo stato umano |

**Stato alla consegna dell'analisi:** analisi conclusa; approvazione successiva registrata nel §7.

## 7. Decisioni del manutentore (15 novembre 2026)

Il manutentore ha risposto «Procedi» alla richiesta esplicita di approvare tutte e quattro le raccomandazioni, **incluso il requisito del reviewer distinto**, autorizzando implementazione e chiusura B09 secondo il piano.

- **D-B09-1: (a).** reviewed indica autorizzazione editoriale umana alla pubblicazione, con possibile supporto di Task C e stato della traduzione separato. Gli agenti non impostano stati umani.
- **D-B09-2: (a).** Review GitHub del manutentore distinto dall'autore, sulla HEAD esatta, con intento editoriale e ID espliciti; controllo aggiuntivo obbligatorio, indipendente dalla deroga tecnica B02. Accettato il limite operativo delle PR dell'unico proprietario, che non possono auto-approvarsi. Configurazione delle identità e canarino restano al manutentore; nessuna azione remota è autorizzata qui.
- **D-B09-3: (a).** Prima fase di avvisi mirati per menzioni senza link di caso, senza inferenze o aggiunte automatiche. Il controllo delle autorizzazioni è subito bloccante; la diagnostica lessicale non viene presentata come verifica semantica universale.
- **D-B09-4: (a).** Autorizzata la sola aggiunta di TL-0064 e H02 ai link di ART-0002.it.md, preservando testo, stato esistente, riferimenti, date e impronte. Nessuna nuova approvazione GitHub o promozione di stato implicita.

Implementazione GPT-6.1 Terra · alto; review indipendente Sol e verifica dell'orchestratore prima del singolo commit. Nessuna autorizzazione al push.

## 8. Implementazione, review e verifica (15 novembre 2026)

**Esito:** implementazione conclusa secondo D-B09-1…4. Il controllo editoriale è uno step obbligatorio del job `evidence-diff`, attivato anche dai cambiamenti alle review. Legge PR e review con permessi di sola lettura, verifica la HEAD prima e dopo la lettura e richiede l'ultima review decisiva del manutentore, di tipo User e distinto dall'autore. I marcatori `Publication-Approval` e `Translation-Approval` devono coprire esplicitamente gli ID richiesti. Una deroga B02 non rende facoltativo questo step. Le guardie severe preesistenti sugli articoli rimangono identiche.

La diagnostica delle menzioni senza link di caso produce solo avvisi e non scrive collegamenti né attribuisce ruoli. In ART-0002.it.md sono state aggiunte esclusivamente le due voci approvate, TL-0064 e H02; tutti gli altri byte sono preservati. Documentazione di architettura, README, regole agenti e contratto M6 aggiornati insieme al codice. Nessuna dipendenza aggiunta: il parsing strutturale dei marcatori usa micromark già presente.

### 8.1 Review indipendente e correzioni

Review Sol sul diff completo, seguita da verifica del solo delta correttivo. Un rilievo **B09-R1, P2**, risolto: le righe di continuazione di una citazione Markdown potevano essere interpretate come intento editoriale. Il parser ora accetta soltanto righe complete di testo di un paragrafo al livello principale, escludendo citazioni (anche con continuazione implicita), liste, blocchi di codice e HTML. Test negativo sulla riproduzione e positivo dopo una reale chiusura della citazione. La review del delta non ha trovato altri problemi correlati.

Durante la verifica dell'orchestratore sono stati inoltre corretti il supporto delle PR con autore Bot (il reviewer resta umano) e i marcatori dentro esempi di codice. Una successiva pulizia equivalente con optional chaining elimina il solo warning Biome introdotto dal blocco; policy e CLI riprovate (7 test). Nessuna review o approvazione GitHub pubblicata dagli agenti.

### 8.2 Verifiche reali dell'orchestratore

| Verifica | Esito |
| --- | --- |
| `pnpm check` | Exit 0; 20 suite, 222 test; dati 0 errori / 23 avvisi; articoli 0 errori / 0 avvisi. Restano i 3 warning Biome preesistenti, nessun nuovo warning |
| `pnpm build` | Exit 0 |
| `pnpm check:links` | Exit 0; 885 pagine, 166.643 link interni, 0 problemi |
| `pnpm validate:articles` | Exit 0; due articoli pubblici, 0 errori / 0 avvisi |
| `pnpm audit:publication` | Exit 0; nessun cambio alla proiezione dei record canonici |
| `actionlint .github/workflows/evidence-diff.yml` | Exit 0 |
| `pnpm data:diff` severo | **Exit 1: esattamente i due errori su ART-0001 e ART-0002 reviewed modificati, già presenti dopo B06. Non derogati né rimossi** |
| Confronto con snapshot precedente B09 | JSON canonici ed export identici byte per byte; un solo file articolo modificato, con esattamente le due aggiunte approvate; testi, stati, date e hash invariati |
| Browser locale IT/EN | Sei pagine: ART-0002, TL-0064 e H02; link e backlink corretti, avviso E5 e stato machine inglese conservati, nessun errore console |

Log locali delle verifiche in `/private/tmp/b09-sol-*.log`; confronto ripetibile nello script `/private/tmp/b09-verify.mjs` rispetto a `/private/tmp/b09-before.json`. Test CLI con gh simulato: non sono state interrogate le API del repository né fabbricate approvazioni. Le verifiche di build e browser sono successive alla correzione del parser; la pulizia optional chaining non cambia la logica.

### 8.3 Chiusura e limiti residui

Il canarino GitHub resta **non eseguito**, da applicare dal manutentore dopo configurazione delle identità B01 e autorizzazione al push. Una PR dell'unico proprietario non può soddisfare il requisito del reviewer distinto. Restano i limiti dichiarati del codice CI proposto nella stessa PR e del rilevatore lessicale non bloccante; nessuna attestazione storica è stata creata.

Unico commit locale previsto: `feat(editorial): require human review for article publication`. Nel registro, la voce «questo commit» identifica il commit che contiene la riga stessa: il suo hash non può essere incluso nel proprio contenuto e verrà fissato dal blocco successivo, come per i blocchi precedenti. Nessun push, modifica di impostazioni o deroga.

### 8.4 Correzione post-review (Claude, 2026-11-15)

Rimosso il collegamento `hypotheses: [H02]` da `content/articles/ART-0002.it.md` (ripristinato `hypotheses: []`, come prima di f5ee0a5). Motivo: un'ipotesi E5 aperta risultava collegata da un articolo `reviewed` senza che l'articolo la affermi editorialmente. `events: [TL-0064]` è mantenuto: andrà affermato esplicitamente nella revisione `Publication-Approval` del manutentore. Corpo e altro front matter invariati.
