import { z } from "zod";
import { comparePartialDates, PartialDate } from "../model/schemas.ts";
import {
  projectPublicVulnerability,
  VULNERABILITY_DOMAINS,
  type VulnerabilityDomain,
  type VulnerabilityEntry,
} from "./vulnerabilities.ts";

export const RISK_EVENT_TYPES = [
  "election",
  "referendum",
  "summit",
  "legislative_vote",
  "treaty_deadline",
  "infrastructure_milestone",
] as const;
export type RiskEventType = (typeof RISK_EVENT_TYPES)[number];

export const RiskEventSchema = z
  .strictObject({
    id: z.string().min(1).describe("Stable identifier for the official risk-calendar event."),
    title: z.string().min(1).describe("Official name of the event."),
    event_type: z.enum(RISK_EVENT_TYPES).describe("Category of official risk event."),
    country: z.string().min(2).describe("ISO country code or regional code (e.g., FR, DE, EU)."),
    region: z.string().min(1).describe("Geographic region (e.g., EU, Baltics, Western Europe)."),
    scheduled_date: PartialDate.describe("Scheduled date (YYYY, YYYY-MM, or YYYY-MM-DD)."),
    window_start: PartialDate.describe("Start of heightened risk monitoring window."),
    window_end: PartialDate.describe("End of heightened risk monitoring window."),
    official_source_url: z.string().url().describe("Official institutional calendar URL."),
    source_id: z.string().min(1).describe("Source identifier in the registry."),
    risk_domains: z
      .array(z.enum(VULNERABILITY_DOMAINS))
      .min(1)
      .describe("Relevant JRC/Hybrid CoE vulnerability domains."),
    related_vulnerability_ids: z
      .array(z.string().min(1))
      .default([])
      .describe("IDs of relevant vulnerability catalog entries."),
  })
  .describe("Official institutional risk-calendar event (election, referendum, summit, etc.).");
export type RiskEvent = z.infer<typeof RiskEventSchema>;

export const RiskCalendarFilterSchema = z
  .strictObject({
    country: z.string().min(2).optional().describe("Filter by country/region code."),
    event_type: z.enum(RISK_EVENT_TYPES).optional().describe("Filter by event type."),
    domain: z.enum(VULNERABILITY_DOMAINS).optional().describe("Filter by vulnerability domain."),
    from_date: PartialDate.optional().describe("Inclusive start date filter."),
    to_date: PartialDate.optional().describe("Inclusive end date filter."),
  })
  .describe("Filter options for aggregating the official risk-event calendar.");
export type RiskCalendarFilter = z.infer<typeof RiskCalendarFilterSchema>;

export function aggregateRiskCalendar(
  events: readonly RiskEvent[],
  filter?: RiskCalendarFilter,
): {
  events: RiskEvent[];
  by_country: Record<string, number>;
  by_type: Record<string, number>;
  by_domain: Record<string, number>;
} {
  const parsedEvents = events.map((e) => RiskEventSchema.parse(e));
  const parsedFilter = filter ? RiskCalendarFilterSchema.parse(filter) : undefined;

  const filtered = parsedEvents
    .filter((ev) => {
      if (parsedFilter?.country && ev.country !== parsedFilter.country) return false;
      if (parsedFilter?.event_type && ev.event_type !== parsedFilter.event_type) return false;
      if (parsedFilter?.domain && !ev.risk_domains.includes(parsedFilter.domain)) return false;
      if (
        parsedFilter?.from_date &&
        comparePartialDates(ev.scheduled_date, parsedFilter.from_date) < 0
      ) {
        return false;
      }
      if (
        parsedFilter?.to_date &&
        comparePartialDates(ev.scheduled_date, parsedFilter.to_date) > 0
      ) {
        return false;
      }
      return true;
    })
    .sort((a, b) => comparePartialDates(a.scheduled_date, b.scheduled_date));

  const by_country: Record<string, number> = {};
  const by_type: Record<string, number> = {};
  const by_domain: Record<string, number> = {};

  for (const ev of filtered) {
    by_country[ev.country] = (by_country[ev.country] ?? 0) + 1;
    by_type[ev.event_type] = (by_type[ev.event_type] ?? 0) + 1;
    for (const d of ev.risk_domains) {
      by_domain[d] = (by_domain[d] ?? 0) + 1;
    }
  }

  return { events: filtered, by_country, by_type, by_domain };
}

export const RiskDossierSchema = z
  .strictObject({
    dossier_id: z.string().min(1).describe("Deterministic or assigned dossier identifier."),
    target_scope: z
      .strictObject({
        country: z.string().min(2).optional().describe("Target country if scoped."),
        domain: z.enum(VULNERABILITY_DOMAINS).optional().describe("Target domain if scoped."),
        label: z.string().min(1).describe("Human-readable dossier scope label."),
      })
      .describe("Scope of the generated risk dossier."),
    visibility: z
      .enum(["public", "private"])
      .describe("Visibility classification of the dossier output."),
    generated_at: z.string().min(1).describe("ISO-8601 UTC timestamp of dossier generation."),
    events: z.array(RiskEventSchema).describe("Matching official risk-calendar events."),
    vulnerabilities: z
      .array(z.unknown())
      .describe("Matching vulnerabilities (public projections when visibility is public)."),
    technique_ids: z
      .array(z.string().min(1))
      .describe("Unique technique IDs referenced across matching vulnerabilities."),
    caveats: z
      .array(z.string().min(1))
      .min(1)
      .describe("Epistemic caveats reminding that calendar risk != confirmed incident."),
  })
  .describe("Generalized risk dossier combining calendar events, vulnerabilities, and techniques.");
export type RiskDossier = z.infer<typeof RiskDossierSchema>;

/**
 * Generalized dossier builder combining official risk-calendar events with
 * JRC/Hybrid CoE vulnerability entries, enforcing public projection by default.
 */
export function buildRiskDossier(input: {
  dossier_id: string;
  label: string;
  country?: string;
  domain?: VulnerabilityDomain;
  visibility?: "public" | "private";
  generated_at: string;
  calendar_events: readonly RiskEvent[];
  vulnerabilities: readonly VulnerabilityEntry[];
}): RiskDossier {
  const visibility = input.visibility ?? "public";
  const calendarFilter: RiskCalendarFilter = {
    ...(input.country !== undefined ? { country: input.country } : {}),
    ...(input.domain !== undefined ? { domain: input.domain } : {}),
  };
  const { events } = aggregateRiskCalendar(input.calendar_events, calendarFilter);

  const eventVulnIds = new Set(events.flatMap((e) => e.related_vulnerability_ids));
  const eventDomains = new Set(events.flatMap((e) => e.risk_domains));

  const matchingVulns = input.vulnerabilities.filter((v) => {
    if (input.domain && v.domain !== input.domain) return false;
    if (eventVulnIds.size > 0 && eventVulnIds.has(v.id)) return true;
    if (eventDomains.size > 0 && eventDomains.has(v.domain)) return true;
    return input.domain !== undefined;
  });

  const projectedVulns =
    visibility === "public" ? matchingVulns.map(projectPublicVulnerability) : matchingVulns;

  const techniqueIds = [...new Set(matchingVulns.flatMap((v) => v.linked_technique_ids))].sort();

  return RiskDossierSchema.parse({
    dossier_id: input.dossier_id,
    target_scope: {
      ...(input.country !== undefined ? { country: input.country } : {}),
      ...(input.domain !== undefined ? { domain: input.domain } : {}),
      label: input.label,
    },
    visibility,
    generated_at: input.generated_at,
    events,
    vulnerabilities: projectedVulns,
    technique_ids: techniqueIds,
    caveats: [
      "Official calendar events indicate heightened exposure windows, not confirmed interference.",
      visibility === "public"
        ? "Public projection: private operational details and private weak signals are excluded."
        : "Private operational dossier: subject to confidentiality boundary controls.",
    ],
  });
}
