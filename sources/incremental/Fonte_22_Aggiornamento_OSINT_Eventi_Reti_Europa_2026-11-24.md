---
source_id: S22
created_at: "2026-11-24"
coverage_start: "2026-11-20"
coverage_end: "2026-11-24"
baseline_source: S21
repository_commit: "c1507325bb4877a29ad5530a011fc8a61558f5ad"
language: it
status: proposed
schema_version: "1.1"
---

# Fonte_22 | Aggiornamento OSINT incrementale per l'Europa | 24 novembre 2026

## A. Metadati e metodologia

- Baseline documentale: **S21**, archiviata su main; `coverage_end: 2026-11-23`. Poiché il cutoff non specifica l'ora, la finestra parte dal **20 novembre**, garantendo almeno 72 ore di sovrapposizione anche assumendo la fine del 23 novembre.
- Snapshot main: `c1507325bb4877a29ad5530a011fc8a61558f5ad`. Ricerca effettuata nelle prime ore del 24 novembre, Europe/Rome. Il giorno 24 è parziale.
- Ambiti consultati: sanzioni UE, sicurezza europea, attività ibride e conflitto in Ucraina; ricerca selettiva, **non** esaustiva. Le notizie emerse il 23 novembre sono confrontate con S21 e con le PR aperte (nessuna PR aperta rilevata al controllo).
- E1 = atto o dichiarazione primaria documentata; E2 = attribuzione istituzionale; E3 = verifica giornalistica indipendente; E4 = accusa/rivendicazione non accertata; E5 = ipotesi. E1–E4 non sono una scala ordinale di affidabilità.
- Le informazioni riportate riguardano una **proposta**, non misure già entrate in vigore.

## B. Sintesi

Il **23 novembre 2026** la Commissione europea ha presentato il **22º pacchetto proposto** di sanzioni contro la Russia. La presidente Ursula von der Leyen ha illustrato nuove restrizioni finanziarie e crittografiche, sui collegamenti economici e sulla partecipazione russa a eventi sportivi e culturali nell'UE [R01]. La dichiarazione primaria descrive anche misure su banche, navi della flotta ombra, visti e applicazione delle sanzioni [R01]; Reuters corrobora la presentazione della proposta [R02]. Le misure **non sono state adottate dal Consiglio** alla data delle fonti consultate; richiedono l'accordo degli Stati membri e potrebbero essere modificate.

## C. Registro analitico

### OEM-20261124-001 | NEW_POLICY | Commissione UE: proposta del 22º pacchetto di sanzioni contro la Russia

- **Data evento:** 23 novembre 2026, presentazione della proposta. **Data evidenze:** 23 novembre 2026 [R01,R02].
- **Geografia:** Unione europea, con misure proposte rivolte a soggetti e attività collegati alla Russia e, per alcuni meccanismi, a paesi terzi.
- **Attori:** Commissione europea, presidente Ursula von der Leyen (presentazione); Consiglio dell'UE e Stati membri (futura decisione, non ancora avvenuta); soggetti russi e intermediari finanziari potenzialmente interessati.
- **Condotta E1 [R01]:** la Commissione ha presentato un nuovo pacchetto di proposte restrittive, includendo il divieto di transazioni con circa 60 banche russe, misure su crypto e pagamenti, restrizioni alla partecipazione a eventi sportivi/culturali europei, regole sui visti e maggiore enforcement. La presentazione è un atto istituzionale verificabile; **non** è un atto sanzionatorio già efficace.
- **Dettagli E1 [R01]:** la dichiarazione STATEMENT/26/2563 propone di estendere il divieto di transazioni a circa 60 banche e la loro esclusione da SWIFT, ampliare il divieto di servizi energetici, inserire oltre 70 navi nella lista, vietare l'ingresso agli ex combattenti russi e limitare gli incarichi di cittadini europei negli organi direttivi di aziende russe. Sono proposte descritte dalla Commissione, non atti del Consiglio già efficaci. Reuters [R02] corrobora la presentazione e l'orientamento finanziario della proposta.
- **Autore materiale:** Commissione europea per la presentazione della proposta; nessuna condotta criminale personale oggetto di questo evento.
- **Mandante/sponsor:** non applicabile a un'iniziativa legislativa della Commissione.
- **Movente E1 [R01]:** secondo la Commissione, aumentare la pressione economica sulla Russia in relazione alla guerra contro l'Ucraina. È la motivazione dichiarata, non una dimostrazione di efficacia.
- **Impatto:** **potenziale e non ancora misurabile**. Non attribuire blocchi bancari, esclusioni o sequestri effettivi a misure ancora proposte.
- **Stato giuridico:** proposta politica/legislativa; nessuna approvazione unanime del Consiglio documentata al cutoff.
- **Attribuzioni e limiti:** non trasformare designazioni proposte in colpevolezza penale; non dedurre un collegamento operativo tra banche, atleti, navi o individui soltanto dall'inclusione nello stesso pacchetto.
- **Prove contrarie / caveat:** l'assenza di adozione definitiva impedisce di affermare che i divieti siano già vigenti; eventuali modifiche in negoziato sono da monitorare. Le misure del 16 novembre già archiviate in S16 sono **atti distinti**, non il 22º pacchetto.
- **ID esistenti:** nessun TL-*/EXT-*/G-*/H* canonico è stato attribuito come target univoco in assenza di riconciliazione M6 eseguibile; **nessuna relazione causale** proposta.
- **Nesso europeo:** decisioni UE su dipendenze finanziarie, enforcement, sicurezza economica, infrastrutture energetiche e sostegno all'Ucraina.
- **Proposta di integrazione:** un solo `create_event` come `NEW_POLICY`, `needs_review`, senza ID canonico manuale; verificare la successiva adozione come aggiornamento dello stesso iter e non come nuova adozione fittizia.

## D. Collegamenti documentati e ipotesi

Il collegamento documentato è fra la presentazione della proposta [R01] e la politica sanzionatoria UE verso la Russia. Non sono proposte nuove relazioni G-* né inferenze su coordinamento criminale tra soggetti menzionati nel pacchetto. La precedente tornata di designazioni del 16 novembre è distinta da questa proposta.

## E. Ipotesi e domande aperte

Recuperare i testi formali della proposta, verificare l'elenco definitivo di banche e navi, seguire l'eventuale approvazione e le modifiche del Consiglio. L'impatto economico e la capacità di impedire l'elusione restano domande empiriche, non fatti accertati. Nessuna operazione E5 proposta.

## F. Rettifiche e stati

Nessuna rettifica di dati canonici. **Stato: proposto**, non adottato. Un eventuale aggiornamento normativo successivo richiede nuova evidenza primaria.

## G. Bibliografia

- **R01** Commissione europea, dichiarazione della presidente von der Leyen sul 22º pacchetto di sanzioni, **23 novembre 2026**. https://ec.europa.eu/commission/presscorner/api/files/document/print/en/statement_26_2563/STATEMENT_26_2563_EN.pdf
- **R02** Reuters, “EU Commission proposes ban on Russian athletes, ex-fighters in new Russia sanctions package”, **23 novembre 2026**. https://www.reuters.com/business/finance/eu-commission-proposes-22nd-sanctions-package-russia-2026-11-23/

## H. Rapporto di acquisizione, duplicati e limiti

- **Finestra nominale:** 20–24 novembre 2026 (24 novembre parziale). **Copertura effettiva:** ricerca selettiva su notizie pubblicate il 23 novembre e confronto con la baseline S21.
- **Acquisito:** un aggiornamento di policy documentato da una dichiarazione primaria della Commissione (testo ufficiale STATEMENT/26/2563) e il riscontro indicizzato Reuters; una sola operazione `create_event`.
- **Altri candidati individuati ma non inseriti:** accuse diplomatiche russe contro l'Estonia del 23 novembre, già collegate alla chiusura dei valichi descritta in S15 e prive di nuova prova di condotta; minacce via email a scuole tedesche e danesi del 23 novembre, senza attribuzione operativa e con necessità di ulteriori fonti primarie; operazioni militari ucraine in Libia, per cui la rilevanza europea e la conferma indipendente dei danni richiedono ulteriore istruttoria.
- **Duplicati esclusi:** misure UE del 16 novembre (S16), violazione dello spazio aereo polacco (S21) e precedenti sviluppi estoni (S15). Non confondere la nuova proposta con pacchetti precedenti già approvati.
- **Limiti:** ricerca non esaustiva; testo legislativo completo non acquisito; mancata esecuzione locale di `pnpm validate:sidecars` e `pnpm ingest` per indisponibilità DNS GitHub nella shell; verifica applicativa rimessa a CI e Task C. Nessuna prova di efficacia delle misure, nessun record canonico importato. In revisione del 27 novembre: testo ufficiale R01 recuperato; Reuters verificabile nei risultati indicizzati ma articolo integrale non accessibile; precedente riferimento AP non verificabile rimosso, così come i dettagli non riscontrati nella fonte primaria.
- **Governance:** il merge archivia soltanto fonte e sidecar, non modifica automaticamente `data/`, non approva né pubblica candidati.
