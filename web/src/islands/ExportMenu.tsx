import { useEffect, useRef } from "react";
import { cleanExportDetail, cleanExportLabel } from "../../../src/site/glossary.ts";

/**
 * «Esporta» disclosure shared by the islands; same markup and classes as
 * `components/ExportMenu.astro`. An item either links to a published file or
 * builds one from the current view (`onSelect`).
 */
export type ExportItem = {
  format: string;
  label: string;
  detail?: string | undefined;
  href?: string;
  onSelect?: () => void;
};
export type ExportGroup = { title: string; items: ExportItem[] };

type Props = { label: string; groups: ExportGroup[]; sprite: string };

export function ExportMenu({ label, groups, sprite }: Props) {
  const ref = useRef<HTMLDetailsElement>(null);
  const lang =
    typeof document !== "undefined" && document.documentElement.lang === "en" ? "en" : "it";

  useEffect(() => {
    const menu = ref.current;
    if (!menu) return;
    const outside = (event: PointerEvent) => {
      if (menu.open && !menu.contains(event.target as Node)) menu.open = false;
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && menu.open) {
        menu.open = false;
        menu.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    menu.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", outside);
      menu.removeEventListener("keydown", onKey);
    };
  }, []);
  const close = () => {
    if (ref.current) ref.current.open = false;
  };
  return (
    <details className="export-menu no-print" ref={ref} data-pagefind-ignore>
      <summary className="btn btn-ghost export-trigger">
        <svg className="icon" aria-hidden="true">
          <use href={`${sprite}#ui-download`} />
        </svg>
        {label}
        <svg className="icon export-chevron" aria-hidden="true">
          <use href={`${sprite}#ui-chevron-down`} />
        </svg>
      </summary>
      <div className="export-panel">
        {groups.map((group) => (
          <section key={group.title} aria-label={group.title}>
            <p className="kicker">{group.title}</p>
            <ul>
              {group.items.map((item) => {
                const displayLabel = cleanExportLabel(item.label, lang);
                const displayDetail = cleanExportDetail(item.detail, lang);
                const body = (
                  <>
                    <span className="export-format">{item.format}</span>
                    <span className="export-text">
                      <span className="export-label">{displayLabel}</span>
                      {displayDetail && <span className="export-detail">{displayDetail}</span>}
                    </span>
                  </>
                );
                return (
                  <li key={`${item.format}-${item.label}`}>
                    {item.href ? (
                      <a className="export-item" href={item.href} download onClick={close}>
                        {body}
                      </a>
                    ) : (
                      <button
                        type="button"
                        className="export-item"
                        onClick={() => {
                          item.onSelect?.();
                          close();
                        }}
                      >
                        {body}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </details>
  );
}
