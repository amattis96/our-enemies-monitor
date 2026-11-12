---
source_id: "T-AI-001"
source_kind: "thematic_osint"
created_at: "2026-11-12"
research_cutoff: "2026-11-12"
language: "it"
status: "proposed"
schema_version: "1.0"
canonical_data_integrated: false
advances_incremental_osint_cutoff: false
baseline_corpus: ["S04", "S05", "S08", "S09"]
case_key: "AI-GEOPOLITICS-NVIDIA-CHINA-EU-2026"
---

# Fonte AI-01 | Intelligenza artificiale, potere politico e dipendenze geopolitiche: Nvidia, Cina, Stati Uniti ed Europa

**Our Enemies Monitor | Dossier tematico OSINT | Data di chiusura delle ricerche: 12 novembre 2026 (Europe/Rome)**

> **Stato e limiti.** Questa è una **nuova fonte tematica proposta**, non una conclusione giudiziaria e non un record già importato nel database. I fatti societari, gli atti pubblici, le dichiarazioni ufficiali, le ricostruzioni giornalistiche, le accuse non accertate, le inferenze e le ipotesi hanno status distinti. Il caso di possibile spionaggio su Jensen Huang non è qui dato per provato; nemmeno l'eventuale conoscenza, collaborazione o influenza intenzionale di Huang è provata. Le fonti sono state selezionate per identificativi e URL pubblici; accessibilità e contenuto integrale di alcune pagine SEC e testate devono essere riverificati in sede d'ingestione. Non riprodurre materiali di terzi integralmente.

## 1. Executive summary

Il caso Nvidia del novembre 2026 mette in contatto almeno **cinque processi distinti**: (i) un'indagine aziendale su una presunta operazione di intelligence estera riguardante l'allora CEO; (ii) la vigilanza USA sulle esportazioni di acceleratori AI verso la Cina e su eventuali intermediari a Singapore; (iii) conflitti tra politica commerciale, diplomazia, controspionaggio e interessi industriali a Washington; (iv) la competizione fra modelli aperti cinesi e statunitensi, aziende frontier chiuse e modelli europei; (v) la dipendenza dell'ecosistema AI europeo da progettazione statunitense, fabbricazione asiatica, infrastruttura e capitale.

**Sviluppo accertato al 12 novembre:** Nvidia ha annunciato le dimissioni del fondatore Jensen Huang da CEO, presidente e membro del board; nel Form 8-K la società data l'accettazione delle dimissioni all'11 novembre 2026. La CFO Colette Kress è CEO ad interim e Harvey C. Jones presidente del board. **Il deposito societario non prova il motivo causale delle dimissioni**; la stampa le inquadra nella crisi esplosa attorno ai resoconti di rapporti personali e alla vicenda di controspionaggio [S01][S02][S16].

**Sviluppo istituzionale accertato:** l'8 novembre il board Nvidia ha annunciato un'indagine indipendente dopo notizie su un possibile tentativo di intelligence straniera nei confronti di Huang, precisando di non avere ragioni per ritenere compromessi segreti dell'azienda o sicurezza nazionale [S03]. Il 5 novembre tre presidenti di commissioni della Camera USA avevano richiesto una relazione riservata sulle interazioni con Alice Huang, in passato collegata a Megaspeed [S04].

**Accuse non accertate:** la stampa riferisce che funzionari d'intelligence USA avrebbero identificato Alice Huang, ex dirigente di Megaspeed International, come un asset cinese; ricostruzioni di stampa hanno collegato la vicenda a presunte triangolazioni di chip dal valore di almeno 7,5 miliardi di dollari. Il governo cinese nega le accuse; Megaspeed dichiara di rispettare la normativa e di aver cooperato con ispettori USA. Le cifre riferite non costituiscono un accertamento giudiziario, non dimostrano una spedizione illegale di quell'importo e non provano che Jensen Huang ne fosse consapevole [S17][S23][S24][S25].

**Elemento geopolitico importante:** il segretario di Stato Marco Rubio avrebbe coordinato un memorandum e informato Trump sul rischio, secondo inchieste giornalistiche; il segretario al Commercio Howard Lutnick sarebbe stato avvertito. Le decisioni e licenze sull'export sono invece di competenza del Dipartimento del Commercio/BIS. Le frizioni fra Rubio, Tesoro e Commercio sono **ricostruzioni attribuite a fonti giornalistiche**, non ordini pubblici del Dipartimento di Stato contro Huang, né prova di una regia a beneficio delle IPO [S19][S20][S06].

**Conseguenza europea documentata, distinta dagli scenari:** Nvidia e Mistral hanno alleanze infrastrutturali e di ricerca, mentre ASML ha investito in Mistral. Le infrastrutture europee presentate come sovrane possono restare dipendenti da hardware e stack di calcolo statunitensi e da una supply chain globale. Questo è un rischio industriale fondato su relazioni pubbliche, non una prova che l'indagine di intelligence abbia già interrotto forniture a Mistral [S09][S10][S11][S12][S13][S14].

## 2. Perimetro, metodologia e attribuzione

- **Periodo:** precedente rilevante 2024–2025; ricostruzione intensiva 2026, fino al 12 novembre. Il dossier non pretende esaustività di tutte le azioni normative o tutti i finanziamenti globali.
- **Geografie:** USA, Cina, Singapore, Taiwan, Francia, Paesi Bassi, Germania, Italia, Regno Unito e Unione europea; ricadute possibili sui paesi che ospitano cloud e data center.
- **Temi:** export control e sanzioni tecnologiche; FDI e supply chain; intelligence economica; lobbying; competizione open-weight vs modelli chiusi; sovranità AI; mercati e incentivi delle IPO; rischio europeo di concentrazione.
- **Metodo probatorio:** usare E1 per il **fatto documentato dall'atto primario** (esistenza/tenore di una comunicazione, filing, regola, partnership), non per convertire automaticamente in fatto vero ogni allegazione dell'atto; E2 per attribuzione ufficiale non giudicata; E3 per riscontri investigativi indipendenti; E4 per notizia/contesto secondario; E5 esclusivamente per ipotesi. Applicare sempre a **singole proposizioni**, non indiscriminatamente al caso.
- **Avvertenza sui nomi:** Alice Huang e Jensen Huang non sono parenti, per quanto risulta dalla ricostruzione Reuters; nessuna colpevolezza penale o collaborazione consapevole è stata accertata nelle fonti consultate [S16]. Le questioni di vita privata sono considerate solo laddove riguardino le segnalazioni sul controspionaggio e la governance.
- **Fonti incrociate:** documenti Nvidia/SEC/BIS/Congresso e comunicazioni aziendali Mistral/ASML/Commissione UE come livello documentale; Reuters/AP/Axios come reportage originario, distinguendo gli anonimi/leak dalle prove pubbliche. Dichiarazioni di attori interessati sono etichettate come tali.
- **Registro di provenienza:** [S01]–[S35] a fine documento. URL e date sono inclusi per ogni blocco.

## 3. Cronologia ragionata

| Data | Avvenimento o dichiarazione | Natura della prova | Fonti |
| --- | --- | --- | --- |
| 2024–2025 | Nascita e crescita dei rapporti commerciali Nvidia con operatori asiatici, incluso Megaspeed; cronologie di stampa collocano incontri con Alice Huang nel 2024–2025 | Ricostruzione giornalistica, non accertamento di spionaggio | [S16], [S17] |
| 11/02/2025 | Commissione UE annuncia InvestAI, obiettivo mobilitare 200 mld EUR, inclusi 20 mld per gigafactories | Annuncio istituzionale, risorse da non confondere con spesa già sostenuta | [S27] |
| 11/06/2025 | Nvidia e partner europei presentano programmi cloud/AI industriale in Francia, Germania, Italia e UK | Annuncio societario | [S09], [S13] |
| 09/09/2025 | ASML annuncia investimento di 1,3 mld EUR in Mistral e quota circa 11% fully diluted, nell'ambito del round dell'epoca | Accordo/operazione comunicata ufficialmente | [S12] |
| 08/12/2025 | Trump annuncia apertura controllata alle esportazioni di H200 verso clienti cinesi autorizzati, secondo successivo atto BIS | Ricostruzione temporale nel comunicato regolatorio | [S06] |
| 13/01/2026 | BIS passa alla revisione caso per caso delle licenze H200, MI325X e chip assimilabili verso Cina | Misura ufficiale; non licenza indiscriminata | [S06] |
| 23/02/2026 | Anthropic accusa DeepSeek, Moonshot e MiniMax di distillazione non autorizzata di Claude, 16+ mln scambi secondo sue osservazioni | Accusa e analisi del soggetto interessato, non sentenza | [S28] |
| 11–16/03/2026 | Nvidia annuncia investimento in Nebius; Mistral annuncia ingresso nella NVIDIA Nemotron Coalition e collaborazione sui modelli aperti | Reuters per investimento; comunicato Mistral per collaborazione | [S15], [S10] |
| 08/06/2026 | OpenAI annuncia deposito **riservato** di bozza S-1, senza tempistica definitiva per IPO | Dichiarazione societaria; non IPO completata | [S31] |
| 03/06–30/07/2026 | Commissione UE presenta pacchetto Tech Sovereignty e bandi per AI Gigafactories | Proposte e bandi, non infrastrutture già tutte operative | [S26], [S29] |
| 22/07/2026 | Jensen Huang difende pubblicamente uso di modelli AI open-weight cinesi, contestando una linea di esclusione generale | Dichiarazioni riportate in intervista Axios; posizione aziendale/commerciale | [S18] |
| 11/08/2026 | Mistral presenta endpoint regionali e disponibilità di modelli esterni, inizialmente Z.ai GLM-5.2, sulla propria infrastruttura | Comunicazione Mistral: distribuzione di un modello cinese ≠ controllo cinese su Mistral | [S14] |
| 08/09/2026 | Mistral annuncia Serie D da 3 mld EUR, valutazione post-money superiore a 21 mld EUR | Comunicato del beneficiario; non confronto diretto di redditività con altri laboratori | [S30] |
| 21/10/2026 | Mistral e Nvidia annunciano estensione della collaborazione a CAE/EDA e simulazione industriale | Comunicazione congiunta riportata da Mistral | [S11] |
| 05/11/2026 | Tre commissioni della Camera USA chiedono a Huang un briefing riservato per il 18 novembre sulle relazioni con Alice Huang e sicurezza Nvidia | Comunicazione ufficiale. Richiesta ≠ colpevolezza | [S04] |
| 08/11/2026 | Board Nvidia istituisce un'indagine indipendente per verificare le notizie su presunta operazione d'intelligence estera | Comunicazione ufficiale, nessuna violazione accertata dal board a quella data | [S03] |
| 09–10/11/2026 | Stampa riferisce di memorandum di Rubio su presunto asset cinese e di spedizioni attraverso Megaspeed; Pechino respinge l'accusa | Reporting anonimo/controverso e smentita pubblica | [S17], [S19], [S24] |
| 10/11/2026 | Anthropic avvia roadshow IPO: prezzo indicativo 70–78 USD, titolo ANT, registrazione non ancora efficace | Fonte societaria e prospetto SEC | [S32], [S33] |
| 11–12/11/2026 | Board accetta dimissioni Huang l'11, Nvidia pubblica il 12 il passaggio a Colette Kress e Harvey Jones | Filing societario: conferma dimissioni, non motivazione causale | [S01], [S02] |
| 12/11/2026 | Megaspeed dichiara di avere cooperato con verifiche BIS; Reuters riferisce di imprese cinesi interessate a capacità Nvidia estera e di discussioni su ulteriori controlli | Dichiarazione aziendale e reporting; sviluppi normativi non da trattare come leggi già attive | [S25], [S21], [S22] |

## 4. Blocchi investigativi e affermazioni verificabili

### 4.1 Nvidia: indagine indipendente, governance e presunta operazione di intelligence

**Fatti con fonte primaria:** il comunicato del board dell'8 novembre parla di indagine indipendente condotta da amministratori e consulenti esterni e afferma che non esistono allora ragioni per ritenere compromessi segreti Nvidia o sicurezza nazionale. Il Form 8-K e il comunicato del 12 novembre confermano uscita dal board e successione ad interim [S03][S01][S02].

**Ricostruzione giornalistica:** testate statunitensi attribuiscono a fonti d'intelligence la valutazione che Alice Huang fosse vicina o collegata a servizi cinesi e avesse cercato di ottenere informazioni o influenzare decisioni sui chip. Reuters/AP riferiscono di un rapporto personale ammesso dal CEO; ulteriori notizie su un'altra relazione personale hanno accompagnato la crisi. I rapporti personali non sono prova di un incarico di intelligence né, da soli, prova che l'interessato avesse consapevolezza di una presunta operazione [S16][S17][S34].

**Contraddittorio:** la Cina nega ogni attività di spionaggio in questo caso; Megaspeed sostiene di avere cooperato con BIS; Nvidia ha contestato le inferenze su perdita di segreti e ha avviato l'indagine. La stampa riporta inoltre che Singapore non avrebbe accertato pubblicamente una triangolazione illecita tramite l'intermediario, circostanza che richiede riscontro diretto con autorità singaporiane prima della promozione a fatto concluso [S03][S24][S25][S35].

**Cosa NON si può concludere:** (i) Huang ha volontariamente lavorato per la Cina; (ii) Alice Huang è stata condannata per spionaggio; (iii) Nvidia ha trasferito segreti classificati; (iv) la causa legale delle dimissioni è provata dal Form 8-K; (v) un rapporto personale dimostra automaticamente un'operazione ordinata da Pechino.

### 4.2 Megaspeed, chip, triangolazioni e limiti delle cifre

- Reportage hanno sostenuto che una rete di società avrebbe facilitato il trasferimento o l'accesso a circa **240.000 GPU** e a **7,5 mld USD** di processori Nvidia verso soggetti cinesi, riferendo sospetti di aggiramento dell'export control. Registrare entrambi i numeri **come attribuzioni alla testata originatrice, rilanciate da Reuters**, con periodo, prodotti, definizione di "spedito" e destinazione finale da verificare [S17][S16].
- La relazione commerciale Nvidia–Megaspeed, anche se documentata, **non dimostra da sola** violazione delle regole. Distinguere fatturazione a Singapore, consegna fisica, cliente finale, uso locale, accesso remoto e trasferimento in Cina.
- Il 10-Q Nvidia relativo al trimestre chiuso il 26 luglio 2026 riferisce che vendite H200 autorizzate verso clienti cinesi sono state limitate, inferiori all'1% dei ricavi Data Center trimestrali più recenti e soggette a condizioni specifiche e a un dazio del 25%. Non è metodologicamente corretto confrontare direttamente questa cifra con i 7,5 mld USD di presunte transazioni di intermediari, che potrebbero riferirsi a altri prodotti, periodi, flussi e destinatari [S07].
- Il 12 novembre Megaspeed, attraverso il suo CEO, ha affermato di aver cooperato con ispezioni BIS e di attribuire priorità alla conformità normativa. Questa è **una dichiarazione di parte**, non un'assoluzione [S25].
- Per una verifica più solida occorrono documenti BIS/DOJ, comunicati Singapore, eventuali provvedimenti Entity List e catena doganale/seriali dei chip. In assenza, non attribuire importi illeciti come fatti.

### 4.3 Washington: Stato, Commercio, Tesoro, Congresso e lobbying

**Ruoli istituzionali distinti:**
1. **Dipartimento del Commercio/BIS:** autorità di licenze e controlli esportazione, con passaggio ufficiale a valutazione caso per caso H200/MI325X il 13 gennaio 2026 [S06].
2. **Dipartimento di Stato/Rubio:** secondo reporting Axios e altre testate, ha coordinato o comunicato valutazioni di controspionaggio sull'affare Huang/Alice Huang e informato l'amministrazione. Non è stato reperito un memorandum declassificato che consenta di verificarne integralmente tenore, destinatari e istruzioni [S19].
3. **Tesoro/Bessent e altre componenti dell'amministrazione:** Axios descrive contrasti sulla tempestività di interventi contro deviazioni di chip e sul ruolo di Lutnick, basandosi su fonti anonime. Registrare come **conflitto politico-amministrativo riportato**, non come documento decisionale pubblico o prova di corruzione [S20].
4. **Congresso:** la richiesta di briefing dei tre presidenti il 5 novembre è pubblica; il 12 novembre Reuters riferisce anche di lettere di senatori per conservare documentazione. Sono atti e richieste di controllo, non imputazioni o sentenze [S04][S23].
5. **Huang/Nvidia:** la promozione commerciale dell'accesso al mercato cinese e la difesa dei modelli aperti sono riscontrabili in dichiarazioni pubbliche. Non equivalgono a favoreggiamento dello spionaggio [S18][S07].

**Cautela centrale:** parlare di "pressioni del Dipartimento di Stato contro Nvidia" è giustificabile solo come *ipotesi descrittiva del confronto politico*; non risulta confermato un ordine pubblico del Dipartimento di Stato che abbia causato le dimissioni o imposto alla società una linea sui modelli cinesi. Le scelte su export, sicurezza nazionale e concorrenza fra modelli sono **politiche diverse con incentivi parzialmente confliggenti**.

### 4.4 Guerra degli standard: modelli open-weight cinesi e rivalità con OpenAI/Anthropic

Jensen Huang ha difeso in un'intervista Axios del 22 luglio 2026 la possibilità per aziende statunitensi di utilizzare validi modelli aperti sviluppati in Cina. Questo può essere coerente con il ruolo Nvidia di fornitore di hardware e software capace di eseguire molti modelli, indipendentemente dalla loro origine. La spiegazione è un'**inferenza economica plausibile** sulla base del business Nvidia, non una prova di una strategia coordinata con Pechino [S18][S07].

Anthropic ha pubblicato nel febbraio 2026 una propria indagine accusando DeepSeek, Moonshot e MiniMax di distillazione non autorizzata di Claude, stimando oltre 16 milioni di interazioni su circa 24.000 account fraudolenti. È una **attribuzione tecnica aziendale**, fondata sulle osservazioni dichiarate da Anthropic, non una pronuncia giudiziaria indipendente. Il rapporto di settembre aggiunge ulteriori accuse su Alibaba/Qwen e altri laboratori [S28][S29].

**Non confondere:**
- *open-weight* = pesi scaricabili/eseguibili, con condizioni di licenza e accesso ai dati da verificare;
- *open-source* = disponibilità e diritti effettivi di codice/componenti secondo licenze applicabili;
- *distillazione* = famiglia tecnica anche lecita; può diventare contestata se viola contratti, accessi o diritti; le accuse specifiche vanno provate caso per caso;
- *appoggio ai modelli aperti* ≠ *approvazione di violazioni delle condizioni d'uso*;
- *distribuzione di un modello cinese* ≠ *trasferimento di controllo societario* a soggetti cinesi.

**Fatto che complica l'interpretazione di blocchi USA/Cina contrapposti:** Mistral ha annunciato nell'agosto 2026 l'offerta del modello di Z.ai GLM-5.2 sulla propria infrastruttura europea con controllo regionale. Quindi un operatore europeo può promuovere sovranità sull'hosting **e** offrire un modello sviluppato in Cina [S14]. Questo non stabilisce alcuna influenza illecita.

### 4.5 IPO: Anthropic e OpenAI, incentivi finanziari e limiti del nesso causale

- **Anthropic:** il 10 novembre 2026 ha annunciato l'avvio del roadshow per un'IPO proposta, con indicazione 825 milioni di azioni, fascia 70–78 USD e ticker previsto ANT. La registrazione non risultava ancora efficace al momento dell'annuncio. Il prospetto SEC è verificabile come fonte primaria [S32][S33].
- **OpenAI:** l'8 giugno 2026 ha comunicato di aver presentato una **bozza riservata di S-1**, dichiarando esplicitamente di non avere ancora deciso tempi e modalità della possibile quotazione. Pertanto nel dossier le due società **non sono nella medesima fase procedurale** [S31].
- Reuters descrive grandi fabbisogni di capitale, investimenti in infrastruttura, relazioni fra fornitori di GPU, cloud e laboratori AI e possibili operazioni di investimento collegate all'IPO Anthropic [S36].
- **Inferenza da testare, non fatto:** dinamiche pro/contro modelli cinesi, preoccupazioni per sicurezza, relazioni con fornitori di calcolo e imminenti IPO potrebbero influenzare posizionamento competitivo e lobbying. **Nessuna fonte raccolta dimostra che Rubio, Lutnick o Nvidia abbiano orchestrato lo scandalo per favorire un'IPO, danneggiare Mistral o proteggere un laboratorio specifico.**
- Non trasformare rivalità commerciale e coincidenza temporale in una relazione di comando, finanziamento illecito o manipolazione di mercato.

## 5. Conseguenze e vulnerabilità europee

### 5.1 Catena del valore: non basta possedere i dati o ospitare il cloud in Europa

La precedente Fonte_04 descrive la dipendenza composita europea: design GPU statunitense, wafer spesso taiwanesi, equipaggiamenti ASML olandesi, minerali/lavorazioni di altre regioni, software e infrastrutture cloud. Il caso Nvidia fornisce un esempio concreto della concentrazione di potere in un soggetto privato con rilievo strategico [S04-CORPUS][S07][S09].

**Nodi principali del rischio europeo:**
- **Fornitura hardware:** prezzo, disponibilità, roadmap, priorità commerciali e possibili ulteriori controlli export USA.
- **Software/stack:** CUDA, librerie e tool NVIDIA; costi di portabilità tecnica da misurare, non assumere impossibilità assoluta.
- **Contratti e capitale:** accordi con cloud/neocloud e finanziamenti che possono allineare investitori, fornitori e clienti senza implicare illecito.
- **Interdipendenza ASML/TSMC:** ASML è un punto di forza della catena mondiale ma anche esposto a regimi di controllo sulle esportazioni e ai clienti manifatturieri esteri.
- **Giurisdizione e accesso remoto:** collocazione in UE non rende di per sé immune una infrastruttura che utilizza prodotti soggetti a regole USA; la portata concreta richiede analisi legale su componente, esportazione, utilizzatore e giurisdizione.
- **Disponibilità di modelli:** distinguere autonomia sull'hosting, sulle licenze dei modelli, sui pesi, sui dati e sulla capacità di addestrare modelli frontier.

### 5.2 Mistral: indipendenza strategica e alleanze esterne

**Relazioni documentate:**
1. Giugno 2025: Mistral e Nvidia annunciano cloud europeo e una prima fase con 18.000 sistemi NVIDIA Grace Blackwell secondo il comunicato di lancio. È una **capacità programmata/annunciata**, non la prova che tutti i sistemi fossero già operativi [S09].
2. 16 marzo 2026: Mistral è membro fondatore della Nemotron Coalition e intende co-sviluppare modelli aperti con NVIDIA, sfruttandone cloud, tool e risorse [S10].
3. 21 ottobre 2026: Mistral e Nvidia annunciano nuove collaborazioni per simulazione industriale, CAD/CAE/EDA e modelli fisici; Mistral afferma di aver addestrato un'anteprima di Large 4 su 3.800 GPU Grace Blackwell in data center propri in Europa [S11].
4. Settembre 2025: ASML investe 1,3 mld EUR in Mistral per circa 11% e un accordo pluriennale di collaborazione [S12].
5. Settembre 2026: Mistral annuncia raccolta di 3 mld EUR per sviluppare capacità di ricerca e compute; l'azionariato nel suo complesso necessita degli atti societari aggiornati per affermare quote correnti dopo la Serie D [S30].
6. Agosto 2026: Mistral propone hosting regionale e modelli terzi, incluso Z.ai, dichiarando l'obiettivo di costruire capacità europea fino a 1 GW entro il 2030. Il GW è **un obiettivo futuro**, non la capacità installata nel 2026 [S14].

**Paradosso documentabile:** un'impresa di modelli europei può controllare pesi e data residency e sviluppare propri data center, ma affidarsi comunque a GPU/stack NVIDIA e a componenti di una catena globale. Questo è **dipendenza industriale**, non subordinazione politica accertata né prova che la Cina controlli Mistral.

**Scenari condizionali, non risultati osservati:**
- *Forniture Nvidia più onerose o meno disponibili:* possibile rallentamento del compute in Europa; verificare contratti, opzioni AMD/altre architetture, penali e programmazione della capacità.
- *Cambio strategico della nuova dirigenza Nvidia:* possibili modifiche a investimenti e roadmap partner; nessuna fonte disponibile prova la cancellazione dell'alleanza Mistral.
- *Controlli sull'accesso remoto:* potrebbero investire operatori cloud europei che offrono compute a utenti soggetti a restrizioni; verificare giurisdizione e stato delle norme prima di formulare un rischio specifico.
- *Adozione degli open-weight:* può migliorare portabilità del livello modello e margini di scelta, senza eliminare la dipendenza dal calcolo.

### 5.3 Altre aziende e governi europei

- **Nebius (Paesi Bassi):** Reuters ha riportato un investimento Nvidia di 2 mld USD nel marzo 2026 e circa 8,3% nella società, legata a infrastrutture AI; il 12 novembre Reuters ha riferito di ritardi e revisione delle previsioni economiche. Le notizie **non dimostrano** che il caso di intelligence abbia causato quei ritardi [S15][S37].
- **Nscale (Regno Unito):** partner di infrastrutture Nvidia nei programmi UK 2025; Nvidia ha inoltre annunciato nell'ottobre 2026 un impegno quinquennale di accesso a calcolo per ricerca britannica su sicurezza degli agenti AI. Sono **annunci di collaborazione e risorse**, non fondi pubblici erogati [S09][S38].
- **Domyn (Italia), Fastweb, Orange, Swisscom, Telefónica, Telenor:** figurano nei programmi annunciati da Nvidia per AI cloud e telecomunicazioni europee; per valutare la dipendenza occorrono volumi effettivamente acquistati, accordi, durata e possibilità di sostituzione [S09].
- **Germania:** nel 2025 Nvidia ha annunciato un cloud per applicazioni industriali tedesche; nell'ottobre 2026 Reuters ha documentato ulteriori accordi e iniziative tra Nvidia e industrie tedesche. Valutare se il rischio sia su hardware, stack, cloud o governance dei fornitori [S09][S39].
- **ASML (Paesi Bassi):** posizione duplice, fornitore strategico di attrezzature litografiche e investitore Mistral. Le restrizioni USA sui chip o su attrezzature verso Cina non vanno equiparate a un embargo su acquisti europei [S12][S26].

### 5.4 Politica industriale e sovranità europea

La Commissione UE ha adottato nel 2025–2026 un programma per aumentare capacità e indipendenza tecnologica: InvestAI, AI Factories e Gigafactories, proposta Cloud and AI Development Act, Chips Act 2.0 e Open Source Strategy [S26][S27][S40]. **Un bando, una proposta legislativa, un investimento annunciato e un data center operativo sono stati diversi.**

Dimensioni da monitorare periodicamente: quota di compute operativo in UE, fornitori GPU effettivi, beneficiari/controllanti, accesso alle licenze, possibilità di migrare stack, concentrazione dei contratti pubblici, costi energetici, condizioni di controllo remoto, localizzazione dei pesi, audit delle supply chain e impatto sulle piccole imprese europee.

### 5.5 Reazioni di mercato: osservazione limitata

Il 12 novembre Reuters ha riferito ribassi per alcune aziende europee dei semiconduttori (ASML, STMicroelectronics, Infineon, Soitec e altre) in un contesto di incertezza su Nvidia e settore AI. **La concomitanza borsistica non permette di attribuire l'intera variazione al caso Huang né di inferire un danno contrattuale già avvenuto per Mistral** [S41].

## 6. Ipotesi investigative, ciascuna falsificabile

| Codice proposto | Domanda | Elemento già documentato | Cosa manca / criterio di falsificazione | Trattamento |
| --- | --- | --- | --- | --- |
| AI-H01 | Esistono prove pubblicamente verificabili di influenza deliberata di intelligence cinese sulla politica Nvidia relativa alle esportazioni? | Board inquiry e riportate valutazioni intelligence [S03][S17] | Risultati indagine, atti declassificati, testimonianze, ordini/mandati; distinguere contatto, reclutamento e influenza riuscita | **E5 aperta**, non edge |
| AI-H02 | Megaspeed ha realmente aggirato controlli su specifiche GPU e end-user? | Reporting su transazioni e dichiarazione Megaspeed [S17][S25] | Provvedimenti BIS/DOJ, documenti doganali, seriali, destinazioni finali, eventuali archiviazioni | **E5 aperta** |
| AI-H03 | Come cambiarono decisioni BIS prima/dopo il memorandum ascritto a Rubio? | Regola BIS e reporting Axios [S06][S19][S20] | Date istruttorie, autorizzazioni, ricorsi, ordini di esecuzione, confronto con decisioni pre-memo | **E5 aperta** |
| AI-H04 | La strategia commerciale di Nvidia a favore di modelli cinesi ha inciso sulla posizione regolatoria USA? | Intervista Huang e norme BIS [S18][S06] | Registri di lobbying, meeting, documenti decisionali, obiettivi e causalità | **E5 aperta**, no coordinamento dedotto |
| AI-H05 | Le scelte politiche sui modelli aperti sono correlate a IPO e interessi finanziari in modo verificabile? | Roadshow Anthropic, S-1 riservato OpenAI, dichiarazioni di settore [S31][S32] | Disclosure, comunicazioni, posizioni dei singoli attori, sequenza cause-effetti, alternative spiegazioni | **E5 aperta** |
| AI-H06 | In quali punti Mistral e altre AI factories europee dipendono da risorse critiche controllate da aziende USA? | Accordi Nvidia-Mistral e partner [S09][S10][S11] | BOM, contratti, switching cost, quote vendor, disponibilità alternative | **Misurazione esposizione**, non condotta illecita |
| AI-H07 | Controlli USA sull'accesso cloud remoto potrebbero restringere servizi europei e a quali clienti? | Reuters su iniziative al Congresso [S21][S22] | Testi finali e stato delle norme, export classifications, end-user e termini dei provider UE | **Scenario giuridico**, non legge adottata |
| AI-H08 | Il modello europeo open-weight riduce rischio di lock-in sul livello dei modelli pur mantenendo lock-in hardware? | Offerta regionale Mistral, ASML, Nvidia [S12][S14] | Portabilità misurata, spesa per GPU, vincoli licenza, test di migrazione | **Ipotesi industriale** |
| AI-H09 | Quali investimenti/incubazioni Nvidia nei cloud europei creano dipendenze finanziarie reciproche? | Nebius, Nscale, Mistral e altri partner [S09][S15] | Cap table, opzioni, debito garantito, contratti take-or-pay, audit cash flow | **Ipotesi di concentrazione**, non collusione |
| AI-H10 | In quale misura l'UE può sfruttare ASML come leva senza danneggiare la propria filiera? | Posizione ASML e pacchetto sovranità [S12][S26] | Dati vendite, licenze olandesi/USA, analisi di sostituibilità e risposte cinesi | **Scenario policy** |

**Pre-esistente:** collegare questo filone all'ipotesi canonica **H17** (possibile interruzione multinodo EU/Taiwan/Cina/controlli USA/energia), senza modificarla. Nel database già esistono i nodi **NVIDIA, ASML, TSMC, CN, US, EU**. L'intero dossier **non** deve aggiungere archi automatici alle ipotesi E5.

## 7. Proposta di ingestione strutturata (non applicata)

La seguente è una **coda di decisioni**, non il risultato di un'importazione già eseguita. Gli ID locali sono univoci per questo dossier e non devono essere trattati come ID canonici assegnati.

| ID locale | Tipo candidato | Soggetto | Fonte base | Azione proposta |
| --- | --- | --- | --- | --- |
| AI-2026-001 | EVENT | Regola BIS su H200 del 13/01/2026 | [S06] | Verificare se già TL/EXT; se assente evento normativo |
| AI-2026-002 | EVENT | Richiesta briefing Camera USA del 05/11/2026 | [S04] | Evento istituzionale distinto dall'accusa |
| AI-2026-003 | EVENT | Apertura indagine Nvidia dell'08/11/2026 | [S03] | Evento procedurale, senza attribuzione automatica |
| AI-2026-004 | EVENT | Dimissioni CEO Nvidia, 11–12/11/2026 | [S01][S02] | Evento societario con data decisione e annuncio separati |
| AI-2026-005 | ALLEGATION | Presunta attività intelligence Alice Huang | [S17][S19] | Claim/reporting, **non edge fattuale CN→persona** |
| AI-2026-006 | ALLEGATION | Presunte triangolazioni via Megaspeed | [S17] | Claim con numeri e caveat, non trasferimento illegale accertato |
| AI-2026-007 | COUNTER_STATEMENT | Smentita Cina dell'accusa intelligence | [S24] | Record dichiarazione/smentita collegata |
| AI-2026-008 | COUNTER_STATEMENT | Dichiarazioni Nvidia e Megaspeed su compliance | [S03][S25] | Record dichiarazione con soggetto e data |
| AI-2026-009 | NEW_ENTITY | Mistral AI | [S10][S30] | Verificare assenza nel canonico prima dell'aggiunta |
| AI-2026-010 | NEW_ENTITY | Megaspeed International | [S25] | Verificare alias/ID e qualificazioni |
| AI-2026-011 | NEW_ENTITY | Anthropic, OpenAI, Z.ai, Nebius, Nscale, Domyn | [S14][S15][S31][S32] | Individuare nodi esistenti; dividere in più operazioni |
| AI-2026-012 | RELATION | Mistral ↔ Nvidia (partnership) | [S10][S11] | Solo collaborazione documentata, no controllo |
| AI-2026-013 | RELATION | ASML → Mistral (investimento) | [S12] | 1,3 mld EUR / ~11% nel **2025**, stato attuale da aggiornare |
| AI-2026-014 | RELATION | Nvidia → Nebius (investimento riportato) | [S15] | Verificare comunicato e termini della quota |
| AI-2026-015 | RELATION | Mistral → distribuzione Z.ai GLM | [S14] | Fornitura modello sulla piattaforma, non possesso |
| AI-2026-016 | EVENT | Anthropic avvia roadshow IPO 10/11/2026 | [S32][S33] | Evento finanziario, non IPO conclusa |
| AI-2026-017 | EVENT | OpenAI deposita bozza S-1 riservata 08/06/2026 | [S31] | Evento procedurale distinto |
| AI-2026-018 | CLAIM | Anthropic attribuisce distillazione a laboratori cinesi | [S28][S29] | Claim aziendale/tecnico; evitare accertamento penale |
| AI-2026-019 | EXPOSURE | EU compute e lock-in Nvidia/CUDA/supply chain | [S09][S13][S26] | Proposta metrica, non inventare quote senza dati |
| AI-2026-020 | HYPOTHESIS | AI-H01…AI-H10 | Questa fonte | Importare solo come quesiti aperti, dopo dedup H17 |

**Non creare una relazione** "Rubio controlla Nvidia", "Pechino controlla Huang", "Mistral finanziata dalla Cina", "OpenAI/Anthropic ordinano un'inchiesta", "Nvidia favorisce illegalmente Pechino", né "dimissioni causate da un servizio straniero" senza una fonte primaria che provi quel preciso predicato.

**Nota tecnica:** i nuovi record richiedono ID assegnati da un importatore che controlli collissioni, Zod, Stato M5, citazioni e traduzioni. Nessuna modifica a data/ è inclusa in questa PR. L'eventuale sidecar JSON è oggetto della M6 e non viene simulato come già generato.

## 8. Indicatori e monitoraggio successivo

| Indicatore | Definizione riproducibile | Cadenza suggerita |
| --- | --- | --- |
| Indagine board Nvidia | Pubblicazione conclusioni/aggiornamenti ufficiali; stato e perimetro | Giornaliera finché aperta |
| Indagine e atti US BIS/DOJ | Procedimenti/declassificazioni/Entity List riferiti a Megaspeed o clienti | Settimanale |
| Congresso USA | Briefing del 18 novembre (se tenuto), audizioni, verbali e documenti | All'evento |
| Regole export/remote compute | Testi approvati e loro entrata in vigore, distinta da proposte | Settimanale |
| Mistral–Nvidia | Conferme commerciali, capacità effettiva, cambio partnership | Trimestrale |
| AI factories UE | Infrastrutture attive vs annunciate e soggetti gestori | Trimestrale |
| Nebius/Nscale/Domyn | Investimenti, bilanci, finanziamento, concentrazione clienti/vendor | Trimestrale |
| IPO Anthropic/OpenAI | Depositi e effective dates SEC, decisioni formali, non rumors | All'evento |
| Modelli open-weight | Licenze, luogo inferenza, origine modello, eventuali disclosure di training | Mensile |
| Evidenze contrarianti | Smentite, chiusura/archiviazione indagini, sentenze, rettifiche | Continuativa |

## 9. Tabella delle fonti e verificabilità

**Legenda:** P = primaria (atto/comunicato di parte o istituzionale); J = giornalismo originale o ripresa verificata; A = analisi o contesto. Una fonte P conferma che un'istituzione/azienda ha fatto **quella dichiarazione**, non necessariamente la verità di ogni affermazione contenuta.

| ID | Data | Editore | Tipo | Oggetto e limiti | URL |
| --- | --- | --- | --- | --- | --- |
| S01 | 12/11/2026 | SEC / Nvidia | P | Form 8-K, item 5.02, data decisione 11/11, successione; verifica pagina SEC anche con mirror | https://www.sec.gov/Archives/edgar/data/1045810/000104581026000082/0001045810-26-000082-index.htm |
| S02 | 12/11/2026 | Nvidia | P | Comunicato dimissioni; link societario da riverificare se non accessibile | https://investor.nvidia.com/news/press-release-details/2026/NVIDIA-Announces-CEO-Transition/ |
| S03 | 08/11/2026 | Nvidia Board | P | Dichiarazione indagine indipendente e nessuna perdita allora accertata | https://investor.nvidia.com/news/press-release-details/2026/Statement-from-NVIDIA-Board-of-Directors/default.aspx |
| S04 | 05/11/2026 | US House Foreign Affairs | P | Richiesta 3 presidenti di commissione; accuse indicate come pubblicamente riportate | https://foreignaffairs.house.gov/news/press-releases/chairmen-mast-moolenaar-and-crawford-request-jensen-huang-brief-congress-on-link-to-chinese-intelligence-asset |
| S05 | 05/11/2026 | US House China Select Committee | P | Rilancio istituzionale della medesima richiesta, **non seconda indagine** | https://chinaselectcommittee.house.gov/media/press-releases/moolenaar-mast-and-crawford-seek-briefing-from-jensen-huang-on-ties-to-chinese-intelligence-asset |
| S06 | 13/01/2026 | US Commerce/BIS | P | Revisione caso per caso licenze H200/MI325X | https://www.bis.gov/press-release/department-commerce-revises-license-review-policy-semiconductors-exported-china |
| S07 | 2026/Q2 FY2027 | Nvidia/SEC | P | 10-Q: H200 <1% Data Center recent quarter, vincoli, tariffa e rischi | https://www.sec.gov/Archives/edgar/data/1045810/000104581026000075/nvda-20260726.htm |
| S08 | 12/11/2026 | Reuters | J | Dimissioni Nvidia e contesto governance; non fonte della causa legale | https://www.reuters.com/business/retail-consumer/nvidia-ceo-jensen-huang-step-down-big-blow-ai-boom-2026-11-12/ |
| S09 | 11/06/2025 | Nvidia Newsroom | P | Partnership e capacità **annunciate** in UE/UK | https://nvidianews.nvidia.com/news/europe-ai-infrastructure |
| S10 | 16/03/2026 | Mistral | P | Nemotron Coalition e collaborazione Nvidia | https://mistral.ai/news/mistral-ai-and-nvidia-partner-to-accelerate-open-frontier-models/ |
| S11 | 21/10/2026 | Mistral | P | Sviluppo congiunto engineering/CAE/EDA; GPU training Large 4 dichiarate | https://mistral.ai/news/mistral-nvidia-ai-for-industrial-engineering/ |
| S12 | 09/09/2025 | ASML | P | Investimento Mistral 1,3 mld EUR e quota ~11% al 2025 | https://www.asml.com/en/news/press-releases/2025/asml-mistral-ai-enter-strategic-partnership |
| S13 | 11/06/2025 | Mistral | P | Lancio Mistral Compute, obiettivi sovranità | https://mistral.ai/news/mistral-compute/ |
| S14 | 11/08/2026 | Mistral | P | Endpoint regionali, Z.ai GLM, strategia 1 GW **obiettivo 2030** | https://mistral.ai/news/regional-inference-open-models-new-compute/ |
| S15 | 11/03/2026 | Reuters | J | Investimento Nvidia 2 mld USD in Nebius, quota riferita | https://www.reuters.com/technology/nvidia-invest-2-billion-ai-cloud-firm-nebius-2026-03-11/ |
| S16 | 11/11/2026 | Reuters | J | Cronologia caso Huang/Megaspeed: verificare narrativa e date | https://www.reuters.com/world/china/how-nvidia-ceo-jensen-huang-got-entangled-china-chip-spy-scandal-2026-11-11/ |
| S17 | 10/11/2026 | Reuters | J | **Riporta accuse**, incluse cifre 240k GPU / 7,5 mld USD | https://www.reuters.com/world/china/nvidia-ceos-affair-aided-75-billion-chip-shipments-china-information-reports-2026-11-10/ |
| S18 | 22/07/2026 | Axios | J | Intervista Huang sui modelli aperti cinesi | https://www.axios.com/2026/07/22/nvidia-jensen-huang-china-open-source-ai |
| S19 | 10/11/2026 | Axios | J | Memo Rubio e allerta a Lutnick, secondo fonti anonime | https://www.axios.com/2026/11/10/lutnick-nvidia-jensen-huang-china-memo |
| S20 | 11/11/2026 | Axios | J | Ricostruzione frizioni Lutnick/Bessent/Commercio, da verificare con atti | https://www.axios.com/2026/11/11/trump-lutnick-nvidia-china-chip-export-controls |
| S21 | 12/11/2026 | Reuters | J | Domanda di compute estero presso operatori da parte di AI cinesi | https://www.reuters.com/world/china/chinese-ai-firms-rush-secure-nvidia-chip-capacity-spy-scandal-stirs-fear-us-2026-11-12/ |
| S22 | 12/11/2026 | Reuters | J | Proposte di legge e regimi export possibili, non tutte in vigore | https://www.reuters.com/world/china/tougher-curbs-ai-chip-sales-china-likely-after-nvidia-ceo-resigns-2026-11-12/ |
| S23 | 12/11/2026 | Reuters | J | Richiesta di preservare registri da senatori Warren/Coons | https://www.reuters.com/world/china/senior-us-democratic-senators-urge-administration-preserve-nvidia-export-records-2026-11-12/ |
| S24 | 09–10/11/2026 | Ministero Esteri RPC via ambasciata/Xinhua | P | Smentita pubblica cinese, **posizione di parte** | https://la.china-embassy.gov.cn/eng/news/202611/t20261110_12056776.htm |
| S25 | 12/11/2026 | Megaspeed, rilanciata Reuters/CNA | P/J | Dichiarazione aziendale sulla cooperazione BIS | https://www.channelnewsasia.com/business/nvidia-megaspeed-cooperated-us-inspections-6545611 |
| S26 | 03/06/2026 | Commissione UE | P | Pacchetto sovranità tecnologica e strategia open source | https://digital-strategy.ec.europa.eu/en/library/communication-european-tech-sovereignty-accompanied-eu-open-source-strategy |
| S27 | 11/02/2025 | Commissione UE | P | InvestAI €200 mld **obiettivo mobilitazione** | https://digital-strategy.ec.europa.eu/en/news/eu-launches-investai-initiative-mobilise-eu200-billion-investment-artificial-intelligence |
| S28 | 23/02/2026 | Anthropic | P/attribuzione di parte | Distillazione attribuita a DeepSeek/Moonshot/MiniMax | https://www.anthropic.com/news/detecting-and-preventing-distillation-attacks |
| S29 | 10/09/2026 | Anthropic | P/attribuzione di parte | Ulteriori risultati riferiti dal laboratorio sulle distillazioni | https://www.anthropic.com/threat-intelligence-report-september-2026 |
| S30 | 08/09/2026 | Mistral | P | Round 3 mld EUR, valutazione >21 mld EUR | https://mistral.ai/news/mistral-makes-sovereign-open-weight-ai-to-frontier/ |
| S31 | 08/06/2026 | OpenAI | P | Annuncio S-1 riservato, tempistiche IPO non stabilite | https://openai.com/index/openai-submits-confidential-s-1/ |
| S32 | 10/11/2026 | Anthropic | P | Roadshow IPO proposta, prezzo indicativo, ticker ANT | https://www.anthropic.com/news/roadshow-launch |
| S33 | 10/11/2026 | SEC/Anthropic | P | Prospetto S-1/A non ancora effective | https://www.sec.gov/Archives/edgar/data/2130357/000162828026072484/anthropicpbc-sx1ax2.htm |
| S34 | 09/11/2026 | Associated Press | J | Cronologia e dichiarazioni sul caso; indagine in corso | https://apnews.com/article/68839e7ca6ba2b121529f7e475e501d6 |
| S35 | 12/11/2026 | Washington Post | J | Reporting su autorità Singapore e limiti probatori | https://www.washingtonpost.com/technology/2026/11/12/us-did-little-help-singapore-probe-alleged-chinese-spy-officials-say/ |
| S36 | 10/11/2026 | Reuters | J | IPO Anthropic: valori, investitori e rischi da prospetto | https://www.reuters.com/business/anthropic-ipo-raise-much-644-billion-latest-draft-prospectus-shows-2026-11-10/ |
| S37 | 12/11/2026 | Reuters | J | Nebius risultati trimestrali e ritardi data center | https://www.reuters.com/technology/nebius-beats-quarterly-revenue-estimates-strong-ai-demand-2026-11-12/ |
| S38 | 13/10/2026 | Nvidia | P | Supporto dichiarato a ricerca AI safety UK, 250 mln USD in compute in 5 anni | https://nvidianews.nvidia.com/news/nvidia-commits-250-million-to-advance-uk-agentic-safety-and-security-research-over-the-next-five-years |
| S39 | 19/10/2026 | Reuters | J | Memorandum Germania/Nvidia e piani di investimento | https://www.reuters.com/business/finance/germany-sees-up-46-trillion-investment-potential-by-2035-2026-10-19/ |
| S40 | 30/07/2026 | Commissione UE | P | Bando per 7 Gigafactories; finanziamenti attesi, non infrastrutture operative | https://digital-strategy.ec.europa.eu/en/news/eu-launches-ai-gigafactories-call-boost-europes-computing-capacity-and-unlock-more-eu30-billion |
| S41 | 12/11/2026 | Reuters/Boursorama | J | Effetto su quotazioni titoli semiconduttori UE nel contesto dell'incertezza Nvidia | https://www.boursorama.com/bourse/actualites/les-actions-des-semi-conducteurs-europeens-reculent-alors-que-le-conseil-d-administration-de-nvidia-se-penche-sur-l-avenir-de-huang-52defc2d03179cbe8c21a3bec4a356eb |
| S04-CORPUS | 20–21/10/2026 | Our Enemies Monitor Fonte_04 | Corpus interno | Semiconduttori, chokepoints e dipendenze; dati originari da verificare sui riferimenti originali | sources/original/Fonte_04_DeepSearch_04 - Dominio industriale, energia e dipendenze strategiche dell’Europa.md |

## 10. Criticità del corpus e condizioni per la pubblicazione

1. **Rischio di privilegiare una singola narrazione:** il caso comprende inchieste giornalistiche, risposte aziendali, negazioni cinesi e informazioni statunitensi parzialmente anonime. La qualità di alcuni resoconti non equivale a dimostrazione pubblica di spionaggio.
2. **Rischio di falsa causalità:** crisi Nvidia ≠ danno contrattuale accertato a Mistral; lobbying export ≠ controllo da Pechino; coincidenza con IPO ≠ cospirazione o manipolazione del mercato.
3. **Rischio numeri incompatibili:** volume sospetto di chip, ricavi aziendali, licenze H200, tariffa 25%, investimento Mistral e potenza dei data center misurano cose diverse.
4. **Rischio normativa futura trattata come attuale:** distinguere leggi approvate, proposte, annunci esecutivi, regole BIS applicabili e limiti al cloud remoto.
5. **Rischio link non risolti:** alcuni documenti SEC/pagine editori possono rifiutare scraping anche se gli URL pubblici e i relativi depositi sono identificabili. Il loro recupero integrale e la verifica di righe/paragraph sono parte dell'audit successivo.
6. **Nessuna elevazione di stato automatica:** una fonte tematica proposta non può segnare persone come colpevoli, promuovere E5 o applicare review.status = reviewed; i dati canonici rimangono intatti.
7. **Separazione dai task incrementali:** questo è un dossier **tematico** in sources/thematic, con ID T-AI-001, non Fonte_11 cronologica. Non avanzare con esso il cutoff del task quotidiano OSINT, né occupare numeri Fonte_XX riservati alle scansioni incrementali.
8. **Confronto con Fonte_10:** la PR #3 è una fonte incrementale OSINT con cronologia giornaliera; questo dossier approfondisce una rete e contesti 2025–2026 senza ripetere i suoi casi come eventi nuovi.

## 11. Esito

**Prodotto:** una fonte tematica italiana, strutturata per revisione e successiva ingestione M6, con **41 riferimenti esterni più Fonte_04 interna**, cronologia, scenario europeo, controevidenze, **10 ipotesi investigative separate** e **20 operazioni candidate** da risolvere contro gli ID reali. Non rappresenta un articolo già pubblicato, una sentenza o una modifica del grafo.

**Conclusione analitica non accusatoria:** il caso evidenzia la sovrapposizione tra società dominante nel calcolo AI, decisioni di sicurezza nazionale, incentivi commerciali di modelli aperti/chiusi, regolazione extraterritoriale e dipendenza europea. I nessi **commerciali e regolatori** sono documentati; i presunti nessi **di intelligence e coordinamento politico** restano da provare.