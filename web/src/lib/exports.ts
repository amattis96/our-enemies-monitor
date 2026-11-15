import type { Language } from "../../../src/model/index.ts";
import { ui } from "../../../src/site/i18n.ts";
import { assetHref } from "./links.ts";

/** One entry of `components/ExportMenu.astro`. */
export type ExportMenuItem = {
  format: string;
  label: string;
  detail?: string;
  href?: string;
  /** File name proposed for `href` or `text`. */
  name?: string;
  /** Text generated at build time from the public projection, saved client-side. */
  text?: string;
  type?: string;
  print?: boolean;
};

/** CSV and JSON of one published collection under `data/v1/`. */
export function collectionExports(
  collection: string,
  label: string,
  lang: Language,
): ExportMenuItem[] {
  const t = ui(lang);
  return [
    { format: "CSV", label, detail: t.exportCsv, href: assetHref(`data/v1/${collection}.csv`) },
    { format: "JSON", label, detail: t.exportJson, href: assetHref(`data/v1/${collection}.json`) },
  ];
}

/** The record package of one published record (`data/v1/records/<ID>.json`). */
export function packageExport(id: string, lang: Language): ExportMenuItem {
  return {
    format: "JSON",
    label: ui(lang).exportPackage,
    detail: `records/${id}.json`,
    href: assetHref(`data/v1/records/${id}.json`),
  };
}
