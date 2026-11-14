import { readFileSync } from "node:fs";
import { COLLECTION_NAMES, type Dataset } from "../../src/model/index.ts";
import { nextId } from "../../src/pipeline/ingest/plan.ts";
import { repoPath } from "../../src/pipeline/paths.ts";

/** Shared builders for the M6 ingest tests (synthetic sidecars and operations). */

export const FIXTURE = "test/fixtures/Fonte_10.proposals.json";
export const fixtureJson = () => JSON.parse(readFileSync(repoPath(FIXTURE), "utf8"));

/** The next `count` free IDs with a prefix: tests never hard-code the live dataset's IDs. */
export function freeIds(ds: Dataset, prefix: string, width: number, count: number): string[] {
  const taken = COLLECTION_NAMES.flatMap((c) => ds[c].map((r) => r.id));
  const ids: string[] = [];
  for (let i = 0; i < count; i++) ids.push(nextId([...taken, ...ids], prefix, width));
  return ids;
}

/** Repository path of the Markdown of a synthetic sidecar `Fonte_NN`. */
export const markdownOf = (number: number) =>
  `sources/incremental/Fonte_${String(number).padStart(2, "0")}_test.md`;

/** Raw JSON of a synthetic sidecar `Fonte_NN` around the fixture's references. */
export function sidecarJson(
  number: number,
  operations: unknown[],
  source: Record<string, unknown> = {},
): Record<string, unknown> {
  const json = fixtureJson();
  return {
    ...json,
    source: {
      ...json.source,
      code: `S${String(number).padStart(2, "0")}`,
      file: markdownOf(number),
      ...source,
    },
    operations,
  };
}

export const base = { sources: ["R01"], notes: [] };

export const event = (ref: string, overrides: Record<string, unknown> = {}) => ({
  op: "create_event",
  ref,
  item: ref,
  ...base,
  update_type: "NEW_EVENT",
  evidence_level: "E1",
  title: { it: "Evento sintetico di prova senza corrispondenze nel corpus" },
  description: { it: "Descrizione documentata." },
  date: { start: "2026-11-12", end: null, precision: "day" },
  published: null,
  themes: ["justice"],
  geography: null,
  places: [],
  evidence_note: null,
  publisher: null,
  url: null,
  claims: { perpetrator: null, sponsor: null, motive: null, impact: null },
  contrary_evidence: null,
  related: [],
  ...overrides,
});

export const relationship = (ref: string, overrides: Record<string, unknown> = {}) => ({
  op: "create_relationship",
  ref,
  item: ref,
  ...base,
  evidence_level: "E1",
  subject: "PL",
  predicate: "COLLEGATO_A",
  object: "EXT-005",
  relation_class: "context",
  evidence_status: "documented",
  events: [],
  valid_from: null,
  valid_to: null,
  primary_url: null,
  caveat: null,
  person_status: null,
  ...overrides,
});
