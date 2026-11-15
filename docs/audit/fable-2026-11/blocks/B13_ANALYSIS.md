# B13 — Contratto di lettura: schemi, vocabolario, catalogo: analisi

Data: 15 novembre 2026 (Europe/Rome). Ramo `audit/fable-2026-11-implementation`; HEAD iniziale `e7121658c26dcd38761c1d17d3b6eff5345b2bc5` (B14). Esecuzione non sorvegliata su mandato del manutentore. Nessun fetch, nessuna API esterna, nessuna scrittura in `data/` (la cartella canonica): `data/v1/` qui è il percorso delle esportazioni del sito costruito.

Fonti rilette: scheda B13 (§2.1, §3, §4 ADR-09/ADR-10 di [IMPLEMENTATION_BLOCKS.md](../IMPLEMENTATION_BLOCKS.md)); FABLE D §§1–4, §11.1–11.2, §11.5, §13 (A1–A3); FABLE A §4.2 (non ordinalità); CONSOLIDATED_FINDINGS CF-019 e §3.5. Linea di base: `docs/audit/baseline/baseline-2026-11-15-85c92c5.json` (B12, non modificata). Formato: B14, B12.

## 1. Stato verificato

| Punto | Stato all'ingresso |
| --- | --- |
| Descrizioni negli schemi | Nessuna `.describe()` nei modelli Zod; `schemas/*.schema.json` senza alcun campo `description` (baseline D T8: `schema_descriptions: 0`) |
| Significato dei valori | Solo in `/methodology/` (HTML), in `EVIDENCE_LEVEL_LABELS` (`src/model/vocabularies.ts`) e nelle etichette di `src/site/format.ts`; nessun file dati |
| Esportazioni | `src/site/exports.ts`: `exportFiles(report)` produce collezioni, `all.json`, due grafi, `withheld.json`, schemi; i file senza `/` sono serviti dalla rotta generica `web/src/pages/data/v1/[file].json.ts` e coperti dal manifest. Nessun `index.json`, nessun `vocabulary.json` (baseline T7/T8: `freshness_field_in_exports: false`, `vocabulary_export: false`) |
| Freschezza | Il manifest ha solo `commit_date` (data del commit Git, deterministica). Ultimo evento pubblico: `TL-0146`, 2026-10-20 (record `event`); `TL-0147` (2026-10-21) è `dataset_metadata`, una data di chiusura della raccolta, non un evento. La baseline B12 misura 2026-10-21 perché non distingue il tipo di record. Ultima fonte incrementale archiviata: `S11`, 2026-11-13 (`sources/incremental/`); la tematica `T-IND-001` ha la stessa data |
| Trattenuti | `withheld.json` e conteggi per collezione già nel manifest (B05): 147/202/433/22/55/14 pubblicati; 34/18/25/10/51/0 trattenuti |
| Coerenza livello/stato | `consistentEvidence` (`src/pipeline/evidence-policy.ts`) impone le quattro coppie E1↔documented, E2↔institutional_attribution, E3↔corroborated, E4↔allegation (regola provvisoria in attesa di B18) |
| Glossario | Solo `docs/TRANSLATION_GLOSSARY.md` (Markdown) |

## 2. Perimetro e piano file per file

| File | Intervento |
| --- | --- |
| `src/model/schemas.ts` | `.describe()` su ogni proprietà dei sei modelli di collezione e dei blocchi condivisi (testo localizzato, intervallo di date, provenienza, revisione, traduzione, problemi noti, misure). I campi enumerati rimandano alla sezione di `vocabulary.json`; livello, classe e stato portano nella descrizione la non ordinalità e il limite «presenza ≠ controllo». Nessuna modifica di forma o di validazione |
| `schemas/*.schema.json` | Rigenerati con `pnpm schemas`; verificato che, tolte le `description`, i dieci file sono identici a HEAD |
| `src/site/vocabulary.ts` (nuovo) | `buildVocabulary()`: definizioni di ogni valore controllato usato nei dati pubblici, `scale_note`, regole R1–R5, glossario strutturato. Le etichette sono riusate da `vocabularies.ts` e `format.ts` (stessa fonte delle pagine) |
| `src/site/exports.ts` | `exportCommit()` (Git, memorizzato), `latestPublicEventDate()`, `buildCatalog()` puro; `exportFiles` aggiunge `index.json` e `vocabulary.json` dalla stessa proiezione pubblica; `buildManifest` riusa `exportCommit` |
| `web/src/pages/[...lang]/data.astro` | Paragrafo bilingue con i collegamenti a `vocabulary.json` e `index.json`; la tabella dei file li elenca già tramite il manifest |
| `test/vocabulary.test.ts` (nuovo) | A1: ogni proprietà dei sei schemi ha `description`; A2: ogni valore controllato presente nei dati pubblici (19 campi, inclusi i motivi dei trattenuti) ha una voce; A3: `latest_public_event_date` coincide col massimo calcolato, conteggi coerenti col rapporto di pubblicazione, nessuna data da orologio |
| Documentazione | `docs/ARCHITECTURE.md` (Data model, endpoint `data/v1`), `README.md`, `AGENTS.md` (nuova regola: ogni campo nuovo vuole una descrizione, ogni valore nuovo una voce di vocabolario) |

Fuori perimetro: pacchetti per record, JSON-LD, feed (B20); schede di affermazione (`statements.ndjson`); definizioni per classe di relazione oltre a quelle già sostenute dal metodo.

## 3. Decisioni (esecuzione non sorvegliata, 2026-11-15)

Adottate dall'orchestratore su mandato del manutentore, **da confermare**.

| ID | Domanda | Opzioni | Adottata e motivo |
| --- | --- | --- | --- |
| D-B13-1 | Descrizione per ogni valore di enumerazione (D A1) | (a) `oneOf`/`const` con descrizione per valore negli schemi; (b) descrizione della proprietà con rimando a `vocabulary.json`, definizioni per valore nel vocabolario | **(b)**: (a) cambia la forma degli schemi e i tipi Zod; (b) è additiva e il test A2 garantisce la copertura dei valori |
| D-B13-2 | Quali schemi descrivere | solo le sei collezioni; anche articoli e sidecar | **Sei collezioni** con test; articoli e sidecar ricevono solo le descrizioni dei blocchi condivisi. Estensione possibile in seguito |
| D-B13-3 | Definizioni delle 30 classi di relazione | definire ogni classe; solo gruppo + nota sul predicato letterale, definizione solo per `event_participation` | **Seconda**: nessuna definizione inventata; `must_not_read_as` (controllo, finanziamento, coordinamento, responsabilità) per il gruppo partecipazione e (controllo, finanziamento) per il contesto, dal principio «nessuna colpevolezza per associazione» del metodo |
| D-B13-4 | Le tre date di freschezza | data del commit; ultimo evento pubblico; ultima fonte archiviata; ora di build | **Commit, ultimo evento `event` pubblico, ultima fonte incrementale** (con `in_public_sources`). Niente orologio di build: le esportazioni restano byte-identiche per commit. `dataset_metadata` escluso dall'«ultimo evento» (TL-0147 è una data di raccolta); fonti tematiche escluse (non alimentano l'ingest canonico). Scarto dichiarato con la baseline B12 (2026-10-21 contro 2026-10-20) |
| D-B13-5 | Visibilità dei trattenuti (ADR-09) nel catalogo | conteggi aggregati; ID | **Conteggi aggregati** e rimando al registro esistente `withheld.json` (già pubblico da B05); nessun nuovo dato individuale |
| D-B13-6 | Compatibilità `data/v1` (ADR-10) | nuova versione; aggiunte in `v1` | **Aggiunte in `v1`**: due file nuovi e campi `description`; nessun campo esistente rinominato o rimosso |
| D-B13-7 | Forma delle regole R1–R5 | testo D; dichiarazioni bilingui | **Dichiarazioni bilingui** (non comandi), R2 e R4 riformulate in modo da non usare l'imperativo né citare codici fissi (`type corpus_document` invece di S00–S09) |
| D-B13-8 | `hypothesis_priorities` | solo etichetta; etichetta + `must_not_read_as` | **Etichetta + `must_not_read_as: probability, likelihood`**, coerente con il metodo («non probabilità calibrate») |

## 4. Rischi e limiti

- Le definizioni pubbliche sono testi editoriali: `scale_note`, note su E1/E2, definizioni degli stati e regole R1–R5 sono tratte dal metodo e dai rapporti, ma non sono state rilette da un redattore umano. Una formulazione sbagliata verrebbe letta come contratto.
- La coerenza livello/stato è dichiarata «uno a uno» perché la validazione la impone oggi; se B18 cambia ADR-04 il vocabolario va aggiornato nello stesso cambio.
- `latest_public_event_date` usa il massimo lessicografico di `date.start` (ISO parziale): `2026-10` precede `2026-10-20`. È documentato nella nota del campo.
- La baseline B12 non si aggiorna: le misure successive (§5) sono confronti, non sostituzioni.

## 5. Azioni per il manutentore

1. Confermare o correggere D-B13-1…8.
2. Rilettura editoriale di `vocabulary.json` (definizioni E1–E5, `scale_note`, stati, R1–R5, glossario) prima di citarlo come riferimento pubblico.
3. Decidere se estendere le descrizioni obbligatorie agli schemi di articoli e sidecar (D-B13-2).

## 6. Esito

**Fatto.** Descrizioni Zod su tutte le proprietà delle sei collezioni (schemi rigenerati, struttura invariata); `data/v1/vocabulary.json` e `data/v1/index.json` generati a build time dalla stessa proiezione pubblica in `src/site/exports.ts`, serviti dalla rotta generica e coperti dal manifest; collegamenti dalla pagina `/data/` in italiano e inglese; test A1–A3; documentazione aggiornata. Nessun cambio a `data/`, `sources/`, stati di revisione o validazione.

**Verifica.**

- `pnpm check` verde: 260 test in 24 suite; `validate` 0 errori/23 warning (invariati); schemi aggiornati.
- `pnpm build` verde; `pnpm check:links`: 885 pagine, 166.647 link interni, 0 problemi.
- Nel sito costruito: `index.json` e `vocabulary.json` presenti, byte e SHA-256 coincidono col manifest; collegamenti presenti in `/data/` e `/en/data/`; pagina e JSON controllati nel browser (anteprima locale).
- `pnpm benchmark:measure` rispetto alla baseline B12: T7 `freshness_field_in_exports` false → true; T8 `schema_descriptions` (schema delle relazioni) 0 → 31, `vocabulary_export` false → true.
- `data/` non modificata: `pnpm data:diff` non necessario.

**Resta.** Rilettura editoriale del vocabolario e conferma delle decisioni (§5); pacchetti per record, JSON-LD e feed in B20.
