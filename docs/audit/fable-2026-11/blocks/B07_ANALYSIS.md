# B07 — Caveat nelle esportazioni e nella bacheca · Analisi

- **Blocco:** B07 (CF-011 prima metà, CF-016 parte). Fonti: FABLE_A §4.4/P2; FABLE_C §1 punto 1, §3.3 e §11 punto 2; FABLE_D T1b/A5; correzione del rapporto C in `IMPLEMENTATION_BLOCKS.md` §1.2.
- **Base verificata:** ramo locale `audit/fable-2026-11-implementation` @ `c2164cb02f1bca76c840cae15562977285a66633`, dopo B03. Nessun confronto con uno stato remoto presunto: il riferimento operativo è il ramo unico committato (§2.2).
- **Data della consegna:** 15 novembre 2026, Europe/Rome. GPT: analisi Sol; implementazione prevista Terra, sforzo medio. Nessuna review separata richiesta dalla tabella per B07; restano la verifica indipendente dell'orchestratore e la verifica UI/accessibilità.
- **Ingresso:** working tree pulita, ramo corretto, nessuna operazione Git in corso, nessun file B07 o `wip(B07)` nei 15 commit letti. B07 è il primo blocco non committato nella sequenza raccomandata. Nessun accesso GitHub o push.
- **Perimetro della fase:** lettura, riproduzioni in memoria e build temporanea fuori dal repository. Nessuna modifica a codice, dati, fonti o documentazione operativa; questo file è il prodotto dell'analisi, il registro è aggiornato alla consegna dello step.

**Verifiche iniziali:** `pnpm check` exit 0: **16 suite, 199 test**, **0 errori dati e 23 warning** (22 euristici approvati in B03 e `G-0230`). Biome mantiene i 3 warning e 26 informazioni preesistenti. Build Astro del codice corrente in `/private/tmp/b07-analysis-dist`: exit 0; usata soltanto per la riproduzione browser, senza Pagefind e senza cambiare `web/dist`.

---

## 1. Stato verificato

### 1.1 Perdita dei caveat

| Superficie | Stato corrente | Evidenza |
| --- | --- | --- |
| Record canonico `G-0087` | Contiene `caveat.it` ed `en` completi | `data/relationships/G-0087.json` |
| `relationships.json` e `all.json` | Conservano il campo canonico | `src/site/exports.ts` serializza la proiezione pubblica completa |
| `graph.json` | Non contiene il campo, neppure `null` | `GraphEdge` ed `evidenceGraph` in `src/site/read-model.ts`; endpoint dedicato `web/src/pages/data/v1/graph.json.ts` |
| Fascicolo della bacheca | Predicato, vicino, ID, famiglia e livello; nessun caveat | `EvidenceBoard.tsx`, `selectedEdges.map` |
| Vista Elenco | Sei colonne, nessun caveat | `EvidenceBoard.tsx`, `visible.edges.map` |
| Tooltip SVG del filo | Estremi, predicato, ID e livello; nessun caveat | `<title>` nel rendering dei fili |
| Schede entità/evento | Le relazioni dirette conservano il caveat nella tabella | `RelationshipTable.astro`; non sostituisce l'informazione mancante sulla bacheca |

Il tipo interno `Edge` della bacheca non dichiara il caveat. Il ramo di caricamento delle evidenze usa però `{ ...e }`: aggiungere il campo al JSON lo porterebbe già nell'oggetto a runtime, ma occorrono il contratto TypeScript e il rendering esplicito. Il ramo delle ipotesi deve restare distinto: nessun caveat di relazione va inventato a partire da `current_limit`.

Misura sulla proiezione pubblica corrente:

| Misura | Risultato |
| --- | --- |
| Relazioni pubbliche / archi del grafo | 433 |
| Relazioni pubbliche con caveat non nullo | **360** |
| Relazioni dirette pubbliche con caveat | **80** su 153 |
| Archi pubblici con campo `caveat` nel grafo | **0** |
| Relazioni pubbliche senza caveat | 73 |
| JSON compatto del grafo corrente | 93.298 byte |
| Stesso grafo con `caveat` bilingue o `null` su ogni arco | 179.719 byte |

La misura dei byte è il `JSON.stringify` UTF-8 in memoria, senza newline o compressione HTTP. L'aumento di 86.421 byte deriva soprattutto dai caveat ripetuti degli archi di partecipazione. Non giustifica rimuovere o troncare le cautele; la partecipazione resta disattivata di default nella bacheca.

Per `G-0087`:

```json
{
  "it": "Non dimostra denaro Kerimov verso SpaceX",
  "en": "Does not demonstrate Kerimov money going to SpaceX"
}
```

Il JSON del grafo attuale esporta soltanto `id`, `source`, `target`, `predicate`, `group`, `evidence_level`. Non rende leggibile quella limitazione a chi usa il grafo anziché i record completi. Questo conferma A P2 e D T1b/A5 sul codice corrente; non prova che ogni caveat sia una negazione o un vincolo di attraversamento.

### 1.2 Riproduzione nel browser

Build corrente, servita soltanto su `127.0.0.1:4321` tramite una radice temporanea che espone il prefisso `/our-enemies-monitor/`.

1. Aprire `/our-enemies-monitor/network/?focus=SOB`.
2. Nel fascicolo di Roman Sobachevskiy compaiono due collegamenti, `G-0086` e `G-0087`. Per quest'ultimo sono presenti «collegamento societario separato», GVA Capital, E3 e «Controllo e direzione». **La cautela non compare**.
3. Passare a **Elenco**: `G-0087` è presente; la stringa «Non dimostra denaro Kerimov verso SpaceX» non è nell'albero accessibile della pagina.
4. Aprire `/our-enemies-monitor/en/network/?focus=SOB`: stesso risultato nel case file; la traduzione inglese del caveat non compare.

Nel default sono visibili 142 schede e 153 fili diretti; questi conteggi non includono i 280 archi pubblici di partecipazione, disattivati dal filtro. La verifica riguarda la perdita del testo, non una valutazione generale di usabilità o una certificazione di accessibilità.

### 1.3 I grafi non appartengono al catalogo degli export

`exportFiles` produce le sei collezioni, `all.json` e gli schemi. I due grafi sono invece generati da endpoint dedicati:

- `web/src/pages/data/v1/graph.json.ts`;
- `web/src/pages/data/v1/hypotheses-graph.json.ts`.

`buildManifest` calcola dimensioni/hash esclusivamente per i file ricevuti da `exportFiles`. Di conseguenza **nessuno dei due grafi è nel manifest o nella tabella download generata da `/data/`**, benché i file esistano e siano consumati dalle bacheche. L'attuale frase «SHA-256 di ogni file» non copre quei due endpoint.

È un rilievo collegato all'esportazione, distinto dalla perdita del caveat. Includerli ora richiede una decisione di perimetro (§6): aggiungere i grafi a `exportFiles` senza rimuovere o escludere gli endpoint dedicati creerebbe due produttori della stessa route attraverso `[file].json.ts`.

### 1.4 Colore dei fili baltici: correzione del rapporto e alternative

Le tre relazioni `G-0419`, `G-0420`, `G-0421` hanno classe **`infrastructure`**, non `supply`. `RELATION_CLASS_GROUP.infrastructure` restituisce `economic_dependency`; la bacheca ne deriva etichetta, filtro, icona e colore `var(--series-3)`. Il problema non è un valore cromatico isolato: il gruppo è una categoria pubblica del read model e del grafo.

Tutti i sette record pubblici della classe:

| ID | Predicato / estremi | Caveat | Gruppo corrente |
| --- | --- | --- | --- |
| G-0079 | SPACEX → STARLINK, FORNITORE | null | economic_dependency |
| G-0080 | SPACEX → STARSHIELD, FORNITORE | null | economic_dependency |
| G-0110 | COSCO → CHANCAY, INVESTE_GESTISCE_PORTO | Perù, flussi logistici globali | economic_dependency |
| G-0406 | US → RAFFAIR, USO_MILITARE_BASI | Base UK usata da mezzi USA nel conflitto Iran | economic_dependency |
| G-0419 | NEWNEW → CABLES, DANNEGGIAMENTO_DA_ANCORA | Dolo non provato | economic_dependency |
| G-0420 | YIPENG → CABLES, DANNEGGIAMENTO_DA_ANCORA | Dolo non provato | economic_dependency |
| G-0421 | EAGLES → CABLES, DANNEGGIAMENTO_ASSOCIATO_NAVE | Mandato russo non provato | economic_dependency |

Cambiare tutta la classe in `security_intelligence` sposterebbe anche forniture e investimenti. Colorare soltanto i tre fili senza cambiare il gruppo farebbe invece divergere la legenda e il filtro dalla resa visiva.

**Raccomandazione editoriale da approvare:** override puntuale dei tre ID verso il gruppo esistente **`context` / «Contesto e conseguenze»**, dal colore neutro. Evita la lettura commerciale e non introduce una categoria di sabotaggio, dolo o attribuzione. Applicarlo centralmente anche a etichette e filtri; mantenere la classe canonica `infrastructure`, i livelli e i caveat. L'alternativa è rimandare la riclassificazione: nessun requisito sui caveat dipende dall'approvazione del colore.

`G-0406` presenta un'altra categoria discutibile, ma non fa parte dei tre override proposti. Nessuna riclassificazione di massa o automatica è autorizzata da questa analisi.

### 1.5 Vincoli UI e localizzazione

- Il drawer ha già uno scroll verticale e la lista un limite di altezza con overflow: caveat integrali possono andare a capo senza ellissi o clamp.
- La cella del predicato dell'Elenco porta oggi `lang="it"` sull'intero `<td>`. Un caveat inglese inserito dentro quella cella deve avere la lingua corretta: spostare `lang="it"` sul solo predicato, usare `pick` per il testo e marcare esplicitamente la lingua scelta.
- `T.astro` non è utilizzabile dentro un'isola React. Riutilizzare la stessa semantica di `pick` (`value`, `lang`, `fallback`) in un piccolo componente React: italiano canonico, inglese quando disponibile, fallback italiano marcato `lang="it"`.
- Il CSS del drawer contiene colori preesistenti hard-coded. Non ampliarli: le nuove regole usano token semantici o ereditano il colore della scheda. Una migrazione generale del drawer non appartiene a B07.
- La geometria mobile del fascicolo è B08. B07 deve verificare che il testo aggiunto non introduca nuovi tagli; non dichiara risolto il difetto geometrico precedente.
- Il colore non comunica da solo né il livello di evidenza né il caveat: mantenere testo, codice e glifo del timbro esistenti.

La skill `mcp-ui-ux` è stata usata per la lettura della superficie e la specifica conservativa, con i moduli interni di review e design. Il relativo scanner statico, eseguito con Python 3.13 su `EvidenceBoard.tsx`, produce 13 segnalazioni generiche sugli handler React inline: non sono prove di difetti pertinenti e non generano refactor in questo blocco. Il primo tentativo con Python 3.9 era incompatibile con la sintassi dello scanner; il secondo è riuscito senza modificare la skill.

---

## 2. Riproduzioni tecniche

Da `/Users/antoniomattis/dev/our-enemies-monitor`, senza scritture al dataset:

```bash
node --input-type=module <<'JS'
import { readDataFiles } from './src/pipeline/load.ts';
import { validateDataFiles } from './src/pipeline/validate.ts';
import { publishedDataset } from './src/site/publication.ts';
import { buildReadModel, evidenceGraph } from './src/site/read-model.ts';
import { exportFiles, buildManifest } from './src/site/exports.ts';
const raw = validateDataFiles(readDataFiles()).dataset;
const publicData = publishedDataset(raw);
const graph = evidenceGraph(buildReadModel(publicData));
const byId = new Map(publicData.relationships.map(r => [r.id, r]));
const enriched = {
  ...graph,
  edges: graph.edges.map(e => ({ ...e, caveat: byId.get(e.id).caveat }))
};
const files = exportFiles(raw);
console.log({
  publicRelations: publicData.relationships.length,
  caveats: publicData.relationships.filter(r => r.caveat !== null).length,
  graphCaveatFields: graph.edges.filter(e => 'caveat' in e).length,
  graphBytes: Buffer.byteLength(JSON.stringify(graph)),
  enrichedBytes: Buffer.byteLength(JSON.stringify(enriched)),
  manifestHasGraph: buildManifest(raw, files).files.some(f => f.path === 'graph.json')
});
console.log(byId.get('G-0087').caveat);
console.log(graph.edges.find(e => e.id === 'G-0087'));
JS
```

Esito: `433 / 360 / 0`, `93298 / 179719` byte, `manifestHasGraph: false`; caveat presente nel record e assente nell'arco. I conteggi derivano dai dati correnti, senza inferenze sui contenuti.

Build per il controllo browser, con output esterno:

```bash
pnpm exec astro build --root web --outDir /private/tmp/b07-analysis-dist
```

La radice HTTP temporanea associa `/our-enemies-monitor/` a quella directory; nessun server è esposto al di fuori di loopback. Output di supporto della sessione: `/private/tmp/b07-analysis-check.log`, `/private/tmp/b07-analysis-build.log`, `/private/tmp/b07-ui-inspection.json`. La riproduzione in questo file non dipende dalla conservazione dei log temporanei.

---

## 3. Piano file per file, subordinato alle decisioni

### 3.1 Contratto del grafo e serializzazione

- **`src/site/read-model.ts`:** aggiungere `GraphEdge.caveat: LocalizedText | null`, valorizzato sempre dal medesimo record pubblico, senza riassunti, normalizzazione o perdita dell'inglese. Nessun nuovo nodo/arco o cambiamento di selezione. `HypothesisEdge` resta distinto e senza caveat di relazione.
- **`test/site.test.ts` e `test/publication.test.ts`:** confronto di ogni arco pubblico con il caveat del record omonimo, incluso `null`; caso nominativo `G-0087`; nessun leak di `G-0230` o candidati. Confrontare JSON dopo il parsing, non cercare ID dentro stringhe JSON escape.
- **`src/site/exports.ts`, se D-B07-2 approvata:** includere entrambi i grafi nella lista generata dalla stessa proiezione pubblica, mantenendo `EXPORT_VERSION = "v1"`. Serializzazione compatta e deterministica, hash e dimensione derivati dal testo esatto servito. Le collezioni complete e `all.json` non cambiano.
- **`web/src/pages/data/v1/graph.json.ts` e `hypotheses-graph.json.ts`, nella stessa opzione:** rimuovere i due produttori dedicati, facendo servire i grafi dall'endpoint generico `[file].json.ts`, che già seleziona i file senza slash. Gli URL restano identici. Nessuna route duplicata; testare il build effettivo, non soltanto la lista dei file.
- **`test/site.test.ts`:** manifest con entrambi i grafi, digest/dimensione corretti e determinismo. Il grafo delle ipotesi deve conservare identità, campi e separazione E5; eventuale newline di serializzazione non cambia la struttura.

Se il manutentore rinvia il catalogo dei grafi, lasciare gli endpoint dedicati e limitare la modifica alla proiezione `evidenceGraph`; descrivere esplicitamente il limite del manifest senza dichiararlo corretto.

### 3.2 Bacheca: testo completo nelle superfici di lettura

- **Nuovo piccolo componente React, ad esempio `web/src/islands/BoardCaveat.tsx`:** riceve caveat e lingua; `null`/campo assente non produce contenuto. Renderizza etichetta bilingue **«Avvertenza» / «Caveat»** e testo integrale con la semantica di `pick`, marcando la lingua del testo. Testabile con `react-dom/server`, già disponibile: non installare framework DOM o dipendenze nuove.
- **`web/src/islands/EvidenceBoard.tsx`:** dichiarare il caveat nel tipo `Edge`; nel ramo evidenze preservare l'oggetto bilingue, nel ramo ipotesi impostare `null`. Gestire anche l'assenza del campo nel caricamento di un eventuale vecchio JSON senza generare errori UI.
- Inserire il componente sotto la riga predicato/metadati nel fascicolo e **nella cella del predicato dell'Elenco**, sotto il predicato. Spostare `lang="it"` dal `<td>` al solo testo del predicato. Nessuna nuova colonna larga, nessun contenuto esclusivo di hover.
- Aggiungere il caveat localizzato completo anche al `<title>` SVG del filo, quando presente. Non introdurre riconoscimenti automatici della negazione, stili spezzati o cambiamenti a «Isola il vicinato».
- **`web/src/styles/board.css`:** poche regole per spaziatura, wrapping e larghezza minima delle celle/contenuti, usando token o colori ereditati. Nessun line clamp, ellissi, altezza fissa del caveat o cambio geometrico del drawer B08. Non applicare indiscriminatamente `lang="it"` ai caveat inglesi.
- **Nuovo `test/board-caveat.test.tsx` o equivalente:** rendering del piccolo componente con IT, EN, fallback italiano marcato, null, testo lungo e caratteri da escapare. Il collegamento effettivo nelle due viste viene verificato nel browser; evitare test che leggono il sorgente per cercare il nome del componente.

### 3.3 Riclassificazione visuale separabile

Se D-B07-3 approvata:

- **`src/site/visual.ts`:** registro esplicito di override per i soli `G-0419`, `G-0420`, `G-0421`, con gruppo `context` e motivazione documentata. Riutilizzare icona e token neutri esistenti: nessuna nuova classe, famiglia, sprite o colore.
- **`src/site/read-model.ts`:** `relationGroup` applica prima l'override, poi la mappa classe→gruppo corrente. Questo tiene coerenti tabella delle relazioni, grafo, filtri e colore della bacheca. Non mettere una condizione sul solo `colorOf` React.
- **`test/design.test.ts` / `test/site.test.ts`:** override su ID esistenti, gruppo e token coerenti; `G-0079`, `G-0080`, `G-0110`, `G-0406` conservano il gruppo precedente. Classi canoniche e caveat dei tre record restano identici. Nessuna regola fondata su parole come «sabotaggio» nel testo.

Se la decisione rinvia la riclassificazione, nessuna modifica a `visual.ts`, ai gruppi o ai colori; registrare il punto residuo nell'analisi e nel registro.

### 3.4 Documentazione nello stesso commit

- **`docs/ARCHITECTURE.md`:** campo bilingue/nullable nel grafo; presenza dei caveat nel fascicolo, Elenco e tooltip; se approvato, produttore comune e copertura del manifest; override visuali distinti dalla classe canonica.
- **`web/src/pages/[...lang]/data.astro`:** note di formato bilingui per il grafo e il caveat; se approvato il catalogo, i link/digest appaiono dalla lista del manifest. Nelle frasi toccate allineare il perimetro alla policy B03 (URL mancanti **o non associati**, baseline con provenienza originale), senza cambiare il gate.
- **`README.md`:** aggiornamento breve della funzionalità bacheca/export visibile all'utente, senza dichiarare completati B08/B15/B16 o introdurre nuovi fatti.
- **`docs/design/PAGES.md`:** aggiornare la specifica delle tre superfici e l'eventuale eccezione visuale approvata. Nessun cambio al vocabolario probatorio o alla gerarchia dei livelli.
- **`IMPLEMENTATION_BLOCKS.md` §5, questo file:** decisioni, esiti reali, stato e commit. Il B03 precedente può ora riportare il suo hash effettivo `c2164cb`, già noto, al posto del riferimento a sé stesso.

Nessuna modifica a `data/`, `sources/`, provenienza, stati di revisione, schemi canonici/sidecar, dipendenze, CI o articoli. Il campo è additivo nell'export `v1`; non viene creato uno schema di grafo nuovo in questo blocco.

---

## 4. Test e criteri di accettazione

| Prova | Esito richiesto |
| --- | --- |
| D A5 su ogni arco pubblico | Campo `caveat` sempre presente; uguaglianza profonda con il record completo, incluse entrambe le lingue e `null` |
| `G-0087` | «Non dimostra denaro Kerimov verso SpaceX» presente integralmente in JSON, fascicolo e Elenco; traduzione EN corretta |
| Caveat assente | `null` nel grafo; nessun testo inventato o etichetta vuota nella UI |
| Fallback EN su fixture solo italiana | Testo integrale con `lang="it"`; predicato resta italiano; nessuna traduzione fabbricata |
| Testo lungo, negazione alla fine | Nessuna troncatura nelle superfici di lettura; ritorno a capo e scroll utilizzabili |
| Stringhe contenenti `<`, `&`, virgolette | Testo escapato da React, nessun `dangerouslySetInnerHTML` |
| Pubblicazione | Stessi ID/nodi/archi pubblici; `G-0230` e candidati restano esclusi; record canonici e collezioni esportate invariati |
| Ipotesi | E5 soltanto nella bacheca separata; nessun caveat di relazione o cambio di campi del grafo ipotesi |
| Catalogo, se approvato | Una sola route per ciascun grafo, download HTTP valido, dimensioni/hash del manifest identici ai byte serviti |
| Gruppi, se approvati | Solo i tre ID passano a `context`; etichetta, filtro, icona e colore concordano; gli altri quattro `infrastructure` non cambiano |
| UI e tastiera | Fascicolo leggibile, Elenco equivalente; nessun bisogno di hover per leggere la cautela; apertura/chiusura e filtri esistenti funzionano |

Prima della chiusura: `pnpm check`, `pnpm build`, `pnpm check:links`, `pnpm check:contrast` (già incluso in check), `pnpm audit:publication` e `pnpm data:diff`, con risultati reali. Nel browser verificare IT/EN, chiaro/scuro e almeno 1440×900 e 375×812; salvare una prova visiva del fascicolo `SOB` con il caveat di `G-0087`. Controllare anche Elenco, tooltip, una relazione senza caveat e la bacheca ipotesi. Eventuali problemi di geometria mobile preesistenti vanno distinti dalle regressioni B07 e consegnati a B08.

L'orchestratore verifica indipendentemente diff e `pnpm check`; singolo commit B07 sul ramo unico, nessun push. B12 misurerà la baseline sul grafo corretto con caveat, come già previsto nell'ordine del piano.

---

## 5. Rischi e limiti

1. **Il caveat non è una regola automatica di attraversamento.** Esportarlo e mostrarlo riduce una perdita informativa; non rende sicura l'inferenza A→B→C, non classifica la negazione e non implementa B15/B16.
2. **Payload quasi doppio.** Il grafo compatto cresce da 93.298 a 179.719 byte prima della compressione; misurare dopo la serializzazione effettiva. Nessuna deduplicazione di testi che cambi il contratto o separi le cautele dagli archi.
3. **UI più lunga.** I caveat di partecipazione sono ripetitivi; conservarli quando quei fili sono abilitati. Non nascondere sistematicamente il testo per densità. Il fix geometrico mobile resta B08.
4. **Compatibilità additiva.** Client che accettano campi nuovi continuano a usare `v1`; client con una forma rigida locale potrebbero richiedere aggiornamento. Documentare il campo; non attribuire al grafo uno schema canonico che non ha.
5. **Route duplicate.** L'eventuale centralizzazione degli export deve rimuovere il doppio produttore prima della build; un test di puro `exportFiles` non basta.
6. **Riclassificazione editoriale.** `context` è una raccomandazione prudente, non una conclusione imposta dal codice. Il manutentore può preferire mantenere la mappatura o una revisione più ampia; la scelta non modifica evento, autore, mandante o dolo.
7. **Nessuna nuova autenticazione.** Il caveat si copia dal record pubblicabile; B07 non rivede fonti, traduzioni o legalità delle proposizioni. Gli stati e le restrizioni B03 rimangono reali.

---

## 6. Decisioni aperte per il manutentore

| ID | Domanda e opzioni | Raccomandazione |
| --- | --- | --- |
| **D-B07-1** | Resa dei caveat: (a) integralmente sotto predicato/metadati in fascicolo ed Elenco, più tooltip; (b) nuova colonna dedicata nell'Elenco; (c) testo collassato da aprire | **(a)**, senza troncatura e con fallback linguistico marcato. Mantiene predicato e cautela insieme, contiene la larghezza della tabella e non richiede un'altra azione per leggere il limite |
| **D-B07-2** | Catalogo dei grafi: (a) includere ora entrambi i grafi in `exportFiles`/manifest/download, con un solo produttore e stessi URL; (b) lasciare gli endpoint separati e rinviare il catalogo | **(a)**, come correzione circoscritta del percorso di esportazione, conservando `v1` e senza cambiare il contenuto del grafo ipotesi. Richiede rimuovere i due endpoint dedicati ora coperti dalla route generica |
| **D-B07-3** | Famiglia dei tre fili baltici: (a) override puntuale a `context` («Contesto e conseguenze», neutro); (b) mantenere il gruppo economico e rinviare; (c) override a `security_intelligence`; (d) cambiare tutta la classe `infrastructure` | **(a)**: corregge il segnale commerciale senza suggerire dolo o mandante. Cambia coerentemente gruppo/filtro/icona/colore, non i dati. (b) è separabile dal fix caveat; (c) è più interpretabile come minaccia attribuita; (d) coinvolge record eterogenei |

**Stato alla consegna dell'analisi:** analisi conclusa; approvazione successiva registrata nel §7.

## 7. Decisioni del manutentore (15 novembre 2026)

Il manutentore ha risposto «Procedi» alla proposta delle tre raccomandazioni, autorizzando l'implementazione e la chiusura B07 secondo il protocollo.

- **D-B07-1: (a).** Caveat integrale nel fascicolo, sotto il predicato nell'Elenco e nel tooltip; lingua e fallback marcati correttamente, nessuna troncatura.
- **D-B07-2: (a).** Entrambi i grafi entrano nel catalogo export, nel manifest e nei download con hash, con un solo produttore per URL; restano gli URL esistenti e la versione `v1`.
- **D-B07-3: (a).** Override visuale centralizzato dei soli `G-0419`, `G-0420`, `G-0421` verso `context` («Contesto e conseguenze»), senza cambiare classe canonica, livello, caveat o record.

Implementazione GPT-6.1 Terra, sforzo medio; verifica indipendente del diff, dei comandi e della UI da parte di Sol. Nessuna autorizzazione al push.

## 8. Implementazione e verifica finale (15 novembre 2026)

Terra ha implementato le tre decisioni: campo `caveat` completo o `null` su ogni arco pubblico, componente React condiviso per fascicolo/Elenco, caveat nei titoli SVG, catalogo unico dei grafi e tre override visuali a `context`. Rimossi soltanto i due endpoint dedicati ora coperti dalla route generica; gli URL pubblici restano identici. Documentazione aggiornata in README, architettura, specifica delle pagine e pagina dati bilingue.

### Verifica indipendente Sol

Diff completo e nuovi file controllati: nessuna correzione richiesta residua. Verificati rendering sicuro React, lingua del testo, assenza di troncatura, preservazione dei filtri e del gate B03, produttore unico delle route, token esistenti e separazione E5. Non sono stati modificati dati canonici, fonti, provenienza, revisioni, schemi, dipendenze, CI o articoli.

Confronto in memoria con `/private/tmp/b07-before.json` acquisito prima delle modifiche:

- Proiezione pubblica **identica integralmente**, non soltanto nei conteggi.
- Tutti gli export precedentemente esistenti **identici byte per byte**; due soli file aggiunti al catalogo: i grafi.
- Nodi del grafo e grafo delle ipotesi **identici**.
- Stessi 433 archi pubblici; ogni caveat coincide con quello del record, compresi i 73 `null`; 360 caveat non nulli conservati.
- Confrontando ogni altro campo degli archi con il grafo precedente, le sole differenze sono i tre gruppi approvati: `G-0419`, `G-0420`, `G-0421` da `economic_dependency` a `context`.

### Comandi osservati

| Verifica | Risultato reale |
| --- | --- |
| `pnpm check` — Terra e ripetizione indipendente Sol | exit 0; **17 suite, 202 test**; dati **0 errori, 23 warning**; 3 warning Biome e 26 informazioni preesistenti |
| `pnpm build` — Terra e ripetizione Sol | exit 0; nessuna route duplicata |
| `pnpm check:links` — Terra e ripetizione Sol | exit 0; **865 pagine, 161.907 link interni, 0 problemi** |
| `pnpm audit:publication` | exit 0; pubblici **147/202/433/11/56/14**, restrizioni invariate |
| `pnpm data:diff --base 19b2533` | exit 0; nessuna modifica a `data/` |
| Grafi serviti via HTTP locale | entrambi HTTP 200; dimensioni e SHA-256 dei byte ricevuti identici al manifest |

`graph.json` misura **179.683 byte**, `hypotheses-graph.json` **3.231 byte**, senza compressione. I 36 byte di differenza rispetto alla simulazione iniziale del grafo arricchito derivano dai tre nomi di gruppo più brevi (`context`). Restano la versione `v1` e le stesse collezioni canoniche.

### Browser e prova visiva

Build verificata nel browser host con viewport **1440×900 e 375×812**, IT/EN e temi chiaro/scuro:

- `?focus=SOB`: il fascicolo mostra integralmente l'avvertenza di `G-0087`, italiana e inglese; `G-0086` senza caveat non riceve etichette vuote. Acquisiti screenshot nella sessione del fascicolo italiano desktop chiaro e del fascicolo inglese mobile chiaro.
- Elenco: stessa avvertenza sotto il predicato, anche su mobile; il testo inglese è separato dal predicato italiano. Fallback, testo lungo ed escaping sono coperti dal rendering statico del componente nei test.
- Tooltip: verificato il testo completo di `G-0087` nel titolo SVG.
- Mobile: avvertenza intera raggiungibile con scroll interno al fascicolo; nessun nuovo overflow orizzontale della pagina (375 px). Non si dichiara risolto il distinto blocco geometrico B08.
- Tastiera: Escape chiude il fascicolo e Enter sulla scheda selezionata lo riapre con il caveat.
- `?focus=NEWNEW`: `G-0419` mostra «Contesto e conseguenze» e «Dolo non provato»; il filtro della famiglia neutra rimuove/ripristina il filo.
- Bacheca ipotesi: avviso E5 esplorativo presente, nessun caveat di relazione introdotto; console senza errori osservati.
- Pagina dati: entrambi i grafi compaiono nei download con dimensioni e hash.

Ripristinati tema Sistema e viewport predefinito; server temporaneo limitato a loopback arrestato a fine verifica. I log di supporto Sol sono `/private/tmp/b07-sol-{check,build,links,publication,diff}.log`; il dettaglio riproducibile delle regole resta nei test committati.

Chiusura con un solo commit `fix(graph): preserve caveats in exports and evidence board`, senza push. Il registro lo identifica come «questo commit» con titolo completo, dato che il suo hash non può essere incluso nel contenuto che lo genera; l'hash reale è riportato nella risposta di chiusura. Restano i limiti del §5: nessuna inferenza automatica, autenticazione aggiuntiva o completamento di B08/B15/B16.
