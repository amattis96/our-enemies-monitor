import { useEffect, useId, useMemo, useState } from "react";
import type { Language } from "../../../src/model/index.ts";
import { formatDateRange, PRECISION_LABELS } from "../../../src/site/format.ts";
import type { TimelineItem } from "../../../src/site/read-model.ts";
import {
  DEFAULT_FILTERS,
  matches,
  orderTimeline,
  parseFilters,
  serializeFilters,
  type TimelineFilters,
  yearCounts,
  yearOf,
} from "../../../src/site/timeline.ts";
import { EVIDENCE_ICON, EVIDENCE_SHORT, THEME_ICON } from "../../../src/site/visual.ts";

const LABELS = {
  it: {
    filters: "Filtri della cronologia",
    theme: "Tema",
    allThemes: "Tutti i temi",
    text: "Testo, ID o luogo",
    placeholder: "es. Baltico, TL-0060",
    pending: "Evidenze da integrare (EXT)",
    metadata: "Metadati del dataset",
    count: (shown: number, total: number) => `${shown} voci su ${total}`,
    pendingBadge: "Da integrare",
    metadataBadge: "Metadato del dataset",
    assessment: "Valutazione",
    newest: "Più recenti",
    oldest: "Più vecchi",
    order: "Ordine",
    density: "Eventi per anno: scegli un anno per filtrare",
    period: (from: number, to: number) => (from === to ? `Anno ${from}` : `Dal ${from} al ${to}`),
    allYears: "Tutti gli anni",
    reset: "Azzera i filtri",
    empty: "Nessuna voce corrisponde ai filtri.",
    yearItems: (n: number) => (n === 1 ? "1 voce" : `${n} voci`),
  },
  en: {
    filters: "Timeline filters",
    theme: "Theme",
    allThemes: "All themes",
    text: "Text, ID or place",
    placeholder: "e.g. Baltic, TL-0060",
    pending: "Evidence pending integration (EXT)",
    metadata: "Dataset metadata",
    count: (shown: number, total: number) => `${shown} of ${total} entries`,
    pendingBadge: "Pending integration",
    metadataBadge: "Dataset metadata",
    assessment: "Assessment",
    newest: "Newest",
    oldest: "Oldest",
    order: "Order",
    density: "Events per year: choose a year to filter",
    period: (from: number, to: number) => (from === to ? `Year ${from}` : `${from} to ${to}`),
    allYears: "All years",
    reset: "Reset filters",
    empty: "No entry matches the filters.",
    yearItems: (n: number) => (n === 1 ? "1 entry" : `${n} entries`),
  },
};

type Props = {
  lang: Language;
  items: TimelineItem[];
  themes: { id: string; label: string }[];
  /** Base URL of event pages, ending with a slash. */
  eventBase: string;
  /** URL of the icon sprite. */
  sprite: string;
};

function Icon({ sprite, name }: { sprite: string; name: string }) {
  return (
    <svg className="icon" aria-hidden="true" focusable="false">
      <use href={`${sprite}#${name}`} />
    </svg>
  );
}

export default function TimelineExplorer({ lang, items, themes, eventBase, sprite }: Props) {
  const t = LABELS[lang];
  const id = useId();
  const [f, setF] = useState<TimelineFilters>(DEFAULT_FILTERS);
  const themeLabel = useMemo(() => new Map(themes.map((th) => [th.id, th.label])), [themes]);

  // Deep links in, filter state out (replaceState: no history spam).
  useEffect(() => {
    setF(parseFilters(window.location.search));
  }, []);
  useEffect(() => {
    const next = `${window.location.pathname}${serializeFilters(f)}${window.location.hash}`;
    if (next !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
      window.history.replaceState(null, "", next);
    }
  }, [f]);

  const update = (patch: Partial<TimelineFilters>) => setF((prev) => ({ ...prev, ...patch }));
  // The density bar counts everything except the year filter itself.
  const unyeared = useMemo(
    () => items.filter((item) => matches(item, { ...f, from: null, to: null })),
    [items, f],
  );
  const bars = useMemo(() => {
    const all = yearCounts(items);
    const counts = new Map(yearCounts(unyeared).map((b) => [b.year, b.count]));
    return all.map((b) => ({ year: b.year, count: counts.get(b.year) ?? 0 })).reverse();
  }, [items, unyeared]);
  const max = Math.max(1, ...bars.map((b) => b.count));
  const visible = useMemo(
    () =>
      orderTimeline(
        unyeared.filter((item) => matches(item, f)),
        f.order,
      ),
    [unyeared, f],
  );

  const byYear: [number, TimelineItem[]][] = [];
  for (const item of visible) {
    const year = yearOf(item.start);
    const last = byYear.at(-1);
    if (last && last[0] === year) last[1].push(item);
    else byYear.push([year, [item]]);
  }

  const pickYear = (year: number) =>
    f.from === year && f.to === year
      ? update({ from: null, to: null })
      : update({ from: year, to: year });
  const filtered = serializeFilters({ ...f, order: "newest" }) !== "";

  return (
    <div className="tl">
      <form className="tl-filters" onSubmit={(e) => e.preventDefault()} aria-label={t.filters}>
        <label className="tl-field tl-search">
          <span className="kicker">{t.text}</span>
          <input
            type="search"
            value={f.query}
            onChange={(e) => update({ query: e.target.value })}
            placeholder={t.placeholder}
          />
        </label>
        <label className="tl-field">
          <span className="kicker">{t.theme}</span>
          <select value={f.theme} onChange={(e) => update({ theme: e.target.value })}>
            <option value="">{t.allThemes}</option>
            {themes.map((th) => (
              <option key={th.id} value={th.id}>
                {th.label}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="tl-field">
          <legend className="kicker">{t.order}</legend>
          <div className="seg self-start">
            <button
              type="button"
              aria-pressed={f.order === "newest"}
              onClick={() => update({ order: "newest" })}
            >
              {t.newest}
            </button>
            <button
              type="button"
              aria-pressed={f.order === "oldest"}
              onClick={() => update({ order: "oldest" })}
            >
              {t.oldest}
            </button>
          </div>
        </fieldset>
        <div className="tl-field tl-toggles">
          <label>
            <input
              type="checkbox"
              checked={f.pending}
              onChange={(e) => update({ pending: e.target.checked })}
            />{" "}
            {t.pending}
          </label>
          <label>
            <input
              type="checkbox"
              checked={f.metadata}
              onChange={(e) => update({ metadata: e.target.checked })}
            />{" "}
            {t.metadata}
          </label>
        </div>
      </form>

      <fieldset className="tl-density">
        <legend className="sr-only">{t.density}</legend>
        <div className="tl-bars">
          {bars.map((b) => {
            const selected = f.from !== null && f.to !== null && b.year >= f.from && b.year <= f.to;
            return (
              <button
                key={b.year}
                type="button"
                className="tl-bar"
                aria-pressed={selected}
                aria-label={`${b.year}: ${t.yearItems(b.count)}`}
                title={`${b.year}: ${t.yearItems(b.count)}`}
                onClick={() => pickYear(b.year)}
              >
                <span style={{ height: `${Math.max(b.count ? 6 : 2, (b.count / max) * 100)}%` }} />
              </button>
            );
          })}
        </div>
        <div className="tl-axis mono">
          <span>{bars[0]?.year}</span>
          <span>{bars.at(-1)?.year}</span>
        </div>
      </fieldset>

      <div className="tl-status">
        <p className="meta" aria-live="polite">
          {t.count(visible.length, items.length)}
          {f.from !== null && f.to !== null && <> · {t.period(f.from, f.to)}</>}
        </p>
        {filtered && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setF({ ...DEFAULT_FILTERS, order: f.order })}
          >
            {t.reset}
          </button>
        )}
      </div>

      {visible.length === 0 && <p className="tl-empty">{t.empty}</p>}

      <div className="tl-spine">
        {byYear.map(([year, entries]) => (
          <section key={year} aria-labelledby={`${id}-${year}`} className="tl-year">
            <h2 id={`${id}-${year}`} className="tl-year-label">
              {year} <span className="tl-year-count">{entries.length}</span>
            </h2>
            <ol className="tl-items">
              {entries.map((item) => (
                <li
                  key={item.id}
                  className={`tl-item reveal${item.pending ? " is-pending" : ""}${item.metadata ? " is-meta" : ""}`}
                >
                  <div className="tl-meta mono">
                    <span>{formatDateRange(item.start, item.end, lang)}</span>
                    {item.precision !== "day" && (
                      <span
                        className={`tl-fuzzy tl-fuzzy-${item.precision}`}
                        title={PRECISION_LABELS[item.precision][lang]}
                      >
                        <span className="sr-only">{PRECISION_LABELS[item.precision][lang]}</span>
                      </span>
                    )}
                    {item.geography && <span className="tl-place">{item.geography}</span>}
                    <span>{item.id}</span>
                    {item.pending && (
                      <span className="status">
                        <Icon sprite={sprite} name="st-pending" />
                        {t.pendingBadge}
                      </span>
                    )}
                    {item.metadata && <span className="status">{t.metadataBadge}</span>}
                  </div>
                  <h3 className="tl-title">
                    <a href={`${eventBase}${item.id}/`}>{item.title}</a>
                  </h3>
                  {item.evidence_note && (
                    <p className="tl-note">
                      {t.assessment}: {item.evidence_note}
                    </p>
                  )}
                  <div className="tl-tags">
                    {item.evidence_level && (
                      <span className="stamp" data-level={item.evidence_level}>
                        <Icon sprite={sprite} name={EVIDENCE_ICON[item.evidence_level]} />
                        {item.evidence_level}
                        <span className="sr-only">
                          {" "}
                          {EVIDENCE_SHORT[item.evidence_level][lang]}
                        </span>
                      </span>
                    )}
                    {item.themes.map((th) => (
                      <button
                        key={th}
                        type="button"
                        className="chip"
                        onClick={() => update({ theme: th })}
                      >
                        <Icon sprite={sprite} name={THEME_ICON(th)} />
                        {themeLabel.get(th)}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}
