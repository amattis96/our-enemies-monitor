import { readM5References } from "../editorial/m5.ts";
import {
  COLLECTION_NAMES,
  type Dataset,
  HYPOTHESIS_PRIORITY_FROM_BASELINE,
  type Hypothesis,
} from "../model/index.ts";
import { BASELINE_FILES } from "../pipeline/baseline/files.ts";
import {
  type M5References,
  personReference,
  publicationEligible,
} from "../pipeline/evidence-policy.ts";

export type WithheldReason =
  | "needs_review"
  | "missing_original_provenance"
  | "pending_integration"
  | "withheld_endpoint"
  | "withheld_event"
  | "invalid_source"
  | "person_primary_missing"
  | "person_primary_unregistered"
  | "legacy_hypothesis_changed"
  | "uncited_source_metadata";
export type Withheld = { id: string; collection: keyof Dataset; reasons: WithheldReason[] };
export type PublicationReport = {
  kind: "publication_report";
  dataset: Dataset;
  withheld: Withheld[];
  counts: Record<keyof Dataset, number>;
  projections: {
    id: string;
    omitted_events: string[];
    omitted_sources: string[];
    omitted_notes: number;
  }[];
};

function originalHypothesis(h: Hypothesis) {
  const entry = h.provenance.find(
    (p) => p.file === BASELINE_FILES.hypothesesCsv && "row" in p && p.original.id === h.id,
  );
  if (!entry || !("row" in entry)) return undefined;
  const o = entry.original;
  const node = (id: string | undefined) => (id?.startsWith("EV_") ? id.slice(3) : id);
  const same =
    node(o.subject) === h.subject &&
    node(o.object) === h.object &&
    o.hypothesis_type === h.hypothesis_type &&
    o.verification_question === h.question.it &&
    o.current_limit === h.current_limit.it &&
    o.evidence_needed === h.evidence_needed.it &&
    HYPOTHESIS_PRIORITY_FROM_BASELINE[o.priority ?? ""] === h.priority &&
    o.status === h.status &&
    (o.external_url?.trim() ? o.external_url : null) === h.external_url &&
    typeof o.source_docs === "string";
  return {
    same,
    sources: (o.source_docs ?? "")
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

/** Derive the public dataset and a minimal accounting of every withheld record. */
export function publicationReport(
  dataset: Dataset,
  references: M5References = readM5References(),
): PublicationReport {
  const reasons = new Map<string, WithheldReason[]>();
  const add = (id: string, reason: WithheldReason) => {
    const list = reasons.get(id) ?? [];
    if (!list.includes(reason)) list.push(reason);
    reasons.set(id, list);
  };
  const eligible = (r: {
    id: string;
    review: Parameters<typeof publicationEligible>[0]["review"];
    provenance: Parameters<typeof publicationEligible>[0]["provenance"];
  }) => {
    if (publicationEligible(r)) return true;
    add(r.id, r.review.status === "needs_review" ? "needs_review" : "missing_original_provenance");
    return false;
  };
  const allSourceIds = new Set(dataset.sources.map((s) => s.id));
  const invalidSources = new Set(
    dataset.sources
      .filter((s) => s.review.status === "imported_unreviewed" && !publicationEligible(s))
      .map((s) => s.id),
  );
  const sourcesValid = (r: { id: string; sources: string[] }) => {
    if (r.sources.some((id) => invalidSources.has(id))) {
      add(r.id, "invalid_source");
      return false;
    }
    return true;
  };
  const events = dataset.events.filter((e) => {
    const a = eligible(e);
    const b = sourcesValid(e);
    if (e.timeline_status !== "integrated") add(e.id, "pending_integration");
    return a && b && e.timeline_status === "integrated";
  });
  const entities = dataset.entities.filter(eligible);
  const eventIds = new Set(events.map((e) => e.id));
  const allEventIds = new Set(dataset.events.map((e) => e.id));
  const nodeIds = new Set([...eventIds, ...entities.map((e) => e.id)]);
  const persons = new Set(dataset.entities.filter((e) => e.kind === "person").map((e) => e.id));
  const endpoints = (r: { id: string; subject: string; object: string }) => {
    const ok = nodeIds.has(r.subject) && nodeIds.has(r.object);
    if (!ok) add(r.id, "withheld_endpoint");
    return ok;
  };
  const relationships = dataset.relationships.filter((r) => {
    const a = eligible(r),
      b = sourcesValid(r),
      c = endpoints(r),
      d = r.events.every((id) => eventIds.has(id));
    if (!d) add(r.id, "withheld_event");
    const ref =
      persons.has(r.subject) || persons.has(r.object)
        ? personReference(r, dataset.sources, references)
        : "direct";
    if (ref === "missing") add(r.id, "person_primary_missing");
    if (ref === "unregistered") add(r.id, "person_primary_unregistered");
    return a && b && c && d && ref !== "missing" && ref !== "unregistered";
  });
  const projections: PublicationReport["projections"] = [];
  const hypotheses = dataset.hypotheses.flatMap((h) => {
    const a = eligible(h),
      b = sourcesValid(h),
      c = endpoints(h);
    const original = h.review.status === "imported_unreviewed" ? originalHypothesis(h) : undefined;
    if (h.review.status === "imported_unreviewed" && !original?.same)
      add(h.id, "legacy_hypothesis_changed");
    // Unknown references are not silently projected away; validation must reject them.
    const events = h.events.filter((id) => eventIds.has(id) || !allEventIds.has(id));
    const validEvents = events.every((id) => eventIds.has(id));
    if (!validEvents) add(h.id, "withheld_event");
    if (
      !a ||
      !b ||
      !c ||
      !validEvents ||
      (h.review.status === "imported_unreviewed" && !original?.same)
    )
      return [];
    const sources = original
      ? h.sources.filter((id) => original.sources.includes(id) || !allSourceIds.has(id))
      : h.sources;
    const notes = original ? [] : h.review.notes;
    const omitted_events = h.events.filter((id) => !events.includes(id));
    const omitted_sources = h.sources.filter((id) => !sources.includes(id));
    const omitted_notes = h.review.notes.length - notes.length;
    if (omitted_events.length || omitted_sources.length || omitted_notes)
      projections.push({ id: h.id, omitted_events, omitted_sources, omitted_notes });
    return [{ ...h, events, sources, review: { ...h.review, notes } }];
  });
  const exposures = dataset.exposures.filter((r) => {
    const a = eligible(r),
      b = sourcesValid(r);
    return a && b;
  });
  const cited = new Set(
    [...events, ...relationships, ...hypotheses, ...exposures].flatMap((r) => r.sources),
  );
  const selected = dataset.sources.filter((s) => {
    if (publicationEligible(s)) return true;
    if (s.review.status === "needs_review" && cited.has(s.id)) return true;
    if (s.review.status === "needs_review") add(s.id, "uncited_source_metadata");
    else eligible(s);
    return false;
  });
  const sourceIds = new Set(selected.map((s) => s.id));
  const sources = selected.map((s) => ({
    ...s,
    cited_in: s.cited_in.filter((id) => sourceIds.has(id)),
  }));
  const visible: Dataset = { events, entities, relationships, hypotheses, sources, exposures };
  const withheld: Withheld[] = COLLECTION_NAMES.flatMap((collection) => {
    const ids = new Set(visible[collection].map((r) => r.id));
    return dataset[collection]
      .filter((r) => !ids.has(r.id))
      .map((r) => {
        const why = reasons.get(r.id);
        if (!why?.length) throw new Error(`Missing publication reason for ${r.id}`);
        return { id: r.id, collection, reasons: [...why].sort() };
      });
  }).sort((a, b) => a.collection.localeCompare(b.collection) || a.id.localeCompare(b.id));
  const counts = Object.fromEntries(
    COLLECTION_NAMES.map((c) => [c, withheld.filter((r) => r.collection === c).length]),
  ) as Record<keyof Dataset, number>;
  return { kind: "publication_report", dataset: visible, withheld, counts, projections };
}
export function publishedDataset(dataset: Dataset, references?: M5References): Dataset {
  return publicationReport(dataset, references).dataset;
}
