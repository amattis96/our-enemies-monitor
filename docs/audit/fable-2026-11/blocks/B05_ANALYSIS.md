# B05 — Ipotesi trattenute e registro dei trattenuti · Analisi

- **Blocco:** B05 (CF-012). Fonti: FABLE_A §4.3, §7.3, P1/E3; FABLE_D §3/T5, §11.5/A4; FABLE_B R19; CONSOLIDATED_FINDINGS §3 e ADR-03/ADR-09.
- **Base verificata:** ramo locale `audit/fable-2026-11-implementation` @ `0ab3a81ed6aef08bf07fa35e4eceec33573ff449`, dopo B07. Fa fede il ramo unico committato, non uno stato remoto presunto.
- **Data:** 15 novembre 2026, Europe/Rome. GPT: analisi Sol; implementazione prevista Terra, sforzo alto; review indipendente Sol prima della chiusura.
- **Ingresso:** working tree pulita, ramo corretto senza upstream, nessuna operazione Git in corso. B05 è il primo blocco non committato nella sequenza raccomandata; nessun file B05 precedente o WIP nei 15 commit letti. Nessun accesso GitHub, push o cambiamento di impostazioni.
- **Perimetro della fase:** lettura e simulazioni su copie in memoria. Il baseline importer è stato chiamato come funzione di sola lettura per il confronto, come nei test esistenti; nessuna esecuzione della CLI di import, nessuna scrittura del dataset. Soltanto questa analisi e l'aggiornamento del registro alla consegna dello step.

**Verifica iniziale:** `pnpm check` exit 0: **17 suite, 202 test**, dati **0 errori e 23 warning** (22 euristici B03 e `G-0230`); 3 warning e 26 informazioni Biome preesistenti. Nessuna implementazione B05 avviata.

---

## 1. Stato verificato

### 1.1 La causa delle 11 ipotesi trattenute

`src/site/publication.ts` applica lo stesso `linked` a relazioni e ipotesi: gli estremi e **tutti** gli eventi devono essere pubblici. Per le ipotesi questa scelta rende contagiosa l'aggiunta di un evento candidato.

| Ipotesi storica | Eventi non pubblici collegati |
| --- | --- |
| H02 | EXT-024 |
| H08 | EXT-025 |
| H10, H11, H12 | EXT-019 |
| H13 | EXT-021 |
| H16 | EXT-027 |
| H17 | EXT-026 |
| H19 | EXT-017 |
| H20 | EXT-017, EXT-018 |
| H21 | EXT-024 |

Su tutte e 11:

- `review.status` è `imported_unreviewed` e la provenienza originale è presente;
- entrambi gli estremi sono pubblici;
- domanda, limite e prove richieste **in italiano sono identici alla baseline originale**;
- soggetto, oggetto, tipo, priorità, riferimento esterno e stato dell'ipotesi sono anch'essi invariati;
- Fonte_09 ha aggiunto eventi, fonti e note di revisione; i testi inglesi sono le traduzioni correnti, marcate `machine`.

Il controllo è stato esteso a tutte le 22 ipotesi storiche: nessuna differenza nei testi italiani o nei campi strutturali indicati. L'uguaglianza attesta la continuità della baseline, non la verità dell'ipotesi o una revisione umana.

`H19` e `H20` nella baseline hanno lista eventi vuota; tutti i loro eventi attuali sono candidati. Una proiezione dei soli eventi pubblici le riporterebbe a `events: []`, senza inventare collegamenti.

La rimozione non deve essere estesa alle relazioni: `G-0394`–`G-0398` e `G-0401`–`G-0405` hanno un estremo evento non pubblico e restano correttamente trattenute; `G-0230` resta esclusa per l'assenza del riferimento primario.

### 1.2 Filtrare soltanto `events` espone anche gli arricchimenti

Tutte le 11 ipotesi hanno una nota inglese di Fonte_09 che riassume sviluppi non revisionati, e riferimenti aggiunti a fonti incrementali. Esempi osservati:

- `H08`: la nota esplicita che l'ipotesi originale non cambia, ma descrive l'appello G7 alla ridondanza satellitare; fonti aggiunte `S09`, `WEB-EXT-040`.
- `H10`–`H12`: nota sulla sentenza Fitburg come precedente distinto; nuovi riferimenti `WEB-EXT-028/029`.
- `H20`: la nota descrive accuse e una presunta catena HAYI/IRGC; non è una conclusione giudiziaria. Fonti aggiunte `WEB-EXT-025/026/027/054` oltre a `S09`.

`RecordFooter.astro` rende **tutte** le `review.notes`; `exportFiles` serializza i record proiettati integralmente. Ripristinare l'ipotesi senza sanitizzare la proiezione porterebbe quindi queste note sia nelle pagine sia nei JSON. Non basta nasconderle nel template o escluderle da Pagefind.

**Fatto ulteriore verificato:** `H15`, già pubblica, contiene una nota Fonte_09 e cita `S09`. È l'unico record della proiezione pubblica corrente che cita `S09`. La protezione non va limitata agli 11 ID ripristinati o alle note che iniziano con una stringa particolare: il contenuto non è tipizzato per revisione o origine.

Una simulazione che filtra soltanto gli eventi fa salire le fonti pubbliche da 56 a **69**, aggiungendo 13 metadati di fonte `WEB-EXT-*`. La policy M5 consente già i metadati `needs_review` citati da un record pubblico, ma questa espansione non coincide con il ripristino della sola ipotesi storica.

### 1.3 Simulazione di una proiezione storica conservativa

Proposta da approvare, senza modificare i record canonici:

1. Le ipotesi storiche `imported_unreviewed` devono avere un proprio originale Fonte_07 identificabile e coincidente nei testi italiani e nei campi strutturali (§1.1).
2. Conservare soltanto i link a eventi pubblici.
3. Conservare soltanto i codici fonte appartenenti al `source_docs` del proprio originale e ancora presenti nel record canonico; non aggiungere automaticamente una citazione rimossa dall'editor.
4. Proiettare `review.notes: []` per le ipotesi storiche non revisionate, compresa `H15`; mantenere stato, traduzioni e provenienza reali. Nessuna ricerca per prefisso nelle note.
5. Conservare le altre restrizioni B03 e gli estremi pubblici. Un testo italiano o campo semantico cambiato rispetto alla baseline non riceve questa continuità automaticamente: resta trattenuto, con una ragione esplicita, finché interviene una decisione editoriale. Non ripubblicare una versione vecchia inventata o ignorare una rettifica deliberata.

Per una futura ipotesi effettivamente `reviewed`, l'approvazione del record rimane l'autorità sul suo contenuto: la sola aggiunta di un link candidato non deve farla scomparire, ma gli estremi e i riferimenti pubblicati restano soggetti al gate. Questa analisi non imposta alcuno stato `reviewed`.

| Collezione | Canonici | Pubblici attuali | Simulazione proposta | Trattenuti nella simulazione |
| --- | --- | --- | --- | --- |
| events | 181 | 147 | 147 | 34 |
| entities | 220 | 202 | 202 | 18 |
| relationships | 458 | 433 | 433 | 25 |
| hypotheses | 32 | 11 | **22** | **10** |
| sources | 106 | 56 | **55** | **51** |
| exposures | 14 | 14 | 14 | 0 |
| Totale | 1.011 | 863 | **873** | **138** |

La differenza delle fonti è intenzionale: il record canonico `S09` è `needs_review` e non sarebbe più citato nella proiezione ripulita; non viene pubblicato autonomamente. Le fonti storiche necessarie alle 11 ipotesi sono già tutte pubbliche. Nessun nuovo metadato candidato viene esposto. Il Markdown Fonte_09 continua nell'archivio documentario: quel catalogo è distinto dal record canonico `data/sources/S09.json` e non viene modificato.

Il grafo delle ipotesi passerebbe da 11 a 22 archi, sempre E5 e separato; eventi, timeline e grafo delle relazioni resterebbero invariati. La simulazione conserva anche entrambi gli articoli pubblici (`ART-0001`, `ART-0002`); nessuno dei due cita `S09`. Non si aggiungono i link mancanti di ART-0002: è B09.

### 1.4 Audit e visibilità dei trattenuti

Attualmente `audit:publication` stampa conteggi, stati e i due elenchi sulle fonti primarie delle persone, ma non una riga per ogni record assente. Gli assenti correnti sono **148**: 34 eventi, 18 entità, 25 relazioni, 21 ipotesi, 50 fonti.

Il manifest non ha conteggi dei trattenuti o un riferimento a un registro. `H08` non è nel read model; la sua pagina non è generata (`web/dist/hypotheses/H08/index.html` assente, `H06` presente nella build B07). L'effetto 404 deriva anche dal `getStaticPaths` basato soltanto sulle ipotesi pubbliche.

ADR-09 richiede una decisione esplicita, non una scelta automatica del tecnico. Il consolidamento raccomanda come default i soli aggregati; D A4 propone invece una riga pubblica per ID, senza contenuto. Fra le 18 entità oggi trattenute ci sono **5 entità di tipo persona**. Anche un registro senza nomi estesi rende più facilmente individuabili i loro ID e va autorizzato.

**Raccomandazione sottoposta al manutentore:** per soddisfare integralmente D A4, pubblicare `data/v1/withheld.json` con i soli campi `{ id, collection, reasons }`, più aggregati nel manifest. `reasons` contiene codici generici stabili, non testo libero, nomi, estremi, predicati, titoli, URL, note o dettagli delle prove. Non includere gli ID collegati che hanno causato l'esclusione. Il CLI locale può conservare un rapporto più diagnostico, senza diventare la sorgente del JSON pubblico.

L'alternativa conservativa è pubblicare soltanto aggregati e tenere la lista per ID nel CLI. In quel caso D A4 **come endpoint pubblico** resta esplicitamente rinviato: non va dichiarato soddisfatto. Una pagina segnaposto per ogni ID, al posto del 404, è una decisione ulteriore e non necessaria se il registro JSON è pubblico.

### 1.5 Il contesto canonico va conservato per i conteggi

`web/src/lib/model.ts` restituisce già una proiezione pubblica. Oggi la route generica JSON, la route manifest e `/data/` passano quel dataset a `exportFiles`/`buildManifest`. Se si calcolasse la differenza canonico–pubblico da quell'input, il registro dei trattenuti risulterebbe **vuoto**.

Serve quindi un risultato di pubblicazione condiviso, generato dal dataset canonico validato e conservato nel modulo server. Deve fornire dataset pubblico, ragioni delle esclusioni e dettagli delle proiezioni. Tutti i consumer pubblici devono usare lo stesso risultato; i contenuti canonici non proiettati non devono passare nelle props delle isole, nei template o nel nuovo registro.

---

## 2. Riproduzione indipendente

Da `/Users/antoniomattis/dev/our-enemies-monitor`; l'import è una funzione in memoria, non il comando CLI:

```bash
node --input-type=module <<'JS'
import { readDataFiles } from './src/pipeline/load.ts';
import { validateDataFiles } from './src/pipeline/validate.ts';
import { importBaseline } from './src/pipeline/baseline/import.ts';
import { publishedDataset } from './src/site/publication.ts';
const raw = validateDataFiles(readDataFiles()).dataset;
const visible = publishedDataset(raw);
const base = new Map(importBaseline().hypotheses.map(h => [h.id, h]));
const eventIds = new Set(visible.events.map(e => e.id));
const nodeIds = new Set([...visible.events, ...visible.entities].map(r => r.id));
const missing = raw.hypotheses.filter(h => h.review.status === 'imported_unreviewed'
  && !visible.hypotheses.some(p => p.id === h.id));
for (const h of missing) {
  const old = base.get(h.id);
  console.log(h.id, {
    withheldEvents: h.events.filter(id => !eventIds.has(id)),
    publicEndpoints: nodeIds.has(h.subject) && nodeIds.has(h.object),
    sameItalian: ['question', 'current_limit', 'evidence_needed'].every(k => h[k].it === old[k].it)
  });
}
for (const mode of ['eventsOnly', 'historicalProjection']) {
  const copy = structuredClone(raw);
  for (const h of copy.hypotheses) {
    const old = base.get(h.id);
    if (!old) continue;
    h.events = h.events.filter(id => eventIds.has(id));
    if (mode === 'historicalProjection') {
      h.sources = h.sources.filter(id => old.sources.includes(id));
      h.review.notes = [];
    }
  }
  const projected = publishedDataset(copy);
  console.log(mode, {
    hypotheses: projected.hypotheses.length,
    sources: projected.sources.length,
    h19Events: projected.hypotheses.find(h => h.id === 'H19').events,
    h20Events: projected.hypotheses.find(h => h.id === 'H20').events
  });
}
JS
```

Esito osservato: gli 11 ID del §1.1 hanno estremi pubblici e italiano invariato; `eventsOnly` → **22 ipotesi, 69 fonti**; `historicalProjection` → **22 ipotesi, 55 fonti**, H19/H20 senza link evento. La simulazione non implementa un gate nuovo né modifica alcun file in `data/`.

---

## 3. Piano file per file, subordinato alle decisioni

### 3.1 Un solo calcolo di pubblicazione

- **`src/site/publication.ts`:** estrarre un risultato tipizzato, ad esempio `publicationReport(dataset, references)`, che calcola una volta proiezione, elenco di tutti gli ID trattenuti, aggregati e dettagli locali dei campi omessi dalle ipotesi pubblicate. `publishedDataset` resta disponibile come wrapper che restituisce soltanto il dataset pubblico. Nessuna duplicazione autonoma delle regole nel CLI o nel manifest.
- **Nuovo helper puro `src/site/hypothesis-publication.ts`, se utile:** leggere l'originale dalla provenienza già validata, vincolando file originale delle ipotesi, tipo riga e `original.id` allo stesso record. Confrontare domanda/limite/prove italiane, estremi, tipo, priorità (con il vocabolario già esistente), stato e URL esterno. Non chiamare l'importer in produzione, non caricare uno snapshot ricavato da un commit remoto e non basarsi sul testo delle note.
- Applicare la proiezione storica approvata a tutte le ipotesi `imported_unreviewed` idonee, non a una lista codificata di 11 ID; mantenere traduzioni/provenienza/stato e l'immutabilità dell'input.
- Per le ipotesi eleggibili mantenere gli estremi pubblici, filtrare solo gli eventi effettivamente esistenti ma non pubblici, senza rendere pubblici quei record. Un riferimento inesistente non è un candidato valido da nascondere: la validazione continua a fallire.
- Conservare senza modifiche la regola forte per gli eventi e per le relazioni, incluse le persone e le fonti baseline invalide introdotte in B03. Le citazioni originali mantenute devono ancora soddisfare l'integrità referenziale.
- Rendere osservabili separatamente record trattenuti e **campi proiettati di record pubblici**: H08 ripristinata non è un record trattenuto, anche se ha un link candidato e note omessi.

### 3.2 Ragioni strutturate e audit locale

- **`src/cli/audit-publication.ts`:** consumare il risultato condiviso; mantenere conteggi/stati e chiavi esistenti sui riferimenti primari. Aggiungere una riga per ogni ID canonico assente, e dettagli locali delle proiezioni delle ipotesi (ID, link/fonti omessi, numero di note omesse), senza stampare le note o i testi dei candidati.
- Ragioni tipizzate e ordinate stabilmente, per esempio: `needs_review`, `missing_original_provenance`, `pending_integration`, `withheld_endpoint`, `withheld_event`, `invalid_source`, `person_primary_missing`, `person_primary_unregistered`, `legacy_hypothesis_changed`, `uncited_source_metadata`. Registrare le condizioni applicabili, non un catch-all che nasconda un caso non implementato.
- La copertura deriva dalla differenza effettiva fra ID canonici e ID pubblicati: una riga esatta per ogni assente, nessuna riga per record pubblico, nessun assente senza ragione. Se più condizioni sono vere, `reasons` può contenerle tutte; gli aggregati contano record, non sommano le ragioni sovrapposte.
- Per una fonte `needs_review` distinguere l'assenza perché non citata nella proiezione dal caso in cui i metadati siano trattenuti per un dato invalido. Il CLI non deve presentare come sottoposto a revisione un record automaticamente approvato.

### 3.3 Contesto server e catalogo pubblico

- **`web/src/lib/model.ts`:** conservare il risultato di pubblicazione ottenuto dal canonico validato in una cache server dedicata, esponendo `getPublication()`; `getModel()` indicizza soltanto `result.dataset`. Il risultato condiviso non contiene record canonici esclusi come contenuto pubblico.
- **`src/site/exports.ts`:** consentire ai builder di usare il risultato già calcolato, oltre al dataset canonico nelle API esistenti. Un tipo distinto/discriminabile evita di scambiare un dataset già filtrato per un report completo. Il percorso web deve passare il report autorevole, non ricostruire i trattenuti da `getModel().dataset`.
- Se ADR-09 approva il registro pubblico: `withheld.json` contiene un'allowlist di **soltanto** `id`, `collection`, `reasons`; aggiungerlo a `exportFiles` e quindi alla route generica e alla tabella download. Nessun riciclo delle righe ricche dell'attuale audit persone (che contengono soggetto/predicato/oggetto).
- Manifest: campo additivo `withheld` con i sei conteggi e, se approvato, riferimento al registro; conteggi pubblici esistenti restano distinti. Dimensioni e hash del nuovo file derivano dai byte effettivamente serviti. Versione `v1` invariata; nessuna modifica agli schemi dei record canonici.
- **`web/src/pages/data/v1/[file].json.ts`, `manifest.json.ts`, `web/src/pages/[...lang]/data.astro`:** usare lo stesso report nella generazione degli export e del manifest. Nessun passaggio di record candidati a componenti client o props serializzate.
- Il registro riguarda le sei collezioni canoniche, non gli articoli o l'archivio Markdown. Il gate degli articoli continua a usare la medesima proiezione per i propri link.

### 3.4 Pagine e documentazione

- **`web/src/pages/[...lang]/hypotheses/[id].astro`:** avviso bilingue per la baseline provvisoria: gli aggiornamenti non revisionati non sono mostrati, i link visualizzati riguardano solo eventi pubblici. Non mostrare ID/fonti/note omessi nella pagina, neppure in metadati, attributi o dati Pagefind. Nessun campo canonico `pending_events` in questa opzione.
- **`web/src/pages/[...lang]/methodology.astro`, `data.astro`:** spiegare proiezione delle ipotesi e distinzione fra record trattenuto/inesistente; riportare i conteggi aggregati o il link al registro secondo ADR-09. Interfaccia e testo in entrambe le lingue, componenti e token esistenti.
- **404:** mantenere il comportamento attuale salvo decisione diversa. Se si scelgono segnaposto, serviranno route disgiunte per gli ID reali trattenuti, senza props del record e senza indicizzazione del contenuto; questa estensione non è raccomandata in B05.
- **`docs/ARCHITECTURE.md`, `docs/M5_EVIDENCE_AUDIT.md`, `README.md`, `AGENTS.md` §Publication gate:** aggiornare la policy, l'audit, il contratto degli aggregati/registro, i limiti di visibilità e gli eventuali conteggi pubblici. Non descrivere il ripristino come approvazione o promozione a relazione.
- **`IMPLEMENTATION_BLOCKS.md` §5, questo file:** decisioni, esiti reali e commit; fissare l'hash B07 già noto `0ab3a81` nella sua riga. Se il manutentore sceglie solo aggregati, dichiarare esplicitamente il rinvio della parte pubblica D A4 e non marcarla completata.

Nessuna modifica a `data/`, `sources/`, `provenance`, traduzioni canoniche, stati `reviewed`/`human_approved`, articoli, dipendenze, workflow CI o contratto sidecar. Nessuna esecuzione ingest in scrittura.

---

## 4. Piano di test e accettazione

| Prova | Esito richiesto se approvate le raccomandazioni |
| --- | --- |
| R19: aggiungere un candidato e collegarlo a un'ipotesi prima pubblica | L'ipotesi resta pubblica, il link candidato e il suo contenuto restano fuori; nessun record canonico mutato |
| Gli 11 ID del §1.1 | Tornano visibili; testi italiani identici agli originali, traduzioni con stato reale, eventi solo pubblici |
| H19/H20 | Visibili con `events: []`, senza eventi inventati |
| H15 | La nota Fonte_09 precedentemente visibile e la citazione incrementale non escono più tramite pagina, `hypotheses.json` o `all.json` |
| Note arbitrarie senza prefisso o con un marcatore falsificato | Non superano la separazione grazie al contenuto della stringa; nessun parsing semantico delle note |
| Fonti aggiunte a un'ipotesi storica non revisionata | Non vengono pubblicate per questo solo legame; fonti originali rimosse dall'editor non sono ricreate |
| Testo/struttura italiana diversa dall'originale | Quarantena con ragione esplicita; nessun ripristino automatico della vecchia proposizione |
| Estremo non pubblico, `needs_review`, provenienza assente | L'ipotesi resta trattenuta; le decisioni B03 non sono derogate |
| Relazioni verso eventi candidati e G-0230 | Restano escluse; grafo delle relazioni e timeline invariati |
| E5 | 22 ipotesi nella proiezione proposta; nessuna nuova relazione E1–E4 o promozione di stato |
| Registro | Differenza esatta canonico/pubblico su tutte le collezioni, nessun doppione o riga vuota di motivi; attesi 138 assenti nella simulazione |
| Riservatezza strutturale del registro | Test dell'allowlist dei tre campi; assenza di testi, nomi estesi, URL, note, estremi e ID collegati; controllo con fixture sentinella per ogni canale pubblico |
| Manifest nel sito reale | `withheld` non è tutto zero per perdita del contesto canonico; combacia con CLI e registro, hash/dimensione del download verificati |
| Idempotenza e immutabilità | Proiezione pubblica ripetuta identica; report riusato dagli export senza ricalcolare le esclusioni dalla sola proiezione; input canonico intatto |
| Articoli | Gli attuali due articoli restano pubblici; link verso candidati ancora bloccati; nessuna modifica ad ART-0002 |
| Rimozione deliberata / rettifica | Un record passato a `needs_review` può essere trattenuto: l'invariante sui candidati non impedisce una decisione editoriale esplicita |

File di test previsti: ampliare `test/publication.test.ts`, `test/site.test.ts`, `test/articles.test.ts` per la compatibilità; nuovo test del report/helper se necessario. Confrontare strutture JSON dopo il parsing e verificare prima i casi positivi, evitando asserzioni vacue su record già trattenuti. La prova su ogni collezione non va sostituita da un solo caso H08.

Verifiche in implementazione: `pnpm check`, `pnpm audit:publication`, `pnpm build`, `pnpm check:links`, `pnpm data:diff`, con esiti reali. Browser IT/EN: H02/H08/H20 ripristinate con avviso E5/provvisorio; nessun testo/nota candidato; registro e conteggi della pagina dati coerenti; H23 ancora assente se si mantiene 404; archivio documentario Fonte_09 distinto dal record fonte trattenuto. Review indipendente Sol sul diff dopo Terra, poi ripetizione dei check prima del singolo commit B05. Nessun push.

---

## 5. Rischi e limiti

1. **Non basta filtrare un array.** Note e fonti possono divulgare gli aggiornamenti, anche su un'ipotesi già visibile come H15. La separazione deve avvenire nel read model e negli export, non soltanto nel template.
2. **Versione provvisoria, non approvata.** La baseline resta E5 e `imported_unreviewed`; l'uguaglianza con l'originale non certifica fonti, status legale o proposizione. Le traduzioni correnti mantengono i propri limiti; B06 affronterà l'impronta bidirezionale.
3. **Rettifiche future.** Il confronto con l'originale può trattenere una modifica editoriale legittima ma ancora non revisionata. Deve risultare nel report; non si alza uno stato per farla passare e non si ripubblica automaticamente un testo superato.
4. **Riferimenti incompleti resi espliciti.** La pagina pubblica non è una copia integrale del record Git. L'avviso deve spiegare la proiezione senza indicare i dettagli candidati omessi.
5. **ID individuali sensibili.** Pubblicare un registro facilita l'individuazione anche dei cinque ID persona trattenuti, benché già presenti nel Git pubblico. ADR-09 deve approvare questa visibilità; nessun riferimento tecnico autorizza a saltare il gate.
6. **Perdita del contesto canonico.** Generare un audit dal dataset già filtrato produrrebbe zero trattenuti; usare un unico report autorevole e testare le route costruite.
7. **Invariante circoscritta.** Aggiungere collegamenti candidati validi non deve cancellare la versione pubblica precedente; non si promette monotonicità quando un editor ritira un record, cambia il suo testo o corregge una fonte.
8. **Limiti del registro.** La presenza di un ID con `needs_review` non descrive ciò che il record afferma né l'esito di una verifica. Non esporre attraverso ragioni troppo specifiche il contenuto che si sta trattenendo.

---

## 6. Decisioni aperte per il manutentore

| ID | Domanda e opzioni | Raccomandazione |
| --- | --- | --- |
| **D-B05-1 / ADR-03** | Ipotesi storiche: (a) proiezione dei soli eventi pubblici, se italiano e struttura sono identici al proprio originale; (b) nuovo campo canonico `pending_events`; (c) quarantena attuale con motivi espliciti | **(a)**. Ripristina le 11 ipotesi senza cambiare dati o schema; se i testi/campi semantici sono cambiati, nessuna continuità automatica e ragione di quarantena. Non modificare il gate delle relazioni |
| **D-B05-2** | Metadati delle ipotesi storiche non revisionate: (a) rimuovere nella proiezione tutte le note e tenere solo le fonti del proprio originale ancora citate; (b) rimuovere soltanto note con prefisso Fonte_09; (c) conservare note/fonti correnti | **(a)** su tutte le ipotesi storiche, compresa H15. Evita un filtro falsificabile per stringa e non espone i 13 nuovi metadati candidati. Effetto misurato: **22 ipotesi e 55 fonti pubbliche**, con S09 ancora archiviata come documento ma non come record canonico pubblicato |
| **D-B05-3 / ADR-09** | Visibilità dei trattenuti: (a) solo aggregati pubblici e lista ID/motivi nel CLI; (b) aggregati e `withheld.json` pubblico con soli ID, collezione e codici generici; (c) registro pubblico limitato alla baseline | **(b)** per soddisfare integralmente D A4 e distinguere assente da inesistente. Richiede approvare esplicitamente la reperibilità anche dei **5 ID persona** trattenuti; nessun testo o dettaglio delle relazioni. (a) è l'alternativa conservativa del consolidamento, ma rinvia D A4 come endpoint pubblico; (c) produce una copertura parziale da spiegare |
| **D-B05-4** | Pagine dei record ancora trattenuti: (a) mantenere 404 e rinviare al registro dalla pagina dati/metodo; (b) creare segnaposto neutrali per ogni ID trattenuto | **(a)** ora. Il registro, se approvato, risolve il bisogno delle macchine senza moltiplicare route indicizzabili. H02/H08/H20 tornano comunque pagine normali perché la loro proiezione storica diventa pubblica |

**Stato alla consegna dell'analisi:** analisi conclusa; approvazione successiva registrata nel §7.

## 7. Decisioni del manutentore (15 novembre 2026)

Il manutentore ha risposto «Procedi» alla richiesta di approvare le quattro raccomandazioni, inclusa esplicitamente la visibilità degli ID al punto 3, autorizzando implementazione e chiusura B05 secondo il protocollo.

- **D-B05-1: (a).** Proiezione dei soli eventi pubblici per le ipotesi storiche con italiano e struttura identici all'originale; in caso di modifica semantica non revisionata, quarantena esplicita. Nessun nuovo campo `pending_events` e nessuna deroga al gate delle relazioni.
- **D-B05-2: (a).** Nella proiezione delle ipotesi storiche non revisionate, rimuovere tutte le note e mantenere solo le fonti originali ancora citate, compresa la correzione della proiezione H15. Dati e revisioni canoniche invariati.
- **D-B05-3: (b).** Registro pubblico minimale `withheld.json` con soli ID, collezione e codici generici di ragione, più aggregati nel manifest. Approvata la reperibilità anche dei cinque ID persona trattenuti; esclusi testi e dettagli dei record.
- **D-B05-4: (a).** Mantenere le 404 dei record ancora trattenuti; rinviare al registro da dati/metodo, senza creare pagine segnaposto.

Implementazione GPT-6.1 Terra, sforzo alto; review indipendente e verifiche finali Sol. Nessuna autorizzazione al push.

## 8. Implementazione, review e chiusura (15 novembre 2026)

**Esito:** applicate D-B05-1…4. `publicationReport` calcola dal canonico validato la proiezione pubblica, le ragioni tipizzate e il conteggio di tutti i trattenuti, più i dettagli locali delle omissioni dalle ipotesi. Il wrapper `publishedDataset` resta compatibile. CLI, cache server, export e manifest usano la stessa policy; le route web ricevono il report autorevole, conservando il denominatore canonico.

Le 22 ipotesi storiche sono pubbliche soltanto con italiano e struttura semantica coincidenti con il proprio originale Fonte_07, estremi pubblici, soli eventi pubblici e sole fonti originali ancora citate. Tutte le note sono omesse dalla loro proiezione, compresa H15. Il canonico non viene mutato. Le future ipotesi revisionate mantengono il contenuto revisionato, con i link agli eventi non pubblici filtrati come previsto nel §1.3. Il gate forte delle relazioni resta invariato.

`withheld.json` contiene **138 righe**, una per ciascun record canonico assente, con i soli campi `id`, `collection`, `reasons`. Il manifest aggiunge conteggi e percorso del registro, con dimensione e SHA-256 dei byte serviti. Pagine dati/metodo e avviso delle ipotesi aggiornati in italiano e inglese; le pagine trattenute rimangono 404. Documentazione aggiornata in `AGENTS.md`, `README.md`, `docs/ARCHITECTURE.md`, `docs/M5_EVIDENCE_AUDIT.md`.

| Collezione | Pubblici finali | Trattenuti finali |
| --- | --- | --- |
| events | 147 | 34 |
| entities | 202 | 18 |
| relationships | 433 | 25 |
| hypotheses | 22 | 10 |
| sources | 55 | 51 |
| exposures | 14 | 0 |
| Totale | **873** | **138** |

**Review indipendente Sol:** lettura dell'intero diff, compresa questa analisi, senza modifiche né esecuzione test da parte del reviewer; **zero finding verificabili**, nessuna correzione richiesta. Controllati confronto originale, sanitizzazione, registro minimale, chiamanti del report e conservazione del gate relazioni. Sol orchestratore ha inoltre letto il codice e i test e verificato separatamente gli esiti runtime.

**Verifiche reali Terra e Sol, entrambe exit 0:**

- `pnpm check`: **17 suite, 207 test**; validazione dati **0 errori, 23 warning** preesistenti (22 euristici B03 e G-0230). Biome mantiene 3 warning e 26 informazioni preesistenti; nessuna regola indebolita.
- `pnpm audit:publication`: conteggi della tabella; copertura del registro esatta su tutte le sei collezioni, senza duplicati o ragioni vuote.
- `pnpm build`, poi `pnpm check:links`: **885 pagine, 165.755 link interni, 0 problemi**.
- `pnpm data:diff`: nessuna modifica a `data/` rispetto alla merge base di `origin/main`; nessun aggiornamento remoto durante questo blocco.
- Confronto indipendente con lo snapshot precedente a B05: canonico, collezioni pubbliche eventi/entità/relazioni/esposizioni, grafo delle relazioni, timeline e ID degli articoli identici. Proiezione idempotente. Test delle sentinelle e controllo HTML costruito IT/EN: note Fonte_09 e link candidati rimossi non compaiono nelle pagine delle ipotesi.
- HTTP locale sulla build: SHA-256 e dimensioni verificati per **tutti** i file del manifest; registro con 138 righe e allowlist esatta dei tre campi; H08 risponde 200 IT/EN, H23 e fonte canonica S09 rispondono 404.
- Browser sulla build locale: H02/H08/H20 IT/EN con avvisi E5 e baseline provvisoria; H20 controllata anche a 375×812, avviso leggibile senza tagli; dati e metodologia IT/EN collegano il registro; H23 404; Fonte_09 resta nell'archivio documentario. Nessun errore console osservato. Screenshot osservati tramite il browser; viewport ripristinato e server locale arrestato dopo la verifica.
- `git diff --check`: pulito prima della chiusura.

Log locali delle verifiche Sol: `/private/tmp/b05-sol-check.log`, `b05-sol-build.log`, `b05-sol-links.log`, `b05-sol-publication.json.log`, `b05-sol-data-diff.log`. Snapshot di confronto: `/private/tmp/b05-before.json`; sono evidenze locali temporanee, non dipendenze del repository.

**Limiti confermati:** la proiezione non costituisce revisione editoriale o promozione E5; le traduzioni conservano lo stato reale e B06 resta separato. Il registro rende reperibili anche i cinque ID persona come autorizzato, senza contenuti o estremi. Nessuna modifica a dati, fonti immutabili, provenance, articoli, schemi, dipendenze, workflow, stati di revisione o impostazioni GitHub. Nessun push.

**Commit di chiusura:** unico commit `fix(publication): restore legacy hypotheses and account for withheld records`. La riga §5 identifica il commit tramite il suo soggetto; l'hash non può essere incorporato nel commit stesso senza modificarlo. Il successivo handoff può fissarlo dal log. Prossimo blocco raccomandato: **B06**.
