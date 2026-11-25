import { z } from "zod";
import {
  buildUnsuitabilityReport,
  type ReadinessGateDecision,
  type UnsuitabilityReport,
} from "./readiness-gate.ts";

export const NEGATIVE_CONTROL_CATEGORIES = [
  "news_republication",
  "wire_service",
  "automated_alert",
  "spontaneous_peak",
] as const;

export type NegativeControlCategory = (typeof NEGATIVE_CONTROL_CATEGORIES)[number];

export const LIFECYCLE_MODES = ["shadow", "evaluated", "unsuitable"] as const;
export type LifecycleMode = (typeof LIFECYCLE_MODES)[number];

export const PlatformPostSchema = z
  .strictObject({
    post_id: z.string().min(1).describe("Unique post identifier on the source platform."),
    platform: z.string().min(1).describe("Source platform identifier."),
    account_id: z.string().min(1).describe("Originating account or channel identifier."),
    published_at: z.string().min(1).describe("ISO-8601 UTC timestamp of publication."),
    content_hash: z
      .string()
      .min(1)
      .describe("Normalized content/URL hash used for deduplication and coordination."),
    url_shared: z.string().min(1).optional().describe("Optional shared URL."),
    negative_control: z
      .enum(NEGATIVE_CONTROL_CATEGORIES)
      .optional()
      .describe("Optional negative-control classification explaining ordinary amplification."),
  })
  .describe("Normalized platform post emitted by a modular platform adapter.");

export type PlatformPost = z.infer<typeof PlatformPostSchema>;

export type PlatformSignalAdapter = {
  platform: string;
  provenance_terms: string;
  extractPosts: (rawRecords: unknown[]) => PlatformPost[];
};

export const IncidentCampaignInputSchema = z
  .strictObject({
    incident_id: z.string().min(1).describe("Incident identifier."),
    incident_at: z.string().min(1).describe("ISO-8601 UTC timestamp of the incident."),
    window_hours: z
      .number()
      .positive()
      .describe("Motivated post-incident analysis window in hours."),
    coordination_gap_minutes: z
      .number()
      .positive()
      .describe("Maximum time gap in minutes between coordinated co-posts of the same hash."),
    ordinary_baseline_rate_per_hour: z
      .number()
      .nonnegative()
      .describe("Expected ordinary posting rate per hour outside incidents."),
    simple_reference_threshold: z
      .number()
      .positive()
      .describe("Simple reference baseline multiplier over ordinary rate for benchmarking."),
    posts: z.array(PlatformPostSchema).describe("Normalized posts collected across adapters."),
    gate_decision: z
      .custom<ReadinessGateDecision>()
      .optional()
      .describe("Optional Data Readiness Gate decision for promoting beyond shadow."),
  })
  .describe("Input for PK-32 incident-campaign coupling signal analysis.");

export type IncidentCampaignInput = z.infer<typeof IncidentCampaignInputSchema>;

export const CoordinationClusterSchema = z
  .strictObject({
    content_hash: z.string().min(1).describe("Shared content hash."),
    accounts: z.array(z.string().min(1)).describe("Distinct accounts in the cluster."),
    post_count: z.number().int().positive().describe("Deduplicated posts in the cluster."),
    first_seen_at: z.string().min(1).describe("Earliest post timestamp in cluster."),
    lag_minutes_from_incident: z
      .number()
      .describe("Lag in minutes from incident_at to first_seen_at."),
    explained_by_negative_control: z
      .enum(NEGATIVE_CONTROL_CATEGORIES)
      .nullable()
      .describe("Negative control category if cluster is explained by ordinary behavior."),
  })
  .describe("Detected coordination signal cluster (strictly a signal, never proof).");

export type CoordinationCluster = z.infer<typeof CoordinationClusterSchema>;

export const IncidentCampaignResultSchema = z
  .strictObject({
    incident_id: z.string().min(1).describe("Analyzed incident ID."),
    lifecycle_mode: z
      .enum(LIFECYCLE_MODES)
      .describe("Execution lifecycle mode: shadow, evaluated, or unsuitable."),
    signal_only: z
      .literal(true)
      .describe("Findings are strictly signals and never evidentiary proof."),
    proof_status: z
      .literal("signal_not_proof")
      .describe("Explicit marker that temporal coupling is not proof."),
    automatic_attribution: z
      .literal(false)
      .describe("Invariant: zero automatic attributions from temporal correlation alone."),
    deduplicated_post_count: z
      .number()
      .int()
      .nonnegative()
      .describe("Total unique posts after deduplicating (platform, account_id, content_hash)."),
    negative_control_counts: z
      .record(z.enum(NEGATIVE_CONTROL_CATEGORIES), z.number().int().nonnegative())
      .describe("Counts of posts matched to each negative-control category."),
    unexplained_signal_rate_per_hour: z
      .number()
      .nonnegative()
      .describe("Post rate per hour excluding negative-control posts."),
    simple_reference_exceeded: z
      .boolean()
      .describe("Whether unexplained signal rate exceeds the simple reference baseline."),
    incident_to_amplification_lag_minutes: z
      .number()
      .nullable()
      .describe("Minimum positive lag in minutes from incident to unexplained amplification."),
    coordination_clusters: z
      .array(CoordinationClusterSchema)
      .describe("Detected coordination clusters within the motivated window."),
    benchmark_passed: z
      .boolean()
      .describe("True when unexplained signal outperforms negative controls and simple reference."),
    unsuitability_report: z
      .custom<UnsuitabilityReport>()
      .nullable()
      .describe("Formal unsuitability report if lifecycle closes as unsuitable."),
  })
  .describe("PK-32 incident-campaign coupling output.");

export type IncidentCampaignResult = z.infer<typeof IncidentCampaignResultSchema>;

const adapterRegistry = new Map<string, PlatformSignalAdapter>();

/**
 * Register a modular platform adapter with documented provenance terms.
 */
export function registerPlatformAdapter(adapter: PlatformSignalAdapter): void {
  if (!adapter.platform.trim() || !adapter.provenance_terms.trim()) {
    throw new Error("Platform adapter requires non-empty platform and provenance_terms.");
  }
  adapterRegistry.set(adapter.platform, adapter);
}

/**
 * Retrieve a registered platform adapter by platform name.
 */
export function getPlatformAdapter(platform: string): PlatformSignalAdapter | undefined {
  return adapterRegistry.get(platform);
}

/**
 * List all registered platform adapters.
 */
export function listPlatformAdapters(): PlatformSignalAdapter[] {
  return [...adapterRegistry.values()];
}

// Register default modular adapters with explicit provenance conditions.
registerPlatformAdapter({
  platform: "telegram",
  provenance_terms: "Public channel archive via sanctioned export; no private group scraping.",
  extractPosts: (rawRecords) => rawRecords.map((r) => PlatformPostSchema.parse(r)),
});

registerPlatformAdapter({
  platform: "rss_news",
  provenance_terms: "Public RSS/Atom syndication feeds under standard attribution terms.",
  extractPosts: (rawRecords) => rawRecords.map((r) => PlatformPostSchema.parse(r)),
});

/**
 * Analyze incident-to-campaign temporal coupling and coordination networks.
 * Enforces negative controls, deduplication, simple reference baseline comparison,
 * and ZERO automatic attribution from temporal correlation alone.
 */
export function analyzeIncidentCampaignSignals(
  rawInput: IncidentCampaignInput,
): IncidentCampaignResult {
  const input = IncidentCampaignInputSchema.parse(rawInput);
  const incidentMs = Date.parse(input.incident_at);
  if (Number.isNaN(incidentMs)) {
    throw new Error(`Invalid incident_at timestamp: ${input.incident_at}`);
  }
  const windowEndMs = incidentMs + input.window_hours * 3_600_000;

  // Deduplicate by (platform, account_id, content_hash) within the motivated window.
  const deduped = new Map<string, PlatformPost>();
  for (const post of input.posts) {
    const postMs = Date.parse(post.published_at);
    if (Number.isNaN(postMs) || postMs < incidentMs || postMs > windowEndMs) {
      continue;
    }
    const key = `${post.platform}::${post.account_id}::${post.content_hash}`;
    const existing = deduped.get(key);
    if (!existing || Date.parse(existing.published_at) > postMs) {
      deduped.set(key, post);
    }
  }

  const uniquePosts = [...deduped.values()].sort(
    (a, b) => Date.parse(a.published_at) - Date.parse(b.published_at),
  );

  const negCounts: Record<NegativeControlCategory, number> = {
    news_republication: 0,
    wire_service: 0,
    automated_alert: 0,
    spontaneous_peak: 0,
  };

  const unexplainedPosts: PlatformPost[] = [];
  for (const post of uniquePosts) {
    if (post.negative_control) {
      negCounts[post.negative_control] += 1;
    } else {
      unexplainedPosts.push(post);
    }
  }

  // Group by content_hash to find coordination clusters within coordination_gap_minutes.
  const byHash = new Map<string, PlatformPost[]>();
  for (const post of uniquePosts) {
    const group = byHash.get(post.content_hash) ?? [];
    group.push(post);
    byHash.set(post.content_hash, group);
  }

  const clusters: CoordinationCluster[] = [];
  const gapMs = input.coordination_gap_minutes * 60_000;

  for (const [contentHash, group] of byHash.entries()) {
    const accounts = [...new Set(group.map((p) => p.account_id))];
    if (accounts.length < 2) {
      continue;
    }
    let synchronized = false;
    for (let i = 1; i < group.length; i += 1) {
      const prev = group[i - 1];
      const curr = group[i];
      if (prev && curr && Date.parse(curr.published_at) - Date.parse(prev.published_at) <= gapMs) {
        synchronized = true;
        break;
      }
    }
    if (!synchronized) {
      continue;
    }

    const first = group[0];
    if (!first) continue;
    const firstMs = Date.parse(first.published_at);
    const negControl =
      group.find((p) => p.negative_control !== undefined)?.negative_control ?? null;

    clusters.push({
      content_hash: contentHash,
      accounts,
      post_count: group.length,
      first_seen_at: first.published_at,
      lag_minutes_from_incident: Number(((firstMs - incidentMs) / 60_000).toFixed(2)),
      explained_by_negative_control: negControl,
    });
  }

  const unexplainedRate = unexplainedPosts.length / input.window_hours;
  const referenceLimit = input.ordinary_baseline_rate_per_hour * input.simple_reference_threshold;
  const simpleRefExceeded = unexplainedRate > referenceLimit;

  const unexplainedClusters = clusters.filter((c) => c.explained_by_negative_control === null);
  const firstUnexplained = unexplainedPosts[0];
  const lagMinutes = firstUnexplained
    ? Number(((Date.parse(firstUnexplained.published_at) - incidentMs) / 60_000).toFixed(2))
    : null;

  const benchmarkPassed = simpleRefExceeded && unexplainedClusters.length > 0;

  let lifecycleMode: LifecycleMode = "shadow";
  let unsuitabilityReport: UnsuitabilityReport | null = null;

  if (input.gate_decision) {
    if (!input.gate_decision.activated) {
      lifecycleMode = input.gate_decision.outcome === "unsuitable" ? "unsuitable" : "shadow";
      unsuitabilityReport =
        input.gate_decision.unsuitability_report ??
        buildUnsuitabilityReport({
          method: "pk32_incident_campaign",
          elapsed_months: 0,
          failed_criteria: input.gate_decision.failed_criteria,
          rationale: "Data Readiness Gate blocked promotion beyond shadow mode.",
        });
    } else if (benchmarkPassed) {
      lifecycleMode = "evaluated";
    } else {
      lifecycleMode = "unsuitable";
      unsuitabilityReport = buildUnsuitabilityReport({
        method: "pk32_incident_campaign",
        elapsed_months: 0,
        failed_criteria: ["validability"],
        rationale:
          "Signal did not outperform negative controls and simple reference baseline; remains unsuitable for promotion.",
      });
    }
  }

  return IncidentCampaignResultSchema.parse({
    incident_id: input.incident_id,
    lifecycle_mode: lifecycleMode,
    signal_only: true,
    proof_status: "signal_not_proof",
    automatic_attribution: false,
    deduplicated_post_count: uniquePosts.length,
    negative_control_counts: negCounts,
    unexplained_signal_rate_per_hour: Number(unexplainedRate.toFixed(4)),
    simple_reference_exceeded: simpleRefExceeded,
    incident_to_amplification_lag_minutes: lagMinutes,
    coordination_clusters: clusters,
    benchmark_passed: benchmarkPassed,
    unsuitability_report: unsuitabilityReport,
  });
}
