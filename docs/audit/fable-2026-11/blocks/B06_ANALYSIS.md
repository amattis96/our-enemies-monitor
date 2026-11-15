# B06 — Traduzioni: impronta bidirezionale e glossario minimo · Analisi

- **Blocco:** B06, parte di CF-007. Fonti: FABLE_B V6, P5, R5; FABLE_D §8.3 e A12; FABLE_A §4.10; CONSOLIDATED_FINDINGS §4 e ADR-07.
- **Base verificata:** ramo locale `audit/fable-2026-11-implementation` @ `66a8b867d330992b772a4a52bfa7bf6e318bcf6b`, dopo B05. Nessuna verifica o modifica remota.
- **Data:** 15 novembre 2026, Europe/Rome. GPT: analisi Sol, implementazione prevista Terra · medio secondo §2.2. Non è prescritta una review separata per B06; restano verifica indipendente e commit dell'orchestratore.
- **Ingresso:** ramo corretto, working tree pulita, nessuna operazione Git in corso; letti AGENTS, piano e ultimi 15 commit. B06 è il primo blocco non committato nell'ordine raccomandato; nessuna precedente analisi B06 o WIP da riprendere.
- **Perimetro della fase:** lettura, mutazioni di copie in memoria e CLI su una radice temporanea. Nessuna modifica a codice, dati o documentazione operativa. Soltanto questo file e il registro §5 alla consegna dell'analisi.

**Baseline reale:** `pnpm check` exit 0, **17 suite / 207 test**; dati **0 errori / 23 warning** preesistenti (22 euristici B03 e G-0230), Biome 3 warning / 26 informazioni; 2 articoli validi. Log: `/private/tmp/b06-analysis-check.log`.

## 1. Stato verificato

### 1.1 R5 resta riproducibile

`src/pipeline/translations.ts` raccoglie gli oggetti localizzati con `it`, escludendo `provenance` e `review`. `sourceHash` calcola i primi 16 caratteri esadecimali di SHA-256 di `JSON.stringify` dell'array dei testi italiani, nell'ordine di attraversamento. `translationProblem` controlla presenza dello stato, completezza dell'inglese e corrispondenza di quel solo hash.

Su una copia in memoria di `G-0041`, sostituire soltanto `caveat.en` con `Convicted by a UK court`, mantenendo `caveat.it: MI5 Interference Alert`, produce:

```text
source_hash: 5017811b017a7881 (invariato)
translationProblem: null
validateDataFiles: 0 errori
```

Il difetto non è una mancanza di traduzioni: gli oggetti inglesi sono completi. La modifica non autorizzata passa perché manca un'impronta del testo di arrivo. Un secondo hash rileva la modifica rispetto all'import, **non** la fedeltà semantica né l'identità di chi lo ha ricalcolato. Anche i campi non localizzati (predicati, date strutturate, livello probatorio) restano fuori dall'impronta.

### 1.2 Superficie reale della migrazione

| Collezione | Record | Con testi / stato EN | Testi bilingui |
| --- | --- | --- | --- |
| events | 181 | 181 | 870 |
| entities | 220 | 220 | 220 |
| relationships | 458 | 380 | 380 |
| hypotheses | 32 | 32 | 96 |
| sources | 106 | 106 | 106 |
| exposures | 14 | 14 | 75 |
| Totale canonico | **1.011** | **933** | **1.747** |

Tutti i 933 stati delle traduzioni sono `machine`, con `source_hash` valido. Le altre 78 relazioni non hanno testi localizzati né stato EN: non devono ricevere uno stato fittizio. Non risultano traduzioni parziali nel corpus attuale.

**Fonte di impatto aggiuntivo:** `TranslationState` è condiviso dagli articoli, sia nel front matter inglese sia nell'articolo assemblato. `validateArticleFiles` chiama la stessa `translationProblem`. Anche l'aggiunta di una frase solo al corpo di `ART-0001.en.md`, su copia in memoria, produce **0 errori**. Entrambi gli articoli attuali hanno tre testi (titolo, sommario, corpo), completi e `machine`.

Rendere obbligatorio il nuovo campo nello schema condiviso richiede quindi **933 JSON e 2 front matter EN**, non soltanto `data/`. Una modifica limitata ai record, lasciando invariato il modello degli articoli, richiederebbe separare esplicitamente i contratti. Non va aggiunto un fallback opzionale permanente per far passare i file vecchi.

La proiezione B05 non modifica testi localizzati: filtra eventi/fonti e note, escluse dall'hash. Il nuovo hash rimane valido nelle ipotesi proiettate. Conteggi pubblici attuali: **147 / 202 / 433 / 22 / 55 / 14**; 138 trattenuti, 2 articoli pubblici. Il corpus pubblico contiene 1.496 testi bilingui canonici; i numeri storici dei rapporti A/D si riferiscono a perimetri e commit diversi.

### 1.3 L'import normale può rinnovare lo stato senza una traduzione

La CLI reale è **`src/cli/i18n.ts`**, non file separati `i18n-import.ts`/`i18n-export.ts`. Oggi:

1. applica le voci `{ italiano: inglese }` a ogni testo coincidente;
2. per **ogni** record già completo, anche non raggiunto dalla mappa, ricalcola `source_hash` e imposta lo stato richiesto;
3. non richiede che l'input fornisca la traduzione dell'intero record prima di rinnovarne l'attestazione.

**Riproduzione CLI su una copia isolata di TL-0001:** modificato soltanto il titolo italiano, mantenuto l'inglese e importata una mappa `{}` con lo stato predefinito `machine`.

```text
1 record(s) fully translated, 0 partially translated (not marked).
old source_hash: 175aeaefb9840bc0
new source_hash: a6d90fafb62fdd11
English unchanged: true
translationProblem after empty import: null
```

Nessun `reviewed` è stato impostato, nemmeno nella prova. Aggiungere semplicemente il secondo hash nello stesso ciclo consentirebbe a un import vuoto di attestare nuovamente anche inglesi modificati a mano. La migrazione una tantum è una scelta esplicita del manutentore; non deve diventare il comportamento ordinario di ogni import.

`i18n:export` esporta già tutti i testi di un record con problemi, deduplicati per italiano. È quindi possibile richiedere un input completo per record senza cambiare il formato del dizionario. Voci condivise fra record possono però creare corrispondenze parziali: il comportamento va deciso e documentato.

### 1.4 Articoli e autorità editoriale

`src/cli/articles-hash.ts` oggi stampa l'hash italiano di tutti gli articoli e, con `--write`, rinnova quello di tutti i front matter EN. Non prende un ID e non calcola l'inglese. Per lo schema condiviso deve essere aggiornato insieme agli articoli; il testo dei corpi e le dichiarazioni probatorie non vanno modificati.

AGENTS già riserva `--status reviewed` al revisore umano. Le CLI non autenticano chi le esegue; il diff severo segnala l'impostazione di `reviewed`, mentre l'identità separata e i vincoli GitHub restano il target B01. Aggiungere una variabile o un flag «sono umano» non sarebbe una verifica d'identità.

**Limite da non nascondere:** un attore che può cambiare testi e ricalcolare gli hash può ancora produrre una traduzione semanticamente errata ma coerente con le proprie impronte. Il diff segnala modifiche solo EN; non ogni modifica a una traduzione già `reviewed` è oggi un errore di transizione. L'approvazione verificabile degli articoli e la governance editoriale rimangono B09/B01. B06 non deve dichiarare risolto quel problema né impostare stati umani.

**Compatibilità del diff storico:** `src/pipeline/diff.ts` conserva il JSON grezzo quando lo schema della vecchia revisione non passa; `src/pipeline/article-diff.ts`, invece, lascia `was.en` nullo se il front matter storico non soddisfa lo schema corrente. Rendere target_hash obbligatorio farebbe fallire il parsing dei vecchi front matter EN nel lato base. Questo impatto futuro è dedotto direttamente dal ramo `safeParse` letto: va gestito nel solo lettore storico del diff, senza rendere facoltativo il nuovo campo nei file correnti o perdere le segnalazioni già introdotte in B02.

### 1.5 Glossario: prova del controllo letterale proposto

Simulazione di sola lettura sui 1.747 testi canonici più i 6 testi degli articoli. Applicate le quattro coppie esemplificative di D: `attribuzione → attribution`, `condanna → conviction`, `accertato → established`, `contestato → disputed|contested`, con confronto di parole IT senza distinzione maiuscole/minuscole.

| Termine IT | Testi che lo contengono | Senza il termine EN letterale |
| --- | --- | --- |
| attribuzione | 65 | 5 |
| condanna | 24 | 7 |
| accertato | 28 | 0 |
| contestato | 6 | 1 |

I 13 mancati riscontri **non sono 13 errori semantici accertati**. Esempi osservati: TL-0029 usa `attributed`; EXT-003 usa `convicted` e `sentence`; EXT-032 usa `challenged`/`contest` in un dissenso politico. Sono sufficienti a sconsigliare un errore CI basato sulla sola presenza del sostantivo. A §4.10 riscontrava analogamente differenze lessicali, senza cautele realmente perse, e dichiarava il limite del rilevatore.

Raccomandazione: glossario editoriale minimo versionato, con forme ammesse ed esempi contestuali; mantenere in B06 il controllo meccanico delle impronte come errore. Rimandare a B13 la pubblicazione in `vocabulary.json` e a una futura calibrazione l'eventuale controllo lessicale/marcatori. Non promettere qui il completamento integrale di D A12 («glossario rispettato su tutti i testi»).

## 2. Riproduzioni

Comandi dalla root del repository, senza scritture canoniche:

```bash
node --input-type=module <<'JS'
import { readDataFiles } from './src/pipeline/load.ts';
import { validateDataFiles } from './src/pipeline/validate.ts';
import { translationProblem } from './src/pipeline/translations.ts';
const files = readDataFiles().map(f => {
  if (f.path !== 'relationships/G-0041.json') return f;
  const r = JSON.parse(f.text);
  r.caveat.en = 'Convicted by a UK court';
  console.log(translationProblem(r)); // null
  return { ...f, text: JSON.stringify(r, null, 2) + '\n' };
});
console.log(validateDataFiles(files).issues.filter(i => i.severity === 'error').length); // 0
JS
```

Per l'import vuoto, la prova ha creato `/private/tmp/b06-i18n-repro/data/events/TL-0001.json` come copia del record, aggiungendo ` (modifica italiana di prova)` a `title.it`, e `/private/tmp/b06-i18n-repro/empty.json` con `{}`. Poi:

```bash
OEM_REPO_ROOT=/private/tmp/b06-i18n-repro node src/cli/i18n.ts import /private/tmp/b06-i18n-repro/empty.json
```

Il modulo della CLI è quello del repository; il path override limita tutte le scritture alla copia temporanea. Nessuna CLI di baseline/ingest è stata invocata.

## 3. Piano file per file, subordinato alle decisioni

### 3.1 Impronte e validazione

- **`src/model/schemas.ts`:** aggiungere `target_hash` obbligatorio a `TranslationState`, stesso formato esadecimale a 16 caratteri di `source_hash`. Stato `machine|reviewed` invariato. Nessun default che accetti silenziosamente stati senza hash di arrivo.
- **`src/pipeline/translations.ts`:** helper puro `targetHash`, sul medesimo ordine dei testi ma valori EN; preservare l'algoritmo di `sourceHash` e le impronte IT attuali. Completezza EN prima del confronto; errore distinto per italiano obsoleto e inglese modificato dopo l'import. Nessuna ricerca di parole nel calcolo, nessuna inclusione di review/provenance. Record senza testi e senza stato ancora validi; non attribuire uno stato a un record vuoto.
- **`src/model/article.ts`, `src/pipeline/articles.ts`:** aggiornare documentazione del contratto condiviso e helper per l'hash target dei tre testi EN; validazione degli articoli deve applicare entrambe le impronte. Conservare il parsing/normalizzazione già usato (corpo Markdown `.trim()`); l'hash riguarda i testi caricati, non tutti i byte del file o i campi YAML non testuali.
- **`src/pipeline/article-diff.ts`:** consentire al solo lato storico di leggere il vecchio front matter EN privo di target_hash, mantenendo tutti gli altri vincoli e il lato corrente strict. Non sintetizzare un hash o uno stato di revisione per la base; conservare confronto EN, source_hash e guardie reviewed. Riportare anche la variazione del nuovo metadato. Il fallback storico non deve entrare nella validazione ordinaria o nell'import.
- **`schemas/`:** rigenerare soltanto con `pnpm schemas`; atteso campo nelle sei collezioni e negli schemi degli articoli che incorporano TranslationState. Nessuna modifica al contratto sidecar o a fonti archiviate.

### 3.2 Import e comando articoli

- **`src/cli/i18n.ts`** e, se utile, piccolo helper puro di pianificazione in **`src/pipeline/`**: ricalcolare gli stati soltanto per record i cui testi sono tutti forniti con valori EN non vuoti dal dizionario corrente. Gli altri record non devono essere modificati, neppure nello stato; distinguere nel rapporto non raggiunti e corrispondenze parziali ignorate. Una mappa vuota è un no-op. Le corrispondenze complete continuano a sfruttare la deduplicazione per testo IT; lo stato predefinito resta `machine`.
- Pianificare e validare le scritture prima di applicarle; errori di input non devono causare una scrittura parziale. La verifica di freschezza avviene sui record risultanti. L'import completo è un'attestazione tecnica dei testi forniti, non un'approvazione di fedeltà semantica. Un record già completo può essere corretto solo EN mediante import esplicito e completo, senza cambiare il significato dell'italiano.
- **`src/cli/articles-hash.ts`:** stampa dei due hash in sola lettura; `--write` richiede uno o più ID articolo espliciti e tocca solo quelli, dopo il lavoro di traduzione. Non ripristinare automaticamente una traduzione `reviewed` diventata obsoleta: fallire e rinviare al revisore umano. Nessuna scrittura di `reviewed`. Aggiornare gli hash YAML preservando gli altri byte, senza sostituzioni regex ambigue su chiavi fuori da `translation`.
- **`package.json`:** aggiornare solo se serve il comando della migrazione; nessuna dipendenza nuova. Aggiornare help e documentazione delle CLI per la nuova selezione/copertura.

### 3.3 Migrazione controllata e una tantum

- **Nuovo comando dedicato**, ad esempio `src/cli/migrate-translation-hashes.ts`, dry run predefinito, scrittura solo con opzione esplicita approvata per questo blocco. Non usare `i18n:import {}` o `articles:hash --write` come migrazione generale.
- Leggere JSON e front matter legacy, verificare prima completezza EN, vecchio source_hash e stato effettivo; pianificare il solo `target_hash` mancante. Verificare il piano con i nuovi schemi/validatori prima delle scritture. Se esiste già un target_hash diverso, fermarsi: non correggerlo come fosse una migrazione mancante. Non aggiornare source_hash per nascondere italiano obsoleto.
- Scrivere solo i file pianificati, non sostituire intere cartelle con `writeDataFiles`. Nessuna scrittura se il preflight trova errori. Migrazione idempotente: seconda esecuzione zero cambiamenti. Il caso storico viene attestato come snapshot corrente `machine`, non come traduzione appena revisionata.
- **`data/` (933 JSON)**: aggiungere soltanto `review.translations.en.target_hash`. **`content/articles/ART-0001.en.md`, `ART-0002.en.md`**: aggiungere soltanto `translation.target_hash`; nessun cambiamento a titolo, sommario, corpo, riferimenti, link, date, stato o generatore. Eseguire poi `pnpm format:data` e verificare l'assenza di ulteriori cambiamenti.
- Confronto automatico prima/dopo rimuovendo il solo nuovo campo: deve risultare uguaglianza completa su ogni record e sugli articoli; verificare anche gli hash dei byte di tutti i file immutabili. Conservare i 78 JSON senza testi byte per byte.

### 3.4 Glossario e documentazione

- **Nuovo `docs/TRANSLATION_GLOSSARY.md`:** guida minima IT/EN per attribuzione istituzionale, accertato, contestato, presunto, non dimostrato/non implica, condanna/condanna in primo grado e stato del procedimento. Varianti grammaticali e ambiguità contestuali esplicite; non confondere accusa, sentenza e definitività. Nessuna rettifica automatica dei testi esistenti.
- **`AGENTS.md` §Translations**, **`docs/ARCHITECTURE.md`** (modello, comandi, validazione), **`README.md`** (tracciamento import): doppia impronta, responsabilità umana, selezione/copertura degli import, migrazione e limiti.
- **`docs/M6_CHATGPT_OSINT_WORKFLOW.md`** (Article contract, esempio EN e workflow bilingue), **`content/articles/README.md`** se contiene esempi: inserire target_hash nel contratto condiviso e aggiornare `articles:hash`. È allineamento della forma, non implementazione delle transizioni editoriali B09; nessuna modifica ai task ChatGPT esterni.
- **Questo file, `IMPLEMENTATION_BLOCKS.md` §5:** decisioni dopo approvazione, esiti reali e chiusura; fissare l'hash B05 `66a8b86` nella riga precedente.

## 4. Test e accettazione

| Prova | Esito richiesto |
| --- | --- |
| R5: solo EN cambia in G-0041 | Errore di hash target, italiano/source_hash invariati |
| Solo IT cambia | Errore di source_hash come oggi |
| EN incompleto, stato mancante, target_hash mancante o malformato | Errore esplicito; nessuna accettazione legacy ordinaria |
| Hash deterministici e perimetro | Cambi a note/provenance non cambiano gli hash; testi EN li cambiano; source_hash correnti invariati |
| Corpo/titolo/sommario EN articolo modificato | Errore; hash IT invariato; validità dopo import/attestazione esplicita |
| Diff con base EN precedente al nuovo campo | Legge ancora il lato storico e segnala edit solo EN, variazioni hash e transizioni reviewed; target_hash assente nel lato corrente rimane un errore |
| Import vuoto su record obsoleto | Zero scritture, nessun rinnovo dello stato; errore di freschezza ancora rilevabile |
| Input completo per un solo record | Aggiorna testi e due hash soltanto per i record interamente coperti; altri stati invariati |
| Dizionario con sovrapposizioni parziali | Record parzialmente raggiunti lasciati identici e riportati; nessun hash rinnovato di nascosto |
| Input invalido o articolo ID assente | Non scrive alcun file, fallisce con diagnosi |
| Stato reviewed preesistente e testi obsoleti | Hash CLI non rinnova automaticamente l'attestazione umana; agente non imposta reviewed |
| Migrazione una tantum | Dry run 933 JSON + 2 EN; preflight fallisce su italiano stale o target già discordante; seconda applicazione no-op |
| Metadati soltanto | Tolto target_hash, canonico e articoli identici prima/dopo; 78 JSON senza testi e fonti immutabili byte-identici |
| Pubblicazione | Conteggi 147/202/433/22/55/14, 138 trattenuti e due articoli invariati; grafo, timeline e testi resi invariati; export acquisiscono solo il nuovo metadato |

Ampliare `test/validate.test.ts`, `test/articles.test.ts`, fixture di `test/article-diff.test.ts`; aggiungere test mirati dei helper di impronta/import/migrazione e integrazione CLI su radice temporanea. Il test dell'import deve provare scritture effettive e i no-op, non solo una funzione hash isolata. Nessun test deve modificare `data/` nel checkout o impostare stati umani nei file reali.

Controlli prima della chiusura: `pnpm format:data`, `pnpm schemas`, `pnpm check`, `pnpm audit:publication`, `pnpm data:diff` severo (gli attention sulle persone per il solo metadato non sono errori e non vanno aggirati), più `pnpm build` e `pnpm check:links` perché cambiano schemi/export e modello condiviso del sito. Controllo browser di una pagina EN e di entrambi gli articoli per gli avvisi `machine`; nessuna modifica UI è pianificata. Sol verifica il diff e ripete `pnpm check` prima del singolo commit; nessun push.

## 5. Rischi e limiti

1. **Diff voluminoso:** 935 file di contenuto per un solo campo. Occorre una prova meccanica del perimetro, non una lettura manuale a campione; nessuna opportunità di pulizia editoriale aggiunta.
2. **Migrazione come fotografia:** le nuove impronte attestano i testi correnti, non sanano difetti semantici precedenti. Tutti restano `machine`; nessun source_hash deve essere rinnovato dalla migrazione.
3. **Contratto condiviso:** omettere gli articoli renderebbe il sito non costruibile oppure lascerebbe un percorso senza protezione. B09 conserva la responsabilità delle approvazioni, B06 quella delle impronte.
4. **Compatibilità:** l'export v1 riceve un campo additivo, ma un consumatore che valida con una vecchia copia dello schema strict dovrà aggiornare lo schema. I vecchi checkout restano riproducibili con i propri schemi; nessun cambio di ID o forma del testo. Catalogo/versionamento generale resta B13.
5. **Copertura dell'import:** la scelta di non salvare traduzioni parziali cambia il comportamento corrente. Deve essere approvata e documentata; il formato deduplicato resta identico.
6. **Integrità, non autenticità:** due hash possono essere ricalcolati da chi modifica il file. I controlli aiutano a rilevare edit accidentali e a rendere esplicita l'attestazione, senza sostituire revisione e separazione delle identità.
7. **Glossario non è un giudice:** regole lessicali possono confondere forme verbali e stati procedurali. Nessuna classificazione o traduzione automatica viene autorizzata da questa analisi.

## 6. Decisioni aperte per il manutentore

| ID | Scelta | Raccomandazione |
| --- | --- | --- |
| **D-B06-1 / ADR-07** | Autorità: (a) mantenere `reviewed` esclusivo del revisore umano, `machine` per gli agenti, senza introdurre un falso controllo di identità via flag; (b) rimuovere `--status reviewed` dalla CLI e usare soltanto un workflow umano separato da progettare | **(a)**. La regola esistente resta vincolante; i comandi automatici non rinnovano traduzioni reviewed obsolete. B01/B09 restano responsabili dell'approvazione verificabile |
| **D-B06-2** | Contratto e migrazione: (a) target_hash obbligatorio nel modello condiviso, migrazione metadati di 933 JSON e 2 EN, preservando source_hash/stati/testi; (b) limitarsi ai record, separando temporaneamente il contratto degli articoli e rinviando il relativo difetto | **(a)**. Approvazione esplicita delle scritture di migrazione e dei due front matter; nessuna promozione di stato né re-traduzione. Campo additivo nell'export v1 |
| **D-B06-3** | Attestazione ordinaria: (a) import solo dei record interamente coperti dall'input, parziali ignorati e riportati, import vuoto no-op; hash articoli in scrittura solo per ID espliciti; (b) conservare l'import parziale salvando stati incompleti e richiedendo un secondo comando esplicito di completamento | **(a)**. Evita rinnovi impliciti e limita il cambiamento a un solo passaggio; documentare la differenza rispetto al workflow corrente |
| **D-B06-4** | Glossario: (a) guida editoriale minima versionata, senza controllo lessicale CI in questo blocco; (b) avvisi automatici subito, con falsi allarmi da calibrare; (c) termini obbligatori come errori subito | **(a)**. Le impronte sono errori; glossario con contesto e varianti. Parità dei marcatori rinviata; vocabulary.json resta B13. D A12 è completato per la rilevazione degli edit EN, non per una garanzia semantica automatica |

**Stato alla consegna dell'analisi:** analisi conclusa; approvazione successiva registrata nel §7.

## 7. Decisioni del manutentore (15 novembre 2026)

Il manutentore ha risposto «Procedi» alla richiesta esplicita di approvare le quattro raccomandazioni, autorizzando implementazione e chiusura B06.

- **D-B06-1: (a).** `reviewed` rimane esclusivo del revisore umano; gli agenti usano `machine`. Nessun rinnovo automatico delle impronte di traduzioni umanamente revisionate ma obsolete e nessun falso controllo d'identità tramite flag.
- **D-B06-2: (a).** `target_hash` obbligatorio nel modello condiviso; autorizzata la migrazione dei soli metadati di **933 JSON e 2 front matter EN**, senza cambiare testi, source_hash, stati o contenuto editoriale. L'export v1 riceve il campo additivo.
- **D-B06-3: (a).** Import dei soli record interamente coperti dal dizionario corrente; corrispondenze parziali ignorate e riportate, import vuoto senza effetti. La scrittura degli hash articoli richiede ID espliciti.
- **D-B06-4: (a).** Glossario editoriale minimo versionato; nessun controllo lessicale automatico in questo blocco. Parità dei marcatori rinviata; pubblicazione in vocabulary.json separata in B13.

Implementazione GPT-6.1 Terra · medio; verifica finale indipendente Sol. Nessuna autorizzazione al push.

## 8. Implementazione e verifiche finali (15 novembre 2026)

**Esito tecnico:** applicate D-B06-1…4. `target_hash` è obbligatorio nello stato condiviso delle traduzioni; gli edit del solo inglese vengono rifiutati sia sui record sia sugli articoli. L'algoritmo e tutte le impronte source_hash precedenti sono invariati. Il diff articoli legge il vecchio front matter soltanto sul lato storico, mantenendo strict il lato corrente.

L'import ordinario pianifica le scritture prima di applicarle, aggiorna soltanto i record completamente coperti dal dizionario e lascia invariati quelli non raggiunti o parziali. Una mappa vuota non rinnova gli stati. `articles:hash` stampa entrambe le impronte e richiede ID espliciti per scrivere; una traduzione reviewed obsoleta non viene rinnovata automaticamente. Glossario editoriale aggiunto, senza controlli lessicali automatici. Aggiornati AGENTS, README, architettura, contratto M6 e README degli articoli.

**Migrazione autorizzata D-B06-2:** dry run iniziale **935 file**, poi scrittura dei soli target_hash in **933 JSON e due front matter EN**. Seconda esecuzione: **0 file**; `pnpm format:data`: **0 file**; schemi generati con `pnpm schemas`. Il migratore verifica completezza, source_hash e conflitti target, quindi valida il piano intero con `validateDataFiles` e `validateArticleFiles` prima di scrivere. Il test dell'errore referenziale globale usa un ID fonte valido ma inesistente (`S99`), controllando diagnosi e zero scritture.

**Verifica indipendente Sol:** letti diff del codice/test/documentazione e i nuovi file non tracciati; eseguito confronto meccanico con `/private/tmp/b06-before.json` tramite `/private/tmp/b06-verify.mjs`. Tolto il solo nuovo campo, tutti i record e articoli sono identici. I **78 JSON senza testi** sono identici byte per byte; inventario e SHA-256 dei **20 file sources/** sono invariati. Nessuna modifica a testi, source_hash, stati di record o traduzioni, provenance, link o date. Grafi delle relazioni e delle ipotesi, timeline, contenuti degli articoli e intera proiezione pubblica sono invariati, salvo il nuovo metadato di traduzione.

| Verifica | Risultato reale |
| --- | --- |
| `pnpm check`, Terra e ripetizione Sol | **exit 0**, 18 suite / **213 test**; dati 0 errori / **23 warning** preesistenti; Biome 3 warning / 26 informazioni preesistenti |
| `pnpm audit:publication` | **exit 0**, pubblici **147 / 202 / 433 / 22 / 55 / 14**, 138 trattenuti, due articoli pubblici |
| `pnpm build`, Terra e Sol | **exit 0**, 885 pagine; nessun cambiamento dei testi resi previsto |
| `pnpm check:links`, Terra e Sol | **exit 0**, **165.755** link interni, 0 problemi |
| `pnpm i18n:migrate-hashes`, Sol sul risultato finale | **exit 0**, 0 file pianificati, dry run |
| R5 indipendente Sol su copie in memoria | Un edit EN di G-0041 produce un errore target_hash con source_hash IT invariato; edit EN di titolo/sommario/corpo rifiutati su entrambi gli articoli |
| HTTP sulla build locale | Byte e SHA-256 corrispondenti per tutti i download del manifest; target_hash presente negli **800 record pubblici con stato EN**, tutti ancora machine |
| Browser | H08 EN e ART-0001/ART-0002 EN mantengono gli avvisi di traduzione machine; screenshot osservato dell'articolo; nessun errore console osservato. Server temporaneo arrestato |
| `git diff --check` | Pulito |
| **`pnpm data:diff` severo, Terra e Sol** | **exit 1**, **due errori**: modifiche ad ART-0001 e ART-0002 già reviewed, causate dalle sole aggiunte target_hash; 933 record modificati, nessun aggiunto/rimosso; 45 attention persone e 2 attention target_hash articoli |

### 8.1 Esito non verde del diff probatorio

La previsione nel piano §4 era incompleta: le traduzioni dei due articoli sono machine, ma i rispettivi articoli canonici sono già reviewed. Il controllo B02 vieta qualunque modifica ai loro file, anche un metadato tecnico. Il fallback storico introdotto in B06 conserva correttamente questa guardia: non si deve escludere target_hash dal controllo per far passare la migrazione.

Le due modifiche sono esattamente quelle autorizzate dal manutentore in **D-B06-2**, senza variazioni di contenuto o di stato. Si procede quindi al singolo commit **locale** autorizzato, riportando l'errore reale. **Nessuna modifica o deroga alla guardia, nessun uso di `--relaxed`, nessuna etichetta applicata.** Il ramo non ha per questo un evidence-diff verde e non viene dichiarato pronto al merge: la gestione editoriale della PR finale rimane al manutentore secondo il protocollo del programma. Questa approvazione di lavoro locale non è una deroga CI né una review GitHub.

Log Sol: `/private/tmp/b06-sol-check.log`, `b06-sol-build.log`, `b06-sol-links.log`, `b06-sol-publication.log`, `b06-sol-data-diff.log`. Snapshot e script di confronto sono evidenze locali temporanee, non dipendenze del repository.

**Limiti confermati:** gli hash non certificano fedeltà semantica, revisione umana o identità; glossario non verificato automaticamente, parità marcatori rinviata. Nessuna dipendenza, schema sidecar, fonte immutabile o impostazione remota modificata; nessun ingest, stato umano impostato, push o PR. Review separata non prescritta per B06: verifica dell'orchestratore eseguita, incluse correzione del preflight globale e prova referenziale non vacua.

**Commit di chiusura:** `fix(i18n): track source and target translation hashes`. La riga §5 identifica questo stesso commit tramite il soggetto; il suo hash viene fissato dal log al successivo handoff, perché incorporarlo nel commit ne cambierebbe l'hash. Prossimo blocco raccomandato: **B08**.
