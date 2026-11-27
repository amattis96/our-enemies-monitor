import { writeFileSync } from "node:fs";
import { repoPath } from "../pipeline/paths.ts";
import type { EngineManifest, EngineMethod } from "./manifest.ts";

export type MethodDiff = {
  id: string;
  change: "added" | "removed" | "updated";
  detail: string;
};

export type ThresholdDiff = {
  key: string;
  before: number | string | boolean;
  after: number | string | boolean;
};

export type EngineChangelogEntry = {
  engine_version: string;
  updated_at: string;
  previous_version: string | null;
  method_changes: MethodDiff[];
  threshold_changes: ThresholdDiff[];
  cadence_changes: string[];
  role_changes: string[];
  model_changes: string[];
};

function formatMethodSummary(method: EngineMethod): string {
  return `${method.id} v${method.version} (${method.status})`;
}

/**
 * Compute a deterministic changelog entry from two engine manifest versions.
 * When `previous` is null, records the initial baseline methods and thresholds.
 */
export function diffEngineManifests(
  previous: EngineManifest | null,
  current: EngineManifest,
): EngineChangelogEntry {
  if (!previous) {
    return {
      engine_version: current.engine_version,
      updated_at: current.updated_at,
      previous_version: null,
      method_changes: current.methods.map((m) => ({
        id: m.id,
        change: "added",
        detail: `Initial registration: ${formatMethodSummary(m)}`,
      })),
      threshold_changes: [],
      cadence_changes: current.cadences.map(
        (c) => `Registered ${c.task_id} (${c.schedule} ${c.timezone}, ${c.status})`,
      ),
      role_changes: current.roles.map((r) => `Registered role ${r.id}`),
      model_changes: current.models.map((m) => `${m.role}: ${m.provider}/${m.model}`),
    };
  }

  const prevMethods = new Map(previous.methods.map((m) => [m.id, m]));
  const currMethods = new Map(current.methods.map((m) => [m.id, m]));
  const method_changes: MethodDiff[] = [];

  for (const [id, curr] of currMethods) {
    const prev = prevMethods.get(id);
    if (!prev) {
      method_changes.push({
        id,
        change: "added",
        detail: `Added ${formatMethodSummary(curr)}`,
      });
    } else if (prev.version !== curr.version || prev.status !== curr.status) {
      method_changes.push({
        id,
        change: "updated",
        detail: `v${prev.version} (${prev.status}) -> v${curr.version} (${curr.status})`,
      });
    }
  }
  for (const [id, prev] of prevMethods) {
    if (!currMethods.has(id)) {
      method_changes.push({
        id,
        change: "removed",
        detail: `Removed ${formatMethodSummary(prev)}`,
      });
    }
  }

  const threshold_changes: ThresholdDiff[] = [];
  const prevThresholds = previous.thresholds.code_thresholds;
  const currThresholds = current.thresholds.code_thresholds;
  for (const key of Object.keys(currThresholds) as (keyof typeof currThresholds)[]) {
    if (prevThresholds[key] !== currThresholds[key]) {
      threshold_changes.push({
        key,
        before: prevThresholds[key],
        after: currThresholds[key],
      });
    }
  }

  const cadence_changes: string[] = [];
  const prevCadences = new Map(previous.cadences.map((c) => [c.task_id, c]));
  for (const curr of current.cadences) {
    const prev = prevCadences.get(curr.task_id);
    if (!prev) {
      cadence_changes.push(`Added ${curr.task_id} (${curr.schedule} ${curr.timezone})`);
    } else if (prev.schedule !== curr.schedule || prev.status !== curr.status) {
      cadence_changes.push(
        `Updated ${curr.task_id}: ${prev.schedule} (${prev.status}) -> ${curr.schedule} (${curr.status})`,
      );
    }
  }

  const role_changes: string[] = [];
  const prevRoles = new Set(previous.roles.map((r) => r.id));
  for (const curr of current.roles) {
    if (!prevRoles.has(curr.id)) {
      role_changes.push(`Added role ${curr.id}`);
    }
  }

  const model_changes: string[] = [];
  const prevModels = new Map(previous.models.map((m) => [m.role, `${m.provider}/${m.model}`]));
  for (const curr of current.models) {
    const nextModel = `${curr.provider}/${curr.model}`;
    const prevModel = prevModels.get(curr.role);
    if (!prevModel) {
      model_changes.push(`Added ${curr.role}: ${nextModel}`);
    } else if (prevModel !== nextModel) {
      model_changes.push(`Updated ${curr.role}: ${prevModel} -> ${nextModel}`);
    }
  }

  return {
    engine_version: current.engine_version,
    updated_at: current.updated_at,
    previous_version: previous.engine_version,
    method_changes,
    threshold_changes,
    cadence_changes,
    role_changes,
    model_changes,
  };
}

/** Render changelog entries as deterministic Markdown (`docs/automation/ENGINE_CHANGELOG.md`). */
export function renderEngineChangelogMarkdown(entries: readonly EngineChangelogEntry[]): string {
  const lines: string[] = [
    "# Engine Changelog",
    "",
    "<!-- Generated from docs/automation/engine.manifest.json via src/engine/changelog.ts. Do not edit manually. -->",
    "",
    "This file tracks versioned changes to engine methods, public thresholds, cadences, roles, and model assignments.",
    "Security thresholds, protection details, investigative queries, and exact detection mechanics are excluded.",
    "",
  ];

  for (const entry of entries) {
    const heading = entry.previous_version
      ? `## v${entry.engine_version} (${entry.updated_at}) — from v${entry.previous_version}`
      : `## v${entry.engine_version} (${entry.updated_at}) — initial manifest`;
    lines.push(heading, "");

    if (entry.method_changes.length > 0) {
      lines.push("### Methods");
      for (const m of entry.method_changes) {
        lines.push(`- **${m.id}** (${m.change}): ${m.detail}`);
      }
      lines.push("");
    }

    if (entry.threshold_changes.length > 0) {
      lines.push("### Public Thresholds");
      for (const t of entry.threshold_changes) {
        lines.push(`- \`${t.key}\`: \`${String(t.before)}\` -> \`${String(t.after)}\``);
      }
      lines.push("");
    }

    if (entry.cadence_changes.length > 0) {
      lines.push("### Cadences");
      for (const c of entry.cadence_changes) {
        lines.push(`- ${c}`);
      }
      lines.push("");
    }

    if (entry.role_changes.length > 0) {
      lines.push("### Roles");
      for (const r of entry.role_changes) {
        lines.push(`- ${r}`);
      }
      lines.push("");
    }

    if (entry.model_changes.length > 0) {
      lines.push("### Models");
      for (const mod of entry.model_changes) {
        lines.push(`- ${mod}`);
      }
      lines.push("");
    }
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

export const DEFAULT_ENGINE_CHANGELOG_PATH = repoPath("docs/automation/ENGINE_CHANGELOG.md");

/** Write generated engine changelog Markdown to disk. */
export function writeEngineChangelog(
  entries: readonly EngineChangelogEntry[],
  filePath: string = DEFAULT_ENGINE_CHANGELOG_PATH,
): void {
  writeFileSync(filePath, renderEngineChangelogMarkdown(entries), "utf8");
}
