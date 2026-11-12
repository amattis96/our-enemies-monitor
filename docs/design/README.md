# Dossier — design system v1

**Status:** design approved for implementation planning, 2026-11-12. Not yet
wired into the site: the portal still uses the functional MVP styling until
milestone **M7** (see [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)).

*Dossier* is the visual and interaction language of Our Enemies Monitor: the
authority of a serious political newspaper and the precision of a ministry
crisis room, joined by one shared **evidence grammar**.

## Documents

| File | Content |
| --- | --- |
| [CONCEPT.md](CONCEPT.md) | Concept, design principles, the three registers, information architecture, user journeys |
| [FOUNDATIONS.md](FOUNDATIONS.md) | Typography, colour (light/dark), data palettes, layout grid, spacing, shape, texture, elevation, theming, accessibility baseline |
| [BRAND_AND_ICONS.md](BRAND_AND_ICONS.md) | Logo "The Lens", favicon, wordmark and masthead, icon set, explanatory illustrations |
| [MOTION.md](MOTION.md) | Durations, easings, motion patterns, reduced motion |
| [COMPONENTS.md](COMPONENTS.md) | Evidence grammar, masthead and navigation, theme switch, language picker, search, cards, tables, filters, drawers, status labels |
| [PAGES.md](PAGES.md) | Page blueprints: home, investigations, article, timeline, corkboard network, hypotheses board, atlas, dependencies, archive, entity/event/source pages, search, 404 |
| [AUDIT.md](AUDIT.md) | UI/UX audit of the current portal (2026-11-12) with severities |
| [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) | M7 phased implementation plan in the Astro/React/Tailwind stack |

## Assets

| Path | Content |
| --- | --- |
| [tokens.css](tokens.css) | Design tokens: type, space, shape, motion, light and dark themes, data palettes, corkboard |
| [assets/logo-mark.svg](assets/logo-mark.svg) | Detailed mark (≥ 32 px), `currentColor` + `--signal` |
| [assets/favicon.svg](assets/favicon.svg) | Simplified mark for 16–32 px, adapts to the system colour scheme |
| [assets/icons.svg](assets/icons.svg) | Sprite of 79 project icons (`nav-`, `kind-`, `rel-`, `ev-`, `st-`, `th-`, `ui-`) |
| [assets/illustrations/](assets/illustrations/) | Six text-free explanatory illustrations |
| [specimen.html](specimen.html) | Living specimen of everything above, with working theme switch |
| [scripts/check-contrast.mjs](scripts/check-contrast.mjs) | WCAG contrast check of the token pairs in both themes |

## Viewing the specimen

The specimen fetches the sprite and SVGs, so it needs an HTTP server (not
`file://`):

```bash
python3 -m http.server 4400 --directory docs/design
```

then open <http://localhost:4400/specimen.html>. In the Claude desktop app
the `design-specimen` entry of `.claude/launch.json` does the same. The
specimen loads the fonts from Google Fonts for convenience only; the site will
self-host them (no third-party requests).

## Checks

```bash
node docs/design/scripts/check-contrast.mjs
```

Every text pair passes WCAG 2.2 AA (primary ink and card ink pass AAA) in both
themes. The categorical data palette was validated for lightness band,
chroma, colour-vision-deficiency separation (ΔE ≥ 8 on adjacent pairs) and
contrast on paper, console and dark cork surfaces; see
[FOUNDATIONS.md](FOUNDATIONS.md#data-palettes).

## Rules that bind the implementation

1. **Evidence before ornament.** No visual treatment may make a claim look
   stronger than its evidence level, or blur E5 hypotheses into
   relationships. Evidence is always shape + pattern + text, never colour
   alone.
2. **Semantic tokens only.** Components use `--ink`, `--paper`, `--accent`…;
   raw hex values never appear in templates or islands.
3. **Both languages, both themes, every width.** A component is done when it
   works in IT and EN, light and dark, 320 px to 1920 px, keyboard only and
   with reduced motion.
4. **Illustrations carry no words.** Captions are HTML and translated.
5. **The examples in the specimen are illustrative.** Titles and IDs there
   are placeholders, never data.
