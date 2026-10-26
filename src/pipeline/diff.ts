import { isDeepStrictEqual } from "node:util";
import { COLLECTIONS, type CollectionName, RELATION_CLASS_GROUP } from "../model/index.ts";
import type { DataFile } from "./load.ts";

/**
 * Human-readable evidence diff between two versions of `data/`, with flags
 * for changes that need editorial attention. In agent mode, changes that an
 * automated research agent must never make are errors.
 */

export type FieldChange = { field: string; before: unknown; after: unknown };
export type RecordChange = {
  collection: CollectionName;
  id: string;
  kind: "added" | "removed" | "modified";
  fields: FieldChange[];
};
export type Flag = { severity: "error" | "attention"; id: string; message: string };
export type DiffReport = { changes: RecordChange[]; flags: Flag[] };

type AnyRecord = Record<string, unknown> & { id: string };

const LEVEL_RANK: Record<string, number> = { E5: 0, E4: 1, E3: 2, E2: 3, E1: 4 };
const STRONG_GROUPS = new Set(["control", "financial"]);

function parse(file: DataFile): AnyRecord | null {
  try {
    const parsed = COLLECTIONS[file.collection].safeParse(JSON.parse(file.text));
    return parsed.success ? (parsed.data as AnyRecord) : (JSON.parse(file.text) as AnyRecord);
  } catch {
    return null;
  }
}

/** Flatten to `path → leaf value`; arrays of scalars stay whole for readability. */
function flatten(
  value: unknown,
  prefix = "",
  out = new Map<string, unknown>(),
): Map<string, unknown> {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value))
      flatten(child, prefix ? `${prefix}.${key}` : key, out);
  } else if (Array.isArray(value) && value.some((v) => v !== null && typeof v === "object")) {
    value.forEach((child, index) => {
      flatten(child, `${prefix}[${index}]`, out);
    });
  } else {
    out.set(prefix, value);
  }
  return out;
}

function fieldChanges(before: AnyRecord, after: AnyRecord): FieldChange[] {
  const a = flatten(before);
  const b = flatten(after);
  const keys = [...new Set([...a.keys(), ...b.keys()])].sort();
  return keys
    .filter((key) => !isDeepStrictEqual(a.get(key), b.get(key)))
    .map((field) => ({ field, before: a.get(field), after: b.get(field) }));
}

export function diffData(
  before: DataFile[],
  after: DataFile[],
  options: { agent?: boolean; persons?: Set<string> } = {},
): DiffReport {
  const index = (files: DataFile[]) =>
    new Map(files.map((f) => [f.path, { file: f, record: parse(f) }] as const));
  const old = index(before);
  const now = index(after);
  const persons = options.persons ?? new Set<string>();
  const changes: RecordChange[] = [];
  const flags: Flag[] = [];
  const agentError = (id: string, message: string) =>
    flags.push({ severity: options.agent ? "error" : "attention", id, message });
  const attention = (id: string, message: string) =>
    flags.push({ severity: "attention", id, message });

  for (const path of [...new Set([...old.keys(), ...now.keys()])].sort()) {
    const was = old.get(path);
    const is = now.get(path);
    const collection = (was?.file.collection ?? is?.file.collection) as CollectionName;
    const id = is?.record?.id ?? was?.record?.id ?? path;

    if (was && !is) {
      changes.push({ collection, id, kind: "removed", fields: [] });
      agentError(
        id,
        "record removed: corrections must stay visible; prefer review.notes or a status change",
      );
      continue;
    }
    if (!is?.record) continue;
    const record = is.record;
    const review = record.review as { status?: string } | undefined;

    if (!was) {
      changes.push({ collection, id, kind: "added", fields: fieldChanges({ id }, record) });
      if (review?.status !== "needs_review") {
        agentError(
          id,
          `new record with review.status "${review?.status}" (expected "needs_review")`,
        );
      }
      if (Array.isArray(record.provenance) && record.provenance.length > 0) {
        agentError(id, "new record claims provenance from the original corpus");
      }
      if (collection === "relationships") {
        if (record.primary_url === null) agentError(id, "new relationship without primary_url");
        checkRelationship(record, null, persons, attention);
      }
      if (collection === "hypotheses") attention(id, "new hypothesis");
      continue;
    }

    const previous = was.record;
    if (!previous || isDeepStrictEqual(previous, record)) continue;
    const fields = fieldChanges(previous, record);
    changes.push({ collection, id, kind: "modified", fields });

    if (fields.some((f) => f.field.startsWith("provenance"))) {
      agentError(id, "provenance changed: it must always match sources/original/");
    }
    const previousReview = previous.review as { status?: string } | undefined;
    if (previousReview?.status === "reviewed") {
      agentError(id, "modifies a record already marked as reviewed");
    }
    if (review?.status === "reviewed" && previousReview?.status !== "reviewed") {
      agentError(id, 'sets review.status to "reviewed": only a human reviewer may do this');
    }
    if (fields.some((f) => f.field === "review.translations.en.status" && f.after === "reviewed")) {
      agentError(id, 'marks a translation as "reviewed": only a human reviewer may do this');
    }
    if (collection === "hypotheses" && previous.status !== record.status) {
      if (record.status === "promoted") {
        agentError(id, "hypothesis promoted: requires a primary source and human approval");
      } else {
        attention(id, `hypothesis status ${String(previous.status)} → ${String(record.status)}`);
      }
    }
    if (collection === "relationships") checkRelationship(record, previous, persons, attention);
  }
  return { changes, flags };
}

function checkRelationship(
  record: AnyRecord,
  previous: AnyRecord | null,
  persons: Set<string>,
  attention: (id: string, message: string) => void,
): void {
  const person = [record.subject, record.object].find((id) => persons.has(String(id)));
  if (person) attention(record.id, `concerns the named person ${String(person)}`);
  if (previous) {
    const before = LEVEL_RANK[String(previous.evidence_level)] ?? 0;
    const after = LEVEL_RANK[String(record.evidence_level)] ?? 0;
    if (after > before) {
      attention(
        record.id,
        `evidence level raised ${String(previous.evidence_level)} → ${String(record.evidence_level)}`,
      );
    }
  }
  const group = RELATION_CLASS_GROUP[record.relation_class as keyof typeof RELATION_CLASS_GROUP];
  const previousGroup = previous
    ? RELATION_CLASS_GROUP[previous.relation_class as keyof typeof RELATION_CLASS_GROUP]
    : undefined;
  if (STRONG_GROUPS.has(group) && group !== previousGroup) {
    attention(record.id, `asserts a ${group} relationship`);
  }
}

const show = (value: unknown) => {
  if (value === undefined) return "—";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  const clipped = text.length > 160 ? `${text.slice(0, 157)}…` : text;
  return `\`${clipped.replaceAll("`", "'").replaceAll("|", "\\|").replaceAll("\n", " ")}\``;
};

export function diffMarkdown(report: DiffReport, title = "Evidence diff"): string {
  const lines = [`## ${title}`, ""];
  if (report.changes.length === 0) {
    lines.push("No changes to `data/`.");
    return `${lines.join("\n")}\n`;
  }
  const count = (kind: RecordChange["kind"]) =>
    report.changes.filter((c) => c.kind === kind).length;
  lines.push(
    `**${count("added")} added · ${count("modified")} modified · ${count("removed")} removed**`,
    "",
  );
  const errors = report.flags.filter((f) => f.severity === "error");
  const attention = report.flags.filter((f) => f.severity === "attention");
  if (errors.length > 0) {
    lines.push("### ❌ Not allowed", "");
    for (const flag of errors) lines.push(`- \`${flag.id}\`: ${flag.message}`);
    lines.push("");
  }
  if (attention.length > 0) {
    lines.push("### ⚠️ Needs editorial attention", "");
    for (const flag of attention) lines.push(`- \`${flag.id}\`: ${flag.message}`);
    lines.push("");
  }
  for (const change of report.changes) {
    lines.push(`### ${change.kind} · ${change.collection} · \`${change.id}\``, "");
    if (change.fields.length === 0) continue;
    lines.push("| Field | Before | After |", "| --- | --- | --- |");
    for (const field of change.fields) {
      lines.push(`| \`${field.field}\` | ${show(field.before)} | ${show(field.after)} |`);
    }
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}
