import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BoardCaveat } from "../web/src/islands/BoardCaveat.tsx";

describe("board caveat", () => {
  it("renders Italian, English and explicitly marked Italian fallback", () => {
    const caveat = { it: "Limite italiano", en: "English limitation" };
    expect(renderToStaticMarkup(<BoardCaveat caveat={caveat} lang="it" />)).toContain(
      '<span lang="it">Limite italiano</span>',
    );
    expect(renderToStaticMarkup(<BoardCaveat caveat={caveat} lang="en" />)).toContain(
      '<span lang="en">English limitation</span>',
    );
    expect(
      renderToStaticMarkup(<BoardCaveat caveat={{ it: "Solo italiano" }} lang="en" />),
    ).toContain('<span lang="it">Solo italiano</span>');
  });
  it("omits missing caveats and safely renders long unabridged text", () => {
    expect(renderToStaticMarkup(<BoardCaveat caveat={null} lang="it" />)).toBe("");
    expect(renderToStaticMarkup(<BoardCaveat lang="en" />)).toBe("");
    const value = `${"long ".repeat(200)}<tag> & "quoted" final limitation`;
    const html = renderToStaticMarkup(<BoardCaveat caveat={{ it: value }} lang="en" />);
    expect(html).toContain("&lt;tag&gt; &amp; &quot;quoted&quot; final limitation");
    expect(html).toContain("long ".repeat(200));
  });
});
