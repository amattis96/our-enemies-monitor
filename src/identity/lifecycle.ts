import {
  checkPersonDataMinimization,
  type IdentityEntityProfile,
  type LinkageDecision,
  type MergeRecord,
  type RedirectRecord,
  type SplitRecord,
} from "./schema.ts";

export type LifecycleState = {
  entities: IdentityEntityProfile[];
  redirects: RedirectRecord[];
  history: (MergeRecord | SplitRecord)[];
  decisions: LinkageDecision[];
};

export type MergeOptions = {
  mergedBy: string;
  rationale: string;
  humanConfirmed: boolean;
  mergedAt?: string;
  mergeId?: string;
};

export type SplitOptions = {
  splitBy: string;
  rationale: string;
  humanConfirmed: boolean;
  splitAt?: string;
  splitId?: string;
};

const FORBIDDEN_AUTO_ACTORS = new Set(["auto", "system", "automated", "bot", "linkage_auto"]);

function assertHumanActor(actor: string, humanConfirmed: boolean, operation: string): void {
  const normalized = actor.trim().toLowerCase();
  if (!humanConfirmed || normalized.length === 0 || FORBIDDEN_AUTO_ACTORS.has(normalized)) {
    throw new Error(
      `Automatic ${operation} is forbidden: explicit human confirmation and reviewer ID are required.`,
    );
  }
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}::${b}` : `${b}::${a}`;
}

/**
 * Resolves an entity ID through active redirects, detecting cycles.
 */
export function resolveEntityId(id: string, redirects: readonly RedirectRecord[]): string {
  const map = new Map<string, string>();
  for (const r of redirects) {
    map.set(r.from_id, r.to_id);
  }

  let current = id;
  const visited = new Set<string>([current]);
  while (map.has(current)) {
    const next = map.get(current);
    if (!next) break;
    if (visited.has(next)) {
      throw new Error(`Redirect cycle detected involving entity ID: ${next}`);
    }
    visited.add(next);
    current = next;
  }
  return current;
}

/**
 * Performs a reversible human-confirmed merge of `sourceIds` into `targetId`.
 * Never runs automatically; rejects persisted `distinct` or `uncertain` pairs.
 */
export function mergeEntities(
  state: LifecycleState,
  sourceIds: readonly string[],
  targetId: string,
  options: MergeOptions,
): LifecycleState {
  assertHumanActor(options.mergedBy, options.humanConfirmed, "merge");

  const uniqueSources = [...new Set(sourceIds)];
  if (uniqueSources.length < 2) {
    throw new Error("Merge requires at least 2 distinct source entity IDs.");
  }
  if (!uniqueSources.includes(targetId)) {
    throw new Error(`targetId (${targetId}) must be one of sourceIds.`);
  }

  // Enforce persisted distinct / uncertain guard
  for (let i = 0; i < uniqueSources.length; i++) {
    const a = uniqueSources[i];
    if (!a) continue;
    for (let j = i + 1; j < uniqueSources.length; j++) {
      const b = uniqueSources[j];
      if (!b) continue;
      const decision = state.decisions.find(
        (d) => pairKey(d.entity_a, d.entity_b) === pairKey(a, b),
      );
      if (decision && (decision.outcome === "distinct" || decision.outcome === "uncertain")) {
        throw new Error(`Cannot merge (${a}, ${b}): persisted decision is '${decision.outcome}'.`);
      }
    }
  }

  const byId = new Map(state.entities.map((e) => [e.id, e]));
  const snapshotBefore: IdentityEntityProfile[] = [];
  for (const id of uniqueSources) {
    const found = byId.get(id);
    if (!found) {
      throw new Error(`Entity not found for merge: ${id}`);
    }
    snapshotBefore.push(structuredClone(found));
  }

  const targetOriginal = byId.get(targetId);
  if (!targetOriginal) {
    throw new Error(`Target entity not found: ${targetId}`);
  }

  const mergedAliases = [...(targetOriginal.aliases ?? [])];
  const seenAliasNames = new Set(mergedAliases.map((a) => a.name));
  const mergedAt = options.mergedAt ?? new Date().toISOString();
  const mergeId = options.mergeId ?? `merge-${targetId}-${Date.now()}`;

  const mergedRegistryNumbers = [...(targetOriginal.external_ids?.registry_numbers ?? [])];
  const seenRegistryKeys = new Set(
    mergedRegistryNumbers.map((r) => `${r.jurisdiction}:${r.number}`),
  );

  let lei = targetOriginal.external_ids?.lei;
  let wikidataQid = targetOriginal.external_ids?.wikidata_qid;
  let officialWebsite = targetOriginal.external_ids?.official_website;
  const sanctionsIds = new Set(targetOriginal.external_ids?.sanctions_ids ?? []);

  const newRedirects: RedirectRecord[] = [];
  for (const src of snapshotBefore) {
    if (src.id === targetId) continue;

    if (!seenAliasNames.has(src.name.it)) {
      mergedAliases.push({
        name: src.name.it,
        kind: "merger",
        valid_from: null,
        valid_to: null,
        note: `Merged from ${src.id} (${mergeId})`,
      });
      seenAliasNames.add(src.name.it);
    }

    for (const alias of src.aliases ?? []) {
      if (!seenAliasNames.has(alias.name)) {
        mergedAliases.push(alias);
        seenAliasNames.add(alias.name);
      }
    }

    if (!lei && src.external_ids?.lei) lei = src.external_ids.lei;
    if (!wikidataQid && src.external_ids?.wikidata_qid) {
      wikidataQid = src.external_ids.wikidata_qid;
    }
    if (!officialWebsite && src.external_ids?.official_website) {
      officialWebsite = src.external_ids.official_website;
    }
    for (const sid of src.external_ids?.sanctions_ids ?? []) {
      sanctionsIds.add(sid);
    }
    for (const reg of src.external_ids?.registry_numbers ?? []) {
      const key = `${reg.jurisdiction}:${reg.number}`;
      if (!seenRegistryKeys.has(key)) {
        mergedRegistryNumbers.push(reg);
        seenRegistryKeys.add(key);
      }
    }

    newRedirects.push({
      from_id: src.id,
      to_id: targetId,
      reason: "merge",
      created_at: mergedAt,
      created_by: options.mergedBy,
      lifecycle_id: mergeId,
    });
  }

  const nextExternalIds = {
    ...(lei ? { lei } : {}),
    ...(wikidataQid ? { wikidata_qid: wikidataQid } : {}),
    ...(officialWebsite ? { official_website: officialWebsite } : {}),
    ...(mergedRegistryNumbers.length > 0 ? { registry_numbers: mergedRegistryNumbers } : {}),
    ...(sanctionsIds.size > 0 ? { sanctions_ids: [...sanctionsIds] } : {}),
  };

  const updatedTarget: IdentityEntityProfile = {
    ...structuredClone(targetOriginal),
    ...(mergedAliases.length > 0 ? { aliases: mergedAliases } : {}),
    ...(Object.keys(nextExternalIds).length > 0 ? { external_ids: nextExternalIds } : {}),
  };

  const removedSet = new Set(uniqueSources.filter((id) => id !== targetId));
  const nextEntities = state.entities
    .filter((e) => !removedSet.has(e.id))
    .map((e) => (e.id === targetId ? updatedTarget : e));

  const mergeRecord: MergeRecord = {
    id: mergeId,
    kind: "merge",
    source_ids: uniqueSources,
    target_id: targetId,
    snapshot_before: snapshotBefore,
    merged_at: mergedAt,
    merged_by: options.mergedBy,
    rationale: options.rationale,
    reverted_at: null,
  };

  return {
    entities: nextEntities,
    redirects: [...state.redirects, ...newRedirects],
    history: [...state.history, mergeRecord],
    decisions: state.decisions,
  };
}

/**
 * Reverts a previously executed merge using its pre-merge snapshot.
 */
export function revertMerge(
  state: LifecycleState,
  mergeId: string,
  revertedAt = new Date().toISOString(),
): LifecycleState {
  const entry = state.history.find((h) => h.id === mergeId && h.kind === "merge");
  if (entry?.kind !== "merge") {
    throw new Error(`Merge record not found: ${mergeId}`);
  }
  if (entry.reverted_at !== null) {
    throw new Error(`Merge record already reverted: ${mergeId}`);
  }

  const restoredIds = new Set(entry.snapshot_before.map((e) => e.id));
  const remainingEntities = state.entities.filter((e) => !restoredIds.has(e.id));
  const nextEntities = [
    ...remainingEntities,
    ...entry.snapshot_before.map((e) => structuredClone(e)),
  ].sort((a, b) => a.id.localeCompare(b.id));

  const nextRedirects = state.redirects.filter((r) => r.lifecycle_id !== mergeId);
  const nextHistory = state.history.map((h) =>
    h.id === mergeId && h.kind === "merge" ? { ...h, reverted_at: revertedAt } : h,
  );

  return {
    entities: nextEntities,
    redirects: nextRedirects,
    history: nextHistory,
    decisions: state.decisions,
  };
}

/**
 * Splits a single entity into two or more distinct entity profiles,
 * recording a full pre-split snapshot for reversibility.
 */
export function splitEntity(
  state: LifecycleState,
  sourceId: string,
  resultingProfiles: readonly IdentityEntityProfile[],
  options: SplitOptions,
): LifecycleState {
  assertHumanActor(options.splitBy, options.humanConfirmed, "split");

  if (resultingProfiles.length < 2) {
    throw new Error("Split requires at least 2 resulting entity profiles.");
  }

  const original = state.entities.find((e) => e.id === sourceId);
  if (!original) {
    throw new Error(`Source entity not found for split: ${sourceId}`);
  }

  for (const profile of resultingProfiles) {
    const minCheck = checkPersonDataMinimization(profile as unknown as Record<string, unknown>);
    if (!minCheck.ok) {
      throw new Error(
        `Person data minimization violation in split profile ${profile.id}: ${minCheck.violations.join(", ")}`,
      );
    }
  }

  const splitAt = options.splitAt ?? new Date().toISOString();
  const splitId = options.splitId ?? `split-${sourceId}-${Date.now()}`;
  const resultingIds = resultingProfiles.map((p) => p.id);

  const nextEntities = [
    ...state.entities.filter((e) => e.id !== sourceId),
    ...resultingProfiles.map((p) => structuredClone(p)),
  ].sort((a, b) => a.id.localeCompare(b.id));

  const splitRecord: SplitRecord = {
    id: splitId,
    kind: "split",
    source_id: sourceId,
    resulting_ids: resultingIds,
    snapshot_before: structuredClone(original),
    split_at: splitAt,
    split_by: options.splitBy,
    rationale: options.rationale,
    reverted_at: null,
  };

  return {
    entities: nextEntities,
    redirects: state.redirects,
    history: [...state.history, splitRecord],
    decisions: state.decisions,
  };
}

/**
 * Reverts a previously executed split, restoring the original entity snapshot.
 */
export function revertSplit(
  state: LifecycleState,
  splitId: string,
  revertedAt = new Date().toISOString(),
): LifecycleState {
  const entry = state.history.find((h) => h.id === splitId && h.kind === "split");
  if (entry?.kind !== "split") {
    throw new Error(`Split record not found: ${splitId}`);
  }
  if (entry.reverted_at !== null) {
    throw new Error(`Split record already reverted: ${splitId}`);
  }

  const toRemove = new Set(entry.resulting_ids);
  const nextEntities = [
    ...state.entities.filter((e) => !toRemove.has(e.id)),
    structuredClone(entry.snapshot_before),
  ].sort((a, b) => a.id.localeCompare(b.id));

  const nextRedirects = state.redirects.filter((r) => r.lifecycle_id !== splitId);
  const nextHistory = state.history.map((h) =>
    h.id === splitId && h.kind === "split" ? { ...h, reverted_at: revertedAt } : h,
  );

  return {
    entities: nextEntities,
    redirects: nextRedirects,
    history: nextHistory,
    decisions: state.decisions,
  };
}
