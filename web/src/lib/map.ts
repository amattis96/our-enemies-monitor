import { type GeoProjection, geoConicConformal, geoEqualEarth, geoPath } from "d3-geo";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import countries50m from "world-atlas/countries-50m.json" with { type: "json" };

/**
 * Static choropleth maps rendered at build time (no client JavaScript, no
 * tile server). Data: Natural Earth via world-atlas (public domain / ISC).
 * Country level only: the data has no coordinates and none are invented.
 */

/** ISO 3166-1 alpha-2 → numeric (world-atlas feature ids) for the codes used by the data. */
const ISO_NUMERIC: Record<string, string> = {
  AE: "784",
  AL: "008",
  AO: "024",
  AZ: "031",
  BE: "056",
  BR: "076",
  BY: "112",
  CD: "180",
  CN: "156",
  CZ: "203",
  DE: "276",
  EE: "233",
  ES: "724",
  FI: "246",
  FR: "250",
  GB: "826",
  GE: "268",
  IE: "372",
  IL: "376",
  IR: "364",
  IT: "380",
  LT: "440",
  MA: "504",
  MD: "498",
  NL: "528",
  NO: "578",
  PE: "604",
  PL: "616",
  PT: "620",
  QA: "634",
  RO: "642",
  RU: "643",
  SA: "682",
  SE: "752",
  TR: "792",
  TW: "158",
  UA: "804",
  US: "840",
};

const topology = countries50m as unknown as Topology<{ countries: GeometryCollection }>;
const world = feature(topology, topology.objects.countries) as FeatureCollection<Geometry>;

export type MapShape = { d: string; code: string | null; value: number };
export type RenderedMap = { width: number; height: number; shapes: MapShape[] };

/** Sequential buckets; 0 = no recorded value. */
export const BUCKETS = [
  { min: 1, max: 1, color: "#c6dbef" },
  { min: 2, max: 3, color: "#9ecae1" },
  { min: 4, max: 7, color: "#4292c6" },
  { min: 8, max: Number.POSITIVE_INFINITY, color: "#08519c" },
];
export const EMPTY_COLOR = "#eceef1";

export function colorFor(value: number): string {
  return BUCKETS.find((b) => value >= b.min && value <= b.max)?.color ?? EMPTY_COLOR;
}

const EUROPE_FRAME: Feature<Geometry> = {
  type: "Feature",
  properties: {},
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [-12, 35],
        [-12, 69],
        [40, 69],
        [40, 35],
        [-12, 35],
      ],
    ], // clockwise: d3-geo winding
  },
};

export function renderMap(values: Map<string, number>, area: "europe" | "world"): RenderedMap {
  const numericToAlpha = new Map(Object.entries(ISO_NUMERIC).map(([a, n]) => [n, a]));
  for (const code of values.keys()) {
    if (!ISO_NUMERIC[code])
      throw new Error(`map: no numeric ISO code for "${code}"; extend ISO_NUMERIC`);
    if (!world.features.some((f) => f.id === ISO_NUMERIC[code])) {
      throw new Error(`map: "${code}" not found in world-atlas`);
    }
  }
  const width = 960;
  const height = area === "europe" ? 720 : 500;
  const projection: GeoProjection =
    area === "europe"
      ? geoConicConformal()
          .rotate([-10, 0])
          .parallels([40, 65])
          .fitSize([width, height], EUROPE_FRAME)
      : geoEqualEarth().fitSize([width, height], world);
  projection.clipExtent([
    [0, 0],
    [width, height],
  ]);
  const path = geoPath(projection).digits(1);
  const shapes = world.features.flatMap((f) => {
    const d = path(f);
    if (!d) return [];
    const code = numericToAlpha.get(String(f.id)) ?? null;
    return [{ d, code, value: code ? (values.get(code) ?? 0) : 0 }];
  });
  return { width, height, shapes };
}
