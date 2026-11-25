import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { Language } from "../../../src/model/index.ts";
import { type CsvColumn, exportFileName, toCsv } from "../../../src/site/csv.ts";
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
import { CSV_TYPE, downloadText, JSON_TYPE } from "../lib/download.ts";
import { ExportMenu } from "./ExportMenu.tsx";

export type TimelineExtendedFilters = TimelineFilters & {
  domain: string;
  relationType: string;
  level: string;
  status: "" | "integrated" | "pending";
  provenance: string;
  knowledgeDate: string;
};

export const DEFAULT_EXTENDED_FILTERS: TimelineExtendedFilters = {
  ...DEFAULT_FILTERS,
  domain: "",
  relationType: "",
  level: "",
  status: "",
  provenance: "",
  knowledgeDate: "",
};

/** Parse URL search params into full timeline filters (preserving legacy ?tema= deep links). */
export function parseTimelineFilters(search: string): TimelineExtendedFilters {
  const base = parseFilters(search);
  const p = new URLSearchParams(search);
  const rawStatus = p.get("stato") ?? p.get("status") ?? "";
  const status = rawStatus === "integrated" || rawStatus === "pending" ? rawStatus : "";
  return {
    ...base,
    domain: p.get("dominio") ?? p.get("domain") ?? "",
    relationType: p.get("relazione") ?? p.get("relation") ?? "",
    level: p.get("livello") ?? p.get("level") ?? "",
    status,
    provenance: p.get("provenienza") ?? p.get("provenance") ?? "",
    knowledgeDate: p.get("conoscenza") ?? p.get("knowledge") ?? "",
  };
}

/** Serialize only non-default timeline filters into a shareable query string. */
export function serializeTimelineFilters(f: TimelineExtendedFilters): string {
  const baseStr = serializeFilters(f);
  const p = new URLSearchParams(baseStr.startsWith("?") ? baseStr.slice(1) : baseStr);
  if (f.domain.trim()) p.set("dominio", f.domain.trim());
  if (f.relationType.trim()) p.set("relazione", f.relationType.trim());
  if (f.level) p.set("livello", f.level);
  if (f.status) p.set("stato", f.status);
  if (f.provenance.trim()) p.set("provenienza", f.provenance.trim());
  if (f.knowledgeDate.trim()) p.set("conoscenza", f.knowledgeDate.trim());
  const s = p.toString();
  return s ? `?${s}` : "";
}

/** Match an item against base and extended URL-synced filters. */
export function matchesExtended(item: TimelineItem, f: TimelineExtendedFilters): boolean {
  if (!matches(item, f)) return false;
  if (f.level && item.evidence_level !== f.level) return false;
  if (f.status === "integrated" && item.pending) return false;
  if (f.status === "pending" && !item.pending) return false;
  if (f.domain.trim()) {
    const dom = f.domain.trim().toLowerCase();
    const hay = `${item.themes.join(" ")} ${item.geography ?? ""} ${item.title}`.toLowerCase();
    if (!hay.includes(dom)) return false;
  }
  if (f.relationType.trim()) {
    const rel = f.relationType.trim().toLowerCase();
    const hay = `${item.title} ${item.evidence_note ?? ""}`.toLowerCase();
    if (!hay.includes(rel)) return false;
  }
  if (f.provenance.trim()) {
    const prov = f.provenance.trim().toLowerCase();
    const hay = `${item.id} ${item.geography ?? ""} ${item.evidence_note ?? ""}`.toLowerCase();
    if (!hay.includes(prov)) return false;
  }
  if (f.knowledgeDate.trim()) {
    const kd = f.knowledgeDate.trim();
    if (item.start > kd) return false;
  }
  return true;
}

/** Count active non-default filters for the mobile filter sheet badge. */
export function countActiveTimelineFilters(f: TimelineExtendedFilters): number {
  let count = 0;
  if (f.theme) count++;
  if (f.from !== null || f.to !== null) count++;
  if (f.query.trim()) count++;
  if (!f.pending) count++;
  if (f.metadata) count++;
  if (f.domain.trim()) count++;
  if (f.relationType.trim()) count++;
  if (f.level) count++;
  if (f.status) count++;
  if (f.provenance.trim()) count++;
  if (f.knowledgeDate.trim()) count++;
  return count;
}

const LABELS = {
  it: {
    filters: "Filtri della cronologia",
    mobileFilters: (n: number) => (n > 0 ? `Filtri (${n})` : "Filtri"),
    applyFilters: "Applica filtri",
    closeFilters: "Chiudi filtri",
    moreFilters: "Filtri avanzati",
    theme: "Tema",
    allThemes: "Tutti i temi",
    text: "Testo, ID o luogo",
    placeholder: "es. Baltico, TL-0060",
    domain: "Dominio",
    domainPlaceholder: "es. cyber, energy",
    relationType: "Tipo di relazione",
    relationPlaceholder: "es. attribuzione, sanzione",
    level: "Livello",
    allLevels: "Tutti i livelli",
    status: "Stato evidenza",
    statusAll: "Tutti gli stati",
    statusIntegrated: "Integrati",
    statusPending: "Da integrare (EXT)",
    provenance: "Provenienza / fonte",
    provenancePlaceholder: "es. Fonte_01, EU",
    knowledgeDate: "Data conoscenza (fino a)",
    pending: "Evidenze da integrare (EXT)",
    metadata: "Metadati del dataset",
    count: (shown: number, total: number) => `${shown} voci su ${total}`,
    pendingBadge: "Da integrare",
    metadataBadge: "Metadato del dataset",
    assessment: "Avvertenza / valutazione",
    defaultCaveat:
      "Ogni voce documenta solo ciò che le fonti citate stabiliscono alla data indicata.",
    details: "Dettagli estesi",
    precision: "Precisione data",
    places: "Luoghi",
    endDate: "Fine",
    newest: "Più recenti",
    oldest: "Più vecchi",
    order: "Ordine",
    density: "Eventi per anno: scegli un anno per filtrare",
    period: (from: number, to: number) => (from === to ? `Anno ${from}` : `Dal ${from} al ${to}`),
    allYears: "Tutti gli anni",
    reset: "Azzera i filtri",
    empty: "Nessuna voce corrisponde ai filtri.",
    yearItems: (n: number) => (n === 1 ? "1 voce" : `${n} voci`),
    export: "Esporta",
    exportView: "Vista corrente",
    exportAll: "Dataset completo",
    viewCsv: "Voci visibili (foglio di calcolo)",
    viewJson: "Voci visibili (dati strutturati)",
    viewDetail: (n: number) => `${n} voci con i filtri e l'ordine attuali`,
    allCsv: "Tutti gli eventi pubblicati",
    allJson: "Tutti gli eventi, record completi",
    allDetail: "Testi in italiano e inglese, fonti, revisione",
  },
  en: {
    filters: "Timeline filters",
    mobileFilters: (n: number) => (n > 0 ? `Filters (${n})` : "Filters"),
    applyFilters: "Apply filters",
    closeFilters: "Close filters",
    moreFilters: "Advanced filters",
    theme: "Theme",
    allThemes: "All themes",
    text: "Text, ID or place",
    placeholder: "e.g. Baltic, TL-0060",
    domain: "Domain",
    domainPlaceholder: "e.g. cyber, energy",
    relationType: "Relation type",
    relationPlaceholder: "e.g. attribution, sanction",
    level: "Evidence level",
    allLevels: "All levels",
    status: "Evidentiary status",
    statusAll: "All statuses",
    statusIntegrated: "Integrated",
    statusPending: "Pending integration (EXT)",
    provenance: "Provenance / source",
    provenancePlaceholder: "e.g. Fonte_01, EU",
    knowledgeDate: "Knowledge date (up to)",
    pending: "Evidence pending integration (EXT)",
    metadata: "Dataset metadata",
    count: (shown: number, total: number) => `${shown} of ${total} entries`,
    pendingBadge: "Pending integration",
    metadataBadge: "Dataset metadata",
    assessment: "Caveat / assessment",
    defaultCaveat: "Each entry documents only what cited sources establish as of the stated date.",
    details: "Extended details",
    precision: "Date precision",
    places: "Places",
    endDate: "End",
    newest: "Newest",
    oldest: "Oldest",
    order: "Order",
    density: "Events per year: choose a year to filter",
    period: (from: number, to: number) => (from === to ? `Year ${from}` : `${from} to ${to}`),
    allYears: "All years",
    reset: "Reset filters",
    empty: "No entry matches the filters.",
    yearItems: (n: number) => (n === 1 ? "1 entry" : `${n} entries`),
    export: "Export",
    exportView: "Current view",
    exportAll: "Full dataset",
    viewCsv: "Visible entries (spreadsheet)",
    viewJson: "Visible entries (structured data)",
    viewDetail: (n: number) => `${n} entries with the current filters and order`,
    allCsv: "All published events",
    allJson: "All events, full records",
    allDetail: "Italian and English text, sources, review",
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
  /** Base URL of the published data exports (`data/v1/`), ending with a slash. */
  dataBase: string;
};

function Icon({ sprite, name }: { sprite: string; name: string }) {
  return (
    <svg className="icon" aria-hidden="true" focusable="false">
      <use href={`${sprite}#${name}`} />
    </svg>
  );
}

export default function TimelineExplorer({
  lang,
  items,
  themes,
  eventBase,
  sprite,
  dataBase,
}: Props) {
  const t = LABELS[lang];
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const filtersRef = useRef<HTMLFormElement>(null);
  const [f, setF] = useState<TimelineExtendedFilters>(DEFAULT_EXTENDED_FILTERS);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const themeLabel = useMemo(() => new Map(themes.map((th) => [th.id, th.label])), [themes]);

  // Deep links in, filter state out (replaceState: no history spam).
  useEffect(() => {
    setF(parseTimelineFilters(window.location.search));
    const mq = window.matchMedia("(max-width: 759px)");
    const updateMq = () => setIsMobile(mq.matches);
    updateMq();
    mq.addEventListener("change", updateMq);
    return () => mq.removeEventListener("change", updateMq);
  }, []);
  useEffect(() => {
    const next = `${window.location.pathname}${serializeTimelineFilters(f)}${window.location.hash}`;
    if (next !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
      window.history.replaceState(null, "", next);
    }
  }, [f]);

  // Sticky offsets follow the real heights of the site header and of the
  // filter bar (they wrap differently by viewport, font and platform).
  useEffect(() => {
    const root = rootRef.current;
    const filters = filtersRef.current;
    const header = document.querySelector<HTMLElement>(".site-header");
    if (!root || !filters) return;
    const measure = () => {
      root.style.setProperty("--tl-top", `${header?.offsetHeight ?? 60}px`);
      root.style.setProperty("--tl-filters", `${filters.offsetHeight}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(filters);
    if (header) observer.observe(header);
    return () => observer.disconnect();
  }, []);

  const update = (patch: Partial<TimelineExtendedFilters>) =>
    setF((prev) => ({ ...prev, ...patch }));
  // The density bar counts everything except the year filter itself.
  const unyeared = useMemo(
    () => items.filter((item) => matchesExtended(item, { ...f, from: null, to: null })),
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
        unyeared.filter((item) => matchesExtended(item, f)),
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
  const activeCount = countActiveTimelineFilters(f);
  const filtered = activeCount > 0;

  const exportRows = () =>
    visible.map((item) => ({
      ...item,
      themes: item.themes.map((th) => themeLabel.get(th) ?? th),
      url: new URL(`${eventBase}${item.id}/`, window.location.href).href,
    }));
  type Row = ReturnType<typeof exportRows>[number];
  const columns: CsvColumn<Row>[] = [
    { name: "id", value: (r) => r.id },
    { name: "date_start", value: (r) => r.start },
    { name: "date_end", value: (r) => r.end },
    { name: "date_precision", value: (r) => r.precision },
    { name: "title", value: (r) => r.title },
    { name: "geography", value: (r) => r.geography },
    { name: "places", value: (r) => r.places },
    { name: "themes", value: (r) => r.themes },
    { name: "evidence_level", value: (r) => r.evidence_level },
    { name: "evidence_note", value: (r) => r.evidence_note },
    { name: "pending_integration", value: (r) => r.pending },
    { name: "dataset_metadata", value: (r) => r.metadata },
    { name: "url", value: (r) => r.url },
  ];
  const exportGroups = [
    {
      title: t.exportView,
      items: [
        {
          format: "CSV",
          label: t.viewCsv,
          detail: t.viewDetail(visible.length),
          onSelect: () =>
            downloadText(
              exportFileName("timeline", lang, "csv"),
              toCsv(columns, exportRows()),
              CSV_TYPE,
            ),
        },
        {
          format: "JSON",
          label: t.viewJson,
          detail: t.viewDetail(visible.length),
          onSelect: () =>
            downloadText(
              exportFileName("timeline", lang, "json"),
              `${JSON.stringify(
                {
                  view: window.location.href,
                  language: lang,
                  filters: f,
                  count: visible.length,
                  items: exportRows(),
                },
                null,
                2,
              )}\n`,
              JSON_TYPE,
            ),
        },
      ],
    },
    {
      title: t.exportAll,
      items: [
        { format: "CSV", label: t.allCsv, detail: t.allDetail, href: `${dataBase}events.csv` },
        { format: "JSON", label: t.allJson, detail: t.allDetail, href: `${dataBase}events.json` },
      ],
    },
  ];

  const filterControls = (
    <>
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
      <details style={{ gridColumn: "1 / -1" }}>
        <summary className="kicker">{t.moreFilters}</summary>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(11rem, 1fr))",
            gap: "var(--space-3)",
            paddingTop: "var(--space-3)",
          }}
        >
          <label className="tl-field">
            <span className="kicker">{t.domain}</span>
            <input
              type="search"
              value={f.domain}
              onChange={(e) => update({ domain: e.target.value })}
              placeholder={t.domainPlaceholder}
            />
          </label>
          <label className="tl-field">
            <span className="kicker">{t.relationType}</span>
            <input
              type="search"
              value={f.relationType}
              onChange={(e) => update({ relationType: e.target.value })}
              placeholder={t.relationPlaceholder}
            />
          </label>
          <label className="tl-field">
            <span className="kicker">{t.level}</span>
            <select value={f.level} onChange={(e) => update({ level: e.target.value })}>
              <option value="">{t.allLevels}</option>
              <option value="E1">E1</option>
              <option value="E2">E2</option>
              <option value="E3">E3</option>
              <option value="E4">E4</option>
            </select>
          </label>
          <label className="tl-field">
            <span className="kicker">{t.status}</span>
            <select
              value={f.status}
              onChange={(e) =>
                update({ status: e.target.value as TimelineExtendedFilters["status"] })
              }
            >
              <option value="">{t.statusAll}</option>
              <option value="integrated">{t.statusIntegrated}</option>
              <option value="pending">{t.statusPending}</option>
            </select>
          </label>
          <label className="tl-field">
            <span className="kicker">{t.provenance}</span>
            <input
              type="search"
              value={f.provenance}
              onChange={(e) => update({ provenance: e.target.value })}
              placeholder={t.provenancePlaceholder}
            />
          </label>
          <label className="tl-field">
            <span className="kicker">{t.knowledgeDate}</span>
            <input
              type="search"
              value={f.knowledgeDate}
              onChange={(e) => update({ knowledgeDate: e.target.value })}
              placeholder="YYYY-MM-DD"
            />
          </label>
        </div>
      </details>
    </>
  );

  return (
    <div className="tl" ref={rootRef}>
      {!isMobile && (
        <form
          className="tl-filters"
          ref={filtersRef}
          onSubmit={(e) => e.preventDefault()}
          aria-label={t.filters}
        >
          {filterControls}
        </form>
      )}

      {isMobile && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "var(--space-2)",
            padding: "var(--space-2) 0",
            borderBottom: "1px solid var(--rule)",
          }}
        >
          <button
            type="button"
            className="btn"
            aria-expanded={sheetOpen}
            onClick={() => setSheetOpen(true)}
          >
            {t.mobileFilters(activeCount)}
          </button>
          <div className="seg">
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
        </div>
      )}

      {isMobile && sheetOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t.filters}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            background: "rgb(0 0 0 / 0.45)",
          }}
        >
          <div
            style={{
              background: "var(--paper-raised)",
              color: "var(--ink)",
              borderTop: "2px solid var(--rule-strong)",
              borderRadius: "var(--radius-3) var(--radius-3) 0 0",
              padding: "var(--space-4)",
              maxHeight: "82vh",
              overflowY: "auto",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "var(--space-3)",
              }}
            >
              <span className="kicker">{t.filters}</span>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setSheetOpen(false)}
                aria-label={t.closeFilters}
              >
                {t.closeFilters}
              </button>
            </div>
            <form
              className="tl-filters"
              style={{ position: "static", borderBottom: 0 }}
              onSubmit={(e) => {
                e.preventDefault();
                setSheetOpen(false);
              }}
            >
              {filterControls}
            </form>
            <div
              style={{
                display: "flex",
                gap: "var(--space-2)",
                marginTop: "var(--space-4)",
                justifyContent: "flex-end",
              }}
            >
              {filtered && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setF({ ...DEFAULT_EXTENDED_FILTERS, order: f.order })}
                >
                  {t.reset}
                </button>
              )}
              <button type="button" className="btn" onClick={() => setSheetOpen(false)}>
                {t.applyFilters}
              </button>
            </div>
          </div>
        </div>
      )}

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
        <div className="tl-status-actions">
          {filtered && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setF({ ...DEFAULT_EXTENDED_FILTERS, order: f.order })}
            >
              {t.reset}
            </button>
          )}
          <ExportMenu label={t.export} groups={exportGroups} sprite={sprite} />
        </div>
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
                  <p className="tl-note">
                    {t.assessment}: {item.evidence_note ?? t.defaultCaveat}
                  </p>
                  <details style={{ marginTop: "var(--space-2)" }}>
                    <summary className="meta" style={{ fontSize: "var(--text-xs)" }}>
                      {t.details}
                    </summary>
                    <div
                      style={{
                        paddingTop: "var(--space-2)",
                        display: "grid",
                        gap: "0.35rem",
                        fontSize: "var(--text-xs)",
                        color: "var(--ink-2)",
                      }}
                    >
                      <div>
                        <span className="mono">{t.precision}:</span>{" "}
                        {PRECISION_LABELS[item.precision][lang]}
                        {item.end && (
                          <>
                            {" "}
                            · <span className="mono">{t.endDate}:</span> {item.end}
                          </>
                        )}
                      </div>
                      {item.places.length > 0 && (
                        <div>
                          <span className="mono">{t.places}:</span> {item.places.join(", ")}
                        </div>
                      )}
                    </div>
                  </details>
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
