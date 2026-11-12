import {
  COLLECTION_NAMES,
  COLLECTIONS,
  type CollectionName,
  type Dataset,
  type Entity,
  type Event,
  type Hypothesis,
  type LocalizedText,
  type Relationship,
  type Review,
  SOURCE_ID,
  type Source,
} from "../../model/index.ts";
import {
  type Claim,
  type Operation,
  type ProposalFile,
  REFERENCE_KEY,
  type Reference,
} from "../../model/proposals.ts";
import {
  DUPLICATE_THRESHOLD,
  normalizeName,
  normalizeUrl,
  POSSIBLE_DUPLICATE_THRESHOLD,
  rangesOverlap,
  textSimilarity,
} from "./match.ts";

/**
 * Reconciliation of a proposals sidecar with the canonical dataset. Pure:
 * it reads a dataset and returns the planned writes; nothing touches disk.
 *
 * Every written record is a `needs_review` candidate with an empty
 * `provenance`, and carries an `[ingest <code> <ref>]` marker in its review
 * notes. The marker makes a rerun recognise its own output, so ingesting the
 * same sidecar twice plans no change.
 */

export type Classification =
  | "new"
  | "duplicate"
  | "enrichment"
  | "conflict"
  | "rejected"
  | "already_applied";

export const CLASSIFICATIONS: Classification[] = [
  "new",
  "enrichment",
  "duplicate",
  "already_applied",
  "conflict",
  "rejected",
];

export type OperationOutcome = {
  ref: string;
  op: Operation["op"];
  item: string;
  classification: Classification;
  /** Canonical ID created, matched or updated; null when nothing resolves. */
  id: string | null;
  reasons: string[];
};

export type PlannedWrite = {
  collection: CollectionName;
  id: string;
  action: "create" | "update";
  /** Path relative to `data/`. */
  path: string;
  record: unknown;
};

export type IngestPlan = {
  source: string;
  file: string;
  /** Blocking problems: when present the writes are shown but never applied. */
  fatal: string[];
  operations: OperationOutcome[];
  writes: PlannedWrite[];
  /** Points an editor must look at even when nothing is blocked. */
  attention: string[];
};

export type IngestContext = {
  dataset: Dataset;
  /** Other sidecars (incremental archive, open PRs) to deduplicate against. */
  others?: ProposalFile[];
  /** Text of the other incremental Markdown sources, by repository path. */
  archive?: Map<string, string>;
  /** Whether a repository file exists (the Markdown source must be merged). */
  fileExists: (path: string) => boolean;
};

export const marker = (code: string, ref?: string) =>
  ref ? `[ingest ${code} ${ref}]` : `[ingest ${code}]`;
const MARKER = /^\[ingest (S\d{2})(?: ([^\]]+))?\]/;

type AnyRecord = { id: string; review: Review } & Record<string, unknown>;
type Citable = Event | Relationship | Hypothesis;

const it = (text: string): LocalizedText => ({ it: text });
const unique = <T>(values: T[]) => [...new Set(values)];

function nextId(ids: Iterable<string>, prefix: string, width: number): string {
  let max = 0;
  const pattern = new RegExp(`^${prefix}(\\d+)$`);
  for (const id of ids) {
    const match = id.match(pattern);
    if (match) max = Math.max(max, Number(match[1]));
  }
  const next = String(max + 1);
  if (next.length > width) throw new Error(`ID space ${prefix}${"9".repeat(width)} exhausted`);
  return `${prefix}${next.padStart(width, "0")}`;
}

export function planIngest(file: ProposalFile, context: IngestContext): IngestPlan {
  const code = file.source.code;
  const fatal: string[] = [];
  const attention: string[] = [];
  const outcomes: OperationOutcome[] = [];

  // Working copy of the dataset, by collection and ID.
  const store = new Map<CollectionName, Map<string, AnyRecord>>(
    COLLECTION_NAMES.map((collection) => [
      collection,
      new Map((structuredClone(context.dataset[collection]) as AnyRecord[]).map((r) => [r.id, r])),
    ]),
  );
  const collectionOf = new Map<string, CollectionName>();
  for (const [collection, records] of store) {
    for (const id of records.keys()) collectionOf.set(id, collection);
  }
  const touched = new Map<string, "create" | "update">();
  const get = (id: string) => {
    const collection = collectionOf.get(id);
    return collection ? store.get(collection)?.get(id) : undefined;
  };
  const records = <T>(collection: CollectionName) =>
    [...(store.get(collection)?.values() ?? [])] as T[];
  const put = (collection: CollectionName, record: AnyRecord) => {
    const isNew = !collectionOf.has(record.id);
    store.get(collection)?.set(record.id, record);
    collectionOf.set(record.id, collection);
    if (isNew) touched.set(record.id, "create");
    else if (!touched.has(record.id)) touched.set(record.id, "update");
  };
  const review = (notes: string[]): Review => ({ status: "needs_review", notes });

  // Records already produced by an earlier run of this sidecar.
  const applied = new Map<string, string>();
  for (const record of COLLECTION_NAMES.flatMap((c) => records<AnyRecord>(c))) {
    for (const note of record.review.notes) {
      const match = note.match(MARKER);
      if (match?.[2] && match[1] === code) applied.set(match[2], record.id);
    }
  }

  // 1. The Markdown source itself, registered as corpus document `code`.
  if (!context.fileExists(file.source.file)) {
    fatal.push(
      `${file.source.file} is not in the repository: merge the Markdown source before ingesting`,
    );
  }
  const corpus = get(code) as Source | undefined;
  if (corpus && !corpus.files.includes(file.source.file)) {
    fatal.push(`${code} already exists for ${corpus.files.join(", ") || "another document"}`);
  }
  if (!corpus) {
    const coverage = `${file.source.coverage.start}–${file.source.coverage.end}`;
    put("sources", {
      id: code,
      type: "corpus_document",
      title: it(file.source.title.it),
      publisher: null,
      files: [file.source.file],
      urls: [],
      cited_in: [],
      review: review([
        `${marker(code)} Incremental source (coverage ${coverage}, created ${file.source.created_at}` +
          `${file.source.baseline_source ? `, baseline ${file.source.baseline_source}` : ""}` +
          `${file.source.repository_commit ? `, commit ${file.source.repository_commit}` : ""}), ` +
          "registered by pnpm ingest from its proposals sidecar.",
      ]),
      provenance: [],
    } satisfies Source as AnyRecord);
  }

  // 2. Citations: local reference keys, existing source codes or URLs.
  const references = new Map(file.references.map((r) => [r.key, r]));
  const referenceByUrl = new Map(file.references.map((r) => [normalizeUrl(r.url), r]));
  const sourceByUrl = () => {
    const index = new Map<string, string>();
    for (const source of records<Source>("sources")) {
      for (const url of source.urls)
        if (!index.has(normalizeUrl(url))) index.set(normalizeUrl(url), source.id);
    }
    return index;
  };

  /** The existing source a citation resolves to, `null` if a new record would be created. */
  const preview = (citation: string): { id: string | null } | { error: string } => {
    let reference: Reference | undefined;
    if (REFERENCE_KEY.test(citation)) reference = references.get(citation);
    else if (SOURCE_ID.test(citation)) {
      return get(citation) && collectionOf.get(citation) === "sources"
        ? { id: citation }
        : { error: `source ${citation} does not exist` };
    } else {
      reference = referenceByUrl.get(normalizeUrl(citation));
      if (!reference) {
        const id = sourceByUrl().get(normalizeUrl(citation));
        return id ? { id } : { error: `URL ${citation} is neither a reference nor a source` };
      }
    }
    if (!reference) return { error: `undeclared reference ${citation}` };
    return { id: sourceByUrl().get(normalizeUrl(reference.url)) ?? null };
  };

  const commit = (citation: string): string => {
    const reference = REFERENCE_KEY.test(citation)
      ? references.get(citation)
      : SOURCE_ID.test(citation)
        ? undefined
        : referenceByUrl.get(normalizeUrl(citation));
    if (!reference) {
      const resolved = preview(citation);
      if ("error" in resolved || resolved.id === null) throw new Error(`unresolved ${citation}`);
      return resolved.id;
    }
    const existing = sourceByUrl().get(normalizeUrl(reference.url));
    if (existing) {
      const source = get(existing) as Source;
      if (existing !== code && !source.cited_in.includes(code)) {
        put("sources", { ...source, cited_in: [...source.cited_in, code] } as AnyRecord);
      }
      return existing;
    }
    const id = nextId(collectionOf.keys(), "WEB-EXT-", 3);
    const published = reference.published ? `, published ${reference.published}` : "";
    put("sources", {
      id,
      type: "external_reference",
      title: it(reference.title.it),
      publisher: reference.publisher,
      files: [],
      urls: [reference.url],
      cited_in: [code],
      review: review([
        `${marker(code, reference.key)} ${code} reference ${reference.key}${published}.`,
      ]),
      provenance: [],
    } satisfies Source as AnyRecord);
    return id;
  };

  const citationErrors = (citations: string[]) =>
    citations.flatMap((c) => {
      const resolved = preview(c);
      return "error" in resolved ? [resolved.error] : [];
    });
  const commitAll = (citations: string[]) => unique(citations.map(commit));

  // 3. Local operation references (`@ref`) → canonical IDs.
  const local = new Map<string, string>();
  const resolveNode = (
    value: string,
    allowed: CollectionName[],
  ): { id: string } | { error: string } => {
    if (value.startsWith("@")) {
      const id = local.get(value.slice(1));
      if (!id) return { error: `depends on ${value}, which was not accepted` };
      return { id };
    }
    const collection = collectionOf.get(value);
    if (!collection || !allowed.includes(collection)) {
      return { error: `${value} is not an existing ${allowed.join(" or ")} record` };
    }
    return { id: value };
  };

  const others = (context.others ?? []).filter((other) => other.source.code !== code);
  const archive = [...(context.archive ?? new Map<string, string>())].filter(
    ([path]) => path !== file.source.file,
  );

  for (const operation of file.operations) {
    const outcome: OperationOutcome = {
      ref: operation.ref,
      op: operation.op,
      item: operation.item,
      classification: "new",
      id: null,
      reasons: [],
    };
    outcomes.push(outcome);
    const done = (classification: Classification, id: string | null, reason?: string) => {
      outcome.classification = classification;
      outcome.id = id;
      if (reason) outcome.reasons.push(reason);
    };
    const tag = marker(code, operation.ref);
    const header = `${tag} ${operation.item} (${code}).`;

    const previous = applied.get(operation.ref);
    if (previous) {
      if (operation.op === "create_event" || operation.op === "create_entity") {
        local.set(operation.ref, previous);
      }
      done("already_applied", previous, `${previous} already carries ${tag}`);
      continue;
    }

    const allCitations = [
      ...operation.sources,
      ...(operation.op === "create_event"
        ? Object.values(operation.claims).flatMap((c) => c?.sources ?? [])
        : []),
    ];
    const missing = citationErrors(allCitations);
    if (missing.length > 0) {
      done("rejected", null);
      outcome.reasons.push(...missing);
      continue;
    }

    switch (operation.op) {
      case "create_event": {
        const match = matchEvent(operation, records<Event>("events"));
        if (match) {
          done(match.kind, match.id, match.reason);
          if (match.kind === "duplicate") local.set(operation.ref, match.id);
          break;
        }
        const elsewhere = others.flatMap((other) =>
          other.operations.flatMap((candidate) =>
            candidate.op === "create_event" && sameEvent(operation, candidate)
              ? [`${other.source.code} ${candidate.ref}`]
              : [],
          ),
        );
        if (elsewhere.length > 0) {
          done("duplicate", null, `already proposed in ${elsewhere.join(", ")}`);
          break;
        }
        const archived = operation.url
          ? archive.filter(([, text]) => text.includes(operation.url as string)).map(([p]) => p)
          : [];
        if (archived.length > 0) {
          done("conflict", null, `URL already cited in ${archived.join(", ")}: check its records`);
          break;
        }
        const id = nextId(collectionOf.keys(), "EXT-", 3);
        const sources = unique([code, ...commitAll(allCitations)]);
        const claimNote = (label: string, claim: Claim | null) =>
          claim
            ? [
                `${label} claim (${claim.evidence_level}; ${commitAll(claim.sources).join(", ")}): ${claim.text.it}`,
              ]
            : [];
        put("events", {
          id,
          record_type: "event",
          timeline_status: "pending_integration",
          date: operation.date,
          title: it(operation.title.it),
          description: it(operation.description.it),
          category: null,
          themes: operation.themes,
          geography: operation.geography ? it(operation.geography.it) : null,
          places: operation.places,
          evidence_note: operation.evidence_note ? it(operation.evidence_note.it) : null,
          evidence_level: operation.evidence_level,
          publisher: operation.publisher,
          url: operation.url,
          sources,
          known_issues: [],
          review: review([
            `${header} Update type ${operation.update_type}; candidate event, not yet merged into the timeline.`,
            ...(operation.published
              ? [`New evidence published ${operation.published}; the date is that of the conduct.`]
              : []),
            ...claimNote("Perpetrator", operation.claims.perpetrator),
            ...claimNote("Sponsor", operation.claims.sponsor),
            ...claimNote("Motive", operation.claims.motive),
            ...claimNote("Impact", operation.claims.impact),
            ...(operation.contrary_evidence
              ? [`Contrary evidence and uncertainty: ${operation.contrary_evidence.it}`]
              : []),
            ...(operation.related.length > 0
              ? [`Context only, not a duplicate or causal link: ${operation.related.join(", ")}.`]
              : []),
            ...operation.notes,
          ]),
          provenance: [],
        } satisfies Event as AnyRecord);
        local.set(operation.ref, id);
        done("new", id);
        break;
      }

      case "create_entity": {
        const names = [operation.name.it, ...operation.aliases].map(normalizeName);
        const existing = get(operation.id);
        if (existing && collectionOf.get(operation.id) === "entities") {
          const entity = existing as Entity;
          const known = [entity.name.it, entity.name.en ?? ""].map(normalizeName);
          if (names.some((name) => known.includes(name))) {
            local.set(operation.ref, entity.id);
            done("duplicate", entity.id, `entity ${entity.id} already exists`);
          } else {
            done("conflict", entity.id, `ID ${entity.id} is taken by "${entity.name.it}"`);
          }
          break;
        }
        if (existing) {
          done("conflict", operation.id, `ID ${operation.id} is used by another collection`);
          break;
        }
        const byName = records<Entity>("entities").find((entity) =>
          [entity.name.it, entity.name.en ?? ""].some((n) => names.includes(normalizeName(n))),
        );
        if (byName) {
          local.set(operation.ref, byName.id);
          done("duplicate", byName.id, `same name as entity ${byName.id}`);
          break;
        }
        const sources = commitAll(operation.sources);
        put("entities", {
          id: operation.id,
          kind: operation.kind,
          name: it(operation.name.it),
          domain: operation.domain,
          country: operation.country,
          review: review([
            `${header} Candidate entity (${operation.evidence_level}; ${[code, ...sources].join(", ")}).`,
            ...(operation.aliases.length > 0 ? [`Aliases: ${operation.aliases.join("; ")}.`] : []),
            ...(operation.public_relevance
              ? [`Public relevance: ${operation.public_relevance.it}`]
              : []),
            ...operation.notes,
          ]),
          provenance: [],
        } satisfies Entity as AnyRecord);
        local.set(operation.ref, operation.id);
        done("new", operation.id);
        break;
      }

      case "create_relationship": {
        const subject = resolveNode(operation.subject, ["entities", "events"]);
        const object = resolveNode(operation.object, ["entities", "events"]);
        const events = operation.events.map((e) => resolveNode(e, ["events"]));
        const errors = [subject, object, ...events].flatMap((r) => ("error" in r ? [r.error] : []));
        if (errors.length > 0 || "error" in subject || "error" in object) {
          done("rejected", null);
          outcome.reasons.push(...errors);
          break;
        }
        const persons = [subject.id, object.id].filter(
          (id) => (get(id) as Entity | undefined)?.kind === "person",
        );
        if (persons.length > 0 && (operation.primary_url === null || !operation.person_status)) {
          done(
            "rejected",
            null,
            `concerns person ${persons.join(", ")}: needs primary_url, legal/procedural status and its date`,
          );
          break;
        }
        const same = records<Relationship>("relationships").find(
          (r) =>
            r.subject === subject.id &&
            r.object === object.id &&
            r.predicate === operation.predicate,
        );
        if (same) {
          done("duplicate", same.id, `same subject, predicate and object as ${same.id}`);
          break;
        }
        const id = nextId(collectionOf.keys(), "G-", 4);
        const sources = unique([code, ...commitAll(operation.sources)]);
        put("relationships", {
          id,
          subject: subject.id,
          predicate: operation.predicate,
          object: object.id,
          relation_class: operation.relation_class,
          evidence_level: operation.evidence_level,
          evidence_status: operation.evidence_status,
          events: unique(events.map((e) => ("id" in e ? e.id : ""))),
          valid_from: operation.valid_from,
          valid_to: operation.valid_to,
          primary_url: operation.primary_url,
          caveat: operation.caveat ? it(operation.caveat.it) : null,
          sources,
          review: review([
            `${header} Candidate relationship.`,
            ...(operation.person_status
              ? [
                  `Legal/procedural status at ${operation.person_status.status_date}: ${operation.person_status.legal_status.it}`,
                ]
              : []),
            ...operation.notes,
          ]),
          provenance: [],
        } satisfies Relationship as AnyRecord);
        if (operation.primary_url === null) {
          attention.push(
            `${id}: no primary_url (pnpm data:diff --agent rejects new relationships without one)`,
          );
        }
        if (persons.length > 0)
          attention.push(`${id}: concerns named person ${persons.join(", ")}`);
        done("new", id);
        break;
      }

      case "create_hypothesis": {
        const subject = resolveNode(operation.subject, ["entities", "events"]);
        const object = resolveNode(operation.object, ["entities", "events"]);
        const events = operation.events.map((e) => resolveNode(e, ["events"]));
        const errors = [subject, object, ...events].flatMap((r) => ("error" in r ? [r.error] : []));
        if (errors.length > 0 || "error" in subject || "error" in object) {
          done("rejected", null);
          outcome.reasons.push(...errors);
          break;
        }
        const same = records<Hypothesis>("hypotheses").find(
          (h) =>
            h.hypothesis_type === operation.hypothesis_type ||
            (h.subject === subject.id &&
              h.object === object.id &&
              textSimilarity(h.question.it, operation.question.it) >= DUPLICATE_THRESHOLD),
        );
        if (same) {
          done("duplicate", same.id, `matches hypothesis ${same.id}`);
          break;
        }
        const id = nextId(collectionOf.keys(), "H", 2);
        put("hypotheses", {
          id,
          subject: subject.id,
          object: object.id,
          hypothesis_type: operation.hypothesis_type,
          question: it(operation.question.it),
          current_limit: it(operation.current_limit.it),
          priority: operation.priority ?? "medium",
          evidence_needed: it(operation.evidence_needed.it),
          events: unique(events.map((e) => ("id" in e ? e.id : ""))),
          external_url: operation.external_url,
          status: "open_unproven",
          sources: unique([code, ...commitAll(operation.sources)]),
          review: review([
            `${header} E5 hypothesis: never a relationship; promotion needs a cited primary source and explicit human approval.`,
            ...(operation.priority === null
              ? [`${code} gives no priority; 'medium' is a provisional editorial placeholder.`]
              : []),
            "The subject/object are anchors for the graph of hypotheses and do not assert a link between them.",
            ...operation.notes,
          ]),
          provenance: [],
        } satisfies Hypothesis as AnyRecord);
        attention.push(`${id}: new hypothesis`);
        done("new", id);
        break;
      }

      case "add_citation":
      case "propose_correction": {
        const target = get(operation.target) as (Citable & AnyRecord) | undefined;
        if (!target) {
          done("rejected", null, `${operation.target} does not exist`);
          break;
        }
        if (target.review.status !== "needs_review") {
          done(
            "conflict",
            target.id,
            `${target.id} is ${target.review.status}: ingest only enriches unpublished needs_review candidates; an editor applies this`,
          );
          break;
        }
        let note: string;
        if (operation.op === "propose_correction") {
          const value = valueAt(target, operation.field);
          if (value === undefined) {
            done("rejected", target.id, `${target.id} has no field ${operation.field}`);
            break;
          }
          if (
            operation.observed &&
            !normalizeName(textOf(value)).includes(normalizeName(operation.observed.it))
          ) {
            done(
              "conflict",
              target.id,
              `observed passage not found in ${target.id}.${operation.field}: the record changed or the field is wrong`,
            );
            break;
          }
          note =
            `${header} Correction proposed for "${operation.field}" (${operation.evidence_level}), not applied: ` +
            `${operation.proposed.it} Rationale: ${operation.rationale.it}`;
          attention.push(`${target.id}: correction of "${operation.field}" awaits an editor`);
        } else {
          const previewed = operation.sources.map((c) => preview(c));
          const known = previewed.every(
            (p) => "id" in p && p.id !== null && target.sources.includes(p.id),
          );
          if (known) {
            done("duplicate", target.id, `${target.id} already cites these sources`);
            break;
          }
          note = `${header} Adds sources (${operation.evidence_level}): ${operation.note.it}`;
        }
        const added = commitAll(operation.sources);
        const sources = unique([...target.sources, ...added, code]);
        put(collectionOf.get(target.id) as CollectionName, {
          ...target,
          sources,
          review: {
            ...target.review,
            notes: [...target.review.notes, `${note} [${added.join(", ")}]`, ...operation.notes],
          },
        });
        done("enrichment", target.id);
        break;
      }
    }
  }

  // Guard: an update never changes provenance or review status.
  const original = new Map(
    COLLECTION_NAMES.flatMap((c) => (context.dataset[c] as AnyRecord[]).map((r) => [r.id, r])),
  );
  for (const [id, action] of touched) {
    const before = original.get(id);
    const after = get(id);
    if (action !== "update" || !before || !after) continue;
    if (JSON.stringify(before.provenance) !== JSON.stringify(after.provenance)) {
      fatal.push(`internal: ${id} provenance would change`);
    }
    if (before.review.status !== after.review.status) {
      fatal.push(`internal: ${id} review status would change`);
    }
  }

  const writes: PlannedWrite[] = [...touched].map(([id, action]) => {
    const collection = collectionOf.get(id) as CollectionName;
    const raw = store.get(collection)?.get(id);
    const parsed = COLLECTIONS[collection].safeParse(raw);
    return {
      collection,
      id,
      action,
      path: `${collection}/${id}.json`,
      record: parsed.success ? parsed.data : raw,
    };
  });
  writes.sort(
    (a, b) =>
      COLLECTION_NAMES.indexOf(a.collection) - COLLECTION_NAMES.indexOf(b.collection) ||
      a.id.localeCompare(b.id, "en", { numeric: true }),
  );
  return {
    source: code,
    file: file.source.file,
    fatal,
    operations: outcomes,
    writes,
    attention,
  };
}

type EventProposal = Extract<Operation, { op: "create_event" }>;

function matchEvent(
  proposal: EventProposal,
  events: Event[],
): { kind: "duplicate" | "conflict"; id: string; reason: string } | null {
  if (proposal.url) {
    const url = normalizeUrl(proposal.url);
    const same = events.find((e) => e.url !== null && normalizeUrl(e.url) === url);
    if (same) return { kind: "duplicate", id: same.id, reason: `same URL as ${same.id}` };
  }
  let best: { id: string; score: number } | null = null;
  for (const event of events) {
    if (!rangesOverlap(event.date, proposal.date)) continue;
    const score = textSimilarity(event.title.it, proposal.title.it);
    if (!best || score > best.score) best = { id: event.id, score };
  }
  if (best && best.score >= DUPLICATE_THRESHOLD) {
    return {
      kind: "duplicate",
      id: best.id,
      reason: `overlapping date, title similarity ${best.score.toFixed(2)} with ${best.id}`,
    };
  }
  if (best && best.score >= POSSIBLE_DUPLICATE_THRESHOLD) {
    return {
      kind: "conflict",
      id: best.id,
      reason: `possible duplicate of ${best.id} (overlapping date, title similarity ${best.score.toFixed(2)}): an editor decides`,
    };
  }
  return null;
}

function sameEvent(a: EventProposal, b: EventProposal): boolean {
  if (a.url && b.url && normalizeUrl(a.url) === normalizeUrl(b.url)) return true;
  return (
    rangesOverlap(a.date, b.date) && textSimilarity(a.title.it, b.title.it) >= DUPLICATE_THRESHOLD
  );
}

function valueAt(record: object, path: string): unknown {
  let value: unknown = record;
  for (const key of path.split(".")) {
    if (value === null || typeof value !== "object" || !(key in value)) return undefined;
    value = (value as Record<string, unknown>)[key];
  }
  return value;
}

function textOf(value: unknown): string {
  if (typeof value === "string") return value;
  if (
    value !== null &&
    typeof value === "object" &&
    typeof (value as LocalizedText).it === "string"
  ) {
    return (value as LocalizedText).it;
  }
  return JSON.stringify(value);
}
