import type { Issue } from "../validate.ts";
import { CLASSIFICATIONS, type IngestPlan } from "./plan.ts";

export type IngestReport = {
  source: string;
  file: string;
  mode: "dry-run" | "write";
  summary: Record<string, number>;
  fatal: string[];
  operations: IngestPlan["operations"];
  writes: { action: "create" | "update"; path: string; record: unknown }[];
  attention: string[];
  validation: Issue[];
  /** Paths actually written (write mode only). */
  written: string[];
};

export function buildReport(
  plan: IngestPlan,
  validation: Issue[],
  mode: IngestReport["mode"],
  written: string[] = [],
): IngestReport {
  const summary = Object.fromEntries(CLASSIFICATIONS.map((c) => [c, 0]));
  for (const operation of plan.operations)
    summary[operation.classification] = (summary[operation.classification] ?? 0) + 1;
  return {
    source: plan.source,
    file: plan.file,
    mode,
    summary,
    fatal: plan.fatal,
    operations: plan.operations,
    writes: plan.writes.map(({ action, path, record }) => ({ action, path, record })),
    attention: plan.attention,
    validation,
    written,
  };
}

/** Human-readable report. */
export function renderReport(report: IngestReport): string {
  const lines = [
    `Ingest ${report.source} (${report.file}) — ${report.mode}`,
    "",
    `Operations: ${Object.entries(report.summary)
      .map(([k, v]) => `${v} ${k}`)
      .join(", ")}`,
  ];
  if (report.fatal.length > 0) {
    lines.push(
      "",
      "BLOCKED (the planned writes below will not be applied):",
      ...report.fatal.map((f) => `  - ${f}`),
    );
  }
  lines.push("");
  for (const operation of report.operations) {
    const target = operation.id ? ` → ${operation.id}` : "";
    lines.push(
      `  [${operation.classification}] ${operation.ref} ${operation.op}${target}`,
      ...operation.reasons.map((reason) => `      ${reason}`),
    );
  }
  const creates = report.writes.filter((w) => w.action === "create").map((w) => w.path);
  const updates = report.writes.filter((w) => w.action === "update").map((w) => w.path);
  lines.push(
    "",
    `Planned writes: ${creates.length} new, ${updates.length} updated file(s) in data/`,
    ...creates.map((p) => `  + ${p}`),
    ...updates.map((p) => `  ~ ${p}`),
  );
  if (report.attention.length > 0) {
    lines.push("", "Attention:", ...report.attention.map((a) => `  - ${a}`));
  }
  const errors = report.validation.filter((i) => i.severity === "error");
  const warnings = report.validation.filter((i) => i.severity === "warning");
  lines.push(
    "",
    `Validation of the resulting data/: ${errors.length} error(s), ${warnings.length} warning(s)`,
  );
  for (const issue of report.validation) {
    lines.push(`  ${issue.severity}: ${issue.file}: ${issue.message}`);
  }
  if (report.mode === "write") {
    lines.push("", `Written: ${report.written.length} file(s)`);
  } else {
    lines.push("", "Dry run: nothing written. Re-run with --write to create the candidates.");
  }
  return `${lines.join("\n")}\n`;
}
