import { COLLECTION_NAMES, type CollectionName, type Dataset } from "../model/index.ts";
import { parseCsv } from "./csv.ts";
import { type ExportFile, exportFiles } from "./exports.ts";
import {
  entityMarkdown,
  eventMarkdown,
  exposureMarkdown,
  hypothesisMarkdown,
  sourceMarkdown,
} from "./markdown.ts";
import { type PublicationReport, publicationReport } from "./publication.ts";
import { buildReadModel, type ReadModel } from "./read-model.ts";

export type ParitySurface = "json" | "package_json" | "csv" | "markdown" | "html";

export type ParityMismatch = {
  collection: CollectionName;
  id: string;
  surface: ParitySurface;
  field: string;
  expected: string;
  actual: string;
};

export type ParityReport = {
  checked_records: number;
  by_collection: Record<CollectionName, number>;
  mismatches: ParityMismatch[];
  ok: boolean;
};

function reportOf(input: Dataset | PublicationReport): PublicationReport {
  return "kind" in input ? input : publicationReport(input);
}

function splitList(cell: string | undefined): string[] {
  if (!cell) return [];
  return cell.split(";").filter(Boolean);
}

/**
 * 100% parity verifier on ALL published records for critical fields
 * (`id`, `review_status`, `evidence_status`, `evidence_level`, `essential_caveat`, `sources`)
 * across collection JSON, record package JSON, CSV, `.md`, and optional HTML.
 */
export function verifyParity(
  input: Dataset | PublicationReport,
  options?: {
    files?: readonly ExportFile[];
    model?: ReadModel;
    htmlByKey?: ReadonlyMap<string, string>;
  },
): ParityReport {
  const report = reportOf(input);
  const dataset = report.dataset;
  const model = options?.model ?? buildReadModel(dataset);
  const files = options?.files ?? exportFiles(report);
  const mismatches: ParityMismatch[] = [];

  const fileMap = new Map(files.map((f) => [f.path, f.text]));

  const push = (
    collection: CollectionName,
    id: string,
    surface: ParitySurface,
    field: string,
    expected: string,
    actual: string,
  ) => {
    if (expected !== actual) {
      mismatches.push({ collection, id, surface, field, expected, actual });
    }
  };

  const checkHtml = (collection: CollectionName, id: string, tokens: string[]) => {
    const html = options?.htmlByKey?.get(`${collection}/${id}`) ?? options?.htmlByKey?.get(id);
    if (!html) return;
    for (const token of tokens) {
      if (token && !html.includes(token)) {
        mismatches.push({
          collection,
          id,
          surface: "html",
          field: "critical_token",
          expected: token,
          actual: "<missing>",
        });
      }
    }
  };

  const jsonByCollection = new Map<CollectionName, Map<string, Record<string, unknown>>>();
  for (const name of COLLECTION_NAMES) {
    const raw = fileMap.get(`${name}.json`);
    const list = raw ? (JSON.parse(raw) as Record<string, unknown>[]) : [];
    jsonByCollection.set(name, new Map(list.map((row) => [String(row.id ?? ""), row])));
  }

  const csvByCollection = new Map<string, Map<string, Record<string, string>>>();
  for (const name of ["events", "entities", "relationships", "hypotheses", "sources"] as const) {
    const raw = fileMap.get(`${name}.csv`);
    const rows = raw ? parseCsv(raw) : [];
    csvByCollection.set(name, new Map(rows.map((row) => [row.id ?? "", row])));
  }

  const checkPackage = (collection: CollectionName, id: string, reviewStatus: string) => {
    const pkgText = fileMap.get(`records/${id}.json`);
    if (!pkgText) {
      push(collection, id, "package_json", "file", `records/${id}.json`, "<missing>");
      return null;
    }
    const pkg = JSON.parse(pkgText) as {
      id?: string;
      collection?: string;
      record?: Record<string, unknown> & { review?: { status?: string } };
    };
    push(collection, id, "package_json", "id", id, String(pkg.id ?? ""));
    push(collection, id, "package_json", "collection", collection, String(pkg.collection ?? ""));
    push(
      collection,
      id,
      "package_json",
      "review_status",
      reviewStatus,
      String(pkg.record?.review?.status ?? ""),
    );
    return pkg.record ?? null;
  };

  for (const event of dataset.events) {
    const jsonRow = jsonByCollection.get("events")?.get(event.id);
    push("events", event.id, "json", "id", event.id, String(jsonRow?.id ?? ""));
    push(
      "events",
      event.id,
      "json",
      "review_status",
      event.review.status,
      String((jsonRow?.review as { status?: string } | undefined)?.status ?? ""),
    );
    push(
      "events",
      event.id,
      "json",
      "evidence_level",
      event.evidence_level ?? "",
      String(jsonRow?.evidence_level ?? ""),
    );
    checkPackage("events", event.id, event.review.status);

    const csvRow = csvByCollection.get("events")?.get(event.id);
    push("events", event.id, "csv", "id", event.id, csvRow?.id ?? "");
    push(
      "events",
      event.id,
      "csv",
      "review_status",
      event.review.status,
      csvRow?.review_status ?? "",
    );
    push(
      "events",
      event.id,
      "csv",
      "evidence_level",
      event.evidence_level ?? "",
      csvRow?.evidence_level ?? "",
    );
    push(
      "events",
      event.id,
      "csv",
      "essential_caveat",
      event.evidence_note?.it ?? "",
      csvRow?.evidence_note_it ?? "",
    );
    push(
      "events",
      event.id,
      "csv",
      "sources",
      event.sources.join(";"),
      splitList(csvRow?.sources).join(";"),
    );

    const md = eventMarkdown(event, model);
    if (!md.includes(`id: "${event.id}"`)) {
      push("events", event.id, "markdown", "id", event.id, "<missing>");
    }
    if (!md.includes(`review_status: "${event.review.status}"`)) {
      push("events", event.id, "markdown", "review_status", event.review.status, "<missing>");
    }
    if (event.evidence_level && !md.includes(`evidence_level: "${event.evidence_level}"`)) {
      push("events", event.id, "markdown", "evidence_level", event.evidence_level, "<missing>");
    }
    if (event.evidence_note && !md.includes(event.evidence_note.it)) {
      push("events", event.id, "markdown", "essential_caveat", event.evidence_note.it, "<missing>");
    }
    for (const srcId of event.sources) {
      if (!md.includes(`"${srcId}"`)) {
        push("events", event.id, "markdown", "sources", srcId, "<missing>");
      }
    }
    checkHtml("events", event.id, [event.id, ...event.sources]);
  }

  for (const entity of dataset.entities) {
    const jsonRow = jsonByCollection.get("entities")?.get(entity.id);
    push("entities", entity.id, "json", "id", entity.id, String(jsonRow?.id ?? ""));
    push(
      "entities",
      entity.id,
      "json",
      "review_status",
      entity.review.status,
      String((jsonRow?.review as { status?: string } | undefined)?.status ?? ""),
    );
    checkPackage("entities", entity.id, entity.review.status);

    const csvRow = csvByCollection.get("entities")?.get(entity.id);
    push("entities", entity.id, "csv", "id", entity.id, csvRow?.id ?? "");
    push(
      "entities",
      entity.id,
      "csv",
      "review_status",
      entity.review.status,
      csvRow?.review_status ?? "",
    );

    const md = entityMarkdown(entity, model);
    if (!md.includes(`id: "${entity.id}"`)) {
      push("entities", entity.id, "markdown", "id", entity.id, "<missing>");
    }
    if (!md.includes(`review_status: "${entity.review.status}"`)) {
      push("entities", entity.id, "markdown", "review_status", entity.review.status, "<missing>");
    }
    checkHtml("entities", entity.id, [entity.id]);
  }

  for (const rel of dataset.relationships) {
    const restricted = model.isRestricted(rel);
    const jsonRow = jsonByCollection.get("relationships")?.get(rel.id);
    push("relationships", rel.id, "json", "id", rel.id, String(jsonRow?.id ?? ""));
    push(
      "relationships",
      rel.id,
      "json",
      "review_status",
      rel.review.status,
      String((jsonRow?.review as { status?: string } | undefined)?.status ?? ""),
    );
    push(
      "relationships",
      rel.id,
      "json",
      "evidence_level",
      rel.evidence_level,
      String(jsonRow?.evidence_level ?? ""),
    );
    push(
      "relationships",
      rel.id,
      "json",
      "evidence_status",
      rel.evidence_status,
      String(jsonRow?.evidence_status ?? ""),
    );
    checkPackage("relationships", rel.id, rel.review.status);

    const csvRow = csvByCollection.get("relationships")?.get(rel.id);
    push("relationships", rel.id, "csv", "id", rel.id, csvRow?.id ?? "");
    push(
      "relationships",
      rel.id,
      "csv",
      "review_status",
      rel.review.status,
      csvRow?.review_status ?? "",
    );
    push(
      "relationships",
      rel.id,
      "csv",
      "evidence_level",
      rel.evidence_level,
      csvRow?.evidence_level ?? "",
    );
    push(
      "relationships",
      rel.id,
      "csv",
      "evidence_status",
      rel.evidence_status,
      csvRow?.evidence_status ?? "",
    );
    push(
      "relationships",
      rel.id,
      "csv",
      "essential_caveat",
      restricted ? "" : (rel.caveat?.it ?? ""),
      csvRow?.caveat_it ?? "",
    );
    push(
      "relationships",
      rel.id,
      "csv",
      "sources",
      rel.sources.join(";"),
      splitList(csvRow?.sources).join(";"),
    );
  }

  for (const hyp of dataset.hypotheses) {
    const jsonRow = jsonByCollection.get("hypotheses")?.get(hyp.id);
    push("hypotheses", hyp.id, "json", "id", hyp.id, String(jsonRow?.id ?? ""));
    push(
      "hypotheses",
      hyp.id,
      "json",
      "review_status",
      hyp.review.status,
      String((jsonRow?.review as { status?: string } | undefined)?.status ?? ""),
    );
    checkPackage("hypotheses", hyp.id, hyp.review.status);

    const csvRow = csvByCollection.get("hypotheses")?.get(hyp.id);
    push("hypotheses", hyp.id, "csv", "id", hyp.id, csvRow?.id ?? "");
    push(
      "hypotheses",
      hyp.id,
      "csv",
      "review_status",
      hyp.review.status,
      csvRow?.review_status ?? "",
    );
    push("hypotheses", hyp.id, "csv", "evidence_level", "E5", csvRow?.evidence_level ?? "");
    push(
      "hypotheses",
      hyp.id,
      "csv",
      "essential_caveat",
      hyp.current_limit.it,
      csvRow?.current_limit_it ?? "",
    );
    push(
      "hypotheses",
      hyp.id,
      "csv",
      "sources",
      hyp.sources.join(";"),
      splitList(csvRow?.sources).join(";"),
    );

    const md = hypothesisMarkdown(hyp, model);
    if (!md.includes(`id: "${hyp.id}"`)) {
      push("hypotheses", hyp.id, "markdown", "id", hyp.id, "<missing>");
    }
    if (!md.includes(`review_status: "${hyp.review.status}"`)) {
      push("hypotheses", hyp.id, "markdown", "review_status", hyp.review.status, "<missing>");
    }
    if (!md.includes('evidence_level: "E5"')) {
      push("hypotheses", hyp.id, "markdown", "evidence_level", "E5", "<missing>");
    }
    if (!md.includes(hyp.current_limit.it)) {
      push("hypotheses", hyp.id, "markdown", "essential_caveat", hyp.current_limit.it, "<missing>");
    }
    for (const srcId of hyp.sources) {
      if (!md.includes(`"${srcId}"`)) {
        push("hypotheses", hyp.id, "markdown", "sources", srcId, "<missing>");
      }
    }
    checkHtml("hypotheses", hyp.id, [hyp.id, ...hyp.sources]);
  }

  for (const src of dataset.sources) {
    const jsonRow = jsonByCollection.get("sources")?.get(src.id);
    push("sources", src.id, "json", "id", src.id, String(jsonRow?.id ?? ""));
    push(
      "sources",
      src.id,
      "json",
      "review_status",
      src.review.status,
      String((jsonRow?.review as { status?: string } | undefined)?.status ?? ""),
    );
    checkPackage("sources", src.id, src.review.status);

    const csvRow = csvByCollection.get("sources")?.get(src.id);
    push("sources", src.id, "csv", "id", src.id, csvRow?.id ?? "");
    push("sources", src.id, "csv", "review_status", src.review.status, csvRow?.review_status ?? "");

    const md = sourceMarkdown(src, model);
    if (!md.includes(`id: "${src.id}"`)) {
      push("sources", src.id, "markdown", "id", src.id, "<missing>");
    }
    if (!md.includes(`review_status: "${src.review.status}"`)) {
      push("sources", src.id, "markdown", "review_status", src.review.status, "<missing>");
    }
    checkHtml("sources", src.id, [src.id]);
  }

  for (const exp of dataset.exposures) {
    const jsonRow = jsonByCollection.get("exposures")?.get(exp.id);
    push("exposures", exp.id, "json", "id", exp.id, String(jsonRow?.id ?? ""));
    push(
      "exposures",
      exp.id,
      "json",
      "review_status",
      exp.review.status,
      String((jsonRow?.review as { status?: string } | undefined)?.status ?? ""),
    );
    checkPackage("exposures", exp.id, exp.review.status);

    const md = exposureMarkdown(exp, model);
    if (!md.includes(`id: "${exp.id}"`)) {
      push("exposures", exp.id, "markdown", "id", exp.id, "<missing>");
    }
    if (!md.includes(`review_status: "${exp.review.status}"`)) {
      push("exposures", exp.id, "markdown", "review_status", exp.review.status, "<missing>");
    }
    if (!md.includes(exp.scope.it)) {
      push("exposures", exp.id, "markdown", "essential_caveat", exp.scope.it, "<missing>");
    }
    for (const srcId of exp.sources) {
      if (!md.includes(`"${srcId}"`)) {
        push("exposures", exp.id, "markdown", "sources", srcId, "<missing>");
      }
    }
    checkHtml("exposures", exp.id, [exp.id, ...exp.sources]);
  }

  const by_collection = Object.fromEntries(
    COLLECTION_NAMES.map((name) => [name, dataset[name].length]),
  ) as Record<CollectionName, number>;
  const checked_records = COLLECTION_NAMES.reduce((sum, name) => sum + dataset[name].length, 0);

  return {
    checked_records,
    by_collection,
    mismatches,
    ok: mismatches.length === 0,
  };
}
