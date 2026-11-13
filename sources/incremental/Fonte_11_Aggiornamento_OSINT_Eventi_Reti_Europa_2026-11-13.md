---
source_id: "S11"
created_at: "2026-11-13"
coverage_start: "2026-11-08"
coverage_end: "2026-11-13"
baseline_source: "S09"
repository_commit: "634a9d9a3773e26d7b7968b32d14f2d23d619909"
language: it
status: proposed
schema_version: "1.0"
---

# Fonte_11 | Aggiornamento OSINT incrementale per l'Europa | 13 novembre 2026

**Fonte archivistica proposta, non integrata nei dati canonici.** Ricerca conclusa nelle prime ore del 13 novembre (Europe/Rome). La giornata del 13 novembre non è interamente coperta. Le attribuzioni e gli effetti sono valutati per singola affermazione; nessuna approvazione editoriale implicita.

## A. Metadati e finestra

- **Baseline effettiva in `main`:** Fonte_09 (S09), `cutoff_at: 2026-11-11T23:00:00+01:00`. Sovrapposizione di almeno 72 ore: dalle **23:00 CET dell'8 novembre**; il campo `coverage_start` usa il giorno civile che contiene l'inizio della finestra.
- **Snapshot `main`:** `634a9d9a3773e26d7b7968b32d14f2d23d619909`. Fonte_10 (S10) è presente esclusivamente nella **PR aperta #3** e non avanza la baseline. PR aperte #9 (articolo VoE/Gill) e #10 (fonte tematica industria/energia) consultate per evitare sovrapposizioni.
- **Ambito:** nuove evidenze e sviluppi di attacchi, intimidazioni e destabilizzazione contro servizi e istituzioni europee. Fatti, attribuzioni e ipotesi restano separati.
- **Criterio:** aggiungere soltanto un aggiornamento di un episodio già acquisito, non contare la nuova giornata di minacce come un secondo cluster indipendente senza prova di autonomia operativa.

## B. Sintesi

**Un aggiornamento sostanziale e verificabile**: il 12 novembre si è ripetuta in Italia la campagna di email contenenti falsi allarmi bomba contro istituti scolastici, già registrata nella Fonte_09 per l'11 novembre. Una comunicazione di Palazzo Chigi riportata testualmente da ANSA ha quantificato **3.778 scuole raggiunte (dato provvisorio), 77 evacuate, 36 con ripresa delle lezioni nella stessa mattinata**. Il Ministero dell'Istruzione ha diffuso un'indicazione ufficiale secondo cui la sola ricezione di email massive non giustifica l'evacuazione in assenza di ulteriori elementi concreti di pericolo. L'indagine sull'origine dei messaggi non consente un'attribuzione statale. L'aggiornamento riguarda la **risposta istituzionale e la dimensione del secondo giorno**, non un nuovo attentato provato.

## C. Registro strutturato

### OEM-20261113-001 | EVENT_UPDATE | Seconda giornata di minacce massive alle scuole italiane e risposta istituzionale

- **Data dell'evento:** 12 novembre 2026; **pubblicazione delle evidenze:** 12 novembre 2026; **acquisizione:** 13 novembre 2026 (CET).
- **Geografia:** Italia, scuole in più regioni; riferimenti a comunicazioni simili in Irlanda e Regno Unito da considerare come contesto e non come attribuzione transnazionale dimostrata.
- **Attori e ruoli:** mittente reale ignoto; la firma «Mikhail Andropov» è un'identità dichiarata nel messaggio, non un'identificazione personale verificata. Presidenza del Consiglio, Ministero dell'Istruzione e del Merito, Prefetture e dirigenti scolastici sono soggetti della risposta pubblica. Nessun mandante o finanziatore identificato.
- **Collegamenti esistenti:** `EXT-009` (cluster degli allarmi contro scuole), `EXT-013` (contesto delle intimidazioni italiane) e `H26` (ipotesi di infrastruttura condivisa con le minacce all'aviazione). Fonte_09 `OEM26-009` descrive già la giornata dell'11 novembre e oltre 6.300 scuole raggiunte. **Non creare un secondo evento autonomo solo per la data 12 novembre.**
- **Affermazione A, E1/E2:** il comunicato della Presidenza del Consiglio, ripreso direttamente da ANSA, riporta **3.778** scuole raggiunte il 12 novembre, **77** evacuate, **36** con ripresa delle attività nella stessa mattinata. Il dato è espressamente *provvisorio*. **Caveat:** il titolo ANSA contiene «3.788», ma il testo della nota governativa riprodotta dice «3.778»; usare quest'ultimo come dato attribuito alla nota, annotando la discordanza editoriale e richiedendo un originale ufficiale prima di considerarlo definitivo [R01].
- **Affermazione B, E1:** la comunicazione del Ministero dell'Istruzione pubblicata da un ufficio scolastico territoriale il 12 novembre precisa che email massive non determinano da sole l'evacuazione; il Prefetto può disporla quando emergono elementi specifici e concreti di rischio [R02].
- **Affermazione C, E3:** Reuters e AP descrivono la ripetizione delle minacce, il contesto internazionale e l'assenza di prove pubbliche che identifichino uno Stato mandante. La comparsa di uno pseudonimo non è una prova di origine russa [R03, R04].
- **Affermazione D, E3 (status giudiziario):** secondo il resoconto ANSA del 12 novembre la Procura di Roma ha avviato accertamenti su minacce e procurato allarme. Un'indagine non costituisce identificazione dell'autore né accertamento di responsabilità [R05].
- **Attribuzione, contestazioni e limiti:** non sono pubblici header verificati, log SMTP, indicatori forensi, ordigni rinvenuti o documenti giudiziari che dimostrino la responsabilità di un governo. L'ipotesi di coordinamento con gli allarmi all'aviazione resta **E5**, confinata a `H26`. Il contesto di attacchi ibridi europei non consente di attribuire questo episodio alla Russia.
- **Impatto europeo:** interruzioni/evacuazioni di servizi educativi e mobilitazione delle autorità italiane; possibile contesto transnazionale da verificare separatamente. Nessun impatto causale sul consenso politico o su decisioni strategiche dimostrato.
- **Proposta di integrazione:** aggiornare editorialmente l'evento `EXT-009` con il secondo giorno e la risposta istituzionale, dopo controllo dei documenti primari; aggiungere i riferimenti bibliografici. Non creare nuove relazioni di comando o finanziamento, non modificare `H26` in relazione accertata, non alterare stati `review`.

## D. Collegamenti documentati e ipotesi

**Documentato:** Fonte_09 già censisce il cluster dell'11 novembre; le comunicazioni del 12 novembre documentano una successiva ondata di email minatorie e la reazione amministrativa. **Non documentato:** che lo stesso operatore tecnico abbia inviato tutte le email, che gli allarmi aerei siano stati orchestrati insieme a quelli scolastici o che un servizio d'intelligence straniero ne sia il mandante. La firma condivisa può essere copiata e non stabilisce identità operativa.

## E. Ipotesi e domande aperte

1. `H26`: gli header, i server e i pattern di invio dei messaggi alle scuole e ai voli mostrano un'infrastruttura condivisa? Servono dati forensi pubblicabili e riscontri delle autorità.
2. Il conteggio finale ufficiale del 12 novembre confermerà 3.778 istituti e 77 evacuazioni? Risolvere la discrepanza tra titoli e testo del comunicato.
3. Quale status giudiziario avranno gli accertamenti della Procura di Roma? Non anticipare imputazioni, arresti o responsabilità.

## F. Rettifiche, stati e cautele

- **Numeri:** il dato governativo riportato nel corpo del comunicato è *3.778*; alcune titolazioni usano *3.788*. Registrare la discordanza, non presentare la cifra come definitivamente consolidata.
- **Cronologia:** gli oltre 6.300 istituti della Fonte_09 si riferiscono all'11 novembre, i 3.778 provvisori al 12 novembre. Non sommare i due numeri per stimare scuole uniche.
- **Responsabilità:** nessuna attribuzione statale accertata; pseudonimo e lingua del messaggio non identificano l'autore.
- **Procedimento:** indagini riferite dai media, non condanne o contestazioni definitive.
- **Stato archivistico:** questa fonte non è integrata finché la PR non viene fusa in `main`; non è stato eseguito ingest.

## G. Bibliografia

- **[R01]** ANSA, 12 novembre 2026, *Palazzo Chigi, allarmi bomba in 3.788 scuole, solo 77 evacuate* (nel testo della nota riprodotta: **3.778**): https://videoembed.ansa.it/sito/notizie/topnews/2026/11/12/palazzo-chigi-allarmi-bomba-in-3.788-scuole-solo-77-evacuate_e567b621-89f3-47df-9f8a-d407f893ea25.html
- **[R02]** Ministero dell'Istruzione e del Merito, comunicazione ripubblicata dall'Ufficio scolastico territoriale di Savona, 12 novembre 2026, *Mail massive alle scuole*: https://www.istruzionesavona.gov.it/pagine/mail-massive-alle-scuole
- **[R03]** Reuters, 12 novembre 2026, *Italian schools defy new wave of bomb threats to remain open*: https://www.reuters.com/world/europe/italys-meloni-seeks-curb-hoax-bomb-evacuations-2026-11-12/
- **[R04]** Associated Press, 11 novembre 2026, *Italy's Meloni says cyberthreats are intended to spread fear after schools hit by bomb threat*: https://apnews.com/article/0f312fda4ee2e9cdcebd0d6e1a40d9e8
- **[R05]** ANSA, aggiornamenti del 12 novembre 2026, *Nuovi allarmi bomba nelle scuole*, incluse comunicazioni governative e notizie sul fascicolo d'indagine: https://videoembed.ansa.it/sito/notizie/cronaca/2026/11/12/nuovo-allarme-bomba-nelle-scuole-indagano-i-pm-dellantiterrorismo-liveblog_97a3c6b7-93f4-44a2-940b-dd33198f2f91.html
- **[R06]** Regione Piemonte, 11 novembre 2026, *Allarme bomba nelle scuole, 463 segnalazioni in Piemonte*: https://www.regione.piemonte.it/web/pinforma/notizie/allarme-bomba-nelle-scuole-463-segnalazioni-piemonte-presidente-cirio-vigili-pronti-ad-intervenire

## H. Report di acquisizione e deduplicazione

- **Finestra:** 2026-11-08 23:00 CET – 2026-11-13, prime ore CET; overlap di 72 ore rispetto a Fonte_09. `main` conserva solo S09; S10 in PR #3 non è baseline.
- **Esito:** 1 aggiornamento documentale selezionato, 0 nuovi incidenti autonomi proposti, 0 nuove attribuzioni statali, 0 relazioni accertate aggiunte.
- **Scarti/duplicati:** Polonia (arresti e accuse), Regno Unito (arresto militare e sanzioni), nave nel Golfo di Finlandia, dichiarazione UE di Dublino, minaccia norvegese e osservazione elettorale gagauza sono già nella PR #3. La fonte tematica industria/energia è già nella PR #10. Le notizie del 12 novembre sui negoziati e sulle sanzioni prospettate non vengono ricontate come adozioni normative.
- **Limiti:** non verificati in questa scansione gli header delle email, i fascicoli giudiziari originali e un testo primario integrale del comunicato numerico della Presidenza del Consiglio; i numeri governativi sono riprodotti da ANSA. La ricognizione web è selettiva, non garantisce esaustività di ogni pubblicazione della finestra.
- **Prossimo passaggio:** revisione umana del dato numerico e degli atti primari; eventuale importazione separata, mai automatica, attraverso il workflow editoriale. Nessuna modifica a `data/`, `sources/original/`, fonti precedenti o stati di pubblicazione.
