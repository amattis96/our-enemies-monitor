---
source_id: "S21"
created_at: "2026-11-23"
coverage_start: "2026-11-18"
coverage_end: "2026-11-23"
baseline_source: "S20"
repository_commit: "924e99e7ab74bcca29bd0fcd3f0934452295e4db"
language: it
status: proposed
schema_version: "1.1"
---

# Fonte_21 | Aggiornamento OSINT incrementale per l'Europa | 23 novembre 2026

## A. Metadati e metodo

- Baseline: S20, ultima fonte verificata su main, coverage_end 2026-11-21 (solo data, nessun orario).
- Finestra pianificata: 18 novembre fino alle prime ore del 23 novembre 2026 Europe/Rome; overlap di almeno 72 ore anche assumendo la fine del 21 novembre come cutoff.
- Copertura effettiva: ricerca selettiva su fonti polacche, Reuters/AP e istituzioni UE, soprattutto 20-22 novembre. **Non** è una scansione esaustiva di tutti gli ambiti o dell'intera giornata del 23.
- Snapshot main: `924e99e7ab74bcca29bd0fcd3f0934452295e4db`. PR aperte #37 e #42 (editoriali), senza sidecar concorrenti.
- E1 designa atti e comunicazioni primarie sul fatto; E2 valutazioni e attribuzioni istituzionali; E3 giornalismo indipendente; E4 contestazioni non accertate; E5 soltanto ipotesi. E1-E4 non formano una scala ordinale.

## B. Sintesi

Il 20 novembre 2026 tre oggetti sono caduti in Polonia, a Nowy Lipowiec, Rudnik nad Sanem e Mołodycz, durante attacchi russi contro l'Ucraina. L'Ufficio polacco per la sicurezza nazionale (BBN) ha inizialmente identificato un missile Kh-101 nel primo sito, valutando preliminarmente il secondo come missile e il terzo come possibile drone [R01]. La procura di Lublino ha confermato il 21 novembre attività di repertazione nei tre siti, senza chiudere l'identificazione [R02]. Il 22 novembre Reuters ha riportato una successiva comunicazione dei procuratori secondo cui tutti e tre gli oggetti sarebbero missili russi Kh-101 [R04]. **La comunicazione originale della procura del 22 novembre non è stata recuperata**: la classificazione tecnica finale resta da confrontare con l'atto originale.

## C. Registro analitico

### OEM-20261123-001 | NEW_EVENT | Violazione dello spazio aereo polacco del 20 novembre e successive identificazioni

- **Date:** evento 20 novembre 2026; comunicazioni BBN e governo 20 novembre [R01,R03]; aggiornamento della procura 21 novembre [R02]; nuova identificazione riportata da Reuters 22 novembre [R04].
- **Geografia:** Nowy Lipowiec (distretto di Biłgoraj), Rudnik nad Sanem (distretto di Nisko), Mołodycz (distretto di Jarosław), Polonia.
- **Attori:** BBN, governo polacco, procura distrettuale di Lublino e servizi militari come accertatori; forze russe come origine attribuita degli oggetti dalle autorità polacche. Nessun autore materiale individuale identificato.
- **Condotta E1 [R01,R02]:** tre oggetti sono caduti in territorio polacco; le autorità hanno isolato i siti, avviato accertamenti e repertazione. L'identificazione iniziale era differenziata e provvisoria: Kh-101 a Nowy Lipowiec, probabile missile a Rudnik, probabile drone a Mołodycz.
- **Attribuzione E2 [R03]:** il premier Donald Tusk ha dichiarato che gli oggetti provenivano dalla Russia. L'ipotesi di provocazione intenzionale è una valutazione politica, non un accertamento indipendente del movente.
- **Aggiornamento E3 [R04]:** Reuters riferisce che il 22 novembre la procura ha identificato tutti e tre gli oggetti come missili russi Kh-101. Questa informazione aggiorna le identificazioni preliminari, ma la dichiarazione originale del 22 non è stata consultata.
- **Autore materiale:** non identificato individualmente; la provenienza degli ordigni non stabilisce da sola quale unità abbia operato il lancio.
- **Mandante:** non accertato separatamente dall'origine militare attribuita; nessuna specifica catena di comando documentata.
- **Movente:** ignoto. L'intenzionalità della violazione è contestata come possibile provocazione dalle autorità polacche, non provata.
- **Impatto E1 [R02]:** attività di sicurezza e investigazione in tre siti; nessun bilancio umano o materiale quantitativo attribuito in questa proposta.
- **Stato processuale:** indagine tecnica e attività della procura in corso; nessun imputato o condanna identificati nelle fonti consultate.
- **Prove contrarie e limiti:** le classificazioni preliminari del 20-21 novembre non coincidono con l'aggiornamento del 22 riportato da Reuters; non trattare il terzo oggetto come un attacco separato, né la contemporaneità con esercitazioni alleate come prova del movente.
- **ID esistenti:** nessuna corrispondenza univoca TL-*/EXT-*/G-*/H* identificata nella ricerca nominale su main; il matcher M6 deve deduplicare prima di allocare ID. Nessuna relazione G-* proposta.
- **Nesso europeo:** violazione del territorio di uno Stato UE/NATO, sicurezza della frontiera orientale e rischio di escalation.
- **Integrazione proposta:** un solo `create_event` con data della condotta 20 novembre, attribuzioni separate, stato `needs_review`; non creare tre eventi per i tre oggetti.

## D. Collegamenti documentati e ipotesi

[R03] collega temporalmente la violazione agli attacchi contro l'Ucraina e alla risposta polacca. Non è dimostrato che il calendario delle esercitazioni militari alleate abbia causato o motivato l'episodio. Nessuna relazione causale o di comando è proposta.

## E. Ipotesi e domande aperte

Recuperare il comunicato originale della procura del 22 novembre; verificare modello, provenienza, traiettorie e punti di impatto dei tre oggetti; stabilire se esista una conclusione ufficiale sull'intenzionalità. Nessuna operazione E5 è proposta.

## F. Rettifiche e stati

La classificazione iniziale del 20 novembre era provvisoria. La notizia Reuters del 22 novembre, se confermata dall'atto originale, aggiorna la tipologia di tutti e tre gli oggetti a Kh-101. Non è proposta una rettifica di record canonici esistenti senza un target verificato.

## G. Bibliografia

- **R01** Biuro Bezpieczeństwa Narodowego, “Naruszenie polskiej przestrzeni powietrznej. Komentarz Szefa BBN”, 20 novembre 2026. https://www.bbn.gov.pl/pl/wydarzenia/10584,Naruszenie-polskiej-przestrzeni-powietrznej-Komentarz-Szefa-BBN.html
- **R02** Prokuratura Okręgowa w Lublinie, “Aktualny stan czynności procesowych w sprawie ujawnienia obiektów latających na terenie województwa lubelskiego i podkarpackiego”, 21 novembre 2026. https://www.gov.pl/web/po-lublin/aktualny-stan-czynnosci-procesowych-w-sprawie-ujawnienia-obiektow-latajacych-na-terenie-wojewodztwa-lubelskiego-i-podkarpackiego
- **R03** Kancelaria Prezesa Rady Ministrów, “Rosyjskie obiekty naruszyły polską przestrzeń powietrzną. Kolejna odsłona rosyjskiej eskalacji”, 20 novembre 2026. https://www.gov.pl/web/premier/rosyjskie-obiekty-naruszyly-polska-przestrzen-powietrzna-kolejna-odslona-rosyjskiej-eskalacji
- **R04** Reuters, “Three Russian missiles flew into Poland Friday, prosecutors say”, 22 novembre 2026. https://www.reuters.com/world/three-russian-missiles-flew-into-poland-friday-prosecutors-say-2026-11-22/

## H. Rapporto di acquisizione

- Finestra nominale: 2026-11-18 / 2026-11-23, ultimo giorno parziale; effettiva: fonti selettive 20-22 novembre.
- Candidati esaminati: violazione aerea polacca, accesso non autorizzato al sito del ministero degli Esteri austriaco, sviluppi danesi del caso PET, sanzioni UE.
- Acquisito: 1 evento polacco, con 3 luoghi di caduta e aggiornamento probatorio, non 3 eventi.
- Esclusi: caso danese già trattato in S20, sanzioni UE del 16 novembre già in S16; incidente austriaco non incluso per mancanza del comunicato primario nel campione consultato.
- Deduplicazione: ricerca nominale GitHub senza riscontri; non equivale a riconciliazione esaustiva di ogni record.
- Limiti: nessuna verifica locale pnpm, atto primario polacco del 22 novembre non recuperato, ricerca selettiva; le operazioni M6 restano candidate e richiedono controllo CI e revisione C.
- I documenti archiviati non importano automaticamente `data/` e non costituiscono approvazione editoriale.
