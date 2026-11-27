import { parseArgs } from "node:util";
import { ARTICLES_DIR, readArticleFiles, validateArticleFiles } from "../pipeline/articles.ts";
import { readDataFiles } from "../pipeline/load.ts";
import { DATA_DIR } from "../pipeline/paths.ts";
import { validateDataFiles } from "../pipeline/validate.ts";
import { buildSourceImpactIndex, lookupSourceImpact } from "../retractions/index.ts";

function usage(): string {
  return [
    "Usage: node src/cli/impact.ts <source> [options]",
    "",
    "Options:",
    "  --data-dir <dir>      Override data directory (default: data/)",
    "  --articles-dir <dir>  Override articles directory (default: content/articles/)",
    "  --help                Show this help message",
  ].join("\n");
}

function main(): void {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: true,
    options: {
      "data-dir": { type: "string" },
      "articles-dir": { type: "string" },
      help: { type: "boolean", default: false },
    },
  });

  if (values.help || positionals.length === 0) {
    console.log(usage());
    process.exit(values.help ? 0 : 1);
  }

  const sourceId = positionals[0];
  if (!sourceId) {
    console.error("Missing <source> argument.\n");
    console.error(usage());
    process.exit(1);
  }

  const dataDir = values["data-dir"] ?? DATA_DIR;
  const articlesDir = values["articles-dir"] ?? ARTICLES_DIR;

  const { dataset } = validateDataFiles(readDataFiles(dataDir));
  const { articles } = validateArticleFiles(readArticleFiles(articlesDir), dataset);
  const index = buildSourceImpactIndex({ dataset, articles });
  const impact = lookupSourceImpact(index, sourceId);

  console.log(JSON.stringify(impact, null, 2));
}

main();
