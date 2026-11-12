// WCAG 2.2 contrast check for the Dossier token pairs, both themes.
// Usage: node docs/design/scripts/check-contrast.mjs
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../tokens.css", import.meta.url), "utf8");

/** Collect `--name: #hex` declarations of the block that starts at `marker`. */
function block(marker) {
  const start = css.indexOf(marker);
  const body = css.slice(start, css.indexOf("}", start));
  return Object.fromEntries(
    [...body.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]),
  );
}

const themes = {
  light: block(':root[data-theme="light"]'),
  dark: block(':root[data-theme="dark"]'),
};

const channel = (c) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => channel(Number.parseInt(hex.slice(i, i + 2), 16)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// [foreground, background, minimum] — 4.5 text, 3 large text / UI / graphics.
const pairs = [
  ["ink", "paper", 7],
  ["ink-2", "paper", 4.5],
  ["ink-3", "paper", 4.5],
  ["ink-3", "paper-sunken", 4.5],
  ["ink-3", "paper-raised", 4.5],
  ["accent", "paper", 4.5],
  ["accent", "paper-raised", 4.5],
  ["accent", "accent-wash", 4.5],
  ["signal", "paper", 4.5],
  ["signal", "signal-wash", 4.5],
  ["caution", "caution-wash", 4.5],
  ["ok", "ok-wash", 4.5],
  ["fixture", "fixture-wash", 4.5],
  ["card-ink", "card", 7],
  ["series-1", "paper", 3],
  ["series-2", "paper", 3],
  ["series-3", "paper", 3],
  ["series-4", "paper", 3],
  ["series-5", "paper", 3],
  ["series-6", "paper", 3],
  ["seq-5", "paper", 3],
];

let failures = 0;
for (const [name, tokens] of Object.entries(themes)) {
  console.log(`\n${name}`);
  for (const [fg, bg, min] of pairs) {
    const value = ratio(tokens[fg], tokens[bg]);
    const ok = value >= min;
    if (!ok) failures++;
    console.log(
      `${ok ? "PASS" : "FAIL"}  ${fg.padEnd(10)} on ${bg.padEnd(13)} ${value.toFixed(2)} (min ${min})`,
    );
  }
}
process.exitCode = failures > 0 ? 1 : 0;
