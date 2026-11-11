---
title: "Fonte_09 | Aggiornamento OSINT: eventi, reti e vulnerabilità geopolitiche europee"
project: "Our Enemies Monitor"
document_type: "fonte_incrementale_verificata"
version: "1.0"
created_at: "2026-11-11"
cutoff_at: "2026-11-11T23:00:00+01:00"
baseline: "2026-10-21"
observation_period: "2026-10-22/2026-11-11"
language: "it"
status: "ricerca_aperta_con_attribuzioni_e_contestazioni"
source_ids: "SRC-01..SRC-50"
event_ids: "OEM26-001..OEM26-030"
methodology: "E1-E5; attributed_actor != verified_operator; event_date != publication_date"
---

# FONTE_09 — Aggiornamento OSINT: nuove evidenze, operazioni ibride, elezioni e pressioni strategiche sull'Europa

**Our Enemies Monitor | Rapporto incrementale v1.0 | Data di compilazione: 11 novembre 2026**  
**Periodo da aggiornare:** 22 ottobre–11 novembre 2026, con *aggiornamenti probatori* su episodi precedenti al 22 ottobre.  
**Baseline:** Fonte_00–Fonte_08, consolidamento del 21 ottobre 2026.  
**Finalità:** fornire un documento consultabile e integrabile in timeline, grafo degli attori, archivio di prove e registro delle ipotesi. Non sostituisce le fonti precedenti.

> **Avvertenza probatoria.** La presenza di un soggetto in questo documento non è un'accusa di condotta illegale o ostile. Si distingue rigorosamente tra **evento**, **autore materiale**, **rivendicazione**, **attribuzione statale**, **decisione amministrativa o giudiziaria**, **impatti accertati** e **congetture di collegamento**. La comune provenienza geografica, l'utilità politica di un attacco, una vulnerabilità tecnica condivisa o la contemporaneità non costituiscono prova di una regia comune. Le designazioni sanzionatorie non equivalgono a sentenze penali, e le incriminazioni non equivalgono a condanne.

## 0. Sintesi esecutiva

Il periodo esaminato ha prodotto **quattro novità di particolare significato investigativo**.

1. **Sabotaggio cyber della catena del freddo su scala europea:** la Francia ha attribuito formalmente l'attacco del **11–12 ottobre** a un'unità cyber dei Guardiani della Rivoluzione iraniani (*SHAHID KAVEH*); una seconda ondata su più Paesi, inclusa l'Italia, è stata segnalata fra **1 e 2 novembre** dalla Commissione europea e da ENISA. I gruppi filorussi **NoName057(16)** e **Z-Pentest** hanno rivendicato pubblicamente parte della campagna; tale rivendicazione **non annulla** l'attribuzione francese, ma non prova neppure una cooperazione Russia–Iran. Per la seconda ondata il mandante finale è ancora da chiarire. [SRC-01][SRC-02][SRC-03][SRC-04][SRC-05]
2. **Attacchi e intimidazioni contro istituzioni italiane:** diffusione di dati personali del ministro degli Esteri Antonio Tajani e di altre figure pubbliche, minacce, indagine della Procura di Roma, disservizi da attacchi contro la filiera alimentare, intrusione nella società del Tunnel del Brennero, falsi allarmi bomba su voli europei e migliaia di scuole italiane. Sono **episodi con status probatori diversi**; non emerge prova pubblica di un unico centro di comando. [SRC-06][SRC-09][SRC-10][SRC-11][SRC-12][SRC-13][SRC-14][SRC-15]
3. **Nuove evidenze sui sistemi russi e iraniani:** un presunto database sottratto a Rosstat permette nuove stime dei caduti russi, ma l'autenticità integrale e i criteri di conteggio non sono verificati in modo indipendente. In parallelo, il DOJ statunitense ha formulato accuse circostanziate contro tre persone per una rete di quasi venti attacchi e tentati attacchi in Europa e USA, compreso RAF Fairford; si tratta di **un'incriminazione**, non di condanne. [SRC-18][SRC-19][SRC-20][SRC-21][SRC-22]
4. **Riconfigurazione politica e diplomatica:** il voto del 3 novembre ha assegnato ai Democratici il controllo di Camera e Senato USA, mentre le dimensioni finali delle maggioranze restano provvisorie; nuove operazioni informative riconducibili, secondo ricercatori, all'ecosistema **Storm-1516** sono state rilevate contro candidati democratici. Sono ripresi colloqui USA–Ucraina–Russia ad Abu Dhabi senza accordo territoriale; l'UE ha concordato nuove **proposte di designazione** contro la Russia, non ancora in vigore alla data del rapporto. [SRC-26][SRC-27][SRC-28][SRC-29][SRC-30][SRC-31][SRC-35]

### Giudizi trasversali

- **Maggiore varietà di vettori:** i sistemi di refrigerazione industriali collegati da remoto, le minacce-bufala distribuite via email e gli archivi di dati personali permettono di generare costi e allarme anche senza accesso a reti militari o sistemi centrali dello Stato.
- **Più attori nello stesso dominio non significa coautoria:** per il caso dei frigoriferi occorre mantenere *separati* attribuzione francese all'Iran, autoattribuzione filorussa, indagini italiane e dichiarazioni dell'UE.
- **Nuova visibilità della catena Iran–proxy–infrastrutture occidentali:** l'incriminazione USA per RAF Fairford si collega alla questione investigativa **H20** del corpus precedente, ma l'accusa giudiziaria deve ancora superare il contraddittorio processuale.
- **Conflitti d'interesse transatlantici non scompaiono col voto USA:** il Congresso potrà esercitare controllo politico e di bilancio dal gennaio 2027, ma i poteri dell'esecutivo in diplomazia e difesa non sono automaticamente trasferiti. [SRC-49]
- **Nuove attribuzioni non devono retrodatare la conoscenza:** il sabotaggio francese è di ottobre, l'attribuzione Iran è del 9–10 novembre; l'episodio Fitburg è del dicembre 2025, la condanna finlandese è del 5 novembre 2026.

## 1. Metodo, gerarchia delle prove e perimetro

### 1.1 Cosa costituisce un aggiornamento

Ogni scheda può essere:

- **NEW_EVENT:** evento avvenuto dopo il 21 ottobre;
- **NEW_ATTRIBUTION:** nuova attribuzione per un evento già avvenuto;
- **NEW_JUDICIAL:** provvedimento giudiziario riferito a fatti antecedenti;
- **NEW_EVIDENCE:** pubblicazione di dati, denuncia, fonte tecnica o inchiesta successiva;
- **NEW_POLICY:** decisione, impegno o mutamento normativo o diplomatico;
- **ONGOING_UPDATE:** fase ulteriore di conflitto, campagna o crisi già presente nel corpus;
- **CORRECTION:** chiarimento o smentita che riduce la portata di una precedente notizia.

### 1.2 Scala E1–E5, compatibile con Fonte_00/07/08

| Codice | Significato | Esempio in questo rapporto |
|---|---|---|
| **E1** | Atto ufficiale, risultato elettorale ufficialmente proclamato o chiamato da provider affidabile *come proiezione*, sentenza o fatto tecnico direttamente documentato | Dichiarazione G7; testo della decisione del tribunale finlandese; comunicato ENISA |
| **E2** | Attribuzione ufficiale di Stato, agenzia o organismo internazionale | Francia attribuisce SHAHID KAVEH all'apparato IRGC |
| **E3** | Inchiesta originale, analisi tecnico-forense, convergenza di fonti autorevoli | Ricostruzione del leak Rosstat; esperti che riconducono video elettorali a Storm-1516 |
| **E4** | Rivendicazione/accusa interessata non verificata o negata | Video autoattribuito a NoName057(16) e Z-Pentest; rivendicazioni di sabotaggi |
| **E5** | Ipotesi investigativa o inferenza strategica, esterna al grafo fattuale | Coordinamento Iran–Russia in una campagna unica contro la refrigerazione europea |

**Due campi separati obbligatori:** `attribution_confidence` e `impact_confidence`. Un incidente può avere impatto elevato e autore ignoto; una rivendicazione altamente visibile può non essere autentica. Il dato di un'elezione non dimostra la causa dell'esito. Per i risultati politici non viene adottato alcun punteggio valutativo di partiti o candidati.

### 1.3 Attenzione a data, linguaggio e denominatori

- Data incidente ≠ data prima segnalazione ≠ data pubblicazione di una fonte ≠ data nuova attribuzione.
- **412.576** registrazioni del database Rosstat riferite da *Guardian*, **~392.700** decessi descritti da *Le Monde*, e **~450.100** stimati dai gruppi hacker non sono tre censimenti ufficiali intercambiabili. Il rapporto conserva i valori con fonte e metodo, senza scegliere arbitrariamente un unico numero.
- «Morti» ≠ «feriti» ≠ «perdite complessive» ≠ «persone disperse».
- «La Francia attribuisce» ≠ «la Procura italiana ha identificato gli stessi responsabili».
- «Approvate dai diplomatici UE» ≠ «sanzioni legalmente adottate ed entrate in vigore».
- «Gruppo russofono» o «filorusso» ≠ «operazione ordinata dalla Federazione Russa».
- «Drone confermato» ≠ «drone russo»; «aeromobile russo intercettato in spazio internazionale» ≠ «violazione dello spazio aereo nazionale».

## 2. Registro rapido degli eventi e delle nuove evidenze

Gli identificativi `OEM26-*` sono **nuovi ID proposti**, non ID `TL-*` già assegnati nella Fonte_06.

| ID | Data del nuovo elemento | Dominio | Evento / aggiornamento | Tipo | Livello del nesso principale | Fonti |
|---|---|---|---|---|---|---|
| OEM26-001 | 2026-11-09/10 | Cyber/industria | Francia attribuisce all'Iran il sabotaggio refrigerazione di >700 supermercati del 11–12 ottobre | NEW_ATTRIBUTION | E1 atto / E2 attribuzione | SRC-01,02 |
| OEM26-002 | 2026-11-01/02 | Cyber/filiera alimentare | Seconda ondata UE di attacchi a refrigerazione commerciale | NEW_EVENT | E1 incidente confermato istituzionalmente; autori non conclusivi | SRC-03,04 |
| OEM26-003 | 2026-11-02/04 | Cyber/Italia | Compromissioni e anomalie in punti vendita siciliani, Toscana ed Emilia-Romagna | NEW_EVENT | E1/E3 incidente; attribuzione aperta | SRC-05,06,07 |
| OEM26-004 | 2026-11-04 | Cyber/informazione | NoName057(16) e Z-Pentest rivendicano attacchi alla catena del freddo | NEW_EVIDENCE | E4 rivendicazione | SRC-08 |
| OEM26-005 | 2026-11-07/11 | Minacce/doxxing | Dati personali Tajani, Lo Voi, Gabrielli e altri; indagini e nuove intimidazioni | NEW_EVENT | E1 esistenza divulgazione; nesso autore E3/E4 | SRC-09,10,11 |
| OEM26-006 | 2026-11-07 | Cyber/logistica | BBT SE rende nota l'intrusione subita il 17 ottobre nel progetto Tunnel del Brennero | NEW_EVIDENCE | E1 conferma aziendale; autore E4 | SRC-12,13 |
| OEM26-007 | 2026-11-03/07 | Cyber/consumatori | Smartbox comunica accesso non autorizzato alla piattaforma | NEW_EVENT | E1 dichiarazione aziendale | SRC-13 |
| OEM26-008 | 2026-11-05/06 | Minacce/aviazione | Falsi allarmi bomba contro numerosi voli europei | NEW_EVENT | E1 disservizi; responsabili ignoti | SRC-14 |
| OEM26-009 | 2026-11-11 | Minacce/scuola | Email con falsi allarmi bomba a oltre 6.300 scuole italiane; allerta in altri paesi | NEW_EVENT | E1 invii/controlli; mandante ignoto | SRC-15 |
| OEM26-010 | 2026-11-09 | Cyber/Italia | Piantedosi ridimensiona presunto attacco alla Direzione Investigativa Antimafia | CORRECTION | E1 dichiarazione ministeriale | SRC-16 |
| OEM26-011 | 2026-11-11 | Cyber/OT | NoName057(16) rivendica attacco a impianti termici italiani; effetti limitati secondo ACN | NEW_EVIDENCE | E4 rivendicazione, verifica parziale | SRC-17 |
| OEM26-012 | 2026-10-29/11-09 | Intelligence/data leak | Presunto leak Rosstat e stime di morti russe in guerra | NEW_EVIDENCE | E3 raccolta giornalistica; integrità non indipendentemente verificata | SRC-18,19,20 |
| OEM26-013 | 2026-11-10 | Intelligence/proxy | DOJ incrimina 3 sospetti per rete HAYI/RAF Fairford | NEW_JUDICIAL | E1 esistenza imputazione / E4 responsabilità asserita | SRC-21,22 |
| OEM26-014 | 2026-10-27 | Intelligence/UK | CPS incrimina 2 uomini per episodio RAF Fairford del 27 settembre | NEW_JUDICIAL | E1 procedimento / E4 ipotesi accusatoria | SRC-23 |
| OEM26-015 | 2026-11-05 | Infrastrutture subacquee | Tribunale Helsinki condanna capitano e nostromo Fitburg per cavi del 31 dicembre 2025 | NEW_JUDICIAL | E1 sentenza di primo grado; ordine statale non provato | SRC-24,25 |
| OEM26-016 | 2026-11-03/10 | Politica USA | Mid-term: Democratici conquistano maggioranza in Camera e Senato, conteggi ancora aperti | NEW_EVENT | E1 voto / E3 proiezione AP | SRC-26,27,28 |
| OEM26-017 | 2026-10-27/30 | FIMI/USA | Video e false accuse elettorali riconducibili secondo esperti a Storm-1516 | NEW_EVIDENCE | E3 tecnica/ricercatori; impatto elettorale non provato | SRC-29,30 |
| OEM26-018 | 2026-11-02/11 | Ucraina/diplomazia | Ripresa colloqui USA-Russia-Ucraina ad Abu Dhabi, scambi prigionieri e nodi territoriali | ONGOING_UPDATE | E1 incontri / E3 reporting negoziale | SRC-31,32,33 |
| OEM26-019 | 2026-11-05 | USA/diplomazia | Incontro Trump–Kirill Dmitriev; delegazione ucraina ricevuta separatamente da altri funzionari | NEW_EVENT | E3 reporting | SRC-34 |
| OEM26-020 | 2026-11-11 | UE/sanzioni | Ambasciatori UE concordano 145 nuove designazioni anti-russe, non ancora adottate | NEW_POLICY | E3 accordo diplomatico; non ancora E1 regime vigente | SRC-35 |
| OEM26-021 | 2026-11-09/11 | G7/multilateralismo | Dichiarazione G7 su Ucraina, flotta ombra, Cina, Iran, cyber e infrastrutture satellitari | NEW_POLICY | E1 dichiarazione | SRC-36 |
| OEM26-022 | 2026-11-09 | Industria/Cina | Proroga cinese al 10 gennaio 2027 della sospensione di alcuni export control su terre rare | NEW_POLICY | E1 dichiarazione cinese riferita da Reuters | SRC-37 |
| OEM26-023 | 2026-11-09/11 | Iran/Hormuz | Blocco navale, attacchi a naviglio e persistenza della crisi energetica | ONGOING_UPDATE | E3 reporting/IMO | SRC-38,39 |
| OEM26-024 | 2026-11-09 | Sicurezza nucleare | Conferenza donatori per riparazione del New Safe Confinement di Chornobyl: €303 mln promessi | NEW_POLICY | E1 comunicazione EBRD | SRC-40 |
| OEM26-025 | 2026-11-02/09 | Moldova/elezioni | Direttore SIS allerta su nuove attività di influenza russa in Gagauzia | NEW_EVIDENCE | E2 dichiarazione di intelligence | SRC-41 |
| OEM26-026 | 2026-10-28/11-10 | NATO/Baltico | Intercettazioni di velivoli russi, segnalazioni droni e chiusure aeroportuali | ONGOING_UPDATE | E1 attività NATO; autore droni da verificare | SRC-42,43 |
| OEM26-027 | 2026-11-11 | Ucraina/Baltico | Raid ucraino contro porto russo di Ust-Luga; allerta droni su Paesi baltici | NEW_EVENT | E1 rapporti ufficiali / E3 Reuters; attribuzioni specifiche | SRC-44 |
| OEM26-028 | 2026-11-09/11 | UE/Ucraina | Disputa sul finanziamento UE 2027 e sulla ripartizione del costo tra Stati membri | NEW_POLICY | E3 diplomazia/inchiesta | SRC-45 |
| OEM26-029 | 2026-10-22/11-11 | OSINT/metodo | EBU pubblica mappa di incidenti ibridi collegati alla Russia in 17 Stati | NEW_EVIDENCE | E3 dataset giornalistico con attribuzioni graduate | SRC-46 |
| OEM26-030 | 2026-11-11 | Crisi diplomatica | Iran contesta attribuzione francese; Parigi convoca ambasciatore e propone sanzioni UE | NEW_POLICY | E1 atto diplomatico / E2 attribuzione contestata | SRC-02,47 |

*Nota di qualità:* la tabella comprende, per scelta, eventi nuovi, atti di verifica retrospettiva e reazioni politiche. **Non rappresenta 30 attacchi indipendenti**. Diverse righe descrivono fasi successive dello stesso caso. Le date di notizie diffuse prima del cutoff della baseline sono incluse solo quando la prova, la sentenza, l'atto o l'attribuzione sono nuovi.

## 3. Dossier approfonditi: cyberattacchi, minacce e infrastrutture europee

### OEM26-001/002/003/004/030 — La filiera del freddo: dalla Francia all'Europa

**Linea temporale.** Nella notte **11–12 ottobre 2026** controllori di refrigerazione commerciale vengono compromessi su **oltre 700 siti francesi**; le apparecchiature entrano in cicli di sbrinamento o in condizioni termiche anomale con deterioramento di prodotti, danni e, secondo il ministero francese, anche principi di incendio. Una **seconda ondata 1–2 novembre** interessa apparecchiature analoghe in vari Stati membri. Il **4 novembre** Commissione, ENISA, Europol/EC3, rete CSIRT e EU-CyCLONe diffondono una dichiarazione congiunta. Il **9 novembre** Parigi rende pubblica l'attribuzione all'Iran, con comunicato francese in inglese del **10 novembre**; il governo convoca l'ambasciatore iraniano e ipotizza sanzioni UE. [SRC-01][SRC-02][SRC-03][SRC-47]

**Attori, infrastrutture, tecnica.** Il ministero francese indica **SHAHID KAVEH**, unità cyber offensiva affiliata all'organizzazione Electronic Warfare and Cyber Defence dell'**IRGC**. La superficie d'attacco è costituita da controllori industriali e sistemi di teleassistenza della refrigerazione; i marchi **Danfoss** e **Dixell** compaiono nelle cronache e nell'indagine francese. Il DG ACN Andrea Quacivi ha attribuito la maggiore esposizione di alcune installazioni a software obsoleti o non più aggiornabili e gestione da remoto. Questi fattori sono vulnerabilità tecniche, **non** prova che una singola CVE o una stessa credenziale sia stata usata ovunque. [SRC-01][SRC-05][SRC-07]

**Italia.** ANSA e le dichiarazioni degli operatori riferiscono compromissioni dei sistemi in **almeno quattro punti vendita Coop gestiti da Radenza in Sicilia** (tre a Catania e uno a Palermo) e indagini ACN riguardanti una società toscana di ristorazione collettiva e una società emiliana dei surgelati; ulteriori accertamenti locali riguardano SIAF e Valpizza. Nel caso SIAF, Rai Toscana ha riportato **sei celle interessate** e perdite di materie prime stimate in circa **500 euro**: cifra locale che **non rappresenta** i danni complessivi italiani. L'ACN aveva già richiesto controlli urgenti su esposizione Internet, segregazione OT/IT, accessi remoti, MFA e dispositivi senza supporto. [SRC-04][SRC-05][SRC-06][SRC-07]

**La contraddizione apparente delle attribuzioni è il dato investigativo più interessante.** Un video pubblicato sui social e riportato dal Tg1/ANSA attribuisce la campagna ai collettivi dichiaratamente filorussi **NoName057(16)** e **Z-Pentest**. Tajani ha dichiarato il **9 novembre** che per gli attacchi italiani vi sono rivendicazioni filorusse ma **non prove di responsabilità del governo russo**. Parigi, per il caso francese di ottobre, attribuisce invece la condotta all'IRGC. **Non è dimostrato** se le ondate siano state eseguite dallo stesso operatore, da operatori differenti, tramite rivendicazioni opportunistiche o in collaborazione. La somiglianza della superficie tecnica non risolve la questione. Iran respinge l'accusa francese. [SRC-01][SRC-08][SRC-47][SRC-48]

**Impatto:** in Francia *decine di milioni di euro* di derrate perdute/danni secondo il ministero francese; nel resto d'Europa eventi e perdite eterogenei, privi di totale pubblico consolidato. **Rilevanza per la rete:** OT/ICS civile, economia alimentare, rischio cyber-fisico, possibile propaganda di attribuzione, soggetti statali e hacktivisti. **Stato:** fatto E1; attribuzione francese E2; rivendicazione E4; unitarietà e coordinamento transnazionale E5. **Da acquisire:** bollettini ACN/CERT, indicatori e log campione, tracciati d'accesso remoto, provvedimenti della Procura francese, eventuali attribuzioni congiunte ENISA/Europol.

### OEM26-005 — Doxxing, minacce e pressione su figure istituzionali italiane

Il **7 novembre** la Farnesina ha comunicato il rinvenimento sul dark web di **dati personali** del ministro **Antonio Tajani**. Ha riferito minacce anche contro **Francesco Lo Voi** (procuratore di Roma), **Ivano Gabrielli** (direttore della Polizia postale) e **Paolo Tassan-Zanin** (sindaco). ANSA ha riportato l'apertura di un fascicolo presso la Procura di Roma il **9 novembre**; il segmento relativo al procuratore Lo Voi è destinato alla competenza di Perugia. Gli investigatori valutano fattispecie di accesso abusivo e minacce, ma l'iter è aperto. [SRC-09][SRC-10]

La stampa collega le pubblicazioni a **NoName057(16)**, gruppo che aveva già preso di mira siti italiani ed era stato citato in precedenti episodi del corpus. L'11 novembre Tajani ha dichiarato in Parlamento ulteriori intimidazioni rivolte anche ai familiari minorenni e la pubblicazione di una «taglia» per ulteriori informazioni. **Non è pubblicamente accertato** quali dati siano stati ottenuti mediante intrusione, scraping, data broker o fonti già divulgate. L'identità online del gruppo e le sue dichiarazioni non bastano per attribuire la direzione operativa al GRU o ad altre agenzie statali. [SRC-09][SRC-10][SRC-11]

**Da non fare nell'app:** non ripubblicare dati personali, indirizzi, recapiti, minacce testuali né URL del dark web. Conservare soltanto riferimento istituzionale, persona bersaglio, data, categoria e fonte. **Classificazione:** diffusione E1, autore secondo cronache E3, nesso a governo russo non verificato.

### OEM26-006/007 — Tunnel del Brennero e attacco Smartbox: rischi diversi

La società **BBT SE**, responsabile del Tunnel di base del Brennero, ha confermato il **7 novembre** un accesso informatico non autorizzato a dati aziendali. L'incidente risale secondo ANSA al **17 ottobre**, antecedente al cutoff delle precedenti Fonti ma reso noto in seguito. BBT SE ha isolato i sistemi e avviato accertamenti forensi; la società ha dichiarato **nessun impatto sulla prosecuzione della costruzione**. Le prime piste investigative riportate da quotidiani menzionano **Everest**, ecosistema russofono di estorsione/ransomware già associato al settore. Non è provato un ordine dello Stato russo, né è pubblicamente descritta la reale sensibilità di tutti i dati sottratti. [SRC-12][SRC-13]

Nello stesso periodo **Smartbox** ha comunicato un accesso abusivo a una piattaforma con possibile consultazione di **nomi ed email** di clienti; secondo la società, non risultavano accessibili password o dati delle carte. Non emerge evidenza pubblica di un collegamento tecnico fra Smartbox, BBT, minacce personali e refrigerazione. **Rilevanza per il monitor:** gli oggetti bersaglio hanno importanza infrastrutturale molto diversa; includere Smartbox come contesto sulle intrusioni, non come conferma di una campagna statale unitaria. [SRC-13]

### OEM26-008/009 — False minacce aeree e scolastiche come possibile strumento di interruzione

Il **5 novembre** numerosi voli commerciali in Europa hanno ricevuto **falsi allarmi bomba**: sono stati registrati interventi di caccia, atterraggi di precauzione, dirottamenti, controlli e ritardi, senza riscontro di esplosivi secondo la copertura AP. AP riporta oltre una dozzina di voli coinvolti quel giovedì e segnalazioni analoghe nei giorni precedenti. I mittenti e i nessi fra i casi **non sono stati stabiliti**. Alcuni messaggi hanno invocato nomi di gruppi o slogan diversi, non verificati come reali responsabilità operative. [SRC-14]

L'**11 novembre** un'ondata di email di minaccia ha raggiunto **più di 6.300 scuole italiane** secondo il Ministero dell'Istruzione citato da AP; parte degli istituti ha effettuato verifiche o evacuazioni, **senza ordigni o feriti**. Messaggi analoghi sono stati ricevuti in Irlanda e in parti del Regno Unito. Una stessa firma riportata in alcuni messaggi compare in precedenti intimidazioni a emittenti europee, ma non identifica il responsabile reale. La presidente Giorgia Meloni ha convocato un vertice interministeriale con intelligence e ACN; l'ipotesi di una regia statale è **non dimostrata**. [SRC-15]

**Distinzione fondamentale:** un allarme fasullo genera conseguenze reali (evacuazioni, costi, sospensione di servizi) ma **non prova che un ordigno esistesse**. Un'analisi OSINT dovrebbe collegare i messaggi in base a header, server, template e infrastruttura documentati, non soltanto per cronologia o contenuto. Non pubblicare dettagli che facilitino imitazioni operative.

### OEM26-010/011 — Smentite e rivendicazioni non confermate

Il **9 novembre** il ministro dell'Interno ha precisato che, per il presunto attacco alla **Direzione Investigativa Antimafia**, **non risultavano compromessi i sistemi né sottratti dati riservati** dopo le verifiche allora disponibili. La mera circolazione di materiale asseritamente DIA sul dark web non costituisce prova di compromissione. Registrare come **CORRECTION**, non come attacco accertato. [SRC-16]

L'**11 novembre** NoName057(16) ha rivendicato nuovi accessi a sistemi di riscaldamento/impianti industriali italiani. Secondo la ricostruzione giornalistica, l'ACN ha ritenuto verosimile l'interessamento di un sistema di dimensioni modeste. Identità del bersaglio, impatto e autenticità delle dimostrazioni restano da verificare. Non presentare la rivendicazione come sabotaggio critico riuscito. [SRC-17]

### OEM26-015 — Sentenza Fitburg sui cavi baltici: il dolo individuale non è comando statale

Il **5 novembre 2026** il Tribunale distrettuale di Helsinki ha condannato in **primo grado** per sabotaggio aggravato il capitano russo **Andrei Maksimenko** e il nostromo azero **Vusal Majidov** della nave mercantile **Fitburg**. Le pene sono state rispettivamente di **3 anni e 6 mesi** e **2 anni e 10 mesi**, relative al trascinamento dell'ancora lungo circa **130 km** sul fondale del Golfo di Finlandia, con danni a due cavi di telecomunicazioni il **31 dicembre 2025**. I condannati negano le accuse e la decisione può essere impugnata. [SRC-24][SRC-25]

**Elemento accertato dalla sentenza:** secondo il tribunale, i due non potevano ignorare il trascinamento dell'ancora. **Elemento non accertato:** non emerge un ordine del governo russo, del GRU o di Pechino. La bandiera della nave, la provenienza dal porto russo o la nazionalità degli imputati non costituiscono da sole un arco `GESTITO_DA` statale. Integrare nel filone sulle infrastrutture subacquee, distinguendo Fitburg da Eagle S, Yi Peng 3 e NewNew Polar Bear.


## 4. Dossier approfonditi: Russia, Ucraina, intelligence, elezioni

### OEM26-012 — Leak Rosstat: cosa dicono davvero i numeri dei militari russi morti

**Evento di acquisizione:** i collettivi hacker **Cyber Partisans** (opposizione bielorussa) e **Silent Crow** (filo-ucraino) dichiarano di aver sottratto dati al servizio statistico federale russo **Rosstat** nell'ambito di un incidente fra **29 ottobre e 1 novembre 2026**. I gruppi parlano di circa **23 TB** di materiale e di registrazioni anagrafiche relative ai decessi dalla guerra. Rosstat ha **riconosciuto di aver subìto attacchi informatici**, ma ha negato che fossero stati compromessi database sensibili o sottratte informazioni riservate. Queste sono **posizioni contrapposte** e non una conferma istituzionale del contenuto del leak. [SRC-18][SRC-20]

**Nuova evidenza giornalistica:** il **9 novembre** *The Guardian* ha riferito l'esistenza di un corpus con **oltre 11 milioni di certificati di morte**, dal quale risultano **412.576 decessi esplicitamente collegati alla guerra** nel periodo analizzato. Ha indicato una probabile sottostima per ritardi, dispersi, persone non identificate e incompletezza. *Le Monde* del **10 novembre**, riferendosi all'analisi dello stesso insieme di materiali, ha riportato circa **392.700 certificati**; le ricostruzioni attribuite ai gruppi hacker parlano inoltre di circa **450.100** morti fino al **28 agosto 2026**. Le discrepanze devono essere conservate come *versioni e universi statistici distinti*, non armonizzate senza accesso ai dati e ai filtri. [SRC-18][SRC-19][SRC-20]

**Interpretazione consentita:** se il dataset è autentico e i criteri di inclusione sono coerenti, indicherebbe una mortalità russa di guerra molto alta e una distribuzione territorialmente diseguale, con impatto sproporzionato su regioni economicamente più fragili. La quantità include un insieme identificato da diciture e codifiche amministrative, non una misura diretta e infallibile di tutti i caduti in combattimento. La guerra è in corso e il dato **non equivale al totale delle perdite militari**. Le stime dei gruppi hacker non sono un conteggio ufficiale Rosstat e il file completo non è stato reso accessibile in modo tale da consentire una replica indipendente pubblica da parte di chi compila questa fonte.

**Collegamenti alla rete:** `Rosstat` (istituzione bersaglio), `Cyber Partisans` e `Silent Crow` (attori rivendicanti), `The Guardian` e `Le Monde` (verifiche giornalistiche), `Mediazona/BBC Russia` (controllo indipendente dei nominativi, non prova derivata da questo leak), `Stato russo` (conflitto in corso). **Nessun arco finanziario o di subordinazione fra hacker e governi** è inferibile dalla semplice finalità filo-ucraina. **Stato:** violazione denunciata E3/E4; attacco ammesso Rosstat E1 per l'ammissione; dati di morte E3, non certificati integralmente da terzi. **Verifiche necessarie:** schema Rosstat, dizionario cause di morte, periodizzazione, record duplicati, identità fra certificati e persone, lag registrazione e confronto Mediazona/BBC.

### OEM26-013/014 — RAF Fairford, HAYI, Kata'ib Hizballah e presunta rete operativa iraniana

**Contesto:** il **27 settembre 2026** le autorità britanniche avevano intercettato una situazione sospetta presso la base aerea **RAF Fairford**, che ospitava anche velivoli e personale USA. Londra aveva già attribuito il coinvolgimento nell'episodio all'Iran in una dichiarazione internazionale del 12 ottobre (precedente alla baseline). La **Crown Prosecution Service** ha annunciato il **27 ottobre** imputazioni a carico di **due uomini** ai sensi del *National Security Act* britannico. L'annuncio dell'incriminazione non prova la colpevolezza né la loro collocazione in una catena statale. [SRC-23][SRC-50]

**Sviluppo del 10 novembre:** il **Department of Justice statunitense** ha pubblicato un atto d'accusa integrativo contro **Mohammad Baqer Saad Dawood al-Saadi**, **Mohsen Mohajeri** e **Mohammad Ali al-Hassani**. Secondo i procuratori, i tre avrebbero partecipato a una rete che supportava **IRGC** e **Kata'ib Hizballah**, con legami operativi con attacchi rivendicati da **Harakat Ashab al-Yamin al-Islamiya (HAYI)**. Il DOJ parla di circa **18 attacchi in Europa nella primavera 2026**, oltre al presunto complotto per RAF Fairford, con **incendi, esplosivi e violenza contro persone** in più Paesi. Una parte dei piani, secondo gli atti, sarebbe stata coordinata tramite messaggi codificati inviati da al-Saadi mentre era già detenuto negli USA. [SRC-21][SRC-22]

**Distinzione giuridica e di attribuzione:** l'esistenza del *superseding indictment* USA è **E1**; le accuse specifiche sono **contestazioni giudiziarie** e non fatti stabiliti da sentenza. Le persone interessate conservano presunzione d'innocenza, e Teheran nega il coinvolgimento. L'asserita copertura **HAYI → rete pro-Iran/IRGC e Kata'ib Hizballah** è un nesso accusatorio del DOJ, più specifico della precedente ipotesi **H20** ma non ancora definitivamente accertato. Le imputazioni britanniche sono un procedimento autonomo e non vanno fuse con quelle americane come se riguardassero necessariamente i medesimi esecutori materiali. [SRC-21][SRC-22][SRC-23]

**Impatto investigativo:** il caso fornisce un modello osservabile di apparenti *proxy*, finanziamenti o facilitatori locali, canali di propaganda post-attacco, attraversamento di confini e pressione contro strutture militari occidentali. Tuttavia **non collega** automaticamente HAYI a SHAHID KAVEH, né alla campagna sui refrigeratori. **Collegamento al corpus:** H19 (Iran/Foxtrot; solo per confronto metodologico), H20 (nuove prove accusatorie sul medesimo teatro RAF Fairford). **Da acquisire:** testo completo dell'imputazione USA, successive decisioni giudiziarie, atti britannici pubblici e identità dei casi effettivamente inclusi nei «quasi venti» episodi.

### OEM26-016 — Mid-term USA del 3 novembre 2026: il fatto elettorale e l'impatto europeo

**Risultato:** il **3 novembre 2026** si sono svolte le elezioni di metà mandato per il Congresso statunitense. **Associated Press** ha chiamato il controllo democratico del **Senato** la notte del 3 novembre e della **Camera** all'inizio del **4 novembre**. Al **10–11 novembre** rimangono collegi e contestazioni non risolti, quindi non si deve scrivere un numero definitivo di seggi. *Roll Call* ha registrato, al 10 novembre, **44 seggi alla Camera e 7 al Senato passati da repubblicani a democratici**, dato riferito ai collegi allora assegnati. Le proiezioni AP di maggioranza democratica non significano che il nuovo Congresso si sia già insediato: le nuove camere entreranno in carica nel **gennaio 2027**. [SRC-26][SRC-27][SRC-28]

**Fattori documentati nel dibattito pubblico:** il costo della vita, l'inflazione e la guerra USA–Iran hanno avuto particolare rilievo nell'elettorato e nei sondaggi/exit poll; nessun singolo fattore può essere trattato come causa unica del voto. La variazione dell'equilibrio istituzionale può modificare in futuro il controllo del bilancio, le indagini parlamentari e l'iter delle misure legislative riguardanti Russia, Ucraina, NATO, Israele e Iran. Tuttavia il presidente conserva poteri estesi in politica estera, sanzioni e uso delle forze armate; non è corretto inferire un ritorno automatico al precedente orientamento transatlantico. [SRC-26][SRC-49]

**Per Our Enemies Monitor:** questo è un **evento politico sistemico**, non un «attacco». Le conseguenze che meritano monitoraggio sono: sostegno finanziario/militare USA a Kiev, margini di deroga a sanzioni contro Mosca, accesso a capacità satellitari, decisioni sull'Iran e rapporti commerciali USA–UE. Gli archi `ELEZIONE_DI`, `CONTROLLA_CAMERA`, `DIPENDE_DA_LEGISLAZIONE` restano separati da presunti legami clandestini. Ogni modifica istituzionale successiva al gennaio 2027 è una **possibilità**, non già avvenuta.

### OEM26-017 — Interferenze informative nelle mid-term: Storm-1516 e falsi video

Negli ultimi giorni di ottobre **Associated Press** e **PolitiFact**, citando esperti di comunicazione forense e reti di disinformazione, hanno documentato false accuse diffuse attraverso video e post contro i candidati democratici al Senato **Sherrod Brown** (Ohio), **James Talarico** (Texas) e **Troy Jackson** (Maine). Le tecniche includono contenuti apparentemente giornalistici, uso improprio di immagini di persone reali, elementi manipolati o generati con AI e diffusione su social. Gli esperti hanno riscontrato *indicatori e continuità di infrastruttura* compatibili con la campagna russa **Storm-1516**. [SRC-29][SRC-30]

**Limiti:** questa è un'attribuzione di **ricercatori E3**, non una nuova sentenza o la prova pubblica di un ordine specifico del Cremlino per ciascun video. La falsità delle accuse è indipendente dall'identità dell'autore; alcuni contenuti hanno ottenuto visualizzazioni elevate ma **non esiste misurazione affidabile della variazione del voto causata dalla campagna**. I bersagli nominati in questa sezione non devono essere rappresentati nel grafo come colpevoli delle condotte loro falsamente attribuite. Si registra `BERSAGLIO_DI_FIMI`, non `RESPONSABILE_DI`.

**Intersezione con Fonte_02/07:** Storm-1516 già presente; nuovo scenario elettorale USA 2026 e nuove varianti di false testimonianze. La ricorrenza del modus operandi indica capacità di riutilizzo, **non** che i risultati elettorali siano stati alterati in modo dimostrabile. **Da acquisire:** archivi delle smentite, account e domini verificati, eventuali comunicati delle piattaforme, analisi per campione delle visualizzazioni autentiche.

### OEM26-018/019 — Abu Dhabi: colloqui USA–Russia–Ucraina e ruolo europeo

Gli USA hanno annunciato il **2 novembre** l'intenzione di riunire rappresentanti ucraini e russi ad **Abu Dhabi** il **10–11 novembre**, i primi colloqui diretti mediati da Washington da febbraio. Gli emissari statunitensi **Steve Witkoff** e **Jared Kushner** hanno avviato colloqui su sicurezza del dopoguerra, misure umanitarie, cessate il fuoco e territori. L'**11 novembre** Reuters riferisce progressi limitati e un'intesa per un **importante scambio di prigionieri**, ma nessuna svolta sulle divergenze territoriali; in particolare Mosca continua a chiedere la cessione dell'intero Donbas, mentre Kiev respinge una soluzione che legittimi la conquista. [SRC-31][SRC-32][SRC-33]

**Ruolo dell'UE:** Germania, Francia, Regno Unito, Italia, UE e NATO hanno svolto contatti paralleli e ricevuto aggiornamenti, ma **la Russia non ha accettato la loro partecipazione diretta al tavolo trilaterale**. I ministri del G7, nel comunicato dell'11 novembre, hanno precisato che negoziati sulla **sicurezza futura dell'Europa devono includere gli europei**. Qualsiasi proposta di nuovo accordo di sicurezza Russia–Europa è al momento materia negoziale, non un trattato concluso. [SRC-31][SRC-33][SRC-36]

Il **5 novembre** AP ha riferito di un incontro alla Casa Bianca fra **Donald Trump e l'inviato russo Kirill Dmitriev**, in parallelo a consultazioni con altri rappresentanti ucraini e occidentali. È un contatto diplomatico pubblico/riportato, non prova di coordinamento clandestino. [SRC-34]

**Monitorare separatamente:** tavoli trilaterali, colloqui di rappresentanti europei, accordi umanitari effettivamente eseguiti, eventuale cessate il fuoco, concessioni territoriali, riduzioni o ampliamenti di sanzioni, e ripercussioni sulla NATO. **Il solo fatto di negoziare non equivale ad accettazione delle richieste russe.**

### OEM26-020 — 11 novembre: nuovi 145 nomi nella pipeline delle sanzioni UE

Secondo Reuters, l'**11 novembre** gli ambasciatori degli Stati UE hanno raggiunto un **accordo politico** su **145 nuove designazioni** riguardanti soggetti collegati al sistema bancario russo, reti della flotta ombra e campagne di manipolazione informativa. La ricostruzione distingue **113 designazioni** nel regime principale relativo all'Ucraina, **31** nel regime sulle attività ibride e **una** nel regime cyber. Fra i gruppi interessati risultano circa **50 banche russe**; una delle designazioni ibride sarebbe collegata al tentato attacco presso Leipzig/Halle precedentemente attribuito alla Russia dalla Germania. [SRC-35]

**Stato normativo al cutoff:** il Consiglio deve ancora adottare formalmente le misure, indicate per la riunione prevista **lunedì 16 novembre**; solo la pubblicazione negli atti UE potrà attestarne la piena entrata in vigore e il perimetro finale. Registrare come `PROPOSTA_CONCORDATA` e **non** aggiungere già 145 soggetti alle relazioni di sanzione accertata del grafo. Nessun individuo/azienda dev'essere inserito per ipotesi senza identificativo EUR-Lex. [SRC-35]

**Collegamento al corpus:** H02 (sabotaggi/logistica), H21 (intermediari societari, assicurativi e commerciali della flotta ombra), DS-01 (reti informative) e DS-05 (elusione). Non inferire che tutti i soggetti proposti abbiano partecipato al medesimo attacco.

### OEM26-025 — Moldavia: avviso di nuova influenza russa in Gagauzia

Il **9 novembre** il direttore del **Servizio di informazione e sicurezza moldavo (SIS)** **Alexandru Musteața**, intervenendo a una conferenza a Chișinău, ha dichiarato che il servizio osserva segnali di intensificazione delle attività russe d'influenza in vista dei cicli elettorali nella regione autonoma della **Gagauzia**, compresa l'elezione del Bashkan e dell'assemblea popolare. Non sono stati resi pubblici in quella sede tutti gli elementi operativi o eventuali nominativi responsabili. [SRC-41]

È dunque **E2 come allerta istituzionale** e non prova di compravendita di voti o finanziamenti in nuove specifiche competizioni. Ha grande rilevanza per la continuità con le reti **Ilan Șor / Evrazia / Promsvyazbank** già documentate nella Fonte_01/07, ma tali reti non possono essere promosse automaticamente ad autrici di ogni nuovo episodio. Richiede confronto con autorità elettorali moldave, OSCE/ODIHR, sanzioni UE e nuove transazioni documentate.


## 5. Dossier approfonditi: sicurezza strategica, industria ed energia

### OEM26-021 — Il G7 di Parigi del 9–10 novembre: una posizione comune, non un'operazione comune

La dichiarazione congiunta dei ministri degli Esteri del **G7**, pubblicata l'**11 novembre**, aggiorna il quadro diplomatico su più assi del progetto [SRC-36]:

- **Russia/Ucraina:** condanna degli attacchi contro infrastrutture e navigazione civile nel Mar Nero; sostegno a capacità difensive e alla resilienza energetica ucraina; necessità di un cessate il fuoco ampio e reciproco e di includere l'Europa nella definizione della propria sicurezza.
- **Filiera bellica russa:** il G7 condanna **l'assistenza militare di Iran e Corea del Nord** alla Russia e la **fornitura di armi, formazione e componenti dual-use da parte della Cina**. È una posizione istituzionale collegiale E2 sui trasferimenti contestati, non un inventario indipendente di tutte le singole spedizioni.
- **Sanzioni e shadow fleet:** richiesta di rafforzare il coordinamento contro navi con false bandiere o senza nazionalità, assicuratori, commercianti di petrolio e intermediari funzionali alle elusioni.
- **Crisi iraniana:** richieste di cessazione degli attacchi a navi civili in Hormuz; attenzione a minacce iraniane contro cittadini e installazioni occidentali e sostegno a soluzioni diplomatiche. Il documento menziona l'attribuzione britannica dell'episodio RAF Fairford.
- **Operazioni ibride:** condanna di sabotaggi, cyberattacchi, FIMI, pressioni migratorie e reti di criminalità transnazionale, con richiamo a condivisione informativa e resilienza.
- **Satellite e connettività:** riconoscimento dell'interdipendenza fra satelliti, stazioni a terra, alimentazioni elettriche, cavi sottomarini e reti terrestri; richiesta di ridondanza e capacità di ripristino.

**Significato probatorio:** il documento dimostra una **posizione diplomatica pubblica condivisa**, pur in presenza di divergenze nazionali su singole misure. Non prova, da solo, né l'esecuzione futura di ogni impegno né l'esistenza di comando comune fra i soggetti esteri criticati. Per il progetto è un riferimento utile per validare quali dipendenze gli Stati del G7 trattino come problemi di sicurezza nel novembre 2026.

### OEM26-022 — Cina: sospensione prorogata di alcuni controlli alle esportazioni

Il **9 novembre** il ministero del Commercio cinese ha annunciato, secondo Reuters, una **proroga di due mesi**, fino al **10 gennaio 2027**, di una sospensione di alcune restrizioni sulle esportazioni che sarebbe scaduta in novembre. Riguarda il quadro dei controlli più recenti su terre rare e altri materiali/tecnologie industriali, nel contesto dei negoziati commerciali con Washington. **Non equivale alla rimozione permanente di tutti i controlli cinesi**: alcuni controlli precedenti rimangono vigenti. [SRC-37]

La conseguenza per l'Europa non è un'interruzione di fornitura già avvenuta nell'intervallo considerato, bensì la persistenza di un **rischio regolatorio concentrato**: scadenze, licenze e decisioni bilaterali USA–Cina possono condizionare filiere europee senza che l'UE sia la controparte principale dei negoziati. La Fonte_04 descrive già la dipendenza europea da raffinazione, magneti, batterie e componenti. **Da aggiornare:** elenco esatto dei prodotti soggetti a sospensione, controlli invariati, quote di importazione UE e disponibilità di sostituti. Non sostituire le matrici industriali precedenti con un generico «Cina allenta tutto».

### OEM26-023 — Hormuz e guerra contro l'Iran: shock ancora aperto

Al **11 novembre 2026** la crisi tra Stati Uniti, Israele e Iran continua a condizionare navigazione, assicurazioni, petrolio e LNG. Reuters riferisce che il traffico di navi nello Stretto di **Hormuz** è risalito rispetto ai minimi di guerra, ma gli attacchi restano frequenti: in **ottobre** 31 navi per il trasporto di LNG sono uscite dall'area secondo il resoconto Reuters, mentre gli attacchi contro navi hanno raggiunto **37 episodi** nel mese, secondo la stessa ricostruzione. L'IMO è citata per **130 incidenti** dall'inizio della crisi e almeno **25 marinai morti**. Le categorie e i periodi devono essere preservati, senza sommare numeri eterogenei. [SRC-38]

Il **10 novembre** resoconti basati su Reuters indicano che Trump ha sospeso per il momento nuove offensive aeree dirette ma mantiene il blocco navale; Teheran continua a respingere le condizioni negoziali USA. Queste posizioni restano in evoluzione. **Impatto sull'Europa:** prezzi dei carburanti, costi di trasporto e assicurazione, volatilità LNG, pressione sul bilancio di famiglie e imprese e vulnerabilità della rotta Asia–Europa. Il collegamento causale macroeconomico generale va distinto da ipotesi non dimostrate secondo cui la crisi sarebbe stata deliberatamente orchestrata per generare specifiche proteste europee. [SRC-38][SRC-39]

**H16:** aggiornata come esposizione energetica e logistica persistente; non trasformata in operazione informativa. **Nuovo indicatore proposto:** `vessels_transiting_Hormuz_by_month`, `commercial_attacks_by_month`, `EU_LNG_spot_premium`, `energy_inflation_by_member_state`, con fonti e definizioni per metrica.

### OEM26-024 — Chornobyl: raccolta fondi dopo il danno del 2025

Il **9 novembre**, durante una conferenza organizzata a Parigi con **Ucraina, Francia e BERD/EBRD**, **14 Stati e organizzazioni** hanno promesso complessivamente **€303 milioni** per riparare il **New Safe Confinement** della centrale di **Chornobyl**, danneggiato dal colpo di drone russo del **14 febbraio 2025** secondo le fonti EBRD e ucraine. I costi di riparazione sono stimati in **almeno €500 milioni** e l'obiettivo è ripristinare piena funzionalità entro il **2030**. La conferenza ha coinvolto rappresentanti di **34 Stati e organizzazioni**, cifra diversa dai 14 donatori con impegni annunciati. [SRC-40]

**Perché includerlo:** è una conseguenza economica e di sicurezza nucleare di un'azione bellica già nota, con nuove risorse e nuovo orizzonte di intervento. **Non** indica un secondo attacco alla struttura nel novembre 2026. Archi appropriati: `DANNEGGIATO_DA` (episodio 2025); `RIPARAZIONE_FINANZIATA_DA` (impegni del 9 novembre); `DIPENDE_DA` (materiali, capacità e sicurezza dell'infrastruttura). Distinguere finanziamenti *promessi* da somme versate e lavori completati.

### OEM26-026/027 — Baltico: attività aeree, droni e azioni militari transfrontaliere

Il ministero della Difesa lituano ha documentato interventi di velivoli NATO nel **28 e 30 ottobre**, e nella settimana **2–8 novembre**, per identificare o scortare velivoli russi in **spazio aereo internazionale** (fra cui SU-24M, AN-26 e IL-20), in alcuni casi senza piani di volo o con transponder spento. **Non presentare automaticamente questi episodi come incursioni nello spazio aereo sovrano NATO**. [SRC-42]

Le segnalazioni di droni del periodo riguardano invece episodi eterogenei, fra cui interruzioni operative all'aeroporto **Leipzig/Halle** il **7–8 novembre**, allarmi in **Romania**, **Lettonia**, **Lituania** e **Moldavia**. L'European Observatory of Drone Incidents distingue casi confermati, segnalati e attribuiti; la sua numerosità complessiva riflette **incidenti pubblicati e verificati secondo regole dell'osservatorio**, non il numero di azioni ostili compiute dalla Russia. Numerosi casi non hanno un autore identificato, e alcuni droni sono compatibili con sconfinamenti dovuti alla guerra in Ucraina. [SRC-43]

L'**11 novembre** Reuters riporta un **attacco ucraino** contro infrastrutture del porto russo di **Ust-Luga** sul Baltico, con incendio e danni a serbatoi secondo le dichiarazioni di Kiev, mentre autorità russe riferiscono feriti e abbattimenti di droni. In concomitanza all'operazione sono scattati allarmi e decolli NATO per possibili/effettivi sconfinamenti in Stati baltici. **Il raid su Ust-Luga è descritto come operazione ucraina contro un obiettivo in Russia**; non va ri-etichettato come sabotaggio russo dell'Europa. La responsabilità di ogni singolo drone che attraversa un confine richiede identificazione autonoma. [SRC-44]

**Rilevanza:** sicurezza dello spazio aereo, continuità aeroportuale, rischio di escalation accidentale, difesa integrata NATO, colli di bottiglia logistici ed energetici del Baltico. Mantenere campi distinti `cross_border_airspace_incursion`, `origin_confirmed`, `operator_attributed`, `target_type`, `civilian_damage`, `NATO_response`.

### OEM26-028 — Finanziamento ucraino 2027 e attriti interni all'UE

Al **11 novembre** è emersa una disputa sulla ripartizione dei costi del sostegno finanziario all'Ucraina per il 2027. Secondo la ricostruzione di *Le Monde*, il cancelliere tedesco **Friedrich Merz** ha collegato il sostegno al nuovo quadro di bilancio pluriennale UE **2028–2034** e ha contestato esenzioni richieste da alcuni governi dall'obbligo di partecipare a nuovi prestiti. L'esigenza finanziaria indicata è di circa **€70 miliardi** per il 2027, di cui una parte rilevante da coprire attraverso l'UE. Vari governi, fra cui quello slovacco, contestano l'approccio. [SRC-45]

Non risulta una decisione definitiva di taglio dei fondi o di approvazione di un nuovo prestito in questa notizia. **Il punto strategico** è la vulnerabilità della risposta europea ai vincoli di unanimità, finanziamento condiviso e continuità pluriennale dell'assistenza, in un contesto in cui Washington ha appena cambiato composizione parlamentare ma non governo esecutivo. **Non inferire** che gli Stati che dissentono siano controllati dalla Russia; analizzare eventuali relazioni politiche e finanziarie separatamente, con fonti pertinenti.

### OEM26-029 — Nuovo dataset giornalistico europeo sulle attività ibride

L'**EBU/Eurovision News Spotlight**, con giornalisti di **17 emittenti pubbliche europee**, ha pubblicato una mappa OSINT di **centinaia di incidenti riportati** fra **1 aprile e 15 ottobre 2026** in **17 Paesi**, classificati per tipologia e grado/fonte di attribuzione alla Russia. La pubblicazione è successiva alla baseline ma il periodo osservato è prevalentemente precedente. Comprende segnalazioni di incursioni aeree, sabotaggio, reclutamento di intermediari e altre attività ibride, adottando criteri di cautela nell'attribuzione. [SRC-46]

**Valore aggiunto:** consente un confronto tra il corpus del progetto, le serie CSIS/IISS e il nuovo catalogo EBU. **Non sommare direttamente i loro numeri**: universi statistici, fonte delle attribuzioni, finestre temporali e criteri di inclusione differiscono. Le 147 voci Fonte_06 sono una selezione curatoriale, non il totale dei casi europei; l'EBU è una base di episodi riportati, non un accertamento giudiziario autonomo.

## 6. Incroci documentati, contrasti e collegamenti *non* provati

| Incrocio | Evidenza corretta | Proposizione da non promuovere a fatto | Stato |
|---|---|---|---|
| Francia–Iran–refrigerazione | Francia identifica SHAHID KAVEH/IRGC per ottobre; atto del 9–10 novembre | L'IRGC ha diretto tutti gli attacchi italiani del 1–2 novembre | **Attribuzione E2 limitata** |
| Italia–NoName–refrigerazione | Rivendicazione di NoName057(16) e Z-Pentest; indagini italiane | Il Cremlino ha personalmente ordinato l'intera campagna europea | **Rivendicazione E4; mandato non verificato** |
| Francia–Italia–stesso settore | Superficie industriale simile e vicinanza temporale, comunicato UE congiunto | Identiche credenziali, medesimo committente o cabina di regia Iran–Russia | **H23 nuova ipotesi E5** |
| NoName–Tajani | Dati divulgati, minacce e pregressa attività anti-Italia attribuita mediaticamente al gruppo | Ogni dato divulgato proviene da violazione della Farnesina o da intelligence russa | **Origine dati ignota** |
| BBT–Everest | BBT conferma intrusione; prime piste giornalistiche indicano ransomware russofono | Ordine del GRU o sabotaggio dei lavori del tunnel | **Non provato; nessun fermo lavori** |
| Allarmi aerei–scuole | Email minatorie con grandi costi di prevenzione, mittenti ancora ignoti | Unico mandante statale / effettiva presenza di esplosivi | **Non provato** |
| Rosstat–hacker | Attacco ammesso, leak rivendicato, inchieste su materiale ottenuto | Tutti i conteggi rappresentano morti di guerra ufficiali e verificati | **Integrità e definizioni non risolte** |
| HAYI–Iran | Nuovo indictment DOJ e precedenti attribuzioni UK | Colpevolezza giudizialmente definitiva dei tre imputati | **Imputazione, non sentenza** |
| Storm-1516–USA | Analisti rilevano false narrazioni con indicatori russi | Operazione che ha determinato il risultato delle mid-term | **Impatto elettorale non provato** |
| Mid-term–Ucraina | Nuove maggioranze USA dal gennaio 2027 | Già abrogata ogni deroga sanzionatoria o ripristinato sostegno senza condizioni | **Conseguenze future aperte** |
| Fitburg–Russia | Condanna di due membri dell'equipaggio per ancore e cavi | Ordine statale di sabotaggio provato in sentenza | **Non provato** |
| Droni Baltico–Russia | Intercettazioni NATO e allarmi in Paesi baltici | Tutti gli avvistamenti sono droni militari russi | **Attribuzione caso per caso** |
| Cina–Russia–G7 | Attribuzione del G7 su forniture dual-use e addestramento | Ogni impresa cinese coinvolta nelle filiere opera su ordine politico diretto | **Solo entità specifiche dopo verifica** |

**Lettura trasversale:** gli eventi osservati confermano *molteplici strumenti e punti di pressione sull'Europa*, ma non consentono di ridurli a un unico blocco di comando. Occorre inoltre distinguere attori statali fra loro in conflitto, gruppi che adottano identità politiche online, reti criminali con incentivi economici e fornitori di infrastrutture che espongono involontariamente gli operatori.

## 7. Aggiornamento delle 22 ipotesi già presenti nella Fonte_07

| Ipotesi originale | Aggiornamento al 2026-11-11 | Cambiamento probatorio |
|---|---|---|
| **H02** — Coordinamento sabotaggi logistici | Nuove proposte di sanzioni UE potrebbero includere il caso Leipzig/Halle; monitorare atti finali e soggetti identificati | **Pista nuova, nessuna prova generalizzata di stesso committente** |
| **H08** — Catena decisionale Starshield | G7 richiama necessità di ridondanza satellitare; nessuna nuova prova diretta sull'ordine Starshield di ottobre | **Rischio strategico rafforzato, ipotesi originaria invariata** |
| **H10/H11/H12** — Navi e infrastrutture subacquee | Sentenza Fitburg fornisce un precedente separato di dolo individuale giudiziariamente riconosciuto in primo grado | **Non risolve H10/H11/H12**, riferite ad altre navi |
| **H13** — Scala e impatto FIMI | Nuovi video attribuiti da esperti a Storm-1516 durante le mid-term, reach osservabile | **Episodi nuovi; causalità elettorale sempre ignota** |
| **H15** — Sfruttamento straniero di proteste | Nuove crisi e intimidazioni non dimostrano direzione estera delle proteste europee del 2026 | **Invariata** |
| **H16** — Energia globale/Hormuz | Nuovi dati mensili su transiti e attacchi marittimi; blocco/negoziati non risolti | **Esposizione documentata aggiornata** |
| **H17** — Minerali e semiconduttori | Nuova scadenza gennaio 2027 di deroghe cinesi su export control | **Indicatore temporale aggiunto** |
| **H19** — Reti criminali e Iran | Indictment USA HAYI amplia evidenza di presunti proxy; non prova mandato iraniano nel distinto caso Foxtrot | **Confronto, non fusione** |
| **H20** — Presunto incarico iraniano RAF Fairford | Incriminazioni UK (27/10) e USA (10/11), dettagli di presunta catena HAYI/IRGC | **Pista sensibilmente rafforzata sul piano accusatorio; non conclusa** |
| **H21** — Elusione sanzioni/flotta ombra | 145 designazioni concordate dagli ambasciatori UE 11/11, attesa adozione finale | **Nuovi futuri nodi/archi verificabili, non ancora attivi** |
| **H01,H03–H07,H09,H14,H18,H22** | Nessuna nuova prova diretta sufficiente emersa nelle fonti selezionate in questo aggiornamento | **Restano aperte** |

### Nuove ipotesi da aggiungere *solo* al registro delle ipotesi

| ID proposto | Domanda investigativa | Prova necessaria per promuovere un arco | Esclusione esplicita |
|---|---|---|---|
| **H23** | Vi è una catena tecnica/finanziaria comune tra SHAHID KAVEH, NoName057(16), Z-Pentest e seconda ondata UE? | IOC indipendenti, infrastruttura condivisa, flussi, comunicazioni o attribuzione congiunta | Non bastano slogan o contemporaneità |
| **H24** | Quali famiglie di dispositivi OT e quali modalità di accesso hanno permesso le compromissioni della filiera alimentare? | Analisi CERT su firmware, configurazioni, log e installazioni | Non presumere una CVE unica |
| **H25** | Da quali categorie di fonte provengono i dati personali usati per intimidire figure pubbliche italiane? | Indagini, data lineage, forensic matching con archivi esposti | Non riprodurre i dati delle vittime |
| **H26** | Gli allarmi ai voli e quelli alle scuole condividono infrastruttura di invio e coordinamento operativo? | Header, metadati, account, timeline, indagini Europol/polizia | Slogan e firma falsificabile non bastano |
| **H27** | Quali nodi Storm-1516 delle mid-term coincidono tecnicamente con le campagne europee 2025–26? | Dominî, hosting, contenuti e account correlati da ricercatori | Non dedurre impatto sul voto |
| **H28** | Il dataset Rosstat può essere autenticato, deduplicato e comparato con decessi documentati indipendenti? | Campione verificabile, dizionario codici, triangolazione forense | Non condividere registri nominativi sensibili |
| **H29** | Quali leve parlamentari USA post-mid-term incidono effettivamente su aiuti a Kiev e sanzioni russe dal 2027? | Testi di leggi, bilanci, votazioni, executive orders | Non presumere inversione politica automatica |
| **H30** | Quali delle operazioni attribuite dal DOJ a HAYI condividono persone e risorse con altre reti proxy iraniane europee? | Atti giudiziari, trasferimenti e indagini su singoli episodi | Non assimilare HAYI a ogni gruppo sciita/iraniano |
| **H31** | Chi sono i beneficiari finali, armatori, broker e assicuratori delle nuove designazioni UE? | Regolamenti finali, registri UBO, IMO, proprietà e passaggi di bandiera | Non indagare per sola nazionalità |
| **H32** | Come distinguere le incursioni militari deliberate dagli sconfinamenti accidentali di droni nel Baltico? | Tracciamento rotte, detriti e comunicati ufficiali | Mai attribuire automaticamente ogni oggetto alla Russia |

## 8. Modello di importazione proposto per l'applicazione

Questa fonte **non modifica automaticamente** i 147 eventi, 353 nodi, 444 archi e 22 ipotesi della baseline. Fornisce una serie di nuove schede e *candidate relations* da validare con deduplicazione.

### 8.1 Identificativi, date, provenienza

```yaml
source_document: Fonte_09_Aggiornamento_OSINT_Eventi_Reti_Europa_2026-11-11.md
source_version: "1.0"
baseline_cutoff: "2026-10-21"
updated_to: "2026-11-11"
record_example:
  id: "OEM26-001"
  title: "Attribuzione francese degli attacchi alla catena del freddo"
  event_start: "2026-10-11"
  event_end: "2026-10-12"
  attribution_date: "2026-11-09"
  publication_date: "2026-11-10"
  country_codes: ["FR"]
  domains: ["cyber", "industrial_control_system", "food_supply"]
  update_type: "NEW_ATTRIBUTION"
  target: "sistemi di refrigerazione commerciale"
  attributed_actor: "SHAHID KAVEH / IRGC"
  attribution_made_by: "Ministero degli Esteri francese"
  evidence_level_event: "E1"
  evidence_level_attribution: "E2"
  attribution_status: "institutional_attribution_contested"
  impact_status: "material_damage_reported"
  source_ids: ["SRC-01", "SRC-02"]
  hypotheses_to_keep_separate: ["H23", "H24"]
  replaces_prior_event: null
  notes: "Non estendere l'attribuzione a tutti i casi europei."
```

### 8.2 Archi *candidati* che possono essere inseriti come fatti, purché corredati dalla fonte esatta

| Soggetto | Relazione letterale | Oggetto | Qualifica |
|---|---|---|---|
| Ministero Esteri Francia | `ATTRIBUISCE_A` | SHAHID KAVEH per la campagna francese 11–12 ottobre | E1 su dichiarazione; E2 su responsabilità |
| ENISA/Commissione UE | `CONFERMA_MONITORAGGIO_DI` | Ondata incidenti refrigerazione 1–2 novembre UE | E1 sul comunicato |
| BBT SE | `DICHIARA_INCIDENTE` | Accesso non autorizzato ottobre alla società | E1 dichiarazione aziendale |
| CPS britannica | `INCRIMINA` | Due imputati per RAF Fairford | E1 atto; responsabilità non giudicata |
| DOJ USA | `INCRIMINA` | Al-Saadi / Mohajeri / Al-Hassani | E1 atto; non colpevolezza |
| Tribunale distrettuale Helsinki | `CONDANNA_IN_PRIMO_GRADO` | Due membri equipaggio Fitburg | E1 sentenza, impugnabile |
| AP | `PROIETTA_CONTROLLO` | Democratici — Camera e Senato USA | Fonte elettorale qualificata; non risultato finale certificato |
| G7 | `DICHIARA_POSIZIONE_SU` | Supporto Ucraina, shadow fleet, Iran, Cina, cyber | E1 dichiarazione pubblica |
| Ambasciatori UE | `RAGGIUNGONO_ACCORDO_SU` | 145 designazioni anti-russe | E3 Reuters, **non sanzione in vigore** |
| EBRD | `ANNUNCIA_IMPEGNI_PER` | Ripristino confinamento Chornobyl | E1 impegni, non pagamenti conclusi |

### 8.3 Archi vietati allo stato attuale (conservare solo come ipotesi)

```text
IRGC -> COMANDA -> NoName057(16)
GRU -> COMANDA -> NoName057(16) [per ciascun attacco qui descritto]
IRGC -> COMANDA -> Z-Pentest
Stato russo -> ORDINA -> Intrusione BBT SE
Stato russo -> ORDINA -> Fitburg
Iran -> COMANDA -> Tutti gli attacchi refrigerazione in UE
Stato russo -> COMANDA -> Tutti gli allarmi bomba di novembre
Storm-1516 -> CAUSA -> Risultato elezioni USA
Democratici USA -> ABROGANO_GIA -> Deroghe sanzioni di ottobre
HAYI -> COINCIDE_CON -> SHAHID KAVEH
```

L'elenco non afferma che questi collegamenti siano falsi: afferma che **non sono attualmente sostenuti dalle prove pubbliche qui raccolte**.

### 8.4 Deduplicazione e granularità

1. Cercare le corrispondenze con `TL-*` per **RAF Fairford 27/09**, **sabotaggio refrigerazione Francia 11–12/10**, **Fitburg 31/12/2025**, **Chornobyl 14/02/2025**, **Storm-1516** e sanzioni UE già registrate. Inserire *nuove prove* e atti come record correlati, non sovrascrivere lo stato storico senza versionamento.
2. Usare identificatori di entità persistenti e, quando possibile, codici ufficiali (EUR-Lex, identificativo IMO, nome legale di una società). Non usare alias di gruppi come chiave primaria universale.
3. Importare le 30 schede come *candidate items*, poi scegliere la granularità: alcuni dossier raggruppano più eventi e fasi. **Non sommare 30 al numero dei 147 eventi senza deduplicazione semantica.**
4. Conservare `first_reported_at`, `source_published_at`, `observed_at`, `attribution_at`, `last_verified_at`; associare ogni modifica a una fonte precisa.
5. Separare `statement`, `claim`, `physical_event`, `investigation`, `sanction`, `court_decision`, `scenario`, `indicator`.
6. Assegnare un campo di `right_of_reply` o `denial`: Iran contesta attribuzione francese, Russia nega operazioni ibride attribuite, Rosstat nega esfiltrazione, imputati Fitburg negano responsabilità, sospettati RAF Fairford non condannati.
7. **Non pubblicare dati personali rubati**, identificativi tecnici che permettano di attaccare sistemi vulnerabili, dettagli di minacce a minori, registri di morte nominativi o account di accesso.

## 9. Piano di verifica e aggiornamento successivo

| Controllo | Informazione attesa | Segnale che cambia lo stato |
|---|---|---|
| Sanzioni UE 145 | Decisione Consiglio e pubblicazione in Gazzetta Ufficiale UE dal 16/11 | Elenco definitivo e basi giuridiche, con identificatori soggetti |
| Cyber refrigerazione UE | Eventuali rapporti congiunti ACN/ENISA/Europol e procure | Attribuzione seconda ondata distinta o confermata con prova tecnica |
| Francia–Iran | Provvedimenti giudiziari, sanzioni UE, eventuale risposta statale | Passaggio da attribuzione diplomatica a evidenza tecnica/giudiziaria aggiuntiva |
| Minacce Italia | Esito indagini Roma/Perugia e Polizia postale | Identificazione origine dati, autori e prove di mandato |
| BBT SE | Relazione forense e comunicati successivi | Natura ed estensione effettiva dell'esfiltrazione, autore verificato |
| False minacce | Indagini congiunte di polizie, Europol e agenzie aviazione | Infrastruttura condivisa, arresti, origine effettiva |
| Rosstat | Analisi replicabile del database e confronto metodologico fra testate | Eliminazione divergenze 392,7k/412,6k/450,1k |
| RAF Fairford/HAYI | Testo completo indictment, udienze UK/USA | Imputazioni modificate, assoluzioni o condanne |
| Fitburg | Appello e motivazioni della sentenza | Conferma/riforma del dolo degli equipaggi, eventuali ulteriori mandanti |
| Mid-term | Certificazione finale di tutti i seggi USA e insediamento gennaio 2027 | Nuovo equilibrio parlamentare definitivo |
| FIMI USA | Meta/X/TikTok, FBI/CISA, analisti indipendenti | Attribuzioni ulteriori e prove tecniche che supportino collegamenti di rete |
| Abu Dhabi | Follow-up negoziale e scambio prigionieri effettivamente avvenuto | Accordi firmati ed eseguiti, concessioni verificabili |
| Gagauzia | SIS, Commissione elettorale moldava, OSCE/ODIHR | Nuovi casi con finanziamenti, sospetti o misure ufficiali |
| Cina/terre rare | Atti ministeriali cinesi e scadenza 10 gennaio 2027 | Revoca, proroga o reintroduzione di controlli |
| Hormuz | IMO, IEA, dati di traffico marittimo e prezzi UE | Cessazione/recrudescenza attacchi, riapertura sostenibile |
| Droni Baltico | Report forensi ministeriali/NATO | Identificazione singolo drone e sua provenienza |

## 10. Conclusione: che cosa cambia rispetto al 21 ottobre

**Cambia la qualità di alcune attribuzioni.** Il caso della refrigerazione francese passa da incidente cyber-fisico a **attribuzione istituzionale esplicita all'IRGC**, mentre le rivendicazioni filorusse sulla seconda ondata e sull'Italia devono restare in un livello diverso. Il caso **RAF Fairford** passa da allerta e indagine a imputazioni formali in due giurisdizioni. Il caso **Fitburg** passa da danneggiamento di cavi e indagini a **condanna di primo grado di due membri dell'equipaggio**, senza responsabilità statale giudizialmente provata.

**Cambiano le vulnerabilità osservabili.** Sistemi OT commerciali poco aggiornati e gestiti via Internet, dati personali usati per intimidazione, email che bloccano servizi e scelte su infrastrutture strategiche mostrano come i danni possano essere prodotti senza conquista territoriale. La pubblicazione di dati Rosstat rappresenta, se corroborata, una nuova fonte quantitativa di ricerca sulla guerra, da tenere fuori dal registro dei fatti certi finché non sia replicata.

**Cambia il contesto politico, non automaticamente la direzione strategica.** Il nuovo Congresso USA avrà una maggioranza differente, ma al cutoff Trump esercita ancora la presidenza e la politica estera resta in parte prerogativa dell'esecutivo; ad Abu Dhabi gli interlocutori negoziano senza soluzione territoriale; il G7 conferma il sostegno a Kiev ma espone la necessità di maggiori capacità e risorse; la Cina mantiene potere regolatorio su componenti strategici. L'UE sta valutando nuove sanzioni, senza averle ancora formalmente introdotte.

**L'ipotesi di una cabina di regia universale resta priva di prova.** La raccolta è utile proprio perché distingue ciò che è stato **osservato**, ciò che viene **attribuito**, ciò che è **contestato** e ciò che potrà eventualmente essere **dimostrato** con documenti ulteriori.

---

## 11. Registro delle fonti verificabili

**Criterio:** in ciascuna scheda gli identificativi `SRC-*` rimandano ai collegamenti seguenti. Le fonti istituzionali sono prioritarie per atti e attribuzioni, le testate per ricostruzioni giornalistiche e ricerca indipendente. Le pagine sono indicate con URL permanenti, quando disponibili. Fonti originariamente precedenti al 22/10 sono contrassegnate come *contesto* e non diventano nuovi eventi per il solo fatto di essere richiamate.

### Cyber, Italia e Francia

- **[SRC-01]** Ministero Esteri Francia, **10/11/2026** (dichiarazione resa pubblica il 9/11 in francese), *Declaration of attribution to Iran of cyber attacks against France*: https://www.diplomatie.gouv.fr/en/presse-et-ressources/decouvrir-et-informer/actualites/declaration-d-attribution-a-l-iran-de-cyberattaques-visant-la-france
- **[SRC-02]** Reuters, **10/11/2026**, *France summons Iran envoy over supermarket fridge hack, warns of response*: https://www.reuters.com/world/europe/france-summons-iran-envoy-over-supermarket-fridge-hack-warns-response-2026-11-10/
- **[SRC-03]** Commissione europea / DG CNECT, **04/11/2026**, *Joint statement on cyber incidents in refrigeration systems across the EU*: https://digital-strategy.ec.europa.eu/en/news/joint-statement-cyber-incidents-refrigeration-systems-across-eu
- **[SRC-04]** ANSA, **02/11/2026**, *Attacchi hacker ai supermercati, alert Agenzia cyber in Italia*: https://www.ansa.it/emiliaromagna/notizie/2026/11/02/attacchi-hacker-ai-supermercati-alert-agenzia-cyber-in-italia_eff28fef-14f0-46e0-b627-2b25473a9613.html
- **[SRC-05]** ANSA, **03/11/2026**, *Supermercati sotto attacco hacker anche in Italia, riunione a Palazzo Chigi*: https://www.ansa.it/sito/notizie/mondo/europa/2026/11/02/supermercati-sotto-attacco-hacker-anche-in-italia-riunione-a-palazzo-chigi-con_5e6f0b27-05c9-468a-9004-087167137119.html
- **[SRC-06]** RaiNews Toscana, **03/11/2026**, *Allarme hacker nella filiera alimentare, verifiche su due aziende toscane*: https://www.rainews.it/tgr/toscana/articoli/2026/11/allarme-hacker-nella-filiera-alimentare-verifiche-su-due-aziende-toscane-6359a32e-616f-4efd-a209-9bf27bb2d48a.html
- **[SRC-07]** ANSA, **05/11/2026**, *Agenzia cybersicurezza: attacchi ai frigo favoriti da software non aggiornati*: https://www.ansa.it/sito/notizie/cronaca/2026/11/05/lagenzia-per-la-cybersicurezza-gli-attacchi-hacker-ai-frigo-favoriti-da-software-non_4fba4e05-6c60-4229-b452-d361a91e23be.html
- **[SRC-08]** ANSA/Tg1, **04/11/2026**, *Due gruppi di hacker filorussi rivendicano attacchi ai supermercati*: https://www.ansa.it/sito/notizie/cronaca/2026/11/04/tg1-due-gruppi-di-hacker-filorussi-rivendicano-attacchi-ai-supermercati_0cc61f52-06bc-4f69-8ba2-fb6d70f5dc79.html
- **[SRC-09]** Ministero Esteri italiano, **07/11/2026**, *Tajani: dati personali diffusi sul dark web*: https://www.esteri.it/it/sala_stampa/archivionotizie/comunicati/2026/11/tajani-dati-personali-diffusi-sul-dark-web-chiesto-di-trattare-minacce-ibride-al-prossimo-g7-esteri-solidarieta-a-lo-voi-gabrielli-e-tassan-zanin/
- **[SRC-10]** ANSA, **09/11/2026**, *Avviata un'indagine sulla diffusione dei dati di Tajani, Gabrielli e Lo Voi*: https://www.ansa.it/sito/notizie/cronaca/2026/11/09/avviata-una-indagine-sulla-diffusione-dei-dati-di-tajani-e-gabrielli-e-lo-voi_217a25ea-2d5f-432d-98ba-51fd3560f4ca.html
- **[SRC-11]** RaiNews, **11/11/2026**, *Tajani denuncia nuove minacce hacker, intimidita anche la famiglia*: https://www.rainews.it/articoli/2026/11/tajani-denuncia-nuove-minacce-hacker-intimidita-anche-la-mia-famiglia-compresi-i-minori-85e7c1c5-ed9a-4506-b28e-abdd1c1659b5.html
- **[SRC-12]** RaiNews Trento, **07/11/2026**, *Attacco ai server del tunnel del Brennero. BBT SE: Nessun impatto sui lavori*: https://www.rainews.it/tgr/trento/articoli/2026/11/attacco-ai-server-del-tunnel-del-brennero-bbt-se-nessun-impatto-sui-lavori-societa-bbt-se-23898787-f31f-42d4-8988-8c26f0460347.html
- **[SRC-13]** la Repubblica, **07/11/2026**, *Attacco hacker al tunnel del Brennero e dati Smartbox*: https://www.repubblica.it/cronaca/2026/11/07/news/attacco_hacker_tunnel_brennero-425706419/
- **[SRC-14]** Associated Press, **05/11/2026**, *More than a dozen flights in Europe receive bomb threats*: https://apnews.com/article/6585ff565ee1ccb9f19b73074aa2fec4
- **[SRC-15]** Associated Press, **11/11/2026**, *Italy's Meloni says cyberthreats are intended to spread fear after schools hit by bomb threat*: https://apnews.com/article/0f312fda4ee2e9cdcebd0d6e1a40d9e8
- **[SRC-16]** Euronews, **09/11/2026**, *Nessun attacco hacker ai sistemi della DIA secondo ministro dell'Interno*: https://it.euronews.com/2026/11/09/italia-nessun-attacco-hacker-ai-sistemi-della-dia-verifiche-in-corso-su-dark-web-dice-mini
- **[SRC-17]** Il Fatto Quotidiano, **11/11/2026**, *NoName057 rivendica attacco a impianti di riscaldamento*: https://www.ilfattoquotidiano.it/2026/11/11/noname057-attacco-hacker-sistemi-industriali-notizie/8568458/

### Russia, intelligence, procedimenti, elezioni

- **[SRC-18]** The Guardian, **09/11/2026**, *More than 400,000 Russians killed fighting in Ukraine war, leaked data suggests*: https://www.theguardian.com/world/2026/nov/09/russians-killed-ukraine-war-leaked-data
- **[SRC-19]** Le Monde, **10/11/2026**, *The death toll Putin tried to hide: Nearly 400,000 Russians killed in Ukraine war*: https://www.lemonde.fr/en/international/article/2026/11/10/the-death-toll-putin-has-tried-to-hide-nearly-400-000-russians-killed-in-the-ukraine-war_6776332_4.html
- **[SRC-20]** Stars and Stripes, **09/11/2026**, *Hacked records show staggering Russian death toll*: https://www.stripes.com/theaters/europe/2026-11-09/ukraine-war-russian-casualty-numbers-23410343.html
- **[SRC-21]** US Department of Justice, **10/11/2026**, *Three Iranian-backed operatives indicted ... nearly 20 attacks*: https://www.justice.gov/opa/pr/three-iranian-backed-operatives-indicted-their-roles-nearly-20-terrorist-attacks-and
- **[SRC-22]** Associated Press, **10/11/2026**, *US charges three men with plotting terror attacks including RAF Fairford*: https://apnews.com/article/b9c7812aeb1d74a2cfbc4c4df1431095
- **[SRC-23]** Crown Prosecution Service, **27/10/2026**, *Two men charged with National Security Act offences following RAF Fairford incident*: https://www.cps.gov.uk/national-news/news/cps-announces-two-men-charged-national-security-act-offences-following-raf
- **[SRC-24]** Tribunali finlandesi, **05/11/2026**, *Sentenza primo grado Fitburg (comunicato in finlandese)*: https://www.tuomioistuimet.fi/ajankohtaista/tiedotteet/karajaoikeus-on-antanut-tuomion-ns-fitburg-asiassa/
- **[SRC-25]** Yle, **05/11/2026**, *Helsinki court jails two Fitburg crew members over subsea cable damage*: https://yle.fi/a/74-20255306
- **[SRC-26]** Associated Press, **05/11/2026**, *Calling control of Congress in the 2026 midterm elections*: https://www.ap.org/the-definitive-source/behind-the-news/calling-control-of-congress-in-the-2026-midterm-elections/
- **[SRC-27]** CQ Roll Call, aggiornamento **10/11/2026**, *Key midterm election results*: https://rollcall.com/2026/11/03/key-midterm-election-results/
- **[SRC-28]** Associated Press, **11/11/2026**, *More than a dozen key races remain too early to call*: https://apnews.com/article/90ce111a971a0f70ba938d27fe69f65d
- **[SRC-29]** PolitiFact, **30/10/2026**, *Russian influence operation linked to attacks targeting Democrats in Maine, Ohio, Texas*: https://politifact.com/article/2026/oct/30/russia-talarico-jackson-brown-storm-1516-senate/
- **[SRC-30]** AP (ripubblicato da Washington Post), **27/10/2026**, *Disinformation videos, likely from Russia, exploiting real people to malign Senate candidates*: https://www.washingtonpost.com/politics/2026/10/27/midterm-election-disinformation-russia-talarico-brown/bcafa960-d264-11f1-9931-2a41b76fc976_story.html
- **[SRC-31]** Reuters, **11/11/2026**, *Russia and Ukraine say some progress made at talks, US cites lack of trust*: https://www.reuters.com/world/europe/us-russia-ukraine-start-second-day-abu-dhabi-peace-talks-2026-11-11/
- **[SRC-32]** Reuters, **02/11/2026**, *US to mediate trilateral talks with Ukraine, Russia in Abu Dhabi*: https://www.investing.com/news/world-news/us-to-hold-trilateral-talks-with-ukraine-russia-in-abu-dhabi-next-weekus-official-4993163
- **[SRC-33]** The Guardian, **11/11/2026**, *Ukraine talks in Abu Dhabi bring progress on prisoners but not on peace*: https://www.theguardian.com/world/2026/nov/11/ukraine-talks-in-abu-dhabi-bring-progress-on-prisoners-but-not-on-peace
- **[SRC-34]** Associated Press, **05/11/2026**, *Trump meets with top Putin envoy at White House*: https://apnews.com/article/3ae35835dbc87ab348478c62c6c25ee3
- **[SRC-35]** Reuters, **11/11/2026**, *EU envoys agree new Russia sanctions listings on banks, shadow fleet and misinformation*: https://www.reuters.com/business/finance/eu-envoys-agree-new-russia-sanctions-listings-banks-shadow-fleet-misinformation-2026-11-11/

### Diplomazia, energia, resilienza e ricerca

- **[SRC-36]** Farnesina, **11/11/2026**, *Dichiarazione congiunta G7 dei ministri degli Esteri, Parigi 9–10/11*: https://www.esteri.it/it/sala_stampa/archivionotizie/comunicati/2026/11/dichiarazione-congiunta-a-seguito-della-riunione-dei-ministri-degli-esteri-del-g7-tenutasi-a-parigi-il-9-e-10-novembre-2026/
- **[SRC-37]** Reuters, **09/11/2026**, *China extends suspension of new rare earth controls until January*: https://www.internazionale.it/ultime-notizie-reuters/2026/11/09/china-extends-suspension-of-new-rare-earth-controls-until-january
- **[SRC-38]** Reuters, **11/11/2026**, *Hormuz traffic is up. So are the attacks*: https://www.reuters.com/world/middle-east/hormuz-traffic-is-up-so-are-attacks-2026-11-11/
- **[SRC-39]** Quartz/Reuters, **10/11/2026**, *Trump holds off on new Iran strikes, keeps Hormuz blockade*: https://qz.com/trump-hold-off-iran-strikes-hormuz-blockade-111026
- **[SRC-40]** EBRD, aggiornamento **09–10/11/2026**, *Making Chornobyl safe*: https://www.ebrd.com/home/what-we-do/focus-areas/nuclear-safety/making-chornobyl-safe.html
- **[SRC-41]** Radio Moldova, **09/11/2026**, *SIS chief warns of increased Russian interference ahead of elections*: https://radiomoldova.md/p/89312/sis-chief-warns-of-increased-russian-interference-ahead-of-elections
- **[SRC-42]** Ministero della Difesa lituano, **02/11/2026** e **09/11/2026**, *Baltic air interceptions*: https://kam.lt/en/data-on-interceptions-of-aircraft-completed-near-the-baltic-states-borders-on-october-26-november-1-2026/ e https://kam.lt/en/data-on-interceptions-of-aircraft-completed-near-the-baltic-states-borders-on-november-2-8-2026/
- **[SRC-43]** European Observatory of Drone Incidents, dati consultati **11/11/2026**, *Incidents in 2026*: https://droneobservatory.eu/en/incidents/2026
- **[SRC-44]** Reuters, **11/11/2026**, *Drone attack triggers fire in Russia's Baltic port of Ust-Luga*: https://www.reuters.com/world/drone-attack-causes-fire-russias-baltic-sea-port-ust-luga-governor-says-2026-11-11/
- **[SRC-45]** Le Monde, **11/11/2026**, *Merz threatens to cut EU funds for member states that don't support Ukraine*: https://www.lemonde.fr/en/international/article/2026/11/11/merz-threatens-to-cut-eu-funds-for-member-states-that-don-t-support-ukraine_6778019_4.html
- **[SRC-46]** Eurovision News Spotlight / EBU, fine ottobre **2026**, *Hybrid war map: Attacks linked to Russia in Europe*: https://spotlight.ebu.ch/p/russia-hybrid-war-europe-incidents-map
- **[SRC-47]** Reuters, **10/11/2026**, *France summons Iran envoy over supermarket fridge hack*: https://www.internazionale.it/ultime-notizie-reuters/2026/11/10/france-summons-iran-envoy-over-supermarket-fridge-hack-warns-of-response
- **[SRC-48]** ANSA, **09/11/2026**, *Tajani: attacchi ibridi in Italia da hacker filorussi, mandante statale non noto*: https://www.ansa.it/sito/notizie/mondo/europa/2026/11/09/tajani-attacchi-ibridi-da-iran-quelli-contro-italia-sono-di-hacker-filorussi_7ac25056-1510-46cf-998b-97dbec48cf0c.html
- **[SRC-49]** Reuters, **05/11/2026**, *Midterms upended Congress but Trump still commands foreign policy*: https://www.reuters.com/world/us/midterms-upended-congress-trump-still-commands-foreign-policy-2026-11-05/
- **[SRC-50]** Governo britannico/FCDO, **12/10/2026**, *Joint statement on Iran, RAF Fairford and state threats*, **solo contesto per nuova incriminazione**: https://www.gov.uk/government/news/joint-statement-on-iran-12-october

---

**Stato finale della fonte:** 30 schede incrementali proposte, 50 riferimenti web indicizzati, 10 nuove ipotesi H23–H32, rimandi a 10 aree d'indagine del registro H01–H22. Il documento non modifica autonomamente la baseline e non contiene dati personali esfiltrati.
