import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { localizedTexts } from "../src/pipeline/translations.ts";

const root = process.cwd();
const temps: string[] = [];
afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true });
});
function setup() {
  const dir = mkdtempSync(path.join(os.tmpdir(), "b06-cli-"));
  temps.push(dir);
  cpSync(path.join(root, "data"), path.join(dir, "data"), { recursive: true });
  cpSync(path.join(root, "sources"), path.join(dir, "sources"), {
    recursive: true,
  });
  cpSync(path.join(root, "docs/audit"), path.join(dir, "docs/audit"), { recursive: true });
  const file = path.join(dir, "data/events/TL-0001.json");
  writeFileSync(file, readFileSync(path.join(root, "data/events/TL-0001.json")));
  return { dir, file, input: path.join(dir, "input.json") };
}
function run(dir: string, cli: string, ...args: string[]) {
  return spawnSync(process.execPath, [path.join(root, `src/cli/${cli}.ts`), ...args], {
    env: { ...process.env, OEM_REPO_ROOT: dir },
    encoding: "utf8",
  });
}
describe("translation CLI", () => {
  it("leaves empty and partial imports untouched and applies a complete dictionary", () => {
    const { dir, file, input } = setup();
    const record = JSON.parse(readFileSync(file, "utf8"));
    record.title.it += " changed";
    writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`);
    const before = readFileSync(file, "utf8");
    writeFileSync(input, "{}");
    expect(run(dir, "i18n", "import", input).status).toBe(0);
    expect(readFileSync(file, "utf8")).toBe(before);
    const texts = localizedTexts(record);
    writeFileSync(input, JSON.stringify({ [texts[0]?.it ?? "missing"]: "Partial" }));
    expect(run(dir, "i18n", "import", input).stdout).toContain("partially matched");
    expect(readFileSync(file, "utf8")).toBe(before);
    writeFileSync(
      input,
      JSON.stringify(Object.fromEntries(texts.map((t) => [t.it, `Translated ${t.it}`]))),
    );
    expect(run(dir, "i18n", "import", input).status).toBe(0);
    expect(JSON.parse(readFileSync(file, "utf8")).review.translations.en.target_hash).toMatch(
      /^[0-9a-f]{16}$/,
    );
  });
  it("preflights migration conflicts and is idempotent", () => {
    const { dir, file } = setup();
    mkdirSync(path.join(dir, "content/articles"), { recursive: true });
    const record = JSON.parse(readFileSync(file, "utf8"));
    record.review.translations.en.target_hash = "0000000000000000";
    writeFileSync(file, JSON.stringify(record));
    const before = readFileSync(file, "utf8");
    expect(run(dir, "migrate-translation-hashes", "--write").status).not.toBe(0);
    expect(readFileSync(file, "utf8")).toBe(before);
    delete record.review.translations.en.target_hash;
    writeFileSync(file, JSON.stringify(record));
    const other = path.join(dir, "data/events/TL-0002.json");
    const invalid = JSON.parse(readFileSync(other, "utf8"));
    invalid.sources.push("S99");
    const originalOther = readFileSync(other, "utf8");
    writeFileSync(other, JSON.stringify(invalid));
    const pending = readFileSync(file, "utf8");
    const globalFailure = run(dir, "migrate-translation-hashes", "--write");
    expect(globalFailure.status).not.toBe(0);
    expect(globalFailure.stderr).toContain('source "S99" does not exist');
    expect(readFileSync(file, "utf8")).toBe(pending);
    writeFileSync(other, originalOther);
    expect(run(dir, "migrate-translation-hashes").stdout).toContain("1 file(s) planned");
    expect(run(dir, "migrate-translation-hashes", "--write").status).toBe(0);
    const migrated = readFileSync(file, "utf8");
    expect(run(dir, "migrate-translation-hashes", "--write").stdout).toContain("0 file(s) planned");
    expect(readFileSync(file, "utf8")).toBe(migrated);
  });
  it("requires explicit article IDs, preflights all IDs and protects stale reviewed translations", () => {
    const { dir } = setup();
    cpSync(path.join(root, "content/articles"), path.join(dir, "content/articles"), {
      recursive: true,
    });
    const article = path.join(dir, "content/articles/ART-0001.en.md");
    const original = readFileSync(article, "utf8");
    writeFileSync(article, `${original}\nChanged.\n`);
    const stale = readFileSync(article, "utf8");
    expect(run(dir, "articles-hash", "--write").status).not.toBe(0);
    expect(run(dir, "articles-hash", "--write", "ART-0001", "ART-9999").status).not.toBe(0);
    expect(readFileSync(article, "utf8")).toBe(stale);
    writeFileSync(article, stale.replace("status: machine", "status: reviewed"));
    const reviewed = readFileSync(article, "utf8");
    expect(run(dir, "articles-hash", "--write", "ART-0001").status).not.toBe(0);
    expect(readFileSync(article, "utf8")).toBe(reviewed);
    writeFileSync(article, stale);
    expect(run(dir, "articles-hash", "--write", "ART-0001").status).toBe(0);
    expect(readFileSync(article, "utf8")).not.toBe(stale);
  });
});
