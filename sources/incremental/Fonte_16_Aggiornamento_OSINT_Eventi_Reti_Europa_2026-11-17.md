---
source_id: "S16"
created_at: "2026-11-17"
coverage_start: "2026-11-13"
coverage_end: "2026-11-17"
baseline_source: "S15"
repository_commit: "dc7ee7cc006d8149f88197831660ddadfb0cd06e"
language: it
status: proposed
schema_version: "1.1"
---

# Fonte_16 | Aggiornamento OSINT incrementale per l'Europa | 17 novembre 2026

## A. Metadati e metodo
Baseline verificata: Fonte_15 (S15), integrata in main alla HEAD `dc7ee7cc006d8149f88197831660ddadfb0cd06e`, con `coverage_end: 2026-11-16` e senza ora specificata. Finestra pianificata 13–17 novembre 2026 (almeno 72 ore di sovrapposizione sulle date); ricerca effettiva focalizzata sulle pubblicazioni del 16 novembre, fino alle prime ore del 17 novembre Europe/Rome. Le date del 17 novembre non indicano copertura integrale della giornata. Nessuna PR aperta nella ricognizione iniziale GitHub. E1 indica atti/decisioni ufficiali; E2 attribuzioni istituzionali; E3 indagini indipendenti; E4 accuse non accertate; E5 ipotesi. E1–E4 non sono una scala ordinale di affidabilità.

## B. Sintesi
Il 16 novembre 2026 il Consiglio UE ha approvato due distinti gruppi di nuove designazioni: **30 persone e due entità** nei regimi relativi alle attività ibride/FIMI e ai cyberattacchi; **12 persone e 101 entità** nel regime di misure per l'integrità territoriale ucraina. I numeri sono riferiti a regimi giuridici diversi e non vanno interpretati come conteggio di nuovi attacchi. Il primo pacchetto include Social Design Agency e NoName057(16); il secondo interessa banche, energia, e-commerce e filiera petrolifera/flotta ombra. Si tratta di provvedimenti UE verificabili, non di condanne penali individuali.

## C. Registro analitico

### OEM-20261117-001 | NEW_POLICY | Designazioni UE per FIMI russa e cyberattacchi
- **Condotta/atto, E1:** il Consiglio UE ha adottato il 16 novembre misure restrittive contro 30 persone e due entità, ripartite nei regimi delle attività destabilizzanti russe e dei cyberattacchi. La decisione 2026/2556 riguarda 30 persone e un'entità nel primo regime; la decisione 2026/2546 riguarda il regime cyber. Non duplicare il conteggio tra atti e comunicato aggregato [R01–R03].
- **Date:** atto 2026-11-16; pubblicazione 2026-11-16; **geografia:** Unione europea; **attori:** Consiglio UE, Social Design Agency (SDA), NoName057(16), persone elencate negli atti.
- **Attribuzioni distinte, E2:** secondo il Consiglio, SDA opera campagne FIMI dirette/supervisionate dall'amministrazione presidenziale russa, con bersagli europei e il contesto delle elezioni europee 2024. Secondo il Consiglio, NoName057(16) ha rivendicato attacchi DDoS contro servizi e infrastrutture in Stati UE. L'atto di designazione è E1; le ricostruzioni di condotte, controllo e committenza restano attribuzioni istituzionali E2, non sentenze penali [R01–R03].
- **Autore materiale:** non stabilito per ogni singolo attacco; **sponsor:** attribuzione UE a reti russe per le attività FIMI; **movente:** non inferire motivazioni personali; **impatto:** congelamento dei beni e restrizioni finanziarie/di viaggio secondo regime, non prova di disservizi quantificati.
- **Prove contrarie/limiti:** non sono state analizzate le difese individuali di tutti i designati; gli atti non provano automaticamente un unico coordinamento fra SDA e NoName057(16). Le campagne preesistenti non sono nuovi eventi del 16 novembre.
- **Record esistenti:** nessun nuovo ID canonico assegnato; collegamenti tematici da verificare in sede di ingest, non creare archi causali automatici.
- **Rilevanza europea e proposta:** risposta giuridica UE a FIMI e cyber; `create_event` per l'adozione delle misure, `needs_review`.

### OEM-20261117-002 | NEW_POLICY | Ulteriori 113 designazioni UE per finanza e filiera petrolifera russa
- **Condotta/atto, E1:** il Consiglio UE ha aggiunto il 16 novembre **12 persone e 101 entità** nel quadro delle misure connesse all'integrità territoriale dell'Ucraina. Il comunicato individua quasi 50 banche e istituzioni finanziarie russe, soggetti nell'e-commerce (Wildberries e Ozon), operatori dell'energia e raffinerie, imprese connesse alla compravendita di petrolio russo e alla flotta ombra [R04].
- **Date:** adozione e pubblicazione 2026-11-16; **geografia:** UE e soggetti designati in Russia e paesi terzi; **attori:** Consiglio UE, soggetti giuridici individuati negli allegati ufficiali.
- **Attribuzioni e limiti, E2:** la motivazione istituzionale collega le designazioni a settori che forniscono entrate e supporto allo sforzo bellico russo; non equivale a dimostrazione di partecipazione penale di ciascun soggetto alla guerra [R04].
- **Autore materiale:** non applicabile al provvedimento; **sponsor:** non applicabile; **movente:** obiettivo politico dichiarato di ridurre capacità finanziaria russa; **impatto:** congelamento beni, divieto di mettere risorse a disposizione e divieti di viaggio per le persone designate, senza quantificazione degli effetti economici realizzati.
- **Prove contrarie/limiti:** non verificati gli effetti economici futuri; non sono state esaminate singolarmente le posizioni e le eventuali contestazioni dei 113 designati. Reuters riferisce un aggregato di 145 designazioni, coerente con 113 + 32, ma non è un terzo pacchetto autonomo [R05].
- **Record esistenti:** nessun ID canonico inventato; collegamenti a reti di sanzioni e dipendenze da valutare, senza automatismi.
- **Rilevanza europea e proposta:** nuove misure UE su finanza, energia e flotta ombra; `create_event` per l'atto, `needs_review`.

## D. Collegamenti e caveat
Le due decisioni appartengono alla stessa giornata istituzionale, ma operano in regimi sanzionatori diversi. Non è documentato che le reti FIMI, i gruppi DDoS e le imprese della flotta ombra costituiscano una singola organizzazione o siano coordinati fra loro. Nessuna relazione di grafo proposta.

## E. Ipotesi e domande aperte
Verificare in successiva analisi gli allegati nominativi, eventuali impugnazioni, l'esecuzione delle misure negli Stati membri e la sovrapposizione con entità canoniche esistenti. Sono domande, non nuove ipotesi E5 inseribili automaticamente.

## F. Rettifiche e stati
Nessuna rettifica canonica proposta. Distinguere le **32** designazioni del pacchetto ibrido/cyber dalle **113** del regime Ucraina; la somma **145** riportata da Reuters è un aggregato, non un ulteriore provvedimento. L'adozione delle misure non costituisce condanna penale.

## G. Bibliografia
- **[R01]** Russia’s FIMI and malicious cyber activities: Council imposes sanctions on 30 individuals and two entities. Consiglio dell'Unione europea, 2026-11-16. https://www.consilium.europa.eu/en/press/press-releases/2026/11/16/russia-s-fimi-and-malicious-cyber-activities-council-imposes-sanctions-on-30-individuals-and-two-entities/
- **[R02]** Council Decision (CFSP) 2026/2556 of 16 November 2026. Gazzetta ufficiale dell'Unione europea / EUR-Lex, 2026-11-16. https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=OJ:L_202602556
- **[R03]** Council Decision (CFSP) 2026/2546 of 16 November 2026. Gazzetta ufficiale dell'Unione europea / EUR-Lex, 2026-11-16. https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=OJ:L_202602546
- **[R04]** Ukraine: EU lists 113 individuals and entities to further restrict Russia’s ability to finance its war of aggression. Consiglio dell'Unione europea, 2026-11-16. https://www.consilium.europa.eu/en/press/press-releases/2026/11/16/ukraine-eu-lists-113-individuals-and-entities-to-further-restrict-russia-s-ability-to-finance-its-war-of-aggression/pdf/
- **[R05]** EU expands Russia sanctions list by 145 names and entities. Reuters, 2026-11-16. https://www.reuters.com/business/finance/eu-expands-russia-sanctions-list-by-145-names-entities-2026-11-16/

## H. Rapporto di acquisizione
- Finestra programmata: 2026-11-13–2026-11-17 (giorno finale parziale), basata su S15 fusa in main. Copertura effettiva: ricognizione mirata delle novità del 16 novembre; non equivale a una scansione esaustiva di tutti i paesi e ambiti.
- Ricerca: comunicati Consiglio UE 16 novembre, atti EUR-Lex 2026/2556 e 2026/2546, confronto Reuters sulle 145 designazioni; verifica main e PR aperte.
- Materiale nuovo: due atti/pacchetti distinti, due operazioni di evento proposte.
- Deduplicazione: FIMI, DDoS e flotta ombra già presenti come temi storici non vengono convertiti in nuovi attacchi; le 145 designazioni Reuters non sono un terzo evento.
- Scarti: attacchi di droni del 14 novembre e misure estoni già in S15; proposta di prestito UE ancora prospettica, senza atto adottato; affermazioni su capacità militari non corroborate indipendentemente.
- Limiti: niente analisi nominativa integrale di tutti gli allegati, niente stima d'impatto economico, nessuna attribuzione individuale oltre le motivazioni ufficiali. Nessuna modifica a data/ o approvazione editoriale.
