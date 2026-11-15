# B18 — ADR e pilot Case / Claim: analisi

Data: 15 novembre 2026 (Europe/Rome). Ramo `audit/fable-2026-11-implementation`; HEAD iniziale `faafdf8` (B17). Esecuzione non sorvegliata su mandato del manutentore. Nessun fetch o API esterna; nessun documento esterno letto; `sources/`, `data/` e `provenance` intatti.

Fonti rilette: scheda B18 (§3) e tabella ADR (§4) di [IMPLEMENTATION_BLOCKS.md](../IMPLEMENTATION_BLOCKS.md); FABLE A §4.2, §A6, §7.1, §10 (P6, P8, P9, P10); FABLE B V9; FABLE C §5.2; FABLE D §11.3–11.4; CONSOLIDATED_FINDINGS CF-013, CF-014 e M3; analisi B03 (D-B03-6), B13 (D-B13-6), B17. Formato: B17.

## 1. Stato verificato

| Punto | Stato all'ingresso |
| --- | --- |
| Raccolta delle decisioni | Nessuna cartella ADR: le decisioni stanno nelle analisi dei blocchi (ADR-02 in B03, ADR-05 in B17, ADR-09/10 in B13) |
| Caso / claim | Assenti dal modello; ARCHITECTURE.md «Not yet modeled»: introdotti solo quando esistono dati veri |
| Livello / stato | Coppie E1–E4 ↔ `evidence_status` vincolanti dal B03, «in attesa di ADR-04» |
| `refuted` / `closed_insufficient` | Già nel vocabolario delle ipotesi (`HYPOTHESIS_STATUSES`), mai usati |
| `TL-0015` / `TL-0092` | Pagamenti 2018–2019 (anno) e condanna 2025-11 (mese); fonte S01; relazioni G-0014, G-0015 in entrambi gli eventi; G-0138, G-0287 con URL CPS registrato su `P03` |
| `TL-0059` | Una frase con fatto, attribuzione polacca e smentita russa; fonte S03; G-0223 (PL LOCATION, E1), G-0224 (RU OFFICIAL_ATTRIBUTION, E2) |
| Persone collegate | GILL (stato: condannato con pena, 2025-11, P03); VOL e MED senza stato procedurale datato con fonte primaria registrata (S01 e limite M5 di G-0139: «charged/wanted») |
| Export `v1` | Tutti i file di `schemas/` sono pubblicati in `data/v1/schemas/`; i file di dati derivano solo dal Dataset canonico |

## 2. Piano file per file

| File | Intervento |
| --- | --- |
| `docs/audit/fable-2026-11/adr/ADR-04_*.md`, `ADR-06_*.md`, `ADR-10_*.md` (nuovi) | Tre ADR, stato «Proposta (non sorvegliata, da confermare)» |
| `src/model/vocabularies.ts` | `CLAIM_KINDS`, `CLAIM_ASPECTS`, `PROCEDURAL_STATUSES` |
| `src/model/cases.ts` (nuovo), `src/model/index.ts` | Zod `Case`, `Claim`, `PersonStatus`, `TranscribedFrom`, `CasePilotFile` con `.describe()` |
| `src/cli/schemas.ts` | Emette `schemas/cases.schema.json`, `schemas/claims.schema.json` |
| `src/site/vocabulary.ts` | Sezioni `claim_kinds`, `claim_aspects`, `procedural_statuses` (regola B13) |
| `src/editorial/cases.ts` (nuovo) | `validateCasePilot` e query `queryClaims`, `caseLanes`, `denialsOf`, `casesOf` |
| `src/cli/validate.ts` | Controllo del pilota nello stesso run di `pnpm validate` |
| `docs/audit/cases/pilot.v1.json` (nuovo) | 2 casi, 5 claim, tutti `needs_review` |
| `test/cases.test.ts` (nuovo), `test/ingest.test.ts` | 10 test; copia del pilota nella radice temporanea del test CLI (come per il registro B15) |
| Documentazione | ARCHITECTURE.md (layout, sezione «Case/Claim pilot», regola 15, regola 10 e vocabolario), AGENTS.md («Adding or correcting data») |

Fuori perimetro: pagine (Fascicolo del caso = B19), collezioni canoniche in `data/`, esportazione dei claim, coda delle acquisizioni (A §A6), correzione del trattamento ordinale nel diff.

## 3. Ricostruzione dei casi

| Claim | Caso | Tipo / aspetto | Trascritto da | Livello | Note |
| --- | --- | --- | --- | --- | --- |
| CL-0001 | CASE-0001 | fact / occurrence | TL-0015 `description`, `evidence_note` | null | G-0015 (E1) e G-0138 (E3) portano affermazioni diverse: nessun livello copiato |
| CL-0002 | CASE-0001 | judgment / perpetrator | TL-0092 `description`, `date`; P03 `title` | E1 (G-0287) | `asserted_by` null: il tribunale non è un record; definitività non registrata |
| CL-0003 | CASE-0002 | fact / occurrence | TL-0059 `title`, `description`, `date` | null | — |
| CL-0004 | CASE-0002 | attribution / sponsor | TL-0059 `description`, `evidence_note` | E2 (G-0224) | `asserted_by` PL («governo polacco»); data dell'attribuzione non registrata |
| CL-0005 | CASE-0002 | denial / sponsor | TL-0059 `description`, `evidence_note` | null | `responds_to` CL-0004; data non registrata |

Persona: GILL con `sentenced`, `2025-11` (mese di TL-0092, non la data di pubblicazione di P03), P03 e URL CPS registrato. Omessi (regola 7): claim su VOL (G-0014, G-0139) e MED (G-0016, G-0017). Corsie vuote: CASE-0001 senza attribuzione e smentita, CASE-0002 senza giudizio.

## 4. Decisioni (esecuzione non sorvegliata, 2026-11-15)

Adottate dall'orchestratore su mandato del manutentore, da confermare.

| ID | Domanda | Opzioni | Adottata |
| --- | --- | --- | --- |
| D-B18-1 | Dove scrivere le ADR | (a) `docs/adr/`; (b) accanto all'audit | **(b)** `docs/audit/fable-2026-11/adr/`, in italiano come il resto dell'audit; ARCHITECTURE.md le richiama |
| D-B18-2 | ADR-04: significato di `evidence_status` | (a) significato proprio; (b) codice di compatibilità senza significato; (c) rimozione | **(b)**: E1–E4 tipi di base non ordinali della singola affermazione; `evidence_status` resta in `v1` accoppiato uno a uno, non entra nei nuovi modelli; rimozione solo in `v2` |
| D-B18-3 | ADR-06: forma del modello | A campi, B collezione `claims`, C triple store | **B incrementale**: `Case` + `Claim` con `kind` fatto/attribuzione/smentita/giudizio e `aspect` della regola 6 |
| D-B18-4 | Collocazione del pilota | (a) nuove collezioni in `data/`; (b) file editoriale validato, come B15/B17 | **(b)** `docs/audit/cases/pilot.v1.json`: non tocca loader, gate, export e diff prima della conferma; spostamento in `data/cases/`, `data/claims/` alla conferma |
| D-B18-5 | Livello di un claim | libero / copiato da una relazione elencata / sempre null | **Copiato o null**, con errore se nessuna relazione elencata porta quel livello |
| D-B18-6 | Persone nominate | includere con nota / includere solo con stato, data e fonte primaria registrata | **Solo con stato, data e fonte primaria `external_reference` citata e URL registrato**; VOL e MED omessi |
| D-B18-7 | Stati `refuted` / `closed_insufficient` e coda delle acquisizioni | aggiungere ai claim / non aggiungere | **Non aggiunti**: esistono già per le ipotesi; una confutazione è un nuovo claim (`supersedes`/`responds_to`). La coda A §A6 richiede giudizio umano: rinviata |
| D-B18-8 | ADR-10 ed export | nuovo file di dati / nessun dato esportato | **Nessun dato**: solo schemi e sezioni di vocabolario aggiunti in `v1`; un test verifica che gli ID del pilota non compaiano negli export |

## 5. Test

`test/cases.test.ts`: il pilota valida senza errori e avvisi; tutti i record `needs_review` con `provenance` vuota; query per `kind` restituiscono fatto (CL-0001, CL-0003), attribuzione (CL-0004), smentita (CL-0005) e giudizio (CL-0002); attribuzione e smentita di TL-0059 hanno due autori distinti (PL, RU); `denialsOf(CL-0004)`; corsie vuote mantenute; due fasi contano un caso; regola 7 (stato mancante, URL non registrato → errore); smentita senza replica, attribuzione senza autore, livello inventato, claim fuori dal caso, campo trascritto vuoto, fonte inesistente → errori; ID assenti dagli export; vocabolario e descrizioni degli schemi completi.

## 6. Rischi

- **Falsa precisione:** il claim riformula un campo esistente; un revisore deve confermare che la frase non dica più del record (es. CL-0003 esplicita «incendio» dal titolo).
- **Fonte primaria non riletta:** P03 è citata perché il repository vi registra l'URL CPS e il limite M5; nessun documento è stato letto in questo blocco.
- **`asserted_by` PL per «governo polacco»:** l'entità è lo Stato; la granularità (governo, procura, servizi) va decisa nella revisione.
- **Schemi pubblicati senza dati:** `cases.schema.json` e `claims.schema.json` compaiono in `data/v1/schemas/` prima di qualsiasi dato pubblico; il catalogo non li elenca come dataset.

## 7. Azioni per il manutentore

1. Confermare, modificare o respingere ADR-04, ADR-06, ADR-10.
2. Rivedere i 2 casi e i 5 claim; decidere se lo stato di Gill (`sentenced`, definitività non registrata) è esatto sul documento CPS.
3. Decidere se aggiungere claim su VOL/MED quando esisterà una fonte primaria registrata dello stato procedurale con data.
4. Alla conferma di ADR-06: spostare casi e claim in `data/`, estendere gate M5 ed export (`cases.json`, `claims.json`), quindi B19.

## 8. Esito

- **Fatto:** tre ADR proposte; modello additivo `Case`/`Claim` con descrizioni, vocabolari e schemi JSON; validazione nel run di `pnpm validate`; quattro query strutturate; pilota di 2 casi e 5 claim ricostruiti solo da record e codici di fonte esistenti, tutti `needs_review`; documentazione aggiornata.
- **Verifica:** `pnpm check` verde, 301 test (28 suite); `pnpm validate` 0 errori, 24 avvisi (invariati); `pnpm schemas --check` aggiornato (12 schemi); `pnpm build` e `pnpm check:links` verdi (931 pagine, 175.301 link, 0 problemi); `vocabulary.json` contiene le nuove sezioni, nessun file di dati contiene ID del pilota; `pnpm data:diff` exit 1 solo per i 2 errori ereditati su `ART-0001`/`ART-0002`, nessun errore nuovo (`data/` invariato).
- **Resta:** conferma delle ADR, revisione editoriale del pilota, promozione in `data/` e pagine (B19).

### Correzioni post-review

Review indipendente dell'orchestratore (F1–F7), applicate senza commit:

- **F1:** CL-0002 non riporta più la durata della pena nella proposizione E1; il nuovo campo `limit` dice che «10 anni e 6 mesi» poggia solo su TL-0092/S01, non sul titolo di P03.
- **F2:** un livello è prestato solo da una relazione elencata che riguarda il claim (ID, estremo o evento in `about`); ogni relazione elencata deve rispettarlo (errore). Test con relazione fittizia E1 non collegata.
- **F3:** CL-0004/CL-0005 con `limit`: il record parla di «servizi russi»; RU non è la posizione dello Stato né un servizio specifico (nessuna entità «servizi russi» generica; `GRU` sarebbe una precisione non presente in TL-0059).
- **F4:** `person_status` richiede una relazione elencata e pertinente con soggetto o oggetto = la persona e `primary_url` identico. Test.
- **F5:** un campo trascritto è vuoto anche se è `""`, solo spazi o un testo localizzato senza `it`. Test su fixture.
- **F6:** CL-0001 con `limit`: chi ha accertato la condotta non è registrato oltre la condanna di TL-0092.
- **F7:** test su fixture per F2/F5; il test ADR-10 verifica anche che `src/site/` e `web/src/` non importino il pilota.
- Modello: `Claim.limit` (testo localizzato o null, con `.describe()`); `schemas/claims.schema.json` rigenerato. Test: 303 (28 suite).
