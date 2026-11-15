import { EXPOSURE_GROUP_KIND, type Exposure, type ExposureGroup } from "../model/index.ts";

/**
 * Structural checks on the optional `group` field of exposures (B19). A group
 * is an editorial reading aid, so the checks only keep it coherent: at least
 * two members, positions 1..n without gaps or duplicates, one measure per
 * supply-chain stage, and two measures with the same unit for a before/after
 * record. They never judge whether the grouping is right.
 */

export type ExposureGroupIssue = { id: string; message: string };

export function exposureGroupIssues(exposures: readonly Exposure[]): ExposureGroupIssue[] {
  const issues: ExposureGroupIssue[] = [];
  const members = new Map<ExposureGroup, Exposure[]>();
  for (const exposure of exposures) {
    if (!exposure.group) continue;
    members.set(exposure.group.id, [...(members.get(exposure.group.id) ?? []), exposure]);
    const kind = EXPOSURE_GROUP_KIND[exposure.group.id];
    if (kind === "supply_chain" && exposure.measures.length !== 1)
      issues.push({
        id: exposure.id,
        message: "a supply-chain stage must have exactly one measure",
      });
    if (kind === "before_after") {
      const [before, after, ...rest] = exposure.measures;
      if (!before || !after || rest.length > 0 || before.unit !== after.unit)
        issues.push({
          id: exposure.id,
          message: "a before/after record must have exactly two measures with the same unit",
        });
    }
  }
  for (const [group, list] of members) {
    const first = list[0]?.id ?? group;
    if (list.length < 2) {
      issues.push({ id: first, message: `group "${group}" has fewer than two members` });
      continue;
    }
    const positions = list.map((x) => x.group?.position ?? 0).sort((a, b) => a - b);
    if (positions.some((p, i) => p !== i + 1))
      issues.push({
        id: first,
        message: `group "${group}" positions must be 1..${list.length} without gaps or duplicates`,
      });
  }
  return issues;
}
