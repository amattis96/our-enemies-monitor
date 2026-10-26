import { readFileSync } from "node:fs";
import { parse } from "csv-parse/sync";
import { repoPath } from "./paths.ts";

export type CsvRow = Record<string, string>;

/** Reads files under `sources/` once, so provenance checks stay cheap. */
export class SourceReader {
  readonly #csv = new Map<string, CsvRow[]>();
  readonly #lines = new Map<string, string[]>();

  csvRows(file: string): CsvRow[] {
    let rows = this.#csv.get(file);
    if (!rows) {
      rows = parse(readFileSync(repoPath(file)), {
        bom: true,
        columns: true,
        skip_empty_lines: true,
      }) as CsvRow[];
      this.#csv.set(file, rows);
    }
    return rows;
  }

  lines(file: string): string[] {
    let lines = this.#lines.get(file);
    if (!lines) {
      lines = readFileSync(repoPath(file), "utf8").split(/\r?\n/);
      this.#lines.set(file, lines);
    }
    return lines;
  }
}
