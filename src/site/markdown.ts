import type {
  Entity,
  Event,
  Exposure,
  Hypothesis,
  LocalizedText,
  Review,
  Source,
} from "../model/index.ts";
import type { ReadModel } from "./read-model.ts";

export type MarkdownCollection = "events" | "entities" | "hypotheses" | "sources" | "exposures";

function yamlString(value: string): string {
  return JSON.stringify(value);
}

function frontMatter(entries: [string, string | string[] | null | undefined][]): string {
  const lines = ["---"];
  for (const [key, value] of entries) {
    if (value === undefined) continue;
    if (value === null) {
      lines.push(`${key}: null`);
    } else if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${key}: []`);
      } else {
        lines.push(`${key}:`);
        for (const item of value) lines.push(`  - ${yamlString(item)}`);
      }
    } else {
      lines.push(`${key}: ${yamlString(value)}`);
    }
  }
  lines.push("---");
  return lines.join("\n");
}

function bilingualBlock(label: string, text: LocalizedText | null | undefined): string[] {
  if (!text) return [];
  const lines = [`## ${label}`, "", `- **it**: ${text.it}`];
  if (text.en) lines.push(`- **en**: ${text.en}`);
  lines.push("");
  return lines;
}

function reviewCaveat(review: Review): string {
  if (review.status === "imported_unreviewed") {
    return "Provisional imported record (`imported_unreviewed`): not yet independently verified.";
  }
  if (review.status === "reviewed") {
    return "Human-reviewed record (`reviewed`).";
  }
  return `Review status: \`${review.status}\`.`;
}

function sourcesSection(sourceIds: readonly string[], model: ReadModel): string[] {
  const publicIds = sourceIds.filter((id) => model.source(id) !== undefined);
  const lines = ["## Cited Sources", ""];
  if (publicIds.length === 0) {
    lines.push("- None cited.", "");
    return lines;
  }
  for (const id of publicIds) {
    const src = model.source(id);
    if (!src) continue;
    const urlPart = src.urls[0] ? ` (${src.urls[0]})` : "";
    lines.push(`- \`${id}\`: ${src.title.it}${urlPart}`);
  }
  lines.push("");
  return lines;
}

export function eventMarkdown(event: Event, model: ReadModel): string {
  const caveats = [reviewCaveat(event.review)];
  if (event.record_type === "dataset_metadata") {
    caveats.push("Dataset metadata entry (`dataset_metadata`), not a geopolitical event.");
  }
  if (event.timeline_status === "pending_integration") {
    caveats.push("Pending integration into the official timeline (`pending_integration`).");
  }
  if (event.evidence_note) {
    caveats.push(`Evidence note: ${event.evidence_note.it}`);
  }
  for (const issue of event.known_issues) {
    caveats.push(`Known issue (${issue.code}): ${issue.note.it}`);
  }

  const publicSources = event.sources.filter((id) => model.source(id) !== undefined);

  const fm = frontMatter([
    ["id", event.id],
    ["collection", "events"],
    ["record_type", event.record_type],
    ["timeline_status", event.timeline_status],
    ["date_start", event.date.start],
    ["date_end", event.date.end],
    ["date_precision", event.date.precision],
    ["evidence_level", event.evidence_level],
    ["review_status", event.review.status],
    ["canonical_language", "it"],
    ["sources", publicSources],
  ]);

  const lines = [
    fm,
    "",
    `# ${event.id} — ${event.title.it}`,
    "",
    ...(event.title.en ? [`_English title_: ${event.title.en}`, ""] : []),
    "## Essential Caveat",
    "",
    ...caveats.map((c) => `- ${c}`),
    "",
    "## Metadata",
    "",
    `- **Date**: ${event.date.start}${event.date.end ? ` .. ${event.date.end}` : ""} (${event.date.precision})`,
    `- **Themes**: ${event.themes.join(", ")}`,
    ...(event.geography ? [`- **Geography**: ${event.geography.it}`] : []),
    ...(event.places.length > 0 ? [`- **Places**: ${event.places.join(", ")}`] : []),
    ...(event.publisher ? [`- **Publisher**: ${event.publisher}`] : []),
    ...(event.url ? [`- **Reference URL**: ${event.url}`] : []),
    "",
    ...bilingualBlock("Description", event.description),
    ...bilingualBlock("Evidence Note", event.evidence_note),
    ...sourcesSection(publicSources, model),
  ];

  return `${lines.join("\n").trimEnd()}\n`;
}

export function entityMarkdown(entity: Entity, model: ReadModel): string {
  const rels = model.relationshipsOf(entity.id);
  const restrictedCount = rels.filter((r) => model.isRestricted(r)).length;
  const caveats = [reviewCaveat(entity.review)];
  if (restrictedCount > 0) {
    caveats.push(
      `${restrictedCount} restricted relationship(s) involving a named person without a registered primary source omit predicate and caveat.`,
    );
  }

  const fm = frontMatter([
    ["id", entity.id],
    ["collection", "entities"],
    ["kind", entity.kind],
    ["domain", entity.domain],
    ["country", entity.country],
    ["review_status", entity.review.status],
    ["canonical_language", "it"],
  ]);

  const lines = [
    fm,
    "",
    `# ${entity.id} — ${entity.name.it}`,
    "",
    ...(entity.name.en ? [`_English name_: ${entity.name.en}`, ""] : []),
    "## Essential Caveat",
    "",
    ...caveats.map((c) => `- ${c}`),
    "",
    "## Metadata",
    "",
    `- **Kind**: ${entity.kind}`,
    `- **Domain**: ${entity.domain}`,
    ...(entity.country ? [`- **Country**: ${entity.country}`] : []),
    "",
  ];

  const unrestricted = rels.filter((r) => !model.isRestricted(r));
  if (unrestricted.length > 0) {
    lines.push("## Unrestricted Relationships", "");
    for (const r of unrestricted) {
      const caveatSuffix = r.caveat ? ` — Caveat: ${r.caveat.it}` : "";
      lines.push(
        `- \`${r.id}\`: \`${r.subject}\` ${r.predicate} \`${r.object}\` (${r.evidence_level}/${r.evidence_status})${caveatSuffix}`,
      );
    }
    lines.push("");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

export function hypothesisMarkdown(hypothesis: Hypothesis, model: ReadModel): string {
  const publicSources = hypothesis.sources.filter((id) => model.source(id) !== undefined);
  const publicEvents = hypothesis.events.filter((id) => model.event(id) !== undefined);

  const fm = frontMatter([
    ["id", hypothesis.id],
    ["collection", "hypotheses"],
    ["hypothesis_type", hypothesis.hypothesis_type],
    ["evidence_level", "E5"],
    ["priority", hypothesis.priority],
    ["status", hypothesis.status],
    ["review_status", hypothesis.review.status],
    ["canonical_language", "it"],
    ["sources", publicSources],
  ]);

  const lines = [
    fm,
    "",
    `# ${hypothesis.id} — ${hypothesis.question.it}`,
    "",
    ...(hypothesis.question.en ? [`_English question_: ${hypothesis.question.en}`, ""] : []),
    "## Essential Caveat",
    "",
    `- Open verification question (\`E5\`), not an established fact.`,
    `- ${reviewCaveat(hypothesis.review)}`,
    `- Current limit: ${hypothesis.current_limit.it}`,
    "",
    "## Metadata",
    "",
    `- **Type**: ${hypothesis.hypothesis_type}`,
    `- **Subject**: ${hypothesis.subject}`,
    `- **Object**: ${hypothesis.object}`,
    `- **Priority**: ${hypothesis.priority}`,
    `- **Status**: ${hypothesis.status}`,
    ...(publicEvents.length > 0 ? [`- **Events**: ${publicEvents.join(", ")}`] : []),
    ...(hypothesis.external_url ? [`- **External URL**: ${hypothesis.external_url}`] : []),
    "",
    ...bilingualBlock("Current Limit", hypothesis.current_limit),
    ...bilingualBlock("Evidence Needed", hypothesis.evidence_needed),
    ...sourcesSection(publicSources, model),
  ];

  return `${lines.join("\n").trimEnd()}\n`;
}

export function sourceMarkdown(source: Source, model: ReadModel): string {
  const publicCitedIn = source.cited_in.filter((id) => model.source(id) !== undefined);
  const caveats = [
    reviewCaveat(source.review),
    "Cited third-party materials keep their own rights; appearing in the database does not imply endorsement.",
  ];
  if (!source.origin_type) {
    caveats.push("Origin type is not determined (absence must not be read as primary).");
  }

  const fm = frontMatter([
    ["id", source.id],
    ["collection", "sources"],
    ["type", source.type],
    ["origin_type", source.origin_type ?? null],
    ["review_status", source.review.status],
    ["canonical_language", "it"],
  ]);

  const lines = [
    fm,
    "",
    `# ${source.id} — ${source.title.it}`,
    "",
    ...(source.title.en ? [`_English title_: ${source.title.en}`, ""] : []),
    "## Essential Caveat",
    "",
    ...caveats.map((c) => `- ${c}`),
    "",
    "## Metadata",
    "",
    `- **Type**: ${source.type}`,
    ...(source.publisher ? [`- **Publisher**: ${source.publisher}`] : []),
    ...(source.origin_type ? [`- **Origin Type**: ${source.origin_type}`] : []),
    ...(publicCitedIn.length > 0 ? [`- **Cited In**: ${publicCitedIn.join(", ")}`] : []),
    ...(source.urls.length > 0 ? [`- **URLs**: ${source.urls.join(", ")}`] : []),
    "",
  ];

  return `${lines.join("\n").trimEnd()}\n`;
}

export function exposureMarkdown(exposure: Exposure, model: ReadModel): string {
  const publicSources = exposure.sources.filter((id) => model.source(id) !== undefined);

  const fm = frontMatter([
    ["id", exposure.id],
    ["collection", "exposures"],
    ["status", exposure.status],
    ["review_status", exposure.review.status],
    ["canonical_language", "it"],
    ["sources", publicSources],
  ]);

  const lines = [
    fm,
    "",
    `# ${exposure.id} — ${exposure.sector.it}: ${exposure.indicator.it}`,
    "",
    "## Essential Caveat",
    "",
    `- ${reviewCaveat(exposure.review)}`,
    `- Status: \`${exposure.status}\` (observed value vs planned target).`,
    `- Scope: ${exposure.scope.it} (values from different universes are not comparable).`,
    "",
    "## Measures",
    "",
    ...exposure.measures.map((m) => {
      const denom = m.out_of !== null ? ` / ${m.out_of}` : "";
      const period = m.period !== null ? ` (${m.period})` : "";
      return `- **${m.label.it}**: ${m.value}${denom} ${m.unit} [${m.qualifier}]${period}`;
    }),
    "",
    ...bilingualBlock("Scope", exposure.scope),
    ...bilingualBlock("Consequence", exposure.consequence),
    ...sourcesSection(publicSources, model),
  ];

  return `${lines.join("\n").trimEnd()}\n`;
}

export function recordMarkdown(
  collection: MarkdownCollection,
  id: string,
  model: ReadModel,
): string | null {
  switch (collection) {
    case "events": {
      const record = model.event(id);
      return record ? eventMarkdown(record, model) : null;
    }
    case "entities": {
      const record = model.entity(id);
      return record ? entityMarkdown(record, model) : null;
    }
    case "hypotheses": {
      const record = model.hypothesis(id);
      return record ? hypothesisMarkdown(record, model) : null;
    }
    case "sources": {
      const record = model.source(id);
      return record ? sourceMarkdown(record, model) : null;
    }
    case "exposures": {
      const record = model.dataset.exposures.find((e) => e.id === id);
      return record ? exposureMarkdown(record, model) : null;
    }
  }
}
