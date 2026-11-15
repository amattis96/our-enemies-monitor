# B03 — Gate di pubblicazione: baseline, persone, coerenza · Analisi

- **Blocco:** B03 (CF-003, CF-006). Fonti: FABLE_B V4, V5, V9, P4, R1, R6–R8 e T13; FABLE_A §4.2; scheda B03 del piano.
- **Base verificata:** ramo locale `audit/fable-2026-11-implementation` @ `eceb0d463b3067ffdee72830374617561a4abf03`, successivo a B01, B02 e B04. Non è il `main` remoto: il protocollo §2.2 impone di riprendere lo stato committato del ramo unico.
- **Data:** 14 novembre 2026, Europe/Rome. Autore: GPT, analisi Sol. Implementazione prevista: Terra, sforzo alto; review indipendente Sol prima della chiusura.
- **Ingresso:** working tree pulita, nessuna operazione Git in corso, ramo corretto senza upstream. Lavoro locale: nessun fetch, pull, push o accesso GitHub. Nei 15 commit letti non ci sono `wip(B03)`; questo file non esisteva.
- **Perimetro della fase di analisi:** lettura e riproduzioni in memoria; nessuna modifica a codice, dati, fonti o documentazione operativa in quella fase. L'approvazione successiva è registrata nel §7 e gli esiti dell'implementazione nel §8.

**Verifica iniziale:** `pnpm check` completato con exit 0: 15 suite, 188 test passati; validazione dati con 0 errori e 1 avviso (`G-0230`); 0 sidecar, 3 Markdown incrementali; 2 articoli pubblici validi; schemi aggiornati, audit M5 senza problemi e contrasto conforme. Biome segnala 3 warning e 26 informazioni preesistenti, senza fallire. Nessuna correzione automatica applicata.

---

## 1. Stato verificato

### 1.1 Gate e validatore

| Rilievo | Esito sul ramo corrente | Evidenza |
| --- | --- | --- |
| V4 / R1: record nuovo `imported_unreviewed` senza provenienza | **Confermato** | `eligible` in `src/site/publication.ts` esclude soltanto `needs_review`; `validateDataFiles` verifica le voci esistenti, ma non ne richiede alcuna |
| V5 / T13: URL arbitrario su persona | **Confermato** | `G-0230.primary_url = "https://example.com/"` in memoria: 0 errori, 0 warning, relazione pubblica |
| V5 / R6: persona dichiarata organizzazione | **Confermato** | `PAPP.kind = "organization"` in memoria: nessun avviso, `G-0230` senza URL diventa pubblica |
| V9 / R8: coppia livello–stato incoerente | **Confermato** | Prima relazione E1, stato sostituito con `allegation`: 0 errori; gli enum sono indipendenti |
| Due implementazioni della restrizione persone | **Confermato** | `publishedDataset` e `buildReadModel(...).isRestricted` ripetono il controllo `primary_url !== null`, senza confronto con riferimenti |
| Eccezione per metadati delle fonti citate | **Confermato** | `publication.ts` conserva una fonte se `eligible(source) || cited.has(source.id)`: il rafforzamento di `eligible` da solo non basta a escludere una falsa baseline citata |

La protezione resta limitata alle relazioni e alla classificazione `kind`. I nomi in titoli di eventi, ipotesi, articoli e documenti archiviati non acquisiscono un controllo semantico con B03. La data e lo stato procedurale sono richiesti dall'ingest per le nuove relazioni su persone (`person_status`), ma nel record canonico sono note libere: B03 non introduce un certificatore automatico del loro contenuto.

`loadReadModel` rifiuta gli errori di validazione; `web/src/lib/model.ts` applica poi la proiezione. `exportFiles`, `buildManifest` e il gate degli articoli chiamano anch'essi `publishedDataset`. Serve una sola regola condivisa, senza divergenze fra sito, grafo ed esportazioni.

### 1.2 Baseline e conteggi

`pnpm audit:publication` conferma:

| Collezione | Canonici | Pubblici | `imported_unreviewed` |
| --- | --- | --- | --- |
| events | 181 | 147 | 151 |
| entities | 220 | 202 | 202 |
| relationships | 458 | 433 | 444 |
| hypotheses | 32 | 11 | 22 |
| sources | 106 | 56 | 54 |
| exposures | 14 | 14 | 14 |

Tutti gli **887** record `imported_unreviewed` hanno almeno una voce di provenienza verso `sources/original/`. Pertanto richiedere questa condizione non riduce la baseline attuale. La provenienza attesta l'origine storica, non l'approvazione editoriale della proposizione attuale.

La definizione del modello oggi accetta `ProvenanceEntry.file` sotto il generico `sources/`; il controllo di contenuto verifica la riga/linea, non il prefisso `sources/original/`. Una provenienza verso un documento incrementale non deve acquisire il significato di baseline per il solo fatto di essere non vuota.

B02 aggiunge una difesa distinta: nuovo record con provenienza o stato diverso da `needs_review` è errore nel diff severo; modificare una provenienza esistente è non derogabile. Questa difesa non sostituisce il controllo locale di B03 e non dimostra l'identità dell'autore. Le impostazioni B01 restano attività del manutentore; non sono state riverificate online in questa analisi.

### 1.3 Il requisito sugli URL richiede una decisione di compatibilità

Nel dataset ci sono **58 relazioni su persone**: 57 con URL e `G-0230` senza. Cinque delle 58 sono candidati già trattenuti; 52 relazioni su persone sono attualmente pubbliche.

| Criterio strutturale per `primary_url` | Relazioni su persone coperte, anche candidate | Totale relazioni pubbliche dopo il filtro |
| --- | --- | --- |
| URL identico in `urls` di una fonte citata direttamente dalla relazione | 8 | **384** |
| Precedente + riferimento associato allo stesso ID nel registro M5 | 43 | **419** |
| Precedente + riferimento che dichiara `cited_in` su una fonte della relazione | 47 | **423** |
| Fonti dirette + M5 sullo stesso ID + URL originale della stessa relazione | 57 | **433** |

Nel registro `docs/audit/M5_2026-11-12.json`, 35 relazioni hanno un'associazione esplicita `relationship_reviews.id → source_id → sources.url`, con `assessment: matched_with_scope_limits`. Nessuna ha approvazione umana. Questa associazione può documentare la registrazione del riferimento, senza promuovere lo stato del record.

Altre **17** relazioni conservano il proprio URL già presente nella riga originale di Fonte_07. È possibile controllare l'uguaglianza con `provenance.original.primary_url`, richiedendo anche `original.id === relationship.id` e il percorso originale. Alcune hanno già citazioni dirette; l'unione dei tre criteri copre tutti i 57 URL attuali.

I 14 ID non coperti da fonti dirette o registro M5 sono:

```text
G-0008 G-0009 G-0010 G-0014 G-0015 G-0016 G-0017
G-0018 G-0019 G-0020 G-0051 G-0086 G-0087 G-0446
```

Esempio: `G-0008` cita `S01/S00`; il suo URL è in `F02/P02`, ma questi codici non sono citati direttamente. Quattro URL di relazioni (`G-0016`, `G-0017`, `G-0018`, `G-0020`) non compaiono neppure nelle `urls` di una fonte canonica. Accettare qualsiasi URL del catalogo globale non risolve tutta la compatibilità e consentirebbe riusi su affermazioni estranee.

**Proposta da approvare:** interpretare «riferimento registrato» anche come l'URL originale della stessa relazione, esclusivamente per la continuità provvisoria della baseline. Non è una prova che il documento sia primario o sufficiente: negli originali esistono anche URL giornalistici e pagine generiche. Correggerli sul merito appartiene a B17/revisione editoriale. Una sostituzione con `example.com` non coincide con alcuno dei tre legami e resta trattenuta.

### 1.4 Coppie livello–stato e riconoscimento dei nomi

Il dataset conferma esattamente le quattro coppie di A §4.2:

| Livello | Stato attuale richiesto | Relazioni |
| --- | --- | --- |
| E1 | `documented` | 181 |
| E2 | `institutional_attribution` | 68 |
| E3 | `corroborated` | 208 |
| E4 | `allegation` | 1 |

Imporre questa corrispondenza non cambia record attuali. È una regola transitoria di consistenza del contratto, non un ordinamento di verità e non la decisione ADR-04 completa. La separazione futura delle dimensioni resta a B18.

Il campo canonico `public_relevance` non esiste su `Entity`; appartiene all'operazione del sidecar e viene salvato nelle note come `Public relevance: ...`. Non va aggiunto un campo canonico né cercato arbitrariamente nel testo per B03.

Misura di una semplice euristica Unicode: nome italiano composto da 2–4 parole, ciascuna con iniziale maiuscola e lettere successive minuscole, con apostrofi/trattini interni ammessi. **27** entità non `person` corrispondono, **22** hanno relazioni: tra i falsi positivi evidenti ci sono `Associated Press`, `Federazione Russa`, `Milrem Robotics`; `Rokh Solis` richiede anch'essa giudizio umano. Nessuna entità non `person` ha oggi `domain: persons`.

Questo risultato esclude di usare l'euristica come blocco di pubblicazione. Un avviso per entità, con gli ID delle relazioni coinvolte, è riproducibile; il rumore deve essere approvato dal manutentore. Una semplice euristica non riconosce tutti i nomi, in particolare iniziali, grafie non latine senza maiuscole e nomi lunghi.

---

## 2. Riproduzioni

Eseguite da `/Users/antoniomattis/dev/our-enemies-monitor` con Node e moduli correnti. Script esplorativo temporaneo: `/private/tmp/b03-analysis-repro.ts`. Modifiche solo a copie in memoria, serializzate con `datasetToFiles`; nessun comando di ingest o importer CLI eseguito.

Riproduzione minima indipendente dal file temporaneo:

```bash
node --input-type=module <<'JS'
import { readDataFiles, datasetToFiles } from './src/pipeline/load.ts';
import { validateDataFiles } from './src/pipeline/validate.ts';
import { publishedDataset } from './src/site/publication.ts';
const raw = validateDataFiles(readDataFiles()).dataset;
function run(name, mutate) {
  const copy = structuredClone(raw);
  mutate(copy);
  const result = validateDataFiles(datasetToFiles(copy));
  const visible = publishedDataset(result.dataset);
  console.log(name, JSON.stringify({
    errors: result.issues.filter(i => i.severity === 'error').length,
    warnings: result.issues.filter(i => i.severity === 'warning').length,
    newEventPublic: visible.events.some(e => e.id === 'TL-9001'),
    pappergerLinkPublic: visible.relationships.some(r => r.id === 'G-0230')
  }));
}
function addEvent(dataset, status) {
  const event = structuredClone(dataset.events.find(e => e.timeline_status === 'integrated'));
  event.id = 'TL-9001';
  event.provenance = [];
  event.review = { status, notes: [] };
  for (const value of Object.values(event)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) delete value.en;
  }
  dataset.events.push(event);
}
run('R1', d => addEvent(d, 'imported_unreviewed'));
run('R1-control', d => addEvent(d, 'needs_review'));
run('T13', d => { d.relationships.find(r => r.id === 'G-0230').primary_url = 'https://example.com/'; });
run('R6', d => { d.entities.find(e => e.id === 'PAPP').kind = 'organization'; });
run('R8', d => { d.relationships.find(r => r.evidence_level === 'E1').evidence_status = 'allegation'; });
JS
```

Esito osservato:

```text
R1         errors=0 warnings=1 newEventPublic=true  pappergerLinkPublic=false
R1-control errors=0 warnings=1 newEventPublic=false pappergerLinkPublic=false
T13        errors=0 warnings=0 newEventPublic=false pappergerLinkPublic=true
R6         errors=0 warnings=0 newEventPublic=false pappergerLinkPublic=true
R8         errors=0 warnings=1 newEventPublic=false pappergerLinkPublic=false
```

L'avviso nelle righe R1/R8 riguarda soltanto il `G-0230` già esistente. La sostituzione di `primary_url` o `evidence_status` non modifica testi tradotti, evitando falsi errori di traduzione.

Per ripetere la misura della compatibilità: selezionare le relazioni con almeno un estremo `kind: person`; confrontare l'URL con (a) `Source.urls` limitate agli ID in `relationship.sources`, (b) l'associazione sul medesimo ID nel registro M5, (c) `provenance.original.primary_url` sul medesimo ID. Applicare ciascuna unione ai 433 archi di `publishedDataset(raw)`. I conteggi del §1.3 sono uguaglianze di stringa; la normalizzazione corrente di `ingest/match.ts` non recupera ulteriori corrispondenze dirette nel dataset.

---

## 3. Piano di modifica per file, subordinato alle decisioni

### 3.1 Regole condivise e accesso ai riferimenti

- **Nuovo `src/pipeline/evidence-policy.ts`:** funzioni pure e tipizzate per riconoscere la provenienza di baseline, verificare la coppia livello–stato, valutare il legame fra URL e relazione, produrre il sospetto di classificazione personale. La funzione sugli URL restituisce anche il motivo (`missing`, `unregistered`, oppure il tipo di riscontro). Nessuna richiesta HTTP, scansione dei Markdown, dipendenza da note libere o valutazione automatica di colpevolezza.
- **`src/editorial/m5.ts`:** esporre una piccola proiezione tipizzata dei riferimenti M5 associati agli ID delle relazioni, riusando lo schema esistente. Lettura/parsing del file versionato separati dalle funzioni pure; file mancante o non valido non deve trasformarsi in elenco vuoto silenzioso. La proiezione non richiede né imposta `human_approved` e accetta solo `matched_with_scope_limits` con fonte risolta.
- Passare il contesto dei riferimenti alle funzioni pure; riusare un caricatore di default nelle API pubbliche esistenti per non costringere ogni chiamante a ricostruire il registro. I test devono poter iniettare un contesto minimo in memoria. Verificare che nessun import dell'accesso filesystem entri nelle isole client tramite questi moduli server.
- **Confronto URL raccomandato:** uguaglianza esatta, conservando path, query e frammento. Nessuna equivalenza per dominio, redirect o homepage. La normalizzazione di deduplicazione eventi non diventa automaticamente una regola probatoria. Opzioni alternative nel §6.
- Se approvata la compatibilità storica: il riscontro originale richiede percorso `sources/original/`, voce originale della relazione con ID identico e URL identico non nullo. Non basta che un URL compaia in qualunque riga di provenienza. Il validatore continua a verificare i byte originali; il gate non esegue nuovamente letture del corpus.

### 3.2 `src/pipeline/validate.ts`

- Aggiungere errore su `imported_unreviewed` senza provenienza originale, in tutte e sei le collezioni; non limitarsi agli eventi.
- Aggiungere errore per ognuna delle 12 combinazioni livello–stato fuori dalle quattro ammesse, senza correggere automaticamente il dato. Tenere il controllo nel validatore: non cambiare il contratto sidecar o lo schema Zod in questo blocco.
- Per persona con URL nullo, conservare un avviso esplicito; per URL presente ma non associato alla relazione, aggiungere avviso distinto e motivato. La pubblicazione lo trattiene comunque. La severità dei due casi resta da confermare (§6).
- Aggiungere avviso di possibile `kind` errato secondo la scelta del §6, con ID dell'entità e delle relazioni; non riclassificare né trattenere automaticamente.
- Continuare a raccogliere tutti i problemi in `issues`; non interrompere la validazione al primo record errato.

### 3.3 `src/site/publication.ts`

- `needs_review` resta non pubblicabile; `imported_unreviewed` richiede la provenienza originale; `reviewed` mantiene il significato corrente, senza derogare alla regola sulle persone.
- Applicare l'esito della stessa funzione sugli URL usata dal validatore, oltre ai controlli attuali su estremi ed eventi.
- Gestire esplicitamente l'eccezione dei metadati citati: le fonti `needs_review` continuano a essere conservate quando supportano un record pubblico; una fonte erroneamente `imported_unreviewed` senza provenienza non deve rientrare per `cited.has`. Per proiezioni chiamate direttamente su dati invalidi, trattenere anche i record che la citano, conservando l'integrità referenziale e senza cancellare singole citazioni dal claim. Sui dati validi attuali questo caso non esiste.
- Conservare immutabilità dell'input e idempotenza; non modificare il filtro sulle ipotesi collegate a eventi candidati (B05).

### 3.4 `src/site/read-model.ts` e `src/cli/audit-publication.ts`

- `isRestricted` usa la stessa regola, anche quando il read model è costruito sui dati canonici grezzi nei test o nei comandi. Non aggiungere un secondo elenco di URL.
- L'audit elenca anche URL presenti ma non registrati, distinguendoli dai mancanti. Conservare la chiave esistente `named_person_relationships_missing_primary` per i mancanti; aggiungere una lista distinta per gli URL non associati, evitando una modifica silenziosa del significato dell'output.
- Non introdurre in B03 il registro pubblico generale dei trattenuti: è B05. L'audit corrente continua a riportare i conteggi e gli stati onesti.

### 3.5 Test e documentazione

- **Nuovo `test/evidence-policy.test.ts`:** regole pure, coppie livello–stato, contesti M5 minimi e casi di nomi.
- **`test/validate.test.ts`:** R1, R6, R8 e diagnosi URL; la vecchia asserzione «tutti i warning sono URL mancanti» va sostituita con controlli distinti sui warning previsti, mantenendo la copertura originaria.
- **`test/publication.test.ts`:** R7/T13, baseline invariata per ID e contenuto, proiezione non mutante, fonte invalida citata e caso positivo di metadati `needs_review`.
- **`test/site.test.ts`:** parità di `isRestricted`, grafo e schede sulle relazioni con URL arbitrario e valido. **`test/m5.test.ts`:** verificare la proiezione del registro senza alterare gli attuali vincoli di approvazione.
- **`docs/ARCHITECTURE.md` (M5, validazione e struttura moduli), `AGENTS.md` (Publication gate), `docs/M5_EVIDENCE_AUDIT.md`:** definizione di baseline, tre tipi di riscontro se approvati, uguaglianza URL, significato provvisorio della compatibilità, nuovi avvisi e audit.
- **`README.md`:** aggiornare la descrizione del gate visibile all'utente e il comando audit se ne cambia l'output descritto. Non dichiarare i riferimenti storici come certificati o approvati.
- **`IMPLEMENTATION_BLOCKS.md` §5 e questo file:** stato, decisioni e verifica alla chiusura. Nessun milestone generale dichiarato completato da B03.

Nessuna modifica prevista a `data/`, `sources/`, schemi generati, dipendenze, workflow CI, traduzioni o articoli. Nessuna nuova collezione di dati editoriali. Se l'implementazione scopre una necessità fuori perimetro, ritorna al manutentore.

---

## 4. Piano di test e criteri di accettazione

| Test | Esito richiesto |
| --- | --- |
| R1, ogni collezione: `imported_unreviewed` + provenienza vuota | Errore di validazione; record escluso dalla proiezione |
| Provenienza presente ma soltanto incrementale | Non vale come baseline; nessuna modifica al documento incrementale per provarlo |
| Record `needs_review`, con o senza provenienza | Resta trattenuto; il comportamento non cambia |
| Tutti gli 887 record storici | Superano la nuova condizione; nessun ID o testo canonico modificato |
| R7/T13: persona + URL sconosciuto | Avviso/errore secondo decisione; trattenuta in proiezione, grafo ed export, anche se costruiti direttamente |
| URL valido ma registrato solo per una relazione diversa | Non è un riscontro per il claim corrente |
| URL di una fonte non citata dalla relazione | Non autorizza il claim solo perché presente nel catalogo |
| URL identico su una fonte direttamente citata | Riscontro strutturale positivo; `needs_review` resta comunque trattenuto |
| M5: ID relazione, source_id e URL coerenti | Riscontro positivo solo per quella relazione; `human_approved: false` resta falso |
| M5: `primary_not_found`, source_id assente/ignoto, altro ID | Nessun riscontro; parsing invalido fallisce esplicitamente |
| URL originale legacy | Ammesso solo per lo stesso ID e voce originale, se D-B03-2 approvata |
| `G-0230` invariato | Resta trattenuto; nessuna nuova fonte aggiunta o stato promosso |
| R8: tutte le 16 combinazioni | Quattro valide, dodici errori; E5 continua a essere rifiutato sulle relazioni |
| R6: persona con `kind: organization`, dominio personale/nome plausibile | Avviso verificabile, senza decisione automatica sulla natura dell'entità |
| Nomi organizzativi che passano l'euristica | Avvisi dichiarati; nessun blocco o riclassificazione |
| Fonte `needs_review` citata da claim pubblico | Metadati conservati col vero stato, riferimenti integri |
| Fonte erroneamente baseline senza provenienza citata da claim | Nessuna fuga via eccezione `cited`; nessun riferimento pubblico pendente |
| Parità delle proiezioni | ID e contenuti pubblici invariati sui dati attuali, non soltanto stessi conteggi |
| Idempotenza | `publishedDataset(publishedDataset(raw))` identico alla prima proiezione; `raw` invariato |

In implementazione: `pnpm check`, `pnpm audit:publication`, `pnpm build` e `pnpm check:links`, con esiti reali. Il sito è toccato nel suo gate anche senza modifiche ai template: verificare in browser IT/EN una relazione legacy ammessa (`G-0008`), una relazione M5 (`G-0024`), l'assenza di `G-0230` e i download dati; non pubblicare fixture per la prova. Non è richiesto cambiare il layout. Review indipendente Sol sul diff dopo Terra; l'orchestratore ripete `pnpm check` prima del singolo commit B03.

---

## 5. Documentazione e rischi residui

1. **Registrazione non equivale ad autenticazione.** Fonte citata, registro M5 e provenienza rendono il riferimento tracciabile; non dimostrano che sostenga precisamente il predicato o sia una fonte primaria idonea. Mantenere i caveat e la natura provvisoria; B17 affronta il merito.
2. **Compatibilità storica esplicita.** Accettare l'URL originale preserva link imperfetti già presenti. Senza questa scelta i requisiti «fonti direttamente citate» e «433 relazioni pubbliche invariate» sono incompatibili. Il manutentore deve scegliere, non Terra.
3. **Tipo di entità.** L'euristica produce falsi positivi e falsi negativi. Non può garantire che nessuna persona sia mascherata da organizzazione; la revisione umana resta indispensabile.
4. **Stato `reviewed`.** B03 non autentica chi lo ha impostato; resta il controllo B02 più la governance B01. Nessun agente lo imposta durante questo blocco.
5. **Provenienza valida non equivale a record immutato.** La verifica confronta la copia della fonte, non ogni campo editoriale con l'originale. I diff severi e la revisione delle correzioni restano necessari. Non presentare ADR-02 minima come una baseline crittograficamente congelata.
6. **Coerenza transitoria.** Il vincolo E1–E4/stato può diventare inadatto se ADR-04 introduce uno stato indipendente del claim. Documentarlo e sostituirlo esplicitamente in B18; non reinterpretare i quattro codici.
7. **Accoppiamento con M5.** Il caricatore rende il registro una dipendenza esplicita della policy. Evitare duplicazione manuale degli URL e fallimenti silenziosi; testare missing/invalid e non alterare il registro per far passare un record.
8. **Limite della verifica iniziale.** `pnpm check` verde riguarda il codice di partenza. Non è una verifica di un'implementazione B03, che non esiste ancora. Build e browser verranno eseguiti dopo le decisioni.

---

## 6. Decisioni aperte per il manutentore

| ID | Domanda e opzioni | Raccomandazione |
| --- | --- | --- |
| **D-B03-1 / ADR-02 minima** | Baseline: (a) qualsiasi provenienza non vuota; (b) almeno una provenienza verso `sources/original/`, validata contro i byte; (c) elenco congelato di ID/provenienze | **(b)**, più errore nel validatore e filtro nel gate per tutte le collezioni. (a) confonde incrementali e baseline; (c) è più rigido ma richiede un nuovo registro e manutenzione. La provenienza già esistente non viene modificata |
| **D-B03-2** | Riferimenti ammessi per persona: (a) solo fonti citate direttamente, 384 relazioni pubbliche; (b) dirette + M5 sullo stesso ID, 419; (c) dirette + M5 sullo stesso ID + URL originale della stessa relazione, 433 | **(c)** per rispettare la continuità richiesta. È un'eccezione storica tracciata, non una certificazione; niente ricerca in tutto il corpus o catalogo globale. `G-0230` resta trattenuta |
| **D-B03-3** | Confronto URL: (a) stringa esatta; (b) normalizzazione conservativa host/slash, mantenendo query/frammento; (c) normalizzazione ingest, che rimuove anche il frammento | **(a)**: nessuna perdita sui dati attuali, semantica semplice. Un frammento può individuare il passaggio preciso; evitare equivalenze automatiche non approvate |
| **D-B03-4** | Persona con URL mancante o non associato: (a) warning + quarantena; (b) errore sui non associati, warning sui mancanti; (c) errore per entrambi | **(a)**, coerente con la quarantena M5 e la conservazione dei candidati in Git. Il gate esclude entrambi. (c) farebbe fallire il dataset su `G-0230` senza aggiungere evidenza |
| **D-B03-5 / R6** | Avviso sul tipo di entità: (a) dominio personale oppure euristica Unicode 2–4 parole su tutte le entità non `person` coinvolte in relazioni; (b) solo dominio personale/omonimia con persone già note, accettando che non copra nomi nuovi; (c) euristica con lista di esclusione editoriale da approvare | **(a)** per coprire il requisito ora, accettando circa 22 avvisi aggiuntivi sul dataset corrente, uno per entità con ID delle relazioni. Nessun errore, riclassificazione o blocco. (c) riduce il rumore ma richiede un secondo lavoro editoriale; (b) riduce la copertura R6 |
| **D-B03-6 / ADR-04 parziale** | Imporre ora le quattro coppie attuali come errori, lasciando a B18 la ridefinizione completa? sì / rinviare | **Sì**, nel validatore, senza migrazione dei dati o modifica del contratto sidecar. Rendere esplicito che non è una graduatoria di attendibilità |

**Stato alla consegna dell'analisi:** analisi conclusa; le decisioni sono state successivamente approvate come registrato nel §7.

## 7. Decisioni del manutentore (14 novembre 2026)

Il manutentore ha risposto «Procedi» alla proposta delle sei raccomandazioni, autorizzando l'implementazione B03 e la successiva chiusura secondo il protocollo.

- **D-B03-1: (b).** Baseline con almeno una provenienza verificata verso `sources/original/`; errore nel validatore e filtro nella proiezione per tutte le collezioni.
- **D-B03-2: (c).** Riscontro URL tramite fonte direttamente citata, associazione M5 sullo stesso ID oppure URL originale della stessa relazione. Conservare le 433 relazioni pubbliche attuali; `G-0230` resta trattenuta.
- **D-B03-3: (a).** Confronto URL per uguaglianza esatta.
- **D-B03-4: (a).** URL mancanti o non associati producono warning e quarantena.
- **D-B03-5: (a).** Avviso per dominio personale oppure euristica Unicode 2–4 parole sulle entità non `person` coinvolte in relazioni, accettando circa 22 nuovi avvisi e i falsi positivi documentati; nessuna riclassificazione automatica.
- **D-B03-6: sì.** Le quattro coppie livello–stato attuali sono vincolanti nel validatore, in attesa dell'ADR-04 completa in B18.

Implementazione affidata a GPT-6.1 Terra, sforzo alto; review indipendente e verifiche finali Sol. Nessuna autorizzazione al push.

## 8. Implementazione, review e verifica finale

Implementazione Terra completata secondo le sei decisioni. Aggiunti `src/pipeline/evidence-policy.ts` e `test/evidence-policy.test.ts`; aggiornati validatore, proiezione pubblica, read model, caricatore M5 e audit. Le radici temporanee dei test CLI includono ora il registro M5, dipendenza esplicita della policy. Aggiornati `AGENTS.md`, `README.md`, `docs/ARCHITECTURE.md` e `docs/M5_EVIDENCE_AUDIT.md`. Nessuna modifica a dati canonici, fonti, schemi, articoli, dipendenze o workflow.

### Review indipendente Sol

Review del diff completo, inclusi i nuovi file, con la skill `mcp-code-reviewer`; esito finale **OK**, nessuna correzione richiesta residua. Rilievi risolti da Terra:

1. **Documentazione:** il paragrafo sul read model descriveva le relazioni trattenute come mostrate con un segnaposto. Ora descrive l'esclusione effettiva da pagine, grafi, atlante ed export e distingue le 36 relazioni all'ingresso storico dal caso attuale `G-0230`.
2. **Copertura warning:** sostituire il vecchio controllo universale con un semplice `some` avrebbe ridotto la copertura. Il test verifica ora tutti i percorsi attesi per gli URL mancanti, separa gli avvisi euristici, controlla gli ID delle relazioni ed esclude categorie inattese.
3. **Export:** cercare l'ID nel `JSON.stringify` di una lista di file avrebbe confrontato stringhe con virgolette escape. Il test esegue ora il parsing di `relationships.json` e `all.json` e verifica l'assenza nella collezione esportata.
4. **Proiezione baseline:** la prima fixture evento era già trattenuta perché pending. Il test sceglie ora, per ogni collezione, un record importato effettivamente pubblico, verifica il caso positivo e solo dopo rimuove la provenienza.

L'euristica è stata allineata alla riproduzione anche per spazi multipli e caratteri Unicode con segni combinanti. Nessuna decisione editoriale aggiuntiva o promozione di stato.

### Esiti osservati

- `pnpm check`: **exit 0, 16 suite, 199 test**. Dati: **0 errori, 23 warning**, di cui 22 avvisi euristici approvati e l'URL mancante di `G-0230`. Biome: 3 warning e 26 informazioni preesistenti. Schemi aggiornati, audit M5 senza problemi, contrasto conforme. Eseguito da Terra e ripetuto indipendentemente da Sol.
- `pnpm audit:publication`: **exit 0**; pubblici invariati **147/202/433/11/56/14**, `G-0230` nell'elenco degli URL mancanti, nuovo elenco degli URL non registrati vuoto.
- Confronto indipendente Sol con le copie precedenti in `/private/tmp/b03-public-before.json` e `/private/tmp/b03-exports-before.json`: **proiezione ed export identici integralmente**, non soltanto nei conteggi.
- `pnpm build`: **exit 0**, ripetuto indipendentemente da Sol; nessun riferimento al filesystem o al caricatore M5 trovato nei bundle JavaScript client generati.
- `pnpm check:links`: **exit 0, 865 pagine e 161.903 link interni, 0 problemi**, ripetuto indipendentemente da Sol.
- `pnpm data:diff --base 19b2533`: **exit 0**, nessuna modifica a `data/`; controllo diff whitespace pulito.
- Browser: controllate pagine IT/EN di `MED` (legacy `G-0008` presente), `MANAFORT` (M5 `G-0024` e relativo caveat presenti), `PAPP` (nessuna relazione/evento pubblicato), pagina dati e URL JSON. Nell'export aperto nel browser `G-0008` e `G-0024` presenti, `G-0230` assente. Screenshot della pagina italiana verificato. La preview Astro locale terminava prima della readiness; la stessa build statica è stata verificata mediante server temporaneo Python vincolato a `127.0.0.1`, poi arrestato.

Chiusura prevista con un solo commit `fix(publication): enforce baseline and person-source gates` sul ramo unico, senza push. Il registro identifica B03 come «questo commit» con il titolo completo: l'hash del commit non può essere incluso nel contenuto che lo genera; l'hash effettivo viene riportato nella risposta di chiusura. Restano i limiti editoriali del §5, incluso il carattere provvisorio dei riscontri storici e i falsi positivi dell'euristica.
