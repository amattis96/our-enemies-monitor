import { isMap, isScalar, parseDocument } from "yaml";

/** Update only scalar values in the top-level translation map, preserving all other bytes. */
export function updateTranslationYaml(text: string, values: Record<string, string>): string {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
  if (!match) throw new Error("missing front matter");
  const yaml = match[1] ?? "";
  const doc = parseDocument(yaml, { uniqueKeys: true });
  if (doc.errors.length) throw new Error(`invalid YAML: ${doc.errors[0]?.message}`);
  const map = doc.get("translation", true);
  if (!isMap(map)) throw new Error("translation must be a map");
  const edits: { start: number; end: number; value: string }[] = [];
  for (const [key, value] of Object.entries(values)) {
    const node = map.get(key, true);
    if (node === undefined) {
      const last = map.items.at(-1)?.value;
      if (!isScalar(last) || !last.range) throw new Error("cannot locate translation map end");
      const end = yaml.indexOf("\n", last.range[1]);
      const at = end === -1 ? yaml.length : end;
      edits.push({ start: at, end: at, value: `\n  ${key}: "${value}"` });
    } else {
      if (!isScalar(node) || !node.range) throw new Error(`invalid translation.${key}`);
      edits.push({ start: node.range[0], end: node.range[1], value: `"${value}"` });
    }
  }
  let updated = yaml;
  for (const edit of edits.sort((a, b) => b.start - a.start))
    updated = updated.slice(0, edit.start) + edit.value + updated.slice(edit.end);
  return (
    text.slice(0, match[0].indexOf(yaml)) +
    updated +
    text.slice(match[0].indexOf(yaml) + yaml.length)
  );
}
