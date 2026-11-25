import type { PackageProgress, PackageStatus, RoadmapPlan } from "./schema.ts";

const EFFORT_LABELS: Record<string, string> = {
  S: "S",
  M: "M",
  L: "L",
  research: "ricerca",
};

const COST_LABELS: Record<string, string> = {
  low: "basso",
  medium: "medio",
  high: "alto",
};

const IMPACT_LABELS: Record<string, string> = {
  medium: "Medio",
  medium_high: "Medio-alto",
  high: "Alto",
  critical: "Critico",
};

/**
 * Renders the Markdown status table from `plan.v1.json` and operational `progress/`.
 * Never edited by hand; generated deterministically by `render-roadmap`.
 */
export function renderRoadmapStatusTable(
  plan: RoadmapPlan,
  progressMap: Map<string, PackageProgress>,
  computedStatuses: Map<string, PackageStatus>,
): string {
  const lines: string[] = [
    "| PK | Pacchetto | M | Sforzo | Ricorrente | Impatto | Richiede | Stato |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
  ];

  for (const pkg of plan.packages) {
    const code = pkg.id.replace(/^PK-/, "");
    const effort = EFFORT_LABELS[pkg.effort] ?? pkg.effort;
    const cost = COST_LABELS[pkg.recurring_cost] ?? pkg.recurring_cost;
    const impact = IMPACT_LABELS[pkg.impact] ?? pkg.impact;

    let requiresText = "nessuno";
    if (pkg.subpackages && pkg.subpackages.length > 0) {
      if (pkg.id === "PK-15") {
        requiresText = "nessuno; 15B: D3";
      } else if (pkg.id === "PK-25") {
        const baseReqs = pkg.dependencies.requires.join(", ");
        const calReqs = pkg.subpackages.map((s) => s.dependencies.requires.join(", ")).join(", ");
        requiresText = `${baseReqs} (calendario: solo ${calReqs})`;
      } else {
        requiresText =
          pkg.dependencies.requires.length > 0 ? pkg.dependencies.requires.join(", ") : "nessuno";
      }
    } else if (pkg.dependencies.requires.length > 0) {
      const reqs = [...pkg.dependencies.requires];
      if (pkg.data_readiness_gate_required) reqs.push("gate dati");
      requiresText = reqs.join(", ");
    }

    let statusText: string;
    if (pkg.subpackages_only && pkg.subpackages && pkg.subpackages.length > 0) {
      const subStatuses = pkg.subpackages.map((sub) => {
        const st = computedStatuses.get(sub.id) ?? progressMap.get(sub.id)?.status ?? "blocked";
        return `${sub.id.replace(/^PK-/, "")} ${st}`;
      });
      const unique = new Set(
        pkg.subpackages.map((sub) => computedStatuses.get(sub.id) ?? "blocked"),
      );
      const [onlyStatus] = [...unique];
      statusText = unique.size === 1 && onlyStatus ? onlyStatus : subStatuses.join(", ");
    } else {
      statusText = computedStatuses.get(pkg.id) ?? progressMap.get(pkg.id)?.status ?? "blocked";
    }

    lines.push(
      `| ${code} | ${pkg.title} | ${pkg.milestone.replace(/^M/, "")} | ${effort} | ${cost} | ${impact} | ${requiresText} | ${statusText} |`,
    );
  }

  return `${lines.join("\n")}\n`;
}

export function renderRoadmapSummary(
  plan: RoadmapPlan,
  progressMap: Map<string, PackageProgress>,
  computedStatuses: Map<string, PackageStatus>,
): string {
  const statusTable = renderRoadmapStatusTable(plan, progressMap, computedStatuses);
  const openDecisions = plan.decisions.filter((d) => d.status === "open");
  const eligible = [...computedStatuses.entries()]
    .filter(([, status]) => status === "eligible")
    .map(([id]) => id);

  const sections = [
    `# ${plan.title}`,
    "",
    `Aggiornamento piano: ${plan.updated_at} · Pacchetti: ${plan.frozen_scope.packages_count} · Voci: ${plan.frozen_scope.items_count}`,
    "",
    `Pacchetti eligible (${eligible.length}): ${eligible.join(", ") || "nessuno"}`,
    `Decisioni aperte (${openDecisions.length}): ${openDecisions.map((d) => d.id).join(", ") || "nessuna"}`,
    "",
    "## Tabella di stato",
    "",
    statusTable.trimEnd(),
    "",
  ];

  return sections.join("\n");
}
