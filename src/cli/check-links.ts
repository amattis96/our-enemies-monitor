import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "../pipeline/paths.ts";

// Verify every internal link and asset reference in the built site resolves
// to a file in web/dist (and every #fragment to an id on the target page).
// Run after `pnpm build`.

const DIST = path.join(REPO_ROOT, "web", "dist");
const BASE = (process.env.BASE_PATH ?? "/our-enemies-monitor").replace(/\/$/, "");

if (!existsSync(DIST)) {
  console.error("web/dist not found: run pnpm build first");
  process.exit(2);
}

function htmlFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return htmlFiles(full);
    return name.endsWith(".html") ? [full] : [];
  });
}

const idCache = new Map<string, Set<string>>();
function idsOf(file: string): Set<string> {
  let ids = idCache.get(file);
  if (!ids) {
    ids = new Set(
      [...readFileSync(file, "utf8").matchAll(/\sid="([^"]+)"/g)].map((m) => m[1] ?? ""),
    );
    idCache.set(file, ids);
  }
  return ids;
}

/** File in dist served for a site path, or null. */
function resolve(urlPath: string): string | null {
  if (!urlPath.startsWith(`${BASE}/`) && urlPath !== BASE) return null;
  const relative = decodeURIComponent(urlPath.slice(BASE.length)).replace(/^\//, "");
  const candidates =
    relative === "" || relative.endsWith("/")
      ? [path.join(DIST, relative, "index.html")]
      : [path.join(DIST, relative), path.join(DIST, relative, "index.html")];
  return candidates.find((c) => existsSync(c) && statSync(c).isFile()) ?? null;
}

const problems: string[] = [];
let checked = 0;
const files = htmlFiles(DIST);
for (const file of files) {
  const html = readFileSync(file, "utf8");
  const page = `/${path.relative(DIST, file).split(path.sep).join("/")}`;
  for (const match of html.matchAll(/\s(?:href|src)="([^"]+)"/g)) {
    const raw = (match[1] ?? "").replaceAll("&amp;", "&");
    if (/^(https?:|mailto:|data:)/.test(raw)) continue;
    checked++;
    const [beforeHash = "", fragment] = raw.split("#");
    const urlPath = beforeHash.split("?")[0] ?? "";
    const target = urlPath === "" ? file : resolve(urlPath);
    if (!target) {
      problems.push(`${page}: broken link ${raw}`);
      continue;
    }
    if (fragment && target.endsWith(".html") && !idsOf(target).has(decodeURIComponent(fragment))) {
      problems.push(`${page}: missing anchor ${raw}`);
    }
  }
}

for (const problem of problems.slice(0, 50)) console.error(problem);
console.log(
  `${files.length} pages, ${checked} internal links checked, ${problems.length} problem(s)`,
);
process.exit(problems.length > 0 ? 1 : 0);
