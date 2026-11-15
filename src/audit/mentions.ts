import { z } from "zod";
import type { Dataset } from "../model/index.ts";

/**
 * B14 text-graph queue. Pure, read-only. Finds entity names in the Italian
 * title/description of events without a participation edge (the FABLE A §4.6
 * matcher, shared with the B12 baseline E6) and joins them with a versioned
 * exclusion list and a review file. A mention is a candidate for human
 * review, never evidence of a relationship; nothing here writes to `data/`.
 */

export const MENTIONS_REPORT_VERSION = 1;

export const MENTION_OUTCOMES = [
  "documented-role",
  "context-only",
  "false-positive",
  "needs-evidence",
] as const;
export type MentionOutcome = (typeof MENTION_OUTCOMES)[number];

const byId = <T extends { id: string }>(a: T, b: T) => a.id.localeCompare(b.id);
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const foldText = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Mn}/gu, "");

/** Folded text plus, for every folded UTF-16 unit, the offset in the original. */
function foldWithMap(source: string): { text: string; map: number[] } {
  let text = "";
  const map: number[] = [];
  let offset = 0;
  for (const ch of source) {
    const folded = foldText(ch);
    for (let i = 0; i < folded.length; i++) map.push(offset);
    text += folded;
    offset += ch.length;
  }
  return { text, map };
}

type Pair = [string, string];

/** (entity, event) pairs joined by an `event_participation` relationship. */
export function participationEdges(dataset: Dataset): Pair[] {
  const events = new Set(dataset.events.map((e) => e.id));
  const entities = new Set(dataset.entities.map((e) => e.id));
  const edges: Pair[] = [];
  for (const r of [...dataset.relationships].sort(byId)) {
    if (r.relation_class !== "event_participation") continue;
    const [entity, event] = events.has(r.subject) ? [r.object, r.subject] : [r.subject, r.object];
    if (entities.has(entity) && events.has(event)) edges.push([entity, event]);
  }
  return edges;
}

/** Folded name segments (split on `/ ( ) , ;`) of at least 5 characters. */
export function entitySegments(name: string): string[] {
  return name
    .split(/\s*\/\s*|\(|\)|,|;/)
    .map((p) => foldText(p).trim())
    .filter((p) => p.length >= 5);
}

export type RawMention = {
  event: string;
  entity: string;
  /** Folded name segment that matched (first in name order). */
  segment: string;
  field: "title" | "description";
  /** Original-text excerpt around the match. */
  snippet: string;
};

const SNIPPET_CONTEXT = 70;

function excerpt(original: string, start: number, end: number): string {
  const from = Math.max(0, start - SNIPPET_CONTEXT);
  const to = Math.min(original.length, end + SNIPPET_CONTEXT);
  const body = original.slice(from, to).replace(/\s+/g, " ").trim();
  return `${from > 0 ? "…" : ""}${body}${to < original.length ? "…" : ""}`;
}

/**
 * Every (event, entity) whose name matches the event text and that has no
 * participation edge. `skip` holds `entity|segment` keys removed from the
 * lexicon (the versioned exclusion list). With an empty `skip` the pairs are
 * exactly those of the B12 E6 measurement.
 */
export function scanMentions(
  dataset: Dataset,
  skip: ReadonlySet<string> = new Set(),
): RawMention[] {
  const linked = new Map<string, Set<string>>();
  for (const [entity, event] of participationEdges(dataset)) {
    const set = linked.get(event) ?? new Set();
    set.add(entity);
    linked.set(event, set);
  }
  const lexicon = [...dataset.entities].sort(byId).map((entity) => ({
    id: entity.id,
    patterns: entitySegments(entity.name.it)
      .filter((segment) => !skip.has(`${entity.id}|${segment}`))
      .map((segment) => ({
        segment,
        re: new RegExp(`(?<![a-z0-9])${escapeRegExp(segment)}(?![a-z0-9])`),
      })),
  }));
  const mentions: RawMention[] = [];
  for (const event of [...dataset.events].sort(byId)) {
    const original = `${event.title.it} ${event.description.it}`;
    const { text, map } = foldWithMap(original);
    const titleEnd = foldText(event.title.it).length;
    for (const { id, patterns } of lexicon) {
      if (linked.get(event.id)?.has(id)) continue;
      for (const { segment, re } of patterns) {
        const hit = re.exec(text);
        if (!hit) continue;
        const start = map[hit.index] ?? 0;
        const last = map[hit.index + hit[0].length - 1] ?? original.length - 1;
        mentions.push({
          event: event.id,
          entity: id,
          segment,
          field: hit.index < titleEnd ? "title" : "description",
          snippet: excerpt(original, start, last + 1),
        });
        break;
      }
    }
  }
  return mentions;
}

// ---------------------------------------------------------------------------
// Versioned input files

export const MentionExclusionsSchema = z.strictObject({
  version: z.number().int().positive(),
  notes: z.array(z.string()),
  /** Folded name segments removed from one entity's lexicon (generic words). */
  segments: z.array(
    z.strictObject({
      entity: z.string().min(1),
      segment: z.string().min(5),
      reason: z.string().min(1),
    }),
  ),
});
export type MentionExclusions = z.infer<typeof MentionExclusionsSchema>;

export const MentionReviewEntrySchema = z
  .strictObject({
    event: z.string().min(1),
    entity: z.string().min(1),
    outcome: z.enum(MENTION_OUTCOMES),
    /** `proposta` = unreviewed suggestion; `revisionata` = a named human confirmed it. */
    state: z.enum(["proposta", "revisionata"]),
    proposed_by: z.string().min(1),
    note: z.string().min(1),
    reviewer: z.string().min(1).optional(),
    reviewed_on: z.iso.date().optional(),
  })
  .superRefine((entry, ctx) => {
    const human = entry.reviewer !== undefined || entry.reviewed_on !== undefined;
    if (entry.state === "proposta" && human) {
      ctx.addIssue({ code: "custom", message: "a proposta must not carry reviewer/reviewed_on" });
    }
    if (entry.state === "revisionata" && (!entry.reviewer || !entry.reviewed_on)) {
      ctx.addIssue({ code: "custom", message: "revisionata requires reviewer and reviewed_on" });
    }
  });

export const MentionReviewSchema = z.strictObject({
  review_set: z.literal("text-graph-mentions"),
  version: z.number().int().positive(),
  as_of_commit: z.string().min(7),
  notes: z.array(z.string()),
  entries: z.array(MentionReviewEntrySchema),
});
export type MentionReview = z.infer<typeof MentionReviewSchema>;
export type MentionReviewEntry = z.infer<typeof MentionReviewEntrySchema>;

// ---------------------------------------------------------------------------
// Report

const keyOf = (event: string, entity: string) => `${event}|${entity}`;

/** 95 % Wilson score interval, in percent rounded to one decimal. */
export function wilson95(k: number, n: number): [number, number] | null {
  if (n === 0) return null;
  const z = 1.96;
  const p = k / n;
  const denom = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  const pct = (x: number) => Math.round(Math.min(1, Math.max(0, x)) * 1000) / 10;
  return [pct(centre - half), pct(centre + half)];
}

export type QueueRow = RawMention & {
  entity_kind: string;
  entity_name: string;
  entity_relationships: number;
  /** Relationship IDs that touch the entity and cite the event in `events`. */
  edges_citing_event: string[];
  review: Pick<MentionReviewEntry, "outcome" | "state" | "note"> | null;
};

export function buildMentionReport(
  dataset: Dataset,
  exclusions: MentionExclusions,
  review: MentionReview,
) {
  const skip = new Set(exclusions.segments.map((e) => `${e.entity}|${e.segment}`));
  const raw = scanMentions(dataset);
  const kept = scanMentions(dataset, skip);
  const keptKeys = new Set(kept.map((m) => keyOf(m.event, m.entity)));

  const entities = new Map(dataset.entities.map((e) => [e.id, e]));
  const reasons = new Map(exclusions.segments.map((e) => [`${e.entity}|${e.segment}`, e.reason]));
  const excluded = raw
    .filter((m) => !keptKeys.has(keyOf(m.event, m.entity)))
    .map((m) => ({
      event: m.event,
      entity: m.entity,
      segment: m.segment,
      reason: reasons.get(`${m.entity}|${m.segment}`) ?? "",
    }));

  const unusedExclusions = exclusions.segments
    .filter((e) => {
      const entity = entities.get(e.entity);
      return !entity || !entitySegments(entity.name.it).includes(e.segment);
    })
    .map((e) => `${e.entity}|${e.segment}`);

  const reviews = new Map(review.entries.map((e) => [keyOf(e.event, e.entity), e]));
  const relationshipCount = new Map<string, number>();
  for (const r of dataset.relationships) {
    for (const end of new Set([r.subject, r.object])) {
      relationshipCount.set(end, (relationshipCount.get(end) ?? 0) + 1);
    }
  }
  const citing = (event: string, entity: string) =>
    dataset.relationships
      .filter((r) => (r.subject === entity || r.object === entity) && r.events.includes(event))
      .map((r) => r.id)
      .sort();

  const queue: QueueRow[] = kept.map((m) => {
    const entity = entities.get(m.entity);
    const entry = reviews.get(keyOf(m.event, m.entity));
    return {
      ...m,
      entity_kind: entity?.kind ?? "unknown",
      entity_name: entity?.name.it ?? m.entity,
      entity_relationships: relationshipCount.get(m.entity) ?? 0,
      edges_citing_event: citing(m.event, m.entity),
      review: entry ? { outcome: entry.outcome, state: entry.state, note: entry.note } : null,
    };
  });

  const queueKeys = new Set(queue.map((r) => keyOf(r.event, r.entity)));
  const orphanReviews = review.entries
    .filter((e) => !queueKeys.has(keyOf(e.event, e.entity)))
    .map((e) => keyOf(e.event, e.entity));
  const sample = queue.flatMap((r) => (r.review ? [r.review] : []));
  const count = (pred: (r: NonNullable<QueueRow["review"]>) => boolean) =>
    sample.filter(pred).length;
  const byOutcome = Object.fromEntries(
    MENTION_OUTCOMES.map((o) => [o, count((r) => r.outcome === o)]),
  ) as Record<MentionOutcome, number>;
  const rate = (k: number) => ({
    k,
    n: sample.length,
    percent: sample.length ? Math.round((k / sample.length) * 1000) / 10 : null,
    wilson95_percent: wilson95(k, sample.length),
  });
  const countBy = (pick: (r: QueueRow) => string) => {
    const out: Record<string, number> = {};
    for (const row of queue) out[pick(row)] = (out[pick(row)] ?? 0) + 1;
    return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
  };
  const isolated = new Set(queue.filter((r) => r.entity_relationships === 0).map((r) => r.entity));

  return {
    report_version: MENTIONS_REPORT_VERSION,
    matcher:
      "FABLE A §4.6 / B12 E6 matcher: entity-name segments >= 5 chars (folded, whole word) in event title + description, minus participation edges; lexicon minus the versioned exclusion list",
    exclusions_version: exclusions.version,
    review_version: review.version,
    review_notes: review.notes,
    caveat:
      "A mention is not a role: every row is a candidate for human review, not a missing edge. Review outcomes marked `proposta` are unreviewed suggestions.",
    summary: {
      raw_mentions: raw.length,
      excluded_mentions: excluded.length,
      queue: queue.length,
      events: new Set(queue.map((r) => r.event)).size,
      entities: new Set(queue.map((r) => r.entity)).size,
      entities_without_any_relationship: isolated.size,
      mentions_with_edge_citing_event: queue.filter((r) => r.edges_citing_event.length > 0).length,
      by_entity_kind: countBy((r) => r.entity_kind),
      by_review_state: {
        none: queue.filter((r) => !r.review).length,
        proposta: count((r) => r.state === "proposta"),
        revisionata: count((r) => r.state === "revisionata"),
      },
      unused_exclusions: unusedExclusions,
      orphan_reviews: orphanReviews,
    },
    sampled_precision: {
      scope:
        "rows of the queue that carry a review entry; `proposta` entries come from reading the record text only and are unreviewed",
      sample_size: sample.length,
      queue_size: queue.length,
      sampled_fraction_percent: queue.length
        ? Math.round((sample.length / queue.length) * 1000) / 10
        : null,
      by_outcome: byOutcome,
      not_false_positive: rate(sample.length - byOutcome["false-positive"]),
      documented_role: rate(byOutcome["documented-role"]),
    },
    queue,
    excluded,
  };
}

export type MentionReport = ReturnType<typeof buildMentionReport>;

const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();

export function renderMentionReportMarkdown(report: MentionReport, commit: string | null): string {
  const s = report.summary;
  const p = report.sampled_precision;
  const pct = (r: { k: number; n: number; percent: number | null; wilson95_percent: unknown }) =>
    r.n === 0
      ? "n/d"
      : `${r.k}/${r.n} = ${r.percent} % (intervallo di Wilson 95 %: ${(r.wilson95_percent as number[]).join("–")} %)`;
  const lines: string[] = [
    "# Coda testo–grafo: menzioni senza arco",
    "",
    "Rapporto generato da `pnpm audit:mentions` (sola lettura; nessuna scrittura in `data/`).",
    ...(commit ? [`Dati al commit \`${commit}\`.`, ""] : []),
    "> **Una menzione non è un ruolo.** Ogni riga è un candidato alla revisione umana, non un arco mancante né un fatto. Gli esiti marcati `proposta` sono suggerimenti non rivisti, ricavati dalla sola lettura del testo del record; solo gli esiti `revisionata` (con nome e data del revisore) sono stati confermati da una persona.",
    "",
    `Matcher: ${report.matcher}. Versione lista di esclusione: ${report.exclusions_version}; versione file di revisione: ${report.review_version}.`,
    "",
    "## Sintesi",
    "",
    "| Misura | Valore |",
    "| --- | --- |",
    `| Menzioni grezze (matcher senza esclusioni; equivale a E6 di B12) | ${s.raw_mentions} |`,
    `| Escluse dalla lista versionata | ${s.excluded_mentions} |`,
    `| **Coda di revisione** | **${s.queue}** in ${s.events} eventi, ${s.entities} entità |`,
    `| Entità in coda senza alcuna relazione | ${s.entities_without_any_relationship} |`,
    `| Menzioni in cui una relazione dell'entità cita già l'evento | ${s.mentions_with_edge_citing_event} |`,
    `| Per tipo di entità | ${Object.entries(s.by_entity_kind)
      .map(([k, v]) => `${k} ${v}`)
      .join(", ")} |`,
    `| Revisione: nessuna / proposta / revisionata | ${s.by_review_state.none} / ${s.by_review_state.proposta} / ${s.by_review_state.revisionata} |`,
    "",
    "## Precisione campionata",
    "",
    p.sample_size === 0
      ? "Nessuna riga è stata ancora classificata: la precisione non è misurabile."
      : `Campione: ${p.sample_size} righe su ${p.queue_size} (${p.sampled_fraction_percent} %), selezione descritta nelle note del file di revisione. Esiti: ${MENTION_OUTCOMES.map((o) => `${o} ${p.by_outcome[o]}`).join(", ")}.`,
    "",
    `- Menzione non falso positivo del matcher: ${pct(p.not_false_positive)}.`,
    `- Esito \`documented-role\` (candidata a un arco, ancora da verificare sulle fonti): ${pct(p.documented_role)}.`,
    "",
    "Con un campione di questa dimensione l'intervallo è largo; le percentuali valgono solo se gli esiti `proposta` fossero confermati e non si estendono con certezza al resto della coda (il campione non è casuale).",
    "",
    ...report.review_notes.map((note) => `- Nota del file di revisione: ${note}`),
    ...(report.review_notes.length ? [""] : []),
    "## Coda per evento",
    "",
    "| Evento | Entità | Tipo | Segmento | Dove | Frase | Relazioni | Esito |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const r of report.queue) {
    const rel = `${r.entity_relationships}${r.edges_citing_event.length ? ` (cita l'evento: ${r.edges_citing_event.join(", ")})` : ""}`;
    const outcome = r.review ? `${r.review.outcome} (${r.review.state})` : "da classificare";
    lines.push(
      `| ${r.event} | ${r.entity} «${cell(r.entity_name)}» | ${r.entity_kind} | ${cell(r.segment)} | ${r.field === "title" ? "titolo" : "descrizione"} | ${cell(r.snippet)} | ${rel} | ${outcome} |`,
    );
  }
  lines.push("", "## Note delle proposte", "");
  const noted = report.queue.filter((r) => r.review);
  if (noted.length === 0) lines.push("Nessuna proposta registrata.");
  for (const r of noted) {
    lines.push(
      `- ${r.event} / ${r.entity}: ${r.review?.outcome} (${r.review?.state}) — ${r.review?.note}`,
    );
  }
  lines.push("", "## Menzioni escluse dalla lista versionata", "");
  if (report.excluded.length === 0) lines.push("Nessuna.");
  else {
    lines.push("| Evento | Entità | Segmento escluso | Motivo |", "| --- | --- | --- | --- |");
    for (const e of report.excluded) {
      lines.push(`| ${e.event} | ${e.entity} | ${cell(e.segment)} | ${cell(e.reason)} |`);
    }
  }
  if (s.unused_exclusions.length > 0 || s.orphan_reviews.length > 0) {
    lines.push("", "## Anomalie", "");
    if (s.unused_exclusions.length > 0) {
      lines.push(
        `- Esclusioni che non corrispondono a un segmento reale: ${s.unused_exclusions.join(", ")}.`,
      );
    }
    if (s.orphan_reviews.length > 0) {
      lines.push(`- Revisioni su coppie non più in coda: ${s.orphan_reviews.join(", ")}.`);
    }
  }
  return `${lines.join("\n")}\n`;
}
