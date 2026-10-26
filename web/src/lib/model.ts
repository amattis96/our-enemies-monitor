import { loadReadModel, type ReadModel } from "../../../src/site/read-model.ts";

let model: ReadModel | undefined;

/** The read model, loaded and validated once per build. */
export function getModel(): ReadModel {
  model ??= loadReadModel();
  return model;
}
