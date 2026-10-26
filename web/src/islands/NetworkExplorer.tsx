import cytoscape, { type Core, type ElementDefinition } from "cytoscape";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatPredicate } from "../../../src/site/format.ts";
import type { GraphEdge, GraphNode, HypothesisEdge } from "../../../src/site/read-model.ts";

type Props = {
  mode: "evidence" | "hypotheses";
  dataUrl: string;
  /** Base URLs of entity and event pages, ending with a slash. */
  entityBase: string;
  eventBase: string;
  groupLabels: Record<string, string>;
  kindLabels: Record<string, string>;
};

type Edge = (GraphEdge | HypothesisEdge) & {
  label: string;
  group: string;
  evidence_level?: string;
};

const LEVELS = ["E1", "E2", "E3", "E4"];
const GROUP_COLORS: Record<string, string> = {
  participation: "#b7bcc5",
  control: "#b42318",
  financial: "#b54708",
  influence_information: "#6941c6",
  security_intelligence: "#1f4e8c",
  economic_dependency: "#027a48",
  institutional: "#475467",
  context: "#98a2b3",
  hypothesis: "#c11574",
};
const KIND_COLORS: Record<string, string> = {
  state: "#1f4e8c",
  institution: "#475467",
  person: "#b42318",
  organization: "#6941c6",
  company: "#027a48",
  asset: "#b54708",
  event: "#98a2b3",
};

export default function NetworkExplorer(props: Props) {
  const { mode, dataUrl, groupLabels, kindLabels } = props;
  const container = useRef<HTMLDivElement>(null);
  const cy = useRef<Core | null>(null);
  const [data, setData] = useState<{ nodes: GraphNode[]; edges: Edge[] } | null>(null);
  const [failed, setFailed] = useState(false);
  const [groups, setGroups] = useState(
    () => new Set(Object.keys(groupLabels).filter((g) => g !== "participation")),
  );
  const [levels, setLevels] = useState(() => new Set(LEVELS));
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    fetch(dataUrl)
      .then((response) => response.json())
      .then((json: { nodes: GraphNode[]; edges: (GraphEdge | HypothesisEdge)[] }) =>
        setData({
          nodes: json.nodes,
          edges: json.edges.map((e) =>
            "predicate" in e
              ? { ...e, label: formatPredicate(e.predicate) }
              : {
                  ...e,
                  group: "hypothesis",
                  label: `${e.id} · ${formatPredicate(e.hypothesis_type)}`,
                },
          ),
        }),
      )
      .catch(() => setFailed(true));
  }, [dataUrl]);

  const visible = useMemo(() => {
    if (!data) return { nodes: [], edges: [] };
    const edges =
      mode === "hypotheses"
        ? data.edges
        : data.edges.filter((e) => groups.has(e.group) && levels.has(e.evidence_level ?? ""));
    const ids = new Set(edges.flatMap((e) => [e.source, e.target]));
    return { nodes: data.nodes.filter((n) => ids.has(n.id)), edges };
  }, [data, groups, levels, mode]);

  useEffect(() => {
    if (!container.current || !data) return;
    const elements: ElementDefinition[] = [
      ...visible.nodes.map((n) => ({
        data: { id: n.id, label: n.label, color: KIND_COLORS[n.kind] ?? "#98a2b3", kind: n.kind },
      })),
      ...visible.edges.map((e) => ({
        data: {
          id: e.id,
          source: e.source,
          target: e.target,
          label: e.label,
          color: GROUP_COLORS[e.group] ?? "#98a2b3",
          style:
            mode === "hypotheses" || e.evidence_level === "E4"
              ? "dotted"
              : e.evidence_level === "E3"
                ? "dashed"
                : "solid",
        },
      })),
    ];
    cy.current?.destroy();
    const instance = cytoscape({
      container: container.current,
      elements,
      layout: {
        name: "cose",
        animate: false,
        nodeRepulsion: () => 9000,
        idealEdgeLength: () => 90,
      },
      wheelSensitivity: 0.3,
      style: [
        {
          selector: "node",
          style: {
            label: "data(label)",
            "background-color": "data(color)",
            "font-size": 9,
            "text-wrap": "ellipsis",
            "text-max-width": "110px",
            width: 14,
            height: 14,
            color: "#1c1f24",
          },
        },
        {
          selector: 'node[kind = "event"]',
          style: { shape: "round-rectangle", width: 10, height: 10 },
        },
        {
          selector: "edge",
          style: {
            width: 1.5,
            "line-color": "data(color)",
            "line-style": "data(style)" as "solid",
            "target-arrow-shape": "triangle",
            "target-arrow-color": "data(color)",
            "arrow-scale": 0.7,
            "curve-style": "bezier",
          },
        },
        { selector: "node:selected", style: { "border-width": 3, "border-color": "#1c1f24" } },
        { selector: ".faded", style: { opacity: 0.15 } },
      ],
    });
    instance.on("tap", "node", (event) => {
      const node = event.target;
      setSelected(node.id());
      instance.elements().addClass("faded");
      node.closedNeighborhood().removeClass("faded");
    });
    instance.on("tap", (event) => {
      if (event.target === instance) {
        setSelected(null);
        instance.elements().removeClass("faded");
      }
    });
    cy.current = instance;
    return () => instance.destroy();
  }, [visible, data, mode]);

  const toggle = (set: Set<string>, value: string, update: (s: Set<string>) => void) => {
    const next = new Set(set);
    next.has(value) ? next.delete(value) : next.add(value);
    update(next);
  };

  const selectedNode = data?.nodes.find((n) => n.id === selected);
  const selectedEdges = visible.edges.filter((e) => e.source === selected || e.target === selected);
  const label = (id: string) => data?.nodes.find((n) => n.id === id)?.label ?? id;
  const pageOf = (id: string) => {
    const kind = data?.nodes.find((n) => n.id === id)?.kind;
    return `${kind === "event" ? props.eventBase : props.entityBase}${id}/`;
  };

  if (failed) return <p className="notice">Impossibile caricare i dati del grafo.</p>;

  return (
    <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
      <div className="space-y-4 text-sm">
        {mode === "evidence" && (
          <>
            <fieldset>
              <legend className="font-semibold">Tipi di relazione</legend>
              {Object.entries(groupLabels).map(([group, text]) => (
                <label key={group} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={groups.has(group)}
                    onChange={() => toggle(groups, group, setGroups)}
                  />
                  <span
                    aria-hidden="true"
                    style={{ background: GROUP_COLORS[group] }}
                    className="inline-block w-3 h-3"
                  />
                  {text}
                </label>
              ))}
            </fieldset>
            <fieldset>
              <legend className="font-semibold">Livello di evidenza</legend>
              {LEVELS.map((level) => (
                <label key={level} className="mr-3">
                  <input
                    type="checkbox"
                    checked={levels.has(level)}
                    onChange={() => toggle(levels, level, setLevels)}
                  />{" "}
                  {level}
                </label>
              ))}
              <p className="meta mt-1">Linea continua E1–E2, tratteggiata E3, punteggiata E4.</p>
            </fieldset>
          </>
        )}
        <div>
          <p className="font-semibold mb-1">Tipi di nodo</p>
          <ul>
            {Object.entries(kindLabels).map(([kind, text]) => (
              <li key={kind} className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  style={{ background: KIND_COLORS[kind] }}
                  className="inline-block w-3 h-3 rounded-full"
                />
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="meta" aria-live="polite">
          {visible.nodes.length} nodi, {visible.edges.length} collegamenti visibili.
        </p>
        <button
          type="button"
          className="badge cursor-pointer"
          onClick={() => cy.current?.fit(undefined, 20)}
        >
          Adatta il grafo alla vista
        </button>
        {selectedNode && (
          <div className="card" aria-live="polite">
            <p className="font-semibold mb-1">{selectedNode.label}</p>
            <p className="meta">{kindLabels[selectedNode.kind]}</p>
            <a href={pageOf(selectedNode.id)}>Apri la scheda</a>
            <ul className="mt-2 space-y-1">
              {selectedEdges.map((e) => (
                <li key={e.id} className="meta">
                  {label(e.source)} → <em>{e.label}</em> → {label(e.target)}
                  {e.evidence_level && ` (${e.evidence_level})`}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <div>
        <div
          ref={container}
          className="h-[70vh] min-h-[28rem] border border-line rounded bg-white"
          role="img"
          aria-label="Grafo interattivo: l'elenco testuale dei collegamenti visibili è disponibile sotto il grafo."
        />
        <details className="mt-3">
          <summary className="cursor-pointer">Elenco testuale dei collegamenti visibili</summary>
          <ul className="mt-2 text-sm space-y-1">
            {visible.edges.map((e) => (
              <li key={e.id}>
                <span className="font-mono">{e.id}</span>{" "}
                <a href={pageOf(e.source)}>{label(e.source)}</a> → {e.label} →{" "}
                <a href={pageOf(e.target)}>{label(e.target)}</a>
                {e.evidence_level && ` (${e.evidence_level})`}
              </li>
            ))}
          </ul>
        </details>
      </div>
    </div>
  );
}
