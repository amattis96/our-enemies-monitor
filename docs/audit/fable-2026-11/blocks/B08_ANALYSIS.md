# B08 — Fascicolo della bacheca su mobile · Analisi

- **Blocco:** B08, parte di CF-016. Fonti: FABLE_C §2, §10 e limiti finali; scheda B08 in IMPLEMENTATION_BLOCKS §3; specifiche `docs/design/PAGES.md` e `MOTION.md`.
- **Base verificata:** ramo locale `audit/fable-2026-11-implementation` @ `df84e3af1bc654f12b2322f0ee995f46152b8daa`, dopo B06. Data: **15 novembre 2026**, Europe/Rome.
- **Ingresso:** ramo corretto e working tree pulita; nessuna operazione Git in corso. Letti AGENTS, piano e ultimi 15 commit nell'ordine richiesto. B08 è il primo blocco non committato nella sequenza; nessuna analisi B08 precedente o WIP da riprendere.
- **Modelli:** analisi Sol; implementazione prevista Terra · medio. Nessuna review separata prescritta per B08; verifica finale dell'orchestratore. Applicata la skill mcp-ui-ux, modulo responsive, con evidenze del browser e del codice.
- **Perimetro della fase:** sola lettura del codice, build locale e interazioni nel browser. Nessuna modifica a codice, dati o documentazione operativa; soltanto questa analisi e registro §5 alla consegna. Nessun accesso GitHub, push o modifica di impostazioni.

**Baseline reale:** `pnpm check` exit 0, **18 suite / 213 test**, dati **0 errori / 23 warning** preesistenti, Biome 3 warning / 26 informazioni preesistenti. `pnpm build` exit 0 e `pnpm check:contrast` exit 0. `pnpm data:diff` mantiene **exit 1 per i due articoli reviewed modificati nei soli metadati in B06**, senza nuovi cambiamenti; nessuna deroga applicata. Log locali `/private/tmp/b08-analysis-{check,build,contrast,data-diff}.log`.

## 1. Stato verificato

### 1.1 Il taglio persistente non si riproduce

La build corrente è stata servita in locale sotto `/our-enemies-monitor/`, con `?focus=KERIMOV`. Browser in-app, viewport emulato **375×812** e **1440×900**, temi chiaro e scuro. Misure DOM con `getBoundingClientRect`, `clientWidth`, `scrollWidth` e stile calcolato, più screenshot osservati.

| Viewport / stato stabile | Bacheca: sinistra–destra | Fascicolo: sinistra–destra | Larghezza fascicolo | Overflow orizzontale del fascicolo |
| --- | --- | --- | --- | --- |
| 375×812, IT chiaro/scuro | 16–359 px | **38–337 px** | **299 px** | Assente: clientWidth = scrollWidth = 299 |
| 1440×900, IT chiaro/scuro | 32–1408 px | **998–1382 px** | **384 px** | Assente: clientWidth = scrollWidth = 384 |
| 759×812, chiaro | 21,74–737,26 px | 43,74–715,26 px | 671,52 px | Assente |
| 760×812, chiaro | 21,76–738,24 px | 328,24–712,24 px | 384 px | Assente |
| 320×812, chiaro, controllo aggiuntivo | 16–304 px | 38–282 px | 244 px | Assente nel fascicolo |

A 375 px anche la larghezza scrollabile dell'intera pagina è **375 px**. La misura stabile differisce da C §2 (fascicolo fra 367 e 666 px). Gli screenshot correnti mostrano titolo, chiusura, link alla scheda, isolamento e primi collegamenti nel pannello, senza taglio a destra.

La bacheca e il fascicolo fanno parte del normale flusso verticale della pagina: dopo il caricamento possono essere sotto la piega, poi entrano nel viewport scorrendo la pagina. Cambiare viewport mantenendo lo scroll può portare il pannello sopra o sotto la finestra; questa posizione nel documento non dimostra uno sconfinamento orizzontale.

### 1.2 Il contenuto lungo è raggiungibile

Su mobile il fascicolo ha `max-height: 62%` dell'area interna della bacheca e `overflow-y: auto`. A 375×812 l'altezza interna osservata è **375 px**, mentre il contenuto KERIMOV è alto 585 px nella prima misura. Selezionando COSCO e scorrendo sul pannello è stato osservato `scrollTop: 223,5` su un contenuto alto 599 px, mantenendo `window.scrollY: 840` invariato: lo scorrimento interno funziona nella prova eseguita.

Verifiche aggiuntive:

- **EN `/network/?focus=RU`:** 15 relazioni, contenuto alto 2.487 px; posizione stabile 38–337 px, clientWidth e scrollWidth entrambi 299. Nessun overflow orizzontale e contenuto affidato allo scorrimento interno.
- **IT `/network/hypotheses/?focus=KERIMOV`:** un collegamento E5, stessa larghezza interna 299 px, nessun overflow orizzontale. Il CSS è condiviso con la bacheca delle relazioni.
- I caveat B07 sono presenti; non serve rimuoverli, troncarli o cambiare il contenuto per ottenere la geometria corretta.
- Nessun errore console osservato. Tema ripristinato a Sistema e viewport ripristinato dopo le prove; server temporaneo arrestato.

Il significato operativo dell'accettazione B08 è: pannello contenuto orizzontalmente e intero contenuto raggiungibile tramite scroll. Non si propone di mostrare simultaneamente tutte le relazioni in un pannello alto 375 px.

### 1.3 L'animazione spiega le coordinate del rapporto, ma la causa storica resta un'inferenza

`web/src/styles/board.css:197–229` contiene già la geometria responsive:

- base: pannello assoluto, larghezza massima 24rem, margini 0,75rem;
- sotto 760 px: `top: auto`, `left/right: 0.5rem`, `width: auto`, `max-height: 62%`;
- con `prefers-reduced-motion: no-preference`, **a tutte le larghezze**, animazione `case-in` da `transform: translateX(110%)` a nessuna trasformazione;
- durata `--dur-slow: 360ms`, curva `--ease-enter` dal design system.

Con posizione finale x = 38 e larghezza 299, il punto iniziale delle keyframe è:

```text
x iniziale = 38 + (299 × 1,10) = 366,9 px
destra iniziale = 366,9 + 299 = 665,9 px
```

Coincide, arrotondato, con **367–666 px** dichiarato in C. Questo calcolo è una deduzione dal CSS attuale: non prova quale istante o browser il rapporto storico abbia misurato.

La transizione corrente è osservabile anche a runtime: dopo chiusura e riapertura di una scheda visibile, una lettura durante l'ingresso dava x = 47,20 e destra = 346,20 con `matrix(1, 0, 0, 1, 9.20077, 0)`; la lettura stabile successiva dava **38–337** e `transform: none`. Un caricamento EN ha prodotto analogamente x = 69,54 e destra = 368,54 durante la coda dell'animazione, poi 38–337. Non viene quindi confermata una posizione finale fuori schermo.

### 1.4 Discrepanza concreta fra specifica e implementazione

`docs/design/MOTION.md:32` prevede esplicitamente: ingresso da destra, **dal basso sui telefoni**. Il CSS cambia posizione e dimensioni sul breakpoint mobile ma mantiene le keyframe orizzontali. Questa discrepanza è verificata indipendentemente dalla ricostruzione del rapporto C.

**Raccomandazione:** allineare soltanto l'animazione del fascicolo sotto 760 px all'ingresso verticale già previsto dal design. Conservare geometria finale, scroll, contenuti, desktop e reduced motion. Non serve un pannello fixed, un dialog modale, un portale React o un nuovo stato JavaScript.

## 2. Riproduzione

1. Da root: `pnpm build`; servire `web/dist` sotto `/our-enemies-monitor/` con un server statico locale. Nella prova: symlink in `/private/tmp/b08-preview/our-enemies-monitor` e server su `127.0.0.1:4321`.
2. Aprire `/network/?focus=KERIMOV` a **375×812**. Attendere che la UI sia idratata e distinguere lettura durante l'ingresso da lettura stabile; non usare una singola misura in animazione come posizione finale.
3. Scorrere la pagina fino alla bacheca, verificare titolo, pulsante di chiusura, link completo, isolamento e primo collegamento; scorrere dentro il fascicolo per raggiungere gli altri collegamenti e caveat.
4. Rilevare `.board`, `.case-file`, `.case-file-close`, `.case-file .btn`, `.case-file-list` con rettangoli e dimensioni interne. Ripetere in chiaro e scuro.
5. Chiudere e riaprire una scheda visibile: leggere anche `getComputedStyle(drawer).transform`. Il pannello ha una fase transitoria traslata e una finale non trasformata.
6. Ripetere a **1440×900**, ai due lati del breakpoint **759/760 px**, in EN con contenuto lungo e sulla bacheca delle ipotesi.

Snippet DOM di sola lettura usato per le misure:

```js
const drawer = document.querySelector('.case-file');
const rect = drawer.getBoundingClientRect();
({
  x: rect.x, right: rect.right, width: rect.width,
  clientWidth: drawer.clientWidth, scrollWidth: drawer.scrollWidth,
  clientHeight: drawer.clientHeight, scrollHeight: drawer.scrollHeight,
  scrollTop: drawer.scrollTop,
  transform: getComputedStyle(drawer).transform,
  animation: getComputedStyle(drawer).animation,
  pageWidth: document.documentElement.scrollWidth
});
```

Screenshot osservati tramite browser: KERIMOV mobile chiaro e scuro, desktop scuro con pannello interamente nel viewport. Nessun file immagine è stato salvato nel repository.

## 3. Piano file per file, subordinato alla decisione

### 3.1 Correzione minima raccomandata

- **`web/src/styles/board.css`:** keyframe verticali dedicate e loro applicazione al fascicolo sotto 760 px, soltanto quando il movimento non è ridotto. Conservare `--dur-slow` e `--ease-enter`; sul desktop resta l'ingresso da destra. Durante l'ingresso mobile x deve restare allineata alla posizione finale. La bacheca continua a ritagliare la porzione in ingresso dal basso.
- Nessuna modifica a width, left/right, max-height, bottom, padding, tipografia o colori per correggere un difetto stabile non riprodotto. Non aggiungere colori codificati o nuovi token: l'intervento riguarda soltanto il movimento.
- **`web/src/islands/EvidenceBoard.tsx`:** nessuna modifica prevista; il markup condiviso di `<aside className="case-file">` è già separato dall'SVG ed espone i controlli necessari. Nessuna trasformazione JavaScript del contenitore e nessun nuovo dialog/focus trap.
- **`docs/design/MOTION.md`, `PAGES.md`:** rendere espliciti breakpoint e modalità del fascicolo: dal basso sotto 760 px, da destra sopra; fase finale contenuta e scroll interno. La specifica dal basso è già adottata, non una nuova scelta visuale inventata per questo blocco.
- **`docs/ARCHITECTURE.md`** (riga network / comportamento mobile), **`README.md`** (breve nota nella voce della bacheca): allineare al comportamento effettivamente implementato.
- **Questa analisi e `IMPLEMENTATION_BLOCKS.md` §5:** decisione del manutentore, prove prima/dopo ed esiti reali. Fissare l'hash B06 `df84e3a` nella riga precedente.

Nessuna modifica a dati, fonti, articoli, hash di traduzione, gate di pubblicazione, export, schema, dipendenze, workflow o stati di revisione. Il data:diff già rosso da B06 resta una condizione precedente da riportare.

### 3.2 Alternativa senza modifica CSS

Se il manutentore preferisce mantenere l'ingresso corrente, chiudere B08 come **verifica con difetto persistente non riprodotto**. Terra aggiorna soltanto le specifiche per distinguere la geometria attuale e l'ingresso da destra anche su mobile dalla precedente intenzione dal basso. Il commit non deve essere presentato come correzione di uno sconfinamento persistente.

## 4. Test e accettazione

Per una modifica CSS delimitata non sono previsti nuovi test unitari che replichino il testo del foglio di stile né nuove dipendenze E2E. Le verifiche decisive sono browser e confronto dei dati/export.

| Controllo | Esito richiesto dopo l'opzione raccomandata |
| --- | --- |
| 375×812, chiaro e scuro, IT/EN | Posizione finale contenuta nella bacheca; niente overflow orizzontale nel fascicolo o nella pagina a 375 px; controlli leggibili |
| Ingresso e riapertura mobile | Movimento verticale, nessuna traslazione orizzontale della scheda; durata/curva dai token esistenti |
| 1440×900, chiaro e scuro | Geometria e ingresso da destra invariati; pannello a destra, controlli e collegamenti accessibili |
| 759 e 760 px | Asse di ingresso e geometria corrispondono allo stesso breakpoint; nessun conflitto di animazioni |
| Contenuto lungo RU EN, KERIMOV IT, bacheca ipotesi | Scorrimento interno, pulsanti vicini, caveat B07 e link completi ancora accessibili |
| Chiusura, selezione e isolamento | Comportamento invariato; navigazione verso la scheda corretta |
| Reduced motion | Nessun viaggio del fascicolo; verificare CSS e runtime se il browser di prova espone la preferenza, altrimenti dichiarare il limite |
| Dati/export | Identici alla base B08; nessun cambiamento ai contenuti per adattare il layout |
| `pnpm check`, `pnpm check:contrast` | Esiti reali, nessuna regola indebolita |
| `pnpm build`, `pnpm check:links` | Build e link senza errori |
| `pnpm data:diff` | Riportare gli stessi due errori preesistenti da B06; nessun errore nuovo attribuibile a B08 e nessuna deroga |

Terra implementa l'opzione approvata e aggiorna le specifiche; Sol legge il diff, ripete `pnpm check`, verifica il browser e aggiorna il registro prima del singolo commit B08. Nessun push.

## 5. Rischi e limiti

1. **Attribuzione storica incerta:** la coincidenza numerica con l'animazione è forte ma non dimostra che spieghi ogni screenshot del rapporto. La posizione persistente fuori schermo non è stata riprodotta sul checkout corrente.
2. **Dispositivi reali non testati:** le prove usano viewport emulati del browser in-app. Non sono una certificazione di Safari iOS o Chrome Android e non verificano un gesto touch su hardware fisico.
3. **Reduced motion:** il CSS attuale condiziona l'animazione a no-preference; la preferenza reduce non è stata emulata durante questa analisi. L'implementazione deve preservare il gate.
4. **Ordine del documento:** il fascicolo resta relativo alla bacheca. La proposta non introduce un overlay fisso sul viewport né risolve altri flussi di navigazione della pagina.
5. **Controllo aggiuntivo a 320 px:** la pagina ha mostrato una larghezza scrollabile di 330 px pur con il fascicolo contenuto e privo di overflow interno. Questo fenomeno fuori dal target 375 px non viene attribuito al fascicolo né corretto con un overflow:hidden globale; richiede un'indagine distinta se richiesto.
6. **Colori preesistenti:** il foglio include colori letterali già presenti. B08 non aggiunge valori cromatici e non riclassifica questo intervento come revisione completa dei token o dell'accessibilità della bacheca.
7. **Guardia probatoria:** gli errori ereditati da B06 impediscono di dichiarare l'intero ramo pronto al merge; la correzione visuale non autorizza interventi su quella guardia.

## 6. Decisione aperta per il manutentore

| ID | Opzioni | Raccomandazione |
| --- | --- | --- |
| **D-B08-1** | **(a)** Allineare il solo ingresso mobile al movimento dal basso già previsto dal design, conservando geometria finale e interazioni; **(b)** mantenere anche l'ingresso corrente e chiudere B08 come sola verifica documentata del difetto persistente non riprodotto, aggiornando la specifica del movimento | **(a)**. Risolve una discrepanza concreta codice–design e impedisce lo sconfinamento laterale transitorio su telefono, con una modifica CSS minima. Non dichiarare riparata una posizione finale errata che non si è riprodotta |

**Stato alla consegna dell'analisi:** analisi conclusa; approvazione successiva registrata nel §7.

## 7. Decisioni del manutentore (15 novembre 2026)

Il manutentore ha risposto «Procedi» alla richiesta esplicita di approvare **D-B08-1(a)**, autorizzando implementazione e chiusura B08.

- Ingresso del fascicolo **dal basso sotto 760 px**, come già previsto dalla specifica del design.
- Geometria finale, dimensioni, scorrimento interno, contenuti e interazioni invariati; desktop da destra e gate reduced motion conservati.
- Nessuna dichiarazione di aver corretto un taglio persistente non riprodotto, nessun ampliamento agli altri problemi responsive della pagina.

Implementazione GPT-6.1 Terra · medio; verifica indipendente finale Sol. Nessuna autorizzazione al push.

## 8. Implementazione e chiusura (15 novembre 2026)

**Applicata D-B08-1(a):** dieci righe aggiunte a `web/src/styles/board.css`: keyframe `case-in-bottom` con traslazione verticale e override del solo nome dell'animazione sotto 760 px, congiunto a `prefers-reduced-motion: no-preference`. Nessun cambiamento alle regole di geometria finale, scroll, tipografia, colore o markup React. Durata 360ms e curva dai token già presenti. Aggiornati README, architettura e specifiche MOTION/PAGES.

**Verifica indipendente Sol del diff:** intervento conforme al perimetro e al piano, senza rilievi. Review separata non prescritta per B08. Confronto con `/private/tmp/b08-before.json`: tutti i JSON canonici, i file articolo e i file scaricabili prodotti da `exportFiles` sono **identici byte per byte**; nessuna modifica a fonti immutabili, schemi, dipendenze, gate o stati di revisione.

| Prova finale | Esito reale |
| --- | --- |
| `pnpm check`, Terra e Sol | **exit 0**, 18 suite / **213 test**, dati 0 errori / 23 warning preesistenti; Biome 3 warning / 26 informazioni preesistenti |
| `pnpm check:contrast`, Terra e Sol | **exit 0**, token invariati |
| `pnpm build`, Terra e Sol | **exit 0**, 885 pagine |
| `pnpm check:links`, Terra e Sol | **exit 0**, **166.635** link interni, 0 problemi |
| `pnpm data:diff`, Terra e Sol | **exit 1**, stessi due errori ART-0001/ART-0002 già reviewed ereditati da B06; nessun errore nuovo B08, nessuna deroga |
| `git diff --check` | Pulito |

**Browser sulla build finale:**

- **375×812, IT ed EN, chiaro e scuro:** x stabile **38–337 px**, larghezza 299 px, nessun overflow orizzontale del fascicolo o della pagina a 375 px. Screenshot osservati del pannello nei due temi.
- **Apertura e riapertura mobile:** nome `case-in-bottom`; osservate matrici `matrix(1, 0, 0, 1, 0, 35.2406)` e `matrix(1, 0, 0, 1, 0, 15.176)`, con x sempre 38 e destra 337. A fine ingresso `transform: none` e posizione finale identica alla base.
- **1440×900, IT ed EN, chiaro e scuro:** nome `case-in`, posizione stabile **998–1382 px**, larghezza 384 px, nessun overflow interno. Osservato l'ingresso orizzontale ancora presente. Screenshot del desktop chiaro e scuro.
- **759/760 px:** `case-in-bottom` a 759 e `case-in` a 760, coerentemente con la geometria esistente. La traslazione orizzontale transitoria a 760 è l'ingresso desktop previsto, non un nuovo errore mobile.
- **Contenuto lungo RU EN:** 15 relazioni, scrollHeight 2.487 px e clientHeight 375 px. Scroll interno osservato da 0 a **243,5 px**, con scroll della pagina fermo a **756,5 px**. Posizione orizzontale e larghezza corrette; bacheca delle ipotesi KERIMOV verificata con lo stesso ingresso verticale e senza overflow.
- **Interazioni:** isolamento → 4 schede / 3 fili; ripristino; selezione di GVA Capital dal fascicolo con caveat G-0087 presente; apertura della scheda completa correttamente su `/entities/GVA/`; chiusura e riapertura del fascicolo riuscite.
- Nessun errore console osservato; tema Sistema e viewport predefinito ripristinati, server temporaneo arrestato.

**Reduced motion:** il browser disponibile espone soltanto visibilità e viewport, senza emulazione della preferenza. Verificato staticamente che entrambe le animazioni sono applicate solo sotto no-preference; non si dichiara una prova runtime di reduce o una prova su hardware mobile reale.

Log Sol: `/private/tmp/b08-sol-{check,contrast,build,links,data-diff}.log`. Snapshot locale temporaneo: `/private/tmp/b08-before.json`. Queste evidenze non sono dipendenze del repository.

**Limiti confermati:** il taglio persistente riportato in C non è stato riprodotto; B08 allinea l'asse dell'ingresso alla specifica, conservando la geometria stabile. Nessuna correzione dell'overflow generale osservato a 320 px. I due errori del diff probatorio da B06 rimangono espliciti: il ramo non viene dichiarato pronto al merge. Nessun uso di relaxed, etichette, bypass, push o PR.

**Commit di chiusura:** unico commit `fix(board): animate mobile case files from the bottom`. La riga §5 identifica questo stesso commit tramite il soggetto; l'hash viene fissato dal log nel successivo handoff, perché incorporarlo nel commit ne cambierebbe l'hash. Prossimo blocco raccomandato: **B09**.
