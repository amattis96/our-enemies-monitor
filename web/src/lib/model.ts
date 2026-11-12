import { publishedDataset } from "../../../src/site/publication.ts";
import { buildReadModel, loadReadModel, type ReadModel } from "../../../src/site/read-model.ts";

let model: ReadModel | undefined;

/** The read model, loaded and validated once per build. */
export function getModel(): ReadModel {
  model ??= buildReadModel(publishedDataset(loadReadModel().dataset));
  return model;
}
