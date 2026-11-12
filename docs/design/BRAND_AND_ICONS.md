# Brand, icons and illustrations

## The mark: "The Lens"

[assets/logo-mark.svg](assets/logo-mark.svg)

An instrument bezel with a dial (the monitoring room) frames three pinned
clues joined by thread (the investigation board). One thread is the red
string; a faint sweep sector and a graticule recall a radar scope and a
globe without drawing any real geography.

- **Construction:** 64-unit grid, centre 32/32. Bezel r 29.25 (stroke 2.5),
  inner ring r 23.6, majors on the cardinals, minors every 15°. Pins at
  (21,24) signal red, (44,27) and (29,44) ink; threads sag towards the
  centre.
- **Colour:** ink = `currentColor`, red = `var(--signal)` with fallback
  `#b3261e`. Works on paper, on the console background and in one colour
  (set `--signal: currentColor` for monochrome stamps and print).
- **Minimum size:** 32 px. Below that use the favicon.
- **Clear space:** one pin diameter (≈ 6 units) on all sides.
- **Don'ts:** no rotation, no gradients, no glow, no additional pins, no map
  inside the lens, never recolour the red string to a relation-group colour.

### Favicon

[assets/favicon.svg](assets/favicon.svg) keeps bezel, four cardinal ticks,
three pins and the red string; it switches ink with
`prefers-color-scheme`. The site serves it at `/favicon.svg` straight from
this folder. *Deferred:* `apple-touch-icon.png`, `icon-192/512.png` and a
web manifest.

### Wordmark and masthead

- **Wordmark:** "Our Enemies Monitor" in Newsreader 600, optical size 72,
  tracking −0.02em, on one line from 760 px, two lines below. Never in
  caps, never italic.
- **Masthead (Press pages):** dateline row in Plex Mono (date in the reader's
  language, edition, data cut-off with a pulsing signal dot, record counts
  from `pnpm validate`) → centred lockup (mark + wordmark) → italic serif
  tagline → double rule. Implemented on the home page; the dateline shows
  edition, data cut-off and counts (no date, which would go stale).
- **Every other page** uses only the compact sticky bar (mark + wordmark),
  which leaves the height to the content and to the console canvases.
- **Social image:** 1200 × 630, paper background, mark left, wordmark +
  tagline right, heavy rule. *Deferred:* image generation; pages already
  carry Open Graph title, description and locale.

## Icon set

[assets/icons.svg](assets/icons.svg) is a sprite of 79 symbols drawn for
this project in one grammar:

- 24 × 24 grid, live area 2–22, **1.5 stroke**, round caps and joins,
  `currentColor`; fills only for evidence glyphs and small accents.
- Sizes: 16 (inline in meta), 20 (nav, buttons), 24 (default), 32 and 48
  (empty states, section headers). Stroke stays 1.5 at all sizes (use
  `vector-effect` only if an icon is scaled above 48).
- Always paired with a visible label or an accessible name. Icons
  disambiguate; they never replace words.

| Prefix | Meaning | Symbols |
| --- | --- | --- |
| `nav-` | Sections | observatory, investigations, timeline, network, atlas, dependencies, entities, hypotheses, sources, methodology, data, changes, search |
| `kind-` | Entity kinds (and board card types) | state, institution, person, organization, company, asset, event |
| `rel-` | Relation groups (map 1:1 to `RELATION_GROUPS`) | participation, control, financial, influence, security, economic, institutional, context |
| `ev-` | Evidence glyphs | e1 (filled square), e2 (filled triangle), e3 (half circle), e4 (ring), e5 (dashed diamond) |
| `st-` | Record status | reviewed, needs-review, unreviewed, pending, primary (primary source), machine (machine translation), fixture (DEMO/TEST), restricted (person link withheld) |
| `th-` | Editorial themes (map 1:1 to `THEME_LABELS` keys) | all 18 themes |
| `ui-` | Interface | sun, moon, system, language, menu, close, chevron-down, arrow-right, external, download, filter, board, list, pin, fit, zoom-in, zoom-out, no-location, copy, command |

Mapping rule for the implementation: icon IDs are derived from the model
vocabularies (`th-${theme}`, `kind-${kind}`, `rel-${group}` with the short
names above), and a unit test asserts that every vocabulary value has a
symbol, so a new theme or kind cannot ship without an icon.

### Delivery

- Astro: `web/src/components/Icon.astro` renders
  `<svg><use href="…/icons.svg#nav-atlas"/></svg>`; `/icons.svg` is an
  endpoint (`web/src/pages/icons.svg.ts`) serving this folder's sprite (one
  cached request). `aria-hidden="true"` by default; a `label` prop switches
  to `role="img"` + `aria-label`.
- React islands receive the sprite URL as a prop and use the same `<use>`.
- `test/design.test.ts` fails if a theme, entity kind, relation group,
  evidence level or review status has no symbol.

## Explanatory illustrations

Line drawings in ink with one accent (`--signal` or a sequential blue) on
one 480 × 270 canvas. Three line weights (2 primary, 1.25 secondary,
0.75–1 detail), engraving-style hatching for shaded surfaces (45°, 4–5
units, 0.8 stroke at ~28 % opacity), and cards, pins and threads drawn
exactly as on the evidence board, so the drawings read as one family; themed through CSS variables with light-mode
fallbacks, and **no words**: the only glyphs are evidence codes (E1–E5)
and the letters A/B/C, which are language-neutral. Captions and `alt`
texts are HTML in both languages.

| File | Explains | Placement |
| --- | --- | --- |
| [evidence-ladder.svg](assets/illustrations/evidence-ladder.svg) | E1–E4 as an ordinal ladder with glyph and thread style; E5 stands apart | Methodology hero, evidence legend popover, home "how to read" strip |
| [not-transitive.svg](assets/illustrations/not-transitive.svg) | A → B and B → C do not imply A → C | Board limits note, methodology |
| [location-not-responsibility.svg](assets/illustrations/location-not-responsibility.svg) | Where an event happened ≠ who is responsible (abstract territory, no real country) | Atlas limits note |
| [separate-claims.svg](assets/illustrations/separate-claims.svg) | Event, perpetrator, sponsor, motive and impact are separate claims with separate evidence | Event pages, methodology |
| [empty-board.svg](assets/illustrations/empty-board.svg) | Empty state: nothing matches the filters | Board, hypotheses board, any filtered list (scaled) |
| [not-found.svg](assets/illustrations/not-found.svg) | 404: the clipping is there, the story is not | 404 page |

Backlog for the implementation phase (same style): *dependency-not-coercion*
(dependencies page), *participation-not-control* (board legend),
*machine-translation* (translation notice), *how-a-record-is-reviewed*
(changes page).
