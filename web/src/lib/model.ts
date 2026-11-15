import { readInferenceRegistry } from "../../../src/editorial/inferences.ts";
import type { Article } from "../../../src/model/index.ts";
import { articleBacklinks, loadPublishedArticles } from "../../../src/site/articles.ts";
import { type CounterInferenceAudit, counterInferenceAudit } from "../../../src/site/inferences.ts";
import { type PublicationReport, publicationReport } from "../../../src/site/publication.ts";
import { buildReadModel, loadReadModel, type ReadModel } from "../../../src/site/read-model.ts";
import { buildTraces, type Trace } from "../../../src/site/trace.ts";

let publication: PublicationReport | undefined;
let model: ReadModel | undefined;
let articles: Article[] | undefined;
let backlinks: Map<string, Article[]> | undefined;
let inferences: CounterInferenceAudit | undefined;
let traces: Trace[] | undefined;

/** The authoritative report retains accounting from the validated canonical dataset. */
export function getPublication(): PublicationReport {
  publication ??= publicationReport(loadReadModel().dataset);
  return publication;
}

/** The read model, loaded and validated once per build. */
export function getModel(): ReadModel {
  model ??= buildReadModel(getPublication().dataset);
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

/** B15 counter-inference audit of the public graph, computed once per build. */
export function getInferenceAudit(): CounterInferenceAudit {
  inferences ??= counterInferenceAudit(readInferenceRegistry(), getModel());
  return inferences;
}

/** B16 traces of the sensitive pairs (hypothesis endpoints), computed once per build. */
export function getTraces(): Trace[] {
  traces ??= buildTraces(readInferenceRegistry(), getModel(), getInferenceAudit());
  return traces;
}
