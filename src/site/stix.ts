import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import {
  type Dataset,
  type Entity,
  type Event,
  type EvidenceLevel,
  type LocalizedText,
  type Relationship,
  THEME_LABELS,
  THEMES,
  type Theme,
} from "../model/index.ts";
import { DEFAULT_REGISTER_PATH, suspendedRecordIds } from "../retractions/register.ts";
import { exportCommit } from "./exports.ts";
import {
  type LaboratoryProjection,
  type PublicOpenQuestion,
  projectLaboratory,
  type SanitizedColdCase,
} from "./laboratory.ts";
import { type PublicationReport, publicationReport } from "./publication.ts";
import { buildReadModel, type ReadModel } from "./read-model.ts";

export const CYBER_THEMES = new Set<Theme>(["cyber", "surveillance_spyware"]);
export const CYBER_RELATION_CLASSES = new Set<string>(["technical", "surveillance"]);

export type StixExternalReference = {
  source_name: string;
  external_id: string;
  url?: string;
};

export type StixIdentity = {
  type: "identity";
  spec_version: "2.1";
  id: string;
  created: string;
  modified: string;
  name: string;
  identity_class: "individual" | "organization" | "class" | "system" | "unknown";
  x_oem_id: string;
  x_oem_kind: Entity["kind"];
};

export type StixIncident = {
  type: "incident";
  spec_version: "2.1";
  id: string;
  created: string;
  modified: string;
  name: string;
  description: string;
  labels: string[];
  external_references: StixExternalReference[];
  x_oem_id: string;
  x_oem_evidence_level: EvidenceLevel | null;
  x_oem_review_status: Event["review"]["status"];
};

export type StixRelationship = {
  type: "relationship";
  spec_version: "2.1";
  id: string;
  created: string;
  modified: string;
  relationship_type: string;
  source_ref: string;
  target_ref: string;
  description?: string;
  external_references: StixExternalReference[];
  x_oem_id: string;
  x_oem_relation_class: string;
  x_oem_evidence_level: Relationship["evidence_level"];
  x_oem_caveat: string | null;
};

export type StixObject = StixIdentity | StixIncident | StixRelationship;

export type StixBundle = {
  type: "bundle";
  id: string;
  objects: StixObject[];
};

function deterministicUuid(seed: string): string {
  const hex = createHash("sha256").update(seed).digest("hex").slice(0, 32);
  const chars = hex.split("");
  chars[12] = "4";
  const variant = Number.parseInt(chars[16] ?? "8", 16);
  chars[16] = ((variant & 0x3) | 0x8).toString(16);
  const norm = chars.join("");
  return `${norm.slice(0, 8)}-${norm.slice(8, 12)}-${norm.slice(12, 16)}-${norm.slice(16, 20)}-${norm.slice(20, 32)}`;
}

function stixId(type: "bundle" | "identity" | "incident" | "relationship", oemId: string): string {
  return `${type}--${deterministicUuid(`oem:${type}:${oemId}`)}`;
}

function toIsoTimestamp(partialDate: string | null | undefined, fallback: string): string {
  if (!partialDate) return fallback;
  if (/^\d{4}-\d{2}-\d{2}$/.test(partialDate)) return `${partialDate}T00:00:00.000Z`;
  if (/^\d{4}-\d{2}$/.test(partialDate)) return `${partialDate}-01T00:00:00.000Z`;
  if (/^\d{4}$/.test(partialDate)) return `${partialDate}-01-01T00:00:00.000Z`;
  return fallback;
}

function mapIdentityClass(kind: Entity["kind"]): StixIdentity["identity_class"] {
  switch (kind) {
    case "person":
      return "individual";
    case "asset":
      return "system";
    case "state":
    case "institution":
    case "organization":
    case "company":
      return "organization";
    default:
      return "unknown";
  }
}

function resolveModel(input: PublicationReport | ReadModel | Dataset): {
  model: ReadModel;
  withheld: Set<string>;
} {
  if ("kind" in input) {
    return {
      model: buildReadModel(input.dataset),
      withheld: new Set(input.withheld.map((w) => w.id)),
    };
  }
  if ("relationshipsOf" in input) {
    return { model: input, withheld: new Set() };
  }
  const report = publicationReport(input);
  return {
    model: buildReadModel(report.dataset),
    withheld: new Set(report.withheld.map((w) => w.id)),
  };
}

export type CyberStixOptions = {
  withheldIds?: ReadonlySet<string>;
  timestamp?: string;
};

/**
 * Generates a cyber-only STIX 2.1 bundle from the public projection.
 * Strictly excludes non-cyber relationships, non-cyber events, restricted person
 * links, and any withheld or suspended records.
 */
export function buildCyberStixBundle(
  input: PublicationReport | ReadModel | Dataset,
  options: CyberStixOptions = {},
): StixBundle {
  const { model, withheld } = resolveModel(input);
  const suspended = existsSync(DEFAULT_REGISTER_PATH) ? suspendedRecordIds() : new Set<string>();
  const excluded = new Set<string>([...withheld, ...suspended, ...(options.withheldIds ?? [])]);
  const defaultTs = options.timestamp ?? exportCommit().commit_date ?? "2026-10-21T00:00:00.000Z";

  const cyberEvents = model.events.filter(
    (e) =>
      !excluded.has(e.id) &&
      e.review.status !== "needs_review" &&
      e.record_type === "event" &&
      e.timeline_status === "integrated" &&
      e.themes.some((t) => CYBER_THEMES.has(t)),
  );
  const cyberEventIds = new Set(cyberEvents.map((e) => e.id));

  const publicEntityIds = new Set(
    model.dataset.entities
      .filter((e) => !excluded.has(e.id) && e.review.status !== "needs_review")
      .map((e) => e.id),
  );
  const publicNodeIds = new Set([...cyberEventIds, ...publicEntityIds]);

  const cyberRelationships = model.dataset.relationships.filter(
    (r) =>
      !excluded.has(r.id) &&
      r.review.status !== "needs_review" &&
      !model.isRestricted(r) &&
      CYBER_RELATION_CLASSES.has(r.relation_class) &&
      publicNodeIds.has(r.subject) &&
      publicNodeIds.has(r.object),
  );

  const referencedEntityIds = new Set<string>();
  for (const rel of cyberRelationships) {
    if (publicEntityIds.has(rel.subject)) referencedEntityIds.add(rel.subject);
    if (publicEntityIds.has(rel.object)) referencedEntityIds.add(rel.object);
  }

  const objects: StixObject[] = [];

  for (const entity of model.dataset.entities) {
    if (!referencedEntityIds.has(entity.id)) continue;
    objects.push({
      type: "identity",
      spec_version: "2.1",
      id: stixId("identity", entity.id),
      created: defaultTs,
      modified: defaultTs,
      name: entity.name.en ?? entity.name.it,
      identity_class: mapIdentityClass(entity.kind),
      x_oem_id: entity.id,
      x_oem_kind: entity.kind,
    });
  }

  for (const ev of cyberEvents) {
    const ts = toIsoTimestamp(ev.date.start, defaultTs);
    objects.push({
      type: "incident",
      spec_version: "2.1",
      id: stixId("incident", ev.id),
      created: ts,
      modified: ts,
      name: ev.title.en ?? ev.title.it,
      description: ev.description.en ?? ev.description.it,
      labels: [...ev.themes],
      external_references: [
        {
          source_name: "our-enemies-monitor",
          external_id: ev.id,
          ...(ev.url ? { url: ev.url } : {}),
        },
      ],
      x_oem_id: ev.id,
      x_oem_evidence_level: ev.evidence_level,
      x_oem_review_status: ev.review.status,
    });
  }

  for (const rel of cyberRelationships) {
    const ts = toIsoTimestamp(rel.valid_from, defaultTs);
    const sourceType = cyberEventIds.has(rel.subject) ? "incident" : "identity";
    const targetType = cyberEventIds.has(rel.object) ? "incident" : "identity";
    objects.push({
      type: "relationship",
      spec_version: "2.1",
      id: stixId("relationship", rel.id),
      created: ts,
      modified: ts,
      relationship_type: rel.predicate.toLowerCase().replaceAll("_", "-"),
      source_ref: stixId(sourceType, rel.subject),
      target_ref: stixId(targetType, rel.object),
      ...(rel.caveat ? { description: rel.caveat.en ?? rel.caveat.it } : {}),
      external_references: [
        {
          source_name: "our-enemies-monitor",
          external_id: rel.id,
          ...(rel.primary_url ? { url: rel.primary_url } : {}),
        },
      ],
      x_oem_id: rel.id,
      x_oem_relation_class: rel.relation_class,
      x_oem_evidence_level: rel.evidence_level,
      x_oem_caveat: rel.caveat ? (rel.caveat.en ?? rel.caveat.it) : null,
    });
  }

  return {
    type: "bundle",
    id: stixId("bundle", `cyber-${objects.map((o) => o.id).join(",")}`),
    objects,
  };
}

export function serializeCyberStixBundle(bundle: StixBundle): string {
  return `${JSON.stringify(bundle, null, 2)}\n`;
}

// ---------------------------------------------------------------------------
// PK-30 Public Projections (Techniques, Vulnerabilities, Leads, Elections, Reliability)

export const TECHNIQUE_CATALOG: { id: string; theme: Theme; it: string; en: string }[] = [
  { id: "cyber", theme: "cyber", it: "Operazioni cyber", en: "Cyber operations" },
  {
    id: "hybrid_sabotage",
    theme: "hybrid_sabotage",
    it: "Sabotaggio e operazioni ibride",
    en: "Sabotage & hybrid operations",
  },
  {
    id: "information_manipulation",
    theme: "information_manipulation",
    it: "Manipolazione informativa (FIMI)",
    en: "Information manipulation (FIMI)",
  },
  {
    id: "surveillance_spyware",
    theme: "surveillance_spyware",
    it: "Spyware e sorveglianza",
    en: "Spyware & surveillance",
  },
  {
    id: "elections_influence",
    theme: "elections_influence",
    it: "Interferenza elettorale",
    en: "Electoral interference",
  },
  {
    id: "infrastructure_space",
    theme: "infrastructure_space",
    it: "Infrastrutture critiche e spazio",
    en: "Critical infrastructure & space",
  },
];

export type TechniqueProjection = {
  id: string;
  title: { it: string; en: string };
  theme: Theme;
  documentedFacts: Event[];
  /** Theme events without an event-level evidence grade (the grade lives on their relationships). */
  recordedEvents: Event[];
  investigativeNotices: {
    uncorroboratedEvents: Event[];
    openHypotheses: PublicOpenQuestion[];
  };
  statisticalAnomalies: {
    id: string;
    label: { it: string; en: string };
    note: { it: string; en: string };
  }[];
};

export function projectTechniques(
  model: ReadModel,
  lab: LaboratoryProjection = projectLaboratory(model),
): TechniqueProjection[] {
  return TECHNIQUE_CATALOG.map((tech) => {
    const events = model.events.filter(
      (e) => e.record_type === "event" && e.themes.includes(tech.theme),
    );
    const documentedFacts = events.filter(
      (e) =>
        e.evidence_level !== null &&
        (e.evidence_level === "E1" || e.evidence_level === "E2" || e.evidence_level === "E3"),
    );
    // An event without its own grade is not "uncorroborated": its evidence is
    // assessed on the relationships that cite it.
    const recordedEvents = events.filter((e) => e.evidence_level === null);
    const uncorroboratedEvents = events.filter(
      (e) => e.evidence_level === "E4" || e.evidence_level === "E5",
    );
    const openHypotheses = lab.open_questions.filter((q) => q.themes.includes(tech.theme));

    return {
      id: tech.id,
      title: { it: tech.it, en: tech.en },
      theme: tech.theme,
      documentedFacts,
      recordedEvents,
      investigativeNotices: {
        uncorroboratedEvents,
        openHypotheses,
      },
      statisticalAnomalies: [
        {
          id: `ANOM-${tech.id.toUpperCase()}`,
          label: {
            it: `Indicatore osservativo aggregato (${tech.it})`,
            en: `Aggregated observational indicator (${tech.en})`,
          },
          note: {
            it: "Segnale statistico descrittivo non causale; non costituisce prova né attribuzione.",
            en: "Non-causal descriptive statistical signal; does not constitute proof or attribution.",
          },
        },
      ],
    };
  });
}

export const VULNERABILITY_DOMAINS: Theme[] = [
  "energy",
  "infrastructure_space",
  "industry_dependencies",
  "platforms_technology",
  "cyber",
  "finance_sanctions",
];

export type VulnerabilityDomainProjection = {
  domain: Theme;
  label: { it: string; en: string };
  publicEvents: Event[];
  exposureCount: number;
  sanitizedNote: { it: string; en: string };
};

export function projectVulnerabilities(model: ReadModel): VulnerabilityDomainProjection[] {
  return VULNERABILITY_DOMAINS.map((domain) => {
    const publicEvents = model.events.filter(
      (e) => e.record_type === "event" && e.themes.includes(domain),
    );
    return {
      domain,
      label: THEME_LABELS[domain],
      publicEvents,
      exposureCount: model.dataset.exposures.length,
      sanitizedNote: {
        it: "Proiezione aggregata priva di dettagli operativi sensibili, coordinate di rete o vulnerabilità sfruttabili.",
        en: "Aggregated projection without sensitive operational details, network coordinates, or exploitable vulnerabilities.",
      },
    };
  });
}

export type ElectionDossierProjection = {
  id: string;
  event: Event;
  documentedRelationships: Relationship[];
  caveat: { it: string; en: string };
};

export function projectElectionDossiers(model: ReadModel): ElectionDossierProjection[] {
  const electionEvents = model.events.filter(
    (e) => e.record_type === "event" && e.themes.includes("elections_influence"),
  );
  return electionEvents.map((ev) => ({
    id: ev.id,
    event: ev,
    documentedRelationships: model.relationshipsCiting(ev.id).filter((r) => !model.isRestricted(r)),
    caveat: {
      it: "Evento classificato nel tema elezioni e influenza politica. La classificazione tematica non è un'attribuzione: il livello di evidenza è quello delle relazioni elencate sotto.",
      en: "Event filed under the elections and political influence theme. The theme is not an attribution: the evidence level is that of the relationships listed below.",
    },
  }));
}

export type ReliabilityRegister = {
  totalSources: number;
  byOriginType: Record<string, number>;
  byEvidenceLevel: Record<EvidenceLevel, number>;
  byReviewStatus: Record<string, number>;
};

export function projectReliabilityRegister(model: ReadModel): ReliabilityRegister {
  const byOriginType: Record<string, number> = {};
  const byReviewStatus: Record<string, number> = {};
  const byEvidenceLevel: Record<EvidenceLevel, number> = {
    E1: 0,
    E2: 0,
    E3: 0,
    E4: 0,
    E5: 0,
  };

  for (const s of model.dataset.sources) {
    const origin = s.origin_type ?? "undetermined";
    byOriginType[origin] = (byOriginType[origin] ?? 0) + 1;
    byReviewStatus[s.review.status] = (byReviewStatus[s.review.status] ?? 0) + 1;
  }

  for (const ev of model.events) {
    if (ev.evidence_level) {
      byEvidenceLevel[ev.evidence_level] += 1;
    }
  }
  for (const rel of model.dataset.relationships) {
    if (!model.isRestricted(rel)) {
      byEvidenceLevel[rel.evidence_level] += 1;
    }
  }
  for (const _h of model.dataset.hypotheses) {
    byEvidenceLevel.E5 += 1;
  }

  return {
    totalSources: model.dataset.sources.length,
    byOriginType,
    byEvidenceLevel,
    byReviewStatus,
  };
}

// ---------------------------------------------------------------------------
// PK-37 Situation Room Model (strictly public, zero private records)

export type SituationRoomItem = {
  id: string;
  title: LocalizedText;
  date: string;
  hrefPath: string;
  evidenceLevel: EvidenceLevel | "E5" | null;
  caveat: LocalizedText;
};

export type SituationRoomCountermeasureSummary = {
  id: string;
  title: LocalizedText;
  hrefPath: string;
  caveat: LocalizedText;
};

export type SituationRoomModel = {
  generated_at: string;
  /** Latest public, integrated events with their review caveat (no evidence claim). */
  latest_events: SituationRoomItem[];
  /** Latest public events carrying an event-level E1–E3 grade (often empty). */
  verified_events: SituationRoomItem[];
  dossiers_calendar: SituationRoomItem[];
  evidentiary_updates: SituationRoomItem[];
  publishable_leads: PublicOpenQuestion[];
  reactivated_cold_cases: SanitizedColdCase[];
  european_countermeasures: SituationRoomCountermeasureSummary[];
  coverage: {
    events_total: number;
    entities_total: number;
    relationships_total: number;
    hypotheses_total: number;
    by_evidence_level: Record<EvidenceLevel, number>;
    themes_covered: number;
  };
  recent_briefs: {
    id: string;
    title: { it: string; en: string };
    hrefPath: string;
    caveat: { it: string; en: string };
  }[];
};

export function buildSituationRoom(
  model: ReadModel,
  lab: LaboratoryProjection = projectLaboratory(model),
  options: { generatedAt?: string; limit?: number } = {},
): SituationRoomModel {
  const limit = options.limit ?? 8;
  const generatedAt = options.generatedAt ?? new Date().toISOString();

  const publicEvents = model.events
    .filter((e) => e.record_type === "event" && e.review.status !== "needs_review")
    .sort((a, b) => b.date.start.localeCompare(a.date.start) || b.id.localeCompare(a.id));

  const verifiedEvents: SituationRoomItem[] = publicEvents
    .filter(
      (e) => e.evidence_level === "E1" || e.evidence_level === "E2" || e.evidence_level === "E3",
    )
    .slice(0, limit)
    .map((e) => ({
      id: e.id,
      title: e.title,
      date: e.date.start,
      hrefPath: `events/${e.id}/`,
      evidenceLevel: e.evidence_level,
      caveat:
        e.review.status === "imported_unreviewed"
          ? {
              it: `${e.evidence_level ?? "N/D"} · Record importato non ancora rivisto`,
              en: `${e.evidence_level ?? "N/A"} · Imported unreviewed record`,
            }
          : {
              it: `${e.evidence_level ?? "N/D"} · Scheda evento rivista`,
              en: `${e.evidence_level ?? "N/A"} · Reviewed event record`,
            },
    }));

  const reviewCaveat = (e: Event): LocalizedText =>
    e.review.status === "reviewed"
      ? { it: "Scheda rivista da un editore", en: "Editor-reviewed record" }
      : {
          it: "Record importato, non ancora rivisto: visibile in via provvisoria",
          en: "Imported record, not yet reviewed: provisionally visible",
        };
  const latestEvents: SituationRoomItem[] = publicEvents.slice(0, limit).map((e) => ({
    id: e.id,
    title: e.title,
    date: e.date.start,
    hrefPath: `events/${e.id}/`,
    evidenceLevel: e.evidence_level,
    caveat: reviewCaveat(e),
  }));

  const dossiersCalendar: SituationRoomItem[] = publicEvents
    .filter((e) => e.themes.includes("elections_influence"))
    .slice(0, limit)
    .map((e) => ({
      id: e.id,
      title: e.title,
      date: e.date.start,
      hrefPath: `elezioni/${e.id}/`,
      evidenceLevel: e.evidence_level,
      caveat: {
        it: "Tema elezioni e influenza politica · Il tema non implica un'attribuzione",
        en: "Elections and political influence theme · The theme does not imply attribution",
      },
    }));

  const evidentiaryUpdates: SituationRoomItem[] = model.dataset.relationships
    .filter(
      (r) =>
        r.review.status !== "needs_review" &&
        !model.isRestricted(r) &&
        (r.evidence_level === "E1" || r.evidence_level === "E2" || r.evidence_level === "E3"),
    )
    .slice(0, limit)
    .map((r) => ({
      id: r.id,
      title: {
        it: `${model.nodeLabel(r.subject, "it")} → ${r.predicate} → ${model.nodeLabel(r.object, "it")}`,
        en: `${model.nodeLabel(r.subject, "en")} → ${r.predicate} → ${model.nodeLabel(r.object, "en")}`,
      },
      date: r.valid_from ?? "N/D",
      hrefPath: `entities/${r.subject}/`,
      evidenceLevel: r.evidence_level,
      caveat: r.caveat ?? {
        it: `${r.evidence_level} · Relazione pubblica documentata`,
        en: `${r.evidence_level} · Documented public relationship`,
      },
    }));

  const europeanCountermeasures: SituationRoomCountermeasureSummary[] = publicEvents
    .filter((e) => e.themes.includes("eu_nato_response"))
    .slice(0, limit)
    .map((e) => ({
      id: e.id,
      title: e.title,
      hrefPath: `events/${e.id}/`,
      caveat: {
        it: "Tema risposte UE e NATO",
        en: "EU and NATO responses theme",
      },
    }));

  const themesCovered = THEMES.filter((t) =>
    model.events.some((e) => e.record_type === "event" && e.themes.includes(t)),
  ).length;

  return {
    generated_at: generatedAt,
    latest_events: latestEvents,
    verified_events: verifiedEvents,
    dossiers_calendar: dossiersCalendar,
    evidentiary_updates: evidentiaryUpdates,
    publishable_leads: lab.open_questions.slice(0, limit),
    reactivated_cold_cases: lab.cold_cases.filter((c) => c.reactivation_count > 0).slice(0, limit),
    european_countermeasures: europeanCountermeasures,
    coverage: {
      events_total: lab.coverage.events_total,
      entities_total: lab.coverage.entities_total,
      relationships_total: lab.coverage.relationships_total,
      hypotheses_total: lab.coverage.hypotheses_total,
      by_evidence_level: { ...lab.coverage.by_evidence_level },
      themes_covered: themesCovered,
    },
    recent_briefs: [
      {
        id: "BRIEF-ARCHIVE",
        title: {
          it: "Archivio pubblico dei brief settimanali e avvisi",
          en: "Public archive of weekly briefs and alerts",
        },
        hrefPath: "brief/",
        caveat: {
          it: "Sintesi pubbliche derivate dai soli record pubblici",
          en: "Public syntheses derived strictly from public records",
        },
      },
    ],
  };
}
