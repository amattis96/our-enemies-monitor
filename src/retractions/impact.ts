import type { Article, Dataset } from "../model/index.ts";

export type AssertionLike = {
  id: string;
  sources?: readonly string[];
  relationship_id?: string;
  event_id?: string;
};

export type SourceImpactEntry = {
  source_id: string;
  exists: boolean;
  dependent_sources: string[];
  assertions: string[];
  relationships: string[];
  events: string[];
  articles: string[];
  hypotheses: string[];
  exposures: string[];
  total_dependents: number;
};

export type SourceImpactIndex = {
  sources: Record<string, SourceImpactEntry>;
};

function addUnique(map: Map<string, Set<string>>, key: string, value: string): void {
  let set = map.get(key);
  if (!set) {
    set = new Set();
    map.set(key, set);
  }
  set.add(value);
}

function sortedArray(set: ReadonlySet<string> | undefined): string[] {
  return set ? [...set].sort((a, b) => a.localeCompare(b)) : [];
}

/**
 * Compute all downstream sources that depend on `rootSourceId` via
 * `derived_from` or `relies_on` (cycle-safe BFS).
 */
function collectDependentSources(
  rootSourceId: string,
  reverseSourceGraph: ReadonlyMap<string, ReadonlySet<string>>,
): string[] {
  const visited = new Set<string>();
  const queue: string[] = [];
  for (const child of reverseSourceGraph.get(rootSourceId) ?? []) {
    if (child !== rootSourceId && !visited.has(child)) {
      visited.add(child);
      queue.push(child);
    }
  }
  while (queue.length > 0) {
    const current = queue.shift() as string;
    for (const child of reverseSourceGraph.get(current) ?? []) {
      if (child !== rootSourceId && !visited.has(child)) {
        visited.add(child);
        queue.push(child);
      }
    }
  }
  return [...visited].sort((a, b) => a.localeCompare(b));
}

export type BuildImpactIndexInput = {
  dataset: Dataset;
  articles?: readonly Article[];
  assertions?: readonly AssertionLike[];
};

/**
 * Build an inverted index mapping every source ID to all dependent
 * assertions, relationships, events, articles, hypotheses, and exposures,
 * including transitive source genealogy (`derived_from`, `relies_on`).
 */
export function buildSourceImpactIndex(input: BuildImpactIndexInput): SourceImpactIndex {
  const { dataset, articles = [], assertions = [] } = input;
  const knownSources = new Set(dataset.sources.map((s) => s.id));

  // Reverse source genealogy: parent_source_id -> child_source_ids
  const reverseSourceGraph = new Map<string, Set<string>>();
  for (const source of dataset.sources) {
    for (const parent of [...(source.derived_from ?? []), ...(source.relies_on ?? [])]) {
      addUnique(reverseSourceGraph, parent, source.id);
    }
  }

  // Direct source -> record mappings
  const directAssertions = new Map<string, Set<string>>();
  const directRelationships = new Map<string, Set<string>>();
  const directEvents = new Map<string, Set<string>>();
  const directHypotheses = new Map<string, Set<string>>();
  const directExposures = new Map<string, Set<string>>();
  const directArticles = new Map<string, Set<string>>();

  for (const rel of dataset.relationships) {
    for (const s of rel.sources) addUnique(directRelationships, s, rel.id);
  }
  for (const ev of dataset.events) {
    for (const s of ev.sources) addUnique(directEvents, s, ev.id);
  }
  for (const hyp of dataset.hypotheses) {
    for (const s of hyp.sources) addUnique(directHypotheses, s, hyp.id);
  }
  for (const exp of dataset.exposures) {
    for (const s of exp.sources) addUnique(directExposures, s, exp.id);
  }
  for (const assertion of assertions) {
    for (const s of assertion.sources ?? []) addUnique(directAssertions, s, assertion.id);
  }

  // Reverse record -> articles via article.links
  const recordToArticles = new Map<string, Set<string>>();
  for (const article of articles) {
    for (const ref of article.references) {
      if ("source" in ref) {
        addUnique(directArticles, ref.source, article.id);
      }
    }
    for (const id of [
      ...article.links.events,
      ...article.links.relationships,
      ...article.links.hypotheses,
    ]) {
      addUnique(recordToArticles, id, article.id);
    }
  }

  // Collect all source IDs present in sources collection or cited anywhere
  const allSourceIds = new Set<string>([
    ...knownSources,
    ...directAssertions.keys(),
    ...directRelationships.keys(),
    ...directEvents.keys(),
    ...directHypotheses.keys(),
    ...directExposures.keys(),
    ...directArticles.keys(),
  ]);

  const sources: Record<string, SourceImpactEntry> = {};

  for (const sourceId of [...allSourceIds].sort((a, b) => a.localeCompare(b))) {
    const dependentSources = collectDependentSources(sourceId, reverseSourceGraph);
    const effectiveSources = [sourceId, ...dependentSources];

    const assertionSet = new Set<string>();
    const relationshipSet = new Set<string>();
    const eventSet = new Set<string>();
    const hypothesisSet = new Set<string>();
    const exposureSet = new Set<string>();
    const articleSet = new Set<string>();

    for (const sid of effectiveSources) {
      for (const id of directAssertions.get(sid) ?? []) assertionSet.add(id);
      for (const id of directRelationships.get(sid) ?? []) relationshipSet.add(id);
      for (const id of directEvents.get(sid) ?? []) eventSet.add(id);
      for (const id of directHypotheses.get(sid) ?? []) hypothesisSet.add(id);
      for (const id of directExposures.get(sid) ?? []) exposureSet.add(id);
      for (const id of directArticles.get(sid) ?? []) articleSet.add(id);
    }

    // Articles linking any affected event, relationship, or hypothesis
    for (const recordId of [...eventSet, ...relationshipSet, ...hypothesisSet]) {
      for (const articleId of recordToArticles.get(recordId) ?? []) {
        articleSet.add(articleId);
      }
    }

    const assertionsList = sortedArray(assertionSet);
    const relationshipsList = sortedArray(relationshipSet);
    const eventsList = sortedArray(eventSet);
    const articlesList = sortedArray(articleSet);
    const hypothesesList = sortedArray(hypothesisSet);
    const exposuresList = sortedArray(exposureSet);

    sources[sourceId] = {
      source_id: sourceId,
      exists: knownSources.has(sourceId),
      dependent_sources: dependentSources,
      assertions: assertionsList,
      relationships: relationshipsList,
      events: eventsList,
      articles: articlesList,
      hypotheses: hypothesesList,
      exposures: exposuresList,
      total_dependents:
        dependentSources.length +
        assertionsList.length +
        relationshipsList.length +
        eventsList.length +
        articlesList.length +
        hypothesesList.length +
        exposuresList.length,
    };
  }

  return { sources };
}

/** Look up all dependent records for a single source ID. */
export function lookupSourceImpact(index: SourceImpactIndex, sourceId: string): SourceImpactEntry {
  return (
    index.sources[sourceId] ?? {
      source_id: sourceId,
      exists: false,
      dependent_sources: [],
      assertions: [],
      relationships: [],
      events: [],
      articles: [],
      hypotheses: [],
      exposures: [],
      total_dependents: 0,
    }
  );
}
