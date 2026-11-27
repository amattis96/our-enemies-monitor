import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { REPO_ROOT } from "../pipeline/paths.ts";

/**
 * Visual & Accessibility Audit specification:
 * - Per-page-type Lighthouse/axe/viewport budgets (375, 768, 1440 px; light/dark)
 * - Offline static HTML accessibility & structure checker over web/dist
 * - Declarative Playwright/Lighthouse CI runner spec
 */

export const VIEWPORT_WIDTHS = [375, 768, 1440] as const;
export const COLOR_THEMES = ["light", "dark"] as const;
export const PAGE_TYPES = [
  "home",
  "timeline",
  "network",
  "entity",
  "event",
  "hypothesis",
  "source",
  "article",
  "search",
  "methodology",
] as const;

export const ViewportWidthSchema = z
  .union([z.literal(375), z.literal(768), z.literal(1440)])
  .describe("Target viewport width in pixels.");

export const ColorThemeSchema = z
  .enum(COLOR_THEMES)
  .describe("Theme mode under test (light or dark).");

export const PageTypeSchema = z.enum(PAGE_TYPES).describe("Canonical site page archetype.");

export const PageBudgetSchema = z.strictObject({
  page_type: PageTypeSchema.describe("Page archetype covered by this budget."),
  sample_route: z.string().min(1).describe("Representative route path for CI audits."),
  viewports_px: z.array(ViewportWidthSchema).min(1).describe("Required viewport widths to audit."),
  themes: z.array(ColorThemeSchema).min(1).describe("Required color themes to audit."),
  lighthouse_min: z
    .strictObject({
      performance: z.number().min(0).max(1).describe("Minimum Lighthouse performance score."),
      accessibility: z.number().min(0).max(1).describe("Minimum Lighthouse accessibility score."),
      best_practices: z.number().min(0).max(1).describe("Minimum Lighthouse best-practices score."),
      seo: z.number().min(0).max(1).describe("Minimum Lighthouse SEO score."),
    })
    .describe("Minimum Lighthouse category scores."),
  axe_max_violations: z
    .strictObject({
      critical: z.literal(0).describe("Maximum critical axe violations (always 0)."),
      serious: z.literal(0).describe("Maximum serious axe violations (always 0)."),
      moderate: z.number().int().nonnegative().describe("Maximum moderate axe violations."),
    })
    .describe("Maximum allowed axe-core violations by severity."),
});

export type PageBudget = z.infer<typeof PageBudgetSchema>;

export const PAGE_VISUAL_BUDGETS: readonly PageBudget[] = [
  {
    page_type: "home",
    sample_route: "/",
    viewports_px: [375, 768, 1440],
    themes: ["light", "dark"],
    lighthouse_min: { performance: 0.9, accessibility: 0.98, best_practices: 0.95, seo: 0.95 },
    axe_max_violations: { critical: 0, serious: 0, moderate: 0 },
  },
  {
    page_type: "timeline",
    sample_route: "/timeline/",
    viewports_px: [375, 768, 1440],
    themes: ["light", "dark"],
    lighthouse_min: { performance: 0.85, accessibility: 0.98, best_practices: 0.95, seo: 0.95 },
    axe_max_violations: { critical: 0, serious: 0, moderate: 1 },
  },
  {
    page_type: "network",
    sample_route: "/network/",
    viewports_px: [375, 768, 1440],
    themes: ["light", "dark"],
    lighthouse_min: { performance: 0.8, accessibility: 0.95, best_practices: 0.95, seo: 0.95 },
    axe_max_violations: { critical: 0, serious: 0, moderate: 2 },
  },
  {
    page_type: "entity",
    sample_route: "/entities/",
    viewports_px: [375, 768, 1440],
    themes: ["light", "dark"],
    lighthouse_min: { performance: 0.9, accessibility: 0.98, best_practices: 0.95, seo: 0.95 },
    axe_max_violations: { critical: 0, serious: 0, moderate: 0 },
  },
  {
    page_type: "event",
    sample_route: "/events/",
    viewports_px: [375, 768, 1440],
    themes: ["light", "dark"],
    lighthouse_min: { performance: 0.9, accessibility: 0.98, best_practices: 0.95, seo: 0.95 },
    axe_max_violations: { critical: 0, serious: 0, moderate: 0 },
  },
  {
    page_type: "hypothesis",
    sample_route: "/hypotheses/",
    viewports_px: [375, 768, 1440],
    themes: ["light", "dark"],
    lighthouse_min: { performance: 0.9, accessibility: 0.98, best_practices: 0.95, seo: 0.95 },
    axe_max_violations: { critical: 0, serious: 0, moderate: 0 },
  },
  {
    page_type: "source",
    sample_route: "/sources/",
    viewports_px: [375, 768, 1440],
    themes: ["light", "dark"],
    lighthouse_min: { performance: 0.9, accessibility: 0.98, best_practices: 0.95, seo: 0.95 },
    axe_max_violations: { critical: 0, serious: 0, moderate: 0 },
  },
  {
    page_type: "article",
    sample_route: "/articles/",
    viewports_px: [375, 768, 1440],
    themes: ["light", "dark"],
    lighthouse_min: { performance: 0.9, accessibility: 0.98, best_practices: 0.95, seo: 0.95 },
    axe_max_violations: { critical: 0, serious: 0, moderate: 0 },
  },
  {
    page_type: "search",
    sample_route: "/search/",
    viewports_px: [375, 768, 1440],
    themes: ["light", "dark"],
    lighthouse_min: { performance: 0.85, accessibility: 0.98, best_practices: 0.95, seo: 0.9 },
    axe_max_violations: { critical: 0, serious: 0, moderate: 1 },
  },
  {
    page_type: "methodology",
    sample_route: "/methodology/",
    viewports_px: [375, 768, 1440],
    themes: ["light", "dark"],
    lighthouse_min: { performance: 0.9, accessibility: 0.98, best_practices: 0.95, seo: 0.95 },
    axe_max_violations: { critical: 0, serious: 0, moderate: 0 },
  },
] as const;

for (const budget of PAGE_VISUAL_BUDGETS) {
  PageBudgetSchema.parse(budget);
}

export const PlaywrightLighthouseSpecSchema = z.strictObject({
  runner: z.literal("playwright+lighthouse-ci").describe("CI runner toolchain identifier."),
  base_url: z.string().min(1).describe("Preview server URL used during CI visual audit."),
  viewports_px: z
    .array(ViewportWidthSchema)
    .min(1)
    .describe("Viewport widths tested across all page budgets."),
  themes: z.array(ColorThemeSchema).min(1).describe("Themes tested across all page budgets."),
  matrix_count: z
    .number()
    .int()
    .positive()
    .describe("Total (page_type x viewport x theme) combinations."),
  page_budgets: z
    .array(PageBudgetSchema)
    .min(1)
    .describe("Per-page-type budgets enforced by the runner."),
  blocking_conditions: z
    .array(z.string().min(1))
    .min(1)
    .describe("Conditions that fail the CI job."),
});

export const PLAYWRIGHT_LIGHTHOUSE_CI_SPEC = PlaywrightLighthouseSpecSchema.parse({
  runner: "playwright+lighthouse-ci",
  base_url: "http://127.0.0.1:4321/our-enemies-monitor",
  viewports_px: [375, 768, 1440],
  themes: ["light", "dark"],
  matrix_count: PAGE_VISUAL_BUDGETS.length * VIEWPORT_WIDTHS.length * COLOR_THEMES.length,
  page_budgets: [...PAGE_VISUAL_BUDGETS],
  blocking_conditions: [
    "axe critical > 0",
    "axe serious > 0",
    "lighthouse accessibility < budget.lighthouse_min.accessibility",
    "horizontal overflow > 0px at 375px, 768px, or 1440px",
    "unhandled pageerror or console.error during render",
  ],
});

export const HtmlIssueSchema = z.strictObject({
  file: z.string().min(1).describe("Relative path or label of the checked HTML document."),
  rule: z.string().min(1).describe("Static accessibility or structure rule identifier."),
  severity: z.enum(["severe", "warning"]).describe("Issue severity."),
  message: z.string().min(1).describe("Human-readable description of the violation."),
});

export const StaticVisualAuditResultSchema = z.strictObject({
  dist_dir: z.string().min(1).describe("Directory scanned for built HTML files."),
  built: z.boolean().describe("Whether the dist directory existed and was scanned."),
  pages_scanned: z.number().int().nonnegative().describe("Number of HTML files inspected."),
  severe_errors: z.number().int().nonnegative().describe("Count of severe a11y/structure errors."),
  warnings: z.number().int().nonnegative().describe("Count of non-blocking warnings."),
  passed: z.boolean().describe("True iff severe_errors === 0."),
  issues: z.array(HtmlIssueSchema).describe("Detected issues (capped or full list)."),
});

export type HtmlIssue = z.infer<typeof HtmlIssueSchema>;
export type StaticVisualAuditResult = z.infer<typeof StaticVisualAuditResultSchema>;

export function checkHtmlDocument(html: string, fileLabel: string): HtmlIssue[] {
  const issues: HtmlIssue[] = [];

  if (!/<html\b[^>]*\blang=["'][^"']+["']/i.test(html)) {
    issues.push({
      file: fileLabel,
      rule: "html-has-lang",
      severity: "severe",
      message: "Missing non-empty lang attribute on <html>.",
    });
  }

  if (!/<meta\b[^>]*\bname=["']viewport["']/i.test(html)) {
    issues.push({
      file: fileLabel,
      rule: "meta-viewport",
      severity: "severe",
      message: 'Missing <meta name="viewport"> tag.',
    });
  }

  const titleMatch = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  if (!titleMatch || (titleMatch[1] ?? "").trim() === "") {
    issues.push({
      file: fileLabel,
      rule: "document-title",
      severity: "severe",
      message: "Missing or empty <title> element.",
    });
  }

  if (!/<main\b/i.test(html) && !/\brole=["']main["']/i.test(html)) {
    issues.push({
      file: fileLabel,
      rule: "landmark-one-main",
      severity: "severe",
      message: 'Missing <main> landmark or role="main".',
    });
  }

  if (!/<h1\b/i.test(html)) {
    issues.push({
      file: fileLabel,
      rule: "page-has-heading-one",
      severity: "warning",
      message: "Page has no <h1> heading.",
    });
  }

  for (const imgMatch of html.matchAll(/<img\b([^>]*)>/gi)) {
    const attrs = imgMatch[1] ?? "";
    if (!/\balt\s*=/i.test(attrs)) {
      issues.push({
        file: fileLabel,
        rule: "image-alt",
        severity: "severe",
        message: "<img> element is missing an alt attribute.",
      });
    }
  }

  for (const tabMatch of html.matchAll(/\btabindex=["'](-?\d+)["']/gi)) {
    const val = Number.parseInt(tabMatch[1] ?? "0", 10);
    if (val > 0) {
      issues.push({
        file: fileLabel,
        rule: "tabindex-positive",
        severity: "severe",
        message: `Positive tabindex="${val}" disrupts keyboard navigation order.`,
      });
    }
  }

  return issues;
}

function collectHtmlFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir).sort()) {
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      results.push(...collectHtmlFiles(full));
    } else if (entry.endsWith(".html")) {
      results.push(full);
    }
  }
  return results;
}

export function runStaticHtmlAudit(
  distDir: string = path.join(REPO_ROOT, "web", "dist"),
): StaticVisualAuditResult {
  if (!existsSync(distDir)) {
    return StaticVisualAuditResultSchema.parse({
      dist_dir: distDir,
      built: false,
      pages_scanned: 0,
      severe_errors: 0,
      warnings: 0,
      passed: true,
      issues: [],
    });
  }

  const files = collectHtmlFiles(distDir);
  const allIssues: HtmlIssue[] = [];
  for (const file of files) {
    const rel = path.relative(distDir, file);
    const html = readFileSync(file, "utf8");
    allIssues.push(...checkHtmlDocument(html, rel));
  }

  const severeErrors = allIssues.filter((i) => i.severity === "severe").length;
  const warnings = allIssues.filter((i) => i.severity === "warning").length;

  return StaticVisualAuditResultSchema.parse({
    dist_dir: distDir,
    built: true,
    pages_scanned: files.length,
    severe_errors: severeErrors,
    warnings,
    passed: severeErrors === 0,
    issues: allIssues,
  });
}
