# Motion

Motion makes the interface feel alive the way paper and instruments do:
things **settle**, **slide** and **respond**; nothing bounces for fun, spins
or glows. Motion always explains a change of state or place.

## Tokens

| Token | Value | Use |
| --- | --- | --- |
| `--dur-instant` | 80 ms | Press feedback, checkbox, toggle thumb |
| `--dur-fast` | 140 ms | Hover, focus, colour changes, chips |
| `--dur-base` | 220 ms | Panels expanding, tooltips, tab underline |
| `--dur-slow` | 360 ms | Drawers, sheets, page transitions, pin drop |
| `--dur-deliberate` | 600 ms | Threads drawing, atlas Europe ↔ World |
| `--dur-ambient` | 2400 ms | Live dot pulse (the only looping animation) |
| `--ease-standard` | `cubic-bezier(.2,0,0,1)` | Default for state changes |
| `--ease-enter` | `cubic-bezier(.05,.7,.1,1)` | Things arriving (drawers, threads) |
| `--ease-exit` | `cubic-bezier(.3,0,.8,.15)` | Things leaving (shorter: 70 % of enter duration) |
| `--ease-paper` | `cubic-bezier(.34,1.36,.64,1)` | Board cards and pins: a slight overshoot as paper settles |
| `--stagger` | 40 ms | Delay between items of a list entering (max 8 items, then no stagger) |

## Patterns

| Pattern | Where | Spec |
| --- | --- | --- |
| **Page transition** | All pages | Cross-document view transitions (`@view-transition { navigation: auto; }`, CSS only, no client router): the browser cross-fades between pages where supported, plain navigation elsewhere |
| **Masthead** | Home | Full masthead on the home page only; every page has the compact sticky bar. *Deferred:* scroll-driven collapse |
| **Reveal on scroll** | Timeline items | 10 px rise + fade driven by a CSS view timeline (`animation-timeline: view()`, the `.reveal` class), no JavaScript; browsers without support show items at once |
| **Year scrub** | Timeline density bar | Selected bar fills with signal and filters the list to that year (click again to clear); bar heights ease when other filters change |
| **Stamp tooltip** | Evidence stamps | Native tooltip with the level definition (also in visually hidden text). *Deferred:* styled popover |
| **Drawer / sheet** | Board case file, mobile menu, search palette | Case file and menu slide in from the right (case file from the bottom on phones) with `--dur-slow` / `--ease-enter`; the palette fades and settles 8 px; dialogs dim the page behind |
| **Pin drop** | Board initial render | Cards (with their pin) fall 14 px with `--ease-paper`, staggered 18 ms; skipped above 150 visible cards |
| **Thread draw** | Board | Solid threads draw with `stroke-dashoffset` over 600 ms; patterned threads (E3/E4/E5) fade in instead, so the pattern never animates into a false solid |
| **Card lift** | Board hover/focus | Paper rises 3 px with `--ease-paper` and its drawn shadow moves out (no CSS filters, cheap on phones) |
| **Neighbourhood focus** | Board selection | Non-neighbouring cards and threads fade to 16 % over 220 ms |
| **Map switch and zoom** | Atlas | Europe ↔ World swaps two build-time maps; zoom and pan change the SVG viewBox. *Deferred:* projection interpolation |
| **Counter tick** | Home KPIs | Numbers count up once on first view, 600 ms, tabular figures so width never jitters |
| **Live dot** | Dateline | Soft ring pulse every 2.4 s (CSS); off with reduced motion |
| **Theme change** | Global | Page background and ink cross-fade 360 ms; inline SVG follows the tokens immediately |

## Reduced motion

With `prefers-reduced-motion: reduce` the tokens collapse to 1 ms (see
`tokens.css`): opacity changes stay, travel, overshoot, drawing, counting,
scroll-smoothing and pulsing stop. View transitions fall back to an instant
swap. No information may depend on animation (e.g. thread patterns are
static, counts are rendered in HTML).

## Performance budget

- Animate only `transform` and `opacity` (plus `stroke-dashoffset` on SVG
  threads). No layout-triggering animation.
- Board: animations run once per render; beyond 150 visible cards, pin drop
  and thread draw are skipped.
- No animation library: CSS, Web Animations API and Astro view transitions
  are enough.
