import type { TimelineItem } from "./read-model.ts";

/**
 * Timeline presentation rules (Dossier, docs/design/PAGES.md): newest first
 * by default, filters encoded in the URL. Pure functions, tested.
 */

export type TimelineOrder = "newest" | "oldest";

export type TimelineFilters = {
  theme: string;
  from: number | null;
  to: number | null;
  query: string;
  pending: boolean;
  metadata: boolean;
  order: TimelineOrder;
};

export const DEFAULT_FILTERS: TimelineFilters = {
  theme: "",
  from: null,
  to: null,
  query: "",
  pending: true,
  metadata: false,
  order: "newest",
};

export const yearOf = (date: string): number => Number(date.slice(0, 4));

/**
 * Chronological order. Within the same start date, coarser precision (year,
 * then month) comes before finer precision when oldest first, and after it
 * when newest first, so imprecise dates never pretend to a position inside
 * the period they cover.
 */
export function orderTimeline(items: TimelineItem[], order: TimelineOrder): TimelineItem[] {
  const sorted = [...items].sort(
    (a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id),
  );
  return order === "newest" ? sorted.reverse() : sorted;
}

/** Number of items per year, every year between the first and the last (zeros included). */
export function yearCounts(items: TimelineItem[]): { year: number; count: number }[] {
  if (items.length === 0) return [];
  const counts = new Map<number, number>();
  for (const item of items)
    counts.set(yearOf(item.start), (counts.get(yearOf(item.start)) ?? 0) + 1);
  const years = [...counts.keys()];
  const first = Math.min(...years);
  const last = Math.max(...years);
  return Array.from({ length: last - first + 1 }, (_, i) => ({
    year: first + i,
    count: counts.get(first + i) ?? 0,
  }));
}

export function matches(item: TimelineItem, f: TimelineFilters): boolean {
  const year = yearOf(item.start);
  const needle = f.query.trim().toLowerCase();
  return (
    (f.theme === "" || item.themes.includes(f.theme as TimelineItem["themes"][number])) &&
    (f.from === null || year >= f.from) &&
    (f.to === null || year <= f.to) &&
    (f.pending || !item.pending) &&
    (f.metadata || !item.metadata) &&
    (needle === "" ||
      `${item.id} ${item.title} ${item.geography ?? ""}`.toLowerCase().includes(needle))
  );
}

/** Read filters from a query string; `tema` (and `theme`) keep the existing deep links. */
export function parseFilters(search: string): TimelineFilters {
  const p = new URLSearchParams(search);
  const year = (v: string | null) => (v && /^\d{4}$/.test(v) ? Number(v) : null);
  return {
    theme: p.get("tema") ?? p.get("theme") ?? "",
    from: year(p.get("da") ?? p.get("from")),
    to: year(p.get("a") ?? p.get("to")),
    query: p.get("q") ?? "",
    pending: p.get("ext") !== "0",
    metadata: p.get("meta") === "1",
    order: p.get("ordine") === "asc" || p.get("order") === "oldest" ? "oldest" : "newest",
  };
}

/** Serialize only the non-default filters (Italian parameter names, as `?tema=`). */
export function serializeFilters(f: TimelineFilters): string {
  const p = new URLSearchParams();
  if (f.theme) p.set("tema", f.theme);
  if (f.from !== null) p.set("da", String(f.from));
  if (f.to !== null) p.set("a", String(f.to));
  if (f.query.trim()) p.set("q", f.query.trim());
  if (!f.pending) p.set("ext", "0");
  if (f.metadata) p.set("meta", "1");
  if (f.order === "oldest") p.set("ordine", "asc");
  const s = p.toString();
  return s ? `?${s}` : "";
}
