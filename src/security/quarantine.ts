import { createHash } from "node:crypto";
import { z } from "zod";
import { type GenealogySource, independentRoots } from "../pipeline/genealogy.ts";

export const QUARANTINE_START = "<<<OEM_QUARANTINED_SOURCE";
export const QUARANTINE_END = "<<<END_OEM_QUARANTINED_SOURCE>>>";

export const InjectionFindingSchema = z
  .strictObject({
    pattern_id: z.string().describe("Identifier of the matched prompt-injection rule."),
    severity: z.enum(["high", "medium"]).describe("Risk severity of the detected pattern."),
    excerpt: z.string().describe("Truncated excerpt of the suspicious text."),
    reason: z.string().describe("Explanation of why the pattern is flagged."),
  })
  .describe("Prompt-injection or hidden-instruction finding in a quarantined source.");

export type InjectionFinding = z.infer<typeof InjectionFindingSchema>;

export const QuarantinedSourceSchema = z
  .strictObject({
    source_id: z.string().describe("Identifier of the quarantined source."),
    origin_url: z.string().nullable().describe("Origin URL of the captured source, if any."),
    captured_at: z.string().describe("ISO-8601 timestamp when the source was captured."),
    sha256: z.string().describe("SHA-256 hex digest of the raw source text."),
    treat_as_untrusted_data: z
      .literal(true)
      .describe("Invariant marker indicating the payload is untrusted data, never instructions."),
    delimited_payload: z
      .string()
      .describe("Escaped source text wrapped in explicit non-executable quarantine delimiters."),
  })
  .describe("Untrusted source wrapped in a delimited quarantine envelope.");

export type QuarantinedSource = z.infer<typeof QuarantinedSourceSchema>;

export const QuarantineScanResultSchema = z
  .strictObject({
    quarantined: QuarantinedSourceSchema.describe("Delimited quarantine envelope."),
    findings: z.array(InjectionFindingSchema).describe("Detected instruction-like patterns."),
    safe_for_agent_read: z
      .boolean()
      .describe("True only when zero high-severity prompt-injection patterns were detected."),
  })
  .describe("Combined quarantine envelope and prompt-injection scan result.");

export type QuarantineScanResult = z.infer<typeof QuarantineScanResultSchema>;

export const CorroborationCheckResultSchema = z
  .strictObject({
    cited_count: z.number().int().nonnegative().describe("Number of distinct sources cited."),
    independent_root_count: z
      .number()
      .int()
      .nonnegative()
      .describe("Number of independent B17 genealogy roots."),
    roots: z.array(z.string()).describe("Sorted independent root source IDs."),
    undetermined_roots: z
      .array(z.string())
      .describe("Root IDs whose origin_type is not yet determined."),
    corpus_only: z.boolean().describe("True when every cited source is a corpus_synthesis."),
    artificial_corroboration: z
      .boolean()
      .describe(
        "True when multiple cited sources collapse to fewer than the required independent roots.",
      ),
    reason: z.string().describe("Summary of the B17 corroboration assessment."),
  })
  .describe("Result of checking cited sources for artificial corroboration via B17 genealogy.");

export type CorroborationCheckResult = z.infer<typeof CorroborationCheckResultSchema>;

type InjectionRule = {
  id: string;
  severity: "high" | "medium";
  pattern: RegExp;
  reason: string;
};

const INJECTION_RULES: readonly InjectionRule[] = [
  {
    id: "role-override",
    severity: "high",
    pattern:
      /\b(?:ignore|disregard|forget|override)\s+(?:all\s+)?(?:previous|prior|above|system)\s+(?:instructions|prompts|rules|constraints)\b/i,
    reason: "Attempts to override system or task instructions.",
  },
  {
    id: "system-prompt-spoof",
    severity: "high",
    pattern:
      /(?:^|\n)\s*(?:SYSTEM|DEVELOPER|ASSISTANT)\s*:\s*(?:you\s+are|do\s+not|execute|call)\b/i,
    reason: "Spoofs a privileged prompt role header.",
  },
  {
    id: "tool-hijack",
    severity: "high",
    pattern:
      /\b(?:call\s+tool|run_command|execute\s+bash|git\s+push|gh\s+api|exfiltrate|send\s+to\s+webhook)\b/i,
    reason: "Attempts to trigger tool execution or data exfiltration.",
  },
  {
    id: "html-hidden-instruction",
    severity: "high",
    pattern:
      /<!--[\s\S]*?(?:ignore|system\s+prompt|instructions|execute|tool|exfiltrate)[\s\S]*?-->/i,
    reason: "Hides agent-directed instructions inside an HTML comment.",
  },
  {
    id: "delimiter-breakout",
    severity: "high",
    pattern: /<<<(?:END_)?OEM_QUARANTINED_SOURCE/i,
    reason: "Attempts to break out of the quarantine delimiter envelope.",
  },
  {
    id: "zero-width-smuggling",
    severity: "medium",
    pattern: /[\u200B-\u200D\uFEFF]{3,}/,
    reason: "Contains runs of zero-width characters often used to hide text.",
  },
];

function escapeDelimiters(rawText: string): string {
  return rawText
    .replaceAll("<<<OEM_QUARANTINED_SOURCE", "[ESCAPED_QUARANTINE_START]")
    .replaceAll("<<<END_OEM_QUARANTINED_SOURCE>>>", "[ESCAPED_QUARANTINE_END]");
}

/**
 * Wrap untrusted source text in an explicit non-executable quarantine envelope
 * with SHA-256 integrity hash and escaped boundary markers.
 */
export function quarantineSource(input: {
  sourceId: string;
  rawText: string;
  originUrl?: string | null;
  capturedAt: string;
}): QuarantinedSource {
  const sha256 = createHash("sha256").update(input.rawText, "utf8").digest("hex");
  const escaped = escapeDelimiters(input.rawText);
  const delimited_payload = [
    `${QUARANTINE_START} id="${input.sourceId}" sha256="${sha256}" untrusted="true">>>`,
    escaped,
    QUARANTINE_END,
  ].join("\n");

  return {
    source_id: input.sourceId,
    origin_url: input.originUrl ?? null,
    captured_at: input.capturedAt,
    sha256,
    treat_as_untrusted_data: true,
    delimited_payload,
  };
}

/** Scan raw source text for prompt-injection and hidden-instruction patterns. */
export function detectPromptInjection(rawText: string): InjectionFinding[] {
  const findings: InjectionFinding[] = [];
  for (const rule of INJECTION_RULES) {
    const match = rule.pattern.exec(rawText);
    if (match) {
      findings.push({
        pattern_id: rule.id,
        severity: rule.severity,
        excerpt: match[0].slice(0, 120),
        reason: rule.reason,
      });
    }
  }
  return findings;
}

/** Quarantine a source and scan it for prompt-injection instructions. */
export function scanQuarantinedSource(input: {
  sourceId: string;
  rawText: string;
  originUrl?: string | null;
  capturedAt: string;
}): QuarantineScanResult {
  const findings = detectPromptInjection(input.rawText);
  const quarantined = quarantineSource(input);
  const safe_for_agent_read = !findings.some((f) => f.severity === "high");
  return { quarantined, findings, safe_for_agent_read };
}

/**
 * Detect artificial corroboration (source laundering) by collapsing cited sources
 * to their independent B17 genealogy roots (`derived_from` / `relies_on`).
 */
export function checkArtificialCorroboration(
  citedSourceIds: readonly string[],
  sources: readonly GenealogySource[],
  minIndependentRoots = 2,
): CorroborationCheckResult {
  const rootInfo = independentRoots(citedSourceIds, sources);
  const citedCount = rootInfo.references.length;
  const rootCount = rootInfo.roots.length;
  const collapsed = citedCount > rootCount && rootCount < minIndependentRoots;
  const artificial = collapsed || (citedCount >= minIndependentRoots && rootInfo.corpus_only);

  let reason = `Found ${rootCount} independent root(s) across ${citedCount} cited source(s).`;
  if (rootInfo.corpus_only && citedCount > 0) {
    reason = `All ${citedCount} cited source(s) are corpus syntheses with no primary root.`;
  } else if (collapsed) {
    reason = `${citedCount} cited sources collapse to ${rootCount} independent B17 root(s) (< ${minIndependentRoots} required).`;
  }

  return {
    cited_count: citedCount,
    independent_root_count: rootCount,
    roots: rootInfo.roots,
    undetermined_roots: rootInfo.undetermined,
    corpus_only: rootInfo.corpus_only,
    artificial_corroboration: artificial,
    reason,
  };
}
