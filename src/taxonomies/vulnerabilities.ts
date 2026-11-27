import { z } from "zod";
import { PartialDate } from "../model/schemas.ts";

export const VULNERABILITY_DOMAINS = [
  "energy",
  "telecommunications",
  "transport_logistics",
  "financial_system",
  "electoral_process",
  "information_ecosystem",
  "public_administration",
  "cyber_infrastructure",
  "supply_chain",
] as const;
export type VulnerabilityDomain = (typeof VULNERABILITY_DOMAINS)[number];

export const VULNERABILITY_SEVERITIES = ["low", "medium", "high", "critical"] as const;
export type VulnerabilitySeverity = (typeof VULNERABILITY_SEVERITIES)[number];

export const SIGNAL_VISIBILITIES = ["public", "private"] as const;
export type SignalVisibility = (typeof SIGNAL_VISIBILITIES)[number];

export const WeakSignalSchema = z
  .strictObject({
    signal_id: z.string().min(1).describe("Unique identifier of the weak signal."),
    title: z.string().min(1).describe("Short factual title of the weak signal."),
    domain: z.enum(VULNERABILITY_DOMAINS).describe("JRC/Hybrid CoE vulnerability domain."),
    indicator_description: z
      .string()
      .min(1)
      .describe("Observable pattern or anomaly constituting the weak signal."),
    observed_at: PartialDate.describe("Date when the weak signal was observed."),
    confidence: z
      .enum(["low", "medium", "high"])
      .describe("Analyst confidence in the signal observation."),
    source_refs: z
      .array(z.string().min(1))
      .min(1)
      .describe("Source references backing the signal."),
    visibility: z
      .enum(SIGNAL_VISIBILITIES)
      .describe("Whether the signal is safe for public projection or private only."),
    public_summary: z
      .string()
      .min(1)
      .describe("Sanitized public summary free of operational details."),
    private_operational_details: z
      .string()
      .min(1)
      .optional()
      .describe("Sensitive investigative or operational details; never exposed publicly."),
  })
  .describe("Weak signal linked to a JRC/Hybrid CoE vulnerability.");
export type WeakSignal = z.infer<typeof WeakSignalSchema>;

export const VulnerabilityEntrySchema = z
  .strictObject({
    id: z.string().min(1).describe("Stable vulnerability catalog ID."),
    title: z.string().min(1).describe("Vulnerability title."),
    domain: z.enum(VULNERABILITY_DOMAINS).describe("JRC/Hybrid CoE domain."),
    framework_ref: z
      .string()
      .min(1)
      .describe("JRC or Hybrid CoE reference code (e.g., JRC-HT-2023-EN-01)."),
    description: z.string().min(1).describe("Structural vulnerability description."),
    severity_band: z.enum(VULNERABILITY_SEVERITIES).describe("Qualitative severity band."),
    weak_signals: z
      .array(WeakSignalSchema)
      .describe("Weak signals associated with this vulnerability."),
    linked_technique_ids: z
      .array(z.string().min(1))
      .describe("Technique IDs from the taxonomy manifest."),
    public_summary: z.string().min(1).describe("Public-safe summary of the vulnerability."),
    private_operational_details: z
      .string()
      .min(1)
      .optional()
      .describe("Private operational assessment; stripped in public projections."),
  })
  .describe("JRC/Hybrid CoE vulnerability catalog entry with weak signals.");
export type VulnerabilityEntry = z.infer<typeof VulnerabilityEntrySchema>;

export const PublicWeakSignalSchema = WeakSignalSchema.omit({
  private_operational_details: true,
}).describe("Public projection of a weak signal with operational details removed.");
export type PublicWeakSignal = z.infer<typeof PublicWeakSignalSchema>;

export const PublicVulnerabilityEntrySchema = z
  .strictObject({
    id: z.string().min(1).describe("Stable vulnerability catalog ID."),
    title: z.string().min(1).describe("Vulnerability title."),
    domain: z.enum(VULNERABILITY_DOMAINS).describe("JRC/Hybrid CoE domain."),
    framework_ref: z.string().min(1).describe("JRC or Hybrid CoE reference code."),
    description: z.string().min(1).describe("Structural vulnerability description."),
    severity_band: z.enum(VULNERABILITY_SEVERITIES).describe("Qualitative severity band."),
    weak_signals: z
      .array(PublicWeakSignalSchema)
      .describe("Publicly projectable weak signals only."),
    linked_technique_ids: z.array(z.string().min(1)).describe("Linked technique IDs."),
    public_summary: z.string().min(1).describe("Public-safe summary of the vulnerability."),
  })
  .describe("Public-safe projection of a JRC/Hybrid CoE vulnerability entry.");
export type PublicVulnerabilityEntry = z.infer<typeof PublicVulnerabilityEntrySchema>;

export const VulnerabilityCatalogSchema = z
  .strictObject({
    schema_version: z.string().min(1).describe("Schema version of the vulnerability catalog."),
    catalog_version: z.string().min(1).describe("Content version of the catalog."),
    entries: z
      .array(VulnerabilityEntrySchema)
      .describe("Registered JRC/Hybrid CoE vulnerability entries."),
  })
  .describe("JRC/Hybrid CoE vulnerability catalog.");
export type VulnerabilityCatalog = z.infer<typeof VulnerabilityCatalogSchema>;

/** Project a single vulnerability entry for public consumption, stripping private fields and signals. */
export function projectPublicVulnerability(entry: VulnerabilityEntry): PublicVulnerabilityEntry {
  const parsed = VulnerabilityEntrySchema.parse(entry);
  const publicSignals: PublicWeakSignal[] = parsed.weak_signals
    .filter((s) => s.visibility === "public")
    .map(({ private_operational_details: _stripped, ...rest }) => rest);

  return PublicVulnerabilityEntrySchema.parse({
    id: parsed.id,
    title: parsed.title,
    domain: parsed.domain,
    framework_ref: parsed.framework_ref,
    description: parsed.description,
    severity_band: parsed.severity_band,
    weak_signals: publicSignals,
    linked_technique_ids: parsed.linked_technique_ids,
    public_summary: parsed.public_summary,
  });
}

/** Project an entire vulnerability catalog for public consumption. */
export function projectPublicVulnerabilityCatalog(
  catalog: VulnerabilityCatalog,
): PublicVulnerabilityEntry[] {
  const parsed = VulnerabilityCatalogSchema.parse(catalog);
  return parsed.entries.map(projectPublicVulnerability);
}

/** Evaluate weak-signal concentration for a vulnerability entry without making causal claims. */
export function evaluateVulnerabilitySignals(entry: VulnerabilityEntry): {
  vulnerability_id: string;
  total_signals: number;
  public_signals: number;
  private_signals: number;
  high_confidence_signals: number;
  requires_review: boolean;
} {
  const parsed = VulnerabilityEntrySchema.parse(entry);
  const publicCount = parsed.weak_signals.filter((s) => s.visibility === "public").length;
  const privateCount = parsed.weak_signals.length - publicCount;
  const highConf = parsed.weak_signals.filter((s) => s.confidence === "high").length;

  return {
    vulnerability_id: parsed.id,
    total_signals: parsed.weak_signals.length,
    public_signals: publicCount,
    private_signals: privateCount,
    high_confidence_signals: highConf,
    requires_review: highConf > 0 || parsed.weak_signals.length >= 2,
  };
}
