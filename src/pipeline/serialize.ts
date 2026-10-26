/**
 * Canonical serialization of a record: keys in schema order (as produced by
 * parsing with the schema), 2-space indent, LF, trailing newline. Every file
 * in `data/` must be byte-identical to this form.
 */
export function serializeRecord(record: unknown): string {
  return `${JSON.stringify(record, null, 2)}\n`;
}
