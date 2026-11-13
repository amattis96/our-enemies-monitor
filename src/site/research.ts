import { readdirSync, readFileSync } from "node:fs";
import { parse } from "yaml";
import { repoPath } from "../pipeline/paths.ts";

/**
 * Immutable documentary archive, deliberately separate from the reviewed
 * canonical data in data/. Archive entries do NOT add timeline events,
 * entity links, publication approval or a newer canonical cutoff.
 */
export type ArchivedResearch = {
  id: string;
  title: string;
  createdAt: string;
  kind: "incremental" | "thematic";
  path: string;
  url: string;
};

function archiveEntry(path: string, kind: ArchivedResearch["kind"]): ArchivedResearch | null {
  const text = readFileSync(repoPath(path), "utf8");
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text);
  if (!match) return null;

  let meta: Record<string, unknown>;
  try {
    const value: unknown = parse(match[1] ?? "");
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    meta = value as Record<string, unknown>;
  } catch {
    return null;
  }

  const createdAt = meta.created_at;
  if (typeof createdAt !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(createdAt)) return null;
  const heading = /^#\s+(.+?)\s*$/m.exec(text.slice(match[0].length))?.[1];
  const rawTitle = typeof meta.title === "string" ? meta.title : heading;
  if (!rawTitle) return null;
  const code = typeof meta.source_id === "string" ? meta.source_id : path.match(/Fonte_(\d+)/)?.[1];
  const id = code?.match(/^\d+$/) ? "S" + code : (code ?? "ARCHIVE");
  const url =
    "https://github.com/amattis96/our-enemies-monitor/blob/main/" +
    path.split("/").map(encodeURIComponent).join("/");

  return { id, title: rawTitle.trim(), createdAt, kind, path, url };
}

/** Latest documentary sources committed to main, including noncanonical proposals. */
export function archivedResearch(): ArchivedResearch[] {
  const dirs = [
    { folder: "sources/incremental", kind: "incremental" },
    { folder: "sources/thematic", kind: "thematic" },
  ] as const;
  return dirs
    .flatMap(({ folder, kind }) =>
      readdirSync(repoPath(folder))
        .filter((file) => file.endsWith(".md"))
        .map((file) => archiveEntry(folder + "/" + file, kind)),
    )
    .filter((item): item is ArchivedResearch => item !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
}
