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
| **Page transition** | All pages (Astro `<ClientRouter />` view transitions) | Cross-fade 220 ms; masthead/nav persist (`transition:persist`); entity title morphs from list item to page H1 via `transition:name` |
| **Masthead collapse** | Press pages | Scroll-driven (`animation-timeline: scroll()`), progressive enhancement; fallback is a static compact bar |
| **Reveal on scroll** | Timeline items, home sections | 8 px rise + fade, `--dur-base`, `--ease-enter`, once per item via IntersectionObserver; disabled for items already in view at load |
| **Year scrub** | Timeline density bar | Selected bar fills with signal; list scrolls smoothly to the year (`scroll-behavior: smooth` unless reduced motion) |
| **Stamp tooltip** | Evidence stamps | Popover with level definition, 140 ms fade, 4 px offset slide |
| **Drawer** | Case file (board), country panel (atlas), filters sheet (mobile) | Slide from right (bottom on mobile) 360 ms enter / 250 ms exit; scrim fades 220 ms |
| **Pin drop** | Board initial render, filter re-add | Cards fall 14 px with `--ease-paper`, staggered; pins appear 60 ms after their card |
| **Thread draw** | Board | Solid threads draw with `stroke-dashoffset` over 600 ms; patterned threads (E3/E4/E5) fade in instead, so the pattern never animates into a false solid |
| **Card lift** | Board hover/drag | Translate −3 px, shadow from `--shadow-card` to `--shadow-lifted`, rotation eases to 0 while dragging and back to its resting angle on drop |
| **Neighbourhood focus** | Board selection | Non-neighbours fade to 18 % over 220 ms; threads of the selection thicken by 1 px |
| **Map zoom** | Atlas Europe ↔ World | Projection interpolated over 600 ms (`d3-geo` + `requestAnimationFrame`); selected country outline stays drawn |
| **Counter tick** | Home KPIs | Numbers count up once on first view, 600 ms, tabular figures so width never jitters |
| **Live dot** | Dateline | Soft ring pulse every 2.4 s; stops when the tab is hidden |
| **Theme change** | Global | Background and ink cross-fade 360 ms; islands re-render without animation |

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
