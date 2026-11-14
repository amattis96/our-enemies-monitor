import { isDeepStrictEqual } from "node:util";
import { COLLECTIONS, type CollectionName, RELATION_CLASS_GROUP } from "../model/index.ts";
import type { DataFile } from "./load.ts";

/**
 * Human-readable evidence diff between two versions of `data/`, with flags
 * for changes that need editorial attention. The rules are strict on every
 * branch: changes an automated agent must never make are errors. A maintainer
 * waiver (`relaxed`) lowers the *waivable* errors to attention flags that stay
 * listed as waived; errors with `waivable: false` (provenance, immutable
 * sources, path policy) can never be waived.
 */

export type FieldChange = { field: string; before: unknown; after: unknown };
export type RecordChange = {
  collection: CollectionName;
  id: string;
  kind: "added" | "removed" | "modified";
  fields: FieldChange[];
};
export type Flag = {
  severity: "error" | "attention";
  id: string;
  message: string;
  /** Errors default to waivable; `false` means no maintainer label can lower it. */
  waivable?: boolean;
  /** Set by `relaxFlags`: an error lowered by the maintainer waiver. */
  waived?: boolean;
};
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

/** Apply the maintainer waiver: waivable errors become waived attention flags. */
export function relaxFlags(flags: Flag[]): Flag[] {
  return flags.map((flag) =>
    flag.severity === "error" && flag.waivable !== false
      ? { ...flag, severity: "attention", waived: true }
      : flag,
  );
}

export function diffData(
  before: DataFile[],
  after: DataFile[],
  options: { relaxed?: boolean; persons?: Set<string> } = {},
): DiffReport {
  const index = (files: DataFile[]) =>
    new Map(files.map((f) => [f.path, { file: f, record: parse(f) }] as const));
  const old = index(before);
  const now = index(after);
  const persons = options.persons ?? new Set<string>();
  const changes: RecordChange[] = [];
  const flags: Flag[] = [];
  const strictError = (id: string, message: string, waivable = true) =>
    flags.push({ severity: "error", id, message, ...(waivable ? {} : { waivable: false }) });
  const attention = (id: string, message: string) =>
    flags.push({ severity: "attention", id, message });

  for (const path of [...new Set([...old.keys(), ...now.keys()])].sort()) {
    const was = old.get(path);
    const is = now.get(path);
    const collection = (was?.file.collection ?? is?.file.collection) as CollectionName;
    const id = is?.record?.id ?? was?.record?.id ?? path;

    if (was && !is) {
      changes.push({ collection, id, kind: "removed", fields: [] });
      strictError(
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
        strictError(
          id,
          `new record with review.status "${review?.status}" (expected "needs_review")`,
        );
      }
      if (Array.isArray(record.provenance) && record.provenance.length > 0) {
        strictError(id, "new record claims provenance from the original corpus");
      }
      if (collection === "relationships") {
        if (record.primary_url === null) strictError(id, "new relationship without primary_url");
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
      strictError(id, "provenance changed: it must always match sources/original/", false);
    }
    const previousReview = previous.review as { status?: string } | undefined;
    if (previousReview?.status === "reviewed") {
      strictError(id, "modifies a record already marked as reviewed");
    }
    if (review?.status === "reviewed" && previousReview?.status !== "reviewed") {
      strictError(id, 'sets review.status to "reviewed": only a human reviewer may do this');
    }
    if (fields.some((f) => f.field === "review.translations.en.status" && f.after === "reviewed")) {
      strictError(id, 'marks a translation as "reviewed": only a human reviewer may do this');
    }
    if (collection === "hypotheses" && previous.status !== record.status) {
      if (record.status === "promoted") {
        strictError(id, "hypothesis promoted: requires a primary source and human approval");
      } else {
        attention(id, `hypothesis status ${String(previous.status)} → ${String(record.status)}`);
      }
    }
    if (collection === "relationships") checkRelationship(record, previous, persons, attention);
    checkMeaning(previous, record, fields, strictError, attention);
  }
  return { changes, flags: options.relaxed ? relaxFlags(flags) : flags };
}

/** Pure text of a localized or plain value, for length comparisons. */
const textOf = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (value !== null && typeof value === "object") {
    const it = (value as { it?: unknown }).it;
    return typeof it === "string" ? it : "";
  }
  return "";
};

const asList = (value: unknown): string[] => (Array.isArray(value) ? value.map(String) : []);

/**
 * S5: changes of meaning on an existing record. On records already visible
 * (anything but `needs_review`) a rewritten predicate, a dropped or halved
 * caveat or a changed evidence status are errors; on drafts, attention. A
 * change of the English text alone is attention: the Italian text is canonical.
 */
function checkMeaning(
  previous: AnyRecord,
  record: AnyRecord,
  fields: FieldChange[],
  strictError: (id: string, message: string) => void,
  attention: (id: string, message: string) => void,
): void {
  const names = new Set(fields.map((f) => f.field));
  const touches = (name: string) => [...names].some((n) => n === name || n.startsWith(`${name}.`));
  const visible = (previous.review as { status?: string } | undefined)?.status !== "needs_review";
  const meaning = (message: string) =>
    visible ? strictError(record.id, message) : attention(record.id, message);

  if (names.has("predicate")) {
    meaning(
      `predicate rewritten ${String(previous.predicate)} → ${String(record.predicate)}: attribution and execution are different claims`,
    );
  }
  if (touches("caveat")) {
    const was = textOf(previous.caveat);
    if (previous.caveat !== null && previous.caveat !== undefined && record.caveat === null) {
      meaning("caveat removed");
    } else if (was.length > 0 && textOf(record.caveat).length < was.length / 2) {
      meaning("caveat shortened by more than half");
    } else {
      attention(record.id, "caveat rewritten");
    }
  }
  if (names.has("evidence_status") && !names.has("evidence_level")) {
    meaning(
      `evidence status ${String(previous.evidence_status)} → ${String(record.evidence_status)} at the same evidence level`,
    );
  }
  if (names.has("sources")) {
    const kept = new Set(asList(record.sources));
    const removed = asList(previous.sources).filter((code) => !kept.has(code));
    if (removed.length > 0) {
      const old = new Set(asList(previous.sources));
      const added = asList(record.sources).filter((code) => !old.has(code));
      attention(
        record.id,
        `sources replaced: ${[...removed.map((c) => `-${c}`), ...added.map((c) => `+${c}`)].join(" ")}`,
      );
    }
  }
  for (const name of ["valid_from", "valid_to", "primary_url", "relation_class"] as const) {
    if (names.has(name)) {
      attention(
        record.id,
        `${name} changed ${JSON.stringify(previous[name] ?? null)} → ${JSON.stringify(record[name] ?? null)}`,
      );
    }
  }
  for (const name of names) {
    if (!name.endsWith(".en") || name.startsWith("review.")) continue;
    const prefix = name.slice(0, -3);
    if (!names.has(`${prefix}.it`)) {
      attention(record.id, `English text of ${prefix} changed while the Italian text did not`);
    }
  }
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
  const count = (kind: RecordChange["kind"]) =>
    report.changes.filter((c) => c.kind === kind).length;
  if (report.changes.length === 0) {
    lines.push("No changes to `data/`.", "");
  } else {
    lines.push(
      `**${count("added")} added · ${count("modified")} modified · ${count("removed")} removed**`,
      "",
    );
  }
  const errors = report.flags.filter((f) => f.severity === "error");
  const waived = report.flags.filter((f) => f.waived);
  const attention = report.flags.filter((f) => f.severity === "attention" && !f.waived);
  if (errors.length > 0) {
    lines.push("### ❌ Not allowed", "");
    for (const flag of errors) {
      lines.push(
        `- \`${flag.id}\`: ${flag.message}${flag.waivable === false ? " (cannot be waived)" : ""}`,
      );
    }
    lines.push("");
  }
  if (waived.length > 0) {
    lines.push("### 🔓 Waived by the maintainer (still part of the review)", "");
    for (const flag of waived) lines.push(`- \`${flag.id}\`: ${flag.message}`);
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
