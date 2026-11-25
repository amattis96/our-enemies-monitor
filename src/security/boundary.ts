import { z } from "zod";

export const DATA_CLASSES = [
  "public_publishable",
  "editorial_draft",
  "private_investigative",
  "restricted_operational",
  "holdout_evaluation",
] as const;

export const DataClassSchema = z
  .enum(DATA_CLASSES)
  .describe("Confidentiality classification of repository content.");

export type DataClass = z.infer<typeof DataClassSchema>;

export const DESTINATIONS = [
  "public_repo",
  "public_site",
  "public_export",
  "private_repo",
  "ci_logs",
  "ci_artifacts",
  "chatgpt_subscription",
  "chatgpt_api_zdr",
  "chatgpt_api_standard",
  "claude_subscription",
  "claude_api_zdr",
  "claude_api_standard",
  "embedding_local",
  "embedding_external_zdr",
  "embedding_external_retaining",
  "external_notebook",
] as const;

export const DestinationSchema = z
  .enum(DESTINATIONS)
  .describe("Target storage, surface, or external AI/embedding service.");

export type Destination = z.infer<typeof DestinationSchema>;

export const EmbeddingDestinationSchema = z
  .enum(["embedding_local", "embedding_external_zdr", "embedding_external_retaining"])
  .describe("Target embedding service classification.");

export type EmbeddingDestination = z.infer<typeof EmbeddingDestinationSchema>;

export const BoundaryCheckResultSchema = z
  .strictObject({
    allowed: z.boolean().describe("Whether the transfer is permitted by the boundary policy."),
    dataClass: DataClassSchema.describe("Classification of the payload."),
    destination: DestinationSchema.describe("Target destination evaluated."),
    reason: z.string().describe("Human-readable explanation of the allow or deny decision."),
  })
  .describe("Outcome of a confidentiality boundary check.");

export type BoundaryCheckResult = z.infer<typeof BoundaryCheckResultSchema>;

export const ProviderPayloadSchema = z
  .strictObject({
    dataClass: DataClassSchema.describe("Confidentiality class of the payload being sent."),
    contextDomain: DataClassSchema.optional().describe(
      "Confidentiality domain of the active agent/cache context, to prevent cross-domain mixing.",
    ),
    label: z.string().optional().describe("Optional identifier for audit diagnostics."),
  })
  .describe("Metadata describing a payload destined for an external AI or embedding service.");

export type ProviderPayload = z.infer<typeof ProviderPayloadSchema>;

/** Allowed destinations per data class. Anything not listed is denied by default. */
export const ALLOWED_DESTINATIONS: Record<DataClass, readonly Destination[]> = {
  public_publishable: [...DESTINATIONS],
  editorial_draft: [
    "private_repo",
    "chatgpt_subscription",
    "chatgpt_api_zdr",
    "claude_subscription",
    "claude_api_zdr",
    "embedding_local",
    "embedding_external_zdr",
  ],
  private_investigative: ["private_repo", "chatgpt_api_zdr", "claude_api_zdr", "embedding_local"],
  restricted_operational: ["private_repo", "embedding_local"],
  holdout_evaluation: ["private_repo"],
};

const PRIVATE_DOMAINS: ReadonlySet<DataClass> = new Set([
  "private_investigative",
  "restricted_operational",
  "holdout_evaluation",
]);

/** Classify a repository-relative path into its default confidentiality class. */
export function classifyPath(filePath: string): DataClass {
  const normalized = filePath.replaceAll("\\", "/").replace(/^\.\//, "");
  if (
    normalized.startsWith("docs/quality/sets/") ||
    normalized.includes("holdout") ||
    normalized.startsWith("test/fixtures/holdout")
  ) {
    return "holdout_evaluation";
  }
  if (
    normalized.startsWith("docs/runs/") ||
    normalized.startsWith("logs/") ||
    normalized.startsWith("docs/quality/reports/")
  ) {
    return "restricted_operational";
  }
  if (
    normalized.startsWith("sources/incremental/") ||
    normalized.startsWith("sources/thematic/") ||
    normalized.startsWith("sources/quarantine/")
  ) {
    return "private_investigative";
  }
  if (normalized.startsWith("content/articles/")) {
    return "editorial_draft";
  }
  return "public_publishable";
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
    PRIVATE_DOMAINS.has(contextDomain) !== PRIVATE_DOMAINS.has(dataClass)
  ) {
    return {
      allowed: false,
      dataClass,
      destination,
      reason: `Cross-domain context mixing denied: ${dataClass} payload cannot share context/cache with ${contextDomain}`,
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
 * Create a guard for an external AI provider client (ChatGPT/Claude subscription or API).
 * Rejects disallowed data classes and cross-domain cache/context mixing.
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
 * Create a guard for an embedding client.
 * Never permits private_investigative, restricted_operational, or holdout_evaluation
 * to be sent to external embedding services.
 */
export function createEmbeddingGuard(
  destination: EmbeddingDestination,
  domainContext: DataClass = "public_publishable",
): GuardedClient {
  return createProviderGuard(destination, domainContext);
}
