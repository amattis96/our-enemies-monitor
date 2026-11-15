# Revisione finale pre-merge — `audit/fable-2026-11-implementation`

Data: 2026-11-15. Esecutore: Claude (agente locale, account del manutentore). Ambito: correzioni mirate e verifica del branch che implementa B01–B21, senza nuove funzionalità.

## 1. Riferimenti

| | SHA |
|---|---|
| `origin/main` al momento della revisione | `19b2533057e0e82fb05431817af7c4691e7eb1b0` |
| Branch all'inizio della revisione | `729f7a2b408df9448328f8fcc15d7d1d287de34b` |
| HEAD finale | indicata nella descrizione della PR (non può comparire nel commit che la contiene) |

Commit aggiunti: `5cf5a67` (Tracciato e diff, ADR-04), `2406c59` + `a88c819` (citazioni dei pacchetti), `0d1afa9` (segnalatore del piano di controllo), più il commit di questo resoconto.

## 2. Correzioni

### 2.1 Livelli probatori trattati come scala (alta)

- `src/site/trace.ts`: rimosso `weakestLink()` (che sceglieva il codice più alto come «anello più debole»). Al suo posto `evidenceComposition()`: conteggi per livello in ordine di codice. Il blocco «Che cosa non dice» ha la voce `composition`, che dice esplicitamente che i livelli non si sommano né si ordinano e non qualificano un legame fra gli estremi. Anche la frase «non l'unico né il più solido» è stata riformulata. Interruzioni, caveat, ipotesi e inferenze vietate sono invariati.
- `src/pipeline/diff.ts`: rimosso `LEVEL_RANK`. Ora è segnalato ogni cambio di `evidence_level`, in entrambe le direzioni (`evidence level changed X → Y`); prima un passaggio E2 → E3 passava senza segnalazione.
- Altri usi verificati: `roles.ts` e `visual.ts` usano solo conteggi ed etichette; `validate.ts` impone l'accoppiamento livello/stato, non un ordine. La «scelta del più basso» di Fonte_09 citata in ADR-04 non è codice: era una decisione dell'import manuale. Nessuna relazione è stata riclassificata.
- Test: `test/trace.test.ts`, che verifica anche che nessun testo IT/EN del Tracciato contenga confronti di solidità; `test/diff.test.ts`, che verifica E2 → E3 ed E2 → E1.
- Documentazione: ARCHITECTURE (Tracciato e diff), ADR-04 (Conseguenze), B16_ANALYSIS.

### 2.2 Citazioni verificabili dei pacchetti (medio-alta)

- `src/site/publication.ts`: `PublicationReport.transformed` elenca gli ID pubblicati la cui forma pubblica differisce dal file canonico.
- `src/site/packages.ts`: `cite_as` cita la proiezione pubblica. Contiene `cites: public_projection`, `export_version`, `commit`, `package_path` e `record_sha256`, cioè lo SHA-256 del solo membro `record` serializzato con `JSON.stringify`; questo evita un hash circolare, e l'hash del file intero resta in `manifest.json`. Il permalink Git passa in `canonical_source`, con `relation: filtered | identical` e una nota «solo provenienza».
- Contenuti trattenuti: il pacchetto riporta solo il flag, nessun ID omesso.
- Test in `test/packages.test.ts`. Su `H08` (`filtered`) il digest del pacchetto è diverso da quello del file canonico e nessun evento o fonte omessi compare nel pacchetto. Per un evento senza proiezione (`identical`) il digest coincide con quello del file canonico.
- Il test di fuga sugli ID trattenuti resta verde.

### 2.3 Piano di controllo (alta per la governance)

- `src/pipeline/policy.ts`: `CONTROL_PLANE` e `controlPlaneFlags()` producono un flag *attention* per ogni file modificato fra workflow, CODEOWNERS, CLI di controllo, policy, diff, validazione, gate articoli, gate di pubblicazione, guardia anti-fuga, `package.json`, lockfile, `AGENTS.md` e `CLAUDE.md`. La funzione non riceve il nome del branch, quindi rinominare il branch non la evita.
- I flag sono collegati in `src/cli/data-diff.ts`. Test avversariali in `test/policy.test.ts`: un agente di ricerca che sposta il lavoro da `research/x` a `docs/x` sfugge alla policy dei percorsi ma non al segnalatore.
- **Non è una barriera.** Il job esegue il codice della HEAD della PR, che può modificare il segnalatore stesso, e anche il workflow viene letto dalla PR (`pull_request`).

## 3. Modello di fiducia effettivo

Stato letto via API (solo lettura) il 2026-11-15:

| Elemento | Nel repository | Applicato su GitHub |
|---|---|---|
| Identità | Regole per account macchina e Task C solo revisore (B01) | **No.** Unico collaboratore: `amattis96` (admin). ChatGPT (Codex Connector) e Claude agiscono come il manutentore |
| Protezione di `main` | Ruleset proposto (B01) | Protezione classica, **nessun ruleset** |
| Check richiesti | `check` ed `evidence-diff` (AGENTS.md) | **Solo `check`**. `evidence-diff` non è richiesto, quindi una PR rossa sul diff resta tecnicamente fondibile |
| Review | CODEOWNERS su tutto (`@amattis96`) | Code owner review richiesta, 1 approvazione, dismiss stale; `require_last_push_approval` disattivato; `enforce_admins` disattivato, quindi l'admin aggira tutto |
| Etichetta `evidence-waiver` | Logica in `check:pr` | **L'etichetta non esiste** nel repository |
| `ARTICLE_REVIEWERS`, `MAINTAINER_LOGIN` | Letti dal workflow | **Variabili non impostate**: si ricade sull'owner, che come autore delle PR non può approvarsi |
| Policy per prefisso | `research/*`, `agent/ingest-*` (errori non derogabili) | Il prefisso non autentica: con credenziali da owner, qualsiasi prefisso è libero |
| Piano di controllo | Segnalatore attention (§2.3) | La protezione reale richiede un ruleset con code owner review sui percorsi del piano di controllo, eseguito da un'identità diversa da quella dell'agente |

Conclusione:
- Oggi **nessun controllo del repository impedisce** a un agente con le credenziali del manutentore di alterare o aggirare le regole. Policy, diff, gate degli articoli e segnalatore sono strumenti di revisione eseguiti dal codice della PR.
- L'unica barriera effettiva è la code owner review su `main`. È disattivabile dall'admin (`enforce_admins: false`), e gli agenti *sono* l'admin.
- È un **requisito operativo bloccante non ancora applicato**: il codice non può risolverlo.

## 4. Articoli già approvati (`ART-0001`, `ART-0002`)

| Articolo | Modifica | Tipo | Necessaria? | Significato |
|---|---|---|---|---|
| ART-0001.en.md | `+ target_hash: "47b29e76e5303546"` | Tecnica (B06) | Sì: lo schema la richiede, e rimuoverla fa fallire `validate:articles` | Invariato |
| ART-0002.en.md | `+ target_hash: "133210f9ab175b7a"` | Tecnica (B06) | Sì, come sopra | Invariato |
| ART-0002.it.md | `links.events: [] → [TL-0064]` | Editoriale (B09) | No, ma giustificata | Rimando di navigazione, non un'affermazione |

- `pnpm articles:hash ART-0001 ART-0002` restituisce gli stessi `source_hash` e `target_hash` presenti nei file. Testi, `review.status` e stato della traduzione (`machine`) sono invariati.
- **Il link a TL-0064 è coerente.** L'articolo descrive i quattro pacchi del luglio 2024 entrati nella rete DHL/DPD e gli incendi a Lipsia, nel Regno Unito e in Polonia. TL-0064 è «Pacchi incendiari DHL/DPD», 2024-07, DE/PL/GB, fonte S03.
- TL-0064 è però `imported_unreviewed`, e il diff lo segnala.
- Il collegamento a `H02`, aggiunto in un primo momento, era già stato rimosso (`86629af`).

Esito di `pnpm data:diff`: 2 errori «modifies an article already marked as reviewed». Non li ho resi verdi artificialmente.

Percorso per l'approvazione. Ogni elemento ha uno scopo distinto, e nessuno si sostituisce agli altri:
- **`evidence-waiver`** (etichetta): abbassa i 2 errori derogabili del diff ad *attention* per la sola HEAD corrente. La applica il manutentore (owner) dopo l'ultimo push; un nuovo push la fa scadere. Prima va creata, perché l'etichetta oggi non esiste.
- **`Publication-Approval: ART-0001, ART-0002`**: autorizzazione editoriale a pubblicare la versione modificata. Va in una GitHub review, sulla HEAD esatta della PR, di un account umano elencato in `ARTICLE_REVIEWERS`, diverso dall'autore della PR.
- **`Translation-Approval:`**: non necessaria, perché nessuna traduzione `reviewed` è promossa o modificata (entrambe restano `machine`).
- L'approvazione data in conversazione a un agente **non** equivale a una GitHub review.

## 5. Audit delle regressioni

| Controllo | Esito |
|---|---|
| `pnpm install --frozen-lockfile` | ok |
| `pnpm check` | verde: 338 test (31 suite); validate 0 errori e 24 warning, invariati; sidecar 1.0/1.1, articoli, freschezza degli schemi, audit M5, contrasto |
| `pnpm build` | verde, dopo la correzione `a88c819`: le virgolette nel testo EN di `data.astro` rompevano il compilatore Astro e `pnpm check` non lo rilevava |
| `pnpm check:links` | 931 pagine, 177.441 link, 876 file macchina e sitemap senza ID trattenuti, 0 problemi |
| `pnpm audit:publication` | ok (exit 0) |
| `pnpm benchmark:measure --pages web/dist` | nessuna regressione rispetto a `baseline-2026-11-15-85c92c5.json`; dettaglio sotto |
| `pnpm data:diff --base origin/main --branch audit/fable-2026-11-implementation` | exit 1: solo i 2 errori sugli articoli del §4; 24 attention sul piano di controllo (attese: il branch modifica workflow e CLI) |
| `git diff --check origin/main...HEAD` | pulito, dopo la rimozione di uno spazio finale in ARCHITECTURE |

Variazioni del benchmark, tutte attese:
- T8: 31 descrizioni di schema, vocabolario esportato.
- T7: campo di freschezza presente.
- T10: 873 pacchetti per record.
- T11: canonical da 0 a 930, `<time>` da 2 a 304, JSON-LD da 0 a 6.
- E7: nuova misura.
- Dimensioni degli export: +0,2% per i campi genealogici.

Altre verifiche:
- **Fonti:** nessuna modifica sotto `sources/`.
- **Dati:** nessuna `provenance` toccata, nessun `reviewed` aggiunto in `data/`, nessun `human_approved: true`.
- **Proposte:** inferenze, menzioni e casi pilota restano `proposta` o `needs_review`.
- **Test:** il working tree resta pulito dopo i test.
- **Tracciato:** HTML IT/EN di `/trace/H06/` verificato. Contiene composizione, interruzione e «proposta non rivista»; nessun «più debole»/«weakest».
- **Pacchetto H08:** `cites: public_projection`, `relation: filtered`.

Non eseguito, perché richiede seconda identità, permessi amministrativi o un'esecuzione reale di CI:
- canarini avversariali live (PR da branch improprio, scadenza della deroga su push, approvazione da login non autorizzato). La logica è coperta dai test di `test/policy.test.ts` e `test/article-review.test.ts`, ma il comportamento end-to-end con token reali resta da osservare sulla PR;
- il benchmark B1–B20 su un modello esterno.

## 6. Difetti residui

Bloccanti per il merge:
1. Errori editoriali di `evidence-diff` su ART-0001 e ART-0002: servono l'etichetta e la `Publication-Approval` di un secondo account umano (§4).
2. Governance non applicata (§3): agenti come owner, nessun ruleset, `evidence-diff` non richiesto, `enforce_admins` disattivato. Il merge resta possibile ma non protetto.

Non bloccanti:
- La doppia visualizzazione livello/stato sulle pagine (ADR-04) è rinviata.
- Le ADR-04, 06, 08 e 10 sono ancora proposte; Fascicolo del caso e Domande strutturate sono rinviati.
- I file sotto `.github/` e `src/cli/check-*.ts` sono letti dalla PR: un ruleset con code owner review su quei percorsi è un prerequisito del manutentore (limite B02 ereditato).

## 7. Checklist del manutentore

1. Creare l'etichetta `evidence-waiver` nel repository.
2. Creare un secondo account umano revisore. Impostare la variabile `ARTICLE_REVIEWERS` con quel login, ed eventualmente `MAINTAINER_LOGIN`.
3. Dopo l'ultimo push sulla PR: applicare `evidence-waiver` dall'account owner.
4. Dal secondo account: GitHub review sulla HEAD esatta con `Publication-Approval: ART-0001, ART-0002`, dopo aver letto il diff del §4.
5. Verificare che `check` ed `evidence-diff` siano verdi sulla HEAD aggiornata.
6. Applicare B01:
   - account macchina con ruolo Write per gli agenti;
   - ruleset su `main` con `check` ed `evidence-diff` richiesti, code owner review, approvazione dell'ultimo push e nessun bypass se non per il manutentore tramite PR;
   - ruleset sui namespace `research/*` e `agent/*`;
   - `enforce_admins` attivo o equivalente.
7. Allineare i prompt dei task ChatGPT A/B/C alle nuove impostazioni, in un secondo momento (fuori da questo incarico).
8. Confermare o rivedere le decisioni non sorvegliate D-B12…D-B21 e le ADR proposte; rivedere i file di proposta (menzioni, inferenze, genealogia delle fonti, casi pilota).
9. Unire la PR (solo il manutentore).

## 8. Verdetto

**CONDITIONAL GO.**
- Il codice è verificato: check, build, link, publication audit e benchmark sono verdi, senza regressioni. Le tre correzioni richieste sono in commit distinti con test.
- Il merge resta un **NO-GO tecnico fino all'approvazione**: `evidence-diff` è rosso solo per le modifiche, legittime, a due articoli già approvati, che richiedono l'etichetta del manutentore e la `Publication-Approval` di un secondo revisore umano.
- Il GO pieno richiede anche i prerequisiti di governance del §3: oggi nessun controllo impedisce a un agente con credenziali da owner di aggirare le regole.

## 9. Esito (aggiornamento)

PR #20 unita in `main` (`01aef78`) dal manutentore con merge amministrativo: etichetta `evidence-waiver` applicata dall'owner, nessuna `Publication-Approval` (non esiste un secondo account), `evidence-diff` rosso solo per questo motivo. Il secondo account è rinviato per decisione del manutentore: vedi B01_ANALYSIS, «Decisione del manutentore (15 novembre 2026)».
