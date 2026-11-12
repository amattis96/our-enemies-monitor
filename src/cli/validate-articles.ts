import { readArticleFiles, validateArticleFiles } from "../pipeline/articles.ts";
import { readDataFiles } from "../pipeline/load.ts";
import { validateDataFiles } from "../pipeline/validate.ts";
import { publicationIssues, withheldReasons } from "../site/articles.ts";
import { publishedDataset } from "../site/publication.ts";

// Validate content/articles/ against the article schema and the canonical
// data, then report which articles the publication gate withholds and why.
const { dataset } = validateDataFiles(readDataFiles());
const published = publishedDataset(dataset);
const { articles, issues } = validateArticleFiles(readArticleFiles(), dataset);
const all = [...issues, ...publicationIssues(articles, published)];
const errors = all.filter((i) => i.severity === "error");

for (const issue of all)
  console.error(`${issue.severity.padEnd(8)} ${issue.file}: ${issue.message}`);
for (const article of articles) {
  const reasons = withheldReasons(article, published);
  const state = reasons.length === 0 ? "public " : "withheld";
  const kind = article.fixture ? " (fixture)" : "";
  console.log(
    `${state} ${article.id}${kind}${reasons.length > 0 ? `: ${reasons.join("; ")}` : ""}`,
  );
}
console.log(`\n${articles.length} article(s), ${errors.length} error(s)`);
process.exit(errors.length > 0 ? 1 : 0);
