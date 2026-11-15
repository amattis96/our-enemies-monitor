import type { Article, Dataset } from "../model/index.ts";

/** Lexical hints only: no role or relationship is inferred from a mention. */
export function articleMentionWarnings(article: Article, publicData: Dataset): string[] {
  if (
    article.links.events.length ||
    article.links.relationships.length ||
    article.links.hypotheses.length
  )
    return [];
  const eventIds = new Set(publicData.events.map((e) => e.id));
  const linked = new Set<string>();
  for (const relation of publicData.relationships) {
    if (relation.events.some((id) => eventIds.has(id))) {
      linked.add(relation.subject);
      linked.add(relation.object);
    }
    if (eventIds.has(relation.subject)) linked.add(relation.object);
    if (eventIds.has(relation.object)) linked.add(relation.subject);
  }
  const text = [
    article.title.it,
    article.title.en,
    article.summary.it,
    article.summary.en,
    article.body.it,
    article.body.en,
  ]
    .filter(Boolean)
    .join("\n");
  const matches = (term: string, sensitive: boolean) => {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(
      `(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`,
      sensitive ? "u" : "iu",
    ).test(text);
  };
  return publicData.entities
    .filter(
      (entity) =>
        linked.has(entity.id) &&
        ((entity.id.length >= 3 && matches(entity.id, true)) ||
          [entity.name.it, entity.name.en].some(
            (name) => name && name.length >= 4 && matches(name, false),
          )),
    )
    .map((e) => e.id)
    .sort();
}
