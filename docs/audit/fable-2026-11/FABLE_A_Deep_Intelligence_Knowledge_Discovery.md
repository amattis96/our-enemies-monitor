# FABLE A — Deep Intelligence & Knowledge Discovery

**Progetto:** Our Enemies Monitor · **Branch:** `main` · **Commit analizzato:** `d1f6a97601409f00f2bdefc47533b7b2f75d47ff` · **Data analisi:** 14 novembre 2026

Legenda delle etichette usate per ogni risultato e raccomandazione:

- **[ACCERTATO]** — comportamento o stato verificato sui dati o sul codice, riproducibile con i comandi indicati.
- **[LIMITE]** — limite dimostrabile del modello o del corpus: non è un bug, ma impedisce una classe di analisi.
- **[OPPORTUNITÀ]** — proposta progettuale; non descrive qualcosa che esiste.

Nessun file del repository è stato modificato, a parte la creazione di questo rapporto (non tracciato, non committato). Le associazioni statistiche descritte qui non sono prove di coordinamento fra attori.

---

## 1. Executive summary

Le scoperte sono ordinate per peso epistemico, non per facilità di correzione.

1. **La catena probatoria si ferma ai documenti di sintesi del corpus, non alle fonti primarie.** [ACCERTATO] 429 relazioni su 458 (93,7%) citano come fonte soltanto documenti del corpus (`S00`–`S09`). Tutti i 281 archi di partecipazione della baseline citano `S06`, cioè la cronologia stessa che definisce l'evento a cui si riferiscono. Dei 41 riferimenti esterni `F01`–`F30` e `P01`–`P11`, 40 non sono citati da nessun record: sono collegati solo al documento che li elenca (`cited_in: S00` o `S08`). Il conteggio delle fonti di un record misura quindi quante sintesi lo ripetono, non quante evidenze indipendenti lo sostengono.

2. **Aggiornare un'ipotesi la fa sparire dal sito.** [ACCERTATO] 11 delle 22 ipotesi della baseline, fra cui 3 delle 7 critiche (`H02`, `H08`, `H20`), sono escluse dalla proiezione pubblica. La causa è una sola: Fonte_09 ha aggiunto al loro campo `events` un evento `EXT-*` ancora in attesa, e `publishedDataset` scarta ogni ipotesi con un evento collegato non pubblico. Il sito mostra 11 ipotesi su 32, e mancano proprio quelle su cui è arrivata nuova evidenza.

3. **Il grafo contiene affermazioni negative codificate come archi positivi, e i caveat non arrivano al grafo pubblicato.** [ACCERTATO] 18 relazioni dirette hanno un caveat che nega un'inferenza (per esempio `G-0087`: «Non dimostra denaro Kerimov verso SpaceX»). `graph.json` esporta solo predicato, gruppo e livello. Il cammino minimo fra `KERIMOV` e `SPACEX` nel grafo delle evidenze coincide esattamente con la catena che `H06` vieta di inferire. Qualunque algoritmo di cammini, e qualunque lettore del grafo, ricostruisce l'inferenza proibita.

4. **Il cancello di pubblicazione degli articoli controlla i link dichiarati, non il contenuto.** [ACCERTATO] `ART-0002` tratta i pacchi incendiari DHL/DPD (evento canonico `TL-0064`, ipotesi `H02`) ma dichiara `events: []`, `relationships: []`, `hypotheses: []`. Supera il cancello senza che nulla venga verificato e contiene una propria matrice E1–E5 non collegata ad alcun record. Se avesse collegato `H02`, che è trattenuta (punto 2), l'articolo sarebbe stato trattenuto: il sistema premia chi collega meno.

5. **`evidence_status` non porta informazione e la scala E1–E4 mescola due dimensioni.** [ACCERTATO] In 458 relazioni su 458 lo stato è funzione del livello (E1↔`documented`, E2↔`institutional_attribution`, E3↔`corroborated`, E4↔`allegation`). La scala descrive il *tipo* di base probatoria ma viene trattata come ordinale. In più il livello descrive la natura del fatto affermato, non l'evidenza acquisita: 49 relazioni dirette E1 su 84 non hanno `primary_url`, e 7 eventi `EXT` E1 su 17 citano solo stampa.

6. **Il segnale di co-partecipazione nel grafo misura la frammentazione dei casi, non connessioni latenti.** [ACCERTATO] Contro un modello nullo che preserva i gradi, le coppie di entità che condividono almeno due eventi sono 15 contro 4,5 attese (massimo fra 10 e 12 su 500 simulazioni, secondo l'esecuzione). Ma tutte le coppie più significative sono lo stesso caso registrato in più record (`LEE`–`UFWD` in `TL-0026` e `TL-0035`, e simili). Manca il concetto di *caso*.

7. **Le connessioni latenti più ricche sono già scritte nel testo dei record.** [ACCERTATO] 33 entità su 220 (15%) non hanno alcun arco. `VIGINUM` è nominata nel testo di 5 eventi, uno dei quali si intitola «VIGINUM mappa Portal Kombat», e ha zero relazioni. Un confronto testo–grafo trova 134 menzioni di entità prive dell'arco corrispondente in 74 eventi.

8. **Il corpus è recente, anglo-americano e centrato sugli Stati.** [ACCERTATO] Il 36% degli eventi integrati è del 2026 e il 69% del 2024–2026. Solo 39 eventi di timeline su 147 hanno almeno un luogo nell'UE a 27, mentre 62 hanno solo luoghi extra-UE; gli Stati Uniti sono il primo luogo (27 eventi). Undici Stati membri non compaiono mai.

9. **Nessun record è mai stato revisionato e nessuna ipotesi ha mai cambiato stato.** [ACCERTATO] Zero record `reviewed` su 1.011; 32 ipotesi su 32 `open_unproven`. L'ingestione M6 non è mai stata eseguita su dati reali: Fonte_10 e Fonte_11 sono archiviate senza sidecar e senza record `S10`/`S11`.

La direzione che ne deriva: prima di aggiungere algoritmi di scoperta conviene dare al modello tre cose che oggi mancano — il *claim* come unità, la *genealogia* delle fonti e la *conoscenza negativa* leggibile dalla macchina. Senza queste, ogni algoritmo di grafo amplifica i difetti dei punti 1, 3 e 6.

---

## 2. Snapshot del repository e metodo

### 2.1 Stato verificato

| Elemento | Valore | Come è stato verificato |
| --- | --- | --- |
| Commit | `d1f6a97` su `main`, albero pulito | stato Git a inizio analisi |
| `pnpm validate` | 0 errori, 1 avviso (`G-0230`) | eseguito |
| Eventi | 181: 147 `TL-*` integrati (1 è `dataset_metadata`), 34 `EXT-*` in attesa | conteggio file |
| Entità | 220 (51 organizzazioni, 40 istituzioni, 37 asset, 35 aziende, 32 Stati, 25 persone) | conteggio file |
| Relazioni | 458: 291 di partecipazione, 167 dirette | conteggio file |
| Ipotesi | 32 (7 critiche, 12 alte, 13 medie), tutte `open_unproven` | conteggio file |
| Fonti | 106: 10 documenti del corpus, 95 riferimenti esterni, 1 `WEB` non specificata | conteggio file |
| Esposizioni | 14 | conteggio file |
| Proiezione pubblica | 147 eventi, 202 entità, 433 relazioni, **11 ipotesi**, 56 fonti, 14 esposizioni | `pnpm audit:publication` |
| Stato di revisione | 0 `reviewed`; 887 `imported_unreviewed`; 124 `needs_review` | conteggio per collezione |

I conteggi coincidono con quelli dichiarati in `docs/ARCHITECTURE.md` per lo stato dopo Fonte_09. La baseline storica (151/202/444/22/55/14) non descrive più il dataset.

### 2.2 Implementato, parziale, mancante

| Capacità | Stato | Nota |
| --- | --- | --- |
| Modello Zod, validazione, provenienza riga per riga | Implementato | `src/model/schemas.ts`, `src/pipeline/validate.ts` |
| Cancello di pubblicazione M5 | Implementato | `src/site/publication.ts`; effetto collaterale al §4.3 |
| Ingestione da sidecar (`pnpm ingest`) | Implementata, **mai usata su dati reali** | in `sources/incremental/` non c'è nessun `*.proposals.json`; esiste solo la fixture di test |
| Fonte_10 (7 voci OEM), Fonte_11 (1 voce), 2 fonti tematiche | Solo archiviate | nessun record `S10`/`S11`; nessun record canonico derivato |
| Claim atomici | Parziale, fuori dal modello | 20 claim in `docs/audit/M5_2026-11-12.json`; i claim dei sidecar finirebbero in `review.notes` |
| Concetto di caso | Parziale, fuori dal modello | `case_id` nel registro M5, `case_key` nel front matter tematico |
| Genealogia e indipendenza delle fonti | Mancante | solo testo libero in `publisher` |
| Validità temporale delle relazioni | Mancante di fatto | campi presenti, vuoti su tutte le 444 relazioni della baseline |
| Conoscenza negativa strutturata | Mancante | solo testo in `caveat` e `review.notes` |
| Ciclo di vita delle ipotesi | Vocabolario presente, mai usato | stati `promoted`, `refuted`, `closed_insufficient` mai assegnati |

Nota documentale: `docs/ARCHITECTURE.md` e `docs/M6_CHATGPT_OSINT_WORKFLOW.md` contengono paragrafi scritti in date diverse che si contraddicono sullo stato di Task B («planned, not scheduled» e «only demo fixtures» accanto a «Active» e ad articoli reali pubblicati). Non incide sui dati, ma un agente che legge un solo paragrafo ottiene uno stato sbagliato.

### 2.3 Metodo

Lettura completa di `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/M6_CHATGPT_OSINT_WORKFLOW.md`, `docs/M5_EVIDENCE_AUDIT.md`, di `src/model/schemas.ts`, `vocabularies.ts`, `src/site/publication.ts`, `read-model.ts`, `exports.ts`, `research.ts`, `src/pipeline/validate.ts`. Poi analisi programmatica dell'intero contenuto di `data/` (1.011 record) con script Python di sola lettura, campionamento mirato dei record anomali e ricostruzione manuale di cinque percorsi dato → codice → output. Gli script non fanno parte del repository; l'appendice A riporta il nucleo riproducibile.

Limiti del metodo: nessuna fonte web è stata riaperta, quindi nulla qui verifica la verità di un'affermazione del corpus. `README.md`, `docs/CHATGPT_SCHEDULED_TASKS.md`, `src/pipeline/ingest/plan.ts` e le fonti in `sources/` non sono stati letti per intero: le affermazioni sull'ingestione si basano sulla documentazione M6 e sullo stato dei file, non su una revisione riga per riga del codice.

---

## 3. Diagnosi dei limiti epistemici attuali

Il progetto ha regole probatorie migliori del suo modello dati. `AGENTS.md` impone di separare evento, autore, mandante, movente e impatto, ma il modello ha un solo `evidence_level` per record e nessun posto dove mettere quattro affermazioni distinte. Quello che la regola separa, lo schema riunisce.

Le conseguenze si vedono in quattro punti.

**L'unità di evidenza è il record, non l'affermazione.** Gli eventi di timeline non hanno livello (`evidence_level: null` su 147) ma una nota libera: 149 valori distinti su 181 eventi. In 43 eventi la nota è un verdetto diviso, per esempio «Evento accertato; mandante statale contestato» (`TL-0001`). La seconda metà del verdetto non esiste in forma strutturata.

**Il livello descrive il fatto affermato, non l'evidenza posseduta.** `G-0450` (`BBT` → `EXT-010`, `DICHIARA_INCIDENTE`) è E1 «documented» con `primary_url: null`, e il suo caveat dichiara che «il comunicato della società non è stato acquisito». Il livello dice che esiste un atto primario; il record dice che nessuno l'ha letto.

**La fonte di un record è un altro prodotto dello stesso processo di ricerca.** Vedi §4.1.

**Il sistema sa che cosa non si deve inferire, ma lo sa solo in prosa.** Vedi §4.4.

Nessuno di questi difetti produce un errore di validazione: schema, riferimenti, forma canonica e provenienza sono tutti corretti. Sono difetti semantici che sopravvivono a `pnpm check`.

---

## 4. Risultati delle analisi eseguite sui dati

### 4.1 Dove finisce la catena delle fonti [ACCERTATO]

| Misura | Valore |
| --- | --- |
| Relazioni che citano solo documenti del corpus (`S00`–`S09`) | 429 / 458 |
| Archi di partecipazione baseline che citano `S06` | 281 / 281 |
| Relazioni che citano almeno un riferimento esterno | 29 (di cui 13 solo esterni) |
| Riferimenti `F*`/`P*` citati direttamente da un record | 1 / 41 (`P06`, da 3 esposizioni) |
| Eventi di timeline che citano solo documenti del corpus | 147 / 147 |
| Relazioni con «più fonti» (≥ 2) | 347, quasi tutte coppie di documenti del corpus |

Perché non si vede a una lettura normale: ogni record ha un campo `sources` popolato e valido, e la pagina di una fonte mostra i record che la citano. Solo incrociando le due direzioni si nota che i riferimenti primari (Consiglio UE, OFAC, CPS, Citizen Lab…) esistono come record ma non sono agganciati a nessuna affermazione.

Spiegazione alternativa considerata: i documenti `S00`–`S05` contengono al loro interno le citazioni puntuali, quindi la catena esisterebbe «dentro» il Markdown. È vero, ma non è navigabile né verificabile dalla macchina: per sapere quale riferimento sostiene `G-0010` bisogna rileggere un documento di 40–60 KB. Inoltre `S06`, `S07` e `S08` sono consolidamenti di `S00`–`S05`: un record che cita `S06`, `S00` e `S03` cita tre livelli della stessa sintesi.

Conseguenza: sulla baseline non è possibile nessuna analisi di indipendenza delle fonti (§5, A2), perché il dato necessario non è nel modello.

### 4.2 Ridondanza e natura della scala di evidenza [ACCERTATO]

| Livello | Stato | Relazioni |
| --- | --- | --- |
| E1 | `documented` | 181 |
| E2 | `institutional_attribution` | 68 |
| E3 | `corroborated` | 208 |
| E4 | `allegation` | 1 |

Non esiste nessun'altra combinazione. Il sito mostra entrambi i campi (`RelationshipTable.astro`), dando l'impressione di due valutazioni indipendenti.

La scala non è ordinale. E2 (attribuzione istituzionale) ed E3 (inchiesta indipendente) sono basi di tipo diverso, non gradini. Il codice e l'import le trattano però come ordinate: per Fonte_09 è stato scelto «il più basso» di due livelli, e `src/pipeline/diff.ts` segnala i livelli «raised». Un esempio di incoerenza che ne deriva: `SHOR` è collegato alle elezioni moldave come `OPERATOR_NETWORK` a E3 in `TL-0053` e come `ATTRIBUTED_NETWORK` a E2 in `TL-0077`, mentre la nota di entrambi gli eventi parla di attribuzione istituzionale. Il predicato più forte ha il livello che un lettore interpreta come più debole.

E1 senza documento primario:

- 49 relazioni dirette E1 su 84 non hanno `primary_url`;
- 7 eventi `EXT` E1 su 17 citano soltanto stampa: `EXT-010`, `EXT-011`, `EXT-012`, `EXT-013`, `EXT-014`, `EXT-026`, `EXT-034`.

### 4.3 Il cancello di pubblicazione trattiene le ipotesi aggiornate [ACCERTATO]

`src/site/publication.ts` pubblica un'ipotesi solo se soggetto, oggetto e **tutti** gli eventi in `events` sono pubblici. Fonte_09 ha aggiunto eventi `EXT-*` in attesa a ipotesi della baseline. Risultato:

| Ipotesi | Priorità | Evento in attesa che la trattiene |
| --- | --- | --- |
| `H02` | critica | `EXT-024` |
| `H08` | critica | `EXT-025` |
| `H20` | critica | `EXT-017`, `EXT-018` |
| `H10`, `H11`, `H12` | alta | `EXT-019` |
| `H16` | alta | `EXT-027` |
| `H17` | alta | `EXT-026` |
| `H19` | alta | `EXT-017` |
| `H21` | alta | `EXT-024` |
| `H13` | media | `EXT-021` |

Perché non emerge: nessun test fallisce e nessun avviso viene stampato; `pnpm audit:publication` riporta «hypotheses: 11» senza dire quali mancano né perché. La documentazione garantisce che l'ingestione M6 «non cambia mai ciò che il sito mostra», ma la garanzia copre solo `pnpm ingest`, non l'import manuale di Fonte_09.

Spiegazione alternativa: il comportamento potrebbe essere voluto, per non esporre un'ipotesi il cui testo rimanda a un evento non pubblico. In tre casi, però, la nota di Fonte_09 dice esplicitamente che l'ipotesi originale è invariata (`H08`: «original hypothesis unchanged»; `H10`–`H12`: la sentenza Fitburg «does not resolve» le ipotesi). L'ipotesi pubblica precedente era ancora valida ed è stata rimossa. Va confermato con il manutentore se è l'effetto desiderato.

Lo stesso meccanismo trattiene anche 10 relazioni della baseline (`G-0394`–`G-0398`, `G-0401`–`G-0405`), qui correttamente: il loro estremo è un evento `EXT-001`–`004` in attesa.

### 4.4 Conoscenza negativa e cammini proibiti [ACCERTATO]

Tre cammini minimi nel grafo delle relazioni dirette, con i caveat di ogni arco:

**`KERIMOV` → `SPACEX`** (5 archi)

| Arco | Relazione | Livello | Caveat |
| --- | --- | --- | --- |
| `G-0088` | `GVA` GESTISCE_ASSET_SANZIONATI `KERIMOV` | E1 | Accertamento OFAC 2025 |
| `G-0087` | `SOB` COLLEGAMENTO_SOCIETARIO_SEPARATO `GVA` | E3 | Non dimostra denaro Kerimov verso SpaceX |
| `G-0086` | `SOB` FIRMA_DOCUMENTI_SOCIETARI `HAL9001` | E3 | *(nessuno)* |
| `G-0085` | `HAL9001` LP_INVESTE_FONDO `TOMALES` | E3 | ~$10 milioni nel fondo intermediato |
| `G-0084` | `TOMALES` FONDI_PARTECIPANO_CAPITALE `SPACEX` | E3 | Nessun diritto decisionale operativo dimostrato |

L'ipotesi `H06` dichiara: «NESSUNA prova nel corpus; vietata la catena per semplice vicinanza Sob-GVA». Il cammino minimo è quella catena.

**`RU` → `PROTEST26`** (3 archi): `G-0425` → `G-0427` («Meccanismo macro, non imputazione singoli scioperi») → `G-0429` («La causa specifica di una protesta non è deducibile meccanicamente»). È l'inferenza su cui verte `H15`.

**`X` → `US`** (2 archi, via `EU`): `G-0078` («120 milioni per trasparenza, non per collusione russa») e `G-0072` («Strategia pubblica, non regia occulta con Russia»). È l'inferenza su cui verte `H07`.

Misure d'insieme:

- 18 relazioni dirette hanno un caveat che è una negazione; 73 non hanno alcun caveat;
- 286 archi di partecipazione su 291 condividono lo stesso caveat standard;
- i 9 «forbidden edge» di Fonte_09 §8.3 esistono solo come frasi in inglese dentro `review.notes` di eventi (`EXT-008`, `009`, `010`, `012`, `013`, `017`, `019`, `020`, `030`); un test li protegge, ma nessuna struttura li rappresenta;
- `graph.json` (`evidenceGraph` in `src/site/read-model.ts`) esporta per ogni arco `predicate`, `group` ed `evidence_level`. Il caveat compare solo nelle tabelle delle pagine di entità ed evento.

### 4.5 Struttura del grafo e modello nullo [ACCERTATO]

| Misura | Valore |
| --- | --- |
| Partecipanti per evento | 1 in 24 eventi, 2 in 114, 3 in 13; mai più di 3 |
| Eventi senza alcun partecipante | 30 (tutti i candidati Fonte_09 `EXT-005`–`034`) |
| Componenti connesse (grafo completo) | 72: una da 297 nodi, 56 nodi singoli |
| Entità senza alcun arco | 33 / 220 |
| Entità solo in archi di partecipazione / solo in archi diretti | 30 / 56 |
| Predicati distinti | 299 su 458 archi (147 su 167 diretti) |
| Archi degli Stati più connessi | `RU` 37, `CN` 23, `US` 19 |

Due partecipanti per evento, quasi sempre, non è una proprietà del mondo: è l'impronta del modo in cui Fonte_07 è stata compilata. Ogni evento è di fatto un arco binario con un'etichetta lunga.

Esperimento di co-partecipazione. Proiezione entità–entità attraverso gli eventi condivisi: 135 coppie, 15 con almeno due eventi in comune. Modello nullo: 500 randomizzazioni del grafo bipartito con scambio di archi che preserva il grado di ogni entità e di ogni evento. Coppie con ≥ 2 eventi attese: media 4,5, massimo 10 in una esecuzione e 12 in un'altra. L'eccesso osservato è reale.

| Coppia | Eventi condivisi | p empirico | Lettura |
| --- | --- | --- | --- |
| `LEE`–`UFWD` | `TL-0026`, `TL-0035` | 0,000 | indagine MI5 e alert MI5: due record dello stesso caso |
| `SHOR`–`MOLDELEC` | `TL-0053`, `TL-0077` | 0,000 | due record con periodi sovrapposti (2024–25 e 2025) |
| `BLACK`–`ROKH` | `TL-0113`, `TL-0131` | 0,000 | stessa operazione; già coperta da `G-0047` e `H04` |
| `APT31`–`ELECTCOM` | `TL-0025`, `TL-0054` | 0,000 | intrusione e successiva attribuzione |
| `CEUTA`–`ES` | `TL-0117`, `TL-0130` | 0,000 | un luogo e lo Stato che lo contiene |
| `EEAS`–`STORM` | `TL-0071`, `TL-0080` | 0,000 | chi pubblica il rapporto e l'operazione descritta |
| `RU`–`US` | 4 eventi | 0,010 | due hub; ruoli eterogenei (attribuzione, trattato, controparte) |
| `EU`–`US`, `CN`–`EU` | 2 eventi | 0,18 – 0,21 | compatibile con il caso |

Nessuna coppia rappresenta una connessione non già nota. Il test funziona, ma ciò che rileva è che il corpus registra uno stesso caso in più eventi.

### 4.6 Connessioni presenti nel testo e assenti nel grafo [ACCERTATO]

Confronto fra i nomi delle entità (segmenti del nome italiano, normalizzati, con lista di esclusione) e il testo di titolo e descrizione di ogni evento, escludendo le entità già collegate all'evento da un arco di partecipazione.

- 134 menzioni senza arco, in 74 eventi (71 in eventi di timeline).
- Fra le 38 menzioni di entità non statali nella timeline, 6 sono falsi positivi evidenti del matcher (segmenti generici come «collegati», «nave», «diesel russo») e circa 32 sono plausibili a lettura diretta.

| Evento | Entità nominata nel testo, senza arco | Nota |
| --- | --- | --- |
| `TL-0055` «VIGINUM mappa Portal Kombat» | `VIGINUM`, `TIGERWEB` | `VIGINUM` non ha alcun arco nel dataset |
| `TL-0049`, `TL-0067`, `TL-0113`, `TL-0143` | `VIGINUM` | idem |
| `TL-0053`, `TL-0077`, `TL-0115` | `EVRAZIA` | ha archi diretti con `SHOR`, nessuno con gli eventi |
| `TL-0060` Sanzioni UE su Voice of Europe | `MED`, `MAR` | il testo dice che il Consiglio li designa entrambi |
| `TL-0084` Procedimenti OFAC su GVA e IPI | `OFAC`, `SPACEX` | l'autorità che emette l'atto non è collegata |
| `TL-0058` Incendio del magazzino londinese | `STARLINK` | il testo cita «materiali Starlink» fra i beni colpiti |
| `TL-0063` Complotto contro Armin Papperger | `RHEIN` | |
| `TL-0069` Estlink 2 | `SHADOW` | |
| `TL-0120` Incendio contro Milrem Robotics | `KAPO` | `KAPO` non ha alcun arco |
| `TL-0117` Afflusso a Ceuta | Marocco (`MA`) | `MA` è isolata ma è soggetto di `H09` |

Altre entità isolate degne di nota: `IRGC` (nominata in 3 eventi; Fonte_09 riporta un'attribuzione francese a un'unità collegata), `PUTIN` (unica persona senza archi), `TEAMJORGE`, `PALANTIR`, `BIS`, `UKINT`. `BIS` è però collegata da `ART-0001`: l'articolo usa un'entità che il grafo ignora.

Spiegazione alternativa: una menzione nel testo non è sempre un ruolo nell'evento («NATO» in un evento sul partenariato Russia–Iran è contesto). Per questo il risultato è una coda di revisione, non un elenco di archi da creare.

### 4.7 Indipendenza delle fonti nei candidati Fonte_09 [ACCERTATO]

È l'unica parte del corpus dove l'analisi è possibile, perché gli eventi `EXT` citano riferimenti esterni.

| Misura | Valore |
| --- | --- |
| Eventi `EXT` con riferimenti esterni | 34 |
| Con un solo riferimento | 18 |
| Con un'unica origine editoriale, dopo aver ricondotto le ripubblicazioni | 20 |
| Riferimenti `WEB-EXT` da tre agenzie (Reuters 11, AP 7, ANSA 6) | 24 / 54 |
| Riferimenti `WEB-EXT` su dominio istituzionale | 13 / 54 |

Casi concreti di molteplicità apparente:

- `EXT-005` (attribuzione francese all'Iran): tre riferimenti — ministero degli Esteri francese, Reuters, e Reuters ripubblicata da Internazionale. I due lanci riferiscono la dichiarazione del ministero. Tre riferimenti, una radice.
- `EXT-034`: due riferimenti, entrambi Reuters (originale e via Internazionale). Livello E1.
- `EXT-022` (Reuters e Reuters via Investing.com, più The Guardian) ed `EXT-027` (Reuters e Quartz «da Reuters»).
- `EXT-007` ed `EXT-008`: due lanci ANSA contati separatamente.

L'unica traccia della genealogia è il testo libero del campo `publisher`: «Reuters (via Internazionale)», «Quartz (da Reuters)», «Associated Press (ripubblicato da The Washington Post)». Chi ha compilato Fonte_09 conosceva la derivazione; il modello non ha dove registrarla.

### 4.8 Squilibri del corpus [ACCERTATO]

| Dimensione | Dato |
| --- | --- |
| Eventi integrati per periodo | 2007–2019: 19 · 2020–2023: 27 · 2024: 23 · 2025: 25 · 2026: 53 |
| Precisione delle date (181 eventi) | giorno 65, mese 57, anno 59 |
| Precisione nel 2025 | 17 eventi su 25 hanno solo l'anno |
| Eventi di timeline con almeno un luogo UE-27 | 39 / 147 |
| Con soli luoghi extra-UE | 62 / 147 |
| Senza alcun luogo | 46 / 147 |
| Luoghi più frequenti | `US` 27, `GB` 17, `UA` 13, `FR` 10, `RU` 10, `CN` 10 |
| Stati membri mai presenti come luogo | AT, BG, CY, DK, GR, HR, HU, LU, MT, SI, SK |
| Temi meno coperti | `surveillance_spyware` 3, `migration_borders` 6, `platforms_technology` 6 |
| Relazioni dirette della baseline con validità temporale | 0 / 153 |
| Relazioni dirette senza alcun evento collegato | 29 / 167 |

### 4.9 Registro delle ipotesi [ACCERTATO]

- `hypothesis_type` è unico per ogni ipotesi (32 valori su 32): funziona da identificativo, non da tipo. L'ingestione però deduplica le ipotesi per uguaglianza di tipo, quindi quel criterio scatta solo su una riesecuzione.
- Le 10 ipotesi di Fonte_09 hanno tutte priorità `medium` provvisoria.
- Cinque ipotesi (`H01`, `H03`, `H04`, `H05`, `H17`) insistono su una coppia che ha già una relazione diretta: l'ipotesi riguarda una qualità ulteriore del legame, che il modello non sa distinguere dall'arco esistente.
- Le evidenze richieste si sovrappongono fra ipotesi diverse:

| Tipo di evidenza richiesta | Ipotesi |
| --- | --- |
| Contratti | `H01`, `H02`, `H03`, `H05`, `H07`, `H08`, `H18` |
| Comunicazioni, chat, Telegram | `H02`, `H09`, `H19`, `H22`, `H23` |
| Analisi forense | `H05`, `H10`, `H11`, `H25`, `H28` |
| Flussi di pagamento, wallet | `H01`, `H02`, `H14`, `H23` |
| Atti giudiziari | `H11`, `H20`, `H22`, `H30` |
| Registri societari, titolari effettivi | `H04`, `H06`, `H28`, `H31` |
| Tracciati AIS | `H10`, `H11`, `H21` |

### 4.10 Un risultato negativo: la traduzione non cancella le cautele

Ipotesi di partenza: la traduzione automatica in inglese potrebbe perdere i marcatori di cautela («presunto», «secondo», «non provato»). Test: su 1.346 testi bilingui di eventi, relazioni e ipotesi, quanti hanno un marcatore in italiano e nessuno in inglese? Risultato: 10, e alla lettura sono differenze lessicali del rilevatore, non cautele perse. Con questo test grossolano il passaggio di traduzione non altera il significato probatorio. Il rischio di perdita sta altrove (§4.4, §5 A1).

---

## 5. Analisi degli ambiti A1–A7

### A1. Integrità epistemica e propagazione delle evidenze

Percorso di un'affermazione e punti in cui cambia significato:

| Passaggio | Che cosa succede al significato | Evidenza |
| --- | --- | --- |
| Fonte primaria → documento di sintesi | la citazione puntuale resta nel Markdown, non nel dato | §4.1 |
| Sintesi → evento di timeline | il verdetto diviso diventa una nota libera, senza livello | 43 eventi; 147 con `evidence_level: null` |
| Evento → arco di partecipazione | la seconda metà del verdetto scompare; l'arco riceve un livello proprio e un caveat standard | `TL-0059`: nota «attribuzione istituzionale contestata dalla Russia»; arco `G-0224` `RU` OFFICIAL_ATTRIBUTION E2 con il caveat generico |
| Fonte incrementale → record | due livelli («E1 atto / E2 attribuzione») ridotti a uno | regola dichiarata in `docs/ARCHITECTURE.md` |
| Sidecar → record | autore, mandante, movente e impatto diventano stringhe in `review.notes` | `docs/M6_CHATGPT_OSINT_WORKFLOW.md` §4.8 |
| Record → `graph.json` | il caveat non viene esportato | `evidenceGraph` |
| Record → articolo | l'articolo riassegna livelli E1–E5 per conto proprio | `ART-0002`, «Matrice delle evidenze» |
| Arricchimento → proiezione pubblica | l'ipotesi arricchita viene trattenuta | §4.3 |

Che cosa il sistema rappresenta oggi:

| Requisito | Stato |
| --- | --- |
| Chi afferma e chi conferma | Non rappresentato. Sopravvive solo nei predicati (`OFFICIAL_ATTRIBUTION`, `COMMITTENZA_SECONDO_OFAC`) e nel testo |
| Evidenza primaria e interpretazione secondaria | Parziale: `primary_url` sulle relazioni; nessuna distinzione fra le fonti citate |
| Certezza sul singolo nesso | Sì per le relazioni; no per gli aspetti di un evento |
| Conoscenza disponibile a una data | Solo attraverso la storia Git; i record non hanno data di asserzione |
| Evidenze contrarie, smentite | Testo libero: 19 eventi contengono una smentita nel testo, 5 nelle note. Il sidecar prevede `contrary_evidence`, il record canonico no |
| Fatto, attribuzione, impatto | Dichiarato come regola, non modellato |

Il caso `ART-0002` merita una precisazione. L'articolo è scritto con cura e separa esplicitamente accuse e condanne. Il problema non è il suo contenuto ma il fatto che il sistema non può saperlo: non ha link verso eventi, relazioni o ipotesi, quindi il cancello non ha nulla da controllare e le pagine di `TL-0064` e di `H02` non lo mostrano. Non è possibile stabilire dai dati se l'omissione sia deliberata.

### A2. Indipendenza reale delle fonti

Sulla baseline l'analisi è impossibile (§4.1). Su Fonte_09 è possibile e mostra che la molteplicità dei riferimenti sopravvaluta la corroborazione (§4.7).

Modello proposto [OPPORTUNITÀ]. Tre aggiunte al record `Source`, senza cambiare tecnologia:

```jsonc
{
  "id": "WEB-EXT-007",
  "origin_type": "republication",          // primary_document | official_statement | wire |
                                           // original_reporting | republication | synthesis | corpus_synthesis
  "derived_from": ["WEB-EXT-006"],         // fonte di cui è copia, rilancio o riscrittura
  "relies_on": ["WEB-EXT-005"]             // fonte primaria che riferisce (es. la dichiarazione del ministero)
}
```

Da questi campi si calcola, a build time, la **radice** di ogni fonte (chiusura transitiva di `derived_from` e `relies_on`) e per ogni affermazione due numeri distinti: *riferimenti* e *radici indipendenti*. Regole:

- un documento `corpus_synthesis` non conta mai come radice;
- due fonti con la stessa radice contano una volta;
- un ciclo in `derived_from` è un errore di validazione (citazione circolare);
- due radici indipendenti che arrivano a conclusioni diverse sono un disaccordo da registrare, non una media da calcolare.

Applicato a oggi: `EXT-005` passerebbe da «3 fonti» a «1 radice (dichiarazione ufficiale), 2 rilanci»; `EXT-034` da «2 fonti» a «1 radice (agenzia)».

Ciò che questo modello non risolve: fonti che condividono un informatore senza dichiararlo. Qui servono euristiche di supporto, da usare come segnali per un revisore: somiglianza testuale fra articoli, stessa citazione virgolettata, stesso errore fattuale ripetuto, pubblicazione entro poche ore dal lancio d'agenzia.

### A3. Scoperta di interconnessioni latenti

Risultato principale: su questo grafo, oggi, i metodi strutturali non hanno abbastanza segnale, e il segnale che c'è è un artefatto.

- 167 relazioni dirette con 147 predicati distinti: nessun motivo può ricorrere, perché quasi ogni arco è di un tipo unico.
- Nessuna relazione diretta della baseline ha una data: nessun grafo temporale è possibile sugli archi diretti.
- Gli eventi hanno al massimo tre partecipanti: la proiezione per co-partecipazione è quasi vuota.
- Il test contro il modello nullo (§4.5) rileva la duplicazione dei casi.
- I cammini brevi riproducono le inferenze vietate (§4.4).

Che cosa invece ha prodotto risultati: il confronto testo–grafo (§4.6). Non richiede statistica, è falsificabile record per record e ogni risultato porta con sé la frase che lo giustifica.

Piste emerse, con nessi documentati, nessi ipotetici e spiegazioni concorrenti:

| Pista | Già documentato | Ipotetico | Spiegazioni concorrenti | Evidenza necessaria |
| --- | --- | --- | --- | --- |
| Ruolo di `VIGINUM` come fonte comune di cinque eventi francesi | Il nome compare nel testo di `TL-0049`, `0055`, `0067`, `0113`, `0143` | Che la conoscenza di quei cinque casi dipenda da un'unica istituzione | Citazione solo contestuale in alcuni eventi | Rilettura dei cinque record e dei rapporti VIGINUM citati in `S01`/`S02` |
| `STARLINK` fra i beni colpiti nell'incendio di Londra (`TL-0058`) e oggetto delle restrizioni 2026 (`TL-0137`) | Entrambe le menzioni sono nel testo dei record | Nessun nesso fra i due fatti è documentato | Coincidenza dovuta alla diffusione del prodotto in Ucraina | Nessuna: registrare come ruolo «bene colpito», non come collegamento |
| `OFAC` come autorità comune dei casi Kerimov, Foxtrot e GVA | Archi di partecipazione in 3 eventi; menzioni senza arco in `TL-0012`, `TL-0084` | — | — | Collegare l'autorità emittente è un dato di provenienza, non un'ipotesi |
| Dipendenza delle ipotesi marittime `H10`, `H11`, `H21` dallo stesso tipo di dato | Campo `evidence_needed` | Che un'unica acquisizione di tracciati AIS le faccia avanzare tutte | I tracciati potrebbero essere inconcludenti per ragioni diverse in ogni caso | Verifica della disponibilità pubblica dei tracciati per le tre navi |

Controlli da applicare a qualunque metodo di scoperta futuro [OPPORTUNITÀ]:

1. **Modello nullo che preserva i gradi**, perché `RU`, `EU`, `CN` e `US` sono vicini a tutto.
2. **Collasso per caso prima della proiezione**: gli eventi dello stesso caso contano una volta.
3. **Controllo negativo**: applicare il metodo a coppie che il corpus dichiara non collegate (i 9 «forbidden edge», i 18 caveat negativi). Un metodo che le propone è scartato.
4. **Ablazione degli hub**: il risultato deve sopravvivere alla rimozione dei quattro nodi più connessi.
5. **Confronto controfattuale sulla documentazione**: ripetere l'analisi pesando ogni entità per l'inverso del numero di fonti che la citano.
6. **Criterio di falsificabilità scritto prima**: ogni pista dichiara quale documento la smentirebbe.

### A4. Limiti strutturali del knowledge graph

| Aspetto | Stato attuale | Analisi che oggi è impedita |
| --- | --- | --- |
| Claim atomici | Assenti dal modello; 20 in `docs/audit/` | Confrontare attribuzione e smentita dello stesso fatto |
| Provenienza delle relazioni | Presente a livello di riga CSV; assente verso la fonte primaria | Indipendenza delle fonti |
| Validità temporale | Campi vuoti | Domande «chi controllava X nel 2022?» |
| Revisioni della conoscenza | Solo storia Git | «Che cosa si sapeva il 1° ottobre?» senza ricostruire il repository |
| Attribuzioni multiple o in conflitto | Un arco per attribuzione, senza legame fra loro | Vedere che NATO e Pechino dicono cose opposte su `TL-0065` |
| Intermediari | Catene di archi binari | Distinguere «A paga C tramite B» da «A conosce B, B conosce C» |
| Alias e identità storiche | Assenti; il sidecar ha `aliases`, l'entità no | Riconciliazione di nomi; cambi di proprietà |
| Relazioni n-arie | Assenti | Pagamento con pagatore, beneficiario, tramite, importo, periodo |
| Ignoto esplicito | `null` significa sia «non noto» sia «non cercato» | Distinguere una lacuna da un'assenza |
| Evidenza negativa | Solo testo | §4.4 |
| Dipendenze fra affermazioni | Assenti | Propagare una rettifica |

Esempi di relazione n-aria schiacciata in un arco: `G-0014` (`VOL` PAGA_E_IMPARTISCE_ISTRUZIONI `GILL`) ha importo, periodo ed esito giudiziario nel caveat («~£40.000, attività 2018-19, condanna 2025»). Tre fatti con date e basi diverse in una stringa. `G-0017` porta la fonte nel nome del predicato: FINANZIA_SCHEMA_GILL_SECONDO_REPORTAGE.

Serve un modello più ricco, non una tecnologia diversa. Con circa mille record tutto resta calcolabile in memoria a build time, e file JSON in Git restano adeguati. RDF, Neo4j o un database esterno non risolverebbero nessuno dei limiti in tabella: sono limiti di ciò che viene registrato, non di dove viene conservato. L'unico punto in cui il formato conta è la reificazione, e una collezione `data/claims/` la ottiene con gli strumenti esistenti.

### A5. Distorsioni, vuoti e squilibri

Distinzione fra tre tipi di vuoto, applicata ai dati del §4.8:

| Vuoto osservato | Tipo più probabile | Motivo |
| --- | --- | --- |
| 19 eventi per 2007–2019 contro 53 per il 2026 | Lacuna documentale | Il corpus è stato compilato nell'ottobre 2026 e arricchito giorno per giorno da allora |
| 11 Stati membri mai presenti | Lacuna documentale e linguistica | Fonti in italiano, inglese e francese; nessuna in greco, ungherese, bulgaro, danese |
| 17 eventi del 2025 con la sola indicazione dell'anno | Lacuna conoscitiva del corpus | Fatti recenti e databili, ma la sintesi non ha conservato la data |
| `surveillance_spyware` con 3 eventi | Indeterminato | Può riflettere scarsa attività osservata o scarsa ricerca |
| 46 eventi senza luogo | Scelta di modellazione | Aree sovranazionali e piattaforme non hanno un codice paese |
| `US` primo luogo in un progetto sull'Europa | Dipendenza dalle istituzioni | OFAC, DOJ e Casa Bianca producono atti primari pubblici e in inglese |

Nodi molto connessi per sola scelta di modellazione: `RU` ha 22 partecipazioni con 16 predicati diversi, da `OFFICIAL_ATTRIBUTION` (6) a `TREATY_PARTY`, `EXPORTER`, `CONTEXT_WAR` e `POLITICAL_CONTEXT_NOT_ATTRIBUTION`. La centralità di `RU` somma attribuzioni, contesto e commercio. `EU` è un hub perché è `SANCTIONING_AUTHORITY` in 8 eventi: è l'autore degli atti, non un attore dei fatti.

Eventi pubblici contro reti economiche: 291 archi di partecipazione contro 18 relazioni finanziarie e 7 di proprietà. Le strutture societarie sono la parte meno documentata e quella su cui insistono più ipotesi critiche (`H06`).

### A6. Priorità delle indagini e valore dell'informazione

Oggi la priorità è un'etichetta ereditata da Fonte_07 o un `medium` provvisorio. Non dipende da quanto un'indagine sia fattibile né da quante altre conoscenze sbloccherebbe.

Proposta [OPPORTUNITÀ]: un punteggio per *acquisizione*, non per ipotesi. L'unità da ordinare è «ottenere il documento D», e il suo valore è la somma di ciò che D può decidere.

Per ogni coppia (ipotesi, evidenza richiesta) un revisore assegna quattro valori qualitativi:

| Fattore | Domanda | Scala |
| --- | --- | --- |
| Potere discriminante | Se ottengo D, l'ipotesi può essere confermata **o** smentita? | nullo / parziale / decisivo |
| Ottenibilità | D è pubblico, richiedibile, o inaccessibile? | pubblico / su richiesta (FOIA, registro) / non ottenibile |
| Portata | Quante ipotesi, relazioni E2–E4 e articoli dipendono dall'esito? | conteggio dal grafo |
| Costo dell'errore | Riguarda una persona nominata o un'accusa grave? | sì / no |

Regole contro la distorsione:

- un'evidenza che può solo confermare vale meno di una che può anche smentire; questo penalizza le ipotesi sensazionalistiche, che di solito non hanno un esito negativo osservabile;
- la portata si calcola escludendo gli hub, altrimenti ogni ipotesi che tocca `RU` risulta prioritaria;
- le acquisizioni «non ottenibili» escono dalla coda e vengono registrate come limite permanente dell'ipotesi.

Applicazione ai dati esistenti: i tracciati AIS compaiono in tre ipotesi, sono in buona parte pubblici e possono smentire (un'ancora trascinata in rotta rettilinea a velocità costante è compatibile con l'incidente). I «contratti» compaiono in sette ipotesi ma quasi mai sono ottenibili. Il registro dei soci di `HAL9001` (`H06`) è decisivo ma non pubblico: resta critico come domanda e basso come azione.

Stati mancanti: il vocabolario prevede `refuted` e `closed_insufficient` e nessuno li ha mai usati. Un registro in cui nulla viene mai chiuso non distingue le domande vive da quelle esaurite.

### A7. Capacità investigative nuove

**Audit di contro-inferenza.** [OPPORTUNITÀ] Usare gli algoritmi di scoperta al contrario: non per trovare collegamenti, ma per trovare i punti in cui un lettore o un modello linguistico ne trarrebbe uno non sostenuto. A ogni build si enumerano i cammini brevi fra entità sensibili (persone, Stati, aziende) e si confrontano con un registro di inferenze vietate. Ogni cammino che attraversa un arco con caveat negativo, o che riproduce una coppia vietata, genera un avviso e, sul sito, un'annotazione visibile sul cammino stesso. Il §4.4 è la prima esecuzione manuale di questo audit e ha trovato tre casi su tre tentativi. L'idea rovescia il rapporto fra grafo e cautela: oggi il caveat è un attributo che il lettore deve cercare; con l'audit diventa un vincolo che il sistema verifica.

**Registro delle ricerche senza esito.** [OPPORTUNITÀ] Quando Task A non trova novità, invia un rapporto e non crea alcun file. Il repository conserva quindi le finestre di copertura solo dei giorni in cui è stato trovato qualcosa. Di conseguenza non si può distinguere «nessuna attività osservata» da «nessuno ha cercato», che è la distinzione richiesta in A5. Basta archiviare, per ogni esecuzione, un file minimo con finestra coperta, domande poste, fonti consultate ed esito nullo. Le sequenze di esiti nulli su un tema diventano un dato: giustificano la chiusura di un'ipotesi come `closed_insufficient` e rendono misurabile la copertura per paese e per tema.

**Orologio dell'attribuzione.** [OPPORTUNITÀ] Il sidecar distingue già la data della condotta (`date`) dalla data della nuova evidenza (`published`), ma il record canonico conserva solo la prima. Conservando entrambe si ottiene, per ogni caso, il ritardo fra fatto, prima segnalazione, attribuzione istituzionale e atto giudiziario. Serve a due cose: rispondere a «che cosa si sapeva a una certa data» senza ricostruire la storia Git, e individuare i record in cui la data è quella della pubblicazione. Il codice `date_reflects_publication` esiste ed è usato due volte; `EXT-010` dichiara nelle note lo stesso problema senza usarlo.

---

## 6. Nuove opportunità investigative emerse

| # | Opportunità | Da dove emerge | Tipo |
| --- | --- | --- | --- |
| 1 | Riconciliazione testo–grafo come coda di revisione permanente | §4.6 | metodo, già eseguibile |
| 2 | Audit di contro-inferenza a ogni build | §4.4, A7 | metodo nuovo |
| 3 | Conteggio delle radici indipendenti accanto al numero di fonti | §4.7, A2 | modello |
| 4 | Collezione dei casi, con le fasi come eventi | §4.5 | modello |
| 5 | Coda delle acquisizioni ordinata per valore dell'informazione | §4.9, A6 | metodo |
| 6 | Registro delle ricerche senza esito | A7 | processo |
| 7 | Aggancio dei 40 riferimenti `F*`/`P*` alle affermazioni che sostengono | §4.1 | lavoro editoriale |
| 8 | Promozione dei 20 claim del registro M5 a record canonici | §2.2 | modello |

La n. 7 è la più economica rispetto al beneficio: i riferimenti primari sono già nel repository, con URL e provenienza. Manca solo il collegamento.

---

## 7. Architetture e algoritmi candidati

### 7.1 Modello semantico: tre opzioni

| Opzione | Descrizione | Vantaggi | Costi e rischi |
| --- | --- | --- | --- |
| A. Campi aggiuntivi | `derived_from` sulle fonti, `stance` e `asserted_by` sulle relazioni, `case` sugli eventi | Minimo cambiamento; schema e validatore esistenti | Non risolve i verdetti divisi degli eventi; le relazioni n-arie restano schiacciate |
| B. Collezione `claims` reificata | Un record per affermazione: aspetto, proposizione, chi afferma, posizione, base, fonti con localizzatore, data di asserzione, claim che sostituisce | Risolve A1 e A4; i claim M5 e quelli dei sidecar hanno una casa | Migrazione editoriale di centinaia di record; rischio di falsa precisione se i claim vengono generati in automatico dalla baseline |
| C. Triple store o database a grafo | RDF con reificazione o proprietà sugli archi | Linguaggi di interrogazione maturi | Viola «Git è il database»; nessun beneficio a questa scala; non aggiunge informazione |

Raccomandazione: **B in modo incrementale, con A come primo passo**. I claim si creano solo dove esiste evidenza reale (il registro M5, i sidecar futuri, i record toccati da una revisione), mai per conversione meccanica della baseline. È coerente con il principio dichiarato in `docs/ARCHITECTURE.md`: la struttura si introduce quando esistono dati veri.

Schizzo di un claim [OPPORTUNITÀ]:

```jsonc
{
  "id": "C-0001",
  "about": "TL-0059",
  "aspect": "sponsor",                    // occurrence | perpetrator | sponsor | motive | impact | status | control
  "proposition": { "it": "…" },
  "asserted_by": "PL",                    // entità che afferma
  "stance": "asserts",                    // asserts | denies | disputes | retracts
  "basis": "institutional_attribution",   // tipo di base: non ordinale
  "evidence": [{ "source": "<codice fonte>", "locator": "<paragrafo>", "role": "supports" }],
  "asserted_on": "2024-05",               // quando è stato affermato
  "responds_to": null,                    // claim a cui replica (smentita)
  "supersedes": null
}
```

La smentita russa di `TL-0059` diventa un secondo claim con `stance: "denies"` e `responds_to` valorizzato, invece di un aggettivo nella nota.

### 7.2 Algoritmi di scoperta: confronto

| Metodo | Che cosa richiede | Fattibile oggi? | Rischio principale | Giudizio |
| --- | --- | --- | --- | --- |
| Riconciliazione testo–grafo (regole su nomi e alias) | Nomi, alias, testo | Sì, eseguito | Menzioni di contesto | **Primo da adottare** |
| Audit di contro-inferenza (cammini e vincoli) | Registro delle inferenze vietate | Sì, in parte eseguito | Registro incompleto | **Primo da adottare** |
| Co-partecipazione con modello nullo | Casi collassati | Solo dopo l'introduzione dei casi | Rileva duplicati | Utile come controllo di qualità |
| Reti multilivello per gruppo di relazione | Classi coerenti | Parziale: 30 classi, 8 gruppi | Livelli quasi vuoti (7 archi di proprietà) | Rinviare |
| Scoperta di motivi | Predicati canonici | No: 147 predicati su 167 archi | Nessuna ricorrenza possibile | Richiede prima la canonizzazione dei predicati |
| Grafi temporali, motivi temporali | Validità sulle relazioni, date precise | No: 0 relazioni datate, 59 eventi con solo l'anno | Ordinamenti fittizi dentro l'anno | Richiede l'orologio dell'attribuzione |
| Predizione di link vincolata | Molti archi, vincoli negativi | No: 167 archi | Premia gli hub; propone inferenze vietate | Sconsigliata a questa scala |
| Rilevamento di comunità | Grafo denso | No: 56 nodi isolati, componente unica dominata da 4 hub | Comunità uguali ai domini editoriali | Sconsigliata |
| Somiglianza semantica dei testi (embedding) | Testi, modello locale | Sì, non eseguito | Vicinanza tematica scambiata per relazione | Solo per deduplicare eventi e raggruppare casi |
| Regole simboliche con verifica umana | Claim tipizzati | Dopo l'opzione B | Regole troppo generali | Obiettivo a medio termine |

Una nota sulla scala: con poche centinaia di archi, un metodo statistico non può superare ciò che un revisore trova leggendo. Il valore dell'automazione qui sta nel rendere sistematici i controlli e nel non dimenticare i vincoli, non nel trovare ciò che nessuno potrebbe vedere.

### 7.3 Correzione del cancello di pubblicazione

Tre alternative per il comportamento del §4.3 [OPPORTUNITÀ]:

| Alternativa | Effetto | Rischio |
| --- | --- | --- |
| Filtrare i soli eventi non pubblici dalla lista `events` dell'ipotesi pubblicata | L'ipotesi resta visibile nella forma precedente | Le note di Fonte_09 in `review.notes` vanno filtrate allo stesso modo |
| Campo separato `pending_events` | Separazione esplicita fra collegamenti pubblici e candidati | Cambio di schema |
| Mantenere il comportamento e segnalarlo | `audit:publication` elenca le ipotesi trattenute e il motivo | Nessuno; è il minimo |

La regola generale da proteggere con un test: *aggiungere un candidato non deve mai ridurre ciò che è pubblico*.

---

## 8. Esempi concreti basati su record reali

**Esempio 1 — Un verdetto diviso che perde metà.** `TL-0059` ha nota «Attribuzione istituzionale contestata dalla Russia». L'evento ha due archi: `G-0223` (`PL`, `LOCATION`, E1) e `G-0224` (`RU`, `OFFICIAL_ATTRIBUTION`, E2), entrambi con il caveat standard. La contestazione non è in nessun arco. In `graph.json` resta «RU — OFFICIAL_ATTRIBUTION — E2».

**Esempio 2 — E1 senza l'atto.** `G-0450`: E1, `documented`, `primary_url: null`, fonti `S09`, `WEB-EXT-016` (RaiNews Trento), `WEB-EXT-017` (la Repubblica). Il caveat dichiara che il comunicato della società non è stato acquisito. Il record è onesto nella prosa e fuorviante nei campi strutturati.

**Esempio 3 — Tre fonti, una radice.** `EXT-005` cita `WEB-EXT-005` (ministero francese), `WEB-EXT-006` (Reuters) e un terzo riferimento Reuters via Internazionale. Livello E2: corretto. Ma un lettore che vede tre fonti conclude che l'attribuzione è stata corroborata, mentre è stata riferita.

**Esempio 4 — Un arco che dice «non».** `G-0087`: predicato `COLLEGAMENTO_SOCIETARIO_SEPARATO`, caveat «Non dimostra denaro Kerimov verso SpaceX». Nel grafo è un arco E3 che collega `SOB` a `GVA` e rende raggiungibile `SPACEX` da `KERIMOV`.

**Esempio 5 — Lo stesso caso, due eventi.** `TL-0026` («Caso Christine Lee e UFWD», 2021–2022, l'indagine) e `TL-0035` («MI5 diffonde l'interference alert», 2022). Stesse due entità, stessa nota, stessa fonte `S01`. Sono fasi legittimamente distinte, ma senza un record di caso raddoppiano il peso della coppia `LEE`–`UFWD` in qualunque statistica. Entrambe le relazioni riguardano una persona nominata e un'attribuzione MI5, non una condanna.

**Esempio 6 — Un'entità che esiste solo nel testo.** `VIGINUM` ha un record, compare nel titolo di `TL-0055` e nel testo di altri quattro eventi, e non ha archi. Nella pagina dell'entità non risulta nulla; nella ricerca testuale risultano cinque eventi.

**Esempio 7 — Un'ipotesi critica resa invisibile da una nota che dice che nulla è cambiato.** `H08` (catena decisionale delle restrizioni Starshield): la nota di Fonte_09 recita «no new direct evidence on the October Starshield order… original hypothesis unchanged». Il collegamento a `EXT-025` la esclude dal sito.

---

## 9. Falsi positivi, controevidenze e limiti

| Risultato | Che cosa potrebbe invalidarlo | Valutazione |
| --- | --- | --- |
| §4.1 catena interrotta | Le sintesi contengono le citazioni | Vero, ma non strutturato; il risultato riguarda il dato, non la qualità della ricerca |
| §4.3 ipotesi trattenute | Comportamento voluto | Possibile; in contrasto con la garanzia dichiarata per l'ingestione. Da confermare |
| §4.4 cammini proibiti | Il sito mostra i caveat nelle tabelle | Vero per le pagine; non per `graph.json`, per le esportazioni usate da terzi e per chi interroga il grafo |
| §4.5 modello nullo | 500 simulazioni e un solo seme | I p prossimi a zero sono robusti; quelli fra 0,006 e 0,014 no |
| §4.6 menzioni senza arco | Matcher lessicale, lista di esclusione costruita a mano | Circa 6 falsi positivi su 38 nel campione non statale; il totale di 134 è un limite superiore |
| §4.6 menzioni | Una menzione non è un ruolo | Per questo è una coda di revisione |
| §4.7 radici delle fonti | Classificazione delle agenzie dal campo `publisher` | Le ripubblicazioni dichiarate sono certe; altre derivazioni non dichiarate restano invisibili |
| §4.7 dominio istituzionale | Classificazione per espressione regolare sui domini | Corretto a mano un caso (tribunali finlandesi); possibili altri errori di una o due unità |
| §4.8 squilibrio geografico | `places` deriva dalla geografia editoriale, 46 eventi non hanno luogo | Il dato descrive il corpus, non l'attività reale |
| §4.10 traduzione | Test su marcatori lessicali | Non rileva cambi di modalità verbale più sottili |
| `ART-0002` | L'omissione dei link potrebbe essere una svista | Non determinabile; il rilievo riguarda il meccanismo |

Limiti generali di questo rapporto: nessuna fonte esterna è stata riaperta; il codice di `src/pipeline/ingest/` e le pagine Astro non sono stati letti per intero; il sito costruito non è stato ispezionato in un browser; le fonti tematiche e Fonte_10/11 sono state esaminate solo nei metadati.

---

## 10. Proposte prioritarie

| # | Proposta | Riguarda | Beneficio | Costo | Rischio |
| --- | --- | --- | --- | --- | --- |
| P1 | Rendere esplicite le ipotesi trattenute e decidere la regola (§7.3); test «un candidato non riduce il pubblico» | Difetto accertato | Tornano visibili fino a 11 ipotesi, 3 critiche | Basso: una funzione e un test | Esporre note di candidati se il filtro è incompleto |
| P2 | Esportare il caveat in `graph.json` e mostrarlo sull'arco nella bacheca | Difetto accertato | Il grafo pubblicato smette di essere più assertivo dei record | Basso | Nessuno rilevante |
| P3 | Registro strutturato delle inferenze vietate e audit di contro-inferenza a build time | Limite dimostrabile | I vincoli di Fonte_09 §8.3 e i caveat negativi diventano verificabili | Medio: nuova piccola collezione, uno script | Registro incompleto scambiato per garanzia |
| P4 | Agganciare i riferimenti `F*`/`P*`/`WEB-EXT` alle affermazioni; regola: una sintesi del corpus non è una fonte sufficiente per E1 | Limite dimostrabile | La catena arriva alla fonte primaria; diventa possibile l'analisi A2 | Alto: lavoro editoriale su centinaia di record | Collegamenti frettolosi a un documento che non sostiene la frase |
| P5 | Genealogia delle fonti (`origin_type`, `derived_from`, `relies_on`) e conteggio delle radici | Opportunità progettuale | Distingue riferimenti da corroborazioni | Medio: schema, validatore, sidecar v1.1 | Classificazioni errate dell'origine |
| P6 | Collezione dei casi; gli eventi come fasi | Limite dimostrabile | Elimina l'artefatto del §4.5; ordina Fonte_09 | Medio | Raggruppamenti che fondono casi distinti |
| P7 | Coda di revisione testo–grafo generata a ogni build | Opportunità progettuale | 33 entità isolate e circa 100 menzioni esaminabili | Basso: script e rapporto | Archi creati senza rileggere la fonte |
| P8 | Collezione `claims`, alimentata dal registro M5 e dai sidecar | Limite dimostrabile | Separa fatto, attribuzione, impatto, smentita | Alto | Falsa precisione se popolata in automatico |
| P9 | Eliminare `evidence_status` oppure dargli un significato proprio; documentare che la scala E non è ordinale | Difetto accertato | Un campo in meno che finge informazione | Basso, ma tocca schema ed esportazioni `v1` | Rottura per chi usa i dati esportati |
| P10 | Coda delle acquisizioni con i quattro fattori di A6; uso effettivo degli stati `refuted` e `closed_insufficient` | Opportunità progettuale | La priorità diventa azionabile | Medio: giudizio umano su circa 140 coppie | Punteggi trattati come misure oggettive |
| P11 | Archiviare le esecuzioni senza esito di Task A | Opportunità progettuale | Rende misurabile la copertura | Basso | Rumore nel repository |
| P12 | Gli articoli devono dichiarare i record di cui trattano; avviso quando un articolo senza link nomina entità con eventi canonici | Difetto accertato | Il cancello degli articoli controlla qualcosa | Basso | Più articoli trattenuti finché P1 non è risolta |

Ordine consigliato: P1, P2, P12 e P7 subito, perché costano poco e correggono comportamenti accertati; P3 e P5 come primo cambio di modello; P4, P6 e P8 come programma editoriale; P9–P11 quando conviene.

Vincoli da rispettare in ogni proposta: nessuna modifica a `sources/`, nessun cambio alla `provenance` dei record importati, nessun record portato a `reviewed` da un agente, nessuna relazione su persone senza fonte primaria. P4 e P8 in particolare non devono essere eseguite in blocco da un modello.

---

## 11. Esperimenti riproducibili

Ogni esperimento indica il valore misurato oggi, che serve da riferimento.

| # | Esperimento | Procedura | Valore al commit `d1f6a97` | Criterio di successo dopo l'intervento |
| --- | --- | --- | --- | --- |
| E1 | Profondità della catena delle fonti | Per ogni relazione, classificare i codici in `sources` | 429 / 458 solo corpus; 40 / 41 `F*`/`P*` mai citati | Quota «solo corpus» in calo; nessun E1 con sola sintesi |
| E2 | Ridondanza livello–stato | Contare le coppie distinte `(evidence_level, evidence_status)` | 4 | Campo rimosso, oppure più di 4 coppie con significato documentato |
| E3 | Regressione di pubblicazione | Per ogni record `imported_unreviewed` assente dalla proiezione, stampare la causa | 11 ipotesi, 10 relazioni, `G-0230` | Zero record trattenuti per il solo collegamento a un candidato |
| E4 | Contro-inferenza | Cammini minimi fra le coppie di ogni ipotesi; segnalare quelli che attraversano un caveat negativo | 3 su 3 coppie provate (`H06`, `H15`, `H07`) | Ogni cammino segnalato ha un'annotazione pubblica |
| E5 | Co-partecipazione contro modello nullo | 500 scambi di archi a gradi fissi; contare le coppie con ≥ 2 eventi | 15 osservate; attese 4,5; massimo 10–12 | Dopo il collasso per caso, osservate entro l'intervallo nullo |
| E6 | Menzioni senza arco | Confronto dei nomi con titolo e descrizione | 134 menzioni, 74 eventi, 33 entità isolate | Ogni menzione classificata: arco creato, contesto, falso positivo |
| E7 | Radici indipendenti | Ricondurre ogni `WEB-EXT` all'origine dal campo `publisher` | 20 eventi `EXT` su 34 con un'unica origine | Stesso numero ottenuto da `derived_from`, senza euristiche sul testo |
| E8 | Deriva delle cautele in traduzione | Marcatori in italiano senza corrispondente in inglese | 10 / 1.346, nessuno reale | Resta a zero casi reali |
| E9 | Controllo negativo per ogni nuovo metodo | Applicare il metodo ai 9 «forbidden edge» e ai 18 caveat negativi | — | Il metodo non propone nessuna di queste coppie |
| E10 | Stabilità temporale | Rieseguire E1, E5, E6 su tre commit distanti (`3fbad89`, `d1f6a97`, uno futuro) | — | Le piste che compaiono in un solo commit sono trattate come instabili |

E5 e E9 insieme sono il protocollo minimo per accettare un metodo di scoperta: deve battere il caso e non deve riprodurre ciò che il corpus vieta.

---

## 12. Questioni aperte

1. **L'esclusione delle 11 ipotesi è voluta?** Se sì, va documentata e resa visibile in `audit:publication`; se no, è una regressione introdotta dall'import di Fonte_09.
2. **Che cosa conta come fonte per E1?** Un atto primario riferito dalla stampa è E1 perché l'atto esiste, o E3 perché l'evidenza posseduta è giornalistica? La scelta cambia il livello di almeno 7 eventi candidati e potenzialmente di 49 relazioni dirette.
3. **I documenti `S00`–`S08` vanno trattati come fonti o come appunti di lavoro?** Da questo dipende se la baseline è «provvisoria» o «non ancora sostenuta».
4. **Chi ha autorità per dichiarare vietata un'inferenza, e per quanto tempo?** Un vincolo come quello di `H06` deve poter decadere quando arriva un documento.
5. **Come si rappresenta un caso che attraversa giurisdizioni e anni** senza fondere procedimenti distinti (i 22 sospetti Eurojust, i 15 lituani e i 5 imputati polacchi di `ART-0002` «non vanno sommati»)?
6. **Gli articoli sono evidenza o commento?** `ART-0001` usa l'entità `BIS`, che il grafo non collega a nulla, e `ART-0002` contiene una cronologia più dettagliata di `TL-0064`. Oggi la conoscenza prodotta da Task B non rientra nel grafo.
7. **Le fonti tematiche (`sources/thematic/`) hanno un percorso di ingestione?** Hanno un `case_key` e un proprio schema di metadati, ma nessun sidecar previsto.
8. **Il primo sidecar reale di Task A esiste?** Fonte_11 è stata creata il giorno dell'aggiornamento del prompt e non ne ha uno. Finché non arriva, `pnpm ingest` resta verificato solo su una fixture scritta a mano.
9. **Quanto del segnale geografico è lingua?** Servirebbe un'esecuzione di Task A limitata a fonti in una lingua non coperta per misurare quanto cambia la distribuzione.
10. **La storia Git basta come memoria delle revisioni?** Per rispondere a «che cosa affermava il sito in una certa data» oggi bisogna ricostruire il sito a quel commit.

---

## Appendice A — Nucleo riproducibile delle analisi

Script Python di sola lettura; va eseguito dalla radice del repository. Riproduce i valori di E1, E2, E3 ed E5. Per E6 usa un matcher semplificato (segmenti di almeno 5 caratteri, nessuna lista di esclusione) e restituisce 111 menzioni invece delle 134 del §4.6: l'ordine di grandezza è lo stesso, l'elenco non coincide. Verificato al commit analizzato: 429 / 458, 40, 4 coppie, 11 ipotesi trattenute, 15 coppie contro una media nulla di 4,5.

```python
import json, glob, os, re, random, itertools, collections, unicodedata

def col(n):
    return {os.path.basename(f)[:-5]: json.load(open(f)) for f in sorted(glob.glob(f"data/{n}/*.json"))}

EV, EN, RL, HY, SR = (col(n) for n in ("events", "entities", "relationships", "hypotheses", "sources"))
C = collections.Counter
part = [r for r in RL.values() if r["relation_class"] == "event_participation"]

# E1 — catena delle fonti
corpus = lambda s: re.fullmatch(r"S\d\d", s) is not None
print("solo corpus:", sum(all(corpus(s) for s in r["sources"]) for r in RL.values()), "/", len(RL))
used = C(s for d in (EV, RL, HY, col("exposures")) for r in d.values() for s in r["sources"])
print("F/P mai citati:", sum(1 for s in SR if s[0] in "FP" and not used[s]))

# E2 — ridondanza livello/stato
print(C((r["evidence_level"], r["evidence_status"]) for r in RL.values()))

# E3 — record della baseline trattenuti dal cancello
pub_ev = {k for k, e in EV.items() if e["review"]["status"] != "needs_review" and e["timeline_status"] == "integrated"}
for h in HY.values():
    held = [e for e in h["events"] if e not in pub_ev]
    if h["review"]["status"] != "needs_review" and held:
        print("trattenuta:", h["id"], h["priority"], held)

# E5 — co-partecipazione contro modello nullo a gradi fissi
edges = []
for r in part:
    ev, en = (r["subject"], r["object"]) if r["subject"] in EV else (r["object"], r["subject"])
    if en in EN:
        edges.append((en, ev))

def pairs(ed):
    m = collections.defaultdict(set)
    for a, e in ed:
        m[e].add(a)
    return C(p for s in m.values() for p in itertools.combinations(sorted(s), 2))

def swap(ed, n):
    ed, s = list(ed), set(ed)
    for _ in range(n):
        i, j = random.randrange(len(ed)), random.randrange(len(ed))
        (a, e), (b, f) = ed[i], ed[j]
        if a == b or e == f or (a, f) in s or (b, e) in s:
            continue
        s -= {ed[i], ed[j]}
        ed[i], ed[j] = (a, f), (b, e)
        s |= {ed[i], ed[j]}
    return ed

random.seed(7)
obs = sum(v >= 2 for v in pairs(edges).values())
null = [sum(v >= 2 for v in pairs(swap(edges, 10 * len(edges))).values()) for _ in range(500)]
print("coppie con >=2 eventi:", obs, "| nullo: media", sum(null) / 500, "max", max(null))

# E6 — entità nominate nel testo di un evento senza arco di partecipazione
norm = lambda s: "".join(c for c in unicodedata.normalize("NFD", s.lower()) if unicodedata.category(c) != "Mn")
linked = collections.defaultdict(set)
for en, ev in edges:
    linked[ev].add(en)
hits = 0
for eid, e in EV.items():
    text = norm(e["title"]["it"] + " " + e["description"]["it"])
    for k, ent in EN.items():
        if k in linked[eid]:
            continue
        names = [norm(p).strip() for p in re.split(r"\s*/\s*|\(|\)|,|;", ent["name"]["it"])]
        if any(len(n) >= 5 and re.search(r"(?<![a-z0-9])" + re.escape(n) + r"(?![a-z0-9])", text) for n in names):
            hits += 1
print("menzioni senza arco (matcher semplificato):", hits)
```

Comandi del progetto usati, tutti di sola lettura: `pnpm validate`, `pnpm audit:publication`.
