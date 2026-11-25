import { existsSync, readFileSync } from "node:fs";
import { loadPathGrammar, type PathGrammar } from "../discovery/generators/open-triads.ts";
import type { DiscoveryQueue } from "../discovery/queue/schema.ts";
import { projectPublicQueue } from "../discovery/queue/state-machine.ts";
import { type CasePilot, readCasePilot } from "../editorial/cases.ts";
import { readInferenceRegistry } from "../editorial/inferences.ts";
import { readEngineManifest } from "../engine/manifest.ts";
import {
  COLLECTION_NAMES,
  type CollectionName,
  type Dataset,
  type Entity,
  type Event,
  type Language,
  type Relationship,
  type Source,
} from "../model/index.ts";
import { repoPath } from "../pipeline/paths.ts";
import {
  checkProjectionStaleness,
  DEFAULT_MAX_STALENESS_SECONDS,
  type StalenessCheckResult,
} from "../retractions/policy.ts";
import { canonicalCounts } from "../site/counts.ts";
import { exportCommit } from "../site/exports.ts";
import { EVIDENCE_PLAIN_LABELS, GLOSSARY } from "../site/glossary.ts";
import { type DataCommit, dataHistory } from "../site/history.ts";
import {
  AUTHORITY_RULE,
  CATEGORY_DEFINITIONS,
  type CounterInferenceAudit,
  counterInferenceAudit,
  INTERRUPT_RULE,
} from "../site/inferences.ts";
import { type PublicationReport, publicationReport } from "../site/publication.ts";
import { buildReadModel, loadReadModel, type ReadModel } from "../site/read-model.ts";
import { DEFAULT_SNAPSHOTS_DIR, indexPathOf, SnapshotIndexSchema } from "../temporal/snapshots.ts";
import {
  filterPublicRelationships,
  filterPublicTimeline,
  paginate,
  searchPublicRecords,
  validatePagination,
} from "./filters.ts";
import { findPublicPaths } from "./paths.ts";
import type {
  EvidenceDepth,
  FindPathsParams,
  GetRelationsParams,
  GetTimelineParams,
  QueryCaveat,
  QueryEngineOptions,
  QueryEnvelope,
  SearchRecordsParams,
  SnapshotInfo,
  SourceSummary,
} from "./types.ts";

export * from "./filters.ts";
export * from "./paths.ts";
export * from "./types.ts";

const STANDARD_CORPUS_CAVEAT: QueryCaveat = {
  code: "public_projection_only",
  text: "Results come exclusively from the public OEM projection; withheld, unreviewed, suspended, and restricted person records are excluded.",
};

function toSourceSummary(s: Source): SourceSummary {
  return {
    id: s.id,
    type: s.type,
    title: s.title,
    publisher: s.publisher,
    urls: [...s.urls],
  };
}

function stripInternalFields<T extends Record<string, unknown>>(record: T): Omit<T, "provenance"> {
  const { provenance: _p, ...rest } = record;
  return rest;
}

function loadDefaultSnapshotInfo(): SnapshotInfo {
  const indexPath = indexPathOf(DEFAULT_SNAPSHOTS_DIR);
  const commit = exportCommit();
  if (existsSync(indexPath)) {
    try {
      const parsed = SnapshotIndexSchema.parse(JSON.parse(readFileSync(indexPath, "utf8")));
      const latestId = parsed.latest_published_snapshot_id ?? parsed.latest_accepted_snapshot_id;
      const summary = parsed.snapshots.find((s) => s.snapshot_id === latestId) ?? null;
      return {
        snapshot_id: latestId,
        status: summary?.status ?? null,
        generated_at: parsed.generated_at,
        commit: summary?.commit ?? commit.commit,
        dataset_hash: summary?.dataset_hash ?? null,
      };
    } catch {
      // Fall back to commit metadata if snapshot index is unreadable.
    }
  }
  return {
    snapshot_id: null,
    status: null,
    generated_at: commit.commit_date,
    commit: commit.commit,
    dataset_hash: null,
  };
}

function collectPublicRecordIds(dataset: Dataset): Set<string> {
  const ids = new Set<string>();
  for (const collection of COLLECTION_NAMES) {
    for (const r of dataset[collection]) ids.add(r.id);
  }
  return ids;
}

export class QueryEngine {
  readonly report: PublicationReport;
  readonly model: ReadModel;
  readonly audit: CounterInferenceAudit;
  readonly snapshot: SnapshotInfo;
  readonly maxStalenessSeconds: number;
  private readonly publicIds: Set<string>;
  private readonly pathGrammar: PathGrammar | undefined;
  private readonly casePilot: CasePilot | undefined;
  private readonly discoveryQueue: DiscoveryQueue | undefined;
  private readonly historyOverride: DataCommit[] | undefined;
  private readonly nowOverride: string | Date | undefined;

  constructor(options: QueryEngineOptions = {}) {
    if (options.report) {
      this.report = options.report;
    } else if (options.dataset) {
      this.report = publicationReport(options.dataset, undefined, options.suspendedIds);
    } else {
      const canonical = loadReadModel().dataset;
      this.report = publicationReport(canonical, undefined, options.suspendedIds);
    }

    this.model = options.model ?? buildReadModel(this.report.dataset);
    this.publicIds = collectPublicRecordIds(this.report.dataset);
    this.audit = options.audit ?? counterInferenceAudit(readInferenceRegistry(), this.model);
    this.snapshot = options.snapshot ?? loadDefaultSnapshotInfo();
    this.maxStalenessSeconds = options.maxStalenessSeconds ?? DEFAULT_MAX_STALENESS_SECONDS;
    this.nowOverride = options.now;
    this.historyOverride = options.history;

    if (options.pathGrammar) {
      this.pathGrammar = options.pathGrammar;
    } else {
      try {
        this.pathGrammar = loadPathGrammar();
      } catch {
        this.pathGrammar = undefined;
      }
    }

    if (options.casePilot) {
      this.casePilot = options.casePilot;
    } else {
      try {
        this.casePilot = readCasePilot();
      } catch {
        this.casePilot = undefined;
      }
    }

    this.discoveryQueue = options.discoveryQueue;
  }

  checkStaleness(now: string | Date | undefined = this.nowOverride): StalenessCheckResult {
    const generatedAt = this.snapshot.generated_at ?? "";
    return checkProjectionStaleness({
      projection: "mcp",
      generatedAt,
      ...(now !== undefined ? { now } : {}),
      maxStalenessSeconds: this.maxStalenessSeconds,
    });
  }

  private resolveSources(sourceIds: readonly string[]): SourceSummary[] {
    const seen = new Set<string>();
    const out: SourceSummary[] = [];
    for (const id of sourceIds) {
      if (seen.has(id)) continue;
      seen.add(id);
      const s = this.model.source(id);
      if (s) out.push(toSourceSummary(s));
    }
    return out;
  }

  private envelope<T>(
    data: T,
    canonicalIds: string[],
    sourceIds: string[],
    extraCaveats: QueryCaveat[] = [],
    pagination?: QueryEnvelope<T>["pagination"],
  ): QueryEnvelope<T> {
    const staleness = this.checkStaleness();
    const caveats: QueryCaveat[] = [STANDARD_CORPUS_CAVEAT, ...extraCaveats];
    if (staleness.stale && staleness.warning) {
      caveats.push({ code: "stale_projection", text: staleness.warning });
    }
    return {
      data,
      canonical_ids: [...new Set(canonicalIds)],
      snapshot: this.snapshot,
      staleness,
      sources: this.resolveSources(sourceIds),
      caveats,
      ...(pagination ? { pagination } : {}),
    };
  }

  searchRecords(params: SearchRecordsParams = {}) {
    const { hits, pagination } = searchPublicRecords(this.model, params);
    const canonicalIds = hits.map((h) => h.id);
    const sourceIds = hits.flatMap((h) => h.sources);
    const caveats: QueryCaveat[] = hits
      .filter((h) => h.caveat !== null)
      .map((h) => ({ code: "record_caveat", text: h.caveat ?? "", record_id: h.id }));
    return this.envelope(hits, canonicalIds, sourceIds, caveats, pagination);
  }

  getEntity(id: string, lang: Language = "it") {
    const entity = this.model.entity(id);
    if (!entity) return null;
    const rels = this.model.relationshipsOf(id).filter((r) => !this.model.isRestricted(r));
    const hypotheses = this.model.hypothesesOf(id);
    const sourceIds = [...rels.flatMap((r) => r.sources), ...hypotheses.flatMap((h) => h.sources)];
    const caveats: QueryCaveat[] = rels
      .filter((r) => r.caveat !== null)
      .map((r) => ({
        code: "relationship_caveat",
        text: r.caveat ? (r.caveat[lang] ?? r.caveat.it) : "",
        record_id: r.id,
      }));
    const payload = {
      entity: stripInternalFields(entity),
      relationships: rels.map((r) => ({
        id: r.id,
        subject: r.subject,
        predicate: r.predicate,
        object: r.object,
        relation_class: r.relation_class,
        evidence_level: r.evidence_level,
        caveat: r.caveat,
        sources: r.sources,
      })),
      hypotheses: hypotheses.map((h) => ({
        id: h.id,
        hypothesis_type: h.hypothesis_type,
        question: h.question,
        current_limit: h.current_limit,
        status: h.status,
      })),
    };
    return this.envelope(
      payload,
      [entity.id, ...rels.map((r) => r.id), ...hypotheses.map((h) => h.id)],
      sourceIds,
      caveats,
    );
  }

  getEvent(id: string) {
    const event = this.model.event(id);
    if (!event) return null;
    const citingRels = this.model
      .relationshipsCiting(id)
      .filter((r) => !this.model.isRestricted(r));
    const sourceIds = [...event.sources, ...citingRels.flatMap((r) => r.sources)];
    const caveats: QueryCaveat[] = [];
    if (event.evidence_note) {
      caveats.push({
        code: "event_evidence_note",
        text: event.evidence_note.it,
        record_id: event.id,
      });
    }
    const payload = {
      event: stripInternalFields(event),
      citing_relationships: citingRels.map((r) => ({
        id: r.id,
        subject: r.subject,
        predicate: r.predicate,
        object: r.object,
        evidence_level: r.evidence_level,
        caveat: r.caveat,
        sources: r.sources,
      })),
    };
    return this.envelope(payload, [event.id, ...citingRels.map((r) => r.id)], sourceIds, caveats);
  }

  getCase(id: string) {
    if (!this.casePilot) return null;
    const foundCase = this.casePilot.cases.find((c) => c.id === id);
    if (!foundCase) return null;
    // Enforce public boundary: all case events and sources must be in the public dataset.
    const publicEvents = foundCase.events.filter((eid) => this.publicIds.has(eid));
    const publicSources = foundCase.sources.filter((sid) => this.publicIds.has(sid));
    if (publicEvents.length === 0 || publicSources.length === 0) return null;

    const claims = this.casePilot.claims
      .filter((cl) => cl.case === foundCase.id)
      .filter((cl) => cl.sources.every((sid) => this.publicIds.has(sid)))
      .filter((cl) => cl.transcribed_from.every((tf) => this.publicIds.has(tf.record)))
      .filter((cl) =>
        cl.person_status.every(
          (ps) => this.publicIds.has(ps.entity) && this.publicIds.has(ps.primary_source),
        ),
      );

    const sourceIds = [...publicSources, ...claims.flatMap((c) => c.sources)];
    const caveats: QueryCaveat[] = claims
      .filter((c) => c.limit !== null)
      .map((c) => ({ code: "claim_limit", text: c.limit?.it ?? "", record_id: c.id }));

    return this.envelope(
      {
        case: { ...stripInternalFields(foundCase), events: publicEvents, sources: publicSources },
        claims: claims.map((c) => stripInternalFields(c)),
      },
      [foundCase.id, ...publicEvents, ...claims.map((c) => c.id)],
      sourceIds,
      caveats,
    );
  }

  getRelations(params: GetRelationsParams = {}) {
    const { relationships, pagination } = filterPublicRelationships(this.model, params);
    const lang = params.lang ?? "it";
    const items = relationships.map((r) => ({
      id: r.id,
      subject: r.subject,
      subject_label: this.model.nodeLabel(r.subject, lang),
      predicate: r.predicate,
      object: r.object,
      object_label: this.model.nodeLabel(r.object, lang),
      relation_class: r.relation_class,
      evidence_level: r.evidence_level,
      evidence_status: r.evidence_status,
      valid_from: r.valid_from,
      valid_to: r.valid_to,
      primary_url: r.primary_url,
      caveat: r.caveat,
      sources: r.sources,
    }));
    const caveats: QueryCaveat[] = relationships
      .filter((r) => r.caveat !== null)
      .map((r) => ({
        code: "relationship_caveat",
        text: r.caveat?.[lang] ?? r.caveat?.it ?? "",
        record_id: r.id,
      }));
    return this.envelope(
      items,
      relationships.map((r) => r.id),
      relationships.flatMap((r) => r.sources),
      caveats,
      pagination,
    );
  }

  getEvidence(id: string, depth: EvidenceDepth = "summary") {
    const rel = this.model.dataset.relationships.find(
      (r) => r.id === id && !this.model.isRestricted(r),
    );
    const event = this.model.event(id);
    const entity = this.model.entity(id);
    const hyp = this.model.hypothesis(id);
    const exposure = this.model.dataset.exposures.find((ex) => ex.id === id);

    if (!rel && !event && !entity && !hyp && !exposure) return null;

    if (rel) {
      const b15 = this.audit.caveat_classifications.find((c) => c.relationship === rel.id) ?? null;
      const base = {
        id: rel.id,
        collection: "relationships" as const,
        depth,
        evidence_level: rel.evidence_level,
        evidence_status: rel.evidence_status,
        caveat: rel.caveat,
        source_ids: rel.sources,
      };
      const payload =
        depth === "summary"
          ? base
          : depth === "standard"
            ? {
                ...base,
                primary_url: rel.primary_url,
                events: rel.events,
                valid_from: rel.valid_from,
                valid_to: rel.valid_to,
              }
            : {
                ...base,
                primary_url: rel.primary_url,
                events: rel.events,
                valid_from: rel.valid_from,
                valid_to: rel.valid_to,
                b15_classification: b15,
              };
      const caveats: QueryCaveat[] = rel.caveat
        ? [{ code: "relationship_caveat", text: rel.caveat.it, record_id: rel.id }]
        : [];
      return this.envelope(payload, [rel.id, ...rel.events], rel.sources, caveats);
    }

    if (event) {
      const citing = this.model
        .relationshipsCiting(event.id)
        .filter((r) => !this.model.isRestricted(r));
      const sourceIds = [...event.sources, ...citing.flatMap((r) => r.sources)];
      const base = {
        id: event.id,
        collection: "events" as const,
        depth,
        evidence_level: event.evidence_level,
        evidence_note: event.evidence_note,
        source_ids: event.sources,
        citing_relationship_count: citing.length,
      };
      const payload =
        depth === "summary"
          ? base
          : depth === "standard"
            ? {
                ...base,
                url: event.url,
                publisher: event.publisher,
                known_issues: event.known_issues,
              }
            : {
                ...base,
                url: event.url,
                publisher: event.publisher,
                known_issues: event.known_issues,
                citing_relationships: citing.map((r) => ({
                  id: r.id,
                  predicate: r.predicate,
                  evidence_level: r.evidence_level,
                  caveat: r.caveat,
                  sources: r.sources,
                })),
              };
      const caveats: QueryCaveat[] = event.evidence_note
        ? [{ code: "event_evidence_note", text: event.evidence_note.it, record_id: event.id }]
        : [];
      return this.envelope(payload, [event.id, ...citing.map((r) => r.id)], sourceIds, caveats);
    }

    if (entity) {
      const rels = this.model.relationshipsOf(entity.id).filter((r) => !this.model.isRestricted(r));
      const sourceIds = rels.flatMap((r) => r.sources);
      const base = {
        id: entity.id,
        collection: "entities" as const,
        depth,
        relationship_count: rels.length,
        evidence_levels: [...new Set(rels.map((r) => r.evidence_level))].sort(),
      };
      const payload =
        depth === "summary"
          ? base
          : {
              ...base,
              relationships: rels.slice(0, depth === "standard" ? 10 : rels.length).map((r) => ({
                id: r.id,
                predicate: r.predicate,
                evidence_level: r.evidence_level,
                caveat: r.caveat,
                sources: r.sources,
              })),
            };
      return this.envelope(payload, [entity.id, ...rels.map((r) => r.id)], sourceIds);
    }

    if (hyp) {
      const payload = {
        id: hyp.id,
        collection: "hypotheses" as const,
        depth,
        evidence_level: "E5" as const,
        question: hyp.question,
        current_limit: hyp.current_limit,
        evidence_needed: hyp.evidence_needed,
        status: hyp.status,
        source_ids: hyp.sources,
      };
      return this.envelope(payload, [hyp.id], hyp.sources, [
        { code: "hypothesis_e5", text: hyp.current_limit.it, record_id: hyp.id },
      ]);
    }

    if (!exposure) return null;
    return this.envelope(
      {
        id: exposure.id,
        collection: "exposures" as const,
        depth,
        sector: exposure.sector,
        indicator: exposure.indicator,
        scope: exposure.scope,
        consequence: exposure.consequence,
        status: exposure.status,
        source_ids: exposure.sources,
      },
      [exposure.id],
      exposure.sources,
    );
  }

  findPaths(params: FindPathsParams) {
    const result = findPublicPaths(this.model, this.audit, params, this.pathGrammar);
    const relIds = result.paths.flatMap((p) => p.steps.map((s) => s.relationship));
    const sourceIds = result.paths.flatMap((p) =>
      p.steps.flatMap((s) => s.sources.map((src) => src.id)),
    );
    const caveats: QueryCaveat[] = result.paths.flatMap((p) =>
      p.caveats.map((text) => ({ code: "path_caveat", text })),
    );
    if (result.b15_forbidden_for_pair.length > 0 && result.paths.length === 0) {
      caveats.push({
        code: "b15_forbidden_pair",
        text: `B15 forbidden inference pair (${result.b15_forbidden_for_pair.join(", ")}).`,
      });
    }
    return this.envelope(result, [params.from, params.to, ...relIds], sourceIds, caveats);
  }

  getTimeline(params: GetTimelineParams = {}) {
    const { items, pagination } = filterPublicTimeline(this.model, params);
    const eventIds = items.map((i) => i.id);
    const sourceIds = eventIds.flatMap((id) => this.model.event(id)?.sources ?? []);
    const caveats: QueryCaveat[] = items
      .filter((i) => i.evidence_note !== null)
      .map((i) => ({ code: "event_evidence_note", text: i.evidence_note ?? "", record_id: i.id }));
    return this.envelope(items, eventIds, sourceIds, caveats, pagination);
  }

  getChanges(offset?: number, limit?: number) {
    const { offset: off, limit: lim } = validatePagination(offset, limit);
    const commits = this.historyOverride ?? dataHistory();
    // Filter every commit's touched records to ONLY public record IDs.
    const publicCommits = commits
      .map((c) => ({
        ...c,
        records: c.records.filter((r) => this.publicIds.has(r.id)),
      }))
      .filter((c) => c.records.length > 0);
    const { items, pagination } = paginate(publicCommits, off, lim);
    const ids = items.flatMap((c) => c.records.map((r) => r.id));
    return this.envelope(items, ids, [], [], pagination);
  }

  getMethodology() {
    let engineVersion: string | null = null;
    try {
      const manifest = readEngineManifest(repoPath("docs/engine/manifest.v1.json"));
      engineVersion = manifest.engine_version;
    } catch {
      engineVersion = null;
    }
    const payload = {
      engine_version: engineVersion,
      evidence_levels: EVIDENCE_PLAIN_LABELS,
      b15_rules: {
        authority_rule: AUTHORITY_RULE,
        interrupt_rule: INTERRUPT_RULE,
        categories: CATEGORY_DEFINITIONS,
      },
      glossary: GLOSSARY,
    };
    return this.envelope(payload, [], []);
  }

  getOpenQuestions(offset?: number, limit?: number) {
    const { offset: off, limit: lim } = validatePagination(offset, limit);
    const persons = new Set(
      this.report.dataset.entities.filter((e) => e.kind === "person").map((e) => e.id),
    );

    const hypothesisQuestions = this.report.dataset.hypotheses
      .filter((h) => !persons.has(h.subject) && !persons.has(h.object))
      .map((h) => ({
        id: h.id,
        origin: "hypothesis" as const,
        subject: h.subject,
        object: h.object,
        question: h.question,
        current_limit: h.current_limit,
        evidence_needed: h.evidence_needed,
        priority: h.priority,
        status: h.status,
        sources: h.sources,
      }));

    const queueQuestions = this.discoveryQueue
      ? projectPublicQueue(this.discoveryQueue)
          .items.filter((item) => item.outcome_refs.every((ref) => !persons.has(ref)))
          .map((item) => ({
            id: item.id,
            origin: "discovery_queue" as const,
            subject: item.outcome_refs[0] ?? null,
            object: item.outcome_refs[1] ?? null,
            question: { it: item.question, en: item.question },
            current_limit: null,
            evidence_needed: null,
            priority: "medium" as const,
            status: item.status,
            sources: [] as string[],
          }))
      : [];

    const combined = [...hypothesisQuestions, ...queueQuestions];
    const { items, pagination } = paginate(combined, off, lim);
    const sourceIds = items.flatMap((q) => q.sources);
    return this.envelope(
      items,
      items.map((q) => q.id),
      sourceIds,
      [
        {
          code: "open_questions_only",
          text: "Open questions (E5) and public discovery items are investigative questions, not established facts; natural-person questions are excluded by default.",
        },
      ],
      pagination,
    );
  }

  getCoverage() {
    const counts = canonicalCounts(this.report);
    const byDomain = new Map<string, number>();
    for (const e of this.report.dataset.entities) {
      byDomain.set(e.domain, (byDomain.get(e.domain) ?? 0) + 1);
    }
    const byTheme = new Map<string, number>();
    const byPlace = new Map<string, number>();
    const byEvidenceLevel = new Map<string, number>();

    for (const ev of this.report.dataset.events) {
      for (const t of ev.themes) byTheme.set(t, (byTheme.get(t) ?? 0) + 1);
      for (const p of ev.places) byPlace.set(p, (byPlace.get(p) ?? 0) + 1);
      if (ev.evidence_level) {
        byEvidenceLevel.set(ev.evidence_level, (byEvidenceLevel.get(ev.evidence_level) ?? 0) + 1);
      }
    }
    for (const r of this.report.dataset.relationships) {
      if (this.model.isRestricted(r)) continue;
      byEvidenceLevel.set(r.evidence_level, (byEvidenceLevel.get(r.evidence_level) ?? 0) + 1);
    }

    const payload = {
      published_counts: counts.published,
      total_published: counts.total_published,
      withheld_summary: {
        total_withheld: counts.total_withheld,
        by_collection: counts.withheld,
      },
      latest_public_event_date: counts.latest_public_event_date,
      by_domain: Object.fromEntries(
        [...byDomain.entries()].sort((a, b) => a[0].localeCompare(b[0])),
      ),
      by_theme: Object.fromEntries([...byTheme.entries()].sort((a, b) => a[0].localeCompare(b[0]))),
      by_place: Object.fromEntries([...byPlace.entries()].sort((a, b) => a[0].localeCompare(b[0]))),
      by_evidence_level: Object.fromEntries(
        [...byEvidenceLevel.entries()].sort((a, b) => a[0].localeCompare(b[0])),
      ),
    };
    return this.envelope(payload, [], []);
  }
}

export function createQueryEngine(options?: QueryEngineOptions): QueryEngine {
  return new QueryEngine(options);
}

export type PublicCollection = CollectionName;
export type PublicEntity = Entity;
export type PublicEvent = Event;
export type PublicRelationship = Relationship;
