---
source_id: "S19"
created_at: "2026-11-20"
coverage_start: "2026-11-16"
coverage_end: "2026-11-20"
baseline_source: "S18"
repository_commit: "e6c26164ee74d4f33bad6613ea344f932332f86d"
language: it
status: proposed
schema_version: "1.1"
---

# Fonte_19 | Aggiornamento OSINT incrementale per l'Europa | 20 novembre 2026

## A. Metadati e metodo

- **Baseline:** Fonte_18 (S18), archiviata in `main`, `coverage_end: 2026-11-19` senza orario. Ricerca con sovrapposizione conservativa dal 16 novembre, almeno 72 ore rispetto al cutoff del 19 novembre.
- **Finestra nominale:** 16–20 novembre 2026; **orizzonte effettivo:** 20 novembre ore 00:34 CET, con ricerche mirate sui comunicati e sulla stampa del 19 novembre. Non si attesta una ricognizione esaustiva di ogni settore e di ogni giorno.
- **Snapshot:** `main` e6c26164ee74d4f33bad6613ea344f932332f86d; PR aperte #37 (editoriale, flotta ombra) e #39 (test ingest), nessuna PR incrementale aperta al controllo. S12–S18 già archiviate; dati canonici consultati senza modifica.
- **Criterio:** E1 per dichiarazioni primarie effettivamente rese, E2 per attribuzioni istituzionali, E3 per reporting originale indipendente, E4 per accuse non accertate, E5 per ipotesi. Non è una graduatoria ordinale. La dichiarazione di una vittima non è una prova forense dell'identità dell'aggressore.

## B. Sintesi

Il 19 novembre la Commissione europea ha confermato pubblicamente di aver rilevato il 22 ottobre una campagna informatica condotta con strumenti di intelligenza artificiale, confermata dopo un primo accertamento il 26 ottobre. Alcune applicazioni sono state temporaneamente disattivate per precauzione e in larga parte ripristinate. La Commissione non ha attribuito l'attacco a uno Stato o gruppo, non ha quantificato l'estensione e non ha rilevato prove di una violazione dei dati che coinvolga il personale nel suo complesso. Il fatto è significativo per la sicurezza delle istituzioni UE, ma **non** è una prova di un'operazione russa, cinese o di altra origine [R01–R03].

## C. Registro analitico

### OEM-20261120-001 | NEW_EVENT | Campagna cyber contro la Commissione europea, rivelata il 19 novembre

- **Condotta e date:** campagna rilevata il **22 ottobre 2026** e confermata dopo accertamenti preliminari il **26 ottobre 2026**; comunicazione pubblica il **19 novembre 2026**. La data d'inizio effettivo degli accessi e quella di cessazione non sono note [R01].
- **Luogo e attori:** infrastrutture digitali della Commissione europea, Bruxelles/UE; Commissione come organizzazione bersaglio. **Autore materiale, mandante, sponsor e movente:** ignoti; nessuna attribuzione statale pubblica [R01–R03].
- **Fatto documentato, E1 [R01]:** nella conferenza stampa ufficiale del 19 novembre, il portavoce Thomas Regnier ha confermato una campagna informatica che ha utilizzato strumenti AI e la temporanea disattivazione preventiva di diverse applicazioni, in gran parte ripristinate. Ha dichiarato che l'indagine è in corso e che la portata non può ancora essere qualificata.
- **Valutazione istituzionale, E2 [R01]:** secondo la Commissione non sono state rilevate, allo stato, prove di un data breach che interessi il personale nel complesso. Questa è un'assenza di evidenze finora rilevate, **non** una certificazione dell'assenza di ogni accesso o esfiltrazione.
- **Reporting indipendente, E3 per l'esistenza delle dichiarazioni [R02, R03]:** Reuters e AP riportano la conferma e i limiti. Le indiscrezioni su sistemi del personale, durata di almeno dieci giorni e quantità di dati eventualmente compromessi non sono state confermate dal portavoce; non vengono importate come fatti.
- **Impatto documentato, E1 [R01]:** indisponibilità precauzionale temporanea di alcune applicazioni; numero di utenti, sistemi e danni non quantificati. La maggioranza delle applicazioni risulta ripristinata al momento della conferenza.
- **Prove contrarie e caveat:** la Commissione non ha identificato pubblicamente l'attaccante; non ha confermato una richiesta di riscatto; l'indagine resta aperta. L'uso di strumenti AI non identifica il paese d'origine, il software preciso o la tecnica d'intrusione [R01–R03].
- **Record preesistenti:** nessun match univoco assegnato; nessun legame causale con altri eventi cyber del corpus. Il controllo deterministico dell'ingest dovrà comunque verificare titolo, data e URL.
- **Nesso europeo:** sicurezza delle istituzioni UE e continuità dei loro servizi informatici.
- **Proposta:** una sola operazione `create_event`, stato candidato `needs_review`; nessuna relazione, entità personale o ipotesi E5.

## D. Collegamenti potenziali e limiti

- **Documentato:** la campagna riguarda sistemi della Commissione europea e ha richiesto misure precauzionali [R01].
- **Non documentato:** un nesso operativo con Russia, Cina, Iran, gruppi noti, altre campagne europee o il prodotto AI specifico. Non creare archi di attribuzione o coordinamento.

## E. Ipotesi e domande aperte

- Quali applicazioni e dataset risultano effettivamente interessati, con quali date e verifiche forensi?
- La Commissione pubblicherà un rapporto tecnico, notifiche privacy o un'attribuzione motivata?
- Nessuna ipotesi E5 viene proposta per l'ingestione in mancanza di basi sufficienti.

## F. Rettifiche e stato procedurale

- **19 novembre:** indagine ancora in corso, scala e responsabilità non definite. La formula «nessuna prova di violazione dei dati del personale nel complesso» non equivale a «nessun dato compromesso».
- Nessuna rettifica canonica proposta; evitare di assimilare le notizie non confermate di Politico a un accertamento istituzionale.

## G. Bibliografia

- **R01** Commissione europea, Servizio audiovisivo, «EC Midday press briefing of 19/11/2026», 19-11-2026 (trascrizione del portavoce Thomas Regnier). https://audiovisual.ec.europa.eu/de/media/video/I-298222
- **R02** Reuters, Sudip Kar-Gupta, «EU Commission confirms it was targeted in cyberattack through use of AI tools», 19-11-2026. https://www.reuters.com/legal/litigation/eu-commission-targeted-cyberattack-politico-reports-2026-11-19/
- **R03** Associated Press, «A cyberattack using artificial intelligence targeted the EU in October, official says», 19-11-2026. https://apnews.com/article/79705095e8141cd650196dbff1cf3c70

## H. Acquisizione, deduplicazione e scarti

- **Query/ambiti:** cyberattacco Commissione 22 ottobre, conferenza stampa 19 novembre, AI-generated cybercampaign, fonti istituzionali e Reuters/AP; ricerche ulteriori su sanzioni UE, guerra in Ucraina e minacce ibride. Copertura selettiva e non esaustiva.
- **Acquisito:** un evento storico con nuova conferma pubblica primaria del 19 novembre. Data della condotta distinta dalla data di disclosure.
- **Scarti/doppioni:** sanzioni UE del 16 novembre già in S16; finanziamento UE all'Ucraina del 18 novembre già in S18; indiscrezioni su esfiltrazione e attribuzioni statali non dimostrate escluse; altri sviluppi diplomatici non acquisiti senza verifica sufficiente.
- **Limiti tecnici:** shell locale priva di DNS GitHub; test pnpm non eseguibili qui. La struttura del sidecar deve essere verificata dai check `check` ed `evidence-diff` sulla HEAD della PR e dalla revisione indipendente Task C. La fonte fusa non importa automaticamente `data/`.
