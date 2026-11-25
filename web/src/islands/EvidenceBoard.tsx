import { select } from "d3-selection";
import "d3-transition";
import { type D3ZoomEvent, type ZoomBehavior, zoom, zoomIdentity } from "d3-zoom";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Language, LocalizedText } from "../../../src/model/index.ts";
import type { BoardLayout } from "../../../src/site/board-layout.ts";
import { cardTilt } from "../../../src/site/board-layout.ts";
import { type CsvColumn, exportFileName, toCsv } from "../../../src/site/csv.ts";
import { formatPredicate } from "../../../src/site/format.ts";
import { pick } from "../../../src/site/i18n.ts";
import type { GraphEdge, GraphNode, HypothesisEdge } from "../../../src/site/read-model.ts";
import {
  EVIDENCE_ICON,
  EVIDENCE_SHORT,
  EVIDENCE_THREAD,
  KIND_ICON,
  RELATION_GROUP_COLOR,
  RELATION_GROUP_ICON,
  RELATION_GROUP_ORDER,
} from "../../../src/site/visual.ts";
import { CSV_TYPE, downloadText, JSON_TYPE } from "../lib/download.ts";
import { BoardCaveat } from "./BoardCaveat.tsx";
import { ExportMenu } from "./ExportMenu.tsx";

const LABELS = {
  it: {
    loading: "Caricamento della bacheca…",
    loadError: "Impossibile caricare i dati della bacheca.",
    groups: "Famiglie di relazione",
    levels: "Livello di evidenza",
    moreFilters: "Filtri avanzati",
    domain: "Dominio / nodo",
    relationType: "Tipo di relazione",
    period: "Periodo",
    status: "Stato evidenza",
    statusAll: "Tutte",
    statusCaveat: "Con avvertenza",
    statusNoCaveat: "Senza avvertenza",
    provenance: "Provenienza / ID",
    knowledgeDate: "Data conoscenza",
    kinds: "Tipi di scheda",
    visible: (n: number, e: number) => `${n} schede, ${e} fili visibili`,
    wheelHint: (mod: string) =>
      `${mod} + rotella o pizzico per lo zoom; trascina lo sfondo per spostarti`,
    board: "Bacheca",
    list: "Elenco",
    view: "Vista",
    zoomIn: "Avvicina",
    zoomOut: "Allontana",
    fit: "Adatta alla vista",
    open: "Apri la scheda completa",
    isolate: "Isola il vicinato",
    release: "Mostra tutta la bacheca",
    close: "Chiudi il fascicolo",
    caseFile: "Fascicolo",
    boardLabel:
      "Bacheca interattiva: trascina lo sfondo per spostarti, la rotella o i pulsanti per lo zoom; ogni scheda è un pulsante che apre il fascicolo. La vista Elenco contiene le stesse informazioni in forma di tabella.",
    empty: "Nessun filo corrisponde ai filtri.",
    reset: "Ripristina i filtri",
    id: "ID",
    subject: "Soggetto",
    predicate: "Relazione (predicato letterale)",
    object: "Oggetto",
    group: "Famiglia",
    level: "Livello",
    hypothesis: "Ipotesi",
    priority: "Priorità",
    tape: "Ipotesi E5 — non sono fatti documentati",
    links: (n: number) => (n === 1 ? "1 collegamento visibile" : `${n} collegamenti visibili`),
    export: "Esporta",
    exportView: "Vista corrente",
    exportAll: "Dataset completo",
    viewCsv: "Fili visibili (foglio di calcolo)",
    viewJson: "Schede e fili visibili (grafo)",
    viewDetail: (n: number, e: number) => `${e} fili e ${n} schede con i filtri attuali`,
    hypViewCsv: "Ipotesi visibili (foglio di calcolo)",
    hypViewDetail: (n: number, e: number) => `${e} ipotesi E5 e ${n} schede: domande, non fatti`,
    allCsv: "Tutte le relazioni pubblicate",
    allHypCsv: "Tutte le ipotesi pubblicate",
    allJson: "Grafo completo",
    allDetail: "Comprese le famiglie escluse dai filtri",
  },
  en: {
    loading: "Loading the board…",
    loadError: "Unable to load the board data.",
    groups: "Relationship families",
    levels: "Evidence level",
    moreFilters: "Advanced filters",
    domain: "Domain / node",
    relationType: "Relation type",
    period: "Period",
    status: "Evidentiary status",
    statusAll: "All",
    statusCaveat: "With caveat",
    statusNoCaveat: "Without caveat",
    provenance: "Provenance / ID",
    knowledgeDate: "Knowledge date",
    kinds: "Card types",
    visible: (n: number, e: number) => `${n} cards, ${e} visible threads`,
    wheelHint: (mod: string) => `${mod} + wheel or pinch to zoom; drag the background to move`,
    board: "Board",
    list: "List",
    view: "View",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    fit: "Fit to view",
    open: "Open the full profile",
    isolate: "Isolate the neighbourhood",
    release: "Show the whole board",
    close: "Close the case file",
    caseFile: "Case file",
    boardLabel:
      "Interactive board: drag the background to move, use the wheel or the buttons to zoom; each card is a button that opens its case file. The List view holds the same information as a table.",
    empty: "No thread matches the filters.",
    reset: "Reset filters",
    id: "ID",
    subject: "Subject",
    predicate: "Relationship (literal predicate)",
    object: "Object",
    group: "Family",
    level: "Level",
    hypothesis: "Hypothesis",
    priority: "Priority",
    tape: "Hypotheses E5 — not documented facts",
    links: (n: number) => (n === 1 ? "1 visible link" : `${n} visible links`),
    export: "Export",
    exportView: "Current view",
    exportAll: "Full dataset",
    viewCsv: "Visible threads (spreadsheet)",
    viewJson: "Visible cards and threads (graph)",
    viewDetail: (n: number, e: number) => `${e} threads and ${n} cards with the current filters`,
    hypViewCsv: "Visible hypotheses (spreadsheet)",
    hypViewDetail: (n: number, e: number) =>
      `${e} E5 hypotheses and ${n} cards: questions, not facts`,
    allCsv: "All published relationships",
    allHypCsv: "All published hypotheses",
    allJson: "Full graph",
    allDetail: "Including the families excluded by the filters",
  },
};

type Props = {
  lang: Language;
  mode: "evidence" | "hypotheses";
  dataUrl: string;
  layout: BoardLayout;
  /** Full collection export (`relationships.csv` or `hypotheses.csv`). */
  collectionCsv: string;
  /** Base URLs of entity and event pages, ending with a slash. */
  entityBase: string;
  eventBase: string;
  groupLabels: Record<string, string>;
  kindLabels: Record<string, string>;
  priorityLabels?: Record<string, string>;
  sprite: string;
};

type Kind = GraphNode["kind"];
type Edge = {
  id: string;
  source: string;
  target: string;
  label: string;
  /** Literal predicate or hypothesis type, as in the data (exports). */
  literal: string;
  group: string;
  level: "E1" | "E2" | "E3" | "E4" | "E5";
  priority?: string;
  caveat?: LocalizedText | null;
};
type Detail = "pin" | "compact" | "full";

const LEVELS = ["E1", "E2", "E3", "E4"] as const;

export type BoardFilters = {
  groups: string[];
  levels: string[];
  domain: string;
  relationType: string;
  period: string;
  status: "" | "with_caveat" | "no_caveat";
  provenance: string;
  knowledgeDate: string;
  focus: string | null;
  isolated: boolean;
  view: "board" | "list";
};

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const setA = new Set(a);
  return b.every((item) => setA.has(item));
}

/** Parse URL query params into board filters, keeping ?focus= compatibility. */
export function parseBoardFilters(
  search: string,
  defaultGroups: string[],
  defaultLevels: string[],
): BoardFilters {
  const p = new URLSearchParams(search);
  const rawGroups = p.get("famiglie") ?? p.get("groups");
  const rawLevels = p.get("livelli") ?? p.get("levels");
  const rawStatus = p.get("stato") ?? p.get("status") ?? "";
  const status = rawStatus === "with_caveat" || rawStatus === "no_caveat" ? rawStatus : "";
  return {
    groups: rawGroups ? rawGroups.split(",").filter(Boolean) : [...defaultGroups],
    levels: rawLevels ? rawLevels.split(",").filter(Boolean) : [...defaultLevels],
    domain: p.get("dominio") ?? p.get("domain") ?? "",
    relationType: p.get("relazione") ?? p.get("relation") ?? "",
    period: p.get("periodo") ?? p.get("period") ?? "",
    status,
    provenance: p.get("provenienza") ?? p.get("provenance") ?? "",
    knowledgeDate: p.get("conoscenza") ?? p.get("knowledge") ?? "",
    focus: p.get("focus"),
    isolated: p.get("isola") === "1" || p.get("isolated") === "1",
    view: p.get("vista") === "list" || p.get("view") === "list" ? "list" : "board",
  };
}

/** Serialize only non-default board filters into a shareable query string. */
export function serializeBoardFilters(
  f: BoardFilters,
  defaultGroups: string[],
  defaultLevels: string[],
): string {
  const p = new URLSearchParams();
  if (!sameSet(f.groups, defaultGroups)) p.set("famiglie", [...f.groups].sort().join(","));
  if (!sameSet(f.levels, defaultLevels)) p.set("livelli", [...f.levels].sort().join(","));
  if (f.domain.trim()) p.set("dominio", f.domain.trim());
  if (f.relationType.trim()) p.set("relazione", f.relationType.trim());
  if (f.period.trim()) p.set("periodo", f.period.trim());
  if (f.status) p.set("stato", f.status);
  if (f.provenance.trim()) p.set("provenienza", f.provenance.trim());
  if (f.knowledgeDate.trim()) p.set("conoscenza", f.knowledgeDate.trim());
  if (f.focus) p.set("focus", f.focus);
  if (f.isolated) p.set("isola", "1");
  if (f.view === "list") p.set("vista", "list");
  const s = p.toString();
  return s ? `?${s}` : "";
}

/** Filter edges by all board filter dimensions. */
export function filterBoardEdges<
  T extends {
    id: string;
    source: string;
    target: string;
    group: string;
    level: string;
    label?: string;
    literal?: string;
    caveat?: LocalizedText | null;
  },
>(edges: T[], f: BoardFilters, hypotheses: boolean, nodeLabels?: Map<string, string>): T[] {
  const groupSet = new Set(f.groups);
  const levelSet = new Set(f.levels);
  const dom = f.domain.trim().toLowerCase();
  const rel = f.relationType.trim().toLowerCase();
  const prov = f.provenance.trim().toLowerCase();
  const per = f.period.trim().toLowerCase();
  const kd = f.knowledgeDate.trim().toLowerCase();
  return edges.filter((e) => {
    if (!hypotheses && (!groupSet.has(e.group) || !levelSet.has(e.level))) return false;
    if (f.isolated && f.focus && e.source !== f.focus && e.target !== f.focus) return false;
    if (f.status === "with_caveat" && !e.caveat) return false;
    if (f.status === "no_caveat" && e.caveat) return false;
    if (rel && !`${e.label ?? ""} ${e.literal ?? ""} ${e.group}`.toLowerCase().includes(rel))
      return false;
    if (dom) {
      const sLabel = nodeLabels?.get(e.source) ?? "";
      const tLabel = nodeLabels?.get(e.target) ?? "";
      if (!`${e.source} ${e.target} ${sLabel} ${tLabel}`.toLowerCase().includes(dom)) return false;
    }
    if (prov && !`${e.id} ${e.caveat?.it ?? ""} ${e.caveat?.en ?? ""}`.toLowerCase().includes(prov))
      return false;
    if (per && !`${e.id} ${e.caveat?.it ?? ""} ${e.caveat?.en ?? ""}`.toLowerCase().includes(per))
      return false;
    if (kd && !`${e.id} ${e.caveat?.it ?? ""} ${e.caveat?.en ?? ""}`.toLowerCase().includes(kd))
      return false;
    return true;
  });
}

/** Keyboard arrow navigation along incident threads from the currently selected card. */
export function nextThreadNeighbor(
  currentId: string,
  edges: { source: string; target: string }[],
  direction: "next" | "prev",
): string | null {
  const neighbors: string[] = [];
  const seen = new Set<string>();
  for (const e of edges) {
    const other = e.source === currentId ? e.target : e.target === currentId ? e.source : null;
    if (other && !seen.has(other)) {
      seen.add(other);
      neighbors.push(other);
    }
  }
  if (neighbors.length === 0) return null;
  return direction === "next" ? (neighbors[0] ?? null) : (neighbors[neighbors.length - 1] ?? null);
}

/** Build an accessible ARIA live announcement string for filter or selection changes. */
export function boardAriaAnnouncement(
  lang: Language,
  counts: { nodes: number; edges: number },
  selectedLabel?: string | null,
  selectedLinks?: number,
): string {
  const base =
    lang === "it"
      ? `${counts.nodes} schede, ${counts.edges} fili visibili.`
      : `${counts.nodes} cards, ${counts.edges} visible threads.`;
  if (!selectedLabel) return base;
  const sel =
    lang === "it"
      ? ` Selezionato ${selectedLabel}, ${selectedLinks ?? 0} collegamenti visibili.`
      : ` Selected ${selectedLabel}, ${selectedLinks ?? 0} visible links.`;
  return `${base}${sel}`;
}

const DEFAULT_SIZE: [number, number] = [158, 78];
const SIZE: Partial<Record<Kind, [number, number]>> = {
  person: [118, 112],
  event: [166, 84],
};
const sizeOf = (kind: Kind): [number, number] => SIZE[kind] ?? DEFAULT_SIZE;

function localized(text: LocalizedText, lang: Language): string {
  return lang === "en" && text.en ? text.en : text.it;
}

/** Up to `lines` lines of about `width` characters, ellipsis on overflow. */
function wrap(text: string, width: number, lines: number): string[] {
  const words = text.split(/\s+/);
  const out: string[] = [];
  let line = "";
  for (const word of words) {
    if (`${line} ${word}`.trim().length > width && line) {
      out.push(line);
      line = word;
    } else line = `${line} ${word}`.trim();
  }
  if (line) out.push(line);
  if (out.length > lines) {
    const kept = out.slice(0, lines);
    kept[lines - 1] = `${(kept[lines - 1] ?? "").slice(0, width - 1).trimEnd()}…`;
    return kept;
  }
  return out;
}

/** Torn clipping outline for event cards, stable per ID. */
function tornPath(id: string, w: number, h: number): string {
  let seed = 0;
  for (const c of id) seed = (seed * 33 + c.charCodeAt(0)) >>> 0;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32 - 0.5;
  };
  const x0 = -w / 2;
  const y0 = -h / 2;
  const pts: string[] = [];
  for (let x = x0; x < -x0; x += 10) pts.push(`${x.toFixed(1)} ${(y0 + rnd() * 3).toFixed(1)}`);
  for (let y = y0; y < -y0; y += 9) pts.push(`${(-x0 + rnd() * 4).toFixed(1)} ${y.toFixed(1)}`);
  for (let x = -x0; x > x0; x -= 10) pts.push(`${x.toFixed(1)} ${(-y0 + rnd() * 3).toFixed(1)}`);
  for (let y = -y0; y > y0; y -= 9) pts.push(`${(x0 + rnd() * 4).toFixed(1)} ${y.toFixed(1)}`);
  return `M${pts.join(" ")}Z`;
}

const CardFace = memo(function CardFace({
  node,
  label,
  kindLabel,
  detail,
  sprite,
}: {
  node: GraphNode;
  label: string;
  kindLabel: string;
  detail: Detail;
  sprite: string;
}) {
  const [w, h] = sizeOf(node.kind);
  const x0 = -w / 2;
  const y0 = -h / 2;
  const ink = "var(--card-ink)";
  const title = (y: number, width: number, lines: number, size = 13.5) =>
    (detail === "pin" ? [] : wrap(label, width, lines)).map((line, i) => (
      <text
        key={line}
        x={x0 + 12}
        y={y + i * (size + 3)}
        fontFamily="var(--font-serif)"
        fontWeight={600}
        fontSize={size}
        fill={ink}
      >
        {line}
      </text>
    ));
  const header =
    detail === "full" ? (
      <>
        <svg x={x0 + 10} y={y0 + 8} width={13} height={13} color={ink} aria-hidden="true">
          <use href={`${sprite}#${KIND_ICON[node.kind]}`} />
        </svg>
        <text
          x={x0 + 28}
          y={y0 + 18}
          fontFamily="var(--font-mono)"
          fontSize={8.5}
          letterSpacing={1}
          fill={ink}
          opacity={0.7}
        >
          {kindLabel.toUpperCase()}
        </text>
      </>
    ) : null;

  switch (node.kind) {
    case "person":
      return (
        <>
          <rect x={x0} y={y0} width={w} height={h} fill="var(--card)" />
          <rect x={x0 + 8} y={y0 + 8} width={w - 16} height={h - 42} fill="#cdc6b6" />
          <circle cx={0} cy={y0 + 32} r={13} fill="#aca492" />
          <path d={`M${-24} ${y0 + h - 34}a24 22 0 0 1 48 0z`} fill="#aca492" />
          {(detail === "pin" ? [] : wrap(label, 16, detail === "full" ? 2 : 1)).map((line, i) => (
            <text
              key={line}
              x={0}
              y={y0 + h - 21 + i * 11}
              textAnchor="middle"
              fontFamily="var(--font-mono)"
              fontSize={9.5}
              fill={ink}
            >
              {line}
            </text>
          ))}
        </>
      );
    case "event":
      return (
        <>
          <path d={tornPath(node.id, w, h)} fill="#efe9da" />
          <rect x={x0 + 10} y={y0 + 9} width={w - 20} height={3} fill={ink} />
          {detail === "full" && (
            <text
              x={x0 + 12}
              y={y0 + 26}
              fontFamily="var(--font-mono)"
              fontSize={9}
              fontWeight={600}
              fill="#a8241c"
            >
              {node.id}
            </text>
          )}
          {title(y0 + (detail === "full" ? 44 : 32), 22, 3, 12.5)}
        </>
      );
    case "organization":
      return (
        <>
          <path d={`M${x0} ${y0 + 6}h46l6 -8h34l4 8H${-x0}V${-y0}H${x0}z`} fill="#dcc188" />
          <rect x={x0 + 5} y={y0 + 10} width={w - 10} height={h - 14} fill="var(--card)" />
          {header}
          {title(y0 + (detail === "full" ? 40 : 34), 19, 2)}
        </>
      );
    case "institution":
      return (
        <>
          <rect x={x0} y={y0} width={w} height={h} fill="var(--card)" />
          <path d={`M${x0 + 10} ${y0 + 25}h${w - 20}`} stroke={ink} strokeWidth={0.8} />
          <path d={`M${x0 + 10} ${y0 + 28}h${w - 20}`} stroke={ink} strokeWidth={2} />
          {header}
          {title(y0 + 46, 19, 2)}
        </>
      );
    case "company":
      return (
        <>
          <rect x={x0} y={y0} width={w} height={h} rx={3} fill="var(--card)" />
          <rect x={x0} y={y0} width={6} height={h} fill="#3a4a5c" />
          {header}
          {title(y0 + (detail === "full" ? 42 : 34), 19, 2)}
        </>
      );
    case "asset":
      return (
        <>
          <rect x={x0} y={y0} width={w} height={h} fill="#dbe5ef" />
          <path
            d={
              Array.from({ length: 7 }, (_, i) => `M${x0 + 20 + i * 20} ${y0}v${h}`).join("") +
              Array.from({ length: 3 }, (_, i) => `M${x0} ${y0 + 20 + i * 20}h${w}`).join("")
            }
            stroke="#7aa0c8"
            strokeWidth={0.6}
            opacity={0.55}
          />
          {header}
          {title(y0 + (detail === "full" ? 42 : 34), 19, 2)}
        </>
      );
    default:
      return (
        <>
          <rect x={x0} y={y0} width={w} height={h} fill="var(--card)" />
          <path d={`M${x0} ${y0 + 24}h${w}`} stroke="#b3261e" strokeWidth={0.8} opacity={0.5} />
          <path
            d={[38, 52, 66].map((y) => `M${x0} ${y0 + y}h${w}`).join("")}
            stroke="#7aa0c8"
            strokeWidth={0.6}
            opacity={0.4}
          />
          {header}
          {title(y0 + (detail === "full" ? 42 : 34), 19, 2)}
        </>
      );
  }
});

export default function EvidenceBoard(props: Props) {
  const { lang, mode, dataUrl, layout, groupLabels, kindLabels, sprite } = props;
  const t = LABELS[lang];
  const hypotheses = mode === "hypotheses";
  const svgRef = useRef<SVGSVGElement>(null);
  const viewportRef = useRef<SVGGElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const scaleRef = useRef(1);
  const defaultGroupList = useMemo(
    () => Object.keys(groupLabels).filter((g) => g !== "participation"),
    [groupLabels],
  );
  const defaultLevelList = useMemo(() => [...LEVELS], []);
  const [data, setData] = useState<{ nodes: GraphNode[]; edges: Edge[] } | null>(null);
  const [failed, setFailed] = useState(false);
  const [groups, setGroups] = useState(() => new Set(defaultGroupList));
  const [levels, setLevels] = useState<Set<string>>(() => new Set(defaultLevelList));
  const [domain, setDomain] = useState("");
  const [relationType, setRelationType] = useState("");
  const [period, setPeriod] = useState("");
  const [status, setStatus] = useState<"" | "with_caveat" | "no_caveat">("");
  const [provenance, setProvenance] = useState("");
  const [knowledgeDate, setKnowledgeDate] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [isolated, setIsolated] = useState(false);
  const [view, setView] = useState<"board" | "list">("board");
  const [detail, setDetail] = useState<Detail>("compact");
  const [moved, setMoved] = useState<Record<string, [number, number]>>({});
  const urlInitialized = useRef(false);
  const drag = useRef<{
    id: string;
    x: number;
    y: number;
    px: number;
    py: number;
    travel: number;
  } | null>(null);
  const reduced = useRef(false);
  // Set on <html> before paint by the layout: ⌘ on Apple platforms, Ctrl elsewhere.
  const modifier =
    typeof document !== "undefined" && document.documentElement.dataset.platform === "apple"
      ? "⌘"
      : "Ctrl";

  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    fetch(dataUrl)
      .then((response) => response.json())
      .then((json: { nodes: GraphNode[]; edges: (GraphEdge | HypothesisEdge)[] }) =>
        setData({
          nodes: json.nodes,
          edges: json.edges.map((e) =>
            "predicate" in e
              ? {
                  ...e,
                  label: formatPredicate(e.predicate),
                  literal: e.predicate,
                  level: e.evidence_level,
                }
              : {
                  ...e,
                  caveat: null,
                  group: "hypothesis",
                  level: "E5",
                  label: formatPredicate(e.hypothesis_type),
                  literal: e.hypothesis_type,
                  priority: e.priority,
                },
          ),
        }),
      )
      .catch(() => setFailed(true));
  }, [dataUrl]);

  const nodeById = useMemo(() => new Map((data?.nodes ?? []).map((n) => [n.id, n])), [data]);
  const nodeLabelsMap = useMemo(
    () => new Map((data?.nodes ?? []).map((n) => [n.id, localized(n.label, lang)])),
    [data, lang],
  );
  const position = useCallback(
    (id: string): [number, number] => moved[id] ?? layout[id] ?? [0, 0],
    [moved, layout],
  );

  // Sync URL filters in on mount and out on state changes.
  useEffect(() => {
    if (urlInitialized.current) return;
    urlInitialized.current = true;
    const parsed = parseBoardFilters(window.location.search, defaultGroupList, defaultLevelList);
    setGroups(new Set(parsed.groups));
    setLevels(new Set(parsed.levels));
    setDomain(parsed.domain);
    setRelationType(parsed.relationType);
    setPeriod(parsed.period);
    setStatus(parsed.status);
    setProvenance(parsed.provenance);
    setKnowledgeDate(parsed.knowledgeDate);
    if (parsed.focus) setSelected(parsed.focus);
    setIsolated(parsed.isolated);
    setView(parsed.view);
  }, [defaultGroupList, defaultLevelList]);

  useEffect(() => {
    const query = serializeBoardFilters(
      {
        groups: [...groups],
        levels: [...levels],
        domain,
        relationType,
        period,
        status,
        provenance,
        knowledgeDate,
        focus: selected,
        isolated,
        view,
      },
      defaultGroupList,
      defaultLevelList,
    );
    const next = `${window.location.pathname}${query}${window.location.hash}`;
    if (next !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
      window.history.replaceState(null, "", next);
    }
  }, [
    groups,
    levels,
    domain,
    relationType,
    period,
    status,
    provenance,
    knowledgeDate,
    selected,
    isolated,
    view,
    defaultGroupList,
    defaultLevelList,
  ]);

  const visible = useMemo(() => {
    if (!data) return { nodes: [] as GraphNode[], edges: [] as Edge[] };
    const edges = filterBoardEdges(
      data.edges,
      {
        groups: [...groups],
        levels: [...levels],
        domain,
        relationType,
        period,
        status,
        provenance,
        knowledgeDate,
        focus: selected,
        isolated,
        view,
      },
      hypotheses,
      nodeLabelsMap,
    );
    const ids = new Set(edges.flatMap((e) => [e.source, e.target]));
    return { nodes: data.nodes.filter((n) => ids.has(n.id)), edges };
  }, [
    data,
    groups,
    levels,
    domain,
    relationType,
    period,
    status,
    provenance,
    knowledgeDate,
    hypotheses,
    isolated,
    selected,
    view,
    nodeLabelsMap,
  ]);

  const neighbours = useMemo(() => {
    if (!selected) return null;
    const set = new Set([selected]);
    for (const e of visible.edges) {
      if (e.source === selected) set.add(e.target);
      if (e.target === selected) set.add(e.source);
    }
    return set;
  }, [selected, visible.edges]);

  // Zoom and pan (d3-zoom); the transform is written straight to the DOM.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || view !== "board") return;
    const behaviour = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.15, 2.5])
      .filter((event: Event) => {
        const target = event.target as Element | null;
        if (
          event.type === "mousedown" ||
          event.type === "pointerdown" ||
          event.type === "touchstart"
        ) {
          if (target?.closest(".board-card")) return false;
        }
        // The wheel scrolls the page; ⌘/Ctrl + wheel (and trackpad pinch) zooms.
        if (event.type === "wheel")
          return (event as WheelEvent).ctrlKey || (event as WheelEvent).metaKey;
        return !(event as MouseEvent).button;
      })
      .on("zoom", (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
        viewportRef.current?.setAttribute("transform", event.transform.toString());
        scaleRef.current = event.transform.k;
        const next: Detail =
          event.transform.k < 0.38 ? "pin" : event.transform.k < 0.8 ? "compact" : "full";
        setDetail((prev) => (prev === next ? prev : next));
      });
    select(svg).call(behaviour).on("dblclick.zoom", null);
    zoomRef.current = behaviour;
    return () => {
      select(svg).on(".zoom", null);
    };
  }, [view]);

  const fitView = useCallback(
    (ids?: string[], animate = true) => {
      const svg = svgRef.current;
      const behaviour = zoomRef.current;
      if (!svg || !behaviour) return;
      const list = ids ?? visible.nodes.map((n) => n.id);
      if (list.length === 0) return;
      let [minX, minY, maxX, maxY] = [
        Number.POSITIVE_INFINITY,
        Number.POSITIVE_INFINITY,
        -Infinity,
        -Infinity,
      ];
      for (const id of list) {
        const [x, y] = position(id);
        minX = Math.min(minX, x - 90);
        maxX = Math.max(maxX, x + 90);
        minY = Math.min(minY, y - 70);
        maxY = Math.max(maxY, y + 70);
      }
      const { width, height } = svg.getBoundingClientRect();
      // Never start smaller than paper-card scale: on narrow screens the board opens partly in view.
      const k = Math.max(
        0.3,
        Math.min(1.4, 0.92 * Math.min(width / (maxX - minX), height / (maxY - minY))),
      );
      const transform = zoomIdentity
        .translate(width / 2, height / 2)
        .scale(k)
        .translate(-(minX + maxX) / 2, -(minY + maxY) / 2);
      const target = select(svg);
      if (animate && !reduced.current)
        target.transition().duration(600).call(behaviour.transform, transform);
      else target.call(behaviour.transform, transform);
    },
    [visible.nodes, position],
  );

  // First fit, and deep link ?focus=<ID>.
  const fitted = useRef(false);
  useEffect(() => {
    if (!data || fitted.current || view !== "board") return;
    fitted.current = true;
    const focus = new URLSearchParams(window.location.search).get("focus");
    if (focus && nodeById.has(focus)) {
      if (!visible.nodes.some((n) => n.id === focus)) setGroups(new Set(Object.keys(groupLabels)));
      setSelected(focus);
      requestAnimationFrame(() => {
        const ids = [
          focus,
          ...visible.edges.flatMap((e) =>
            e.source === focus ? [e.target] : e.target === focus ? [e.source] : [],
          ),
        ];
        fitView(ids, false);
      });
    } else requestAnimationFrame(() => fitView(undefined, false));
  }, [data, view, fitView, nodeById, visible.nodes, visible.edges, groupLabels]);

  const toggle = (set: Set<string>, value: string, update: (s: Set<string>) => void) => {
    const next = new Set(set);
    next.has(value) ? next.delete(value) : next.add(value);
    update(next);
  };

  const zoomBy = (factor: number) => {
    const svg = svgRef.current;
    if (svg && zoomRef.current)
      select(svg).transition().duration(220).call(zoomRef.current.scaleBy, factor);
  };

  const onPointerDown = (event: React.PointerEvent<SVGGElement>, id: string) => {
    if (event.button !== 0) return;
    const [x, y] = position(id);
    drag.current = { id, x, y, px: event.clientX, py: event.clientY, travel: 0 };
    (event.currentTarget as Element).setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: React.PointerEvent<SVGGElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = (event.clientX - d.px) / scaleRef.current;
    const dy = (event.clientY - d.py) / scaleRef.current;
    d.travel = Math.max(d.travel, Math.hypot(dx, dy));
    if (d.travel > 3) setMoved((prev) => ({ ...prev, [d.id]: [d.x + dx, d.y + dy] }));
  };
  const onPointerUp = (id: string) => {
    const d = drag.current;
    drag.current = null;
    if (d && d.travel <= 3) setSelected((prev) => (prev === id ? null : id));
  };

  const pageOf = (id: string) =>
    `${nodeById.get(id)?.kind === "event" ? props.eventBase : props.entityBase}${id}/`;
  const nameOf = (id: string) => {
    const node = nodeById.get(id);
    return node ? localized(node.label, lang) : id;
  };
  const colorOf = (edge: Edge) =>
    hypotheses
      ? "var(--signal)"
      : (RELATION_GROUP_COLOR[edge.group as keyof typeof RELATION_GROUP_COLOR] ??
        "var(--series-neutral)");

  if (failed) return <p className="notice">{t.loadError}</p>;

  const selectedNode = selected ? nodeById.get(selected) : undefined;
  const selectedEdges = selected
    ? visible.edges.filter((e) => e.source === selected || e.target === selected)
    : [];
  const animate = !reduced.current && visible.nodes.length <= 150;
  const absolute = (path: string) => new URL(path, window.location.href).href;
  const exportColumns: CsvColumn<Edge>[] = [
    { name: "id", value: (e) => e.id },
    { name: "subject", value: (e) => e.source },
    { name: "subject_name", value: (e) => nameOf(e.source) },
    { name: hypotheses ? "hypothesis_type" : "predicate", value: (e) => e.literal },
    { name: "object", value: (e) => e.target },
    { name: "object_name", value: (e) => nameOf(e.target) },
    hypotheses
      ? { name: "priority", value: (e) => props.priorityLabels?.[e.priority ?? ""] ?? e.priority }
      : { name: "family", value: (e) => groupLabels[e.group] ?? e.group },
    { name: "evidence_level", value: (e) => e.level },
    { name: "caveat", value: (e) => (e.caveat ? localized(e.caveat, lang) : null) },
    { name: "subject_url", value: (e) => absolute(pageOf(e.source)) },
    { name: "object_url", value: (e) => absolute(pageOf(e.target)) },
  ];
  const exportView = hypotheses ? "hypotheses-board" : "board";
  const exportGroups = [
    {
      title: t.exportView,
      items: [
        {
          format: "CSV",
          label: hypotheses ? t.hypViewCsv : t.viewCsv,
          detail: (hypotheses ? t.hypViewDetail : t.viewDetail)(
            visible.nodes.length,
            visible.edges.length,
          ),
          onSelect: () =>
            downloadText(
              exportFileName(exportView, lang, "csv"),
              toCsv(exportColumns, visible.edges),
              CSV_TYPE,
            ),
        },
        {
          format: "JSON",
          label: t.viewJson,
          detail: (hypotheses ? t.hypViewDetail : t.viewDetail)(
            visible.nodes.length,
            visible.edges.length,
          ),
          onSelect: () =>
            downloadText(
              exportFileName(exportView, lang, "json"),
              `${JSON.stringify(
                {
                  view: window.location.href,
                  language: lang,
                  ...(hypotheses
                    ? { notice: t.tape }
                    : {
                        filters: {
                          groups: [...groups].sort(),
                          levels: [...levels].sort(),
                          isolated: isolated ? selected : null,
                        },
                      }),
                  nodes: visible.nodes.map((n) => ({
                    id: n.id,
                    kind: n.kind,
                    label: localized(n.label, lang),
                    url: absolute(pageOf(n.id)),
                  })),
                  edges: visible.edges.map((e) => ({
                    id: e.id,
                    source: e.source,
                    target: e.target,
                    [hypotheses ? "hypothesis_type" : "predicate"]: e.literal,
                    ...(hypotheses ? { priority: e.priority } : { group: e.group }),
                    evidence_level: e.level,
                    caveat: e.caveat ? localized(e.caveat, lang) : null,
                  })),
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
        {
          format: "CSV",
          label: hypotheses ? t.allHypCsv : t.allCsv,
          detail: hypotheses ? undefined : t.allDetail,
          href: props.collectionCsv,
        },
        { format: "JSON", label: t.allJson, href: dataUrl },
      ],
    },
  ];

  const pinOf = (id: string): [number, number] => {
    const [x, y] = position(id);
    const kind = nodeById.get(id)?.kind ?? "event";
    return [x, y - sizeOf(kind)[1] / 2 + 4];
  };

  const resetFilters = () => {
    setGroups(new Set(defaultGroupList));
    setLevels(new Set(defaultLevelList));
    setDomain("");
    setRelationType("");
    setPeriod("");
    setStatus("");
    setProvenance("");
    setKnowledgeDate("");
    setIsolated(false);
  };

  const announcement = boardAriaAnnouncement(
    lang,
    { nodes: visible.nodes.length, edges: visible.edges.length },
    selectedNode ? localized(selectedNode.label, lang) : null,
    selectedEdges.length,
  );

  return (
    <div className={`board-shell${hypotheses ? " is-hypotheses" : ""}`}>
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {data ? announcement : t.loading}
      </div>
      <div className="board-toolbar">
        {!hypotheses && (
          <>
            <fieldset className="board-filter">
              <legend className="kicker">{t.groups}</legend>
              <div className="flex flex-wrap gap-1.5">
                {RELATION_GROUP_ORDER.filter((g) => groupLabels[g]).map((group) => (
                  <button
                    key={group}
                    type="button"
                    className="chip"
                    aria-pressed={groups.has(group)}
                    onClick={() => toggle(groups, group, setGroups)}
                  >
                    <span className="dot" style={{ background: RELATION_GROUP_COLOR[group] }} />
                    <svg className="icon" aria-hidden="true">
                      <use href={`${sprite}#${RELATION_GROUP_ICON[group]}`} />
                    </svg>
                    {groupLabels[group]}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset className="board-filter">
              <legend className="kicker">{t.levels}</legend>
              <div className="flex flex-wrap gap-1.5">
                {LEVELS.map((level) => (
                  <button
                    key={level}
                    type="button"
                    className="chip"
                    aria-pressed={levels.has(level)}
                    onClick={() => toggle(levels, level, setLevels)}
                    title={EVIDENCE_SHORT[level][lang]}
                  >
                    <svg className="icon" aria-hidden="true">
                      <use href={`${sprite}#${EVIDENCE_ICON[level]}`} />
                    </svg>
                    {level}
                    <svg className="thread-mini" viewBox="0 0 28 8" aria-hidden="true">
                      {EVIDENCE_THREAD[level].double ? (
                        <path d="M1 2.5h26M1 5.5h26" stroke="currentColor" strokeWidth={1.2} />
                      ) : (
                        <path
                          d="M1 4h26"
                          stroke="currentColor"
                          strokeWidth={EVIDENCE_THREAD[level].width * 0.8}
                          strokeDasharray={EVIDENCE_THREAD[level].dash ?? undefined}
                          strokeLinecap="round"
                        />
                      )}
                    </svg>
                  </button>
                ))}
              </div>
            </fieldset>
          </>
        )}
        <details style={{ gridColumn: "1 / -1" }}>
          <summary className="kicker">{t.moreFilters}</summary>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(10rem, 1fr))",
              gap: "var(--space-3)",
              paddingTop: "var(--space-2)",
            }}
          >
            <label style={{ display: "grid", gap: "0.25rem" }}>
              <span className="kicker">{t.domain}</span>
              <input
                type="search"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                style={{ height: "2.25rem", padding: "0 0.5rem", fontSize: "var(--text-sm)" }}
              />
            </label>
            <label style={{ display: "grid", gap: "0.25rem" }}>
              <span className="kicker">{t.relationType}</span>
              <input
                type="search"
                value={relationType}
                onChange={(e) => setRelationType(e.target.value)}
                style={{ height: "2.25rem", padding: "0 0.5rem", fontSize: "var(--text-sm)" }}
              />
            </label>
            <label style={{ display: "grid", gap: "0.25rem" }}>
              <span className="kicker">{t.period}</span>
              <input
                type="search"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                placeholder="YYYY"
                style={{ height: "2.25rem", padding: "0 0.5rem", fontSize: "var(--text-sm)" }}
              />
            </label>
            <label style={{ display: "grid", gap: "0.25rem" }}>
              <span className="kicker">{t.status}</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as "" | "with_caveat" | "no_caveat")}
                style={{ height: "2.25rem", padding: "0 0.5rem", fontSize: "var(--text-sm)" }}
              >
                <option value="">{t.statusAll}</option>
                <option value="with_caveat">{t.statusCaveat}</option>
                <option value="no_caveat">{t.statusNoCaveat}</option>
              </select>
            </label>
            <label style={{ display: "grid", gap: "0.25rem" }}>
              <span className="kicker">{t.provenance}</span>
              <input
                type="search"
                value={provenance}
                onChange={(e) => setProvenance(e.target.value)}
                style={{ height: "2.25rem", padding: "0 0.5rem", fontSize: "var(--text-sm)" }}
              />
            </label>
            <label style={{ display: "grid", gap: "0.25rem" }}>
              <span className="kicker">{t.knowledgeDate}</span>
              <input
                type="search"
                value={knowledgeDate}
                onChange={(e) => setKnowledgeDate(e.target.value)}
                placeholder="YYYY-MM-DD"
                style={{ height: "2.25rem", padding: "0 0.5rem", fontSize: "var(--text-sm)" }}
              />
            </label>
          </div>
        </details>
        <div className="board-actions">
          <p className="meta" aria-live="polite">
            {t.visible(visible.nodes.length, visible.edges.length)}
            {view === "board" && <span className="board-hint"> · {t.wheelHint(modifier)}</span>}
          </p>
          <div className="board-actions-tools">
            <fieldset className="seg">
              <legend className="sr-only">{t.view}</legend>
              <button
                type="button"
                aria-pressed={view === "board"}
                onClick={() => setView("board")}
              >
                <svg className="icon" aria-hidden="true">
                  <use href={`${sprite}#ui-board`} />
                </svg>
                <span className="ml-1">{t.board}</span>
              </button>
              <button type="button" aria-pressed={view === "list"} onClick={() => setView("list")}>
                <svg className="icon" aria-hidden="true">
                  <use href={`${sprite}#ui-list`} />
                </svg>
                <span className="ml-1">{t.list}</span>
              </button>
            </fieldset>
            <ExportMenu label={t.export} groups={exportGroups} sprite={sprite} />
          </div>
        </div>
      </div>

      {view === "board" ? (
        <div className={`board detail-${detail}${selected ? " has-selection" : ""}`}>
          {hypotheses && <span className="board-tape">{t.tape}</span>}
          <div className="board-zoom">
            <button
              type="button"
              onClick={() => zoomBy(1.35)}
              aria-label={t.zoomIn}
              title={t.zoomIn}
            >
              <svg className="icon" aria-hidden="true">
                <use href={`${sprite}#ui-zoom-in`} />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => zoomBy(1 / 1.35)}
              aria-label={t.zoomOut}
              title={t.zoomOut}
            >
              <svg className="icon" aria-hidden="true">
                <use href={`${sprite}#ui-zoom-out`} />
              </svg>
            </button>
            <button type="button" onClick={() => fitView()} aria-label={t.fit} title={t.fit}>
              <svg className="icon" aria-hidden="true">
                <use href={`${sprite}#ui-fit`} />
              </svg>
            </button>
          </div>
          {!data && !failed ? (
            <div className="board-empty" role="status">
              <p>{t.loading}</p>
            </div>
          ) : null}
          {visible.edges.length === 0 && data ? (
            <div className="board-empty">
              <p>{t.empty}</p>
              <button type="button" className="btn" onClick={resetFilters}>
                {t.reset}
              </button>
            </div>
          ) : null}
          <svg ref={svgRef} className="board-svg" aria-label={t.boardLabel} role="application">
            <g ref={viewportRef}>
              <g className="board-threads">
                {visible.edges.map((edge, index) => {
                  const [x1, y1] = pinOf(edge.source);
                  const [x2, y2] = pinOf(edge.target);
                  const length = Math.hypot(x2 - x1, y2 - y1);
                  const mx = (x1 + x2) / 2;
                  const my = (y1 + y2) / 2 + Math.min(70, length * 0.14);
                  const d = `M${x1} ${y1}Q${mx} ${my} ${x2} ${y2}`;
                  const style = EVIDENCE_THREAD[edge.level];
                  const color = colorOf(edge);
                  const dim =
                    neighbours && !(neighbours.has(edge.source) && neighbours.has(edge.target));
                  // Tag at t = 0.55 on the quadratic curve, pointing source → target.
                  const tt = 0.55;
                  const tx = (1 - tt) ** 2 * x1 + 2 * (1 - tt) * tt * mx + tt ** 2 * x2;
                  const ty = (1 - tt) ** 2 * y1 + 2 * (1 - tt) * tt * my + tt ** 2 * y2;
                  const angle =
                    (Math.atan2(
                      2 * (1 - tt) * (my - y1) + 2 * tt * (y2 - my),
                      2 * (1 - tt) * (mx - x1) + 2 * tt * (x2 - mx),
                    ) *
                      180) /
                    Math.PI;
                  const width = detail === "pin" ? style.width * 0.8 : style.width;
                  return (
                    <g
                      key={edge.id}
                      className={`thread${dim ? " is-dim" : ""}`}
                      data-group={edge.group}
                      data-level={edge.level}
                    >
                      <title>{`${nameOf(edge.source)} → ${edge.label} → ${nameOf(edge.target)} (${edge.id}, ${edge.level})${edge.caveat ? ` · ${lang === "it" ? "Avvertenza" : "Caveat"}: ${pick(edge.caveat, lang).value}` : ""}`}</title>
                      <path
                        d={d}
                        stroke="var(--thread-casing)"
                        strokeWidth={width + 3.5}
                        fill="none"
                        strokeLinecap="round"
                      />
                      {style.double ? (
                        <>
                          <path
                            d={d}
                            stroke={color}
                            strokeWidth={width}
                            fill="none"
                            transform="translate(0 -1.6)"
                          />
                          <path
                            d={d}
                            stroke={color}
                            strokeWidth={width}
                            fill="none"
                            transform="translate(0 1.6)"
                          />
                        </>
                      ) : (
                        <path
                          d={d}
                          stroke={color}
                          strokeWidth={width}
                          fill="none"
                          strokeDasharray={style.dash ?? undefined}
                          strokeLinecap="round"
                          className={
                            animate && !style.dash
                              ? "thread-draw"
                              : animate
                                ? "thread-fade"
                                : undefined
                          }
                          style={
                            animate ? { animationDelay: `${300 + (index % 30) * 25}ms` } : undefined
                          }
                          pathLength={animate && !style.dash ? 1 : undefined}
                        />
                      )}
                      {detail !== "pin" && (
                        <path
                          d="M-6 -4.5 6 0-6 4.5-3.5 0z"
                          transform={`translate(${tx.toFixed(1)} ${ty.toFixed(1)}) rotate(${angle.toFixed(1)})`}
                          fill={color}
                          stroke="var(--thread-casing)"
                          strokeWidth={0.8}
                        />
                      )}
                      {hypotheses && detail !== "pin" && (
                        <g transform={`translate(${tx.toFixed(1)} ${(ty + 14).toFixed(1)})`}>
                          <rect x={-17} y={-8} width={34} height={15} fill="#f6e27a" />
                          <text
                            textAnchor="middle"
                            y={3.5}
                            fontFamily="var(--font-mono)"
                            fontSize={9}
                            fontWeight={600}
                            fill="#3d3420"
                          >
                            {edge.id}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}
              </g>
              <g className="board-cards">
                {visible.nodes.map((node, index) => {
                  const [x, y] = position(node.id);
                  const [, h] = sizeOf(node.kind);
                  const label = localized(node.label, lang);
                  const dim = neighbours && !neighbours.has(node.id);
                  const isSelected = node.id === selected;
                  return (
                    // biome-ignore lint/a11y/useSemanticElements: an SVG group cannot be a <button>; it gets the button role and keyboard handling.
                    <g
                      key={node.id}
                      data-node-id={node.id}
                      transform={`translate(${x} ${y})`}
                      className={`board-card${dim ? " is-dim" : ""}${isSelected ? " is-selected" : ""}`}
                      role="button"
                      tabIndex={0}
                      aria-pressed={isSelected}
                      aria-label={`${kindLabels[node.kind] ?? node.kind}: ${label}`}
                      onPointerDown={(e) => onPointerDown(e, node.id)}
                      onPointerMove={onPointerMove}
                      onPointerUp={() => onPointerUp(node.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelected(isSelected ? null : node.id);
                        } else if (e.key === "Escape") {
                          setSelected(null);
                          setIsolated(false);
                        } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                          e.preventDefault();
                          const nextId = nextThreadNeighbor(node.id, visible.edges, "next");
                          if (nextId) {
                            setSelected(nextId);
                            svgRef.current
                              ?.querySelector<SVGGElement>(`[data-node-id="${nextId}"]`)
                              ?.focus();
                          }
                        } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                          e.preventDefault();
                          const prevId = nextThreadNeighbor(node.id, visible.edges, "prev");
                          if (prevId) {
                            setSelected(prevId);
                            svgRef.current
                              ?.querySelector<SVGGElement>(`[data-node-id="${prevId}"]`)
                              ?.focus();
                          }
                        }
                      }}
                    >
                      <g
                        className={animate ? "card-drop" : undefined}
                        style={animate ? { animationDelay: `${(index % 40) * 18}ms` } : undefined}
                      >
                        <g className="card-paper" transform={`rotate(${cardTilt(node.id)})`}>
                          <rect
                            className="card-drop-shadow"
                            x={-sizeOf(node.kind)[0] / 2 + 2}
                            y={-h / 2 + 4}
                            width={sizeOf(node.kind)[0]}
                            height={h}
                            fill="#1e1204"
                            opacity={0.28}
                          />
                          <g className="card-shadow">
                            <CardFace
                              node={node}
                              label={label}
                              kindLabel={kindLabels[node.kind] ?? node.kind}
                              detail={detail}
                              sprite={sprite}
                            />
                          </g>
                          {isSelected && (
                            <rect
                              x={-sizeOf(node.kind)[0] / 2 - 5}
                              y={-h / 2 - 5}
                              width={sizeOf(node.kind)[0] + 10}
                              height={h + 10}
                              fill="none"
                              stroke="var(--accent)"
                              strokeWidth={detail === "pin" ? 8 : 3}
                              rx={3}
                            />
                          )}
                        </g>
                        <g transform={`translate(0 ${-h / 2 + 4})`}>
                          <circle
                            cx={1.2}
                            cy={2}
                            r={detail === "pin" ? 11 : 6.5}
                            fill="#000"
                            opacity={0.25}
                          />
                          <circle
                            r={detail === "pin" ? 11 : 6.5}
                            fill={node.kind === "event" ? "var(--pin-brass)" : "var(--pin)"}
                            stroke="rgb(0 0 0 / .35)"
                          />
                          <circle cx={-2.2} cy={-2.2} r={2} fill="#fff" opacity={0.6} />
                        </g>
                      </g>
                    </g>
                  );
                })}
              </g>
            </g>
          </svg>

          {selectedNode && (
            <section
              className="board-context-card card"
              aria-label={localized(selectedNode.label, lang)}
              style={{
                position: "absolute",
                left: "0.75rem",
                bottom: "0.75rem",
                zIndex: 3,
                maxWidth: "min(20rem, calc(100% - 1.5rem))",
                background: "var(--card)",
                color: "var(--card-ink)",
                border: "1px solid var(--rule-strong)",
                boxShadow: "var(--shadow-card)",
                padding: "var(--space-3)",
              }}
            >
              <p className="kicker" style={{ margin: 0, color: "var(--ink-3)" }}>
                {kindLabels[selectedNode.kind]} · {selectedNode.id}
              </p>
              <p
                style={{
                  margin: "0.25rem 0 0.4rem",
                  fontFamily: "var(--font-serif)",
                  fontWeight: 600,
                }}
              >
                {localized(selectedNode.label, lang)}
              </p>
              <p className="meta" style={{ margin: "0 0 0.5rem" }}>
                {t.links(selectedEdges.length)}
              </p>
              {selectedEdges[0]?.caveat && (
                <BoardCaveat caveat={selectedEdges[0].caveat} lang={lang} />
              )}
              <div className="flex flex-wrap gap-2 mt-2">
                <a className="btn" href={pageOf(selectedNode.id)}>
                  {t.open}
                </a>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setIsolated((v) => !v)}
                >
                  {isolated ? t.release : t.isolate}
                </button>
              </div>
            </section>
          )}

          {selectedNode && (
            <aside className="case-file" aria-label={t.caseFile}>
              <div className="case-file-tab kicker">{t.caseFile}</div>
              <button
                type="button"
                className="case-file-close"
                onClick={() => {
                  setSelected(null);
                  setIsolated(false);
                }}
                aria-label={t.close}
              >
                <svg className="icon" aria-hidden="true">
                  <use href={`${sprite}#ui-close`} />
                </svg>
              </button>
              <p className="kicker flex items-center gap-1.5">
                <svg className="icon" aria-hidden="true">
                  <use href={`${sprite}#${KIND_ICON[selectedNode.kind]}`} />
                </svg>
                {kindLabels[selectedNode.kind]} · {selectedNode.id}
              </p>
              <h2 className="case-file-title">{localized(selectedNode.label, lang)}</h2>
              <div className="flex flex-wrap gap-2 mb-3">
                <a className="btn" href={pageOf(selectedNode.id)}>
                  {t.open}
                </a>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setIsolated((v) => !v)}
                >
                  {isolated ? t.release : t.isolate}
                </button>
              </div>
              <p className="meta">{t.links(selectedEdges.length)}</p>
              <ul className="case-file-list">
                {selectedEdges.map((e) => {
                  const other = e.source === selected ? e.target : e.source;
                  return (
                    <li key={e.id}>
                      <span className="case-file-line" style={{ background: colorOf(e) }} />
                      <div>
                        <p className="m-0">
                          {e.source === selected ? (
                            <>
                              <em lang="it">{e.label}</em> →{" "}
                              <button
                                type="button"
                                className="link-btn"
                                onClick={() => setSelected(other)}
                              >
                                {nameOf(other)}
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="link-btn"
                                onClick={() => setSelected(other)}
                              >
                                {nameOf(other)}
                              </button>{" "}
                              → <em lang="it">{e.label}</em>
                            </>
                          )}
                        </p>
                        <p className="meta m-0 flex flex-wrap items-center gap-2">
                          <span className="stamp" data-level={e.level}>
                            <svg className="icon" aria-hidden="true">
                              <use href={`${sprite}#${EVIDENCE_ICON[e.level]}`} />
                            </svg>
                            {e.level}
                          </span>
                          <span className="mono">{e.id}</span>
                          {!hypotheses && groupLabels[e.group]}
                        </p>
                        <BoardCaveat caveat={e.caveat} lang={lang} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </aside>
          )}
        </div>
      ) : (
        <div className="table-wrap board-list">
          {visible.edges.length === 0 && data ? (
            <div style={{ padding: "var(--space-5)", textAlign: "center" }}>
              <p>{t.empty}</p>
              <button type="button" className="btn" onClick={resetFilters}>
                {t.reset}
              </button>
            </div>
          ) : (
            <table className="stack">
              <thead>
                <tr>
                  <th scope="col">{hypotheses ? t.hypothesis : t.id}</th>
                  <th scope="col">{t.subject}</th>
                  <th scope="col">{t.predicate}</th>
                  <th scope="col">{t.object}</th>
                  <th scope="col">{hypotheses ? t.priority : t.group}</th>
                  <th scope="col">{t.level}</th>
                </tr>
              </thead>
              <tbody>
                {visible.edges.map((e) => (
                  <tr key={e.id}>
                    <td data-label={hypotheses ? t.hypothesis : t.id} className="mono">
                      {e.id}
                    </td>
                    <td data-label={t.subject}>
                      <a href={pageOf(e.source)}>{nameOf(e.source)}</a>
                    </td>
                    <td data-label={t.predicate}>
                      <span lang="it">{e.label}</span>
                      <BoardCaveat caveat={e.caveat} lang={lang} />
                    </td>
                    <td data-label={t.object}>
                      <a href={pageOf(e.target)}>{nameOf(e.target)}</a>
                    </td>
                    <td data-label={hypotheses ? t.priority : t.group}>
                      {hypotheses
                        ? (props.priorityLabels?.[e.priority ?? ""] ?? e.priority)
                        : groupLabels[e.group]}
                    </td>
                    <td data-label={t.level}>
                      <span className="stamp" data-level={e.level}>
                        <svg className="icon" aria-hidden="true">
                          <use href={`${sprite}#${EVIDENCE_ICON[e.level]}`} />
                        </svg>
                        {e.level}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {!hypotheses && (
        <details className="board-legend">
          <summary className="kicker">{t.kinds}</summary>
          <ul>
            {Object.entries(kindLabels).map(([kind, text]) => (
              <li key={kind}>
                <svg className="icon" aria-hidden="true">
                  <use href={`${sprite}#${KIND_ICON[kind as Kind]}`} />
                </svg>
                {text}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
