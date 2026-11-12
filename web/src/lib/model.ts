import type { Article } from "../../../src/model/index.ts";
import { articleBacklinks, loadPublishedArticles } from "../../../src/site/articles.ts";
import { publishedDataset } from "../../../src/site/publication.ts";
import { buildReadModel, loadReadModel, type ReadModel } from "../../../src/site/read-model.ts";

let model: ReadModel | undefined;
let articles: Article[] | undefined;
let backlinks: Map<string, Article[]> | undefined;

/** The read model, loaded and validated once per build. */
export function getModel(): ReadModel {
  model ??= buildReadModel(publishedDataset(loadReadModel().dataset));
  return model;
}

/** Public editorial articles (validated, publication gate applied), newest first. */
export function getArticles(): Article[] {
  articles ??= loadPublishedArticles(loadReadModel().dataset);
  return articles;
}

/** Public articles that link a record ID. */
export function articlesLinking(id: string): Article[] {
  backlinks ??= articleBacklinks(getArticles());
  return backlinks.get(id) ?? [];
}
