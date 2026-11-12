---
source_id: "S10"
created_at: "2026-11-12"
coverage_start: "2026-11-08"
coverage_end: "2026-11-12"
baseline_source: "S09"
repository_commit: "8d3884689434b9daa9b61af988e8b3e9ed7e9854"
language: it
status: proposed
schema_version: "1.0"
---

# Fonte_10 | Aggiornamento OSINT incrementale per l'Europa | 12 novembre 2026

**Our Enemies Monitor | Fonte incrementale proposta | Non incorporata nel database canonico**

> **Nota di metodo.** Il repository, non gli allegati di una conversazione, determina il punto di ripartenza. Il documento è una proposta archivistica immutabile dopo l'acquisizione; non è una validazione editoriale delle persone menzionate. Esistenza del procedimento, condotta materiale, autore, finanziatore, mandante, finalità e impatto sono affermazioni diverse. Presunzione di innocenza per gli indagati. Una designazione sanzionatoria non equivale a una condanna penale.

## A. Metadati e acquisizione del contesto

- **Baseline in main:** fonte S09, file Fonte_09_Aggiornamento_OSINT_Eventi_Reti_Europa_2026-11-11.md, cutoff effettivo 2026-11-11T23:00:00+01:00; controllo eseguito sul commit indicato nel frontmatter.
- **Sovrapposizione minima:** 72 ore prima del cutoff di S09, quindi dalle 23:00 CET dell'8 novembre. La data iniziale YAML indica l'intera giornata civile del primo giorno intercettato e non retrodata tutti gli eventi.
- **Orizzonte di scansione:** notizie, pubblicazioni e atti rintracciabili sino al 12 novembre 2026, con ricerca retrospettiva nei tre giorni di overlap. L'ultimo giorno è una giornata parziale, non una promessa di copertura delle ore successive alla raccolta.
- **Stato di main:** una sola fonte incrementale, Fonte_09; nessuna PR aperta risultante dalle query GitHub all'avvio; prima numerazione libera Fonte_10.
- **Record canonici già presenti:** 181 eventi, di cui 34 in pending_integration; S09 importa OEM26-001…030 come EXT-005…034; registro H01…H32; record S09 e WEB-EXT-005…054. Esistenza in data/ non significa pubblicazione o approvazione editoriale.
- **Metodologia E1–E5 di AGENTS.md / docs/ARCHITECTURE.md:** E1 documento o fatto primario; E2 attribuzione istituzionale; E3 indagine indipendente solida o reporting originale; E4 denuncia, rivendicazione o accusa ancora non corroborata; E5 ipotesi o correlazione. I livelli si applicano alle singole affermazioni, non automaticamente a un episodio intero. Lo stato accertato/contestato rimane distinto dal livello di fonte.
- **Criteri di selezione:** valore incrementale, impatto o rischio specificamente europeo, fonte primaria preferita, identificabilità del fatto e non duplicazione di S09. Le due missioni di politica estera e le valutazioni di minaccia non sono trasformate in 'attacchi'.

## B. Sintesi esecutiva

La scansione propone **7 aggiornamenti documentali**: **3 NEW_EVENT**, **1 EVENT_UPDATE** e **3 STRATEGIC_UPDATE**. Le novità riguardano un procedimento polacco per sospetti sabotaggi e attività di intelligence con possibile finalità di incitamento antiucraino, un arresto per possibile spionaggio connesso alla Russia in ambito militare NATO nel Regno Unito, l'episodio contro una nave russa nel Golfo di Finlandia, un nuovo pacchetto di misure energetiche britanniche, la posizione UE post-Abu Dhabi e la preparazione del 22º pacchetto sanzionatorio, l'allerta norvegese di sabotaggi possibili e l'osservazione internazionale delle imminenti elezioni gagauze.

Il peso probatorio è diseguale. **Polonia e Regno Unito hanno atti di arresto e addebiti/sospetti documentati, non condanne**. In Norvegia è documentata una **valutazione prospettica di minaccia**, non un attacco compiuto sul suolo norvegese. Per la nave nel Golfo di Finlandia l'osservazione dell'incidente è distinta dalla rivendicazione e dagli effetti materiali non verificati. A Dublino emergono elementi da riconciliare con il resoconto precedente sulla partecipazione dell'UE ai colloqui. La missione di osservazione gagauza non anticipa le sue conclusioni.

Il rapporto non introduce prove di un unico comando transnazionale fra questi casi e non trasferisce attribuzioni da una vicenda all'altra.

## C. Registro strutturato degli aggiornamenti

| ID locale | Tipo | Data chiave | Integrazione prevista |
| --- | --- | --- | --- |
| OEM-20261112-001 | NEW_EVENT | 2026-11-10 | Proporre nuovo evento EXT successivo al massimo occupato, con data del procedimento distinta da quella ignota degli incendi |
| OEM-20261112-002 | NEW_EVENT | 2026-11-10 | Proporre evento nuovo con stato 'sospetto/arrestato'; nessuna nuova relazione persona–Russia e nessun collegamento a RAF Fairford |
| OEM-20261112-003 | NEW_EVENT | 2026-11-11 | Proporre nuovo evento separato, collegato contestualmente a EXT-031 e H32 |
| OEM-20261112-004 | STRATEGIC_UPDATE | 2026-11-12 | Proporre aggiornamento strategico e record sulle singole designazioni solo dopo controllo del registro legale UK; evitare di duplicare le proposte UE EXT-024 |
| OEM-20261112-005 | STRATEGIC_UPDATE | 2026-11-12, 15:40 | Aggiornare il fascicolo EXT-022/EXT-032 con nuova fonte; conservare la divergenza documentale sull'effettiva forma di partecipazione |
| OEM-20261112-006 | STRATEGIC_UPDATE | 2026-11-12 | Fonte di aggiornamento di rischio e vulnerabilità; eventuale record assessment/strategic update, senza evento di sabotaggio né nuovo arco fattuale |
| OEM-20261112-007 | EVENT_UPDATE | 2026-11-12 | Aggiornamento separato del fascicolo EXT-029, con nuovo riferimento istituzionale; programmare verifica del rapporto preliminare dopo il 16 novembre, senza creare ora eventi futuri come già accaduti |

### OEM-20261112-001 | Polonia: arresti e contestazioni per incendi di veicoli, ricognizione di infrastrutture e presunti incarichi d'intelligence russi

- **ID:** OEM-20261112-001
- **Tipo di aggiornamento:** NEW_EVENT
- **Titolo:** Polonia: arresti e contestazioni per incendi di veicoli, ricognizione di infrastrutture e presunti incarichi d'intelligence russi
- **Data o intervallo dell'evento:** 2026-11-03 (arresti); 2026-11-04 (contestazione degli addebiti); periodo dei presunti incendi non precisato
- **Data della pubblicazione o della nuova evidenza:** 2026-11-10
- **Ambito geografico:** Polonia, arresti a Mińsk Mazowiecki; città dei presunti incendi non specificata nel comunicato della procura
- **Attori coinvolti:** Prokuratura Krajowa; ABW; due cittadini ucraini sospettati, non identificati nominalmente nelle fonti primarie consultate; servizi d'intelligence russi quali presunti committenti secondo la procura
- **Descrizione documentata:** La procura nazionale polacca comunica che l'ABW ha arrestato il 3 novembre due cittadini ucraini e che il 4 novembre ha contestato loro reati ai sensi dell'art. 130, paragrafi 1 e 7, del codice penale polacco. L'indagine riguarda ricognizioni di installazioni militari e infrastrutture critiche e l'incendio di veicoli sui quali, secondo gli inquirenti, erano state apposte targhe simili a quelle militari ucraine. La procura riferisce pagamenti anche in criptovalute, un presunto incarico dei servizi russi e l'intento di fomentare sentimenti antiucraini. Il giudice ha disposto custodia cautelare per tre mesi. La pubblicazione del 10 novembre costituisce nuova prova procedurale, anche se arresti e contestazioni precedono il cutoff di Fonte_09.
- **Relazioni con il patrimonio esistente e relativi ID:** Caso non presente fra i 30 aggiornamenti OEM26-001…030 di S09. Collegamento tematico, non operativo, con TL-0091 (sabotaggio ferroviario polacco del 2025), TL-0119 (tentato attacco tedesco del 2026) e la categoria di sabotaggi/proxy già trattata in S03. Non riutilizzare gli identificativi di tali eventi.
- **Valutazione probatoria delle singole affermazioni:**
  - E1: arresto il 3 novembre, formulazione degli addebiti il 4 e custodia cautelare, nei limiti di ciò che attestano gli atti e i comunicati delle autorità [R01][R02].
  - E2: la procura e l'ABW attribuiscono la presunta committenza ai servizi russi e descrivono una finalità di polarizzazione antiucraina: attribuzione dell'autorità inquirente, non accertamento dibattimentale.
  - E4: responsabilità personale per spionaggio, incendi e direzione russa ancora contestata agli indagati; nessuna condanna risulta dalle fonti consultate.
  - E5: l'eventuale riuso delle medesime reti finanziarie o di comando in altri sabotaggi europei è una pista da verificare, non una relazione accertata.
- **Eventuali attribuzioni e loro limiti:** la procura e l'ABW attribuiscono la presunta committenza ai servizi russi e descrivono una finalità di polarizzazione antiucraina: attribuzione dell'autorità inquirente, non accertamento dibattimentale. responsabilità personale per spionaggio, incendi e direzione russa ancora contestata agli indagati; nessuna condanna risulta dalle fonti consultate.
- **Fonti con URL diretti, editore e data:**
  - R01: [Zarzuty za szpiegostwo i akty dywersji na rzecz rosyjskiego wywiadu](https://www.gov.pl/web/prokuratura-krajowa/zarzuty-za-szpiegostwo-i-akty-dywersji-na-rzecz-rosyjskiego-wywiadu) | Prokuratura Krajowa (Procura nazionale polacca) | 2026-11-10.
  - R02: [ABW zatrzymała dwóch podejrzanych o szpiegostwo i dywersję na rzecz Rosji](https://www.abw.gov.pl/pl/aktualnosci/2851%2CABW-zatrzymala-dwoch-podejrzanych-o-szpiegostwo-i-dywersje-na-rzecz-Rosji.html) | ABW (Agenzia per la sicurezza interna polacca) | 2026-11-10.
- **Evidenze contrarie e incertezze:** Non sono disponibili in questa scansione atti probatori completi, sentenze definitive, identificativi di transazioni o prova pubblica di legami con altri episodi. La nazionalità dei sospettati non consente inferenze sulla collettività ucraina. La Russia nega in generale attività di sabotaggio contro Stati NATO; non è stata identificata una confutazione specifica degli atti della procura per questo caso.
- **Impatto e rilevanza per l'Europa:** Rischio di sabotaggio interno, possibile provocazione di conflitti sociali mediante falsa attribuzione a militari ucraini, vulnerabilità di infrastrutture e logistica in Stato UE/NATO.
- **Proposta di integrazione:** Proporre nuovo evento EXT successivo al massimo occupato, con data del procedimento distinta da quella ignota degli incendi. Nessun nuovo arco di comando senza valutazione editoriale e fonti probatorie specifiche.

### OEM-20261112-002 | Regno Unito: militare dell'esercito USA fermato nell'ambito di un'indagine per possibile spionaggio legato alla Russia

- **ID:** OEM-20261112-002
- **Tipo di aggiornamento:** NEW_EVENT
- **Titolo:** Regno Unito: militare dell'esercito USA fermato nell'ambito di un'indagine per possibile spionaggio legato alla Russia
- **Data o intervallo dell'evento:** 2026-11-10 (arresto); condotte oggetto d'indagine non datate pubblicamente
- **Data della pubblicazione o della nuova evidenza:** 2026-11-10 (comunicato Met Police); 2026-11-11 (ulteriore reporting)
- **Ambito geografico:** Gloucestershire, Regno Unito; contesto NATO Allied Rapid Reaction Corps presso Imjin Barracks riferito da AP
- **Attori coinvolti:** Metropolitan Police / Counter Terrorism Policing; FBI; US Army Counterintelligence Command; un militare statunitense di 41 anni non nominato; Russia quale Paese cui le accuse sono riferite, secondo la polizia
- **Descrizione documentata:** La polizia britannica comunica l'arresto il 10 novembre di un militare statunitense vicino a Gloucester, sul sospetto di reati previsti dalle sezioni 1 e 3 del National Security Act 2023, relativi rispettivamente a informazioni protette e assistenza a servizi segreti esteri. La Met precisa che il Paese a cui si riferiscono le accuse è la Russia e che sono state perquisite due località della contea; l'indagine è svolta con FBI e autorità militari USA. AP riferisce, sulla base di fonti ufficiali non nominali, il collegamento del militare a un'unità NATO a Imjin Barracks.
- **Relazioni con il patrimonio esistente e relativi ID:** Nuovo caso distinto da EXT-017/EXT-018 (RAF Fairford / presunta rete iraniana), pur essendo in un'area geografica e in un periodo vicini. Non collegare a H20 né inferire un'unica indagine: la Met dichiara esplicitamente che non è collegata alle altre sue indagini antiterrorismo. Collegamento di contesto alle istituzioni NATO e alla categoria spionaggio del corpus.
- **Valutazione probatoria delle singole affermazioni:**
  - E1: arresto, luogo approssimativo, basi legali dell'ipotesi di reato e indagine in corso, secondo comunicato Met [R03].
  - E2: il legame con la Russia è l'oggetto dell'indagine dichiarato dalla polizia, non una conclusione giudiziaria.
  - E3: assegnazione a un comando NATO, riferita da AP sulla base di funzionari; non presente come dettaglio operativo nel comunicato primario [R04].
  - E4: il tentato trasferimento o la sottrazione di segreti rimangono sospetti da accertare; nessuna incriminazione formale o condanna risultava dal comunicato consultato.
- **Eventuali attribuzioni e loro limiti:** il legame con la Russia è l'oggetto dell'indagine dichiarato dalla polizia, non una conclusione giudiziaria. il tentato trasferimento o la sottrazione di segreti rimangono sospetti da accertare; nessuna incriminazione formale o condanna risultava dal comunicato consultato.
- **Fonti con URL diretti, editore e data:**
  - R03: [Member of US army arrested as part of Counter Terrorism Policing investigation](https://news.met.police.uk/news/member-of-us-army-arrested-as-part-of-counter-terrorism-policing-investigation-514875) | Metropolitan Police / Counter Terrorism Policing | 2026-11-10.
  - R04: [US soldier assigned to NATO unit arrested in Britain on suspicion of espionage linked to Russia](https://apnews.com/article/f1a3d4abf8233d064e246e4de0ad21f4) | Associated Press | 2026-11-10.
- **Evidenze contrarie e incertezze:** La polizia non ha reso nota l'identità, non descrive materiale effettivamente consegnato a Mosca e non annuncia condanne. Le ricostruzioni giornalistiche su rango, accessi e mancata esfiltrazione devono essere attribuite alle rispettive fonti e non trattate come fatto giudiziariamente stabilito. Non pubblicare nomi non presenti nei comunicati.
- **Impatto e rilevanza per l'Europa:** Possibile vulnerabilità di insider threat in struttura militare della NATO sul territorio britannico, con rilevanza per la protezione delle pianificazioni e delle informazioni dell'Alleanza.
- **Proposta di integrazione:** Proporre evento nuovo con stato 'sospetto/arrestato'; nessuna nuova relazione persona–Russia e nessun collegamento a RAF Fairford. Rivalutare solo dopo contestazioni formali o decisioni giudiziarie.

### OEM-20261112-003 | Golfo di Finlandia: episodio cinetico contro nave militare russa, conferma finlandese e rivendicazione ucraina distinte

- **ID:** OEM-20261112-003
- **Tipo di aggiornamento:** NEW_EVENT
- **Titolo:** Golfo di Finlandia: episodio cinetico contro nave militare russa, conferma finlandese e rivendicazione ucraina distinte
- **Data o intervallo dell'evento:** 2026-11-11 (episodio riferito nella notte/mattina, orario preciso non univocamente stabilito)
- **Data della pubblicazione o della nuova evidenza:** 2026-11-11 (rivendicazione SBU riportata dalla stampa); 2026-11-12 (conferme e reporting finlandese/Reuters)
- **Ambito geografico:** Golfo di Finlandia, nell'area dell'isola russa di Gogland/Suursaari secondo Yle; posizione esatta non pubblicata dalle Forze di difesa finlandesi
- **Attori coinvolti:** Forze di difesa finlandesi; Servizio di sicurezza ucraino SBU quale rivendicante; Marina russa; autorità estoni citate da Yle
- **Descrizione documentata:** Le Forze di difesa finlandesi confermano a Reuters e a Yle di avere rilevato un colpo contro una nave militare russa nel Golfo di Finlandia l'11 novembre. Secondo Yle, l'SBU ha rivendicato un attacco con droni a una piccola nave lanciamissili russa di classe Buyan-M denominata Naro-Fominsk; il giornale riferisce anche un riscontro estone su un'esplosione. La Finlandia ha adottato restrizioni temporanee di prudenza su aree marittime e aeree, senza segnalare una minaccia militare immediata al proprio territorio. Il caso si svolge in prossimità di Stati NATO e delle rotte baltiche, ma la posizione esatta, la dinamica e i danni non sono confermati in dettaglio.
- **Relazioni con il patrimonio esistente e relativi ID:** EXT-031 (OEM26-027) già registra il raid su Ust-Luga dell'11 novembre e gli allarmi baltici; EXT-030 (OEM26-026) e H32 trattano il rischio di sconfinamenti. L'episodio della nave è un bersaglio materialmente distinto dal porto; collegarlo temporalmente all'operazione Ust-Luga senza contarli come un unico evento né come prova di transito in spazio aereo NATO.
- **Valutazione probatoria delle singole affermazioni:**
  - E1: la Finlandia ha emesso comunicazioni e misure precauzionali, come riferito da corrispondenti che riportano dichiarazioni dirette dei militari [R05][R06].
  - E3: l'osservazione di un colpo/esplosione da parte di fonti militari finlandesi ed estoni è corroborata da Yle e Reuters, ma non accompagnata qui da dati forensi pubblici.
  - E4: identità della nave, impiego di droni e rivendicazione ucraina attribuiti all'SBU nelle cronache; danni e perdite non verificati indipendentemente.
  - E5: eventuale ruolo di jamming russo in sconfinamenti di droni è questione distinta e già aperta in H32.
- **Eventuali attribuzioni e loro limiti:** identità della nave, impiego di droni e rivendicazione ucraina attribuiti all'SBU nelle cronache; danni e perdite non verificati indipendentemente.
- **Fonti con URL diretti, editore e data:**
  - R05: [Ukraine struck Russian warship near Finland](https://yle.fi/a/74-20256496) | Yle News, servizio pubblico finlandese | 2026-11-12.
  - R06: [Finland says it detects strike on Russian warship in Baltic Sea](https://www.reuters.com/world/europe/finland-says-it-detects-strike-russian-warship-baltic-sea-2026-11-12/) | Reuters | 2026-11-12.
- **Evidenze contrarie e incertezze:** Reuters afferma che le autorità finlandesi non hanno reso noti dettagli precisi su luogo, dinamica e vittime. Yle distingue informazioni SBU da verifiche proprie. Non esiste in queste fonti prova di un deliberato attacco contro Finlandia o Estonia; l'incidente non è un sabotaggio russo attribuito contro Stati UE.
- **Impatto e rilevanza per l'Europa:** Rischio concreto di propagazione del combattimento nello spazio marittimo contiguo a Finlandia ed Estonia, di misure straordinarie al traffico e di errori di attribuzione pubblica.
- **Proposta di integrazione:** Proporre nuovo evento separato, collegato contestualmente a EXT-031 e H32. Nessuna nuova relazione di responsabilità accertata fra singoli operatori e la nave fino a dati ulteriori.

### OEM-20261112-004 | Regno Unito: annunciate nuove sanzioni contro Slavneft, Vostok Oil e reti energetiche e navali russe

- **ID:** OEM-20261112-004
- **Tipo di aggiornamento:** STRATEGIC_UPDATE
- **Titolo:** Regno Unito: annunciate nuove sanzioni contro Slavneft, Vostok Oil e reti energetiche e navali russe
- **Data o intervallo dell'evento:** 2026-11-12 (annuncio governativo e nuova tranche di designazioni)
- **Data della pubblicazione o della nuova evidenza:** 2026-11-12
- **Ambito geografico:** Regno Unito / Federazione Russa / mercati internazionali di petrolio e LNG
- **Attori coinvolti:** Governo del Regno Unito; Slavneft; LLC Vostok Oil; imprese carbonifere e operatori di navi shadow fleet non tutti nominati nel comunicato
- **Descrizione documentata:** Il governo britannico presenta al vertice della Comunità politica europea di Dublino una nuova tranche di sanzioni contro produttori, infrastrutture e collegamenti commerciali del settore energetico russo. Il comunicato nomina Slavneft e il progetto Vostok Oil, oltre a imprese carbonifere e navi impiegate nel trasporto di petrolio e LNG. Downing Street dichiara che con Slavneft il Regno Unito avrebbe sottoposto a misure tutti e dieci i principali produttori petroliferi russi. La pagina FCDO delle designazioni mostra negli indici di ricerca un aggiornamento del 12 novembre, ma il rendering della pagina osservato in una delle acquisizioni era ancora fermo al 3 novembre: l'elenco nominativo e i dettagli legali delle singole designazioni vanno riscontrati contro la versione vigente del registro, senza dedurre automaticamente la data di efficacia per ciascun soggetto.
- **Relazioni con il patrimonio esistente e relativi ID:** Contesto di sanzioni UE/UK e flotta ombra, compresi TL-0004 e EXT-024. EXT-024 riguarda tuttavia 145 designazioni UE ancora da adottare e non coincide con queste misure nazionali britanniche. H31 riguarda titolarità effettiva e intermediari della flotta ombra; nessun nuovo beneficiario finale accertato.
- **Valutazione probatoria delle singole affermazioni:**
  - E1: esistenza e contenuto dell'annuncio del governo britannico, inclusa la designazione dichiarata di Slavneft e Vostok Oil [R07].
  - E1 limitato: FCDO gestisce la lista legale e gli avvisi di designazione [R08]; i dettagli individuali e le decorrenze richiedono il controllo dell'avviso del 12 novembre e della versione corrente.
  - E2: la descrizione di navi e imprese quali facilitatori dei ricavi bellici russi è una qualificazione attribuita al governo britannico, non una sentenza penale sulle singole società.
  - E5: efficacia macroeconomica e reale riduzione dei flussi non sono dimostrate dal mero annuncio.
- **Eventuali attribuzioni e loro limiti:** la descrizione di navi e imprese quali facilitatori dei ricavi bellici russi è una qualificazione attribuita al governo britannico, non una sentenza penale sulle singole società.
- **Fonti con URL diretti, editore e data:**
  - R07: [Ukraine set to be focus of EPC summit as UK sanctions Russia's top ten oil producers](https://www.gov.uk/government/news/ukraine-set-to-be-focus-of-epc-summit-as-uk-sanctions-russias-top-ten-oil-producers) | Prime Minister's Office, 10 Downing Street / GOV.UK | 2026-11-12.
  - R08: [Russia: list of designations and sanctions notices](https://www.gov.uk/guidance/russia-list-of-designations-and-sanctions-notices) | FCDO / GOV.UK, registro delle designazioni | 2026-11-12 (aggiornamento indicizzato; verifica della versione della pagina richiesta).
- **Evidenze contrarie e incertezze:** Non confondere annunci, atto di designazione, applicazione concreta ed effetti economici. Non aggiungere navi, beneficiari, quantità di petrolio o fatturati che il comunicato non documenta. Possibili licenze, deroghe e contenziosi devono essere controllati successivamente.
- **Impatto e rilevanza per l'Europa:** Potenziale restringimento dei canali di monetizzazione di petrolio, LNG e carbone russi, con possibili ricadute sui traffici, sulle assicurazioni marittime e sulle scelte sanzionatorie europee.
- **Proposta di integrazione:** Proporre aggiornamento strategico e record sulle singole designazioni solo dopo controllo del registro legale UK; evitare di duplicare le proposte UE EXT-024.

### OEM-20261112-005 | Vertice di Dublino: posizione ufficiale UE sui colloqui ucraini, finanziamento 2027 e prossimo pacchetto di sanzioni

- **ID:** OEM-20261112-005
- **Tipo di aggiornamento:** STRATEGIC_UPDATE
- **Titolo:** Vertice di Dublino: posizione ufficiale UE sui colloqui ucraini, finanziamento 2027 e prossimo pacchetto di sanzioni
- **Data o intervallo dell'evento:** 2026-11-12 (dichiarazione congiunta a Dublino); Consiglio europeo 26–27 novembre ancora futuro
- **Data della pubblicazione o della nuova evidenza:** 2026-11-12, 15:40 (Consilium)
- **Ambito geografico:** Dublino, Irlanda; Unione europea e Ucraina
- **Attori coinvolti:** António Costa; Ursula von der Leyen; Volodymyr Zelenskyy; istituzioni UE; partecipanti ai colloqui di Abu Dhabi
- **Descrizione documentata:** In una dichiarazione congiunta dopo l'incontro con Zelenskyy, i presidenti Costa e von der Leyen sostengono che l'UE fosse rappresentata ai colloqui di pace di Abu Dhabi e che resterà coinvolta in quel formato. Ribadiscono la difesa della sovranità e integrità territoriale ucraina, annunciano una discussione sulle esigenze finanziarie ucraine per il 2027 al Consiglio europeo del 26–27 novembre e dichiarano che la Commissione presenterà in parallelo il 22º pacchetto di sanzioni contro Mosca. Annunciano inoltre la mobilitazione immediata di 500 generatori rescEU e l'assistenza per ponti mobili e autobus. Reuters riferisce che alcuni contenuti delle future sanzioni, comprese misure finanziarie e cripto, sono ancora in discussione.
- **Relazioni con il patrimonio esistente e relativi ID:** EXT-022 (OEM26-018: Abu Dhabi, negoziati e scambio prigionieri ancora in fase di esecuzione), EXT-024 (OEM26-020: 145 designazioni UE proposte l'11 novembre) ed EXT-032 (OEM26-028: controversia sui fondi ucraini 2027). Questa è una successiva posizione UE, non un secondo round di colloqui ad Abu Dhabi e non un pacchetto sanzionatorio già adottato.
- **Valutazione probatoria delle singole affermazioni:**
  - E1: testo e data della posizione istituzionale dei presidenti del Consiglio europeo e della Commissione, inclusi futuri adempimenti e assistenza annunciata [R09].
  - E3: composizione possibile del 22º pacchetto secondo fonti diplomatiche Reuters, senza testo definitivo né decisione del Consiglio [R10].
  - E1 per la dichiarazione, non per l'esecuzione: l'invio materiale dei 500 generatori e dei ponti non va descritto come completato finché non esiste rendiconto logistico.
  - E5: previsioni su un cessate il fuoco, sul riconoscimento territoriale o sull'esito dei finanziamenti 2027 non sono fatti acquisiti.
- **Eventuali attribuzioni e loro limiti:** 
- **Fonti con URL diretti, editore e data:**
  - R09: [Joint statement by President Costa and President von der Leyen following their meeting with President Zelenskyy in Dublin](https://www.consilium.europa.eu/en/press/press-releases/2026/11/12/joint-statement-by-president-costa-and-president-von-der-leyen-following-their-meeting-with-president-zelenskyy-in-dublin/) | Consiglio europeo / Consilium | 2026-11-12, 15:40.
  - R10: [EU to present new Russia sanctions package, Ukraine funding measures by year-end](https://theprint.in/world/eu-to-present-new-russia-sanctions-package-ukraine-funding-measures-by-year-end/3097191/) | Reuters | 2026-11-12.
- **Evidenze contrarie e incertezze:** Il precedente EXT-022 affermava che Mosca non aveva accettato la partecipazione europea al tavolo trilaterale, mentre il comunicato UE del 12 novembre dichiara presenza europea ai negoziati. Non è possibile appianare automaticamente la differenza: potrebbero riferirsi a delegazioni, sessioni o formati differenti. Richiedere agenda, partecipanti e verbale prima di rettificare il record precedente. L'adesione diplomatica non equivale a concessioni russe sui territori.
- **Impatto e rilevanza per l'Europa:** Possibile ridefinizione del ruolo dell'UE nel quadro negoziale di sicurezza europeo; strumenti di sostegno finanziario ed energetico ancora soggetti a decisioni e attuazione.
- **Proposta di integrazione:** Aggiornare il fascicolo EXT-022/EXT-032 con nuova fonte; conservare la divergenza documentale sull'effettiva forma di partecipazione. Nessuna modifica immediata del regime sanzionatorio UE in data/ sulla sola base di questa dichiarazione.

### OEM-20261112-006 | Norvegia: PST innalza la valutazione del rischio di sabotaggi riconducibili a servizi russi

- **ID:** OEM-20261112-006
- **Tipo di aggiornamento:** STRATEGIC_UPDATE
- **Titolo:** Norvegia: PST innalza la valutazione del rischio di sabotaggi riconducibili a servizi russi
- **Data o intervallo dell'evento:** 2026-11-12 (nuova valutazione di sicurezza); orizzonte di rischio: anno successivo, non evento avvenuto
- **Data della pubblicazione o della nuova evidenza:** 2026-11-12
- **Ambito geografico:** Norvegia; sicurezza e infrastrutture dell'Europa settentrionale
- **Attori coinvolti:** Politiets sikkerhetstjeneste (PST); Inger Haugland; apparati d'intelligence russi quali soggetti della valutazione di minaccia
- **Descrizione documentata:** La sicurezza interna norvegese PST ha comunicato un aggravamento della minaccia di sabotaggio nel 2026, ritenendo ragionevole attendersi tentativi russi contro obiettivi norvegesi nel successivo anno. Le fonti individuano difesa, industria collegata, fornitori logistici ed energia come potenziali settori bersaglio. PST segnala di essere a conoscenza di ricognizioni attribuite ad attori legati all'intelligence russa; riferisce però di non aver individuato tentativi di sabotaggio contro obiettivi norvegesi. La valutazione insiste sulla necessità di evitare di interpretare ogni incidente europeo come un'azione russa.
- **Relazioni con il patrimonio esistente e relativi ID:** Integrazione strategica della campagna ibrida documentata da S03 e delle precedenti minacce verso la logistica, con richiamo tematico a TL-0119. Non creare una nuova riga di 'attacco russo in Norvegia': il nuovo fatto è l'aggiornamento del threat assessment.
- **Valutazione probatoria delle singole affermazioni:**
  - E1: esistenza e data della dichiarazione PST riportata direttamente da Reuters e NTB [R11][R12].
  - E2: attribuzione da parte dei servizi norvegesi di attività di ricognizione a soggetti legati all'intelligence russa; le prove operative specifiche non sono pubblicate in queste fonti.
  - E2/analisi prospettica: previsione del rischio di sabotaggio per l'anno successivo, non conferma di sabotaggi attuati in Norvegia.
  - E1 per la dichiarazione negativa: PST afferma di non aver rilevato tentativi di sabotaggio contro bersagli norvegesi alla data della pubblicazione.
- **Eventuali attribuzioni e loro limiti:** attribuzione da parte dei servizi norvegesi di attività di ricognizione a soggetti legati all'intelligence russa; le prove operative specifiche non sono pubblicate in queste fonti. previsione del rischio di sabotaggio per l'anno successivo, non conferma di sabotaggi attuati in Norvegia.
- **Fonti con URL diretti, editore e data:**
  - R11: [Norway security service says Russian intelligence could carry out sabotage in coming year](https://www.reuters.com/business/aerospace-defense/norway-security-service-says-russian-intelligence-could-carry-out-sabotage-2026-11-12/) | Reuters | 2026-11-12.
  - R12: [PST til NTB: Sabotasjetrusselen i Norge er skjerpet](https://www.aftenposten.no/norge/politikk/i/vkQWxp/pst-til-ntb-sabotasjetrusselen-i-norge-er-skjerpet-forventer-russisk-sabotasje-det-kommende-aaret) | NTB via Aftenposten | 2026-11-12, 13:50.
- **Evidenze contrarie e incertezze:** Il comunicato originale PST non è stato recuperato con URL stabile nella scansione; le citazioni dirette dell'agenzia sono riportate da Reuters/NTB. La previsione è probabilistica/qualitativa, priva di percentuale ufficiale. Nessun singolo soggetto o incidente va aggiunto come perpetrato in Norvegia.
- **Impatto e rilevanza per l'Europa:** Priorità di protezione per catene della difesa e dell'energia in Paese NATO europeo e fornitore energetico importante per l'UE.
- **Proposta di integrazione:** Fonte di aggiornamento di rischio e vulnerabilità; eventuale record assessment/strategic update, senza evento di sabotaggio né nuovo arco fattuale.

### OEM-20261112-007 | Gagauzia: il Consiglio d'Europa avvia osservazione internazionale delle elezioni del 15 novembre

- **ID:** OEM-20261112-007
- **Tipo di aggiornamento:** EVENT_UPDATE
- **Titolo:** Gagauzia: il Consiglio d'Europa avvia osservazione internazionale delle elezioni del 15 novembre
- **Data o intervallo dell'evento:** 2026-11-12–2026-11-16 (missione di osservazione annunciata); voto previsto 2026-11-15, non ancora svolto alla scansione
- **Data della pubblicazione o della nuova evidenza:** 2026-11-12
- **Ambito geografico:** Autonomia territoriale della Gagauzia, Repubblica di Moldavia
- **Attori coinvolti:** Congresso dei poteri locali e regionali del Consiglio d'Europa; autorità elettorali moldave e gagauze; elettori e candidati locali; SIS moldavo come autore di precedente avvertimento distinto
- **Descrizione documentata:** Il Congresso dei poteri locali e regionali del Consiglio d'Europa comunica l'invio di una delegazione di 15 membri per osservare le elezioni del Bashkan e dell'Assemblea popolare gagauza del 15 novembre. L'operazione va dal 12 al 16 novembre e prevede sette gruppi di osservazione distribuiti nei seggi, incontri con amministrazioni, partiti, candidati, società civile e diplomatici. Il comunicato prevede conclusioni preliminari nel pomeriggio del 16 novembre: la missione non ne anticipa l'esito. La notizia aggiorna la precedente allerta di intelligence del 9 novembre su presunte attività di influenza russa.
- **Relazioni con il patrimonio esistente e relativi ID:** EXT-029 (OEM26-025) già registra l'avvertimento del direttore SIS del 9 novembre, senza prove operative pubbliche. L'osservazione elettorale è un atto indipendente, non un'ulteriore prova di interferenza russa. Collegamento solo contestuale alle precedenti indagini moldave e alla categoria elezioni/FIMI.
- **Valutazione probatoria delle singole affermazioni:**
  - E1: istituzione, dimensione, date e mandato dell'osservazione elettorale nel comunicato del Consiglio d'Europa [R13].
  - E2: il SIS moldavo aveva precedentemente affermato di osservare attività di influenza russa; tale attribuzione rimane circoscritta alla fonte e non è convalidata dall'invio degli osservatori [R14].
  - E5: ipotesi di compromissione del voto del 15 novembre o risultati ancora inesistenti alla data di questa fonte non sono fatti.
  - E1 per lo stato temporale: le conclusioni della missione non risultano pubblicate prima del voto.
- **Eventuali attribuzioni e loro limiti:** il SIS moldavo aveva precedentemente affermato di osservare attività di influenza russa; tale attribuzione rimane circoscritta alla fonte e non è convalidata dall'invio degli osservatori [R14].
- **Fonti con URL diretti, editore e data:**
  - R13: [Council of Europe Congress to observe elections in the Autonomous Territorial Unit of Gagauzia (Republic of Moldova)](https://www.coe.int/de/web/congress/-/council-of-europe-congress-to-observe-elections-in-the-autonomous-territorial-unit-of-gagauzia-republic-of-moldova-) | Consiglio d'Europa, Congresso dei poteri locali e regionali | 2026-11-12.
  - R14: [SIS chief warns of increased Russian interference ahead of elections](https://radiomoldova.md/p/89312/sis-chief-warns-of-increased-russian-interference-ahead-of-elections) | Radio Moldova (servizio pubblico) | 2026-11-09.
- **Evidenze contrarie e incertezze:** Non inferire che la presenza del Consiglio d'Europa provi irregolarità o voto manipolato. Non attribuire a singoli candidati attività illecite. Evitare di precompilare il risultato elettorale o il giudizio degli osservatori.
- **Impatto e rilevanza per l'Europa:** Maggiore disponibilità futura di verifica internazionale su una consultazione regionale moldava esposta, secondo SIS, a tentativi di influenza; potenziale impatto sulla sicurezza del vicinato UE e sull'integrità democratica.
- **Proposta di integrazione:** Aggiornamento separato del fascicolo EXT-029, con nuovo riferimento istituzionale; programmare verifica del rapporto preliminare dopo il 16 novembre, senza creare ora eventi futuri come già accaduti.

## D. Nuovi collegamenti potenziali

**Relazioni direttamente documentate o formalmente attribuite, da modellare solo previa revisione dei singoli predicati:**

1. **Prokuratura Krajowa / ABW → procedimento dei due sospettati**: comunicazione processuale E1, non colpevolezza individuale; l'eventuale incarico dei servizi russi è una *attribuzione dell'accusa* E2, non un ordine provato dalla fonte pubblica [R01][R02].
2. **Met Police / FBI / US Army → indagine sull'arrestato a Gloucester**: collaborazione d'indagine E1. **Indagato → servizi russi** non è un arco dimostrato [R03][R04].
3. **Forze di difesa finlandesi → osservazione nel Golfo di Finlandia**: conferma riportata in cronache di dichiarazioni ufficiali E1/E3; **SBU → attacco rivendicato** resta indicato come *rivendicazione*, non automaticamente conferma forense di piattaforma, equipaggio o danni [R05][R06].
4. **Regno Unito → Slavneft / Vostok Oil**: comunicato sanzionatorio E1 per l'annuncio; identificazione legale delle singole designazioni da finalizzare con la lista vigente [R07][R08].
5. **Consiglio d'Europa → missione di osservazione gagauza**: incarico istituzionale E1, distinto da qualunque attribuzione elettorale russa [R13].

**Correlazioni, elementi di contesto o ipotesi che NON devono essere convertiti in archi fattuali:**

- Tecniche di sabotaggio in Polonia e altri episodi europei già repertoriati: ripetizione di tattiche non prova comando o infrastruttura finanziaria identici.
- Contemporaneità di un presunto caso di spionaggio russo a Gloucester e dell'indagine iraniana RAF Fairford: la Met dichiara assenza di legame con le altre proprie indagini.
- Raid Ust-Luga e colpo alla nave presso Gogland: contiguità geografica e temporale, ma bersagli differenti; distinguere due oggetti operativi.
- Previsione PST e successivi eventi: una previsione del 12 novembre non attribuisce retroattivamente un incidente norvegese non accertato.
- Osservazione delle elezioni in Gagauzia e precedente allerta SIS: l'invio di osservatori non è conferma di manipolazione.

## E. Ipotesi investigative e domande aperte

| Riferimento | Stato dopo la nuova evidenza | Verifica necessaria |
| --- | --- | --- |
| **H32**, EXT-030/031 | Il nuovo caso navale vicino a Finlandia ed Estonia aumenta la rilevanza dell'analisi degli sconfinamenti e dei rischi NATO, ma non prova né un'origine russa per ogni drone né un'intrusione deliberata | Tracciati radar, rotta dell'arma, detriti, coordinate ufficiali e identificazione nave |
| **H31**, EXT-024 | La tranche UK amplia la copertura istituzionale su petrolio e shadow fleet, senza aggiungere UBO verificati | Avviso FCDO 12/11, numeri identificativi navi, società proprietarie, catena assicurativa |
| **H16**, EXT-027 | Le sanzioni britanniche possono incidere sui mercati energetici, ma nessuna variazione di importazioni/ricavi è dimostrata dalla loro sola adozione | Volumi e prezzi prima/dopo, licenze, tempi di attuazione, effetti sul mercato UE |
| **Nuova domanda P10-01** | La procura polacca sostiene un obiettivo di fomentare ostilità contro gli ucraini mediante targhe contraffatte; il meccanismo di amplificazione informativa successivo non è documentato | Verbali, dati sui pagamenti, post originari, eventuale diffusione FIMI, contraddittorio processuale |
| **Nuova domanda P10-02** | Caso Gloucester: nessun esito giudiziario né trasferimento di segreti pubblicamente accertato | Eventuali future imputazioni, riscontri tecnici, comunicazioni ufficiali UK/USA, posizioni della difesa |
| **Nuova domanda P10-03** | Le fonti UE del 12/11 e i precedenti resoconti sul format di Abu Dhabi descrivono diversamente la partecipazione europea | Elenco delegati, sessioni, ruolo di osservatore vs negoziatore, dichiarazioni dei tre governi |
| **Nuova domanda P10-04** | Nessuna conclusione osservativa disponibile sul voto gagauzo del 15/11 | Rapporto del Congresso del Consiglio d'Europa dopo la missione, verbali elettorali e reclami |

Le domande P10-* sono identificatori **locali di lavoro**, non nuovi H## inseriti nel database o promossi a collegamenti del grafo.

## F. Rettifiche e aggiornamenti di stato richiesti

1. **EXT-022, negoziati di Abu Dhabi:** conservare l'affermazione originaria sul ruolo europeo, aggiungere l'affermazione UE del 12 novembre secondo cui l'Unione era presente e documentare la discrepanza. Non cancellare retroattivamente l'informazione precedente né inferire una rappresentanza europea al tavolo completo senza elenco partecipanti.
2. **EXT-024, sanzioni UE:** mantenere il carattere di *proposta/accordo politico non adottato* delle 145 designazioni. Non confonderle con le misure UK del 12 novembre.
3. **EXT-029, allerta moldava:** integrare la data del voto e la missione internazionale come fatti procedurali, senza classificare anticipatamente come manipolato il risultato elettorale.
4. **EXT-030, EXT-031 e H32:** aggiungere la conferma finlandese e la separazione dei bersagli navali/portuali. Non qualificare ogni drone del Baltico come russo o ostile a un membro NATO.
5. **Nuovi procedimenti polacco e britannico:** usare stato 'sospettato/indagato' o equivalente, con date; non chiamare nessuna delle persone condannata. Conservare gli sviluppi successivi nello storico.
6. **Norvegia:** registrare la valutazione PST, inclusa l'affermazione negativa secondo cui non sono stati individuati tentativi di sabotaggio su obiettivi norvegesi.
7. **Fonte_09, sabotaggi refrigerazione (EXT-005…008):** nessuna ritrattazione verificata nella scansione. ANSSI continua ad attribuire l'episodio francese dell'11–12 ottobre all'unità iraniana indicata, mentre la dichiarazione ENISA del 4 novembre tratta separatamente gli incidenti in altri paesi: non fondere i mandanti delle due ondate [R15][R16].

## G. Bibliografia e registro delle fonti

I riferimenti Rxx sono **locali a questa Fonte_10** e non riutilizzano i codici S09/SRC-n della fonte precedente. Data = data della pubblicazione o del documento, non necessariamente dell'evento. Gli URL sono destinazioni dirette dei documenti, non home page generiche, salvo R08 che è esplicitamente l'indice legale da ricontrollare.

- **[R01] Prokuratura Krajowa (Procura nazionale polacca)**, 2026-11-10. [Zarzuty za szpiegostwo i akty dywersji na rzecz rosyjskiego wywiadu](https://www.gov.pl/web/prokuratura-krajowa/zarzuty-za-szpiegostwo-i-akty-dywersji-na-rzecz-rosyjskiego-wywiadu). Utilizzo: OEM-20261112-001.
- **[R02] ABW (Agenzia per la sicurezza interna polacca)**, 2026-11-10. [ABW zatrzymała dwóch podejrzanych o szpiegostwo i dywersję na rzecz Rosji](https://www.abw.gov.pl/pl/aktualnosci/2851%2CABW-zatrzymala-dwoch-podejrzanych-o-szpiegostwo-i-dywersje-na-rzecz-Rosji.html). Utilizzo: OEM-20261112-001.
- **[R03] Metropolitan Police / Counter Terrorism Policing**, 2026-11-10. [Member of US army arrested as part of Counter Terrorism Policing investigation](https://news.met.police.uk/news/member-of-us-army-arrested-as-part-of-counter-terrorism-policing-investigation-514875). Utilizzo: OEM-20261112-002.
- **[R04] Associated Press**, 2026-11-10. [US soldier assigned to NATO unit arrested in Britain on suspicion of espionage linked to Russia](https://apnews.com/article/f1a3d4abf8233d064e246e4de0ad21f4). Utilizzo: OEM-20261112-002.
- **[R05] Yle News, servizio pubblico finlandese**, 2026-11-12. [Ukraine struck Russian warship near Finland](https://yle.fi/a/74-20256496). Utilizzo: OEM-20261112-003.
- **[R06] Reuters**, 2026-11-12. [Finland says it detects strike on Russian warship in Baltic Sea](https://www.reuters.com/world/europe/finland-says-it-detects-strike-russian-warship-baltic-sea-2026-11-12/). Utilizzo: OEM-20261112-003.
- **[R07] Prime Minister's Office, 10 Downing Street / GOV.UK**, 2026-11-12. [Ukraine set to be focus of EPC summit as UK sanctions Russia's top ten oil producers](https://www.gov.uk/government/news/ukraine-set-to-be-focus-of-epc-summit-as-uk-sanctions-russias-top-ten-oil-producers). Utilizzo: OEM-20261112-004.
- **[R08] FCDO / GOV.UK, registro delle designazioni**, 2026-11-12 (aggiornamento indicizzato; verifica della versione della pagina richiesta). [Russia: list of designations and sanctions notices](https://www.gov.uk/guidance/russia-list-of-designations-and-sanctions-notices). Utilizzo: OEM-20261112-004.
- **[R09] Consiglio europeo / Consilium**, 2026-11-12, 15:40. [Joint statement by President Costa and President von der Leyen following their meeting with President Zelenskyy in Dublin](https://www.consilium.europa.eu/en/press/press-releases/2026/11/12/joint-statement-by-president-costa-and-president-von-der-leyen-following-their-meeting-with-president-zelenskyy-in-dublin/). Utilizzo: OEM-20261112-005.
- **[R10] Reuters**, 2026-11-12. [EU to present new Russia sanctions package, Ukraine funding measures by year-end](https://theprint.in/world/eu-to-present-new-russia-sanctions-package-ukraine-funding-measures-by-year-end/3097191/). Utilizzo: OEM-20261112-005.
- **[R11] Reuters**, 2026-11-12. [Norway security service says Russian intelligence could carry out sabotage in coming year](https://www.reuters.com/business/aerospace-defense/norway-security-service-says-russian-intelligence-could-carry-out-sabotage-2026-11-12/). Utilizzo: OEM-20261112-006.
- **[R12] NTB via Aftenposten**, 2026-11-12, 13:50. [PST til NTB: Sabotasjetrusselen i Norge er skjerpet](https://www.aftenposten.no/norge/politikk/i/vkQWxp/pst-til-ntb-sabotasjetrusselen-i-norge-er-skjerpet-forventer-russisk-sabotasje-det-kommende-aaret). Utilizzo: OEM-20261112-006.
- **[R13] Consiglio d'Europa, Congresso dei poteri locali e regionali**, 2026-11-12. [Council of Europe Congress to observe elections in the Autonomous Territorial Unit of Gagauzia (Republic of Moldova)](https://www.coe.int/de/web/congress/-/council-of-europe-congress-to-observe-elections-in-the-autonomous-territorial-unit-of-gagauzia-republic-of-moldova-). Utilizzo: OEM-20261112-007.
- **[R14] Radio Moldova (servizio pubblico)**, 2026-11-09. [SIS chief warns of increased Russian interference ahead of elections](https://radiomoldova.md/p/89312/sis-chief-warns-of-increased-russian-interference-ahead-of-elections). Utilizzo: OEM-20261112-007.
- **[R15] ANSSI / Cyber Crisis Coordination Centre C4, Francia**, 2026-11-09. [Campagnes de déstabilisation et sabotage menées à l’encontre des intérêts français par l’Iran](https://cyber.gouv.fr/actualites/campagnes-de-d%C3%A9stabilisation-et-sabotage-men%C3%A9es-%C3%A0-lencontre-des-int%C3%A9r%C3%AAts-fran%C3%A7ais-par-la-r%C3%A9publique-islamique-diran/). Utilizzo: confronto e controllo deduplicazione / rettifiche.
- **[R16] Commissione europea / ENISA / Europol EC3**, 2026-11-04. [Joint statement on cyber incidents in refrigeration systems across the EU](https://digital-strategy.ec.europa.eu/en/news/joint-statement-cyber-incidents-refrigeration-systems-across-eu). Utilizzo: confronto e controllo deduplicazione / rettifiche.

## H. Report di acquisizione

- **Repository di riferimento:** amattis96/our-enemies-monitor, branch main, commit `8d3884689434b9daa9b61af988e8b3e9ed7e9854`. Metodologia letta da AGENTS.md, docs/ARCHITECTURE.md e .github/agent/research-prompt.md; consultati gli ID canonici di Fonte_09, le ipotesi H e lo stato delle PR.
- **Finestra retrospettiva controllata:** 8 novembre 2026, ore 23:00 CET, fino al 12 novembre 2026, nella porzione di giornata raggiunta dalla scansione. La fonte precedente resta completa fino all'11 novembre, ore 23:00; gli eventi novembrini più vecchi sono ammessi solo quando omessi dalla fonte precedente o quando emerge un nuovo documento probatorio.
- **Fonti verificate nel registro:** 16; **aggiornamenti proposti:** 7; **nuovi record in data/:** 0; **eventi materialmente conclusi o condanne penali nuove introdotte:** 0.
- **Cluster duplicati riconosciuti e non trasformati in nuovi eventi:** campagna dei sistemi di refrigerazione e attribuzione francese (EXT-005…008 e relativo contesto), doxxing e minacce a scuole italiane (EXT-009 e EXT-013), leak Rosstat (EXT-016), trattative di Abu Dhabi già registrate (EXT-022; nuovo solo il successivo posizionamento UE), proposte UE di 145 designazioni (EXT-024), allerta SIS in Gagauzia del 9 novembre (EXT-029), raid sul porto di Ust-Luga (EXT-031; nuovo e distinto il bersaglio navale). **7 cluster deduplicati**: il numero non equivale ad altrettante notizie false o rigettate integralmente.
- **Piste esaminate e non promosse:** casi di refrigerazione tedeschi comparsi in osservatori secondari senza evidenza sufficiente per separare un nuovo operatore dalla campagna esistente; notizie generiche su attacchi quotidiani Russia/Ucraina senza particolare nuova conseguenza europea verificata; insinuazioni di coordinamento Russia–Iran sulla base di sole rivendicazioni.
- **Limiti:** ricerca OSINT mirata, non censimento esaustivo; ritardi di indicizzazione e possibili aggiornamenti delle pagine istituzionali; il testo legale analitico delle nuove designazioni UK non è stato acquisito integralmente; assente URL primario stabile del nuovo comunicato PST; fonti investigative militari possono essere parziali o non pubbliche; alcune versioni temporanee delle pagine web non coincidono nei metadati di aggiornamento. I documenti non sono archiviati con hash/snapshot forense.
- **Azioni editoriali successive:** verificare avviso UK del 12 novembre; controllare gli atti giudiziari polacchi e lo stato del fermato in UK; ottenere rapporto della missione gagauza dopo il 16 novembre; verificare ruolo UE ad Abu Dhabi; validare lesioni e nave nel Golfo di Finlandia; inserire record solo con `needs_review` e rispetto dei gate di pubblicazione.
- **Stato di integrazione:** `proposed`. La sola creazione di una PR non indica che la finestra sia acquisita. Considerarla integrata solo dopo merge del nuovo documento in main e successiva, distinta, eventuale ingestione approvata nei JSON di data/. Nessuno stato di revisione o dato canonico è stato modificato in questa POC.
