import type { Language } from "../../../src/model/index.ts";

const base = () => import.meta.env.BASE_URL.replace(/\/$/, "");

/** Page URL in a language (Italian at the root, English under `en/`), honoring the base path. */
export function href(path = "", lang: Language = "it"): string {
  const clean = path.replace(/^\//, "");
  return `${base()}/${lang === "it" ? "" : `${lang}/`}${clean}`;
}

/** Language-neutral asset or data URL (e.g. `data/v1/graph.json`). */
export function assetHref(path: string): string {
  return `${base()}/${path.replace(/^\//, "")}`;
}

export function nodeHref(id: string, kind: string | undefined, lang: Language): string {
  return kind === "event" ? href(`events/${id}/`, lang) : href(`entities/${id}/`, lang);
}

/** The same page in the other language, from the current pathname. */
export function alternatePath(pathname: string, lang: Language): string {
  const prefix = `${base()}/`;
  const rest = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : pathname;
  const withoutLang = rest.startsWith("en/") ? rest.slice(3) : rest === "en" ? "" : rest;
  return href(withoutLang, lang);
}
