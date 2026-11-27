import type {
  Entity,
  Event,
  EvidenceLevel,
  Exposure,
  Hypothesis,
  Language,
  RelationClass,
  RelationGroup,
  Relationship,
  Source,
} from "../model/index.ts";
import { textOf } from "../site/i18n.ts";
import { type ReadModel, relationGroup, timelineItems } from "../site/read-model.ts";
import {
  orderTimeline,
  type TimelineFilters,
  matches as timelineMatches,
} from "../site/timeline.ts";
import {
  type GetRelationsParams,
  type GetTimelineParams,
  type PaginationMeta,
  QUERY_COMPLEXITY_LIMITS,
  type QueryCollection,
  QueryComplexityError,
  type SearchHit,
  type SearchRecordsParams,
} from "./types.ts";

export function validatePagination(
  offset?: number,
  limit?: number,
): { offset: number; limit: number } {
  const resolvedOffset = offset ?? 0;
  const resolvedLimit = limit ?? QUERY_COMPLEXITY_LIMITS.defaultLimit;
  if (!Number.isInteger(resolvedOffset) || resolvedOffset < 0) {
    throw new QueryComplexityError("INVALID_OFFSET", "offset must be a non-negative integer.");
  }
  if (resolvedOffset > QUERY_COMPLEXITY_LIMITS.maxOffset) {
    throw new QueryComplexityError(
      "OFFSET_LIMIT_EXCEEDED",
      `offset ${resolvedOffset} exceeds maximum allowed (${QUERY_COMPLEXITY_LIMITS.maxOffset}).`,
    );
  }
  if (!Number.isInteger(resolvedLimit) || resolvedLimit < 1) {
    throw new QueryComplexityError("INVALID_LIMIT", "limit must be a positive integer.");
  }
  if (resolvedLimit > QUERY_COMPLEXITY_LIMITS.maxLimit) {
    throw new QueryComplexityError(
      "LIMIT_EXCEEDED",
      `limit ${resolvedLimit} exceeds maximum allowed (${QUERY_COMPLEXITY_LIMITS.maxLimit}).`,
    );
  }
  return { offset: resolvedOffset, limit: resolvedLimit };
}

export function validateQueryString(query?: string): string {
  const trimmed = (query ?? "").trim();
  if (trimmed.length > QUERY_COMPLEXITY_LIMITS.maxQueryLength) {
    throw new QueryComplexityError(
      "QUERY_TOO_LONG",
      `query length ${trimmed.length} exceeds maximum allowed (${QUERY_COMPLEXITY_LIMITS.maxQueryLength}).`,
    );
  }
  return trimmed.toLowerCase();
}

export function paginate<T>(
  items: readonly T[],
  offset: number,
  limit: number,
): { items: T[]; pagination: PaginationMeta } {
  const total = items.length;
  const sliced = items.slice(offset, offset + limit);
  const hasMore = offset + sliced.length < total;
  return {
    items: sliced,
    pagination: {
      offset,
      limit,
      total,
      has_more: hasMore,
      next_offset: hasMore ? offset + sliced.length : null,
    },
  };
}

function normalizeBound(value: string | number | undefined): string | null {
  if (value === undefined) return null;
  return String(value).trim() || null;
}

/**
 * Check whether a partial date or range [start, end] overlaps [from, to].
 * Supports YYYY or YYYY-MM or YYYY-MM-DD strings and numeric years.
 */
export function matchesPeriod(
  start: string | null,
  end: string | null,
  fromRaw?: string | number,
  toRaw?: string | number,
): boolean {
  const from = normalizeBound(fromRaw);
  const to = normalizeBound(toRaw);
  if (!from && !to) return true;
  if (!start && !end) return false;
  const itemStart = start ?? end ?? "";
  const itemEnd = end ?? start ?? "";
  if (from && itemEnd.slice(0, from.length) < from) return false;
  if (to && itemStart.slice(0, to.length) > to) return false;
  return true;
}

function eventToHit(e: Event, lang: Language): SearchHit {
  return {
    id: e.id,
    collection: "events",
    label: textOf(e.title, lang),
    summary: textOf(e.description, lang),
    evidence_level: e.evidence_level ?? null,
    date: e.date.start,
    domain: null,
    relation_class: null,
    relation_group: null,
    themes: [...e.themes],
    places: [...e.places],
    sources: [...e.sources],
    caveat: e.evidence_note ? textOf(e.evidence_note, lang) : null,
  };
}

function entityToHit(e: Entity, lang: Language): SearchHit {
  return {
    id: e.id,
    collection: "entities",
    label: textOf(e.name, lang),
    summary: `${e.kind} (${e.domain})`,
    evidence_level: null,
    date: null,
    domain: e.domain,
    relation_class: null,
    relation_group: null,
    themes: [],
    places: e.country ? [e.country] : [],
    sources: [],
    caveat: null,
  };
}

function relationshipToHit(r: Relationship, model: ReadModel, lang: Language): SearchHit {
  const subj = model.nodeLabel(r.subject, lang);
  const obj = model.nodeLabel(r.object, lang);
  return {
    id: r.id,
    collection: "relationships",
    label: `${subj} —[${r.predicate}]→ ${obj}`,
    summary: r.caveat ? textOf(r.caveat, lang) : null,
    evidence_level: r.evidence_level,
    date: r.valid_from,
    domain: null,
    relation_class: r.relation_class,
    relation_group: relationGroup(r),
    themes: [],
    places: [],
    sources: [...r.sources],
    caveat: r.caveat ? textOf(r.caveat, lang) : null,
  };
}

function hypothesisToHit(h: Hypothesis, lang: Language): SearchHit {
  return {
    id: h.id,
    collection: "hypotheses",
    label: textOf(h.question, lang),
    summary: textOf(h.current_limit, lang),
    evidence_level: "E5",
    date: null,
    domain: null,
    relation_class: null,
    relation_group: null,
    themes: [],
    places: [],
    sources: [...h.sources],
    caveat: textOf(h.current_limit, lang),
  };
}

function sourceToHit(s: Source, lang: Language): SearchHit {
  return {
    id: s.id,
    collection: "sources",
    label: textOf(s.title, lang),
    summary: s.publisher ? `${s.type} — ${s.publisher}` : s.type,
    evidence_level: null,
    date: null,
    domain: null,
    relation_class: null,
    relation_group: null,
    themes: [],
    places: [],
    sources: [s.id],
    caveat: null,
  };
}

function exposureToHit(ex: Exposure, lang: Language): SearchHit {
  return {
    id: ex.id,
    collection: "exposures",
    label: `${textOf(ex.sector, lang)}: ${textOf(ex.indicator, lang)}`,
    summary: textOf(ex.consequence, lang),
    evidence_level: null,
    date: null,
    domain: null,
    relation_class: null,
    relation_group: null,
    themes: [],
    places: [],
    sources: [...ex.sources],
    caveat: textOf(ex.scope, lang),
  };
}

export function searchPublicRecords(
  model: ReadModel,
  params: SearchRecordsParams = {},
): { hits: SearchHit[]; pagination: PaginationMeta } {
  const lang = params.lang ?? "it";
  const needle = validateQueryString(params.query);
  const { offset, limit } = validatePagination(params.offset, params.limit);
  const collections = new Set<QueryCollection>(
    params.collections && params.collections.length > 0
      ? params.collections
      : ["events", "entities", "relationships", "hypotheses", "sources", "exposures"],
  );

  const hits: SearchHit[] = [];

  if (collections.has("events")) {
    for (const e of model.events) {
      if (params.domain || params.relation_class || params.relation_group) continue;
      if (params.evidence_level && e.evidence_level !== params.evidence_level) continue;
      if (params.theme && !e.themes.includes(params.theme as Event["themes"][number])) continue;
      if (params.place && !e.places.includes(params.place)) continue;
      if (!matchesPeriod(e.date.start, e.date.end, params.from, params.to)) continue;
      const hit = eventToHit(e, lang);
      if (needle) {
        const hay =
          `${e.id} ${e.title.it} ${e.title.en ?? ""} ${e.description.it} ${e.description.en ?? ""} ${e.geography?.it ?? ""} ${e.geography?.en ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) continue;
      }
      hits.push(hit);
    }
  }

  if (collections.has("entities")) {
    for (const e of model.dataset.entities) {
      if (params.relation_class || params.relation_group || params.evidence_level || params.theme)
        continue;
      if (params.from !== undefined || params.to !== undefined) continue;
      if (params.domain && e.domain !== params.domain) continue;
      if (params.place && e.country !== params.place) continue;
      const hit = entityToHit(e, lang);
      if (needle) {
        const aliases = (e.aliases ?? []).map((a) => a.name).join(" ");
        const hay =
          `${e.id} ${e.name.it} ${e.name.en ?? ""} ${e.domain} ${e.country ?? ""} ${aliases}`.toLowerCase();
        if (!hay.includes(needle)) continue;
      }
      hits.push(hit);
    }
  }

  if (collections.has("relationships")) {
    for (const r of model.dataset.relationships) {
      if (model.isRestricted(r)) continue;
      if (params.domain || params.theme || params.place) continue;
      if (params.relation_class && r.relation_class !== params.relation_class) continue;
      if (params.relation_group && relationGroup(r) !== params.relation_group) continue;
      if (params.evidence_level && r.evidence_level !== params.evidence_level) continue;
      if (!matchesPeriod(r.valid_from, r.valid_to, params.from, params.to)) continue;
      const hit = relationshipToHit(r, model, lang);
      if (needle) {
        const hay =
          `${r.id} ${r.subject} ${r.predicate} ${r.object} ${hit.label} ${r.caveat?.it ?? ""} ${r.caveat?.en ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) continue;
      }
      hits.push(hit);
    }
  }

  if (collections.has("hypotheses")) {
    for (const h of model.dataset.hypotheses) {
      if (
        params.domain ||
        params.relation_class ||
        params.relation_group ||
        params.theme ||
        params.place
      )
        continue;
      if (params.from !== undefined || params.to !== undefined) continue;
      if (params.evidence_level && params.evidence_level !== "E5") continue;
      const hit = hypothesisToHit(h, lang);
      if (needle) {
        const hay =
          `${h.id} ${h.subject} ${h.object} ${h.hypothesis_type} ${h.question.it} ${h.question.en ?? ""} ${h.current_limit.it}`.toLowerCase();
        if (!hay.includes(needle)) continue;
      }
      hits.push(hit);
    }
  }

  if (collections.has("sources")) {
    for (const s of model.dataset.sources) {
      if (
        params.domain ||
        params.relation_class ||
        params.relation_group ||
        params.evidence_level ||
        params.theme ||
        params.place
      )
        continue;
      if (params.from !== undefined || params.to !== undefined) continue;
      const hit = sourceToHit(s, lang);
      if (needle) {
        const hay =
          `${s.id} ${s.title.it} ${s.title.en ?? ""} ${s.publisher ?? ""} ${s.type}`.toLowerCase();
        if (!hay.includes(needle)) continue;
      }
      hits.push(hit);
    }
  }

  if (collections.has("exposures")) {
    for (const ex of model.dataset.exposures) {
      if (
        params.domain ||
        params.relation_class ||
        params.relation_group ||
        params.evidence_level ||
        params.theme ||
        params.place
      )
        continue;
      if (params.from !== undefined || params.to !== undefined) continue;
      const hit = exposureToHit(ex, lang);
      if (needle) {
        const hay =
          `${ex.id} ${ex.sector.it} ${ex.sector.en ?? ""} ${ex.indicator.it} ${ex.indicator.en ?? ""} ${ex.consequence.it} ${ex.scope.it}`.toLowerCase();
        if (!hay.includes(needle)) continue;
      }
      hits.push(hit);
    }
  }

  const { items, pagination } = paginate(hits, offset, limit);
  return { hits: items, pagination };
}

export function filterPublicRelationships(
  model: ReadModel,
  params: GetRelationsParams = {},
): { relationships: Relationship[]; pagination: PaginationMeta } {
  const { offset, limit } = validatePagination(params.offset, params.limit);
  const includeParticipation = params.include_participation ?? true;

  const base = params.node_id ? model.relationshipsOf(params.node_id) : model.dataset.relationships;

  const filtered = base.filter((r) => {
    if (model.isRestricted(r)) return false;
    if (!includeParticipation && relationGroup(r) === "participation") return false;
    if (params.relation_class && r.relation_class !== params.relation_class) return false;
    if (params.relation_group && relationGroup(r) !== params.relation_group) return false;
    if (params.evidence_level && r.evidence_level !== params.evidence_level) return false;
    if (!matchesPeriod(r.valid_from, r.valid_to, params.from, params.to)) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => a.id.localeCompare(b.id));
  const { items, pagination } = paginate(sorted, offset, limit);
  return { relationships: items, pagination };
}

/**
 * Filter timeline items using the exact same `matches` and `orderTimeline`
 * functions as the public site (`src/site/timeline.ts`) to guarantee parity.
 */
export function filterPublicTimeline(model: ReadModel, params: GetTimelineParams = {}) {
  const lang = params.lang ?? "it";
  validateQueryString(params.query);
  const { offset, limit } = validatePagination(params.offset, params.limit);

  const siteFilters: TimelineFilters = {
    theme: params.theme ?? "",
    from: params.from ?? null,
    to: params.to ?? null,
    query: params.query ?? "",
    pending: params.pending ?? true,
    metadata: params.metadata ?? false,
    order: params.order ?? "newest",
  };

  const allItems = timelineItems(model, lang);
  const matched = allItems.filter((item) => {
    if (!timelineMatches(item, siteFilters)) return false;
    if (params.place && !item.places.includes(params.place)) return false;
    if (params.evidence_level && item.evidence_level !== params.evidence_level) return false;
    return true;
  });

  const ordered = orderTimeline(matched, siteFilters.order);
  const { items, pagination } = paginate(ordered, offset, limit);
  return { items, pagination };
}

export type FilterParityMeta = {
  relation_class?: RelationClass | undefined;
  relation_group?: RelationGroup | undefined;
  evidence_level?: EvidenceLevel | undefined;
};
