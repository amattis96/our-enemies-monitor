import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import type { Language } from "../model/index.ts";
import type { Withheld } from "./publication.ts";
import { leakedIds, leakedInCsv, leakedInSitemap, withheldIdSet } from "./surface.ts";

export type SeoIssueSeverity = "error" | "warning";

export type SeoIssueCode =
  | "withheld_leak"
  | "missing_essential_caveat"
  | "invalid_canonical"
  | "inconsistent_hreflang"
  | "invalid_jsonld"
  | "broken_essential_link"
  | "removed_url_without_redirect"
  | "title_length"
  | "description_length"
  | "lead_summary_too_long"
  | "missing_og_image";

export type SeoIssue = {
  severity: SeoIssueSeverity;
  code: SeoIssueCode;
  location: string;
  message: string;
};

export type SeoAuditReport = {
  checkedPages: number;
  errors: SeoIssue[];
  warnings: SeoIssue[];
  issues: SeoIssue[];
};

export type PublishedUrlRedirectRule = {
  from: string;
  to: string;
  exception?: string;
};

export type SeoAuditOptions = {
  distDir: string;
  siteUrl?: string;
  basePath?: string;
  /** Previously published site-relative paths (e.g. `/events/TL-0001/`) that must still resolve or redirect. */
  previouslyPublishedUrls?: readonly string[];
  /** Explicit redirects or justified exceptions for removed published URLs. */
  redirects?: readonly PublishedUrlRedirectRule[];
  /** Require `x-default` whenever hreflang alternates are declared (default: true). */
  requireXDefault?: boolean;
};

const TITLE_MIN = 15;
const TITLE_MAX = 65;
const DESCRIPTION_MIN = 50;
const DESCRIPTION_MAX = 160;
const LEAD_MAX_WORDS = 40;

const CAVEAT_PATTERNS: Record<string, RegExp> = {
  hypothesis:
    /(E5|ipotesi|hypothesis|open verification question|domanda di verifica aperta|not an established fact|non è un fatto)/i,
  unreviewed: /(imported_unreviewed|provisional|provvisori|non rivist|unreviewed)/i,
  ai_verified: /(ai_verified|verifica ai|ai-verified|machine translation|traduzione automatica)/i,
  dataset: /(public projection|proiezione pubblica|CC0|withheld|riservat)/i,
};

function collectFiles(dir: string, predicate: (name: string) => boolean): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return collectFiles(full, predicate);
    return predicate(name) ? [full] : [];
  });
}

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtmlEntities(text: string): string {
  return text
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

function extractAttr(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, "i"));
  return match?.[1] !== undefined ? decodeHtmlEntities(match[1]) : null;
}

function normalizeSitePath(rawUrl: string, siteUrl: string, basePath: string): string {
  try {
    const parsed = new URL(rawUrl, siteUrl);
    const pathname = parsed.pathname;
    if (basePath && pathname.startsWith(`${basePath}/`)) {
      return pathname.slice(basePath.length);
    }
    if (basePath && pathname === basePath) {
      return "/";
    }
    return pathname;
  } catch {
    return rawUrl;
  }
}

function resolveDistTarget(distDir: string, basePath: string, rawUrl: string): string | null {
  const [beforeHash = ""] = rawUrl.split("#");
  const urlPath = beforeHash.split("?")[0] ?? "";
  if (!urlPath) return null;
  if (/^(https?:|mailto:|data:|javascript:)/i.test(urlPath)) return urlPath;
  if (basePath && !urlPath.startsWith(`${basePath}/`) && urlPath !== basePath) {
    return null;
  }
  const relative = decodeURIComponent(basePath ? urlPath.slice(basePath.length) : urlPath).replace(
    /^\//,
    "",
  );
  const candidates =
    relative === "" || relative.endsWith("/")
      ? [path.join(distDir, relative, "index.html")]
      : [path.join(distDir, relative), path.join(distDir, relative, "index.html")];
  return candidates.find((c) => existsSync(c) && statSync(c).isFile()) ?? null;
}

function isWithheldIdMentionedInText(text: string, withheld: ReadonlySet<string>): string[] {
  const found: string[] = [];
  for (const id of withheld) {
    const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`(?<![A-Za-z0-9-])${escaped}(?![A-Za-z0-9-])`).test(text)) {
      found.push(id);
    }
  }
  return found.sort();
}

function validateJsonLdObject(
  value: unknown,
  pagePath: string,
): { valid: boolean; reason?: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { valid: false, reason: "JSON-LD root must be a JSON object" };
  }
  const obj = value as Record<string, unknown>;
  if (obj["@context"] !== "https://schema.org") {
    return { valid: false, reason: "JSON-LD @context must be https://schema.org" };
  }
  const type = obj["@type"];
  if (typeof type !== "string" || type.length === 0) {
    return { valid: false, reason: "JSON-LD @type is missing or empty" };
  }
  if (
    pagePath.includes("/hypotheses/") &&
    (type === "ClaimReview" || type === "FactCheck" || obj.claimReviewed)
  ) {
    return {
      valid: false,
      reason: "Hypothesis page must not emit ClaimReview/FactCheck structured data",
    };
  }
  if (type === "Article" && (typeof obj.headline !== "string" || obj.headline.trim() === "")) {
    return { valid: false, reason: "Article JSON-LD requires a non-empty headline" };
  }
  if (
    (type === "Event" || type === "Organization" || type === "Person" || type === "Dataset") &&
    (typeof obj.name !== "string" || obj.name.trim() === "")
  ) {
    return { valid: false, reason: `${type} JSON-LD requires a non-empty name` };
  }
  return { valid: true };
}

/**
 * Audit a built `web/dist` directory for blocking SEO/GEO errors and non-blocking warnings.
 */
export function auditSeoDist(options: SeoAuditOptions): SeoAuditReport {
  const distDir = options.distDir;
  const siteUrl = (options.siteUrl ?? "https://amattis96.github.io").replace(/\/$/, "");
  const basePath = (options.basePath ?? "/our-enemies-monitor").replace(/\/$/, "");
  const requireXDefault = options.requireXDefault ?? true;
  const issues: SeoIssue[] = [];

  const htmlFiles = collectFiles(distDir, (n) => n.endsWith(".html"));
  const pageBySitePath = new Map<string, { file: string; html: string }>();

  for (const file of htmlFiles) {
    const rel = path.relative(distDir, file).split(path.sep).join("/");
    const sitePath =
      rel === "index.html"
        ? "/"
        : rel.endsWith("/index.html")
          ? `/${rel.slice(0, -"index.html".length)}`
          : `/${rel}`;
    pageBySitePath.set(sitePath, { file, html: readFileSync(file, "utf8") });
  }

  // 1. Withheld IDs across machine-readable surface, sitemap, search index, and pages
  const dataDir = path.join(distDir, "data", "v1");
  let withheld = new Set<string>();
  const withheldPath = path.join(dataDir, "withheld.json");
  const allPath = path.join(dataDir, "all.json");
  if (existsSync(withheldPath) && existsSync(allPath)) {
    const withheldList = JSON.parse(readFileSync(withheldPath, "utf8")) as Withheld[];
    const dataset = JSON.parse(readFileSync(allPath, "utf8")) as Parameters<
      typeof withheldIdSet
    >[1];
    withheld = withheldIdSet(withheldList, dataset);

    for (const relName of ["articles.json", "changes.feed.json", "index.json"]) {
      const target = path.join(dataDir, relName);
      if (!existsSync(target)) continue;
      for (const id of leakedIds(JSON.parse(readFileSync(target, "utf8")), withheld)) {
        issues.push({
          severity: "error",
          code: "withheld_leak",
          location: `data/v1/${relName}`,
          message: `Withheld ID ${id} leaked in data/v1/${relName}`,
        });
      }
    }

    const recordsDir = path.join(dataDir, "records");
    if (existsSync(recordsDir)) {
      for (const name of readdirSync(recordsDir)) {
        const recordId = name.replace(/\.json$/, "");
        if (withheld.has(recordId)) {
          issues.push({
            severity: "error",
            code: "withheld_leak",
            location: `data/v1/records/${name}`,
            message: `Withheld record package ${recordId} was exported`,
          });
        }
        const parsed = JSON.parse(readFileSync(path.join(recordsDir, name), "utf8"));
        for (const id of leakedIds(parsed, withheld)) {
          issues.push({
            severity: "error",
            code: "withheld_leak",
            location: `data/v1/records/${name}`,
            message: `Withheld ID ${id} leaked in record package ${name}`,
          });
        }
      }
    }

    if (existsSync(dataDir)) {
      for (const name of readdirSync(dataDir).filter((n) => n.endsWith(".csv"))) {
        for (const id of leakedInCsv(readFileSync(path.join(dataDir, name), "utf8"), withheld)) {
          issues.push({
            severity: "error",
            code: "withheld_leak",
            location: `data/v1/${name}`,
            message: `Withheld ID ${id} leaked in CSV export`,
          });
        }
      }
    }
  }

  for (const sitemapFile of collectFiles(
    distDir,
    (n) => n.startsWith("sitemap") && n.endsWith(".xml"),
  )) {
    const xml = readFileSync(sitemapFile, "utf8");
    for (const id of leakedInSitemap(xml, withheld)) {
      issues.push({
        severity: "error",
        code: "withheld_leak",
        location: path.relative(distDir, sitemapFile),
        message: `Withheld ID ${id} leaked in sitemap`,
      });
    }
  }

  // Search index files (pagefind or search-index.json)
  for (const searchFile of collectFiles(
    path.join(distDir, "pagefind"),
    (n) => n.endsWith(".json") || n.endsWith(".pf_meta"),
  )) {
    const content = readFileSync(searchFile, "utf8");
    for (const id of isWithheldIdMentionedInText(content, withheld)) {
      issues.push({
        severity: "error",
        code: "withheld_leak",
        location: path.relative(distDir, searchFile),
        message: `Withheld ID ${id} leaked in search index`,
      });
    }
  }

  // 2. Per-page checks
  const hreflangMap = new Map<string, Map<string, string>>();

  for (const [sitePath, { html }] of pageBySitePath) {
    const is404 = sitePath === "/404.html" || sitePath.endsWith("/404.html");
    const isRedirectStub = /<meta\s+http-equiv="refresh"/i.test(html);

    // Check withheld ID in page path, social meta, and JSON-LD
    if (withheld.size > 0) {
      for (const part of sitePath.split("/").filter(Boolean)) {
        if (withheld.has(part)) {
          issues.push({
            severity: "error",
            code: "withheld_leak",
            location: sitePath,
            message: `Withheld ID ${part} has a rendered page at ${sitePath}`,
          });
        }
      }

      const socialMetaTags = [
        ...html.matchAll(/<meta\s+(?:property|name)="(?:og:|twitter:)[^"]*"[^>]*>/gi),
      ];
      for (const m of socialMetaTags) {
        const tag = m[0];
        const attrName = (
          extractAttr(tag, "property") ??
          extractAttr(tag, "name") ??
          ""
        ).toLowerCase();
        const content = extractAttr(tag, "content") ?? "";
        const isUrlTag = attrName.endsWith(":url") || attrName.endsWith(":image");
        for (const id of isWithheldIdMentionedInText(content, withheld)) {
          // Free-text social tags (og:title, og:description) may legitimately contain short
          // acronyms (e.g. AP, DOJ) that also happen to be withheld entity IDs; only flag
          // structured IDs (containing digits/hyphens) in free-text tags, and all IDs in URLs.
          if (!isUrlTag && !/[-\d]/.test(id)) continue;
          issues.push({
            severity: "error",
            code: "withheld_leak",
            location: sitePath,
            message: `Withheld ID ${id} leaked in social metadata`,
          });
        }
      }
    }

    // JSON-LD validation + withheld check
    for (const match of html.matchAll(
      /<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/gi,
    )) {
      const rawJson = (match[1] ?? "").trim();
      let parsed: unknown;
      try {
        parsed = JSON.parse(rawJson);
      } catch {
        issues.push({
          severity: "error",
          code: "invalid_jsonld",
          location: sitePath,
          message: "Malformed JSON-LD script block",
        });
        continue;
      }
      const check = validateJsonLdObject(parsed, sitePath);
      if (!check.valid) {
        issues.push({
          severity: "error",
          code: "invalid_jsonld",
          location: sitePath,
          message: check.reason ?? "Invalid JSON-LD",
        });
      }
      if (withheld.size > 0) {
        for (const id of leakedIds(parsed, withheld)) {
          issues.push({
            severity: "error",
            code: "withheld_leak",
            location: sitePath,
            message: `Withheld ID ${id} leaked in JSON-LD`,
          });
        }
      }
    }

    if (is404 || isRedirectStub) continue;

    // Canonical check
    const canonicalTag = html.match(/<link\s+[^>]*rel="canonical"[^>]*>/i)?.[0] ?? null;
    if (!canonicalTag) {
      issues.push({
        severity: "error",
        code: "invalid_canonical",
        location: sitePath,
        message: 'Missing <link rel="canonical">',
      });
    } else {
      const hrefVal = extractAttr(canonicalTag, "href");
      if (!hrefVal || !/^https?:\/\/.+/.test(hrefVal)) {
        issues.push({
          severity: "error",
          code: "invalid_canonical",
          location: sitePath,
          message: `Canonical URL must be absolute http(s): ${hrefVal ?? "(empty)"}`,
        });
      } else {
        const canonicalPath = normalizeSitePath(hrefVal, siteUrl, basePath);
        if (canonicalPath !== sitePath) {
          issues.push({
            severity: "error",
            code: "invalid_canonical",
            location: sitePath,
            message: `Canonical path ${canonicalPath} does not match page path ${sitePath}`,
          });
        }
      }
    }

    // Hreflang collection
    const alternates = new Map<string, string>();
    for (const m of html.matchAll(/<link\s+[^>]*rel="alternate"[^>]*>/gi)) {
      const tag = m[0];
      const hreflang = extractAttr(tag, "hreflang");
      const hrefVal = extractAttr(tag, "href");
      if (hreflang && hrefVal) {
        alternates.set(hreflang, normalizeSitePath(hrefVal, siteUrl, basePath));
      }
    }
    if (alternates.size > 0) {
      hreflangMap.set(sitePath, alternates);
      if (requireXDefault && !alternates.has("x-default")) {
        issues.push({
          severity: "error",
          code: "inconsistent_hreflang",
          location: sitePath,
          message: "Hreflang alternates declared without x-default",
        });
      }
    }

    // Essential caveat checks
    const bodyText = stripTags(html);
    if (html.includes("data-requires-caveat") && !html.includes("data-caveat")) {
      issues.push({
        severity: "error",
        code: "missing_essential_caveat",
        location: sitePath,
        message: "Page marks data-requires-caveat without a caveat element",
      });
    }
    if (/^\/(?:en\/)?hypotheses\/H\d+/.test(sitePath)) {
      if (!CAVEAT_PATTERNS.hypothesis?.test(bodyText)) {
        issues.push({
          severity: "error",
          code: "missing_essential_caveat",
          location: sitePath,
          message: "Hypothesis page is missing essential E5 / open-question caveat",
        });
      }
    }
    if (/^\/(?:en\/)?data\/?$/.test(sitePath)) {
      if (!CAVEAT_PATTERNS.dataset?.test(bodyText)) {
        issues.push({
          severity: "error",
          code: "missing_essential_caveat",
          location: sitePath,
          message: "Data export page is missing essential public-projection caveat",
        });
      }
    }

    // Essential internal links (canonical, sitemap, nav, record links)
    for (const match of html.matchAll(/<(?:a|link)\s+[^>]*href="([^"]+)"[^>]*>/gi)) {
      const tag = match[0];
      const rawHref = decodeHtmlEntities(match[1] ?? "");
      if (!rawHref || /^(https?:|mailto:|data:|#)/i.test(rawHref)) continue;
      const isEssential =
        /^<link\b/i.test(tag) ||
        /\bdata-essential-link\b/i.test(tag) ||
        /^\/(?:our-enemies-monitor\/)?(?:en\/)?(?:events|entities|hypotheses|sources|articles|data)\//.test(
          rawHref,
        );
      if (!isEssential) continue;
      if (!resolveDistTarget(distDir, basePath, rawHref)) {
        issues.push({
          severity: "error",
          code: "broken_essential_link",
          location: sitePath,
          message: `Broken essential link: ${rawHref}`,
        });
      }
    }

    // Warnings: title length, description length, lead > 40 words, missing og:image
    const titleText = decodeHtmlEntities(
      html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? "",
    ).trim();
    if (titleText.length < TITLE_MIN || titleText.length > TITLE_MAX) {
      issues.push({
        severity: "warning",
        code: "title_length",
        location: sitePath,
        message: `Title length ${titleText.length} is outside recommended ${TITLE_MIN}-${TITLE_MAX} chars`,
      });
    }

    const descTag = html.match(/<meta\s+[^>]*name="description"[^>]*>/i)?.[0] ?? null;
    const descText = descTag ? (extractAttr(descTag, "content") ?? "").trim() : "";
    if (descText.length < DESCRIPTION_MIN || descText.length > DESCRIPTION_MAX) {
      issues.push({
        severity: "warning",
        code: "description_length",
        location: sitePath,
        message: `Description length ${descText.length} is outside recommended ${DESCRIPTION_MIN}-${DESCRIPTION_MAX} chars`,
      });
    }

    const ledeMatch = html.match(/<p[^>]*class="[^"]*\blede\b[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
    if (ledeMatch?.[1]) {
      const words = stripTags(ledeMatch[1]).split(/\s+/).filter(Boolean);
      if (words.length > LEAD_MAX_WORDS) {
        issues.push({
          severity: "warning",
          code: "lead_summary_too_long",
          location: sitePath,
          message: `Lead summary has ${words.length} words (recommended <= ${LEAD_MAX_WORDS})`,
        });
      }
    }

    const ogImage = html.match(/<meta\s+[^>]*property="og:image"[^>]*>/i)?.[0] ?? null;
    if (!ogImage) {
      issues.push({
        severity: "warning",
        code: "missing_og_image",
        location: sitePath,
        message: 'Missing <meta property="og:image">',
      });
    }
  }

  // 3. Reciprocal hreflang check across pages
  for (const [sitePath, alternates] of hreflangMap) {
    for (const [lang, targetPath] of alternates) {
      if (lang === "x-default") continue;
      const targetAlternates = hreflangMap.get(targetPath);
      if (!targetAlternates) {
        issues.push({
          severity: "error",
          code: "inconsistent_hreflang",
          location: sitePath,
          message: `Hreflang ${lang} points to missing page ${targetPath}`,
        });
        continue;
      }
      const backLinks = [...targetAlternates.values()];
      if (!backLinks.includes(sitePath)) {
        issues.push({
          severity: "error",
          code: "inconsistent_hreflang",
          location: sitePath,
          message: `Hreflang ${lang} -> ${targetPath} is not reciprocal`,
        });
      }
    }
  }

  // 4. Removed published URLs without redirect
  const redirectByFrom = new Map((options.redirects ?? []).map((r) => [r.from, r]));
  for (const oldPath of options.previouslyPublishedUrls ?? []) {
    if (pageBySitePath.has(oldPath)) continue;
    const rule = redirectByFrom.get(oldPath);
    if (!rule || (!rule.to && !rule.exception)) {
      issues.push({
        severity: "error",
        code: "removed_url_without_redirect",
        location: oldPath,
        message: `Previously published URL ${oldPath} was removed without a redirect or justified exception`,
      });
    }
  }

  return {
    checkedPages: pageBySitePath.size,
    errors: issues.filter((i) => i.severity === "error"),
    warnings: issues.filter((i) => i.severity === "warning"),
    issues,
  };
}

/**
 * Determine whether two record projections differ in substantive content
 * (ignoring formatting, whitespace, and non-content review notes).
 */
export function isSignificantContentChange(
  previous: Record<string, unknown> | null,
  current: Record<string, unknown>,
): boolean {
  if (!previous) return true;
  const stripNonContent = (obj: Record<string, unknown>) => {
    const copy: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (key === "provenance" || key === "review") continue;
      copy[key] = value;
    }
    return JSON.stringify(copy);
  };
  return stripNonContent(previous) !== stripNonContent(current);
}

/**
 * Compute a content-based `lastmod` (`YYYY-MM-DD`) without using wall-clock time.
 */
export function contentLastmod(input: {
  significantChange: boolean;
  previousLastmod: string | null;
  contentDate: string | null;
}): string | undefined {
  if (!input.significantChange && input.previousLastmod) {
    return input.previousLastmod.slice(0, 10);
  }
  const chosen = input.contentDate ?? input.previousLastmod;
  return chosen ? chosen.slice(0, 10) : undefined;
}

export type CitationInput = {
  title: string;
  url: string;
  lang: Language;
  id?: string;
  authors?: readonly string[];
  /** Explicit generation or snapshot date (`YYYY-MM-DD` or ISO timestamp). */
  generatedAt: string;
  snapshotId?: string;
  snapshotStatus?: "accepted" | "published" | "superseded" | "withdrawn" | "deployment_failed";
  supersededByUrl?: string;
  doi?: string;
};

export function formatApaCitation(input: CitationInput): string {
  const datePart = input.generatedAt.slice(0, 10);
  const year = datePart.slice(0, 4);
  const authorStr =
    input.authors && input.authors.length > 0 ? input.authors.join(", ") : "Our Enemies Monitor";
  const versionPart = input.snapshotId
    ? ` (Snapshot ${input.snapshotId}, ${datePart})`
    : ` (${datePart})`;
  const doiPart = input.doi ? ` https://doi.org/${input.doi}` : "";
  return `${authorStr}. (${year}). ${input.title}${versionPart}. Our Enemies Monitor. ${input.url}${doiPart}`;
}

export function formatBibtexCitation(input: CitationInput): string {
  const datePart = input.generatedAt.slice(0, 10);
  const year = datePart.slice(0, 4);
  const keyBase = (input.id ?? input.snapshotId ?? "oem").toLowerCase().replace(/[^a-z0-9]+/g, "_");
  const key = `oem_${keyBase}_${year}`;
  const authorStr =
    input.authors && input.authors.length > 0 ? input.authors.join(" and ") : "Our Enemies Monitor";
  const lines = [
    `@misc{${key},`,
    `  author = {${authorStr}},`,
    `  title = {${input.title}},`,
    `  year = {${year}},`,
    `  url = {${input.url}},`,
    `  note = {Generated ${datePart}${input.snapshotId ? `, snapshot ${input.snapshotId}` : ""}${input.snapshotStatus ? ` (${input.snapshotStatus})` : ""}},`,
  ];
  if (input.doi) {
    lines.push(`  doi = {${input.doi}},`);
  }
  lines.push("}");
  return lines.join("\n");
}

export function snapshotStatusNotice(input: {
  lang: Language;
  status?: CitationInput["snapshotStatus"];
  supersededByUrl?: string;
}): { isWarning: boolean; message: string } | null {
  if (input.status === "superseded") {
    const base =
      input.lang === "it"
        ? "Questo snapshot è stato superato da una versione successiva."
        : "This snapshot has been superseded by a newer version.";
    const linkNote = input.supersededByUrl
      ? input.lang === "it"
        ? ` Versione corrente: ${input.supersededByUrl}`
        : ` Current version: ${input.supersededByUrl}`
      : "";
    return { isWarning: true, message: `${base}${linkNote}` };
  }
  if (input.status === "withdrawn") {
    const base =
      input.lang === "it"
        ? "Questo snapshot è stato ritirato e non deve essere citato come riferimento corrente."
        : "This snapshot has been withdrawn and should not be cited as a current reference.";
    const linkNote = input.supersededByUrl
      ? input.lang === "it"
        ? ` Versione corrente: ${input.supersededByUrl}`
        : ` Current version: ${input.supersededByUrl}`
      : "";
    return { isWarning: true, message: `${base}${linkNote}` };
  }
  return null;
}
