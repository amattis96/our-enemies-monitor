import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { COLLECTION_NAMES, COLLECTIONS, TRANSLATION_STATUSES } from "../model/index.ts";
import { readDataFiles } from "../pipeline/load.ts";
import { DATA_DIR } from "../pipeline/paths.ts";
import { serializeRecord } from "../pipeline/serialize.ts";
import { localizedTexts, sourceHash, translationProblem } from "../pipeline/translations.ts";

// English translation workflow, deduplicated by Italian text.
//
//   pnpm i18n:export <file.json>                 untranslated or stale Italian texts → { "it": "" }
//   pnpm i18n:import <file.json> [--status machine|reviewed]
//                                                apply { "it": "en" } to every matching text
//
// A record gets review.translations.en only when all its texts are
// translated; its source_hash then fingerprints the Italian it came from.

type DataRecord = { id: string; review: { translations?: object } } & object;

const [command, file] = process.argv.slice(2);
if (!command || !file || !["export", "import"].includes(command)) {
  console.error("usage: i18n export|import <file.json> [--status machine|reviewed]");
  process.exit(2);
}

const records = readDataFiles().map((dataFile) => ({
  dataFile,
  record: COLLECTIONS[dataFile.collection].parse(JSON.parse(dataFile.text)) as DataRecord,
}));

if (command === "export") {
  const pending = new Map<string, string>();
  for (const { record } of records) {
    const stale = translationProblem(record as never) !== null;
    for (const text of localizedTexts(record)) {
      if (text.en === undefined || stale) pending.set(text.it, "");
    }
  }
  const sorted = Object.fromEntries([...pending].sort(([a], [b]) => a.localeCompare(b, "it")));
  writeFileSync(file, `${JSON.stringify(sorted, null, 2)}\n`);
  const words = [...pending.keys()].join(" ").split(/\s+/).length;
  console.log(`Exported ${pending.size} unique Italian texts (${words} words) to ${file}`);
} else {
  const statusFlag = process.argv.indexOf("--status");
  const status = (statusFlag > 0 ? process.argv[statusFlag + 1] : "machine") as "machine";
  if (!TRANSLATION_STATUSES.includes(status)) throw new Error(`invalid --status ${status}`);
  const memory = new Map(
    Object.entries(JSON.parse(readFileSync(file, "utf8")) as Record<string, string>).filter(
      ([, en]) => typeof en === "string" && en.trim() !== "",
    ),
  );
  let complete = 0;
  let partial = 0;
  for (const { dataFile, record } of records) {
    let changed = false;
    for (const text of localizedTexts(record)) {
      const en = memory.get(text.it);
      if (en !== undefined && text.en !== en) {
        text.en = en;
        changed = true;
      }
    }
    const texts = localizedTexts(record);
    if (texts.length === 0) continue;
    if (texts.every((t) => t.en !== undefined)) {
      const review = record.review as { translations?: { en?: object } };
      const state = { status, source_hash: sourceHash(record) };
      if (JSON.stringify(review.translations?.en) !== JSON.stringify(state)) {
        review.translations = { ...review.translations, en: state };
        changed = true;
      }
      complete++;
    } else if (texts.some((t) => t.en !== undefined)) {
      partial++;
    }
    if (changed) {
      const parsed = COLLECTIONS[dataFile.collection].parse(record);
      writeFileSync(path.join(DATA_DIR, dataFile.path), serializeRecord(parsed));
    }
  }
  console.log(
    `${complete} record(s) fully translated, ${partial} partially translated (not marked).`,
    `Collections: ${COLLECTION_NAMES.join(", ")}`,
  );
}
