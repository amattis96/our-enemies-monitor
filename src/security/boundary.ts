import { z } from "zod";

/**
 * Material classes (D1/D12, owner decision 26 November 2026).
 *
 * OEM is a public OSINT project kept in ONE public repository. Material that
 * is not yet publishable is ordinary investigative work, not confidential:
 * it lives in the repository and may be processed by ordinary AI services.
 * Whether something reaches the portal, exports, MCP or search indexes is
 * decided by the publication gateway and the M5 gate on the record itself
 * (review status, evidence, person rules), never by this classification.
 *
 * - `public_publishable`: canonical material eligible for the public
 *   projections (still subject to the gateway, record by record).
 * - `investigative_pending`: OSINT not yet qualified: archived sources,
 *   `needs_review` candidates, hypotheses, leads, discovery queue,
 *   negative verifications.
 * - `editorial_draft`: article drafts and translations.
 * - `operational`: run manifests, metrics, quality reports, logs (minimized).
 * - `private_investigative`: FUTURE, optional. Truly confidential human
 *   investigations. No destination exists for it in the current architecture:
 *   directories, labels or branches of a public repository are logical
 *   separation, not access control, so the class is denied everywhere until
 *   a new explicit owner decision provides a real confidential store.
 * - `holdout_evaluation`: answers of an evaluation set that must stay unseen
 *   by the agent under evaluation. A public file cannot be a holdout, so it is
 *   never stored in the repository; it only reaches the external evaluator.
 */
export const DATA_CLASSES = [
  "public_publishable",
  "investigative_pending",
  "editorial_draft",
  "operational",
  "private_investigative",
  "holdout_evaluation",
] as const;

export const DataClassSchema = z
  .enum(DATA_CLASSES)
  .describe(
    "Nature of the material (D1/D12): publishable, pending OSINT, draft, operational, future confidential, or evaluation holdout. Not an evidentiary or editorial status.",
  );

export type DataClass = z.infer<typeof DataClassSchema>;

/** Classes that are genuinely isolated: never mixed with other contexts. */
export const ISOLATED_CLASSES: ReadonlySet<DataClass> = new Set([
  "private_investigative",
  "holdout_evaluation",
]);

export const DESTINATIONS = [
  "repository",
  "public_site",
  "public_export",
  "ci_logs",
  "ci_artifacts",
  "ai_subscription",
  "ai_api",
  "embedding_local",
  "embedding_external",
  "external_tool",
  "external_evaluator",
] as const;

export const DestinationSchema = z
  .enum(DESTINATIONS)
  .describe(
    "Where material goes: the public repository, a public projection (site, export/API/MCP/feeds/indexes), CI, an AI service (subscription or API), an embedding service, an external tool, or an independent evaluator.",
  );

export type Destination = z.infer<typeof DestinationSchema>;

export const EmbeddingDestinationSchema = z
  .enum(["embedding_local", "embedding_external"])
  .describe("Target embedding service.");

export type EmbeddingDestination = z.infer<typeof EmbeddingDestinationSchema>;

export const BoundaryCheckResultSchema = z
  .strictObject({
    allowed: z.boolean().describe("Whether the transfer is permitted by the boundary policy."),
    dataClass: DataClassSchema.describe("Classification of the payload."),
    destination: DestinationSchema.describe("Target destination evaluated."),
    reason: z.string().describe("Human-readable explanation of the allow or deny decision."),
  })
  .describe("Outcome of a material-class boundary check.");

export type BoundaryCheckResult = z.infer<typeof BoundaryCheckResultSchema>;

export const ProviderPayloadSchema = z
  .strictObject({
    dataClass: DataClassSchema.describe("Material class of the payload being sent."),
    contextDomain: DataClassSchema.optional().describe(
      "Material class of the active agent/cache context; only isolated classes must not mix.",
    ),
    label: z.string().optional().describe("Optional identifier for audit diagnostics."),
  })
  .describe("Metadata describing a payload destined for an external AI or embedding service.");

export type ProviderPayload = z.infer<typeof ProviderPayloadSchema>;

/** Ordinary working destinations for OSINT material that is not (yet) public. */
const WORKING: readonly Destination[] = [
  "repository",
  "ci_logs",
  "ci_artifacts",
  "ai_subscription",
  "ai_api",
  "embedding_local",
  "embedding_external",
  "external_tool",
];

/**
 * Allowed destinations per class. Anything not listed is denied by default.
 * Public projections (`public_site`, `public_export`) are reachable only by
 * `public_publishable` material, and only through the publication gateway.
 * Using an AI provider never changes the evidentiary or editorial status of
 * the material it processes.
 */
export const ALLOWED_DESTINATIONS: Record<DataClass, readonly Destination[]> = {
  public_publishable: [...DESTINATIONS],
  investigative_pending: WORKING,
  editorial_draft: WORKING,
  operational: WORKING,
  private_investigative: [],
  holdout_evaluation: ["external_evaluator"],
};

/** Classify a repository-relative path into its default material class. */
export function classifyPath(filePath: string): DataClass {
  const normalized = filePath.replaceAll("\\", "/").replace(/^\.\//, "");
  if (normalized.split("/").some((part) => part.toLowerCase().includes("holdout"))) {
    return "holdout_evaluation";
  }
  if (
    normalized.startsWith("docs/runs/") ||
    normalized.startsWith("logs/") ||
    normalized.startsWith("docs/quality/")
  ) {
    return "operational";
  }
  if (
    normalized.startsWith("sources/incremental/") ||
    normalized.startsWith("sources/thematic/") ||
    normalized.startsWith("sources/quarantine/") ||
    normalized.startsWith("docs/discovery/")
  ) {
    return "investigative_pending";
  }
  if (normalized.startsWith("content/articles/")) {
    return "editorial_draft";
  }
  return "public_publishable";
}

/**
 * Classify a canonical record by its review status. `needs_review` is pending
 * OSINT, not confidential; publication is still decided by the gateway.
 */
export function classifyRecord(review: { status: string }): DataClass {
  return review.status === "needs_review" ? "investigative_pending" : "public_publishable";
}

/** Check whether a data class is permitted to reach a given destination. */
export function isDestinationAllowed(dataClass: DataClass, destination: Destination): boolean {
  return ALLOWED_DESTINATIONS[dataClass].includes(destination);
}

/** Evaluate a boundary check and return a structured result without throwing. */
export function checkBoundary(
  dataClass: DataClass,
  destination: Destination,
  contextDomain?: DataClass,
): BoundaryCheckResult {
  if (
    contextDomain !== undefined &&
    contextDomain !== dataClass &&
    (ISOLATED_CLASSES.has(contextDomain) || ISOLATED_CLASSES.has(dataClass))
  ) {
    return {
      allowed: false,
      dataClass,
      destination,
      reason: `Isolated context mixing denied: ${dataClass} payload cannot share context/cache with ${contextDomain}`,
    };
  }
  if (dataClass === "private_investigative") {
    return {
      allowed: false,
      dataClass,
      destination,
      reason:
        "private_investigative is a future, optional feature with no confidential store; it needs an explicit owner decision before use",
    };
  }
  if (!isDestinationAllowed(dataClass, destination)) {
    return {
      allowed: false,
      dataClass,
      destination,
      reason: `Destination "${destination}" is not authorized for data class "${dataClass}"`,
    };
  }
  return {
    allowed: true,
    dataClass,
    destination,
    reason: `Destination "${destination}" is authorized for data class "${dataClass}"`,
  };
}

/** Assert that a data class is permitted at a destination, throwing on violation. */
export function assertDestinationAllowed(
  dataClass: DataClass,
  destination: Destination,
  contextDomain?: DataClass,
): BoundaryCheckResult {
  const result = checkBoundary(dataClass, destination, contextDomain);
  if (!result.allowed) {
    throw new Error(`BoundaryViolation: ${result.reason}`);
  }
  return result;
}

export type GuardedClient = {
  destination: Destination;
  domainContext: DataClass;
  assertPayload: (payload: ProviderPayload) => BoundaryCheckResult;
};

/**
 * Create a guard for an AI provider client (subscription such as ChatGPT,
 * Claude, Codex, Claude Code or Gemini, or a commercial API). Ordinary OSINT
 * classes are allowed; only isolated classes are rejected, and isolated
 * contexts are not mixed with others.
 */
export function createProviderGuard(
  destination: Destination,
  domainContext: DataClass = "public_publishable",
): GuardedClient {
  return {
    destination,
    domainContext,
    assertPayload(payload: ProviderPayload): BoundaryCheckResult {
      const parsed = ProviderPayloadSchema.parse(payload);
      const effectiveContext = parsed.contextDomain ?? domainContext;
      return assertDestinationAllowed(parsed.dataClass, destination, effectiveContext);
    },
  };
}

/**
 * Create a guard for an embedding client. Ordinary OSINT material may be
 * embedded locally or externally; holdout answers and future confidential
 * material may not.
 */
export function createEmbeddingGuard(
  destination: EmbeddingDestination,
  domainContext: DataClass = "public_publishable",
): GuardedClient {
  return createProviderGuard(destination, domainContext);
}
