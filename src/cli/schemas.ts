import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { COLLECTIONS } from "../model/index.ts";
import { SCHEMAS_DIR } from "../pipeline/paths.ts";

// Generate JSON Schema for each collection from the Zod model.
// With --check, fail instead of writing when the files are stale.
const check = process.argv.includes("--check");

const expected = new Map(
  Object.entries(COLLECTIONS).map(([collection, schema]) => {
    const json = z.toJSONSchema(schema, { target: "draft-2020-12", io: "input" });
    const document = {
      $schema: json.$schema,
      $id: `${collection}.schema.json`,
      title: collection,
      ...json,
    };
    return [`${collection}.schema.json`, `${JSON.stringify(document, null, 2)}\n`];
  }),
);

if (check) {
  const actual = new Map<string, string>();
  try {
    for (const name of readdirSync(SCHEMAS_DIR)) {
      actual.set(name, readFileSync(path.join(SCHEMAS_DIR, name), "utf8"));
    }
  } catch {}
  const stale = [...new Set([...expected.keys(), ...actual.keys()])].filter(
    (name) => expected.get(name) !== actual.get(name),
  );
  if (stale.length > 0) {
    console.error(`Stale JSON Schema files (run pnpm schemas): ${stale.join(", ")}`);
    process.exit(1);
  }
  console.log("JSON Schema files are up to date");
} else {
  rmSync(SCHEMAS_DIR, { recursive: true, force: true });
  mkdirSync(SCHEMAS_DIR, { recursive: true });
  for (const [name, text] of expected) writeFileSync(path.join(SCHEMAS_DIR, name), text);
  console.log(`Wrote ${expected.size} schema(s) to ${SCHEMAS_DIR}`);
}
