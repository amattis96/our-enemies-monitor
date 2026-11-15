import { existsSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import { readM5References } from "../editorial/m5.ts";
import {
  COLLECTION_NAMES,
  COLLECTIONS,
  type CollectionName,
  type Dataset,
  type ProvenanceEntry,
  RELATION_CLASS_GROUP,
  type Review,
} from "../model/index.ts";
import {
  consistentEvidence,
  hasOriginalProvenance,
  type M5References,
  personReference,
  suspectPerson,
} from "./evidence-policy.ts";
import { exposureGroupIssues } from "./exposure-groups.ts";
import { corpusOnlyE1, genealogyIssues } from "./genealogy.ts";
import type { DataFile } from "./load.ts";
import { repoPath } from "./paths.ts";
import { serializeRecord } from "./serialize.ts";
import { SourceReader } from "./sources.ts";
import { translationProblem } from "./translations.ts";

export type Issue = { severity: "error" | "warning"; file: string; message: string };

export type ValidationResult = {
  issues: Issue[];
  /** Records that passed schema validation. */
  dataset: Dataset;
};

/**
 * Validate data files. Never throws for data problems: every issue is
 * collected so a single run reports everything.
 */
export function validateDataFiles(
  files: DataFile[],
  reader = new SourceReader(),
  references: M5References = readM5References(),
): ValidationResult {
  const issues: Issue[] = [];
  const dataset: Dataset = {
    events: [],
    entities: [],
    relationships: [],
    hypotheses: [],
    sources: [],
    exposures: [],
  };
  const error = (file: string, message: string) =>
    issues.push({ severity: "error", file, message });
  const warning = (file: string, message: string) =>
    issues.push({ severity: "warning", file, message });

  // 1–2. Schema, file name, canonical form
  const fileOf = new Map<string, string>();
  for (const file of files) {
    let json: unknown;
    try {
      json = JSON.parse(file.text);
    } catch (cause) {
      error(file.path, `invalid JSON: ${(cause as Error).message}`);
      continue;
    }
    const parsed = COLLECTIONS[file.collection].safeParse(json);
    if (!parsed.success) {
      for (const problem of parsed.error.issues) {
        error(file.path, `${problem.path.join(".") || "(root)"}: ${problem.message}`);
      }
      continue;
    }
    const record = parsed.data;
    if (file.path !== `${file.collection}/${record.id}.json`) {
      error(file.path, `file name does not match id "${record.id}"`);
    }
    if (file.text !== serializeRecord(record)) {
      error(file.path, "not in canonical form (run pnpm format:data)");
    }
    // 3. Unique IDs across collections
    const previous = fileOf.get(record.id);
    if (previous) error(file.path, `duplicate id "${record.id}" (also in ${previous})`);
    fileOf.set(record.id, file.path);
    (dataset[file.collection] as unknown[]).push(record);
  }

  // 4. References
  const ids = (collection: CollectionName) => new Set(dataset[collection].map((r) => r.id));
  const eventIds = ids("events");
  const entityIds = ids("entities");
  const sourceIds = ids("sources");
  const nodeIds = new Set([...eventIds, ...entityIds]);
  const pathOf = (id: string) => fileOf.get(id) ?? id;
  const checkRefs = (owner: string, label: string, refs: string[], valid: Set<string>) => {
    for (const ref of refs) {
      if (!valid.has(ref)) error(pathOf(owner), `${label} "${ref}" does not exist`);
    }
  };

  for (const record of [
    ...dataset.events,
    ...dataset.relationships,
    ...dataset.hypotheses,
    ...dataset.sources,
    ...dataset.exposures,
  ]) {
    const refs = "cited_in" in record ? record.cited_in : record.sources;
    checkRefs(record.id, "source", refs, sourceIds);
  }
  for (const record of [...dataset.relationships, ...dataset.hypotheses]) {
    checkRefs(record.id, "subject", [record.subject], nodeIds);
    checkRefs(record.id, "object", [record.object], nodeIds);
    checkRefs(record.id, "event", record.events, eventIds);
    if (record.subject === record.object) error(pathOf(record.id), "subject equals object");
  }
  for (const source of dataset.sources) {
    for (const file of source.files) {
      if (!existsSync(repoPath(file))) error(pathOf(source.id), `file "${file}" does not exist`);
    }
  }

  // 4b. Source genealogy (ADR-05): references, coherence, no circular citations
  for (const issue of genealogyIssues(dataset.sources)) {
    (issue.severity === "error" ? error : warning)(pathOf(issue.id), issue.message);
  }
  // 4c. Exposure groups (B19): coherent supply chains and before/after pairs
  for (const issue of exposureGroupIssues(dataset.exposures))
    error(pathOf(issue.id), issue.message);
  // A corpus synthesis alone is not enough for E1 (ADR-05: warning, not error)
  for (const collection of ["events", "relationships"] as const) {
    const ids = corpusOnlyE1(dataset[collection], dataset.sources);
    if (ids.length === 0) continue;
    const shown = ids.slice(0, 10).join(", ");
    warning(
      `${collection}/`,
      `${ids.length} E1 record(s) cite only corpus syntheses, which alone are not enough for E1 (ADR-05): ${shown}${ids.length > 10 ? ", …" : ""}; full list: pnpm benchmark:measure (A.E7)`,
    );
  }

  // Countries: real ISO codes; only states carry one
  for (const event of dataset.events) {
    for (const code of event.places) {
      if (!isCountry(code)) error(pathOf(event.id), `place "${code}" is not an ISO country code`);
    }
  }
  for (const entity of dataset.entities) {
    if ((entity.kind === "state") !== (entity.country !== null)) {
      error(pathOf(entity.id), "country must be set for states and only for states");
    }
    if (entity.country !== null && !isCountry(entity.country)) {
      error(pathOf(entity.id), `country "${entity.country}" is not an ISO country code`);
    }
  }

  // Translations: complete, tracked and not stale
  for (const record of COLLECTION_NAMES.flatMap(
    (c): { id: string; review: Review }[] => dataset[c],
  )) {
    const problem = translationProblem(record);
    if (problem) error(pathOf(record.id), problem);
  }

  // 5. Event participation must point at an event (otherwise it reads as a direct link)
  for (const relationship of dataset.relationships) {
    const participation = RELATION_CLASS_GROUP[relationship.relation_class] === "participation";
    const touchesEvent = eventIds.has(relationship.subject) || eventIds.has(relationship.object);
    if (participation && !touchesEvent) {
      error(pathOf(relationship.id), "event_participation relationship without an event endpoint");
    }
  }

  // 7. Provenance still matches the original files
  const all = COLLECTION_NAMES.flatMap(
    (c): { id: string; provenance: ProvenanceEntry[]; review: Review }[] => dataset[c],
  );
  for (const record of all) {
    if (record.review.status === "imported_unreviewed" && !hasOriginalProvenance(record)) {
      error(pathOf(record.id), "imported_unreviewed requires original provenance");
    }
    for (const entry of record.provenance) {
      const problem = checkProvenance(entry, reader);
      if (problem) error(pathOf(record.id), `provenance ${entry.file}: ${problem}`);
    }
  }

  // 8. Named persons need a primary source before unrestricted publication
  const persons = new Set(dataset.entities.filter((e) => e.kind === "person").map((e) => e.id));
  for (const relationship of dataset.relationships) {
    const person = [relationship.subject, relationship.object].find((id) => persons.has(id));
    if (!consistentEvidence(relationship))
      error(pathOf(relationship.id), "inconsistent evidence_level and evidence_status");
    if (person) {
      const match = personReference(relationship, dataset.sources, references);
      if (match === "missing")
        warning(pathOf(relationship.id), `involves person "${person}" without primary_url`);
      if (match === "unregistered")
        warning(
          pathOf(relationship.id),
          `involves person "${person}" with unregistered primary_url`,
        );
    }
  }

  for (const entity of dataset.entities.filter(suspectPerson)) {
    const related = dataset.relationships
      .filter((r) => r.subject === entity.id || r.object === entity.id)
      .map((r) => r.id);
    if (related.length)
      warning(
        pathOf(entity.id),
        `possible person classification; relationships: ${related.join(", ")}`,
      );
  }

  return { issues, dataset };
}

function checkProvenance(entry: ProvenanceEntry, reader: SourceReader): string | null {
  if (!existsSync(repoPath(entry.file))) return "file does not exist";
  if ("row" in entry) {
    const row = reader.csvRows(entry.file)[entry.row - 1];
    if (!row) return `row ${entry.row} does not exist`;
    return isDeepStrictEqual(row, entry.original) ? null : `row ${entry.row} differs from original`;
  }
  const line = reader.lines(entry.file)[entry.line - 1];
  return line === entry.original.text ? null : `line ${entry.line} differs from original`;
}

/** Counts used in reports and documentation. */
export function summarize(dataset: Dataset) {
  const participation = dataset.relationships.filter(
    (r) => RELATION_CLASS_GROUP[r.relation_class] === "participation",
  ).length;
  return {
    events: dataset.events.length,
    timeline_events: dataset.events.filter((e) => e.timeline_status === "integrated").length,
    pending_events: dataset.events.filter((e) => e.timeline_status === "pending_integration")
      .length,
    entities: dataset.entities.length,
    relationships: dataset.relationships.length,
    event_participation: participation,
    direct_relationships: dataset.relationships.length - participation,
    hypotheses: dataset.hypotheses.length,
    sources: dataset.sources.length,
    exposures: dataset.exposures.length,
  };
}

const regionNames = new Intl.DisplayNames(["en"], { type: "region", fallback: "none" });

function isCountry(code: string): boolean {
  return code !== "ZZ" && regionNames.of(code) !== undefined;
}
