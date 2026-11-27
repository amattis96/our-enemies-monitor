import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "../pipeline/paths.ts";
import { auditSeoDist, type PublishedUrlRedirectRule } from "../site/seo.ts";

function argValue(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx < 0) return undefined;
  return process.argv[idx + 1];
}

const distDir = path.resolve(argValue("--dist") ?? path.join(REPO_ROOT, "web", "dist"));
const siteUrl = argValue("--site") ?? process.env.SITE_URL ?? "https://amattis96.github.io";
const basePath = argValue("--base") ?? process.env.BASE_PATH ?? "/our-enemies-monitor";
const publishedUrlsPath = argValue("--published-urls");
const strictHreflang = !process.argv.includes("--no-strict-x-default");

if (!existsSync(distDir)) {
  console.error(`Built site directory not found: ${distDir} (run pnpm build first)`);
  process.exit(2);
}

let previouslyPublishedUrls: string[] = [];
let redirects: PublishedUrlRedirectRule[] = [];
if (publishedUrlsPath && existsSync(publishedUrlsPath)) {
  const parsed = JSON.parse(readFileSync(publishedUrlsPath, "utf8")) as {
    urls?: string[];
    redirects?: PublishedUrlRedirectRule[];
  };
  previouslyPublishedUrls = parsed.urls ?? [];
  redirects = parsed.redirects ?? [];
}

const report = auditSeoDist({
  distDir,
  siteUrl,
  basePath,
  previouslyPublishedUrls,
  redirects,
  requireXDefault: strictHreflang,
});

for (const err of report.errors) {
  console.error(`ERROR [${err.code}] ${err.location}: ${err.message}`);
}
for (const warn of report.warnings.slice(0, 50)) {
  console.warn(`WARN  [${warn.code}] ${warn.location}: ${warn.message}`);
}
if (report.warnings.length > 50) {
  console.warn(`... and ${report.warnings.length - 50} more warnings`);
}

console.log(
  `SEO check: ${report.checkedPages} HTML pages checked, ${report.errors.length} error(s), ${report.warnings.length} warning(s)`,
);

if (report.errors.length > 0) {
  process.exit(1);
}
