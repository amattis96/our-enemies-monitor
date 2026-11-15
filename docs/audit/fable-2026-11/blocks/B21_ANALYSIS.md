# B21 — Cadenze A/B/C: analisi

Data: 15 novembre 2026 (Europe/Rome). Ramo `audit/fable-2026-11-implementation`; HEAD iniziale `8e0fbfd` (B20). Esecuzione non sorvegliata su mandato del manutentore. Letture GitHub solo con `gh pr list --state all --json …` e `gh run list --json …` (sola lettura); nessuna impostazione, etichetta, task o prompt modificati.

Fonti rilette: scheda B21 (§3, §4, §5 di [IMPLEMENTATION_BLOCKS.md](../IMPLEMENTATION_BLOCKS.md)); FABLE B §7–§8; CONSOLIDATED_FINDINGS §3.2; AGENTS.md. Formato: B12 e le ADR di B18.

## 1. Stato verificato: la condizione d'ingresso non è soddisfatta

| Requisito della scheda | Stato al 15/11 | Come |
| --- | --- | --- |
| B01, B04, B10 **chiusi** | **No**: `committato` sul ramo dell'audit, non uniti su `main`; le impostazioni GitHub di B01 restano al manutentore | §5 del registro, `git log origin/main` |
| 2–4 cicli misurati | **No**: un solo ciclo di C osservato (venerdì 13/11, merge #11, #10, #3 fra 04:01:07 e 04:01:25 UTC); il prossimo è il 20/11. Nessun comando di misura esisteva | `gh pr list`, `gh run list` |
| Merge → ingest misurabile | **No**: nessun sidecar su `main`. Fonte_10/11 senza sidecar (eccezioni storiche); Fonte_12 (#18) e Fonte_13 (#19) aperte con sidecar | `gh pr list`, `sources/incremental/` |

Misura parziale con lo strumento di questo blocco (`--ref origin/main --since 2026-11-12T00:00:00Z --now 2026-11-15T03:00:00Z`; un ciclo incompleto, **non** un campione):

| Misura | Valore |
| --- | --- |
| K1 ritardo del cutoff | #18: 20 h, #19: 44,1 h dall'ultimo avanzamento (merge di #3, 13/11 04:01 UTC); #3 e #11 senza baseline precedente nella storia PR |
| K2 PR → merge (mediana / max) | fonti 4,2 / 8,5 h (4 PR); articoli 6,2 / 7,7 h (2); altre 0,1 / 18,8 h (10); ingest nessuna |
| K3 merge → ingest | nessun sidecar su `main`: non misurabile |
| K4 CI | push su `main` 15/19 riusciti (0,789; 1 fallito, 3 annullati, tutti il 13/11, V2); PR 25/35 (0,714) |
| K5 arretrato | 2 PR di fonti aperte (#18, #19), la più vecchia 27 h; 0 sidecar non ingeriti su `main` |

Conseguenza: **nessun cambio di cadenza o di prompt**. Il blocco consegna l'analisi, l'ADR-08 proposta e lo strumento per misurare i cicli.

## 2. Valutazione delle tre opzioni della scheda

| Opzione | Beneficio | Rischio / vincolo | Valutazione |
| --- | --- | --- | --- |
| Riordino del venerdì (C 02:30, B 05:00) | B lavora su `main` con le fonti della settimana; l'articolo non è rivisto dallo stesso ciclo che l'ha scritto (K2 articoli 6–8 h oggi) | Nessuno nuovo; l'articolo attende una settimana in più (positivo per la lettura umana) | **Prima da applicare** quando la condizione è soddisfatta: solo orari, reversibile |
| C-leggero quotidiano solo per `sources/` | K1 da fino a 6 giorni a ore | Sette volte più merge con identità condivisa (FABLE B «Che cosa non fare»); il limite a `sources/` oggi è solo nel prompt | **Rinviato**: solo dopo B01 applicato e con un limite tecnico ai percorsi; soglie in ADR-08 |
| Ingest deterministico che apre una PR `agent/ingest-*` | K3 da illimitato a una sessione | AGENTS.md vieta di collegare l'ingest alla CI o al merge | **Solo in forma locale** (già ammessa): `pnpm ingest` dal manutentore o da un agente locale su richiesta, PR mai unita in automatico; nessun workflow |

Raccomandazione: M1 al primo ciclo utile dopo la chiusura di B01/B04/B10 e due cicli misurati; M3 locale come abitudine dopo ogni merge di sidecar; M2 solo se K1/K5 superano le soglie di ADR-08.

## 3. Piano file per file

| File | Contenuto |
| --- | --- |
| `src/audit/cadence.ts` | Funzioni pure: `categorize`, `cutoffLag` (K1), `prToMerge` (K2), `mergeToIngest` (K3), `ciSuccess` (K4), `backlog` (K5), `cadenceReport`; normalizzazione delle righe `gh --json` |
| `src/cli/cadence.ts` | `pnpm cadence:measure --prs --runs [--since --until --now --ref --out]`: legge i due export e la storia first-parent di `--ref` (aggiunte di `sources/incremental/*.proposals.json` e `data/sources/*.json`, codice dal sidecar con `git show`); nessuna rete |
| `test/cadence.test.ts` | 7 test su fixture in memoria: categorie, K1–K5, finestra, `now`, determinismo; nessuna chiamata di rete |
| `docs/audit/fable-2026-11/adr/ADR-08_cadenze_abc.md` | ADR proposta: condizione d'ingresso, opzioni, regola di decisione |
| `docs/ARCHITECTURE.md`, `README.md`, `AGENTS.md` | Comando, layout, roadmap |

Non toccati: `docs/automation/CHATGPT_TASK_PROMPTS.md` (nessun testo deve cambiare finché l'ADR non è confermata), workflow, `data/`, `sources/`, `docs/M6_CHATGPT_OSINT_WORKFLOW.md`.

## 4. Decisioni (esecuzione non sorvegliata, 2026-11-15)

Adottate dall'orchestratore su mandato del manutentore, **da confermare**.

| # | Decisione | Opzioni | Adottata e motivo |
| --- | --- | --- | --- |
| D-B21-1 | Cambiare le cadenze ora? | (a) sì, M1; (b) no | **(b)**: condizione d'ingresso non soddisfatta (§1); il consolidamento §3.2 lo vieta |
| D-B21-2 | Nomi delle misure | (a) M1–M6; (b) K1–K5 | **(b)**: M1–M6 in FABLE B §8 sono i modelli di scheduling; le misure si chiamano K1–K5 per non confonderle |
| D-B21-3 | Fonte dei dati | (a) API GitHub dal comando; (b) export `gh --json` forniti + Git locale | **(b)**: il comando resta senza rete e riproducibile; l'export è un atto del manutentore |
| D-B21-4 | Definizione di «ingerito» | (a) commit con «ingest» nel messaggio; (b) prima aggiunta di `data/sources/<codice>.json` su `--ref` | **(b)**: coerente con `isIngested` (documento corpus creato dal primo `--write`), non dipende da testo libero |
| D-B21-5 | Ciclo | (a) settimana ISO; (b) finestra esplicita `--since/--until` | **(b)**: suggerita venerdì 05:00 → venerdì 05:00 Europe/Rome; nessuna data implicita |
| D-B21-6 | Archiviare la misura parziale | (a) file in `docs/audit/`; (b) solo valori in questa analisi | **(b)**: un ciclo incompleto non è un campione; gli export di input non sono archiviati |
| D-B21-7 | Ingest al merge | (a) workflow; (b) solo locale | **(b)**: AGENTS.md vieta di collegare l'ingest alla CI; un cambio richiede la decisione del manutentore |
| D-B21-8 | Soglie di ADR-08 | (a) nessuna; (b) indicative | **(b)**, dichiarate come proposte dell'agente, da tarare sui primi cicli |

## 5. Rischi e limiti

- K1 usa la storia delle PR: le prime PR di fonti (#3, #11) non hanno una baseline precedente nella storia PR (Fonte_09 fu importata senza PR di ricerca).
- La categoria `sources` dipende dai percorsi dei file della PR; una PR di A che toccasse altro finirebbe in `other` (segnale utile, non errore).
- `gh pr list --json files` restituisce al massimo 100 file per PR: irrilevante per le PR di A/B, può sottostimare `other`.
- K4 legge `conclusion`: esecuzioni in corso sono escluse; un push annullato su `main` è un merge non verificato (V2).
- Le soglie di ADR-08 non derivano da dati.

## 6. Esito

**Fatto.** Analisi con valutazione delle tre opzioni; [ADR-08](../adr/ADR-08_cadenze_abc.md) proposta; comando di sola lettura `pnpm cadence:measure` (K1–K5) con 7 test su fixture; documentazione aggiornata. Cadenze, prompt esterni, workflow e dati invariati.

**Verifica.** `pnpm check` verde: lint, typecheck, 333 test in 31 suite (7 nuovi), validate 0 errori/24 avvisi invariati, sidecar, articoli, schemi, M5, contrasto. Comando eseguito sugli export reali (§1). Nessun file del sito o di `data/` cambiato: build, `check:links` e `data:diff` non necessari.

**Azioni per il manutentore.**

1. Unire la PR finale dell'audit (chiude B01, B04, B10) e applicare le impostazioni di B01.
2. Per 2–4 venerdì: esportare `gh pr list --state all --limit 500 --json number,state,headRefName,createdAt,mergedAt,files` e `gh run list --limit 500 --json workflowName,event,headBranch,conclusion,createdAt`, poi `pnpm cadence:measure --prs … --runs … --since <ven 04:00Z> --until <ven successivo 04:00Z> --out docs/audit/cadence/cadence-<data>.json`.
3. Eseguire `pnpm ingest` (locale, ramo `agent/ingest-*`) dopo il merge di Fonte_12, così K3 diventa misurabile.
4. Confermare o modificare ADR-08 e le soglie; solo allora applicare M1 nei task ChatGPT (testo da preparare in `docs/automation/CHATGPT_TASK_PROMPTS.md` in quel momento).
