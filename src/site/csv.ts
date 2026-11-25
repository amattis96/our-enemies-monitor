import type { Dataset, Language, LocalizedText } from "../model/index.ts";

/**
 * CSV exports (RFC 4180) of the public projection and of the filtered views
 * of the site. Pure and browser-safe: the timeline and the boards build the
 * same files client-side from what is on screen, the build publishes the full
 * collections under `data/v1/`. Lists are joined with `;`; unknown values stay
 * empty (never a placeholder); predicates stay literal.
 */
export type CsvColumn<T> = { name: string; value: (row: T) => CsvValue };
export type CsvValue = string | number | boolean | null | undefined | readonly string[];

/** Byte order mark: lets spreadsheet software detect UTF-8 (accents, «», €). */
export const CSV_BOM = "﻿";

/**
 * A cell that a spreadsheet would read as a formula is prefixed with `'`
 * (OWASP CSV injection). Corpus text never starts with these characters on
 * purpose, so the prefix does not alter a value a reader relies on.
 */
const FORMULA = /^[=+\-@\t\r]/;

export function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  let text = Array.isArray(value) ? value.join(";") : String(value);
  if (FORMULA.test(text) && !/^-?\d/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** Header row plus one row per item, CRLF line ends, UTF-8 BOM. */
export function toCsv<T>(columns: readonly CsvColumn<T>[], rows: readonly T[]): string {
  const lines = [
    columns.map((c) => csvCell(c.name)).join(","),
    ...rows.map((row) => columns.map((c) => csvCell(c.value(row))).join(",")),
  ];
  return `${CSV_BOM}${lines.join("\r\n")}\r\n`;
}

const it = (text: LocalizedText | null | undefined) => text?.it ?? null;
const en = (text: LocalizedText | null | undefined) => text?.en ?? null;

/** Canonical Italian text and its English translation, side by side. */
function bilingual<T>(
  name: string,
  get: (row: T) => LocalizedText | null | undefined,
): CsvColumn<T>[] {
  return [
    { name: `${name}_it`, value: (row) => it(get(row)) },
    { name: `${name}_en`, value: (row) => en(get(row)) },
  ];
}

type Row<K extends keyof Dataset> = Dataset[K][number];

/**
 * Collection CSVs of the public projection. `restricted` tells which
 * relationships the site shows without their predicate (named person without a
 * registered primary source): the CSV withholds the same predicate and caveat.
 */
export function collectionCsvs(
  dataset: Dataset,
  restricted: (id: string) => boolean = () => false,
): { path: string; text: string }[] {
  const names = new Map<string, LocalizedText>([
    ...dataset.entities.map((e) => [e.id, e.name] as const),
    ...dataset.events.map((e) => [e.id, e.title] as const),
  ]);
  const events: CsvColumn<Row<"events">>[] = [
    { name: "id", value: (e) => e.id },
    { name: "record_type", value: (e) => e.record_type },
    { name: "timeline_status", value: (e) => e.timeline_status },
    { name: "date_start", value: (e) => e.date.start },
    { name: "date_end", value: (e) => e.date.end },
    { name: "date_precision", value: (e) => e.date.precision },
    ...bilingual<Row<"events">>("title", (e) => e.title),
    ...bilingual<Row<"events">>("description", (e) => e.description),
    { name: "themes", value: (e) => e.themes },
    ...bilingual<Row<"events">>("geography", (e) => e.geography),
    { name: "places", value: (e) => e.places },
    { name: "evidence_level", value: (e) => e.evidence_level },
    ...bilingual<Row<"events">>("evidence_note", (e) => e.evidence_note),
    { name: "known_issues_codes", value: (e) => e.known_issues.map((k) => k.code) },
    { name: "known_issues_it", value: (e) => e.known_issues.map((k) => k.note.it) },
    {
      name: "known_issues_en",
      value: (e) => e.known_issues.map((k) => k.note.en ?? k.note.it),
    },
    { name: "publisher", value: (e) => e.publisher },
    { name: "url", value: (e) => e.url },
    { name: "sources", value: (e) => e.sources },
    { name: "review_status", value: (e) => e.review.status },
  ];
  const entities: CsvColumn<Row<"entities">>[] = [
    { name: "id", value: (e) => e.id },
    { name: "kind", value: (e) => e.kind },
    ...bilingual<Row<"entities">>("name", (e) => e.name),
    { name: "domain", value: (e) => e.domain },
    { name: "country", value: (e) => e.country },
    { name: "review_status", value: (e) => e.review.status },
  ];
  const relationships: CsvColumn<Row<"relationships">>[] = [
    { name: "id", value: (r) => r.id },
    { name: "subject", value: (r) => r.subject },
    { name: "subject_name_it", value: (r) => it(names.get(r.subject)) },
    { name: "predicate", value: (r) => (restricted(r.id) ? null : r.predicate) },
    { name: "object", value: (r) => r.object },
    { name: "object_name_it", value: (r) => it(names.get(r.object)) },
    { name: "restricted", value: (r) => restricted(r.id) },
    { name: "relation_class", value: (r) => r.relation_class },
    { name: "evidence_level", value: (r) => r.evidence_level },
    { name: "evidence_status", value: (r) => r.evidence_status },
    { name: "events", value: (r) => r.events },
    { name: "valid_from", value: (r) => r.valid_from },
    { name: "valid_to", value: (r) => r.valid_to },
    { name: "primary_url", value: (r) => r.primary_url },
    ...bilingual<Row<"relationships">>("caveat", (r) => (restricted(r.id) ? null : r.caveat)),
    { name: "sources", value: (r) => r.sources },
    { name: "review_status", value: (r) => r.review.status },
  ];
  const hypotheses: CsvColumn<Row<"hypotheses">>[] = [
    { name: "id", value: (h) => h.id },
    { name: "evidence_level", value: () => "E5" },
    { name: "subject", value: (h) => h.subject },
    { name: "object", value: (h) => h.object },
    { name: "hypothesis_type", value: (h) => h.hypothesis_type },
    ...bilingual<Row<"hypotheses">>("question", (h) => h.question),
    ...bilingual<Row<"hypotheses">>("current_limit", (h) => h.current_limit),
    ...bilingual<Row<"hypotheses">>("evidence_needed", (h) => h.evidence_needed),
    { name: "priority", value: (h) => h.priority },
    { name: "status", value: (h) => h.status },
    { name: "events", value: (h) => h.events },
    { name: "external_url", value: (h) => h.external_url },
    { name: "sources", value: (h) => h.sources },
    { name: "review_status", value: (h) => h.review.status },
  ];
  const sources: CsvColumn<Row<"sources">>[] = [
    { name: "id", value: (s) => s.id },
    { name: "type", value: (s) => s.type },
    ...bilingual<Row<"sources">>("title", (s) => s.title),
    { name: "publisher", value: (s) => s.publisher },
    { name: "urls", value: (s) => s.urls },
    { name: "origin_type", value: (s) => s.origin_type },
    { name: "review_status", value: (s) => s.review.status },
  ];
  return [
    { path: "events.csv", text: toCsv(events, dataset.events) },
    { path: "entities.csv", text: toCsv(entities, dataset.entities) },
    { path: "relationships.csv", text: toCsv(relationships, dataset.relationships) },
    { path: "hypotheses.csv", text: toCsv(hypotheses, dataset.hypotheses) },
    { path: "sources.csv", text: toCsv(sources, dataset.sources) },
  ];
}

/** Columns that hold record IDs, for the leak test of the CSV surface. */
export const CSV_ID_COLUMNS = new Set(["id", "subject", "object", "events", "sources"]);

/** Minimal RFC 4180 reader (quoted cells, CRLF), used by tests and checks. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const body = text.startsWith(CSV_BOM) ? text.slice(1) : text;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (quoted) {
      if (ch === '"' && body[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length > 0) rows.push([...row, cell]);
  const [header = [], ...data] = rows;
  return data.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}

/** File name of a view export: `oem-<view>-<lang>.<ext>`. */
export function exportFileName(view: string, lang: Language, ext: "csv" | "json"): string {
  return `oem-${view}-${lang}.${ext}`;
}

/**
 * Relationships listed on one record page, as the page shows them: a
 * restricted relationship keeps its row and level but not its predicate or
 * caveat. Names and URLs follow the page language.
 */
export function pageRelationshipsCsv(
  relationships: readonly Dataset["relationships"][number][],
  lang: Language,
  helpers: {
    name: (id: string) => string;
    url: (id: string) => string;
    restricted: (relationship: Dataset["relationships"][number]) => boolean;
  },
): string {
  type R = Dataset["relationships"][number];
  const caveat = (r: R) =>
    helpers.restricted(r) || !r.caveat
      ? null
      : lang === "en" && r.caveat.en
        ? r.caveat.en
        : r.caveat.it;
  const columns: CsvColumn<R>[] = [
    { name: "id", value: (r) => r.id },
    { name: "subject", value: (r) => r.subject },
    { name: "subject_name", value: (r) => helpers.name(r.subject) },
    { name: "predicate", value: (r) => (helpers.restricted(r) ? null : r.predicate) },
    { name: "object", value: (r) => r.object },
    { name: "object_name", value: (r) => helpers.name(r.object) },
    { name: "restricted", value: (r) => helpers.restricted(r) },
    { name: "relation_class", value: (r) => r.relation_class },
    { name: "evidence_level", value: (r) => r.evidence_level },
    { name: "evidence_status", value: (r) => r.evidence_status },
    { name: "events", value: (r) => r.events },
    { name: "valid_from", value: (r) => r.valid_from },
    { name: "valid_to", value: (r) => r.valid_to },
    { name: "primary_url", value: (r) => (helpers.restricted(r) ? null : r.primary_url) },
    { name: "caveat", value: caveat },
    { name: "sources", value: (r) => r.sources },
    { name: "subject_url", value: (r) => helpers.url(r.subject) },
    { name: "object_url", value: (r) => helpers.url(r.object) },
  ];
  return toCsv(columns, relationships);
}
