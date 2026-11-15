# B02 — CI per percorso e merge serializzati: analisi

Data: 14 novembre 2026. Ramo: `audit/fable-2026-11-implementation` (HEAD con B04 già committato). Analisi di sola lettura: l'unico file scritto è questo; gli script di prova stanno in `/private/tmp/claude-501/b02-scratch/` (`repro.ts`, `s5.ts`, clone di prova `clone/`).

Rapporti coperti: FABLE B V2, V3, S5, P2, P7, R3, R4, R15, R16. Decisioni già prese in B01 (D1–D7) rispettate; in particolare D4: `evidence-diff` diventa richiesto solo dopo B02, quindi **B02 fissa qui il nome definitivo dei check**.

---

## 1. Stato verificato

### 1.1 Workflow e impostazioni vive

- `.github/workflows/ci.yml`: trigger `push` su `main` e `pull_request` (tipi predefiniti: `opened`, `synchronize`, `reopened`); `concurrency: ci-${{ github.ref }}` con `cancel-in-progress: true` per **tutti** gli eventi; job `check`, `evidence-diff` (solo PR), `deploy` (solo push su `main`, `needs: check`). `evidence-diff` passa `--agent` solo se `startsWith(github.head_ref, 'agent/')`. Le action sono fissate al tag maggiore (`@v7`, `@v6`, `@v5`).
- Protezione di `main` (API, oggi): contesti richiesti `["check"]`, `strict: false`. Nessun ruleset (`gh api …/rulesets` vuoto). Unico collaboratore: `amattis96` (admin). Etichette esistenti: nessuna di deroga (`agent`, `needs-review`, … sì). Nessun `.github/dependabot.yml`.
- `gh run list --branch main`: dal 13/11 ci sono **3 esecuzioni `cancelled` e 1 `failure`** su commit di `main`:

  | Ora UTC | Commit | Esito |
  | --- | --- | --- |
  | 04:01:10 | `43965ce` (#11) | cancelled |
  | 04:01:23 | `585bd57` (#3) | cancelled |
  | 04:01:28 | `799ad18` (#10) | **failure** (poi corretto da #13 alle 06:25) |
  | 06:36:24 | `bba70ec` (#9) | cancelled (4 s prima di `11e159d`, success) |

  Quindi V2 non è un episodio isolato: si è ripetuto due volte nello stesso giorno. Tre commit di `main` non hanno mai avuto un'esecuzione conclusa (`43965ce`, `585bd57`, `bba70ec`); le esecuzioni dal 13/11 06:36 in poi sono tutte `success`.

### 1.2 Codice del diff (letti `src/cli/data-diff.ts`, `src/pipeline/diff.ts`, `test/diff.test.ts`)

- `diffData(before, after, {agent, persons})`: `agentError` produce `error` se `agent`, altrimenti `attention`. Errori in modalità agente: cancellazione, `provenance` modificata, modifica di record `reviewed`, `reviewed` impostato, traduzione `reviewed`, promozione di ipotesi, nuovo record non `needs_review`, nuovo record con `provenance`, nuova relazione senza `primary_url`.
- `data-diff.ts`: con `--agent` ogni percorso toccato fuori da `data/` è un errore. **Solo** in quella modalità.
- `test/diff.test.ts` ha un test che sancisce il comportamento difettoso: «only warns, never fails, outside agent mode».

### 1.3 Difetti riprodotti (script `repro.ts`, `s5.ts`, dati reali di `data/`)

**V3 confermato.** Stesso diff (nuovo evento `imported_unreviewed` + `H06` portata a `promoted` e `reviewed`):

| Modalità | Segnalazioni | Uscita |
| --- | --- | --- |
| ramo `research/*` (`agent:false`) | 3 `attention` | **0** |
| ramo `agent/*` (`agent:true`) | 3 `error` | **1** |

Stesso risultato per cancellazione di `entities/RU.json` (0 vs 1) e per `G-0008` posta a `reviewed` (0 vs 1). R3 oggi: uscita 0 su `research/*`.

**S5 confermato** (record `G-0002`, nessuna persona coinvolta, così il rumore «concerns the named person» non maschera il risultato). In modalità non-agente **e** agente, nessuna segnalazione per:

| Modifica | Campi nel diff | Segnalazioni |
| --- | --- | --- |
| `predicate` riscritto nello stesso gruppo | `predicate` | 0 |
| `caveat` rimosso / riscritto | `caveat`, `caveat.it`, `caveat.en` | 0 |
| sostituzione di un codice in `sources` | `sources` | 0 |
| `valid_from` impostato | `valid_from` | 0 |
| `primary_url` cambiato | `primary_url` | 0 |
| `evidence_status` cambiato a livello invariato | `evidence_status` | 0 |
| solo testo inglese (`title.en`, `description.en`, `geography.en`) | `*.en` | 0 |

Nota di dettaglio: la segnalazione «concerns the named person» scatta **su qualunque** modifica di una relazione con una persona (ad es. `G-0008`/`MED`), quindi su quelle relazioni S5a/S5e/S5g non sono «silenziose» ma sono nascoste dal rumore, e comunque sono `attention` (uscita 0).

**Difetti nuovi trovati durante la riproduzione** (non presenti nel rapporto B):

1. **Il report nasconde l'errore.** `diffMarkdown` esce subito con «No changes to `data/`.» quando `changes` è vuoto, **senza stampare i flag**. Verificato su questo ramo: `node src/cli/data-diff.ts --base origin/main --agent` esce con 1 (perché toccati `src/`, `docs/`…), ma il report dice solo «No changes to data/». Un job rosso senza motivo leggibile.
2. **Rinomina = cancellazione invisibile.** `git diff --name-only <base> --` rileva le rinomine (`diff.renames` predefinito) e stampa solo il nuovo percorso. Prova nel clone: `git mv data/entities/RU.json docs/RU.json` → `name-only` elenca solo `docs/RU.json`; con `--no-renames` elenca entrambi. Oggi la rimozione del record **non viene rilevata** (il percorso `data/…` non compare in `touched`).
3. **Base mobile.** `git diff base` e `git show base:path` usano la **punta** di `origin/<base_ref>`, mentre il checkout della PR è il merge-ref (`refs/pull/N/merge`) che può essere più vecchio. Se `main` avanza, i file cambiati su `main` compaiono come modifiche della PR (verificato nel clone: `git diff main2 t` elenca `newfile.md` di `main`; con `merge-base` no). Con `strict: false` (oggi) è il caso normale.
4. Il job `evidence-diff` non ha `permissions` propri (eredita `contents: read`), quindi non può né leggere gli eventi della PR con certezza né modificare etichette: va dichiarato.
5. Nessun controllo di immutabilità di `sources/original/` e `sources/incremental/` in CI (la regola 1 di `AGENTS.md` è garantita solo dal controllo della provenienza in `pnpm validate` per i soli record importati).

### 1.4 Concorrenza: `cancel-in-progress: false` non basta

Verificato sulla documentazione GitHub corrente (WebFetch, pagina «Using concurrency»): con `cancel-in-progress: false` resta valido il comportamento `queue: single`: **al più un'esecuzione `pending` per gruppo; una nuova esecuzione accodata cancella e sostituisce quella `pending`**. Con tre merge ravvicinati su `main` (run 1 in corso, run 2 pending, run 3 in arrivo) la 2 viene comunque annullata: R15 resterebbe violato. Esiste però la chiave `queue: max` (FIFO fino a 100 pendenti), **non combinabile con `cancel-in-progress: true`**; il documento non dice se sia GA. Non verificabile da qui senza un canarino.

### 1.5 Versioni e SHA delle action (verificate via `gh api`, 14/11/2026)

Ultima release, tag annotato dereferenziato al commit, commit verificato da GitHub. In tutti e cinque i casi il tag maggiore oggi usato punta **allo stesso commit** della release più recente: il pinning non cambia ciò che gira, indurisce soltanto.

| Action | Usata | Ultima release | SHA del commit (40 caratteri) |
| --- | --- | --- | --- |
| `actions/checkout` | `@v7` | v7.0.1 (2026-07-20) | `3d3c42e5aac5ba805825da76410c181273ba90b1` |
| `pnpm/action-setup` | `@v6` | v6.1.1 (2026-11-03) | `73e46992e05b19abd31f2f3c20e0e7370d762115` (il tag è annotato: `9bbca1e9…` è l'oggetto tag, il commit è `73e46992…`) |
| `actions/setup-node` | `@v7` | v7.1.0 (2026-10-08) | `949feb2413d6458794dcd2491c4babbbce0c15c1` |
| `actions/upload-pages-artifact` | `@v5` | v5.0.0 (2026-04-10) | `fc324d3547104276b827a68afc52ff2a11cc49c9` |
| `actions/deploy-pages` | `@v5` | v5.0.1 (2026-09-01) | `368f82528645a54fb793d4d04e342629a3f51346` |

Gli SHA vanno **ricontrollati nel momento dell'implementazione** (il comando è nel §3.7); nel file si scrive `uses: actions/checkout@<sha> # v7.0.1`.

### 1.6 Limite strutturale da dichiarare

Un workflow `pull_request` esegue **la versione del workflow e del codice presenti nella PR**. Una PR che modifica `ci.yml` o `src/cli/data-diff.ts` può rendere verde il proprio controllo. Nessuna regola di percorso in `ci.yml` può quindi difendere da un attore che modifica `ci.yml` stesso. La difesa reale è nel ruleset di B01: `require_code_owner_review: true` con `CODEOWNERS` `* @amattis96` (ogni PR, e in particolare `.github/` e `src/`, richiede l'approvazione umana del manutentore, che l'account macchina non può dare). Il controllo di percorso protegge da errori e da istruzioni iniettate che non toccano il workflow, ed è un **ausilio di revisione** (il revisore vede subito «questa PR di ricerca tocca `src/`»), non una barriera crittografica. Hardening opzionale in §6 (D-B02-6).

---

## 2. Progetto

### 2.1 Concorrenza (`ci.yml`, R15)

```yaml
concurrency:
  # PR: una sola esecuzione per PR, le vecchie vengono annullate.
  # main: gruppo per SHA, quindi nessuna esecuzione di main ne annulla un'altra.
  group: ci-${{ github.event_name == 'pull_request' && format('pr-{0}', github.event.pull_request.number) || format('sha-{0}', github.sha) }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}
```

Perché per-SHA e non `queue: max`: funziona con semantica documentata e certa, non dipende da una funzione di cui non ho la conferma di GA. Costo: due merge ravvicinati fanno girare due `check` in parallelo (≈1 min ciascuno). Conseguenza: il `deploy` va protetto da sorpassi (altrimenti il deploy di un commit vecchio può finire dopo quello del nuovo).

Job `deploy`: due difese.

1. `concurrency: { group: pages-deploy, cancel-in-progress: false }` a livello di job (serializza i deploy; un deploy pendente sostituito da uno più recente è accettabile ma può apparire `cancelled`, quindi si usa solo come rete di sicurezza).
2. Passo iniziale «salta se superato»: confronta `GITHUB_SHA` con la punta di `main` (`gh api repos/$REPO/commits/main --jq .sha`); se diverso, il job termina con successo senza pubblicare e scrive nel summary «superseded by <sha>». Così su tre merge consecutivi pubblica solo l'ultimo, ogni commit ha comunque un'esecuzione conclusa (`success` o `failure`, mai `cancelled`) e un `main` rosso resta visibile. Per saltare i passi successivi: passo con `id: tip`, output `deploy=true|false`, e `if: steps.tip.outputs.deploy == 'true'` sui passi successivi (il job non va in `skipped`).

Variante più semplice se un canarino conferma `queue: max`: `concurrency: { group: ci-main, queue: max }` per i push e il gruppo per PR per le PR. Poiché `queue` non è combinabile con `cancel-in-progress: true`, servirebbero due workflow o gruppi per evento: non conviene prima della conferma. Da riportare come D-B02-7.

Con `strict: true` (B01) i merge ravvicinati diventano di fatto sequenziali (ogni PR deve essere riallineata e ripassare la CI), quindi questa è la seconda linea di difesa; resta necessaria perché il proprietario può aggirare `strict` con il bypass.

### 2.2 Nome e collocazione dei check (da dare a B01)

- Check richiesti nel ruleset di `main`: **`check`** e **`evidence-diff`**, entrambi con `integration_id: 15368`. Nessun cambio rispetto ai nomi già usati nel comando di B01 §3.2.
- Si imposta `name: evidence-diff` e `name: check` **esplicitamente** nei job, per impedire che un cambio di id modifichi il contesto.
- Il job `evidence-diff` deve **girare su ogni PR** (nessun `paths:` / `paths-ignore:` nel trigger, nessun `if:` che lo salti su `labeled` di altre etichette): un controllo richiesto che non parte lascia la PR in «Expected — waiting for status».
- Il job unico `evidence-diff` contiene due passi (politica dei percorsi, poi diff delle evidenze), così il ruleset richiede due soli contesti.
- **Collocazione**: spostare il job in `.github/workflows/evidence-diff.yml` (stesso nome di job) con `on: pull_request: types: [opened, synchronize, reopened, labeled, unlabeled]`. Motivo: gli eventi `labeled`/`unlabeled` non devono rilanciare `check` (build completa) e non devono entrare nel gruppo di concorrenza di `ci.yml`. Gruppo proprio: `evidence-pr-${{ github.event.pull_request.number }}`, `cancel-in-progress: true`. Alternativa (stesso file, `if` per tipo di evento) scartata: un job `check` «skipped» sullo stesso SHA accanto a uno fallito crea ambiguità nell'esito dei check richiesti, che non posso verificare.
- Il job `evidence-diff` esegue il checkout dello **SHA di testa della PR** (`ref: ${{ github.event.pull_request.head.sha }}`), non del merge-ref: il diff riguarda ciò che la PR cambia, indipendentemente da dove sia `main` (difetto 1.3-3). `check` resta sul merge-ref (prova il risultato dell'unione).

Permessi del job: `contents: read`, `pull-requests: write` (solo per scadenza dell'etichetta, §2.4), `issues: read` se l'API degli eventi lo richiede (da confermare con canarino).

### 2.3 Diff severo per tutti, deroga solo del manutentore (V3, R3)

`src/pipeline/diff.ts`:

- `options.agent` → `options.strict` con **default `true`**. In modalità `strict` gli errori sono errori su qualunque ramo. Nuova modalità `relaxed` (deroga): i **medesimi** controlli scendono a `attention`, ma il report li marca «waived by <maintainer>» e li elenca in testa, così la deroga non cancella l'informazione.
- Ogni flag riceve `waivable: boolean` (predefinito `true`). **Non derogabili** (sempre `error`, anche con etichetta): modifica di `provenance`, modifica/cancellazione di file esistenti sotto `sources/original/` e `sources/incremental/`, violazioni della politica dei percorsi (§2.5). Motivo: sono regole «mai» di `AGENTS.md` (1, 3); chi deve davvero farlo usa il bypass del ruleset, dichiarato nella PR.
- `diffMarkdown`: stampare i flag **anche** quando `changes` è vuoto (difetto 1.3-1).
- CLI: `pnpm data:diff [--base ref] [--relaxed] [--branch <head_ref>] [--out f]`. `--agent` resta come alias deprecato (stampa un avviso e vale `strict`, che ora è il predefinito) per non rompere i comandi in `AGENTS.md`, nel documento M6 §4 e in `CHATGPT_SCHEDULED_TASKS.md`; da rimuovere in un blocco successivo.
- Calcolo dei percorsi modificati (robusto): `git diff --raw -z --no-renames --find-copies-harder=false <mergeBase> HEAD` con `mergeBase = git merge-base <base> HEAD`; `before` letto con `git show <mergeBase>:<path>`; `after` dall'albero di lavoro. `-z` per i nomi con caratteri speciali; `--no-renames` perché una rinomina compaia come `D` + `A` (difetto 1.3-2). Dal `--raw` si leggono anche modo e stato: **modo `120000` (symlink) o `160000` (submodule)** in un percorso consentito è sempre un errore non derogabile (un link simbolico in `content/articles/` potrebbe puntare fuori dal perimetro). Base non risolvibile o `git` che fallisce → uscita 2 con messaggio (fail closed), non uscita 0.

### 2.4 Deroga: etichetta e chi la può applicare

**Etichetta proposta: `evidence-waiver`** (da creare; non esiste oggi). Significato: «il manutentore ha letto il diff delle evidenze di questa PR e accetta gli errori derogabili».

Come la CI la legge in sicurezza:

1. `pull_request` con tipi `labeled`/`unlabeled` (§2.2): applicare/togliere l'etichetta rilancia il job.
2. Non si fida di `github.event.pull_request.labels` (resta quello dell'evento anche in un «Re-run»): all'inizio del job si interroga lo stato corrente con `gh api repos/$REPO/issues/$N/labels` e gli eventi con `gh api --paginate repos/$REPO/issues/$N/events` (token `GITHUB_TOKEN`). Tutti i valori di contesto controllati dall'esterno (`head_ref`, titolo, nomi di etichette) entrano nei passi **solo via `env:`**, mai interpolati nel testo dello script (il `ci.yml` attuale già lo fa per `head_ref`; va mantenuto).
3. La deroga è valida solo se: l'etichetta è presente **e** l'ultimo evento `labeled` con quel nome ha `actor.login == github.repository_owner` **e** l'attore non è stato rimosso/riapplicato da altri dopo.

**Può l'account macchina auto-applicarsi l'etichetta?** Sì, a livello GitHub: Write include il triage (etichette), quindi senza controlli l'agente potrebbe etichettare la propria PR. Tre contromisure combinate:

- **Controllo dell'attore** (punto 3): l'etichetta applicata da qualunque login diverso dal proprietario viene ignorata e il report dice «waiver label applied by `<login>`, ignored». Per un repository personale l'unico amministratore è il proprietario; si evita la chiamata `collaborators/{user}/permission`, di cui non ho potuto verificare il permesso richiesto per `GITHUB_TOKEN` (la documentazione non lo indica).
- **Scadenza al push** (difetto sottile: l'etichetta applicata al commit A non deve coprire il commit B che l'agente spinge dopo): sull'evento `synchronize` il primo passo del job **rimuove l'etichetta** (`gh pr edit --remove-label`), richiede `pull-requests: write`; è fail-closed (se la rimozione fallisce, il passo successivo ignora comunque l'etichetta nei run `synchronize`). Effetto collaterale: «Update branch» è anch'esso un `synchronize`; il manutentore deve riapplicare l'etichetta. Accettabile e documentato.
- **Difesa di ultima istanza**: l'approvazione del code owner e `dismiss_stale_reviews_on_push` del ruleset (B01) restano comunque necessari per il merge; l'etichetta non sostituisce la revisione.

**Alternativa: deroga tramite approvazione.** Il job considera derogati gli errori se esiste una review `APPROVED` del proprietario con `commit_id == head.sha` (legata allo SHA per costruzione, scade da sola; richiede un trigger `pull_request_review`). Svantaggi: (a) GitHub vieta di approvare la **propria** PR, quindi le PR scritte dal manutentore stesso (oggi la maggior parte, incluse quelle di Claude Code finché non c'è D6) non potrebbero mai ottenere la deroga e andrebbero in bypass del check; (b) confonde «approvo la PR» con «accetto una violazione», cioè un errore «reviewed» in una PR di agente verrebbe derogato da un'approvazione frettolosa; (c) un trigger in più. **Raccomandazione: etichetta con controllo dell'attore e scadenza al push**; l'approvazione resta come condizione di merge, separata.

### 2.5 Politica dei percorsi per prefisso di ramo (R4)

Nuovo modulo puro `src/pipeline/policy.ts` (funzioni piccole, senza I/O, restituiscono `Issue[]`/flag come `diff.ts`) + CLI `src/cli/pr-policy.ts` (script `pnpm check:pr`) che raccoglie i dati (git, `gh api`) e li passa alle funzioni. Cosi i test unitari non toccano la rete.

Tabella (da confermare in D-B02-2/3):

| Prefisso (`head_ref`) | Percorsi ammessi | Stato ammesso | Note |
| --- | --- | --- | --- |
| `research/**` | `sources/incremental/**`, `sources/thematic/**`, `content/articles/**` | `sources/**`: solo **A** (aggiunta); `content/articles/**`: A e M, **non D** | niente `data/`, `src/`, `.github/`, `docs/`, `schemas/`, `sources/original/`, file di root |
| `agent/ingest-*` | `data/**` | A, M (D segnalata dal diff delle evidenze) | l'ingest scrive solo `data/` |
| altro `agent/**` | nessuna restrizione di percorso | tutti | lavoro di codice/documentazione di Claude Code con identità macchina (D6): diff severo, `CODEOWNERS` copre il resto |
| `dependabot/github_actions/**` (se D-B02-8 = sì) | `.github/workflows/**`, `.github/dependabot.yml` | M | |
| qualunque altro (`feat/`, `fix/`, `docs/`, `audit/`…, fork) | nessuna restrizione | tutti | diff delle evidenze severo comunque |

Regole globali, su **qualunque** ramo, non derogabili:

- file esistenti sotto `sources/original/**` e `sources/incremental/**`: nessuna `M`, `D`, rinomina (le `A` in `sources/incremental/` sono lecite);
- modo `120000`/`160000` ovunque nel perimetro ammesso;
- percorso con componenti `..` o assoluto (non dovrebbe esistere in Git, controllo di sanità a costo zero).

Ammesso per `research/**` il solo schema `Fonte_NN_*.md` + `Fonte_NN.proposals.json`? Il contratto M6 dice «esattamente due file». Lo si può verificare (conta A sotto `sources/incremental/` ≤ 2 e coppia di nomi coerente) ma Task B/C creano anche articoli e fonti tematiche: **non** lo impongo in B02; è un'estensione facoltativa dopo B10 (D-B02-9).

**Limite del criterio per prefisso (da dire chiaramente a B01/B10):** un ramo chiamato `feat/x` non subisce alcuna restrizione di percorso: l'agente potrebbe scegliere un altro prefisso. È il motivo per cui il diff delle evidenze è severo **per default** (V3 invertito: la regola non dipende dal nome) e per cui serve il ruleset 2 di B01 (D7) che costringe l'account macchina su `research/**` e `agent/**`. Complemento in CI (opzionale, D-B02-5): quando esisterà l'account macchina, un elenco `AGENT_LOGINS` (variabile del repository `vars.AGENT_LOGINS`, non nel codice) e la regola «autore ∈ `AGENT_LOGINS` ⇒ il ramo deve iniziare con `research/` o `agent/`», altrimenti errore non derogabile. Oggi tutto è autorizzato dal proprietario, quindi non cambia nulla finché D1 non è verificato.

### 2.6 Estensione del diff a `content/articles/` (V3 aggravante, P2)

Nuovo `src/pipeline/article-diff.ts` (pure), riuso di `splitFrontMatter` e dello schema `ArticleFrontMatterIt/En`. `before` da `git show`, `after` da albero di lavoro. Per coppia `<ID>.it.md` / `<ID>.en.md`:

| Cambio | Severità (strict) | Derogabile |
| --- | --- | --- |
| nuovo articolo con `review.status` ≠ `needs_review` | error | sì |
| `review.status` `needs_review` → `reviewed` (qualsiasi) | error («solo un revisore umano») | sì |
| traduzione `translation.status` → `reviewed` | error | sì |
| articolo `reviewed` modificato (front matter o corpo) | error | sì |
| articolo cancellato | error | sì |
| `fixture` cambiato, o file `ART-DEMO-*` aggiunto con `fixture:false` | error | sì |
| front matter non analizzabile | error | no |
| `links.*`: rimozione di un collegamento | attention | — |
| `links.*`: aggiunta di collegamento a record non `reviewed` (cioè quasi tutti oggi) | attention con l'elenco | — |
| `references`: numero di riferimenti diminuito | attention | — |
| `review.notes`, `generated_by`, `date`, `updated` cambiati | attention | — |
| testo `en` cambiato con `it` invariato (corpo/titolo/riassunto) | attention («traduzione modificata senza modifica dell'italiano») | — |
| `translation.source_hash` cambiato | attention | — |

Resta responsabilità di B09 la semantica di `reviewed` per gli articoli e l'obbligo dei link; qui il diff si limita a rendere visibile e (per `reviewed`) bloccante l'assenza di una decisione umana. Se B09 cambia le regole di transizione, si aggiornano solo queste righe.

### 2.7 Segnalazioni S5 nel diff dei dati

In `diffData`, per i record **modificati** (collezione `relationships`, più analoghi per `events`/`hypotheses`):

| Rilevamento | Severità su record non `needs_review` | Su record `needs_review` |
| --- | --- | --- |
| `predicate` cambiato (anche nello stesso gruppo) | **error** derogabile («riscrittura di predicato: attribuzione ↔ esecuzione») | attention |
| `caveat` rimosso (valore → `null`) o accorciato di più del 50% | **error** derogabile | attention |
| `evidence_status` cambiato a livello invariato | **error** derogabile | attention |
| `sources` con codici rimossi o sostituiti | attention (elenco `-S03 +S01`) | attention |
| `sources` solo aggiunte | non segnalato (appare nella tabella) | idem |
| `valid_from`/`valid_to`, `primary_url`, `relation_class` (stesso gruppo) cambiati | attention | attention |
| testo inglese cambiato con testo italiano invariato nello stesso oggetto (`*.en` senza `*.it`) | attention | attention |
| `review.notes` cambiato | non segnalato | idem |

Criterio per «non `needs_review`»: sono i record già visibili sul sito (`imported_unreviewed`, `reviewed`). Per i candidati `needs_review` (bozze di agente) i cambiamenti sono il lavoro normale e restano visibili nel diff; per i record già pubblici un cambiamento di significato deve richiedere una decisione esplicita. Motivo della soglia: evitare la fatica da deroga (un controllo che scatta sempre viene derogato sempre). Se il manutentore preferisce solo `attention` (D-B02-4), la tabella si riduce a una colonna.

Il rumore «concerns the named person X» resta (può essere raccolto in una riga per record, ma non cambia in B02).

### 2.8 Pinning degli SHA e manutenzione

- Sostituire ogni `uses:` con `owner/repo@<sha40> # vX.Y.Z` (§1.5). Aggiungere un test che verifica che **ogni** `uses:` in `.github/workflows/*.yml` abbia uno SHA di 40 esadecimali e un commento di versione.
- Coerenza con «latest releases only»: gli SHA corrispondono alla release più recente; la regola per il futuro è «SHA della release più recente, commento con la versione».
- Manutenzione: `.github/dependabot.yml`, ecosistema `github-actions`, `interval: weekly`, `open-pull-requests-limit: 5`, `commit-message.prefix: "chore(ci)"`; Dependabot sa riscrivere SHA + commento. Le sue PR toccano `.github/` e quindi richiedono sempre il code owner. Alternativa manuale: un promemoria nello script di verifica (`gh api …/releases/latest`). Raccomandazione: Dependabot per le sole action (le dipendenze npm restano fissate esattamente e aggiornate a mano, regola del progetto).

### 2.9 Verifica dei nomi e dei trigger come test

Un test Vitest legge `.github/workflows/*.yml` con il pacchetto `yaml` già nelle dipendenze e verifica: esistono i job `check` e `evidence-diff` con `name` identico; `evidence-diff` gira su `pull_request` con tipi che includono `labeled` e `unlabeled`; nessun `paths`/`paths-ignore` nei trigger; `concurrency` contiene `cancel-in-progress` espressione legata a `pull_request`; ogni `uses:` ha SHA. È la guardia che impedisce un futuro rename silenzioso che bloccherebbe tutte le PR.

---

## 3. Piano file per file

| File | Modifica |
| --- | --- |
| `.github/workflows/ci.yml` | concurrency per PR/SHA (§2.1); `name:` espliciti; SHA pinning; deploy con guardia «punta di main»; rimuovere il job `evidence-diff` |
| `.github/workflows/evidence-diff.yml` (nuovo) | trigger con `labeled`/`unlabeled`; checkout dello SHA di testa; passi: scadenza etichetta su `synchronize`, `pnpm check:pr`, `pnpm data:diff` (con `--relaxed` se `check:pr` lo ha stabilito); permessi minimi; SHA pinning |
| `.github/dependabot.yml` (nuovo, se D-B02-8) | ecosistema `github-actions` |
| `src/pipeline/diff.ts` | `strict` di default, `relaxed`, `waivable`, regole S5 (§2.7), flag nel report anche senza modifiche |
| `src/pipeline/article-diff.ts` (nuovo) | §2.6 |
| `src/pipeline/policy.ts` (nuovo) | `branchClass(headRef)`, `checkPaths(class, changes)`, `waiverStatus(labels, events, owner)`: tutte pure |
| `src/cli/data-diff.ts` | `--relaxed`, `--branch`, merge-base, `--no-renames -z`, articoli, uscita 2 sugli errori di git; `--agent` alias |
| `src/cli/pr-policy.ts` (nuovo) | raccoglie `head_ref`, elenco modifiche, etichette e attore via `gh api`; stampa il report; scrive `waiver=true|false` in `$GITHUB_OUTPUT` |
| `package.json` | script `check:pr`; test: nessun cambio a `check` (il diff gira solo su PR) |
| `test/diff.test.ts`, `test/policy.test.ts`, `test/article-diff.test.ts`, `test/workflows.test.ts` (nuovi) | §4 |
| `.github/pull_request_template.md` | riga su `evidence-waiver` |
| Documentazione | §5 |

### 3.7 Comando per ricontrollare gli SHA al momento dell'implementazione

```bash
for r in actions/checkout pnpm/action-setup actions/setup-node actions/upload-pages-artifact actions/deploy-pages; do
  tag=$(gh api repos/$r/releases/latest --jq .tag_name)
  t=$(gh api repos/$r/git/ref/tags/$tag --jq '.object.type+" "+.object.sha')
  [ "${t%% *}" = tag ] && sha=$(gh api repos/$r/git/tags/${t#* } --jq .object.sha) || sha=${t#* }
  echo "$r $tag $sha"
done
```

---

## 4. Piano di test

Tutti unitari (Vitest, sul modello di `test/diff.test.ts`), salvo dove indicato.

| Test | Copre | Atteso |
| --- | --- | --- |
| `diffData` senza opzioni: cancellazione, `reviewed`, promozione, nuovo `imported_unreviewed`, nuova relazione senza `primary_url` | **R3** | errori (uscita 1) su qualunque ramo; il vecchio «only warns outside agent mode» diventa «`relaxed` abbassa a attention e marca waived» |
| `diffData` con `relaxed`: stessi casi | R3 (deroga) | zero errori derogabili, errori `waivable:false` (provenance) restano |
| `waiverStatus`: etichetta applicata dal proprietario | R3 | valida |
| `waiverStatus`: etichetta applicata da un altro login (account macchina) | R3, auto-applicazione | ignorata, con motivo |
| `waiverStatus`: etichetta presente senza evento `labeled` coerente (rimossa e riapplicata da altri) | R3 | ignorata |
| `checkPaths("research/x", …)` per ognuno di: `data/…`, `src/…`, `.github/…`, `docs/…`, `schemas/…`, `package.json`, `sources/original/…` | **R4** | un errore per percorso, non derogabile |
| `checkPaths("research/x", A sources/incremental/Fonte_12.md + .proposals.json)` | R4 negativo | nessun errore |
| `checkPaths("research/x", M sources/incremental/Fonte_09….md)` e `D` | R4, regola 1 | errore |
| `checkPaths("research/x", D content/articles/ART-0001.it.md)` | R4 | errore |
| `checkPaths("agent/ingest-fonte-12", data/ + docs/)` | R4 | errore su `docs/` |
| `checkPaths("agent/work", src/…)`, `checkPaths("fix/x", src/…)` | decisione D-B02-2/3 | nessun errore di percorso |
| `checkPaths(any, M sources/original/…)` e rinomina | regola 1 globale | errore non derogabile |
| modo `120000` in `content/articles/` | sicurezza link simbolici | errore |
| parsing del `--raw -z --no-renames`: rinomina `data/entities/RU.json → docs/RU.json` | difetto 1.3-2 | due voci (`D` e `A`), rimozione del record rilevata |
| merge-base: ramo con `main` avanzato | difetto 1.3-3 | solo le modifiche della PR (test con repository Git temporaneo creato in `os.tmpdir`) |
| `diffMarkdown` con zero modifiche ma flag | difetto 1.3-1 | i flag compaiono |
| S5: `predicate` riscritto stesso gruppo; `caveat` rimosso; `evidence_status` cambiato; su record non `needs_review` | **S5** | error derogabile; su `needs_review` attention |
| S5: `sources` sostituito (`-S03 +S01`); `valid_from`; `primary_url` | S5 | attention con il dettaglio; sole aggiunte di fonti: nessun flag |
| S5: modifica del solo testo inglese | S5 | attention; italiano e inglese cambiati insieme: nessun flag |
| `article-diff`: nuovo articolo `reviewed`; `needs_review → reviewed`; traduzione `reviewed`; cancellazione; modifica di articolo `reviewed`; `links` rimossi; `references` ridotti; solo `en` cambiato | R3 per gli articoli, P2 | secondo la tabella §2.6 |
| `test/workflows.test.ts`: nomi dei job, tipi di evento, assenza di `paths`, concorrenza (`cancel-in-progress` dipende da `pull_request`, gruppo per SHA sui push), SHA a 40 caratteri con commento di versione | **R15** (parte statica), contratto sui nomi richiesti da B01 | verde |
| Verifica sullo stato di GitHub (non Vitest, comandi in B01 §5.1): dopo l'applicazione, `gh run list --branch main --json conclusion,headSha` senza `cancelled` per i commit successivi a T; PR di prova che tocca `src/` da `research/canary-b02` fallisce; poi con `evidence-waiver` del proprietario diventa verde per gli errori derogabili e **resta rossa** per la violazione di percorso | **R15**, R4 end-to-end | manuale, nel repository di prova per i punti che richiedono l'account macchina |
| R16 | non è di B02: `strict_required_status_checks_policy: true` nel ruleset (B01). Il test statico di B02 verifica solo che `evidence-diff` giri su PR | R16 | in B01 |

I test `test/workflows.test.ts` possono usare `yaml` (già dipendenza); nessuna nuova dipendenza.

---

## 5. Documentazione da aggiornare (nello stesso commit dell'implementazione)

- `docs/ARCHITECTURE.md`: struttura del repository (riga 109 «CI (evidence diff, Pages deployment)» → nuovo workflow e Dependabot); riga 86/412 (`pnpm data:diff`: `--relaxed`, articoli, severo di default); diagramma del flusso editoriale (righe 532–533: «agent/* branches: agent rules are errors» → «path policy by branch prefix; strict diff on every branch; maintainer waiver label»); punto «Evidence diff» (righe 541–553) riscritto; punto «Protection (adopted target)» con i nomi finali dei check richiesti e la nota «`evidence-diff` richiesto dopo il merge della PR finale»; sezione sulla CI/concorrenza (per-PR cancel, per-SHA su `main`, deploy solo sulla punta); tabella dei milestone se compare B02.
- `AGENTS.md`: elenco comandi (riga 77: `[--agent]` → `[--relaxed]`); regola per percorso al posto dei riferimenti a `agent/*` (righe 191–192 «ingest on an `agent/*` branch», 205–207 «`pnpm data:diff --agent` remains available for `agent/*` branches…»); nuova regola: «un ramo `research/*` può cambiare solo `sources/incremental`, `sources/thematic`, `content/articles`; l'etichetta `evidence-waiver` la applica solo il manutentore; non è mai lecito derogare `provenance` e `sources/original|incremental`».
- `CONTRIBUTING.md` (passo 4 di «Pull requests that change data»): la CI pubblica il diff delle evidenze **e** applica le regole severe su qualunque ramo; deroga solo con l'etichetta del manutentore; sezione italiana equivalente.
- `docs/M6_CHATGPT_OSINT_WORKFLOW.md` (righe 169, 305–314) e `docs/CHATGPT_SCHEDULED_TASKS.md` (righe 94, 106–110, 131 «stricter checks for `agent/*` branches», 133 sulla concorrenza): comando senza `--agent`, percorsi ammessi per prefisso, concorrenza aggiornata, avviso che il prefisso del ramo dei task deve essere `research/` (i prompt li applica il manutentore, blocco B10).
- `.github/pull_request_template.md` (riga 11): una riga su errori derogabili e `evidence-waiver`.
- `README.md` (riga 225): nessun cambio sostanziale; solo se si cita la regola per `agent/*`.
- **Nota per l'orchestratore (non modifico `B01_ANALYSIS.md`):** i check da richiedere sono `check` e `evidence-diff`; l'attivazione di `evidence-diff` va fatta dopo il merge della PR finale e dopo almeno un'esecuzione con il nuovo nome (già previsto in B01 §3.2); inoltre B01 §3.6 («Concorrenza CI») è risolto da questo blocco con il gruppo per SHA, non con `cancel-in-progress: false` da solo (che con `queue: single` annullerebbe comunque l'esecuzione pendente); B01 §3.3 (ruleset 2) deve richiamare che il prefisso `agent/` è usato da Claude Code locale con identità macchina e che la politica «altro `agent/**` senza restrizioni» è di B02 (D-B02-2).

---

## 6. Decisioni aperte per il manutentore

| # | Domanda | Opzioni | Raccomandazione |
| --- | --- | --- | --- |
| D-B02-1 | Come si deroga | (a) etichetta `evidence-waiver` con controllo dell'attore e scadenza al push; (b) approvazione del proprietario legata allo SHA; (c) nessuna deroga: usare solo il bypass del ruleset | **(a)**. (b) non copre le PR scritte dal proprietario (GitHub vieta l'auto-approvazione) e confonde approvazione e deroga; (c) obbliga a bypassare il check richiesto ad ogni correzione legittima. Nome etichetta alternativo: `allow-evidence-changes` |
| D-B02-2 | Percorsi di `agent/**` | (a) `agent/ingest-*` → solo `data/`; altri `agent/**` liberi; (b) tutti `agent/**` solo `data/` (comportamento attuale del flag `--agent`); (c) `agent/ingest-*` solo `data/` + `docs/audit/**` | **(a)**: B01 propone che Claude Code locale con identità macchina usi `agent/` (ruleset 2), quindi (b) bloccherebbe ogni suo lavoro su `src/` e `docs/`. Per l'ingest i comandi documentati usano già `agent/ingest-fonte-XX`. `docs/audit/**` non va aggiunto: l'ingest non lo tocca |
| D-B02-3 | Controlli di percorso sui rami del manutentore | (a) nessuna restrizione, diff severo; (b) restrizione «mista»: un ramo non può toccare insieme `data/` e `src/` senza etichetta; (c) restrizione per prefisso (`docs/` solo `docs/`, ecc.) | **(a)**. Il manutentore ha il bypass e il code owner; (b)/(c) generano deroghe senza ridurre un rischio reale. Il caso dell'agente che sceglie un prefisso «libero» è coperto dal ruleset 2 e dalla regola per autore (D-B02-5) |
| D-B02-4 | Cambi S5 su record già visibili | (a) error derogabile (predicato, caveat rimosso, stato di evidenza) come in §2.7; (b) solo `attention` | **(a)**, perché altrimenti nessun blocco impedisce la riscrittura `OFFICIAL_ATTRIBUTION → PERPETRATOR` su un record pubblico; con (b) l'avviso esiste ma non ferma nulla |
| D-B02-5 | Regola per autore (`vars.AGENT_LOGINS`) | sì / no / rimandare | **Rimandare** a quando D1 è verificato e l'account macchina esiste; predisporre solo il punto di estensione |
| D-B02-6 | Hardening contro la modifica del workflow nella stessa PR | (a) nessuno, affidarsi al code owner; (b) giro in contesto fidato con `pull_request_target`, che esegue lo script dal `main` e legge la PR solo come dati | **(a)** ora, (b) come blocco successivo: con `pull_request_target` il check si associa al commit base e non è verificabile qui che soddisfi un check richiesto sulla PR; richiede un canarino e tocca la sicurezza (nessun codice della PR deve essere eseguito) |
| D-B02-7 | Serializzazione di `main` | (a) gruppo per SHA + guardia «punta di main» sul deploy; (b) `queue: max` dopo conferma con canarino | **(a)** ora; rivalutare (b) se GitHub conferma la GA |
| D-B02-8 | Manutenzione dello SHA pinning | (a) Dependabot `github-actions` settimanale; (b) manuale con il comando §3.7; (c) Renovate | **(a)**: un solo file, le PR passano da code owner e dal diff severo; (b) come ripiego |
| D-B02-9 | Verifica «esattamente due file» per `research/*` | sì (coppia `Fonte_NN` md + sidecar) / no | **No in B02**: Task B/C scrivono anche articoli e fonti tematiche; rivalutare dopo B10 |
| D-B02-10 | Percorsi di `research/*` | confermare `sources/incremental`, `sources/thematic`, `content/articles`; Task B può proporre «aggiornamenti di evidenze separati» in `data/`? | Confermare i tre percorsi; gli aggiornamenti di evidenze di Task B devono passare come sidecar, non come modifiche a `data/` (coerente con la regola «Task A non tocca `data/`» e con R4) |

---

## 7. Rischi e limiti

1. **Un nome di check errato blocca tutte le PR** (B01 lo sa). Mitigazioni: nomi espliciti, test di contratto, attivazione in due tempi (prima merge e una esecuzione, poi ruleset).
2. **Autoreferenzialità della PR finale.** La PR finale contiene B02 e viene valutata dal **nuovo** `evidence-diff` (un workflow `pull_request` usa la versione della PR). Il ramo `audit/…` è un ramo del manutentore (nessuna restrizione di percorso) e non cambia `data/`: passa; ma il primo giro è anche la prima prova del job: servono un canarino prima (ramo `research/canary-b02`) e il controllo dell'esito.
3. **Etichetta e corse**: etichetta applicata a ridosso di un push viene rimossa dal passo di scadenza (fail-closed, il manutentore la riapplica); «Update branch» provoca lo stesso. Nelle PR da fork il token è in sola lettura: rimozione e lettura eventi possono fallire; la deroga non viene riconosciuta (sicuro).
4. **Permessi del `GITHUB_TOKEN` per gli eventi della PR** (`issues/{n}/events`, `issues/{n}/labels`) e per `pull-requests: write`: la documentazione che ho potuto leggere non è esplicita; si conferma col canarino. Se le letture falliscono, il job deve **fallire** (non derogare).
5. **Limite del criterio di prefisso** e **limite del `pull_request`** (§1.6, §2.5): ausilio di revisione, non barriera. L'unica barriera effettiva è la combinazione ruleset di B01 (revisione del code owner, bypass solo del proprietario, ruleset 2 per l'account macchina).
6. **Fatica da deroga**: se la soglia di errore è troppo ampia, `evidence-waiver` diventa abituale. La §2.7 limita gli errori a record già visibili.
7. **Costo CI**: un secondo `pnpm install` nel job `evidence-diff` (già oggi) e un run per ogni evento `labeled`/`unlabeled` (inclusi quelli di etichette di altre attività, per esempio `agent`); trascurabile (≈40 s) e con `cancel-in-progress` per PR.
8. **`queue`** e **comportamento dei check duplicati sullo stesso SHA** non verificati qui: evitati nel progetto (gruppo per SHA, nessun job `skipped` per tipo di evento).
9. **Retrocompatibilità del flag `--agent`** nei comandi documentati: mantenuto come alias fino a un blocco di pulizia.
10. L'estensione agli articoli duplica in parte controlli che B09 introdurrà (link obbligatori, transizioni): l'accoppiamento è solo sulla riga `reviewed` e va riletto in B09.

**Dimensione stimata del diff** (Sonnet alto): workflow ≈ 170 righe tra `ci.yml` modificato e `evidence-diff.yml` nuovo (+ Dependabot 12); `src/` ≈ 550 righe aggiunte (`policy.ts` ≈ 150, `article-diff.ts` ≈ 140, `diff.ts` ≈ +120, CLI ≈ +140); test ≈ 450 righe; documentazione ≈ 120 righe. Totale ≈ 1.300 righe aggiunte, ≈ 12 file nuovi o toccati nel codice, 7 nei documenti. Rischio di regressione contenuto: il comportamento di `pnpm check` non cambia; cambia solo il job di PR.

---

## 8. Prerequisiti e ordine di attuazione

1. Implementazione sul ramo unico (nessuna impostazione GitHub necessaria per scrivere il codice).
2. Creare l'etichetta `evidence-waiver` (azione del manutentore: `gh label create evidence-waiver --description "Maintainer accepts waivable evidence-diff errors for the current head commit" --color B60205`).
3. Canarino su un ramo `research/canary-b02` (modifica `src/` e `data/`): atteso rosso non derogabile sul percorso; ramo `fix/canary-b02` con `reviewed` impostato: atteso rosso, poi verde con l'etichetta del proprietario; push successivo: etichetta rimossa; etichetta applicata da un altro login (se esiste l'account macchina): ignorata.
4. Merge della PR finale; verificare una esecuzione di `evidence-diff` con il nome definitivo; poi, e solo allora, B01 aggiunge `evidence-diff` ai check richiesti (D4).
5. Verifica R15: `gh run list --branch main --json conclusion,headSha,createdAt` dopo T senza `cancelled`.

## 9. Decisioni del manutentore (14 novembre 2026)

Approvate tutte le raccomandazioni del §6: D-B02-1 (a) etichetta `evidence-waiver` con controllo dell'attore e scadenza al push; D-B02-2 (a); D-B02-3 (a); D-B02-4 (a); D-B02-5 rimandata (solo punto di estensione); D-B02-6 (a) ora, `pull_request_target` in un blocco successivo; D-B02-7 (a); D-B02-8 (a) Dependabot; D-B02-9 no in B02; D-B02-10 confermati i tre percorsi, aggiornamenti di evidenze di Task B solo come sidecar.

Nota: finché gli agenti agiscono con l'account del proprietario (B01 non applicato), il controllo dell'attore sull'etichetta non distingue manutentore e agenti.


## Verifica finale (2026-11-15)

Aggiunto `controlPlaneFlags` (`0d1afa9`): segnala come attention ogni modifica ai file che definiscono i controlli, su qualunque branch; non dipende dal prefisso e non è una barriera, perché il job esegue il codice della PR. L'etichetta `evidence-waiver` non esiste ancora nel repository e `evidence-diff` non è fra i check richiesti di `main`. Vedi [FINAL_HARDENING_2026-11-15.md](../FINAL_HARDENING_2026-11-15.md) §3.
