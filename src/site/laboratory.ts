import {
  type AssertionProvenanceGraph,
  analyzeAssertionIndependence,
  fromB17GenealogySources,
  type ProvenanceNode,
} from "../claims/provenance.ts";
import type {
  DormantClosureReason,
  DormantHypothesis,
  DormantStatus,
} from "../discovery/dormant.ts";
import type { QueueItem } from "../discovery/queue/schema.ts";
import {
  type AttributionQualification,
  type EvidenceLevel,
  type Hypothesis,
  type LocalizedText,
  type QualifiedAssertion,
  type Relationship,
  THEMES,
  type Theme,
} from "../model/index.ts";

export type HypothesisPriority = Hypothesis["priority"];

import { textOf } from "./i18n.ts";
import type { ReadModel } from "./read-model.ts";

export const WHY_WE_KNOW_DIMENSIONS = ["occurrence", "perpetrator", "sponsor", "impact"] as const;
export type WhyWeKnowDimension = (typeof WHY_WE_KNOW_DIMENSIONS)[number];

export type DimensionStatus = "established" | "attributed" | "disputed" | "missing";

export type WhyWeKnowAssertion = {
  id: string;
  dimension: WhyWeKnowDimension;
  summary: LocalizedText;
  kind: "fact" | "attribution" | "denial" | "judgment" | "relationship" | "event";
  attribution_qualification: AttributionQualification | null;
  evidence_level: EvidenceLevel | null;
  asserted_by: string | null;
  asserted_by_label: string | null;
  sources: string[];
  supporting_count: number;
  contrary_count: number;
  confirmed_origins: number;
  uncertain_origins: number;
  unknown_origins: number;
  independent_established_origins: string[];
  provenance_summary_it: string;
};

export type WhyWeKnowDimensionBreakdown = {
  dimension: WhyWeKnowDimension;
  status: DimensionStatus;
  assertions: WhyWeKnowAssertion[];
  confirmed_origins: number;
  uncertain_origins: number;
  unknown_origins: number;
  source_count: number;
};

export type WhyWeKnowBreakdown = {
  record_id: string;
  record_kind: "event" | "entity" | "relationship" | "unknown";
  dimensions: Record<WhyWeKnowDimension, WhyWeKnowDimensionBreakdown>;
  total_assertions: number;
  total_confirmed_origins: number;
  total_uncertain_origins: number;
  total_unknown_origins: number;
};

export type PublicOpenQuestion = {
  id: string;
  source: "hypothesis" | "discovery_queue";
  question: LocalizedText;
  current_limit: LocalizedText | null;
  evidence_needed: LocalizedText | null;
  priority: HypothesisPriority;
  status: string;
  subject_id: string | null;
  object_id: string | null;
  subject_label: string | null;
  object_label: string | null;
  themes: Theme[];
  source_count: number;
  voi_score: number;
};

export type SanitizedColdCase = {
  hypothesis_id: string;
  status: DormantStatus;
  closure_reason: DormantClosureReason | null;
  closure_rationale: string | null;
  period_summary: string;
  themes: string[];
  last_checked_at: string | null;
  reactivation_count: number;
};

export type CompetingHypothesisGroup = {
  group_key: string;
  topic_label: LocalizedText;
  subject_id: string | null;
  object_id: string | null;
  hypotheses: PublicOpenQuestion[];
  alternative_explanations: string[];
};

export type NeededEvidenceItem = {
  id: string;
  source: "hypothesis" | "discovery_queue";
  evidence_needed: LocalizedText;
  question: LocalizedText;
  priority: HypothesisPriority;
  voi_score: number;
  estimated_cost: number | null;
  source_count: number;
  themes: Theme[];
};

export type ThemeCoverageRow = {
  theme: Theme;
  events: number;
  relationships: number;
  hypotheses: number;
};

export type LaboratoryCoverage = {
  events_total: number;
  entities_total: number;
  relationships_total: number;
  hypotheses_total: number;
  sources_total: number;
  by_evidence_level: Record<EvidenceLevel, number>;
  by_theme: ThemeCoverageRow[];
  qualified_assertions_total: number;
  records_with_why_we_know: number;
};

export type LaboratoryProjection = {
  open_questions: PublicOpenQuestion[];
  cold_cases: SanitizedColdCase[];
  competing_hypotheses: CompetingHypothesisGroup[];
  needed_evidence: NeededEvidenceItem[];
  coverage: LaboratoryCoverage;
  filtered_counts: {
    internal_queue_excluded: number;
    insinuating_excluded: number;
    person_excluded: number;
  };
};

export type LaboratoryInput = {
  queueItems?: readonly QueueItem[];
  dormantHypotheses?: readonly DormantHypothesis[];
  assertions?: readonly QualifiedAssertion[];
  provenanceGraphs?: readonly AssertionProvenanceGraph[];
  allowNamedPersons?: boolean;
};

export type WhyWeKnowOptions = {
  assertions?: readonly QualifiedAssertion[];
  provenanceGraphs?: readonly AssertionProvenanceGraph[];
};

const INSINUATING_PATTERNS: readonly RegExp[] = [
  /\b(colpevole|complice|corrott[oa]|tangenti|traditore|spia|agente segreto)\b/i,
  /\b(ha commesso (un )?reato|ha ricevuto tangenti)\b/i,
  /\b(guilty|complicit|corrupt|bribed|traitor|spy|secret agent)\b/i,
  /\b(committed a crime|took bribes)\b/i,
];

/**
 * Detects insinuating or accusatory phrasing unsuitable for unverified public questions.
 */
export function isInsinuatingQuestion(text: string): boolean {
  return INSINUATING_PATTERNS.some((pattern) => pattern.test(text));
}

function isPersonEntity(id: string | null | undefined, model: ReadModel): boolean {
  if (!id) return false;
  return model.entity(id)?.kind === "person";
}

function referencesNaturalPerson(
  refs: readonly (string | null | undefined)[],
  model: ReadModel,
): boolean {
  return refs.some((id) => isPersonEntity(id, model));
}

function priorityWeight(priority: HypothesisPriority): number {
  if (priority === "critical") return 80;
  if (priority === "high") return 65;
  if (priority === "medium") return 45;
  return 20;
}

function mapQueuePriority(score: number): HypothesisPriority {
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 40) return "medium";
  return "low";
}

/**
 * Deterministic Value-of-Information (VoI) score in [0, 100].
 * Higher priority, fewer existing sources, competing explanations, and lower cost yield higher VoI.
 */
export function computeVoiScore(params: {
  priority: HypothesisPriority | number;
  sourceCount: number;
  estimatedCost?: number | null;
  hasCompetingHypotheses?: boolean;
}): number {
  const base =
    typeof params.priority === "number"
      ? Math.max(0, Math.min(75, Math.round(params.priority * 0.75)))
      : priorityWeight(params.priority);
  const gapBonus = Math.max(0, 20 - params.sourceCount * 5);
  const competingBonus = params.hasCompetingHypotheses ? 10 : 0;
  const costPenalty =
    params.estimatedCost !== undefined && params.estimatedCost !== null && params.estimatedCost > 0
      ? Math.min(15, Math.round(params.estimatedCost * 2))
      : 0;
  return Math.max(0, Math.min(100, base + gapBonus + competingBonus - costPenalty));
}

function summarizePeriod(from: string, to: string): string {
  const startYear = from.slice(0, 4);
  const endYear = to.slice(0, 4);
  if (!startYear && !endYear) return "n/d";
  if (startYear === endYear || !endYear) return startYear;
  return `${startYear}–${endYear}`;
}

/**
 * Projects a dormant hypothesis into a sanitized public cold-case summary.
 * Strips private reactivation fingerprints (entities, places, techniques),
 * known source/root IDs, and detailed reactivation history.
 */
export function sanitizeColdCase(dormant: DormantHypothesis): SanitizedColdCase {
  return {
    hypothesis_id: dormant.hypothesis_id,
    status: dormant.status,
    closure_reason: dormant.closure_reason ?? null,
    closure_rationale: dormant.closure_rationale ?? null,
    period_summary: summarizePeriod(dormant.fingerprint.period.from, dormant.fingerprint.period.to),
    themes: [...dormant.fingerprint.themes].sort(),
    last_checked_at: dormant.last_checked_at ?? null,
    reactivation_count: dormant.reactivation_history.filter((entry) => entry.reactivated).length,
  };
}

function inferThemesForIds(ids: readonly (string | null | undefined)[], model: ReadModel): Theme[] {
  const found = new Set<Theme>();
  for (const id of ids) {
    if (!id) continue;
    const event = model.event(id);
    if (event) {
      for (const t of event.themes) found.add(t);
    }
    const entity = model.entity(id);
    if (entity) {
      for (const r of model.relationshipsOf(id)) {
        for (const eId of r.events) {
          const ev = model.event(eId);
          if (ev) for (const t of ev.themes) found.add(t);
        }
      }
    }
  }
  return [...found].sort();
}

function isInternalQueueItem(item: QueueItem): boolean {
  return (
    item.visibility !== "publishable" ||
    item.d12_redacted ||
    item.disposition === "forbidden" ||
    item.disposition === "discarded"
  );
}

/**
 * Builds the moderated public Laboratory projection:
 * - Public open questions (no internal queue items, no insinuating questions, no natural persons by default)
 * - Sanitized cold cases (no full reactivation fingerprints)
 * - Competing hypotheses
 * - VoI-ordered needed evidence
 * - Coverage summary
 */
export function projectLaboratory(
  model: ReadModel,
  input: LaboratoryInput = {},
): LaboratoryProjection {
  const allowNamedPersons = input.allowNamedPersons ?? false;
  const openQuestions: PublicOpenQuestion[] = [];
  const neededEvidence: NeededEvidenceItem[] = [];
  const competingByPair = new Map<string, PublicOpenQuestion[]>();
  const alternativeExplanationsByKey = new Map<string, Set<string>>();

  let internalQueueExcluded = 0;
  let insinuatingExcluded = 0;
  let personExcluded = 0;

  // 1. Project public canonical hypotheses
  for (const h of model.dataset.hypotheses) {
    if (!allowNamedPersons && referencesNaturalPerson([h.subject, h.object], model)) {
      personExcluded += 1;
      continue;
    }
    const qIt = textOf(h.question, "it");
    const qEn = textOf(h.question, "en");
    if (isInsinuatingQuestion(qIt) || isInsinuatingQuestion(qEn)) {
      insinuatingExcluded += 1;
      continue;
    }

    const themes = inferThemesForIds([h.subject, h.object, ...h.events], model);
    const voiScore = computeVoiScore({
      priority: h.priority,
      sourceCount: h.sources.length,
    });

    const item: PublicOpenQuestion = {
      id: h.id,
      source: "hypothesis",
      question: h.question,
      current_limit: h.current_limit,
      evidence_needed: h.evidence_needed,
      priority: h.priority,
      status: h.status,
      subject_id: h.subject,
      object_id: h.object,
      subject_label: model.nodeLabel(h.subject, "it"),
      object_label: model.nodeLabel(h.object, "it"),
      themes,
      source_count: h.sources.length,
      voi_score: voiScore,
    };

    openQuestions.push(item);

    if (h.status === "open_unproven" || h.status === "under_review") {
      neededEvidence.push({
        id: h.id,
        source: "hypothesis",
        evidence_needed: h.evidence_needed,
        question: h.question,
        priority: h.priority,
        voi_score: voiScore,
        estimated_cost: null,
        source_count: h.sources.length,
        themes,
      });
    }

    const pairKey = [h.subject, h.object].sort().join("::");
    const list = competingByPair.get(pairKey) ?? [];
    list.push(item);
    competingByPair.set(pairKey, list);
  }

  // 2. Project moderated publishable queue items
  for (const qItem of input.queueItems ?? []) {
    if (isInternalQueueItem(qItem)) {
      internalQueueExcluded += 1;
      continue;
    }
    if (!allowNamedPersons && referencesNaturalPerson(qItem.refs, model)) {
      personExcluded += 1;
      continue;
    }
    if (isInsinuatingQuestion(qItem.question)) {
      insinuatingExcluded += 1;
      continue;
    }

    const priority = mapQueuePriority(qItem.priority);
    const themes = inferThemesForIds(qItem.refs, model);
    const hasCompeting = qItem.alternative_explanations.length > 0;
    const voiScore = computeVoiScore({
      priority: qItem.priority,
      sourceCount: qItem.evidences.length,
      estimatedCost: qItem.estimated_cost ?? null,
      hasCompetingHypotheses: hasCompeting,
    });

    const primarySubject = qItem.refs[0] ?? null;
    const primaryObject = qItem.refs[1] ?? null;
    const questionText: LocalizedText = { it: qItem.question };
    const evidenceText: LocalizedText = {
      it: qItem.falsifiers.length > 0 ? qItem.falsifiers.join("; ") : qItem.question,
    };

    const publicItem: PublicOpenQuestion = {
      id: qItem.id,
      source: "discovery_queue",
      question: questionText,
      current_limit:
        qItem.alternative_explanations.length > 0
          ? { it: qItem.alternative_explanations.join("; ") }
          : null,
      evidence_needed: evidenceText,
      priority,
      status: qItem.epistemic_outcome ?? qItem.status,
      subject_id: primarySubject,
      object_id: primaryObject,
      subject_label: primarySubject ? model.nodeLabel(primarySubject, "it") : null,
      object_label: primaryObject ? model.nodeLabel(primaryObject, "it") : null,
      themes,
      source_count: qItem.evidences.length,
      voi_score: voiScore,
    };

    openQuestions.push(publicItem);

    if (qItem.status !== "closed") {
      neededEvidence.push({
        id: qItem.id,
        source: "discovery_queue",
        evidence_needed: evidenceText,
        question: questionText,
        priority,
        voi_score: voiScore,
        estimated_cost: qItem.estimated_cost ?? null,
        source_count: qItem.evidences.length,
        themes,
      });
    }

    if (hasCompeting || (primarySubject && primaryObject)) {
      const pairKey =
        primarySubject && primaryObject
          ? [primarySubject, primaryObject].sort().join("::")
          : `queue::${qItem.id}`;
      const list = competingByPair.get(pairKey) ?? [];
      list.push(publicItem);
      competingByPair.set(pairKey, list);
      const altSet = alternativeExplanationsByKey.get(pairKey) ?? new Set<string>();
      for (const alt of qItem.alternative_explanations) altSet.add(alt);
      alternativeExplanationsByKey.set(pairKey, altSet);
    }
  }

  openQuestions.sort((a, b) => b.voi_score - a.voi_score || a.id.localeCompare(b.id));
  neededEvidence.sort((a, b) => b.voi_score - a.voi_score || a.id.localeCompare(b.id));

  // 3. Competing hypotheses: groups with 2+ hypotheses or explicit alternative explanations
  const competingHypotheses: CompetingHypothesisGroup[] = [];
  for (const [key, items] of competingByPair.entries()) {
    const alts = [...(alternativeExplanationsByKey.get(key) ?? [])];
    if (items.length < 2 && alts.length === 0) continue;
    const first = items[0];
    if (!first) continue;
    const topicIt =
      first.subject_label && first.object_label
        ? `${first.subject_label} — ${first.object_label}`
        : textOf(first.question, "it");
    competingHypotheses.push({
      group_key: key,
      topic_label: { it: topicIt },
      subject_id: first.subject_id,
      object_id: first.object_id,
      hypotheses: items.sort((a, b) => b.voi_score - a.voi_score || a.id.localeCompare(b.id)),
      alternative_explanations: alts,
    });
  }
  competingHypotheses.sort((a, b) => a.group_key.localeCompare(b.group_key));

  // 4. Sanitized cold cases
  const coldCases = (input.dormantHypotheses ?? [])
    .map(sanitizeColdCase)
    .sort((a, b) => a.hypothesis_id.localeCompare(b.hypothesis_id));

  // 5. Coverage summary
  const byEvidenceLevel: Record<EvidenceLevel, number> = {
    E1: 0,
    E2: 0,
    E3: 0,
    E4: 0,
    E5: model.dataset.hypotheses.length,
  };
  for (const rel of model.dataset.relationships) {
    byEvidenceLevel[rel.evidence_level] += 1;
  }

  const byTheme: ThemeCoverageRow[] = THEMES.map((theme) => {
    const themeEvents = model.dataset.events.filter((e) => e.themes.includes(theme));
    const themeEventIds = new Set(themeEvents.map((e) => e.id));
    const themeRels = model.dataset.relationships.filter((r) =>
      r.events.some((id) => themeEventIds.has(id)),
    );
    const themeHyps = openQuestions.filter((h) => h.themes.includes(theme));
    return {
      theme,
      events: themeEvents.length,
      relationships: themeRels.length,
      hypotheses: themeHyps.length,
    };
  });

  const assertions = input.assertions ?? [];
  const coveredRecordIds = new Set<string>();
  for (const a of assertions) {
    coveredRecordIds.add(a.subject);
    coveredRecordIds.add(a.object);
  }
  if (coveredRecordIds.size === 0) {
    for (const e of model.dataset.events) coveredRecordIds.add(e.id);
    for (const r of model.dataset.relationships) {
      if (!model.isRestricted(r)) coveredRecordIds.add(r.id);
    }
  }

  return {
    open_questions: openQuestions,
    cold_cases: coldCases,
    competing_hypotheses: competingHypotheses,
    needed_evidence: neededEvidence,
    coverage: {
      events_total: model.dataset.events.length,
      entities_total: model.dataset.entities.length,
      relationships_total: model.dataset.relationships.length,
      hypotheses_total: model.dataset.hypotheses.length,
      sources_total: model.dataset.sources.length,
      by_evidence_level: byEvidenceLevel,
      by_theme: byTheme,
      qualified_assertions_total: assertions.length,
      records_with_why_we_know: coveredRecordIds.size,
    },
    filtered_counts: {
      internal_queue_excluded: internalQueueExcluded,
      insinuating_excluded: insinuatingExcluded,
      person_excluded: personExcluded,
    },
  };
}

function classifyPredicateDimension(predicate: string, relClass?: string): WhyWeKnowDimension {
  const text = `${predicate} ${relClass ?? ""}`.toLowerCase();
  if (
    /\b(sponsor|financ|fund|direct|control|coordinat|mandat|finanziat|dirett|controll|coordinat|sostenut)/i.test(
      text,
    ) ||
    relClass === "control" ||
    relClass === "financial"
  ) {
    return "sponsor";
  }
  if (
    /\b(perpetrat|conduct|execut|carri|attribut|sabotag|attack|condott|eseguit|attribuit|attacc)/i.test(
      text,
    ) ||
    relClass === "security_intelligence"
  ) {
    return "perpetrator";
  }
  if (
    /\b(impact|disrupt|damag|affect|compromis|target|colpit|danneggiat|interrott|dipendenz)/i.test(
      text,
    ) ||
    relClass === "economic_dependency"
  ) {
    return "impact";
  }
  return "occurrence";
}

function analyzeSourcesForRecord(
  assertionId: string,
  citedIds: readonly string[],
  model: ReadModel,
  explicitGraph?: AssertionProvenanceGraph,
) {
  if (explicitGraph) {
    return analyzeAssertionIndependence(explicitGraph, citedIds);
  }
  const nodes: ProvenanceNode[] = fromB17GenealogySources(model.dataset.sources, citedIds);
  return analyzeAssertionIndependence({ assertion_id: assertionId, nodes }, citedIds);
}

function deriveDimensionStatus(assertions: readonly WhyWeKnowAssertion[]): DimensionStatus {
  if (assertions.length === 0) return "missing";
  const hasDispute = assertions.some(
    (a) =>
      a.attribution_qualification === "disputed" ||
      a.attribution_qualification === "denied" ||
      a.contrary_count > 0,
  );
  if (hasDispute) return "disputed";
  const hasEstablished = assertions.some(
    (a) =>
      a.attribution_qualification === "attribution_established" ||
      a.evidence_level === "E1" ||
      (a.confirmed_origins > 0 && a.attribution_qualification !== "authority_attributed"),
  );
  if (hasEstablished) return "established";
  return "attributed";
}

function emptyDimension(dimension: WhyWeKnowDimension): WhyWeKnowDimensionBreakdown {
  return {
    dimension,
    status: "missing",
    assertions: [],
    confirmed_origins: 0,
    uncertain_origins: 0,
    unknown_origins: 0,
    source_count: 0,
  };
}

/**
 * Builds the "Perché lo sappiamo? / Why do we know this?" evidentiary breakdown
 * across all 4 dimensions (`occurrence`, `perpetrator`, `sponsor`, `impact`) with
 * assertion status and PK-06B confirmed vs uncertain independent origins.
 */
export function buildWhyWeKnow(
  recordId: string,
  model: ReadModel,
  options: WhyWeKnowOptions = {},
): WhyWeKnowBreakdown {
  const event = model.event(recordId);
  const entity = model.entity(recordId);
  const relationship = model.dataset.relationships.find((r) => r.id === recordId);
  const recordKind: WhyWeKnowBreakdown["record_kind"] = event
    ? "event"
    : entity
      ? "entity"
      : relationship
        ? "relationship"
        : "unknown";

  const dimensions: Record<WhyWeKnowDimension, WhyWeKnowDimensionBreakdown> = {
    occurrence: emptyDimension("occurrence"),
    perpetrator: emptyDimension("perpetrator"),
    sponsor: emptyDimension("sponsor"),
    impact: emptyDimension("impact"),
  };

  const graphByAssertion = new Map(
    (options.provenanceGraphs ?? []).map((g) => [g.assertion_id, g]),
  );

  // 1. Use QualifiedAssertions when available for this record
  const matchingAssertions = (options.assertions ?? []).filter(
    (a) => a.subject === recordId || a.object === recordId,
  );

  for (const a of matchingAssertions) {
    const dim = classifyPredicateDimension(a.canonical_predicate ?? a.original_predicate);
    const citedSources = [
      ...new Set([
        ...a.supporting_evidence.map((e) => e.source_id),
        ...a.contrary_evidence.map((e) => e.source_id),
      ]),
    ];
    const independence = analyzeSourcesForRecord(
      a.id,
      citedSources,
      model,
      graphByAssertion.get(a.id),
    );
    const kind: WhyWeKnowAssertion["kind"] =
      a.attribution_qualification === "denied"
        ? "denial"
        : a.attribution_qualification === "authority_attributed"
          ? "attribution"
          : "fact";

    dimensions[dim].assertions.push({
      id: a.id,
      dimension: dim,
      summary: {
        it: `${model.nodeLabel(a.subject, "it")} ${a.original_predicate} ${model.nodeLabel(a.object, "it")}`,
        en: `${model.nodeLabel(a.subject, "en")} ${a.original_predicate} ${model.nodeLabel(a.object, "en")}`,
      },
      kind,
      attribution_qualification: a.attribution_qualification,
      evidence_level: a.evidence_level,
      asserted_by: a.asserted_by,
      asserted_by_label: a.asserted_by ? model.nodeLabel(a.asserted_by, "it") : null,
      sources: citedSources,
      supporting_count: a.supporting_evidence.length,
      contrary_count: a.contrary_evidence.length,
      confirmed_origins: independence.independent_count,
      uncertain_origins: independence.uncertain_origins.length,
      unknown_origins: independence.unknown_origins.length,
      independent_established_origins: independence.independent_established_origins,
      provenance_summary_it: independence.summary_it,
    });
  }

  // 2. Project from canonical ReadModel when no QualifiedAssertions matched
  if (matchingAssertions.length === 0) {
    if (event) {
      const independence = analyzeSourcesForRecord(event.id, event.sources, model);
      dimensions.occurrence.assertions.push({
        id: event.id,
        dimension: "occurrence",
        summary: event.title,
        kind: "event",
        attribution_qualification: null,
        evidence_level: null,
        asserted_by: null,
        asserted_by_label: null,
        sources: [...event.sources],
        supporting_count: event.sources.length,
        contrary_count: 0,
        confirmed_origins: independence.independent_count,
        uncertain_origins: independence.uncertain_origins.length,
        unknown_origins: independence.unknown_origins.length,
        independent_established_origins: independence.independent_established_origins,
        provenance_summary_it: independence.summary_it,
      });
    }

    const candidateRels: Relationship[] = event
      ? model.relationshipsCiting(event.id)
      : entity
        ? model.relationshipsOf(entity.id)
        : relationship
          ? [relationship]
          : [];

    for (const rel of candidateRels) {
      if (model.isRestricted(rel)) continue;
      const dim = classifyPredicateDimension(rel.predicate, rel.relation_class);
      const independence = analyzeSourcesForRecord(rel.id, rel.sources, model);
      dimensions[dim].assertions.push({
        id: rel.id,
        dimension: dim,
        summary: {
          it: `${model.nodeLabel(rel.subject, "it")} — ${rel.predicate} — ${model.nodeLabel(rel.object, "it")}`,
          en: `${model.nodeLabel(rel.subject, "en")} — ${rel.predicate} — ${model.nodeLabel(rel.object, "en")}`,
        },
        kind: "relationship",
        attribution_qualification: rel.evidence_level === "E2" ? "authority_attributed" : null,
        evidence_level: rel.evidence_level,
        asserted_by: null,
        asserted_by_label: null,
        sources: [...rel.sources],
        supporting_count: rel.sources.length,
        contrary_count: 0,
        confirmed_origins: independence.independent_count,
        uncertain_origins: independence.uncertain_origins.length,
        unknown_origins: independence.unknown_origins.length,
        independent_established_origins: independence.independent_established_origins,
        provenance_summary_it: independence.summary_it,
      });
    }
  }

  let totalAssertions = 0;
  let totalConfirmed = 0;
  let totalUncertain = 0;
  let totalUnknown = 0;

  for (const dim of WHY_WE_KNOW_DIMENSIONS) {
    const bucket = dimensions[dim];
    bucket.status = deriveDimensionStatus(bucket.assertions);
    const uniqueSources = new Set(bucket.assertions.flatMap((a) => a.sources));
    const uniqueConfirmed = new Set(
      bucket.assertions.flatMap((a) => a.independent_established_origins),
    );
    bucket.source_count = uniqueSources.size;
    bucket.confirmed_origins =
      uniqueConfirmed.size > 0
        ? uniqueConfirmed.size
        : bucket.assertions.reduce((sum, a) => sum + a.confirmed_origins, 0);
    bucket.uncertain_origins = bucket.assertions.reduce((sum, a) => sum + a.uncertain_origins, 0);
    bucket.unknown_origins = bucket.assertions.reduce((sum, a) => sum + a.unknown_origins, 0);

    totalAssertions += bucket.assertions.length;
    totalConfirmed += bucket.confirmed_origins;
    totalUncertain += bucket.uncertain_origins;
    totalUnknown += bucket.unknown_origins;
  }

  return {
    record_id: recordId,
    record_kind: recordKind,
    dimensions,
    total_assertions: totalAssertions,
    total_confirmed_origins: totalConfirmed,
    total_uncertain_origins: totalUncertain,
    total_unknown_origins: totalUnknown,
  };
}
