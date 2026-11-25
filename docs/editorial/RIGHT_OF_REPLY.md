# Diritto di replica e rettifiche / Right of Reply and Corrections (PK-17)

Questa procedura disciplina il diritto di replica, la segnalazione di errori fattuali, l'apporto di evidenze documentali e la gestione dei dati personali (D12) in **Our Enemies Monitor (OEM)**.

This procedure governs the right of reply, factual error reporting, submission of documentary evidence, and personal-data handling (D12) in **Our Enemies Monitor (OEM)**.

---

## 1. Canali per portare un'evidenza / Bring evidence channels

### Casi ordinari (fonti pubbliche e correzioni fattuali) / Ordinary cases (public sources and factual corrections)
- **Canale / Channel:** Segnalazione pubblica su GitHub tramite modulo precompilato (*Porta un'evidenza / Bring evidence*):
  `https://github.com/amattis96/our-enemies-monitor/issues/new?labels=correction,evidence&title=Rettifica+%2F+Evidence%3A+&body=...`
- **Requisiti / Requirements:** Indicare l'ID del record interessato (es. `EXT-001`, `ENT-001`), la fonte primaria verificabile con data e URL, cosa è noto rispetto a ciò che è dedotto, ed eventuali prove contrarie.

### Evidenze sensibili e repliche personali / Sensitive evidence and personal replies (D12)
- **Canale riservato / Private channel:** Le repliche riguardanti persone fisiche nominate, dati personali non necessari, materiale riservato o documenti non pubblicabili **non** devono essere inviate tramite issue pubbliche su GitHub.
- **Istruzioni / Guidance:** Contattare direttamente il titolare attraverso il canale privato indicato nella pagina `/rettifiche` (contatto diretto riservato al titolare del repository `amattis96`), specificando l'ID del record, la qualifica del richiedente e i documenti a supporto. Il materiale ricevuto viene trattato nel dominio riservato prima di qualsiasi proiezione pubblica.

---

## 2. Tempi di risposta dichiarati / Declared response times

| Fase / Stage | Termine / Timeframe | Ambito / Scope |
| --- | --- | --- |
| **Presa in carico / Acknowledgement** | Entro **48 ore** / Within **48 hours** | Conferma di ricezione e assegnazione di un riferimento tracciabile. |
| **Contenimento urgente D12 / Urgent D12 containment** | Entro **24 ore** / Within **24 hours** | Sospensione cautelativa dalle proiezioni controllate per violazioni D12, dati personali non necessari o errori gravi documentati. |
| **Valutazione iniziale / Initial triage & review** | Entro **5 giorni lavorativi** / Within **5 business days** | Verifica della fonte primaria, valutazione probatoria e decisione preliminare. |
| **Esito e pubblicazione / Resolution & publication** | Entro **10 giorni lavorativi** / Within **10 business days** | Aggiornamento del registro delle rettifiche (`docs/retractions/register.v1.json`) e collegamento della replica alla scheda. |

---

## 3. Moderazione e criteri editoriali / Moderation and editorial criteria

1. **Base probatoria / Evidentiary basis:** Le richieste devono indicare affermazioni specifiche e fonti verificabili o ragioni giuridico-procedurali documentate.
2. **Nessuna rimozione arbitraria / No arbitrary takedowns:** Richieste generiche, intimidatorie, prive di riferimento ai record o mirate a rimuovere fatti giudiziari/istituzionali documentati senza prova contraria non comportano la cancellazione del record.
3. **Trasparenza della storia / Transparent history:** I fatti storici canonici non vengono cancellati silenziosamente (`historical_facts_mutated: false`). Le rettifiche e gli avvisi di revisione restano visibili in `/rettifiche` e collegati ai record interessati.
4. **Copie non controllabili / Uncontrollable copies:** OEM garantisce il contenimento e l'aggiornamento esclusivamente sulle proiezioni controllate da OEM; release immutabili, archivi esterni, DOI, copie scaricate, fork e cache di terze parti restano fuori dal controllo diretto di OEM.

---

## 4. Trattamento dei dati personali (D12) / Personal-data handling (D12)

- **Minimizzazione / Minimization:** Dati personali non necessari, materiale acquisito impropriamente o non più conservabile vengono rimossi o oscurati lasciando esclusivamente una traccia amministrativa minima nel registro delle rettifiche.
- **Persone nominate / Named persons:** Nessuna relazione riguardante una persona fisica viene pubblicata sul portale senza fonte primaria collegata, data e stato procedurale esatto.
- **Separazione dei domini / Domain separation:** Le repliche personali contenenti dati sensibili non transitano su issue pubbliche, log CI o provider AI non autorizzati.

---

## 5. Repliche collegate alle schede / Linked replies to records

Ogni replica accolta o in revisione viene collegata all'ID canonico del record interessato (ad esempio `EXT-001`) e pubblicata nella pagina `/rettifiche` con:
- stato della revisione (`open`, `contained`, `resolved`);
- sintesi bilingue della replica o dell'avviso di revisione;
- collegamento diretto alla scheda canonica e alle fonti citate.
