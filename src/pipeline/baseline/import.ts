import {
  COLLECTIONS,
  type Dataset,
  type Entity,
  type Event,
  type Exposure,
  HYPOTHESIS_PRIORITY_FROM_BASELINE,
  type Hypothesis,
  type LocalizedText,
  precisionOf,
  RELATION_CLASS_GROUP,
  RELATIONSHIP_EVIDENCE_STATUS_FROM_BASELINE,
  type Relationship,
  type Review,
  type Source,
} from "../../model/index.ts";
import { type CsvRow, SourceReader } from "../sources.ts";
import { EXPOSURE_ROWS } from "./exposures.ts";
import { BASELINE_FILES, CORPUS_DOCUMENTS, REFERENCE_REGISTRIES } from "./files.ts";
import { DATASET_METADATA_EVENTS, KNOWN_ISSUES } from "./known-issues.ts";
import { placesOf } from "./places.ts";
import { CATEGORY_THEMES, EVENT_THEME_OVERRIDES } from "./themes.ts";

/**
 * One-time conversion of the original baseline (sources/original/) into
 * canonical records. Pure: reads the source files and returns a dataset;
 * writing is the caller's job. Throws on anything it cannot map exactly,
 * so no value is guessed.
 */
export function importBaseline(reader = new SourceReader()): Dataset {
  const nodeRows = reader.csvRows(BASELINE_FILES.nodesCsv);
  const eventNodes = new Map<string, { row: number; original: CsvRow }>();
  nodeRows.forEach((original, index) => {
    if (original.kind === "event")
      eventNodes.set(field(original, "id"), { row: index + 1, original });
  });

  const events = [...importTimeline(reader, eventNodes), ...importNewEvidence(reader, eventNodes)];
  if (eventNodes.size > 0) {
    throw new Error(`Event nodes without an event record: ${[...eventNodes.keys()].join(", ")}`);
  }

  const dataset: Dataset = {
    events,
    entities: importEntities(nodeRows),
    relationships: importRelationships(reader),
    hypotheses: importHypotheses(reader),
    sources: importSources(reader),
    exposures: importExposures(reader),
  };
  return {
    events: dataset.events.map((r) => COLLECTIONS.events.parse(r)),
    entities: dataset.entities.map((r) => COLLECTIONS.entities.parse(r)),
    relationships: dataset.relationships.map((r) => COLLECTIONS.relationships.parse(r)),
    hypotheses: dataset.hypotheses.map((r) => COLLECTIONS.hypotheses.parse(r)),
    sources: dataset.sources.map((r) => COLLECTIONS.sources.parse(r)),
    exposures: dataset.exposures.map((r) => COLLECTIONS.exposures.parse(r)),
  };
}

// ---------------------------------------------------------------------------

const UNREVIEWED: Review = { status: "imported_unreviewed", notes: [] };

function field(row: CsvRow, name: string): string {
  const value = row[name];
  if (value === undefined) throw new Error(`Missing column "${name}"`);
  return value;
}

function text(value: string): LocalizedText {
  return { it: value };
}

function optionalText(value: string): LocalizedText | null {
  return value.trim() === "" ? null : text(value);
}

function orNull(value: string): string | null {
  return value.trim() === "" ? null : value;
}

/** `S06;S06,S00;S03` → `["S06", "S00", "S03"]` (both separators occur). */
function sourceList(value: string): string[] {
  return unique(value.split(/[,;]/));
}

function idList(value: string): string[] {
  return unique(value.split(";"));
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter((v) => v !== ""))];
}

/** Graph nodes `EV_TL-0001` / `EV_EXT-001` are the events `TL-0001` / `EXT-001`. */
function nodeRef(id: string): string {
  return id.startsWith("EV_") ? id.slice(3) : id;
}

function rows(reader: SourceReader, file: string) {
  return reader.csvRows(file).map((original, index) => ({ original, row: index + 1, file }));
}

function takeEventNode(eventNodes: Map<string, { row: number; original: CsvRow }>, id: string) {
  const node = eventNodes.get(`EV_${id}`);
  if (!node) throw new Error(`No graph node EV_${id}`);
  eventNodes.delete(`EV_${id}`);
  return { file: BASELINE_FILES.nodesCsv, ...node };
}

function themesOf(id: string, category: string | null): Event["themes"] {
  const themes =
    EVENT_THEME_OVERRIDES[id]?.themes ?? (category ? CATEGORY_THEMES[category] : undefined);
  if (!themes) throw new Error(`${id}: no theme mapping for category "${category}"`);
  return themes;
}

function themeReview(id: string): Review {
  const override = EVENT_THEME_OVERRIDES[id];
  return override ? { status: "imported_unreviewed", notes: [override.note] } : UNREVIEWED;
}

function importTimeline(
  reader: SourceReader,
  eventNodes: Map<string, { row: number; original: CsvRow }>,
): Event[] {
  return rows(reader, BASELINE_FILES.timelineCsv).map(({ original, row, file }) => {
    const id = field(original, "id");
    const node = takeEventNode(eventNodes, id);
    for (const [nodeField, timelineField] of [
      ["name", "title"],
      ["date_start", "date_start"],
      ["date_end", "date_end"],
      ["date_precision", "date_precision"],
      ["geo", "geography"],
    ] as const) {
      if (field(node.original, nodeField) !== field(original, timelineField)) {
        throw new Error(`${id}: node ${nodeField} differs from timeline ${timelineField}`);
      }
    }
    return {
      id,
      record_type: DATASET_METADATA_EVENTS.has(id) ? "dataset_metadata" : "event",
      timeline_status: "integrated",
      date: {
        start: field(original, "date_start"),
        end: orNull(field(original, "date_end")),
        precision: field(original, "date_precision") as Event["date"]["precision"],
      },
      title: text(field(original, "title")),
      description: text(field(original, "description")),
      category: optionalText(field(original, "category")),
      themes: themesOf(id, field(original, "category")),
      geography: optionalText(field(original, "geography")),
      places: placesOf(orNull(field(original, "geography")), id),
      evidence_note: optionalText(field(original, "evidence_status")),
      evidence_level: null,
      publisher: null,
      url: null,
      sources: sourceList(field(original, "source_docs")),
      known_issues: KNOWN_ISSUES[id] ?? [],
      review: themeReview(id),
      provenance: [
        { file, row, original },
        { file: node.file, row: node.row, original: node.original },
      ],
    };
  });
}

function importNewEvidence(
  reader: SourceReader,
  eventNodes: Map<string, { row: number; original: CsvRow }>,
): Event[] {
  return rows(reader, BASELINE_FILES.newEvidenceCsv).map(({ original, row, file }) => {
    const id = field(original, "id");
    const node = takeEventNode(eventNodes, id);
    if (field(original, "in_source_06") !== "no") {
      throw new Error(`${id}: expected in_source_06=no`);
    }
    const start = field(original, "date_start");
    return {
      id,
      record_type: "event",
      timeline_status: "pending_integration",
      date: { start, end: null, precision: precisionOf(start) },
      title: text(field(original, "title")),
      description: text(field(original, "description")),
      category: null,
      themes: themesOf(id, null),
      geography: optionalText(field(node.original, "geo")),
      places: placesOf(orNull(field(node.original, "geo")), id),
      evidence_note: null,
      evidence_level: field(original, "evidence_level") as Event["evidence_level"],
      publisher: orNull(field(original, "publisher")),
      url: orNull(field(original, "url")),
      sources: sourceList(field(node.original, "source_docs")),
      known_issues: [],
      review: themeReview(id),
      provenance: [
        { file, row, original },
        { file: node.file, row: node.row, original: node.original },
      ],
    };
  });
}

function importEntities(nodeRows: CsvRow[]): Entity[] {
  return nodeRows.flatMap((original, index) => {
    if (field(original, "kind") === "event") return [];
    for (const column of ["geo", "date_start", "date_end", "source_docs", "evidence_status"]) {
      if (field(original, column) !== "") {
        throw new Error(`${original.id}: unexpected value in "${column}" for a non-event node`);
      }
    }
    return [
      {
        id: field(original, "id"),
        kind: field(original, "kind") as Entity["kind"],
        name: text(field(original, "name")),
        domain: field(original, "domain") as Entity["domain"],
        country: field(original, "kind") === "state" ? field(original, "id") : null,
        review: UNREVIEWED,
        provenance: [{ file: BASELINE_FILES.nodesCsv, row: index + 1, original }],
      },
    ];
  });
}

function importRelationships(reader: SourceReader): Relationship[] {
  return rows(reader, BASELINE_FILES.edgesCsv).map(({ original, row, file }) => {
    const id = field(original, "id");
    const relationClass = field(original, "relation_class");
    if (!(relationClass in RELATION_CLASS_GROUP)) {
      throw new Error(`${id}: unknown relation_class "${relationClass}"`);
    }
    const status = RELATIONSHIP_EVIDENCE_STATUS_FROM_BASELINE[field(original, "evidence_status")];
    if (!status) throw new Error(`${id}: unknown evidence_status "${original.evidence_status}"`);
    return {
      id,
      subject: nodeRef(field(original, "source")),
      predicate: field(original, "predicate"),
      object: nodeRef(field(original, "target")),
      relation_class: relationClass as Relationship["relation_class"],
      evidence_level: field(original, "evidence_level") as Relationship["evidence_level"],
      evidence_status: status,
      events: idList(field(original, "timeline_ids")),
      valid_from: orNull(field(original, "date_start")),
      valid_to: orNull(field(original, "date_end")),
      primary_url: orNull(field(original, "primary_url")),
      caveat: optionalText(field(original, "description_or_caveat")),
      sources: sourceList(field(original, "source_docs")),
      review: UNREVIEWED,
      provenance: [{ file, row, original }],
    };
  });
}

function importHypotheses(reader: SourceReader): Hypothesis[] {
  return rows(reader, BASELINE_FILES.hypothesesCsv).map(({ original, row, file }) => {
    const id = field(original, "id");
    const priority = HYPOTHESIS_PRIORITY_FROM_BASELINE[field(original, "priority")];
    if (!priority) throw new Error(`${id}: unknown priority "${original.priority}"`);
    return {
      id,
      subject: nodeRef(field(original, "subject")),
      object: nodeRef(field(original, "object")),
      hypothesis_type: field(original, "hypothesis_type"),
      question: text(field(original, "verification_question")),
      current_limit: text(field(original, "current_limit")),
      priority,
      evidence_needed: text(field(original, "evidence_needed")),
      events: idList(field(original, "timeline_ids")),
      external_url: orNull(field(original, "external_url")),
      status: field(original, "status") as Hypothesis["status"],
      sources: sourceList(field(original, "source_docs")),
      review: UNREVIEWED,
      provenance: [{ file, row, original }],
    };
  });
}

// ---------------------------------------------------------------------------
// Sources: corpus documents, generic web, EXT web sources, F/P references

function importSources(reader: SourceReader): Source[] {
  const corpus: Source[] = Object.entries(CORPUS_DOCUMENTS).map(([id, files]) => {
    const file = files[0] ?? "";
    const heading = reader.lines(file)[0] ?? "";
    if (!heading.startsWith("# ")) throw new Error(`${file}: first line is not a title`);
    return {
      id,
      type: "corpus_document",
      title: text(heading.slice(2)),
      publisher: null,
      files,
      urls: [],
      cited_in: [],
      review: UNREVIEWED,
      provenance: [{ file, line: 1, original: { text: heading } }],
    };
  });

  const web: Source = {
    id: "WEB",
    type: "unspecified_web",
    title: text("Fonte web non specificata nel corpus originale"),
    publisher: null,
    files: [],
    urls: [],
    cited_in: ["S07"],
    review: { status: "needs_review", notes: ["Identify the actual web source."] },
    provenance: [],
  };

  const extWeb: Source[] = rows(reader, BASELINE_FILES.newEvidenceCsv).map(
    ({ original, row, file }) => ({
      id: `WEB-${field(original, "id")}`,
      type: "external_reference",
      title: text(field(original, "title")),
      publisher: orNull(field(original, "publisher")),
      files: [],
      urls: [field(original, "url")],
      cited_in: ["S07"],
      review: UNREVIEWED,
      provenance: [{ file, row, original }],
    }),
  );

  return [
    ...corpus,
    web,
    ...extWeb,
    ...referenceRegistry(reader, "F"),
    ...referenceRegistry(reader, "P"),
  ];
}

const URL_PATTERN = /https?:\/\/[^\s;]+/g;

const REFERENCE_LINE = {
  F: /^- \*\*\[(F\d{2})\] (.+?)\*\*,? (.*)$/,
  P: /^- \*\*(P\d{2}) \| (.+?)\*\* (.*)$/,
} as const;

function referenceRegistry(reader: SourceReader, prefix: "F" | "P"): Source[] {
  const { document, file } = REFERENCE_REGISTRIES[prefix];
  const sources: Source[] = [];
  reader.lines(file).forEach((line, index) => {
    const match = REFERENCE_LINE[prefix].exec(line);
    if (!match) return;
    const [, id = "", bold = "", rest = ""] = match;
    const urls = (line.match(URL_PATTERN) ?? []).map((url) => url.replace(/[.,]+$/, ""));
    if (urls.length === 0) throw new Error(`${id}: reference without URL`);
    // F: bold = publisher, rest = title. P: bold = "Publisher, title (date)."
    const publisher = prefix === "F" ? bold : (bold.split(",")[0] ?? bold);
    const description = rest.replace(URL_PATTERN, "").replace(/[\s:;]+$/, "");
    const title = prefix === "F" ? `${bold}, ${description}` : `${bold} ${description}`.trim();
    sources.push({
      id,
      type: "external_reference",
      title: text(stripMarkdown(title)),
      publisher: stripMarkdown(publisher),
      files: [],
      urls,
      cited_in: [document],
      review: UNREVIEWED,
      provenance: [{ file, line: index + 1, original: { text: line } }],
    });
  });
  return sources;
}

function stripMarkdown(value: string): string {
  return value.replace(/\*+/g, "").replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------------------
// Exposures: transcription of the Fonte_08 §12.2 matrix

function importExposures(reader: SourceReader): Exposure[] {
  const file = CORPUS_DOCUMENTS.S08?.[0] ?? "";
  const lines = reader.lines(file);
  return EXPOSURE_ROWS.map((row) => {
    const line = lines[row.line - 1] ?? "";
    if (!line.startsWith(`| ${row.sector} |`)) {
      throw new Error(`${row.id}: line ${row.line} of ${file} is not the "${row.sector}" row`);
    }
    const [, , indicator = "", scope = "", consequence = ""] = line.split("|").map((c) => c.trim());
    const refs = [...line.matchAll(/\[(P\d{2}|S\d{2})\]/g)].map((match) => match[1] ?? "");
    const mentionsS04 = /DS-04|\[S04\]/.test(line);
    return {
      id: row.id,
      sector: text(row.sector),
      indicator: text(stripMarkdown(indicator)),
      measures: row.measures.map((measure) => ({
        label: text(measure.label),
        value: measure.value,
        unit: measure.unit,
        qualifier: measure.qualifier,
        out_of: "out_of" in measure ? measure.out_of : null,
        period: "period" in measure ? measure.period : null,
      })),
      scope: text(stripMarkdown(scope)),
      consequence: text(stripMarkdown(consequence.replace(/\s*\[(P|S)\d{2}\]/g, ""))),
      status: row.status,
      sources: unique(["S08", ...(mentionsS04 ? ["S04"] : []), ...refs]),
      review: UNREVIEWED,
      provenance: [{ file, line: row.line, original: { text: line } }],
    };
  });
}
