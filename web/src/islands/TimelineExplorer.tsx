import { useEffect, useId, useMemo, useState } from "react";
import type { Language } from "../../../src/model/index.ts";
import { formatDateRange, PRECISION_LABELS } from "../../../src/site/format.ts";
import type { TimelineItem } from "../../../src/site/read-model.ts";

const LABELS = {
  it: {
    filters: "Filtri della cronologia",
    theme: "Tema",
    allThemes: "Tutti i temi",
    period: "Periodo",
    from: "Dal",
    to: "Al",
    text: "Testo, ID o luogo",
    placeholder: "es. Baltico, TL-0060",
    pending: "Includi evidenze da integrare (EXT)",
    metadata: "Includi metadati del dataset",
    count: (shown: number, total: number) => `${shown} voci su ${total}`,
    pendingBadge: "da integrare nella cronologia",
    metadataBadge: "metadato del dataset",
    assessment: "Valutazione",
  },
  en: {
    filters: "Timeline filters",
    theme: "Theme",
    allThemes: "All themes",
    period: "Period",
    from: "From",
    to: "To",
    text: "Text, ID or place",
    placeholder: "e.g. Baltic, TL-0060",
    pending: "Include evidence pending integration (EXT)",
    metadata: "Include dataset metadata",
    count: (shown: number, total: number) => `${shown} of ${total} entries`,
    pendingBadge: "pending timeline integration",
    metadataBadge: "dataset metadata",
    assessment: "Assessment",
  },
};

type Props = {
  lang: Language;
  items: TimelineItem[];
  themes: { id: string; label: string }[];
  /** Base URL of event pages, ending with a slash. */
  eventBase: string;
};

const yearOf = (date: string) => Number(date.slice(0, 4));

export default function TimelineExplorer({ lang, items, themes, eventBase }: Props) {
  const t = LABELS[lang];
  const years = useMemo(() => [...new Set(items.map((i) => yearOf(i.start)))].sort(), [items]);
  const [theme, setTheme] = useState("");
  const [from, setFrom] = useState(years[0] ?? 2007);
  const [to, setTo] = useState(years.at(-1) ?? 2026);
  const [query, setQuery] = useState("");
  const [showPending, setShowPending] = useState(true);
  const [showMetadata, setShowMetadata] = useState(false);
  const id = useId();
  const themeLabel = new Map(themes.map((th) => [th.id, th.label]));

  // Deep link: ?tema=<theme> (also ?theme=)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("tema") ?? params.get("theme");
    if (requested && themes.some((th) => th.id === requested)) setTheme(requested);
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
        aria-label={t.filters}
      >
        <label className="flex flex-col text-sm">
          {t.theme}
          <select value={theme} onChange={(e) => setTheme(e.target.value)} className="border p-1">
            <option value="">{t.allThemes}</option>
            {themes.map((th) => (
              <option key={th.id} value={th.id}>
                {th.label}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="flex gap-2 text-sm">
          <legend className="sr-only">{t.period}</legend>
          <label className="flex flex-col">
            {t.from}
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
            {t.to}
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
          {t.text}
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="border p-1"
            placeholder={t.placeholder}
          />
        </label>
        <div className="flex flex-col text-sm gap-1">
          <label>
            <input
              type="checkbox"
              checked={showPending}
              onChange={(e) => setShowPending(e.target.checked)}
            />{" "}
            {t.pending}
          </label>
          <label>
            <input
              type="checkbox"
              checked={showMetadata}
              onChange={(e) => setShowMetadata(e.target.checked)}
            />{" "}
            {t.metadata}
          </label>
        </div>
      </form>

      <p className="meta mt-3" aria-live="polite">
        {t.count(visible.length, items.length)}
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
                  <span title={PRECISION_LABELS[item.precision][lang]}>
                    {formatDateRange(item.start, item.end, lang)}
                  </span>
                  {item.geography && <> · {item.geography}</>}
                  {" · "}
                  <span className="font-mono">{item.id}</span>
                  {item.pending && <span className="badge ml-2">{t.pendingBadge}</span>}
                  {item.metadata && <span className="badge ml-2">{t.metadataBadge}</span>}
                </div>
                <a href={`${eventBase}${item.id}/`} className="font-semibold">
                  {item.title}
                </a>
                {item.evidence_note && (
                  <div className="meta">
                    {t.assessment}: {item.evidence_note}
                  </div>
                )}
                <div className="meta">
                  {item.themes.map((th) => themeLabel.get(th)).join(" · ")}
                </div>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
