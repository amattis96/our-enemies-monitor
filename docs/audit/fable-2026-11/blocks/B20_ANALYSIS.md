# B20 — Pacchetti per record, JSON-LD, feed: analisi

Data: 15 novembre 2026 (Europe/Rome). Ramo `audit/fable-2026-11-implementation`; HEAD iniziale `2ae818e` (B19). Esecuzione non sorvegliata su mandato del manutentore. Nessuna scrittura in `data/`, `sources/`, `provenance` o stati di revisione: `data/v1/` è il percorso delle esportazioni del sito costruito.

Fonti rilette: scheda B20 e ADR-10 di [IMPLEMENTATION_BLOCKS.md](../IMPLEMENTATION_BLOCKS.md); FABLE D §§6, 7, 11.3–11.7, 14.3, A6–A11, A14–A15; formato: [B13_ANALYSIS.md](B13_ANALYSIS.md).

## 1. Stato verificato

| Punto | Stato all'ingresso |
| --- | --- |
| Esportazioni | `exportFiles` (B13) produce catalogo, vocabolario, collezioni, grafi, `withheld.json`, `inferences.json`, schemi; la rotta generica `[file].json.ts` serve solo i file senza `/` e il manifest ne copre i byte. Nessun pacchetto per record (baseline D T10: 0) |
| Pagine | Nessun `<link rel="canonical">`, nessun JSON-LD, 2 pagine con `<time>` (baseline D T11: 885 pagine, 0/0/2). `Base.astro` emette già gli `alternate` hreflang |
| Sitemap | `@astrojs/sitemap` attivo, senza `lastmod` |
| Cronologia | `dataHistory()` (Git) alimenta `/changes/`; il filtro sui record pubblicati è nella pagina |
| Articoli | `loadPublishedArticles`: `reviewed` (o fixture) con tutti i record e le fonti collegati pubblici; 2 articoli reali (`ART-0001`, `ART-0002`), nessun fixture nel contenuto |
| Trattenuti | 138 ID nel registro (34/18/25/10/51/0); 873 record pubblici; gli ID sono unici fra collezioni |
| Fuga preesistente? | Verificata: nessuna nei file pubblici. Un controllo ingenuo trova `AP` (editore «AP» di un evento) e `EXT-001…004` (campo `provenance.original.id`, riga originale della baseline): non sono riferimenti a record, ma mostrano che la guardia deve guardare solo posizioni strutturali |

## 2. Piano file per file

| File | Intervento |
| --- | --- |
| `src/site/packages.ts` (nuovo) | `buildRecordPackages` (record invariato, `cite_as` legato al commit con permalink Git, pagine relative, `related` = ID pubblici collegati in avanti e all'indietro, ordinati), `buildArticlesIndex`/`publicArticles` (gate di pubblicazione, fixture esclusi), `buildChangesFeed` (JSON Feed 1.1, ultimi 50 commit con record pubblicati aggiunti/modificati) |
| `src/site/jsonld.ts` (nuovo) | `serializeJsonLd` (escape di `<`, `>`, `&`, U+2028/2029), `datasetJsonLd`, `articleJsonLd` (nullo per i fixture) |
| `src/site/sitemap.ts` (nuovo) | `recordLastmods` (commit più recente che ha toccato il record pubblico), `lastmodResolver` (record, articolo `updated ?? date`, altrimenti data del commit esportato), `repositoryLastmodResolver` |
| `src/site/surface.ts` (nuovo) | Guardia A15: `withheldIdSet`, `leakedIds` (solo chiavi ID e stringhe tipo percorso; `provenance` saltata), `leakedInSitemap` |
| `src/site/exports.ts` | `exportFiles` aggiunge `articles.json`, `changes.feed.json`, `records/<ID>.json` (parametri `history` e `articles` iniettabili, con cache come `exportCommit`); il catalogo dichiara `record_packages` e i due file |
| `web/src/lib/model.ts`, rotte `data/v1/*` | `getExports()` costruisce una volta file e manifest; nuova rotta `records/[id].json.ts`; manifest, schemi e rotta generica la riusano |
| `web/src/layouts/Base.astro` | `canonical` su ogni pagina tranne la 404, prop `alternates` (link `rel="alternate"`), prop `jsonLd` |
| Pagine | Evento, entità, ipotesi, fonte: `alternate` verso il pacchetto; articoli: `alternate` Markdown e JSON-LD `Article`; `/data/`: JSON-LD `Dataset`, riga riassuntiva dei pacchetti; `/changes/`: `alternate` del feed e collegamento; `DateRange.astro` produce `<time datetime>` (evento, articolo, modifiche, data) |
| `web/astro.config.ts` | `serialize` della sitemap imposta `lastmod` dal resolver |
| `src/cli/check-links.ts` | Dopo la build verifica che nessun ID trattenuto compaia in pacchetti, indice articoli, feed, catalogo, sitemap e JSON-LD di ogni pagina |
| `test/packages.test.ts` (nuovo, 18 test) | Un pacchetto per record e record identico alla proiezione; `cite_as` legato al commit; `related` solo pubblico e simmetrico; articoli non pubblicabili/fixture/con link trattenuti esclusi; feed filtra rimossi e non pubblici e limita a 50; JSON-LD sicuro e privo di fixture; `lastmod` senza orologio; assenza di ID trattenuti su tutto il registro reale; manifest con SHA-256 di ogni pacchetto |
| Documentazione | `docs/ARCHITECTURE.md` (struttura, endpoint, contratto B20), `README.md` (dati e roadmap), `AGENTS.md` (ogni output leggibile da macchina deriva dalla proiezione pubblica e resta nel test di fuga) |

Fuori perimetro: Atom (il JSON Feed riusa rotta e manifest), `statements.ndjson`, JSON-LD per eventi/entità (rischio di dare forma di fatto a un record), nuove definizioni nel vocabolario.

## 3. Decisioni (esecuzione non sorvegliata, 2026-11-15)

Adottate dall'orchestratore su mandato del manutentore, **da confermare**.

| ID | Domanda | Opzioni | Adottata e motivo |
| --- | --- | --- | --- |
| D-B20-1 | Contenuto del pacchetto | solo il record; record + citazione + record collegati; record + rendering testuale | **Record invariato + `cite_as` + `related`**: stessa proiezione pubblica (nessun dato nuovo), compatto (873 file, 3,4 MB sul disco, 1,6 MB di byte JSON); i collegamenti sono solo ID pubblici |
| D-B20-2 | URL nei pacchetti | URL assoluti dal `SITE_URL`; percorsi relativi + permalink Git | **Percorsi relativi al sito + permalink Git al commit**: i file restano identici per commit su qualsiasi mirror (B13), la citazione stabile è il permalink |
| D-B20-3 | Pacchetti in `manifest.files` | sì, uno per file; solo un riepilogo | **Sì, uno per file** (richiesto: hash di ogni file); la pagina `/data/` mostra una riga riassuntiva |
| D-B20-4 | Formato del feed | Atom; JSON Feed | **JSON Feed 1.1** (`changes.feed.json`): riusa rotta generica, manifest e determinismo; Atom resta possibile |
| D-B20-5 | Fixture negli output macchina | includere con flag; escludere | **Escludere** da `articles.json` e JSON-LD: i contenuti di prova non devono sembrare analisi reali; le pagine con banner restano |
| D-B20-6 | `lastmod` | orologio di build; Git/date dei record | **Git e date degli articoli**; pagine senza record: data del commit esportato. Nessun orologio |
| D-B20-7 | JSON-LD | anche eventi/entità/relazioni; solo `Dataset` e `Article` | **Solo `Dataset` e `Article`** (come da scheda): niente strutture che diano forma di fatto ai record; l'autore dell'articolo non è dichiarato (generato da IA) |
| D-B20-8 | Guardia A15 | solo test; test + controllo post-build | **Entrambi**: il test sul registro reale e `check:links` sul sito costruito, con riconoscimento solo strutturale degli ID (non del testo libero) |
| D-B20-9 | Misura B12 T11 | cambiare il codice di misura; solo rieseguirla | **Solo rieseguirla** (`pnpm benchmark:measure --pages web/dist`): T10 0 → 873, T11 json_ld 0 → 6, canonical 0 → 930, time 2 → 304 su 931 pagine. Baseline archiviata non modificata |

## 4. Rischi e limiti

- `cite_as.text` e i permalink cambiano a ogni commit, quindi cambia l'hash di ogni pacchetto: è voluto («citazione per commit») ma rende il manifest voluminoso (~100 KB).
- Il commit citato è quello del checkout di build: con modifiche non committate il permalink non è ancora risolvibile.
- La guardia strutturale riconosce gli ID nelle chiavi note e nei percorsi; un ID trattenuto in un nuovo campo libero non sarebbe visto finché la chiave non è aggiunta a `ID_KEYS` (il test sul registro reale lo rivelerebbe solo se il campo contiene un ID in posizione nota).
- `related` è derivato dai campi `subject/object/events/sources`; nessun legame causale o di controllo è creato, ma il lettore automatico non vede il tipo di relazione: rinvia al record della relazione.
- Il feed mostra l'oggetto dei commit Git (inglese) come la pagina `/changes/`; se un oggetto citasse un ID trattenuto sarebbe pubblico (verificato assente oggi).

## 5. Azioni per il manutentore

1. Confermare o correggere D-B20-1…9.
2. Decidere se aggiungere Atom e un `statements.ndjson` (D A8), e se pubblicare JSON-LD anche per i record.
3. Rileggere i testi bilingui nuovi su `/data/` (descrizione dei pacchetti, feed e indice articoli).

## 6. Esito

**Fatto.** Pacchetti `data/v1/records/<ID>.json` (873), `articles.json`, `changes.feed.json`, catalogo aggiornato, rotte e manifest con SHA-256 di ogni file; `canonical`, `alternate`, `<time>`, JSON-LD (`Dataset` su `/data/`, `Article` sulle pagine articolo), sitemap con `lastmod` da Git; guardia A15 in test e in `check:links`; documentazione aggiornata. Nessun cambio a `data/`, `sources/`, stati di revisione, schemi o validazione.

**Verifica.**

- `pnpm check` verde: 326 test in 30 suite (308 → 326); `validate` 0 errori/24 warning invariati.
- `pnpm build` verde (931 pagine); `pnpm check:links`: 177.441 link interni, 876 file macchina e sitemap senza ID trattenuti, 0 problemi.
- Browser (anteprima locale): `/en/data/` con JSON-LD `Dataset`, canonical, riga dei pacchetti e `<time>`; articolo `ART-0001` con JSON-LD e alternate Markdown; `records/H06.json` serve il pacchetto con `cite_as`.
- Misura B12 rieseguita (D-B20-9).
- `data/` non modificata: `pnpm data:diff` non necessario.

**Resta.** Conferma delle decisioni e rilettura dei testi (§5); Atom, `statements.ndjson` e JSON-LD dei record non fatti.

## Correzione post-audit (2026-11-15)

`cite_as.repository_permalink` rimandava al record canonico in `data/`, che può differire legittimamente dalla proiezione esportata (es. `H08`: eventi, fonti e note non pubblicabili). Ora `cite_as` cita la proiezione pubblica (`cites: public_projection`, versione dell'export, commit, `package_path`, `record_sha256` sul solo membro `record`, quindi senza hash circolare; il file intero resta nel manifest) e il permalink Git passa in `canonical_source`, marcato `relation: filtered | identical` in base a `PublicationReport.transformed`. Nessun ID trattenuto entra nei pacchetti (solo il flag). Test in `test/packages.test.ts` per `H08` e per un record identico.
