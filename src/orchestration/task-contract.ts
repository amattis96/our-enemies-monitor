import { z } from "zod";
import { RUN_STATUSES, type RunManifest, RunManifestSchema } from "../runs/schema.ts";
import { OPERATIONAL_PRIORITIES, type OperationalPriority } from "./backpressure.ts";

export const PROVIDER_IDS = ["chatgpt", "claude", "generic"] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

export const TOOL_CAPABILITIES = [
  "git_read",
  "repo_pr",
  "web_search",
  "structured_json",
  "manifest_emit",
  "blind_review",
  "shell_exec",
] as const;
export type ToolCapability = (typeof TOOL_CAPABILITIES)[number];

export const OemTaskInputSchema = z
  .strictObject({
    snapshot_id: z.string().min(1).describe("Snapshot identifier targeted by the task."),
    window_from: z.string().min(1).describe("UTC start of the task's observation window."),
    window_to: z.string().min(1).describe("UTC end of the task's observation window."),
    refs: z.array(z.string().min(1)).describe("Entity, case, or source references in scope."),
    instructions: z.string().min(1).describe("Task-specific objective instructions."),
  })
  .describe("Normalized input payload for an OEM Task Contract.");
export type OemTaskInput = z.infer<typeof OemTaskInputSchema>;

export const OemTaskPolicySchema = z
  .strictObject({
    allow_direct_push: z
      .literal(false)
      .describe("Direct pushes to main are permanently forbidden."),
    allow_source_mutation: z
      .literal(false)
      .describe("Immutable sources/original and sources/incremental must never be mutated."),
    require_run_manifest: z
      .boolean()
      .describe("True when the task must emit a PK-08 run manifest even on zero results."),
    require_evidence_refs: z
      .boolean()
      .describe("True when findings must cite verifiable source references."),
    max_cost_usd: z.number().nonnegative().describe("Maximum estimated monetary cost in USD."),
    max_runtime_minutes: z.number().positive().describe("Maximum allowed runtime in minutes."),
  })
  .describe("Execution policy constraints enforced on an OEM task.");
export type OemTaskPolicy = z.infer<typeof OemTaskPolicySchema>;

export const OemTaskContractSchema = z
  .strictObject({
    contract_version: z.literal("1.0").describe("OEM Task Contract schema version."),
    task_id: z.string().min(1).describe("Unique task identifier (e.g., task-a, discovery-shadow)."),
    role: z
      .string()
      .min(1)
      .describe("Operational role (e.g., osint_ingest, editorial, critic, discovery)."),
    priority: z.enum(OPERATIONAL_PRIORITIES).describe("Operational priority P0-P4."),
    input: OemTaskInputSchema.describe("Validated task input specification."),
    expected_output: z
      .strictObject({
        format: z.literal("oem_task_output_v1").describe("Expected normalized output format."),
        require_findings: z.boolean().describe("Whether findings array is required."),
        require_manifest: z.boolean().describe("Whether a PK-08 run manifest is required."),
      })
      .describe("Expected output contract."),
    policy: OemTaskPolicySchema.describe("Hard safety and budget policy."),
    required_tools: z
      .array(z.enum(TOOL_CAPABILITIES))
      .min(1)
      .describe("Tool capabilities required to execute this contract."),
  })
  .describe("Provider-agnostic OEM Task Contract.");
export type OemTaskContract = z.infer<typeof OemTaskContractSchema>;

export const OemTaskOutputSchema = z
  .strictObject({
    contract_version: z.literal("1.0").describe("OEM Task Contract schema version."),
    task_id: z.string().min(1).describe("Task identifier matching the contract."),
    provider: z.enum(PROVIDER_IDS).describe("Provider adapter that produced this output."),
    status: z.enum(RUN_STATUSES).describe("Terminal status aligned with PK-08 run statuses."),
    summary: z.string().min(1).describe("Concise conclusion-first summary of the run."),
    findings: z
      .array(
        z.strictObject({
          id: z.string().min(1).describe("Finding or proposal identifier."),
          title: z.string().min(1).describe("Short finding title."),
          refs: z.array(z.string().min(1)).describe("Supporting evidence or entity references."),
        }),
      )
      .describe("Structured findings produced by the task (may be empty on zero results)."),
    manifest: RunManifestSchema.optional().describe("Optional PK-08 run manifest."),
  })
  .describe("Normalized output produced by any provider adapter.");
export type OemTaskOutput = z.infer<typeof OemTaskOutputSchema>;

export const ProviderCapabilityEntrySchema = z
  .strictObject({
    provider: z.enum(PROVIDER_IDS).describe("Provider identifier."),
    capabilities: z.array(z.enum(TOOL_CAPABILITIES)).describe("Supported tool capabilities."),
    max_context_tokens: z
      .number()
      .int()
      .positive()
      .describe("Maximum supported context window in tokens."),
    supports_native_scheduling: z
      .boolean()
      .describe("Whether the provider supports native external scheduled tasks."),
  })
  .describe("Registered capability profile for a task provider.");
export type ProviderCapabilityEntry = z.infer<typeof ProviderCapabilityEntrySchema>;

/**
 * Registry mapping providers (ChatGPT, Claude, generic) to their supported
 * tool capabilities for pre-dispatch compatibility checks.
 */
export class CapabilityRegistry {
  readonly #providers = new Map<ProviderId, ProviderCapabilityEntry>();

  register(entry: ProviderCapabilityEntry): void {
    const parsed = ProviderCapabilityEntrySchema.parse(entry);
    this.#providers.set(parsed.provider, parsed);
  }

  get(provider: ProviderId): ProviderCapabilityEntry {
    const entry = this.#providers.get(provider);
    if (!entry) {
      throw new Error(`Provider "${provider}" is not registered in CapabilityRegistry.`);
    }
    return structuredClone(entry);
  }

  checkCompatibility(
    contract: OemTaskContract,
    provider: ProviderId,
  ): { compatible: boolean; missing_capabilities: ToolCapability[] } {
    const entry = this.get(provider);
    const missing = contract.required_tools.filter((tool) => !entry.capabilities.includes(tool));
    return {
      compatible: missing.length === 0,
      missing_capabilities: missing,
    };
  }
}

export function createDefaultCapabilityRegistry(): CapabilityRegistry {
  const registry = new CapabilityRegistry();
  registry.register({
    provider: "chatgpt",
    capabilities: [
      "git_read",
      "repo_pr",
      "web_search",
      "structured_json",
      "manifest_emit",
      "blind_review",
    ],
    max_context_tokens: 200_000,
    supports_native_scheduling: true,
  });
  registry.register({
    provider: "claude",
    capabilities: [
      "git_read",
      "repo_pr",
      "web_search",
      "structured_json",
      "manifest_emit",
      "blind_review",
      "shell_exec",
    ],
    max_context_tokens: 200_000,
    supports_native_scheduling: false,
  });
  registry.register({
    provider: "generic",
    capabilities: ["git_read", "structured_json", "manifest_emit", "blind_review"],
    max_context_tokens: 128_000,
    supports_native_scheduling: false,
  });
  return registry;
}

export type FormattedProviderPrompt = {
  provider: ProviderId;
  system: string;
  user: string;
  response_format: "json_schema" | "xml_json" | "plain_json";
};

export type TaskProviderAdapter = {
  readonly provider: ProviderId;
  formatPrompt(contract: OemTaskContract): FormattedProviderPrompt;
  parseOutput(raw: unknown): OemTaskOutput;
};

function normalizeRawObject(raw: unknown): Record<string, unknown> {
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    const jsonText = trimmed.startsWith("```")
      ? trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
      : trimmed;
    const parsed = JSON.parse(jsonText) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("Parsed provider output must be a JSON object.");
    }
    return parsed as Record<string, unknown>;
  }
  if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  throw new Error("Unsupported raw provider output type.");
}

function buildCanonicalPromptBody(contract: OemTaskContract): string {
  return [
    `OEM Task Contract v${contract.contract_version}`,
    `Task: ${contract.task_id} | Role: ${contract.role} | Priority: ${contract.priority}`,
    `Snapshot: ${contract.input.snapshot_id} | Window: ${contract.input.window_from}..${contract.input.window_to}`,
    `Refs: ${contract.input.refs.join(", ") || "none"}`,
    `Instructions: ${contract.input.instructions}`,
    `Policy: no direct push, no source mutation, require_manifest=${String(contract.policy.require_run_manifest)}`,
  ].join("\n");
}

export const ChatGptTaskAdapter: TaskProviderAdapter = {
  provider: "chatgpt",
  formatPrompt(contract) {
    const parsed = OemTaskContractSchema.parse(contract);
    return {
      provider: "chatgpt",
      system: "You are an OEM scheduled worker. Return strict JSON matching OemTaskOutputSchema.",
      user: buildCanonicalPromptBody(parsed),
      response_format: "json_schema",
    };
  },
  parseOutput(raw) {
    const obj = normalizeRawObject(raw);
    return OemTaskOutputSchema.parse({
      contract_version: obj.contract_version ?? "1.0",
      task_id: obj.task_id,
      provider: "chatgpt",
      status: obj.status,
      summary: obj.summary,
      findings: obj.findings ?? [],
      ...(obj.manifest !== undefined ? { manifest: obj.manifest } : {}),
    });
  },
};

export const ClaudeTaskAdapter: TaskProviderAdapter = {
  provider: "claude",
  formatPrompt(contract) {
    const parsed = OemTaskContractSchema.parse(contract);
    return {
      provider: "claude",
      system:
        "Follow the OEM Task Contract strictly. Output valid JSON inside your final response.",
      user: `<oem_contract>\n${buildCanonicalPromptBody(parsed)}\n</oem_contract>`,
      response_format: "xml_json",
    };
  },
  parseOutput(raw) {
    const obj = normalizeRawObject(raw);
    return OemTaskOutputSchema.parse({
      contract_version: obj.contract_version ?? "1.0",
      task_id: obj.task_id,
      provider: "claude",
      status: obj.status,
      summary: obj.summary,
      findings: obj.findings ?? [],
      ...(obj.manifest !== undefined ? { manifest: obj.manifest } : {}),
    });
  },
};

export const GenericTaskAdapter: TaskProviderAdapter = {
  provider: "generic",
  formatPrompt(contract) {
    const parsed = OemTaskContractSchema.parse(contract);
    return {
      provider: "generic",
      system: "Execute OEM Task Contract and emit JSON.",
      user: buildCanonicalPromptBody(parsed),
      response_format: "plain_json",
    };
  },
  parseOutput(raw) {
    const obj = normalizeRawObject(raw);
    return OemTaskOutputSchema.parse({
      contract_version: obj.contract_version ?? "1.0",
      task_id: obj.task_id,
      provider: "generic",
      status: obj.status,
      summary: obj.summary,
      findings: obj.findings ?? [],
      ...(obj.manifest !== undefined ? { manifest: obj.manifest } : {}),
    });
  },
};

export function getProviderAdapter(provider: ProviderId): TaskProviderAdapter {
  switch (provider) {
    case "chatgpt":
      return ChatGptTaskAdapter;
    case "claude":
      return ClaudeTaskAdapter;
    case "generic":
      return GenericTaskAdapter;
  }
}

export type TaskValidationResult = {
  valid: boolean;
  errors: string[];
  normalized: OemTaskOutput | null;
};

/**
 * Deterministically validate normalized task output against an OEM Task Contract.
 */
export function validateTaskOutput(
  contract: OemTaskContract,
  output: unknown,
): TaskValidationResult {
  const parsedContract = OemTaskContractSchema.parse(contract);
  const parsedOutput = OemTaskOutputSchema.safeParse(output);
  if (!parsedOutput.success) {
    return {
      valid: false,
      errors: parsedOutput.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
      normalized: null,
    };
  }

  const data = parsedOutput.data;
  const errors: string[] = [];

  if (data.task_id !== parsedContract.task_id) {
    errors.push(`task_id mismatch: expected "${parsedContract.task_id}", got "${data.task_id}".`);
  }
  if (parsedContract.policy.require_run_manifest && !data.manifest) {
    errors.push("Contract policy requires a PK-08 run manifest, but none was emitted.");
  }
  if (parsedContract.policy.require_evidence_refs) {
    for (const finding of data.findings) {
      if (finding.refs.length === 0) {
        errors.push(`Finding "${finding.id}" is missing required evidence refs.`);
      }
    }
  }
  if (
    parsedContract.expected_output.require_findings &&
    data.status === "completed_with_results" &&
    data.findings.length === 0
  ) {
    errors.push("Status is completed_with_results but findings array is empty.");
  }

  return {
    valid: errors.length === 0,
    errors,
    normalized: errors.length === 0 ? data : null,
  };
}

export type { OperationalPriority, RunManifest };
