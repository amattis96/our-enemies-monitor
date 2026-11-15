---
source_id: "S14"
created_at: "2026-11-15"
coverage_start: "2026-11-10"
coverage_end: "2026-11-15"
baseline_source: "S11"
repository_commit: "60740765d162362c2892f712aa20d2598124866c"
language: it
status: proposed
schema_version: "1.1"
---

# Fonte_14 | Aggiornamento OSINT incrementale per l'Europa | 15 novembre 2026

**Fonte documentaria proposta, non ancora importata nel corpus canonico né approvata editorialmente.** Questa scansione seleziona due **sviluppi procedurali** comunicati il 12 novembre, documentati da autorità giudiziarie e riscontri indipendenti. Le date dei procedimenti non vengono confuse con le date delle condotte originarie. La giornata del 15 novembre è coperta soltanto fino al momento della scansione; una notizia apparsa nel frattempo può richiedere un aggiornamento successivo.

## A. Metadati, baseline e metodo

- **Ultima Fonte incrementale integrata in `main`:** Fonte_11, S11; `coverage_end: 2026-11-13`, conclusa nelle prime ore del 13 novembre senza un'ora normalizzata nel frontmatter.
- **Intervallo di scansione:** 10–15 novembre 2026, con più di 72 ore di sovrapposizione rispetto alla data di conclusione di S11. Il 15 novembre è parziale, non una giornata conclusa.
- **HEAD del repository consultata:** `60740765d162362c2892f712aa20d2598124866c`.
- **Proposte aperte esaminate:** PR #18 (Fonte_12: allerta tecnica BSI/Danfoss; squadra europea per il negoziato ucraino) e PR #19 (Fonte_13: contestazione Starshield; dichiarazioni sul Donbas/NATO). Nessuna delle due avanza la baseline e i loro eventi non vengono riproposti.
- **Precedenti:** Fonte_09 copre gli sviluppi fino all'11 novembre; Fonte_10 copre fra l'altro altri due procedimenti *distinti*, riguardanti incendio di veicoli in Polonia e RAF Fairford nel Regno Unito. Fonte_11 aggiorna le minacce alle scuole italiane. Non confondere fatti vicini per geografia o attore.
- **Criteri probatori:** E1 = atto/documento primario e decisione, E2 = attribuzione istituzionale, E3 = indagine indipendente, E4 = accusa/rivendicazione non corroborata, E5 = ipotesi. Queste **sono tipologie di base documentale, non una scala probabilistica**. `review.status` è separato. I dettagli attribuiti all'accusa non sono trasformati in fatti giudizialmente definitivi.

## B. Sintesi

1. **Regno Unito, 12 novembre:** la Crown Prosecution Service conferma il verdetto di colpevolezza di due imputati per assistenza a un servizio di intelligence straniero in un'operazione di sorveglianza di giornalisti dissidenti; uno dei due è stato riconosciuto colpevole anche di condotta preparatoria a violenza grave. Un terzo imputato è stato assolto; anche il secondo condannato è stato assolto da una distinta contestazione preparatoria. La commisurazione della pena è prevista per il 17 dicembre, non è ancora intervenuta [R01–R03, R06].
2. **Polonia, comunicazione del 12 novembre:** la Procura nazionale rende noto il deposito, effettuato il **28 ottobre**, dell'atto d'accusa contro Volodymyr B., accusato di aver agevolato le azioni di sabotaggio ferroviario di Mika e Gołąb dell'autunno **2025**, nell'ambito di un'attività contestata come collegata all'intelligence russa. **Nuovo passaggio giudiziario, non nuovo attentato né condanna** [R04–R05].

Questi procedimenti sono **autonomi**: nessuna fonte acquisita dimostra una regia comune Iran–Russia o un collegamento operativo fra sorveglianza di dissidenti in Gran Bretagna e sabotaggi ferroviari polacchi.

## C. Registro strutturato delle evidenze

### OEM-20261115-001 | NEW_JUDICIAL | Regno Unito: verdetto nel procedimento relativo alla sorveglianza di giornalisti Iran International

- **Data del provvedimento:** 12 novembre 2026; **data comunicazione primaria:** 12 novembre; **periodo della condotta giudicata:** agosto 2024 – marzo 2025, secondo le fonti giudiziarie e Reuters [R01–R03].
- **Geografia:** Londra, Regno Unito. **Ambito:** sicurezza nazionale, intelligence straniera, intimidazione della stampa in esilio.
- **Fatto documentato E1:** CPS comunica che **Mostafa Sepahvand** e **Farhad Javadi Manesh** sono stati giudicati colpevoli di assistenza a un servizio di intelligence straniero ai sensi del *National Security Act 2023*, a seguito del processo a Woolwich Crown Court. Sepahvand è stato dichiarato colpevole anche della contestazione di preparazione di violenza grave. Manesh è stato assolto da questa seconda contestazione. **Shapoor Qalehali Khani Noori è stato assolto da tutte le imputazioni**, non va inserito fra i condannati [R01–R02].
- **Attribuzione istituzionale E2:** secondo CPS e Counter Terrorism Policing l'operazione si svolgeva per conto degli apparati di intelligence iraniani/IRGC, con ricerca di indirizzi di giornalisti e altri obiettivi nel Regno Unito. È un'**attribuzione istituzionale descritta nel procedimento**, non un'automatica prova che ogni altra minaccia ai media dissidenti in Europa fosse coordinata dal medesimo organo [R01–R02].
- **Dati sulla condotta E1/E2:** la ricostruzione probatoria descritta dalla CPS cita video, fotografie, messaggi e dati di localizzazione. La CPS riferisce anche una richiesta di 150.000 sterline per attaccare un bersaglio; la richiesta non equivale al pagamento accertato, né prova che un attacco sia stato materialmente realizzato [R01].
- **Stato e contraddittorio:** **verdetti di colpevolezza e assoluzione del 12 novembre**, pena attesa il **17 dicembre 2026**. Non presentare questa fase come condanna già sanzionata con anni di detenzione, non anticipare eventuali appelli. Le fonti giornalistiche riportano le pregresse negazioni iraniane di responsabilità nelle attività di spionaggio estero [R03].
- **Riscontro indipendente E3:** Reuters riferisce il verdetto e le reazioni istituzionali; il Committee to Protect Journalists commenta il rischio per giornalisti in esilio, senza sostituirsi a una prova giudiziaria [R03, R06].
- **Collegamenti:** pertinente alla repressione transnazionale e agli apparati iraniani già discussi nelle fonti consolidate, ma distinto dal caso RAF Fairford e dagli attacchi ai controllori industriali. **Nessuna relazione canonica fra persone, gruppi e altri eventi viene proposta automaticamente.**
- **Impatto europeo:** procedimento nel Regno Unito e rilevanza per la sicurezza della stampa dissidente; nessun attacco violento riuscito viene imputato come esito di questo specifico fascicolo.
- **Proposta per M6:** `create_event` con tipo `NEW_JUDICIAL` e sola registrazione del provvedimento, lasciando distinti titolo giudiziario, ricostruzione dell'accusa e attribuzione statale. Fonti [R01–R03]; [R06] per osservazione sul contesto.

### OEM-20261115-002 | NEW_JUDICIAL | Polonia: atto d'accusa relativo ai sabotaggi ferroviari del 2025

- **Data dell'atto contestuale:** 28 ottobre 2026 (deposito dell'imputazione); **prima comunicazione pubblica della Procura:** 12 novembre 2026; **periodo dei sabotaggi contestati:** autunno 2025. La distinzione è essenziale: **non è avvenuto un nuovo attentato ferroviario il 12 novembre** [R04–R05].
- **Geografia:** località Mika (distretto di Garwolin) e Gołąb (distretto di Puławy), Polonia; linea ferroviaria n. 7 Varsavia–Lublino e direttrice verso l'Ucraina.
- **Fatto procedurale E1:** la Prokuratura Krajowa annuncia l'atto d'accusa depositato al tribunale regionale di Varsavia contro **Volodymyr B.**, identificato con la forma abbreviata utilizzata dalla Procura [R04].
- **Contenuto accusatorio, non verdetto:** l'accusa sostiene che l'imputato abbia prestato supporto logistico a due persone ritenute responsabili di sabotaggi ferroviari nel 2025, con ricognizioni, scelta di luoghi e facilitazioni; il riferimento all'intelligence russa è **tesi dell'accusa istituzionale** e non condanna personale già pronunciata [R04–R05].
- **Stato procedurale:** **imputato, non condannato**. La pena massima prospettata dalle cronache non indica una sanzione già inflitta. La responsabilità individuale rimane da accertare nel procedimento; gli altri nominativi citati dalla Procura non vengono automaticamente riconosciuti colpevoli [R04–R05].
- **Attribuzione e finalità E2:** la Procura collega il presunto supporto a un'operazione d'intelligence russa e parla di intimidazione/condizionamento dell'opinione pubblica come finalità contestata; non attribuiamo questo caso ad altri sabotaggi senza prove comuni [R04].
- **Distinzione da Fonte_10:** Fonte_10 `OEM-20261112-001` registra due sospetti fermati il 3 novembre per incendi di veicoli, targhe contraffatte e ricognizioni di infrastrutture, comunicati dalla Procura il 10 novembre. Il presente caso **riguarda invece l'atto d'accusa nel distinto procedimento ferroviario del 2025**. Nessuna fusione di imputati, fatti o modalità.
- **Impatto europeo:** tutela della logistica verso l'Ucraina e del territorio polacco; l'indicazione del sostegno logistico a Mosca resta in questa fase una **contestazione dell'autorità giudiziaria**.
- **Proposta per M6:** `create_event` `NEW_JUDICIAL` datato **28 ottobre 2026**, con `published` **12 novembre**, per conservare la cronologia corretta. Nessuna relazione personale o statale aggiunta al grafo senza verifica successiva.

## D. Collegamenti documentati e collegamenti non dimostrati

**Documentato:** si tratta di due nuove comunicazioni su procedimenti distinti che riguardano, rispettivamente, assistenza a intelligence iraniana nel Regno Unito (verdetto) e contestata assistenza a intelligence russa in Polonia (atto di accusa). Sono rilevanti per la capacità europea di perseguire minacce di intelligence e sabotaggio.

**Non documentato:** che Iran e Russia abbiano coordinato questi due procedimenti operativi; che i due imputati del caso britannico siano coinvolti negli attacchi ai supermercati; che Volodymyr B. sia coinvolto negli incendi di veicoli della Fonte_10; che la presentazione di un atto d'accusa equivalga a colpevolezza. Nessun arco causale o relazione verso persone è proposto in questo sidecar.

## E. Ipotesi e domande aperte

- Il verdetto britannico sarà confermato, modificato o impugnato dopo la determinazione della pena del 17 dicembre? Servono gli atti di sentenza e gli eventuali appelli.
- Nel procedimento polacco quali prove, testimoni e contraddittori saranno pubblici in dibattimento? Verificare i successivi atti giudiziari.
- Le strutture di supporto documentate in procedimenti separati mostrano specifiche tecniche operative comparabili? Senza identità forensi e documentazione indipendente non formulare una relazione di coordinamento E1–E4.
- **Non si crea alcuna ipotesi canonica E5** in questa fonte: gli interrogativi servono a orientare future verifiche, non a concludere una connessione.

## F. Rettifiche, stati e precauzioni

1. **UK:** due imputati giudicati colpevoli per assistenza a servizio straniero; soltanto Sepahvand anche per condotta preparatoria; Manesh assolto su quest'ultima; **Noori assolto integralmente** [R01].
2. **UK:** pena da determinare il 17 dicembre 2026, non una condanna a una durata di carcere già definita [R01].
3. **Polonia:** 28 ottobre è la data del deposito dell'imputazione, il 12 novembre la sua pubblicizzazione; **2025** è la data dei sabotaggi contestati. L'evento del sidecar conserva la data dell'atto e una data di pubblicazione distinta [R04].
4. **Polonia:** separare il nuovo atto d'accusa dai procedimenti annunciati il 10 novembre per incendi di automezzi e presunte operazioni di influenza [Fonte_10].
5. **Attribuzioni:** distinguere decisione giudiziaria, tesi della Procura e spiegazione politica; il collegamento fra i due fascicoli è soltanto tematico.

## G. Bibliografia verificabile

- **[R01]** Crown Prosecution Service, 2026-11-12: *Two men who spied on journalists and lawyer guilty of spying on behalf of Iran*. https://www.cps.gov.uk/national-news/news/two-men-who-spied-journalists-and-lawyer-guilty-spying-behalf-iran
- **[R02]** Metropolitan Police / Counter Terrorism Policing, 2026-11-12: *UPDATED: Two Iranian men convicted of spying for the Islamic Revolutionary Guard Corps*. https://news.met.police.uk/news/two-iranian-men-convicted-of-spying-for-the-islamic-republic-guards-corp-514944?site=uk
- **[R03]** Reuters (riprodotto da Internazionale), 2026-11-12: *Iranian men found guilty in UK of assisting Iranian intelligence*. https://www.internazionale.it/ultime-notizie-reuters/2026/11/12/iranian-men-found-guilty-in-uk-of-assisting-iranian-intelligence
- **[R04]** Prokuratura Krajowa (Polonia), 2026-11-12: *Akt oskarżenia przeciwko Volodymyrowi B. za pomoc w aktach dywersji na kolei*. https://www.gov.pl/web/prokuratura-krajowa/akt-oskarzenia-przeciwko-volodymyrowi-b-za-pomoc-w-aktach-dywersji-na-kolei
- **[R05]** Notes from Poland, 2026-11-12: *Poland indicts Ukrainian man for assisting in rail sabotage on behalf of Russia*. https://notesfrompoland.com/2026/11/12/poland-indicts-ukrainian-man-for-assisting-in-rail-sabotage-on-behalf-of-russia/
- **[R06]** Committee to Protect Journalists, 2026-11-13: *CPJ welcomes conviction of 2 Iranians who spied on journalists in the UK*. https://cpj.org/2026/11/cpj-welcomes-conviction-of-2-iranians-who-spied-on-journalists-in-the-uk/

## H. Report di acquisizione e deduplicazione

- **Finestra pianificata:** dal 10 novembre al 15 novembre 2026 (ultima giornata parziale). **Finestra effettivamente esplorata:** pubblicazioni e atti dal 10 al 15 novembre, con approfondimento primario dei due procedimenti comunicati il 12 novembre. Ricognizione selettiva, non censimento esaustivo di ogni notizia europea.
- **Proposte nuove selezionate:** 2 eventi di tipo `NEW_JUDICIAL`, di cui 1 verdetto britannico del 12 novembre e 1 deposito d'accusa polacco del 28 ottobre reso noto il 12 novembre. **Nessuna nuova relazione, entità, ipotesi o attribuzione automatica.**
- **Deduplicazione:** non riutilizzati eventi e documenti delle PR #18/#19 (BSI/Danfoss, negoziati di Dublino, Starshield, dichiarazioni sul Donbas) né Fonte_10 (sabotaggi/incendi veicoli polacchi e altro caso britannico RAF Fairford). Fonte_11 riguarda la seconda ondata di minacce alle scuole.
- **Candidati non promossi:** cronache quotidiane dei bombardamenti Russia/Ucraina senza specifica nuova relazione europea distinta dai record precedenti; analisi su sicurezza degli operatori energetici europei pubblicate il 15 novembre senza documentazione primaria sufficiente per una nuova operazione M6; ulteriori titoli di sintesi sul sabotaggio ferroviario polacco che riprendono la medesima comunicazione e non contano come nuovo episodio.
- **Limiti:** recupero diretto completo dei testi CPS verificato; alcuni siti originali polacchi o della polizia britannica possono limitare la lettura automatica, ma titoli/date e fatti principali sono riscontrati da risultato istituzionale e fonti originali. Non consultati gli atti processuali integrali, per cui non si ampliano motivazioni o catene di comando.
- **Coda ingestione:** S12 e S13 sono ancora PR **aperte**, non ingeribili; S10 e S11 sono documenti storici senza sidecar. Il merge di questa fonte archivia i documenti, **non** importa automaticamente `data/` e non attribuisce lo stato `reviewed`.
- **Prossimi controlli:** Task C verifica provenienza, differenza fra verdetto e atto d'accusa, date e sidecar; Task D decide sull'eventuale merge soltanto con HEAD e check validi. Nessuna deroga editoriale implicita.
