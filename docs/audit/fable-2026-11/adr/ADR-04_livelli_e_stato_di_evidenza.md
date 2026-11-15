# ADR-04 — Significato di E1–E4 e di `evidence_status`

- **Stato:** Proposta (non sorvegliata, da confermare)
- **Data:** 2026-11-15 · **Blocco:** B18 · **Sostituisce:** la coerenza provvisoria di D-B03-6 solo come motivazione, non come regola
- **Riferimenti:** FABLE A §4.2 e P9; FABLE B V9; CF-014; [B03](../blocks/B03_ANALYSIS.md) D-B03-6; [B18](../blocks/B18_ANALYSIS.md)

## Contesto

Ogni relazione porta `evidence_level` (E1–E4) ed `evidence_status` (codice originale di Fonte_07). Nei dati i due campi coincidono uno a uno (E1/`documented`, E2/`institutional_attribution`, E3/`corroborated`, E4/`allegation`); B03 ha reso la coppia vincolante nel validatore. Il sito mostra entrambi, come se fossero due valutazioni. Il codice in parte tratta la scala come ordinale (scelta del «più basso» in Fonte_09, livelli «raised» nel diff).

## Decisione proposta

1. **E1–E4 sono tipi di base probatoria della singola affermazione, non gradini.** E1 atto o documento primario sull'atto specifico; E2 attribuzione istituzionale (non una condanna); E3 inchiesta indipendente; E4 accusa. Il livello descrive il sostegno a quella affermazione, non l'entità né l'evento nel suo insieme. È già il testo di `vocabulary.json#/evidence_levels` e `scale_note` (B13).
2. **`evidence_status` non ha un significato proprio.** Resta sulle relazioni come codice di provenienza di Fonte_07, accoppiato uno a uno al livello (regola di B03 confermata), solo per compatibilità di `data/v1` (ADR-10). Non si aggiunge a nuovi modelli: `Claim` (ADR-06) porta solo `evidence_level`, e la differenza fra attribuzione e giudizio è nel `kind` del claim, non in un secondo campo di stato.
3. **Il livello di un claim non si inventa:** è `null` oppure è copiato da una relazione elencata nel claim che porta la stessa affermazione (errore di validazione altrimenti).
4. La rimozione di `evidence_status` dalle esportazioni è possibile solo in una versione `v2` (ADR-10), mai in `v1`.

## Conseguenze

- Nessun dato cambia; la validazione di B03 resta invariata.
- Correzione post-audit (2026-11-15): il diff segnala ora ogni cambio di livello in entrambe le direzioni (`evidence level changed`), non solo il «raised» ordinale; il Tracciato (B16) non indica più un «anello più debole» ma la composizione probatoria del cammino (conteggi per livello). Nessuna relazione è stata riclassificata.
- La «scelta del più basso» di Fonte_09 è stata una decisione dell'import manuale, non codice: i record restano invariati; un'eventuale revisione è editoriale.
- Resta da correggere a parte: la visualizzazione doppia livello/stato sulle pagine.

## Alternative scartate

- Dare a `evidence_status` un significato indipendente (per esempio stato del procedimento): richiederebbe una riclassificazione editoriale di 458 relazioni e cambierebbe il significato di un campo `v1`.
- Rimuovere subito `evidence_status`: rottura di `v1`.
