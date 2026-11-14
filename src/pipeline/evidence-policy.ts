import type { Entity, ProvenanceEntry, Relationship, Review, Source } from "../model/index.ts";

export type M5References = ReadonlyMap<string, readonly string[]>;

export function isOriginalPath(file: string): boolean {
  return (
    /^sources\/original\/(?!.*(?:^|\/)\.\.?\/)[^\\]+$/.test(file) &&
    !file.split("/").some((part) => part === "." || part === "..")
  );
}

export function hasOriginalProvenance(record: { provenance: ProvenanceEntry[] }): boolean {
  return record.provenance.some((entry) => isOriginalPath(entry.file));
}

export function publicationEligible(record: {
  review: Review;
  provenance: ProvenanceEntry[];
}): boolean {
  return (
    record.review.status === "reviewed" ||
    (record.review.status === "imported_unreviewed" && hasOriginalProvenance(record))
  );
}

export function consistentEvidence(relationship: Relationship): boolean {
  const statuses = {
    E1: "documented",
    E2: "institutional_attribution",
    E3: "corroborated",
    E4: "allegation",
  } as const;
  return statuses[relationship.evidence_level] === relationship.evidence_status;
}

export function personReference(
  relationship: Relationship,
  sources: readonly Source[],
  references: M5References,
): "missing" | "unregistered" | "direct" | "m5" | "original" {
  const url = relationship.primary_url;
  if (url === null) return "missing";
  if (
    sources.some((source) => relationship.sources.includes(source.id) && source.urls.includes(url))
  )
    return "direct";
  if (references.get(relationship.id)?.includes(url)) return "m5";
  if (
    relationship.provenance.some(
      (entry) =>
        isOriginalPath(entry.file) &&
        "row" in entry &&
        entry.original.id === relationship.id &&
        entry.original.primary_url === url,
    )
  )
    return "original";
  return "unregistered";
}

export function suspectPerson(entity: Entity): boolean {
  if (entity.kind === "person") return false;
  const name = entity.name.it;
  const word = "\\p{Lu}[\\p{Ll}\\p{M}]+(?:['’\\-]\\p{Lu}?[\\p{Ll}\\p{M}]+)*";
  return (
    entity.domain === "persons" ||
    new RegExp(`^${word}(?:\\s+${word}){1,3}$`, "u").test(name.trim())
  );
}
