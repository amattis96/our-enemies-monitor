import { useEffect, useId, useMemo, useState } from "react";
import { formatDateRange, PRECISION_LABELS } from "../../../src/site/format.ts";
import type { TimelineItem } from "../../../src/site/read-model.ts";

type Props = {
  items: TimelineItem[];
  themes: { id: string; label: string }[];
  /** Base URL of event pages, ending with a slash. */
  eventBase: string;
};

const yearOf = (date: string) => Number(date.slice(0, 4));

export default function TimelineExplorer({ items, themes, eventBase }: Props) {
  const years = useMemo(() => [...new Set(items.map((i) => yearOf(i.start)))].sort(), [items]);
  const [theme, setTheme] = useState("");
  const [from, setFrom] = useState(years[0] ?? 2007);
  const [to, setTo] = useState(years.at(-1) ?? 2026);
  const [query, setQuery] = useState("");
  const [showPending, setShowPending] = useState(true);
  const [showMetadata, setShowMetadata] = useState(false);
  const id = useId();
  const themeLabel = new Map(themes.map((t) => [t.id, t.label]));

  // Deep link: ?tema=<theme>
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("tema");
    if (requested && themes.some((t) => t.id === requested)) setTheme(requested);
  }, [themes]);

  const needle = query.trim().toLowerCase();
  const visible = items.filter(
    (item) =>
      (theme === "" || item.themes.includes(theme as TimelineItem["themes"][number])) &&
      yearOf(item.start) >= from &&
      yearOf(item.start) <= to &&
      (showPending || !item.pending) &&
      (showMetadata || !item.metadata) &&
      (needle === "" ||
        `${item.id} ${item.title} ${item.geography ?? ""}`.toLowerCase().includes(needle)),
  );
  const byYear = new Map<number, TimelineItem[]>();
  for (const item of visible) {
    const year = yearOf(item.start);
    byYear.set(year, [...(byYear.get(year) ?? []), item]);
  }

  return (
    <div>
      <form
        className="card grid gap-3 sm:grid-cols-2 lg:grid-cols-4 bg-wash"
        onSubmit={(e) => e.preventDefault()}
        aria-label="Filtri della cronologia"
      >
        <label className="flex flex-col text-sm">
          Tema
          <select value={theme} onChange={(e) => setTheme(e.target.value)} className="border p-1">
            <option value="">Tutti i temi</option>
            {themes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="flex gap-2 text-sm">
          <legend className="sr-only">Periodo</legend>
          <label className="flex flex-col">
            Dal
            <select
              value={from}
              onChange={(e) => setFrom(Number(e.target.value))}
              className="border p-1"
            >
              {years.map((y) => (
                <option key={y}>{y}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col">
            Al
            <select
              value={to}
              onChange={(e) => setTo(Number(e.target.value))}
              className="border p-1"
            >
              {years.map((y) => (
                <option key={y}>{y}</option>
              ))}
            </select>
          </label>
        </fieldset>
        <label className="flex flex-col text-sm">
          Testo, ID o luogo
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="border p-1"
            placeholder="es. Baltico, TL-0060"
          />
        </label>
        <div className="flex flex-col text-sm gap-1">
          <label>
            <input
              type="checkbox"
              checked={showPending}
              onChange={(e) => setShowPending(e.target.checked)}
            />{" "}
            Includi evidenze da integrare (EXT)
          </label>
          <label>
            <input
              type="checkbox"
              checked={showMetadata}
              onChange={(e) => setShowMetadata(e.target.checked)}
            />{" "}
            Includi metadati del dataset
          </label>
        </div>
      </form>

      <p className="meta mt-3" aria-live="polite" id={`${id}-count`}>
        {visible.length} voci su {items.length}
      </p>

      {[...byYear].map(([year, entries]) => (
        <section key={year} aria-labelledby={`${id}-${year}`}>
          <h2 id={`${id}-${year}`}>
            {year} <span className="meta font-normal">({entries.length})</span>
          </h2>
          <ol className="space-y-3">
            {entries.map((item) => (
              <li key={item.id} className="border-l-2 border-line pl-3">
                <div className="meta">
                  <span title={PRECISION_LABELS[item.precision]}>
                    {formatDateRange(item.start, item.end)}
                  </span>
                  {item.geography && <> · {item.geography}</>}
                  {" · "}
                  <span className="font-mono">{item.id}</span>
                  {item.pending && (
                    <span className="badge ml-2">da integrare nella cronologia</span>
                  )}
                  {item.metadata && <span className="badge ml-2">metadato del dataset</span>}
                </div>
                <a href={`${eventBase}${item.id}/`} className="font-semibold">
                  {item.title}
                </a>
                {item.evidence_note && (
                  <div className="meta">Valutazione: {item.evidence_note}</div>
                )}
                <div className="meta">{item.themes.map((t) => themeLabel.get(t)).join(" · ")}</div>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
