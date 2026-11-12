import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";

/**
 * Build-time layout of the evidence board (docs/design/PAGES.md). Positions
 * are computed once with d3-force, whose random source is a fixed-seed LCG,
 * from deterministic initial positions, so the board is identical on every
 * build and every visit and never "jumps" when filters change.
 *
 * Two passes: the strong (default-visible) relationships are laid out first
 * and pinned; nodes reached only through weak edges (event participation)
 * are then placed around them, so the default view stays compact.
 */

export type LayoutNode = { id: string };
export type LayoutEdge = { source: string; target: string; weak?: boolean };
/** Card centre per node ID, rounded to whole units. */
export type BoardLayout = Record<string, [number, number]>;

type SimNode = SimulationNodeDatum & { id: string };
type SimLink = SimulationLinkDatum<SimNode> & { weak: boolean };

/** Rest angle of a card (−3°…+3°), stable for a given ID. */
export function cardTilt(id: string): number {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return ((Math.abs(hash) % 61) - 30) / 10;
}

function phyllotaxis(ids: string[], spacing: number, offset = 0): SimNode[] {
  return ids.map((id, i) => {
    const radius = spacing * 0.6 * Math.sqrt(0.5 + i + offset);
    const angle = (i + offset) * Math.PI * (3 - Math.sqrt(5));
    return { id, x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
  });
}

function run(nodes: SimNode[], links: SimLink[], spacing: number, ticks: number): void {
  const simulation = forceSimulation(nodes)
    .force(
      "link",
      forceLink<SimNode, SimLink>(links)
        .id((n) => n.id)
        .distance((l) => (l.weak ? spacing * 1.7 : spacing * 1.9))
        .strength((l) => (l.weak ? 0.12 : 0.5)),
    )
    .force(
      "charge",
      forceManyBody<SimNode>()
        .strength(-spacing * 2.2)
        .distanceMax(spacing * 6),
    )
    .force(
      "collide",
      forceCollide<SimNode>(spacing * 0.9)
        .strength(1)
        .iterations(2),
    )
    .force("x", forceX<SimNode>(0).strength(0.07))
    .force("y", forceY<SimNode>(0).strength(0.11))
    .stop();
  for (let i = 0; i < ticks; i++) simulation.tick();
}

export function layoutBoard(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  options: { ticks?: number; spacing?: number } = {},
): BoardLayout {
  const { ticks = 360, spacing = 92 } = options;
  const all = [...new Set(nodes.map((n) => n.id))].sort();
  const known = new Set(all);
  const valid = edges.filter(
    (e) => known.has(e.source) && known.has(e.target) && e.source !== e.target,
  );
  const strong = valid.filter((e) => !e.weak);
  const core = [...new Set(strong.flatMap((e) => [e.source, e.target]))].sort();
  const coreSet = new Set(core);

  // Pass 1: the default-visible graph.
  const first = phyllotaxis(core, spacing);
  run(
    first,
    strong.map((e) => ({ source: e.source, target: e.target, weak: false })),
    spacing,
    ticks,
  );

  // Pass 2: everything else, around the pinned core.
  const rest = phyllotaxis(
    all.filter((id) => !coreSet.has(id)),
    spacing,
    core.length,
  );
  const pinned = first.map((n) => ({ ...n, fx: n.x, fy: n.y }));
  run(
    [...pinned, ...rest],
    valid.map((e) => ({ source: e.source, target: e.target, weak: e.weak ?? false })),
    spacing,
    Math.round(ticks * 0.75),
  );

  return Object.fromEntries(
    [...pinned, ...rest].map((n) => [
      n.id,
      [Math.round(n.fx ?? n.x ?? 0), Math.round(n.fy ?? n.y ?? 0)] as [number, number],
    ]),
  );
}
