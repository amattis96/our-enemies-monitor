import { isNegativeCaveat, NEGATION, PARTICIPATION_BOILERPLATE } from "../editorial/inferences.ts";
import type { Dataset } from "../model/index.ts";
import { corpusOnlyE1, independentRoots } from "../pipeline/genealogy.ts";
import type { ExportFile } from "../site/exports.ts";
import type { PublicationReport } from "../site/publication.ts";
import { participationEdges, scanMentions } from "./mentions.ts";

/**
 * B12 measurement baseline. Pure, read-only reproductions of the measurable
 * parts of FABLE_A §11 (E1–E7) and FABLE_D §9.1 (T1–T11). Every function
 * takes already-loaded data and returns plain JSON, so the same commit always
 * yields the same output. Heuristics are named and documented in the output:
 * they are measuring sticks, not editorial judgements.
 */

export const BASELINE_VERSION = 1;

const CORPUS_SOURCE = /^S\d{2,3}$/;

/** Shared with the B15 registry so both use the same lexical detector. */
export { isNegativeCaveat };

const byId = <T extends { id: string }>(a: T, b: T) => a.id.localeCompare(b.id);

// ---------------------------------------------------------------------------
// FABLE_A §11

/** E1 — depth of the source chain. */
export function e1SourceChain(dataset: Dataset) {
  const corpusOnly = dataset.relationships.filter(
    (r) => r.sources.length > 0 && r.sources.every((s) => CORPUS_SOURCE.test(s)),
  );
  const cited = new Set(
    [
      ...dataset.events,
      ...dataset.relationships,
      ...dataset.hypotheses,
      ...dataset.exposures,
    ].flatMap((r) => r.sources),
  );
  const external = dataset.sources.filter((s) => /^[FP]/.test(s.id));
  const neverCited = external.filter((s) => !cited.has(s.id)).map((s) => s.id);
  return {
    relationships_total: dataset.relationships.length,
    relationships_corpus_only: corpusOnly.length,
    external_sources_total: external.length,
    external_sources_never_cited: neverCited.length,
    external_sources_never_cited_ids: neverCited,
  };
}

/** E2 — redundancy of (evidence_level, evidence_status) on relationships. */
export function e2LevelStatusPairs(dataset: Dataset) {
  const counts = new Map<string, number>();
  for (const r of dataset.relationships) {
    const key = `${r.evidence_level}|${r.evidence_status}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const pairs = [...counts]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, count]) => {
      const [evidence_level, evidence_status] = key.split("|");
      return { evidence_level, evidence_status, count };
    });
  return { distinct_pairs: pairs.length, pairs };
}

/** E3 — publication regression: baseline records the gate withholds, with reasons. */
export function e3WithheldBaseline(dataset: Dataset, report: PublicationReport) {
  const status = new Map<string, string>();
  for (const name of Object.keys(dataset) as (keyof Dataset)[]) {
    for (const record of dataset[name]) status.set(record.id, record.review.status);
  }
  const rows = report.withheld
    .filter((w) => status.get(w.id) === "imported_unreviewed")
    .map((w) => ({ id: w.id, collection: w.collection, reasons: [...w.reasons].sort() }))
    .sort((a, b) => a.collection.localeCompare(b.collection) || a.id.localeCompare(b.id));
  const byCollection: Record<string, number> = {};
  for (const row of rows) byCollection[row.collection] = (byCollection[row.collection] ?? 0) + 1;
  return {
    imported_unreviewed_withheld: rows.length,
    by_collection: byCollection,
    withheld_total: report.withheld.length,
    records: rows,
  };
}

type Edge = { id: string; source: string; target: string };

/** Deterministic undirected BFS; neighbours visited in edge-ID order. */
export function shortestPath(edges: Edge[], from: string, to: string): string[] | null {
  if (from === to) return [];
  const adjacency = new Map<string, Edge[]>();
  for (const edge of [...edges].sort(byId)) {
    for (const node of [edge.source, edge.target]) {
      const list = adjacency.get(node) ?? [];
      list.push(edge);
      adjacency.set(node, list);
    }
  }
  const previous = new Map<string, { node: string; edge: string }>();
  const seen = new Set([from]);
  let frontier = [from];
  while (frontier.length > 0) {
    const next: string[] = [];
    for (const node of frontier) {
      for (const edge of adjacency.get(node) ?? []) {
        const other = edge.source === node ? edge.target : edge.source;
        if (seen.has(other)) continue;
        seen.add(other);
        previous.set(other, { node, edge: edge.id });
        if (other === to) {
          const path: string[] = [];
          let cursor = to;
          while (cursor !== from) {
            const step = previous.get(cursor);
            if (!step) break;
            path.unshift(step.edge);
            cursor = step.node;
          }
          return path;
        }
        next.push(other);
      }
    }
    frontier = next;
  }
  return null;
}

/** E4 — counter-inference: hypothesis endpoints joined through a negative caveat. */
export function e4CounterInference(dataset: Dataset, published: Dataset) {
  const caveated = new Map(published.relationships.map((r) => [r.id, isNegativeCaveat(r)]));
  const edges = published.relationships.map((r) => ({
    id: r.id,
    source: r.subject,
    target: r.object,
  }));
  const rows = [...dataset.hypotheses].sort(byId).map((h) => {
    const path = shortestPath(edges, h.subject, h.object);
    const negative = (path ?? []).filter((id) => caveated.get(id));
    return {
      id: h.id,
      subject: h.subject,
      object: h.object,
      path,
      negative_caveat_edges: negative,
    };
  });
  return {
    graph: "published relationships (undirected, participation included)",
    negative_caveat_rule: `caveat.it matches ${NEGATION} and does not start with "${PARTICIPATION_BOILERPLATE}"`,
    negative_caveats_canonical: dataset.relationships.filter(isNegativeCaveat).length,
    negative_caveats_published: published.relationships.filter(isNegativeCaveat).length,
    hypotheses: rows.length,
    hypotheses_with_path: rows.filter((r) => r.path !== null).length,
    paths_through_negative_caveat: rows.filter((r) => r.negative_caveat_edges.length > 0).length,
    rows,
  };
}

/** Deterministic PRNG (mulberry32) so the null model is reproducible. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Pair = [string, string];

function pairsWithTwoEvents(edges: Pair[]): number {
  const byEvent = new Map<string, Set<string>>();
  for (const [entity, event] of edges) {
    const set = byEvent.get(event) ?? new Set();
    set.add(entity);
    byEvent.set(event, set);
  }
  const counts = new Map<string, number>();
  for (const set of byEvent.values()) {
    const list = [...set].sort();
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const key = `${list[i]}|${list[j]}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
  }
  return [...counts.values()].filter((n) => n >= 2).length;
}

function degreePreservingSwap(edges: Pair[], swaps: number, random: () => number): Pair[] {
  const out = edges.map((e) => [...e] as Pair);
  const present = new Set(out.map(([a, e]) => `${a}|${e}`));
  for (let k = 0; k < swaps; k++) {
    const i = Math.floor(random() * out.length);
    const j = Math.floor(random() * out.length);
    const x = out[i];
    const y = out[j];
    if (!x || !y) continue;
    const [a, e] = x;
    const [b, f] = y;
    if (a === b || e === f || present.has(`${a}|${f}`) || present.has(`${b}|${e}`)) continue;
    present.delete(`${a}|${e}`);
    present.delete(`${b}|${f}`);
    out[i] = [a, f];
    out[j] = [b, e];
    present.add(`${a}|${f}`);
    present.add(`${b}|${e}`);
  }
  return out;
}

/** E5 — co-participation against a degree-preserving null model. */
export function e5CoParticipation(dataset: Dataset, runs = 500, seed = 7) {
  const edges = participationEdges(dataset);
  const random = mulberry32(seed);
  const observed = pairsWithTwoEvents(edges);
  const nulls: number[] = [];
  for (let run = 0; run < runs; run++) {
    nulls.push(pairsWithTwoEvents(degreePreservingSwap(edges, 10 * edges.length, random)));
  }
  const sorted = [...nulls].sort((a, b) => a - b);
  const mean = nulls.reduce((s, n) => s + n, 0) / Math.max(1, runs);
  return {
    participation_edges: edges.length,
    observed_pairs_with_2_events: observed,
    null_model: {
      runs,
      seed,
      prng: "mulberry32",
      swaps_per_run: 10 * edges.length,
      mean: Math.round(mean * 100) / 100,
      p95: sorted[Math.floor(0.95 * (sorted.length - 1))] ?? null,
      max: sorted.at(-1) ?? null,
    },
  };
}

/** E6 — entity names in event text without a participation edge (A appendix matcher). */
export function e6MentionsWithoutEdge(dataset: Dataset) {
  const mentions = scanMentions(dataset).map(({ event, entity }) => ({ event, entity }));
  const linkedEntities = new Set(participationEdges(dataset).map(([entity]) => entity));
  return {
    matcher: "A appendix simplified matcher (name segments >= 5 chars, no stop list)",
    mentions: mentions.length,
    events_with_mentions: new Set(mentions.map((m) => m.event)).size,
    entities_mentioned: new Set(mentions.map((m) => m.entity)).size,
    entities_mentioned_without_any_participation: new Set(
      mentions.filter((m) => !linkedEntities.has(m.entity)).map((m) => m.entity),
    ).size,
    rows: mentions,
  };
}

// ---------------------------------------------------------------------------
// FABLE_D §9.1 — tasks answered from the public exports only

const bytesOf = (files: ExportFile[], ...paths: string[]) =>
  paths.reduce((sum, p) => sum + Buffer.byteLength(files.find((f) => f.path === p)?.text ?? ""), 0);

/**
 * E7 — independent roots behind the `EXT` events (A §4.7), computed only from
 * the `derived_from`/`relies_on` fields of the source records (B17), never
 * from the `publisher` text. A reference without a determined genealogy
 * counts as its own root, so until the fields are filled this equals the
 * single-reference count; `genealogy_coverage` says how far that holds.
 */
export function e7IndependentRoots(dataset: Dataset) {
  const external = (refs: string[]) => refs.filter((s) => !CORPUS_SOURCE.test(s));
  const events = dataset.events
    .filter((e) => e.id.startsWith("EXT-") && external(e.sources).length > 0)
    .sort(byId)
    .map((e) => ({ id: e.id, ...independentRoots(external(e.sources), dataset.sources) }));
  const externalSources = dataset.sources.filter((s) => !CORPUS_SOURCE.test(s.id));
  const withGenealogy = externalSources.filter(
    (s) => s.origin_type || s.derived_from?.length || s.relies_on?.length,
  );
  return {
    method: "derived_from/relies_on closure; no publisher-text heuristics",
    ext_events_with_external_refs: events.length,
    single_reference: events.filter((e) => e.references.length === 1).length,
    single_root: events.filter((e) => e.roots.length === 1).length,
    single_root_ids: events.filter((e) => e.roots.length === 1).map((e) => e.id),
    apparent_multiplicity: events
      .filter((e) => e.references.length > e.roots.length)
      .map((e) => ({ id: e.id, references: e.references.length, roots: e.roots.length })),
    genealogy_coverage: {
      external_sources: externalSources.length,
      with_genealogy: withGenealogy.length,
      corpus_sources_with_origin_type: dataset.sources.filter(
        (s) => CORPUS_SOURCE.test(s.id) && s.origin_type,
      ).length,
    },
    e1_corpus_only: {
      events: corpusOnlyE1(dataset.events, dataset.sources),
      relationships: corpusOnlyE1(dataset.relationships, dataset.sources),
    },
  };
}

function parse<T>(files: ExportFile[], path: string): T {
  const file = files.find((f) => f.path === path);
  if (!file) throw new Error(`export ${path} missing`);
  return JSON.parse(file.text) as T;
}

export type PageScan = { pages: number; json_ld: number; canonical: number; time: number };

/** Count structured-data markers in built HTML pages (T11). */
export function scanPages(pages: string[]): PageScan {
  return {
    pages: pages.length,
    json_ld: pages.filter((html) => html.includes('type="application/ld+json"')).length,
    canonical: pages.filter((html) => /<link[^>]+rel="canonical"/.test(html)).length,
    time: pages.filter((html) => html.includes("<time")).length,
  };
}

export function dTasks(
  files: ExportFile[],
  options: { commitDate: string | null; pages: PageScan | null },
) {
  const all = parse<Dataset>(files, "all.json");
  const graph = parse<{ edges: (Edge & { caveat: unknown })[] }>(files, "graph.json");
  const withheld = parse<{ id: string }[]>(files, "withheld.json");
  const relEdges = all.relationships.map((r) => ({
    id: r.id,
    source: r.subject,
    target: r.object,
  }));
  const relById = new Map(all.relationships.map((r) => [r.id, r]));
  const hasHypothesis = (id: string) => all.hypotheses.some((h) => h.id === id);

  const t1Path = shortestPath(relEdges, "KERIMOV", "SPACEX");
  const t1bPath = shortestPath(graph.edges, "KERIMOV", "SPACEX");
  const graphById = new Map(graph.edges.map((e) => [e.id, e]));

  const tl59 = all.relationships
    .filter((r) => r.subject === "TL-0059" || r.object === "TL-0059")
    .sort(byId)
    .map((r) => ({
      id: r.id,
      subject: r.subject,
      predicate: r.predicate,
      evidence_level: r.evidence_level,
      evidence_status: r.evidence_status,
    }));

  const gillEvents = [
    ...new Set(
      all.relationships
        .filter((r) => r.subject === "GILL" || r.object === "GILL")
        .flatMap((r) => [r.subject, r.object, ...r.events])
        .filter((id) => all.events.some((e) => e.id === id)),
    ),
  ].sort();

  const g10 = relById.get("G-0010");
  const sourceById = new Map(all.sources.map((s) => [s.id, s]));

  const corrections = Object.values(all)
    .flat()
    .filter((r) => r.review.notes.some((n) => /rettific|corregg|correz|corrett/i.test(n))).length;

  const latestEvent =
    all.events
      .map((e) => e.date.start)
      .sort()
      .at(-1) ?? null;
  const gapDays =
    latestEvent && options.commitDate
      ? Math.floor(
          (Date.parse(options.commitDate.slice(0, 10)) -
            Date.parse(latestEvent.padEnd(10, "-01"))) /
            86_400_000,
        )
      : null;

  const relationshipSchema = parse<unknown>(files, "schemas/relationships.schema.json");
  const descriptions = JSON.stringify(relationshipSchema).match(/"description":/g)?.length ?? 0;

  return {
    scope:
      "computed from the in-memory public exports of this commit (no network); T9 needs a live search index",
    T1: {
      question: "documented chain KERIMOV -> SPACEX via relationships.json",
      bytes: bytesOf(files, "relationships.json", "entities.json"),
      path: t1Path,
      edges_with_caveat: (t1Path ?? []).filter((id) => relById.get(id)?.caveat).length,
      edges_with_negative_caveat: (t1Path ?? []).filter((id) => {
        const r = relById.get(id);
        return r ? isNegativeCaveat(r) : false;
      }).length,
      h06_published: hasHypothesis("H06"),
    },
    T1b: {
      question: "same chain via graph.json",
      bytes: bytesOf(files, "graph.json"),
      path: t1bPath,
      edges_with_caveat: (t1bPath ?? []).filter((id) => graphById.get(id)?.caveat).length,
    },
    T2: {
      question: "role of Russia in TL-0059",
      bytes: bytesOf(files, "events.json", "relationships.json"),
      relationships: tl59,
    },
    T3: {
      question: "Gill case chronology",
      bytes: bytesOf(files, "events.json", "relationships.json"),
      events: gillEvents,
    },
    T4: {
      question: "independent sources of G-0010",
      bytes: bytesOf(files, "relationships.json", "sources.json"),
      published: g10 !== undefined,
      sources: (g10?.sources ?? []).map((id) => ({
        id,
        urls: sourceById.get(id)?.urls.length ?? 0,
      })),
      primary_url: g10?.primary_url ?? null,
      f02_cited: g10?.sources.includes("F02") ?? false,
    },
    T5: {
      question: "compare H06 and H08",
      bytes: bytesOf(files, "hypotheses.json", "withheld.json"),
      h06_published: hasHypothesis("H06"),
      h08_published: hasHypothesis("H08"),
      h08_in_withheld_registry: withheld.some((w) => w.id === "H08"),
    },
    T6: {
      question: "corrections (text search in review notes)",
      bytes: bytesOf(files, "all.json"),
      records_with_correction_note: corrections,
    },
    T7: {
      question: "data freshness",
      commit_date: options.commitDate,
      latest_public_event_start: latestEvent,
      gap_days: gapDays,
      freshness_field_in_exports: files.some((f) => f.path === "index.json"),
    },
    T8: {
      question: "meaning of E2",
      bytes: bytesOf(files, "schemas/relationships.schema.json"),
      schema_descriptions: descriptions,
      vocabulary_export: files.some((f) => f.path === "vocabulary.json"),
    },
    T9: { question: "search 'Kerimov finanzia SpaceX'", status: "not_measured_offline" },
    T10: {
      question: "per-record endpoint",
      per_record_exports: files.filter((f) => f.path.startsWith("records/")).length,
    },
    T11: {
      question: "structured data in built pages",
      ...(options.pages ?? { status: "not_measured: run pnpm build first" }),
    },
    context_sizes: contextSizes(files),
  };
}

/** D §9.1 context-size table, from all.json. */
export function contextSizes(files: ExportFile[]) {
  const all = parse<Record<string, Record<string, unknown>[]>>(files, "all.json");
  const strip = (keys: string[]) =>
    Object.fromEntries(
      Object.entries(all).map(([name, records]) => [
        name,
        records.map((r) =>
          Object.fromEntries(Object.entries(r).filter(([k]) => !keys.includes(k))),
        ),
      ]),
    );
  const italianOnly = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(italianOnly);
    if (value && typeof value === "object") {
      const entries = Object.entries(value);
      if (
        entries.length > 0 &&
        entries.some(([k]) => k === "it") &&
        entries.every(([k]) => k.length === 2)
      ) {
        return (value as { it: unknown }).it;
      }
      return Object.fromEntries(entries.map(([k, v]) => [k, italianOnly(v)]));
    }
    return value;
  };
  return {
    all_json_published_bytes: bytesOf(files, "all.json"),
    minified_chars: JSON.stringify(all).length,
    without_provenance_chars: JSON.stringify(strip(["provenance"])).length,
    italian_only_without_provenance_review_chars: JSON.stringify(
      italianOnly(strip(["provenance", "review"])),
    ).length,
  };
}
