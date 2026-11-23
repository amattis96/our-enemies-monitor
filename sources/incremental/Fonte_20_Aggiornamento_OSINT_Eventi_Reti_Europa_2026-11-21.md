---
source_id: "S20"
created_at: "2026-11-21"
coverage_start: "2026-11-17"
coverage_end: "2026-11-21"
baseline_source: "S19"
repository_commit: "e8b1c04854df06f6a08d6aa99dbf980225da7543"
language: it
status: proposed
schema_version: "1.1"
---

# Fonte_20 | Aggiornamento OSINT incrementale per l'Europa | 21 novembre 2026

## A. Metadati, perimetro e metodo

- **Baseline:** Fonte_19, S19, già su main; coverage_end 2026-11-20, senza orario. La finestra dal 17 novembre include almeno 72 ore di sovrapposizione.
- **Snapshot di partenza:** main e8b1c04854df06f6a08d6aa99dbf980225da7543. Fonti S09–S19 già archiviate. PR aperte #37 e #42 (editoriali), #44 (ingest S12); nessuna fonte incrementale concorrente al controllo iniziale.
- **Orizzonte:** ricerca effettuata nelle prime ore locali del 21 novembre, con approfondimento documentale sul 20 novembre. La coverage_end è una data di calendario, non una pretesa di scansione integrale di tutta la giornata del 21.
- **Disciplina:** E1 per atti e decisioni processuali attestati da comunicazioni primarie, E2 per valutazioni d'intelligence istituzionali, E3 per reporting indipendente, E4 per responsabilità individuali contestate, E5 solo per ipotesi. Le classi E1–E4 non sono una graduatoria ordinale. Nessun nesso causale ricavato dalla sola vicinanza fra eventi.

## B. Sintesi

Il 20 novembre il servizio di sicurezza danese PET ha attribuito, come **valutazione d'intelligence**, ai servizi russi la pianificazione di un presunto tentativo di omicidio di un cittadino ucraino-statunitense, destinato a esibirsi il 25 settembre presso Charlottenlund, a nord di Copenaghen. La polizia della Zelanda settentrionale ha comunicato l'estensione dei presupposti della custodia cautelare per due sospettati, comprendendo tentato omicidio e assistenza a un servizio d'intelligence straniero. L'operazione sarebbe stata impedita dagli arresti del 25 settembre. **Nessuna condanna definitiva o prova giudiziaria pubblica del mandante russo** è attestata dalle fonti [R01–R03].

## C. Registro analitico

### OEM-20261121-001 | NEW_EVIDENCE | Danimarca: nuova qualificazione giudiziaria e attribuzione PET del presunto attentato di settembre

- **Date:** 25 settembre 2026, arresti e presunto tentativo; 20 novembre 2026, comunicazioni PET e polizia e decisione cautelare. La nuova evidenza è pubblicata il 20 novembre, non si tratta di un secondo attentato.
- **Geografia e attori:** Hellerup e Charlottenlund, Zelanda settentrionale, Danimarca. PET e Nordsjællands Politi sono autorità che comunicano; la vittima designata è un artista ucraino-statunitense; due persone indagate, non nominate qui, sono in custodia cautelare. PET segnala collegamenti con ambienti del gruppo criminale vietato Loyal to Familia.
- **Condotta procedurale E1 [R02]:** il 25 settembre la polizia ha arrestato tre uomini fra 18 e 22 anni in un'auto a Hellerup, rinvenendo due pistole e due coltelli; una quarta persona è stata arrestata più tardi. Il 20 novembre il tribunale di Lyngby ha ritenuto sussistente un sospetto fondato ai fini cautelari per due persone e ampliato la base della custodia a tentato omicidio (§237 con §21) e assistenza a un servizio d'intelligence straniero (§108). Non è una dichiarazione di colpevolezza.
- **Attribuzione istituzionale E2 [R01]:** PET valuta che servizi d'intelligence russi abbiano pianificato e avviato l'operazione e che persone collegate a LTF fossero destinate all'esecuzione. La polizia non presenta l'identità del mandante come giudizialmente accertata. PET distingue esplicitamente la propria valutazione d'intelligence dal futuro accertamento penale.
- **Responsabilità personale contestata E4 [R01, R02]:** due indagati sono sospettati di tentato omicidio e collaborazione con intelligence straniera; responsabilità, consapevolezza della committenza e ruoli specifici devono essere accertati. Nessuna persona viene identificata o trasformata in colpevole.
- **Reporting E3 [R03]:** Reuters identifica l'artista come Kyivstoner e riporta le contestazioni e le smentite. La fonte primaria della polizia lo descrive come rapper ucraino-statunitense senza nominarlo.
- **Mandante/movente:** presunta pianificazione russa solo E2 [R01]; movente concreto non provato, quindi ignoto. Nessuna inferenza sulla remunerazione dei singoli indagati.
- **Impatto E1/E2 [R01, R02]:** intervento di polizia e impedimento dell'azione secondo le autorità; evento pubblico cancellato secondo Reuters [R03]. Non sono documentate vittime dell'attentato.
- **Prove contrarie, limiti:** gli indagati negano gli addebiti secondo Reuters [R03]; l'ambasciata russa respinge l'accusa e contesta la disponibilità di prove pubbliche [R03]. Gli atti istruttori integrali non sono disponibili; non è una condanna, e non prova un collegamento operativo con altri sabotaggi europei.
- **Record esistenti:** nessun ID TL-*/EXT-*/G-*/H* viene assegnato senza corrispondenza univoca; confronto testuale su main senza riscontro nominale per Kyivstoner/LTF. Il matcher deterministico dovrà controllare l'intero corpus prima dell'allocazione.
- **Nesso europeo:** rischio di operazioni violente di servizi stranieri su territorio UE e uso presunto di reti criminali come proxy.
- **Ingestione proposta:** una sola operazione create_event, con condotta documentata distinta da sponsor e perpetrator, senza nuovi ID canonici, persone o relazioni.

## D. Collegamenti potenziali e caveat

La valutazione PET è coerente con le precedenti allerte europee sul ricorso a intermediari criminali, ma la coerenza di modus operandi non dimostra direzione comune di specifici episodi. Nessun arco G-* viene proposto.

## E. Ipotesi e domande aperte

Quali elementi giudiziari sostengono l'identificazione del servizio estero? Quale grado di consapevolezza è attribuito ai singoli sospettati? Quali aggiornamenti processuali saranno pubblicati? Non si codifica un'ipotesi E5 senza elementi specifici.

## F. Rettifiche e stato

Nessuna rettifica a record canonici proposta. Distinguere quattro arresti originari, due indagati destinatari dell'estensione cautelare, e l'attribuzione istituzionale PET. L'esistenza di sospetti cautelari non equivale a condanna.

## G. Bibliografia

- **R01** PET, “Russia uses Danish criminal networks in assassination attempt on Danish soil”, 20 novembre 2026. https://pet.dk/en/about-pet/news-list/russia-uses-danish-criminal-networks-in-assassination-attempt-on-danish-soil/2026/11/20
- **R02** Nordsjællands Politi, “Nordsjællands Politi udvider fængslingsgrundlaget for to personer til forsøg på manddrab og for at yde hjælp til en udenlandsk efterretningstjeneste”, 20 novembre 2026. https://politi.dk/nordsjaellands-politi/nyhedsliste/nordsjaellands_politi_udvider_faengslingsgrundlag/2026/11/20
- **R03** Reuters, “Denmark says it thwarted Russian plot to assassinate US-Ukrainian rapper”, 20 novembre 2026. https://www.reuters.com/world/europe/two-danes-suspected-being-hired-by-russia-kill-us-ukrainian-rapper-2026-11-20/

## H. Report di acquisizione, scarti e limiti

- **Query:** PET 20 November 2026 Russian intelligence assassination; Nordsjællands Politi 20 november 2026; Reuters Denmark rapper; UE sanzioni 16 novembre; cyber Commissione 19 novembre; incursioni in Polonia 20 novembre; attacchi Ucraina 20 novembre; vulnerabilità refrigerazione UK.
- **Risultati:** 1 elemento nuovo sufficientemente documentato, con due fonti primarie e un reporting indipendente. Il fatto di settembre viene acquisito come nuova evidenza del 20 novembre, non duplicato come due eventi.
- **Scarti/deduplicazione:** sanzioni UE 16 novembre già S16; incidente cyber Commissione già S19; attacchi al ponte di Kerch già S17; refrigerazione Danfoss già S12. Le notizie del 20 novembre sulle incursioni in Polonia e sui bombardamenti in Ucraina meritano verifica primaria supplementare prima di eventuali proposte, non sono importate qui.
- **Limiti:** ricognizione selettiva, non esaustiva; impossibilità di scaricare un checkout GitHub nella shell per DNS. Validazione locale pnpm non eseguita. La verifica finale M6/CI è demandata ai check GitHub sulla HEAD PR e alla review indipendente di Task C.
- **Stato:** documento e sidecar proposti; nessuna modifica a data/, nessun merge o approvazione.
