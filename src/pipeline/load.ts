import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { COLLECTION_NAMES, type CollectionName, type Dataset } from "../model/index.ts";
import { DATA_DIR } from "./paths.ts";
import { serializeRecord } from "./serialize.ts";

/** A data file as stored on disk, before parsing. */
export type DataFile = {
  collection: CollectionName;
  /** Path relative to the data directory, e.g. `events/TL-0001.json`. */
  path: string;
  text: string;
};

export function readDataFiles(dataDir = DATA_DIR): DataFile[] {
  return COLLECTION_NAMES.flatMap((collection) => {
    let names: string[];
    try {
      names = readdirSync(path.join(dataDir, collection));
    } catch {
      return [];
    }
    return names
      .filter((name) => name.endsWith(".json"))
      .sort()
      .map((name) => ({
        collection,
        path: `${collection}/${name}`,
        text: readFileSync(path.join(dataDir, collection, name), "utf8"),
      }));
  });
}

/** Serialize a dataset into data files (canonical form, one per record). */
export function datasetToFiles(dataset: Dataset): DataFile[] {
  return COLLECTION_NAMES.flatMap((collection) =>
    dataset[collection].map((record) => ({
      collection,
      path: `${collection}/${record.id}.json`,
      text: serializeRecord(record),
    })),
  );
}

/** Replace the collections in `dataDir` with exactly these files. */
export function writeDataFiles(files: DataFile[], dataDir = DATA_DIR): void {
  for (const collection of COLLECTION_NAMES) {
    rmSync(path.join(dataDir, collection), { recursive: true, force: true });
    mkdirSync(path.join(dataDir, collection), { recursive: true });
  }
  for (const file of files) writeFileSync(path.join(dataDir, file.path), file.text);
}
