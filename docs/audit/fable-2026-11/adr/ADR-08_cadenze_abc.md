# ADR-08 — Cadenze dei task A/B/C

- **Stato:** Proposta (non sorvegliata, da confermare)
- **Data:** 2026-11-15 · **Blocco:** B21
- **Riferimenti:** FABLE B §7.2, §8 (modelli M0–M6); CONSOLIDATED_FINDINGS §3.2 «Cadenze: non modificarle adesso», CF-008; AGENTS.md («Scheduled research and M6 agent guidance», «Governance»); [B21](../blocks/B21_ANALYSIS.md)

## Contesto

A gira ogni giorno alle 01:00, B il venerdì alle 03:00, C il venerdì alle 05:00 (Europe/Rome). Con il merge settimanale la finestra di ricerca di A non avanza fra un venerdì e l'altro, B scrive su un `main` privo delle fonti della settimana e C rivede l'articolo di B due ore dopo; l'ingestione dei sidecar non è coperta da nessun task (FABLE B §7.2). Il consolidamento vieta di cambiare le cadenze prima di CF-001–005 e senza misure.

## Condizione d'ingresso (da soddisfare prima di applicare qualsiasi opzione)

1. B01 (identità e merge), B04 (ingest) e B10 (istruzioni) **chiusi**, cioè uniti su `main` con la PR finale dell'audit, e le impostazioni di B01 applicate dal manutentore.
2. **2–4 cicli settimanali misurati** con `pnpm cadence:measure` (finestra venerdì 05:00 → venerdì 05:00), archiviati come file datati, con:
   - K1 ritardo del cutoff (ore dall'ultimo avanzamento della baseline a ogni PR di A);
   - K2 PR → merge per categoria;
   - K3 merge → ingest per sidecar;
   - K4 tasso di successo della CI (push su `main` e PR);
   - K5 arretrato (PR aperte per categoria, sidecar non ingeriti).

Al 15 novembre 2026 la condizione **non è soddisfatta**: i tre blocchi sono committati sul ramo dell'audit ma non uniti; è stato osservato un solo ciclo di C (13 novembre); nessun sidecar è ancora su `main`, quindi K3 non è misurabile.

## Opzioni valutate

| Opzione | Effetto atteso | Rischio | Prerequisito |
| --- | --- | --- | --- |
| **M1** Riordino del venerdì: C 02:30, B 05:00 | B lavora su `main` con le fonti della settimana; l'articolo di B non è rivisto dallo stesso ciclo | Nessuno nuovo; l'articolo attende C della settimana dopo (più tempo per la lettura umana) | Solo orari |
| **M2** C-leggero quotidiano solo per `sources/` | K1 scende da giorni a ore; la coda di A non cresce | Moltiplica per sette i merge; con identità condivisa sono atti non revisionati (FABLE B «Che cosa non fare») | B01 applicato (identità distinta, ruleset); C-leggero non può unire nulla fuori da `sources/` (regola tecnica, non solo prompt); K4 stabile |
| **M3** Ingest deterministico che **apre** una PR `agent/ingest-*` | K3 da illimitato a una sessione; nessuna inferenza | Un workflow con `contents: write` e `pull-requests: write`; **AGENTS.md vieta di collegare l'ingest alla CI o al merge** | Nella forma ammessa oggi: comando locale eseguito dal manutentore o da un agente locale su richiesta (`pnpm ingest` → PR), mai unito in automatico, candidati sempre `needs_review` |

## Decisione proposta

1. **Nessun cambio ora.** Orari e prompt esterni restano quelli del 14 novembre.
2. **Prima opzione da applicare quando la condizione è soddisfatta: M1**, perché costa solo un cambio di orario, è reversibile e non aumenta gli atti non revisionati.
3. **M3 solo nella forma locale**: dopo ogni merge di un sidecar il manutentore (o un agente locale su sua richiesta) esegue `pnpm ingest` su un ramo `agent/ingest-*` e apre la PR, come già previsto da AGENTS.md. Un workflow GitHub che lo faccia al merge richiede una modifica esplicita di AGENTS.md decisa dal manutentore: questa ADR non la propone.
4. **M2 rinviato** finché, dopo B01 applicato, K1 mediano resta sopra 48 ore **e** K5 mostra più di 3 PR di fonti aperte per 2 cicli consecutivi.

### Regola di decisione sulle misure

| Misura (mediana su 2–4 cicli) | Soglia indicativa | Azione |
| --- | --- | --- |
| K1 > 48 h e K5 fonti aperte > 3 | due cicli consecutivi | valutare M2 (dopo B01) |
| K3 > 72 h o sidecar non ingeriti ≥ 1 al venerdì | un ciclo | rendere abituale l'ingest locale (M3 locale) |
| K4 push su `main` < 0,9 | un ciclo | nessun aumento di frequenza dei merge; prima correggere la CI |
| K2 `articles` < 4 h | un ciclo | segnale che l'articolo non ha avuto lettura umana: confermare M1 |

Le soglie sono proposte dall'agente, non derivate da dati: vanno confermate dal manutentore dopo i primi cicli.

## Conseguenze

- Il ritardo di FABLE B §7.2 resta finché M1 non è applicato; è un costo accettato in cambio di non moltiplicare merge non revisionati.
- Le misure diventano riproducibili: stessi export `gh` + stesso ref → stesso JSON.
- Nessun task può impostare `reviewed`, `human_approved` o unire PR `agent/ingest-*` in nessuna opzione.

## Alternative scartate

- Aumentare la frequenza di C nella forma attuale (FABLE B §8, «Che cosa non fare»).
- Workflow di ingest al merge (M3 nella forma di FABLE B): vietato da AGENTS.md finché il manutentore non cambia la regola.
- M4 (dossier di preparazione), M5 (corsia rettifiche), M6 (cadenza variabile di A): fuori dalla scheda B21; M6 richiede la misura «voci nuove per fonte quotidiana», calcolabile solo quando i sidecar saranno su `main`.
