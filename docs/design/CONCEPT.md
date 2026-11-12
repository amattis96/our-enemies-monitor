# Concept

## One sentence

> **A broadsheet that runs its own situation room:** the reader is welcomed
> by an authoritative political newspaper, and one click away sits the
> operations console where every claim can be checked down to its source.

The two halves are not two websites with two skins. They are two *registers*
of one system, held together by shared tokens, one icon family and, above
all, one **evidence grammar** that looks the same in an article, a timeline
row, an atlas panel and a thread on the investigation board.

## Why this concept fits the project

The project's value is evidentiary discipline. The design therefore has two
jobs that pull in opposite directions:

- **Make complex material legible** to a non-specialist reader: hierarchy,
  narrative, calm typography, explanations of what a link does *not* prove.
- **Expose the machinery** to researchers and journalists: IDs, dates with
  their precision, evidence levels, sources, filters, exports, review status.

A newspaper solves the first; a crisis-room dashboard solves the second. The
crossing point is the *dossier*: a folder that opens like a story and
contains the exhibits.

## The three registers

| Register | Mood | Where | Type | Density | Surfaces |
| --- | --- | --- | --- | --- | --- |
| **Press** | Authoritative, calm, editorial | Home (Observatory), Investigations, articles, methodology, entity/event narrative | Newsreader serif leads; Plex Sans for UI | Low; generous measure (66ch) | Newsprint paper, hairline and heavy rules, square corners |
| **Console** | Precise, operational, quiet | Timeline, atlas, dependencies, archive lists, data, changes, search | Plex Sans leads; Plex Mono for codes, dates, numbers | High; panels, sticky filter bars, tabular figures | Raised panels with 4 px radius, sunken wells for controls |
| **Board** | Tactile, investigative, a little theatrical | Network (evidence board) and hypotheses board | Plex Mono "typewritten" labels on paper cards, serif titles | Medium; semantic zoom | Cork, paper cards, pins, sagging threads |

The registers are chosen **per region, not per theme**: light and dark are
available everywhere. Light defaults to *Press* paper; dark is the *Console*
night room. A Console page in light mode is still a console (dense, mono
figures) printed on paper; a Press article in dark mode is still a newspaper
read under the lamp of the operations room.

## Design principles

1. **Evidence is a first-class visual element.** Every relationship, event
   attribution and article claim shows its level with the evidence stamp:
   glyph (shape) + code + label, plus a thread pattern on the board. Colour
   never encodes evidence.
2. **Separate claims look separate.** Event, perpetrator, sponsor, motive and
   impact are separate rows/cards with separate stamps. Participation is
   drawn as a neutral thread, never as control. Hypotheses live on their own
   board, behind a labelled tape, only in red thread.
3. **Say what it does not prove.** Each exploratory view carries a short
   "limits" note with an explanatory illustration (not-transitive,
   location-not-responsibility, separate-claims, dependency-not-coercion).
4. **Newspaper calm, console precision.** No neon, no fake military HUD, no
   glowing radars. The crisis room is a ministry room: graphite, paper, ink,
   one red signal colour used sparingly.
5. **Every view has a text twin.** The board has a list view, the atlas a
   country table, the timeline is already text; no information is available
   only by pointing at a picture.
6. **One click from story to exhibit.** From an article you open an entity,
   its board neighbourhood or its timeline; from the board you reach the
   investigations that cite a node.
7. **Honest provenance chrome.** Review status, machine translation, pending
   integration and DEMO/TEST fixtures are always visible, in a consistent
   place and form.

## Information architecture

Three areas replace the current flat list of twelve links.

```
Our Enemies Monitor
├── Osservatorio / Observatory        (home: front page)
├── Indagini / Investigations         (articles, by theme, region, actor)
├── Esplora / Explore                 (the console)
│   ├── Cronologia / Timeline
│   ├── Bacheca / Evidence board      (network, evidence mode)
│   │   └── Bacheca delle ipotesi / Hypotheses board
│   ├── Atlante / Atlas
│   ├── Dipendenze / Dependencies
│   └── Archivio / Archive            (entities, hypotheses, sources as tabs)
└── Metodo / Method                   (secondary: methodology, data & downloads, changes)
     + global: search (⌘K), language, theme
```

- **Primary nav** (desktop): Observatory · Investigations · Timeline · Board
  · Atlas · Archive, with Dependencies inside *Explore* menu and in the home
  dashboard. Method lives in a right-aligned secondary link and the footer.
- **Mobile**: compact masthead + menu button opening a full-height sheet;
  a bottom "Explore" tab bar appears only inside console pages (Timeline,
  Board, Atlas, Archive) where switching views is frequent.
- **URLs stay unchanged** (`/timeline/`, `/network/`, `/entities/`…): the IA
  is a grouping, not a re-routing. *Archive* is a landing page that links the
  existing entity, hypothesis and source indexes as tabs.

## Audiences and journeys

| Persona | Need | Journey the design must make effortless |
| --- | --- | --- |
| **Occasional reader** | Understand what is going on and how sure we are | Home → lead investigation → claim stamp tooltip → entity page summary → "what this does not prove" note |
| **Researcher** | Explore, filter, verify, export | Timeline filtered by theme and level → event page → source page with primary URL → board neighbourhood → download JSON/CSV |
| **Journalist** | Find a solid, citable fact fast | ⌘K search → entity page → relationships table filtered to E1–E2 → copy citation (record ID + source + permalink) |
| **Contributor** | Report an error | Any record → "Report a correction" in the record footer → prefilled GitHub issue |

## Tone of voice in the interface

Short, factual, institutional. Labels are nouns ("Fonti", "Livello di
evidenza"), actions are verbs ("Filtra", "Apri il fascicolo"). Avoid
alarmist words in chrome ("threat", "enemy", "alert"): the project name is
already loaded and the home disclaimer explains it.
