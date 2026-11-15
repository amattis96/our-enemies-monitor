import { readFileSync } from "node:fs";
import {
  type CasePilotFile as CasePilot,
  CasePilotFile,
  CLAIM_KINDS,
  type Claim,
  type ClaimKind,
  type Dataset,
} from "../model/index.ts";
import { repoPath } from "../pipeline/paths.ts";
import type { Issue } from "../pipeline/validate.ts";

/**
 * B18 Case/Claim pilot (ADR-06, proposed). A versioned editorial file, like the
 * B15 registry: validated by `pnpm validate` against the canonical data, never
 * loaded by the site or the exports. Every claim restates existing record
 * fields and cites existing source codes; agents never set `reviewed`.
 */
export type { CasePilot };

export const CASE_PILOT_PATH = "docs/audit/cases/pilot.v1.json";

export function readCasePilot(): CasePilot {
  return CasePilotFile.parse(JSON.parse(readFileSync(repoPath(CASE_PILOT_PATH), "utf8")));
}

/** An absent, null, blank or localized value without Italian text. */
function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (typeof value === "object" && !Array.isArray(value) && "it" in value) {
    const it = (value as { it: unknown }).it;
    return typeof it !== "string" || it.trim() === "";
  }
  return false;
}

const REPLY_REQUIRED: ClaimKind[] = ["denial"];
const ASSERTER_REQUIRED: ClaimKind[] = ["attribution", "denial"];

/**
 * Referential and policy checks. Errors: duplicates, unknown IDs, a claim about
 * a record outside its case, a missing asserter or reply target, a level not
 * carried by a listed relationship, an empty transcribed field, and a person
 * without exact status, date and registered primary source (AGENTS.md rule 7).
 * Warning: a case without claims.
 */
export function validateCasePilot(pilot: CasePilot, dataset: Dataset): Issue[] {
  const errors: string[] = [];
  const warnings: string[] = [];
  const events = new Map(dataset.events.map((e) => [e.id, e]));
  const entities = new Map(dataset.entities.map((e) => [e.id, e]));
  const relationships = new Map(dataset.relationships.map((r) => [r.id, r]));
  const sources = new Map(dataset.sources.map((s) => [s.id, s]));
  const cases = new Map(pilot.cases.map((c) => [c.id, c]));
  const claims = new Map(pilot.claims.map((c) => [c.id, c]));

  const duplicates = (ids: string[]) => ids.filter((id, i) => ids.indexOf(id) !== i);
  for (const id of duplicates(pilot.cases.map((c) => c.id))) errors.push(`duplicate case ${id}`);
  for (const id of duplicates(pilot.claims.map((c) => c.id))) errors.push(`duplicate claim ${id}`);
  const checkSources = (label: string, codes: string[]) => {
    for (const code of codes)
      if (!sources.has(code)) errors.push(`${label}: unknown source ${code}`);
  };

  for (const c of pilot.cases) {
    for (const id of c.events) if (!events.has(id)) errors.push(`${c.id}: unknown event ${id}`);
    checkSources(c.id, c.sources);
    if (!pilot.claims.some((claim) => claim.case === c.id)) warnings.push(`${c.id}: no claims`);
  }

  for (const claim of pilot.claims) {
    const label = claim.id;
    const kase = cases.get(claim.case);
    if (!kase) {
      errors.push(`${label}: unknown case ${claim.case}`);
      continue;
    }
    const inCase = (eventIds: string[]) => eventIds.some((id) => kase.events.includes(id));
    for (const id of claim.about) {
      const relationship = relationships.get(id);
      if (events.has(id)) {
        if (!kase.events.includes(id)) errors.push(`${label}: ${id} is not an event of ${kase.id}`);
      } else if (relationship) {
        if (!inCase(relationship.events)) errors.push(`${label}: ${id} is outside ${kase.id}`);
      } else errors.push(`${label}: unknown record ${id}`);
    }
    for (const id of claim.relationships) {
      const relationship = relationships.get(id);
      if (!relationship) errors.push(`${label}: unknown relationship ${id}`);
      else if (!inCase(relationship.events)) errors.push(`${label}: ${id} is outside ${kase.id}`);
    }
    for (const id of claim.subjects)
      if (!entities.has(id)) errors.push(`${label}: unknown entity ${id}`);
    if (
      claim.asserted_by !== null &&
      !entities.has(claim.asserted_by) &&
      !events.has(claim.asserted_by)
    ) {
      errors.push(`${label}: unknown asserter ${claim.asserted_by}`);
    }
    if (ASSERTER_REQUIRED.includes(claim.kind) && claim.asserted_by === null) {
      errors.push(`${label}: ${claim.kind} needs asserted_by`);
    }
    for (const [field, target] of [
      ["responds_to", claim.responds_to],
      ["supersedes", claim.supersedes],
    ] as const) {
      if (target === null) continue;
      const other = claims.get(target);
      if (!other) errors.push(`${label}: ${field} unknown claim ${target}`);
      else if (target === claim.id) errors.push(`${label}: ${field} itself`);
      else if (other.case !== claim.case)
        errors.push(`${label}: ${field} ${target} of another case`);
    }
    if (REPLY_REQUIRED.includes(claim.kind) && claim.responds_to === null) {
      errors.push(`${label}: ${claim.kind} needs responds_to`);
    }
    // ADR-04: a level is lent only by a listed relationship carrying the same statement.
    const carries = (id: string) => {
      const r = relationships.get(id);
      if (!r) return false;
      const about = new Set(claim.about);
      return (
        about.has(r.id) ||
        about.has(r.subject) ||
        about.has(r.object) ||
        r.events.some((e) => about.has(e))
      );
    };
    for (const id of claim.relationships) {
      if (relationships.has(id) && !carries(id)) {
        errors.push(`${label}: ${id} does not concern the records the claim is about`);
      }
    }
    if (
      claim.evidence_level !== null &&
      !claim.relationships.some(
        (id) => carries(id) && relationships.get(id)?.evidence_level === claim.evidence_level,
      )
    ) {
      errors.push(
        `${label}: evidence_level ${claim.evidence_level} is not carried by a listed relationship`,
      );
    }
    for (const { record, field } of claim.transcribed_from) {
      const target = (events.get(record) ?? relationships.get(record) ?? sources.get(record)) as
        | Record<string, unknown>
        | undefined;
      if (!target) errors.push(`${label}: unknown record ${record}`);
      else if (isEmpty(target[field])) {
        errors.push(`${label}: ${record}.${field} is empty`);
      }
    }
    checkSources(label, claim.sources);

    const persons = [...claim.subjects, ...(claim.asserted_by ? [claim.asserted_by] : [])].filter(
      (id) => entities.get(id)?.kind === "person",
    );
    for (const id of persons) {
      if (!claim.person_status.some((p) => p.entity === id)) {
        errors.push(`${label}: person ${id} needs person_status (status, date, primary source)`);
      }
    }
    for (const p of claim.person_status) {
      if (entities.get(p.entity)?.kind !== "person")
        errors.push(`${label}: ${p.entity} is not a person`);
      const source = sources.get(p.primary_source);
      if (!claim.sources.includes(p.primary_source)) {
        errors.push(`${label}: primary source ${p.primary_source} is not cited by the claim`);
      }
      if (source?.type !== "external_reference") {
        errors.push(`${label}: primary source ${p.primary_source} is not an external reference`);
      } else if (!source.urls.includes(p.primary_url)) {
        errors.push(`${label}: ${p.primary_url} is not registered on ${p.primary_source}`);
      }
      const backed = claim.relationships.some((id) => {
        const r = relationships.get(id);
        return (
          r !== undefined &&
          carries(id) &&
          (r.subject === p.entity || r.object === p.entity) &&
          r.primary_url === p.primary_url
        );
      });
      if (!backed) {
        errors.push(
          `${label}: no listed relationship of ${p.entity} has primary_url ${p.primary_url}`,
        );
      }
    }
  }

  return [
    ...errors.map((message): Issue => ({ severity: "error", file: CASE_PILOT_PATH, message })),
    ...warnings.map((message): Issue => ({ severity: "warning", file: CASE_PILOT_PATH, message })),
  ];
}

// ---------------------------------------------------------------------------
// Structured queries (M3 exit criterion: fact, attribution, denial and
// judgment are distinguishable without reading free text).

export type ClaimQuery = {
  kind?: ClaimKind;
  aspect?: Claim["aspect"];
  case?: string;
  about?: string;
  assertedBy?: string;
};

export function queryClaims(pilot: CasePilot, query: ClaimQuery): Claim[] {
  return pilot.claims.filter(
    (c) =>
      (query.kind === undefined || c.kind === query.kind) &&
      (query.aspect === undefined || c.aspect === query.aspect) &&
      (query.case === undefined || c.case === query.case) &&
      (query.about === undefined || c.about.includes(query.about)) &&
      (query.assertedBy === undefined || c.asserted_by === query.assertedBy),
  );
}

/** Claims of a case by kind; an empty lane means "not recorded", not "did not happen". */
export function caseLanes(pilot: CasePilot, caseId: string): Record<ClaimKind, Claim[]> {
  return Object.fromEntries(
    CLAIM_KINDS.map((kind) => [kind, queryClaims(pilot, { case: caseId, kind })]),
  ) as Record<ClaimKind, Claim[]>;
}

/** Denials that reply to a claim. */
export function denialsOf(pilot: CasePilot, claimId: string): Claim[] {
  return pilot.claims.filter((c) => c.kind === "denial" && c.responds_to === claimId);
}

/** Cases containing an event: phases of one case count once. */
export function casesOf(pilot: CasePilot, eventIds: string[]): string[] {
  return pilot.cases.filter((c) => c.events.some((id) => eventIds.includes(id))).map((c) => c.id);
}
