import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { Dataset } from "../../model/index.ts";
import { ProposalFile } from "../../model/proposals.ts";
import type { Issue } from "../validate.ts";

/**
 * The archive of incremental sources (`sources/incremental/`): Markdown
 * reports and their proposals sidecars, in one deterministic total order.
 *
 * Ingest deduplicates only against `data/`. To make that sufficient, every
 * archived sidecar that precedes the input in the total order must already
 * be ingested; later sidecars (and `--compare` files) are only reported as
 * attention points, never used to classify an operation.
 */

export const INCREMENTAL_DIR = "sources/incremental";

const SIDECAR_NAME = /^Fonte_(\d+)\.proposals\.json$/;
const MARKDOWN_NAME = /^Fonte_(\d+)_[^/]*\.md$/;

export type ArchivedSidecar = {
  /** File name, e.g. `Fonte_12.proposals.json`. */
  name: string;
  /** Repository path, e.g. `sources/incremental/Fonte_12.proposals.json`. */
  path: string;
  proposals: ProposalFile;
};

export type InvalidSidecar = { name: string; path: string; problems: string[] };

export type Archive = {
  /** Every file name of the directory, sorted. */
  names: string[];
  /** Valid sidecars, in total order (see `compareSidecars`). */
  sidecars: ArchivedSidecar[];
  /** Sidecars that are not valid JSON or do not pass the contract. */
  invalid: InvalidSidecar[];
  /** Markdown text by repository path, sorted by name. */
  markdown: Map<string, string>;
};

/** `NN` of `Fonte_NN_….md` or `Fonte_NN.proposals.json`; null for other names. */
export function fonteNumber(name: string): number | null {
  const match = name.match(SIDECAR_NAME) ?? name.match(MARKDOWN_NAME);
  return match ? Number(match[1]) : null;
}

/** Digits of the `Fonte_NN` prefix as written (to detect `Fonte_100`). */
function fonteDigits(name: string): string | null {
  return (name.match(SIDECAR_NAME) ?? name.match(MARKDOWN_NAME))?.[1] ?? null;
}

/** Parse a sidecar's text; problems are readable lines (`path: message`). */
export function parseSidecar(text: string): { proposals: ProposalFile } | { problems: string[] } {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (error) {
    return { problems: [`not valid JSON: ${(error as Error).message}`] };
  }
  const parsed = ProposalFile.safeParse(json);
  if (parsed.success) return { proposals: parsed.data };
  return {
    problems: parsed.error.issues.map(
      (issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`,
    ),
  };
}

type Keyed = { name: string; proposals: ProposalFile };

/**
 * Total order: source number, then creation date, then file name. Date and
 * name only break ties between sidecars with the same number, which
 * `pnpm validate:sidecars` reports as an error; they keep the order (and so
 * the pending list and the report) deterministic meanwhile.
 */
export function compareSidecars(a: Keyed, b: Keyed): number {
  const number = (k: Keyed) => Number(k.proposals.source.code.slice(1));
  const byString = (x: string, y: string) => (x < y ? -1 : x > y ? 1 : 0);
  return (
    number(a) - number(b) ||
    byString(a.proposals.source.created_at, b.proposals.source.created_at) ||
    byString(a.name, b.name)
  );
}

/**
 * Whether a sidecar has been ingested: `data/sources` holds its corpus
 * document, with the sidecar's Markdown among its files. The first `--write`
 * creates it, and a blocked plan writes nothing.
 */
export function isIngested(proposals: ProposalFile, dataset: Dataset): boolean {
  const corpus = dataset.sources.find((s) => s.id === proposals.source.code);
  return corpus?.type === "corpus_document" && corpus.files.includes(proposals.source.file);
}

/** Read the archive directory. `names` overrides the directory listing (tests). */
export function readArchive(dir: string, names: string[] = readdirSync(dir)): Archive {
  const sorted = [...names].sort();
  const sidecars: ArchivedSidecar[] = [];
  const invalid: InvalidSidecar[] = [];
  const markdown = new Map<string, string>();
  for (const name of sorted) {
    const repoPath = `${INCREMENTAL_DIR}/${name}`;
    const text = () => readFileSync(path.join(dir, name), "utf8");
    if (name.endsWith(".proposals.json")) {
      const parsed = parseSidecar(text());
      if ("proposals" in parsed)
        sidecars.push({ name, path: repoPath, proposals: parsed.proposals });
      else invalid.push({ name, path: repoPath, problems: parsed.problems });
    } else if (name.endsWith(".md")) {
      markdown.set(repoPath, text());
    }
  }
  sidecars.sort(compareSidecars);
  return { names: sorted, sidecars, invalid, markdown };
}

/** One warning per invalid sidecar: ingest ignores it instead of stopping. */
export function archiveWarnings(archive: Archive): string[] {
  return archive.invalid.map(
    (s) => `${s.path}: invalid proposals sidecar, ignored (${s.problems.join("; ")})`,
  );
}

export type ArchiveContext = {
  /** Codes of earlier archived sidecars not yet ingested (each blocks the run). */
  pending: string[];
  /** Earlier pending codes the maintainer skipped with `--skip-pending`. */
  skipped: string[];
  /** `--skip-pending` codes that are not earlier pending sidecars (ignored). */
  unusedSkips: string[];
  /** Paths of other archived sidecars declaring the input's code (each blocks the run). */
  sameCode: string[];
  /** Later archived sidecars and `--compare` files: attention only. */
  later: ProposalFile[];
  /** Fonte Markdown without a sidecar and not registered as a corpus document. */
  legacyMarkdown: Map<string, string>;
};

/**
 * Position of the input sidecar in the archive. Only the archived file at
 * the input's own path is the input itself; another archived sidecar that
 * declares the same code is reported in `sameCode`. `skip` lists earlier
 * pending codes a maintainer chose to step over (`--skip-pending`).
 */
export function archiveContext(
  input: Keyed & { path: string | null },
  archive: Archive,
  dataset: Dataset,
  compare: ProposalFile[] = [],
  skip: string[] = [],
): ArchiveContext {
  const code = input.proposals.source.code;
  const others = archive.sidecars.filter((s) => s.path !== input.path);
  const sameCode = others.filter((s) => s.proposals.source.code === code).map((s) => s.path);
  const rest = others.filter((s) => s.proposals.source.code !== code);
  const earlier = rest
    .filter((s) => compareSidecars(s, input) < 0 && !isIngested(s.proposals, dataset))
    .map((s) => s.proposals.source.code);
  const later = [
    ...rest.filter((s) => compareSidecars(s, input) > 0).map((s) => s.proposals),
    ...compare.filter((p) => p.source.code !== code),
  ];
  const withSidecar = new Set(
    archive.names.flatMap((name) => (SIDECAR_NAME.test(name) ? [fonteNumber(name)] : [])),
  );
  const registered = new Set(
    dataset.sources.filter((s) => s.type === "corpus_document").flatMap((s) => s.files),
  );
  const own = Number(code.slice(1));
  const legacyMarkdown = new Map(
    [...archive.markdown].filter(([file]) => {
      const number = fonteNumber(path.basename(file));
      return number !== null && number !== own && !withSidecar.has(number) && !registered.has(file);
    }),
  );
  return {
    pending: earlier.filter((c) => !skip.includes(c)),
    skipped: earlier.filter((c) => skip.includes(c)),
    unusedSkips: skip.filter((c) => !earlier.includes(c)),
    sameCode,
    later,
    legacyMarkdown,
  };
}

/** First Fonte number from which Task A must deliver a sidecar with the Markdown. */
export const SIDECAR_REQUIRED_FROM = 12;

/**
 * Rules of `pnpm validate:sidecars` on the archive: valid contract, naming,
 * uniqueness of `Fonte_NN`, code and file, and no collision with a corpus
 * document already registered in `data/sources` for another file.
 */
export function checkArchive(archive: Archive, dataset: Dataset): Issue[] {
  const issues: Issue[] = [];
  const error = (file: string, message: string) =>
    issues.push({ severity: "error", file, message });
  const warning = (file: string, message: string) =>
    issues.push({ severity: "warning", file, message });

  for (const s of archive.invalid) {
    for (const problem of s.problems) error(s.path, `invalid proposals sidecar: ${problem}`);
  }

  const markdownByNumber = new Map<number, string[]>();
  const sidecarByNumber = new Map<number, string[]>();
  for (const name of archive.names) {
    const file = `${INCREMENTAL_DIR}/${name}`;
    const isSidecar = name.endsWith(".proposals.json");
    if (!isSidecar && !name.endsWith(".md")) continue;
    const digits = fonteDigits(name);
    if (digits === null) {
      // Other files (e.g. a README) are not sources; a misnamed sidecar or
      // Fonte Markdown is an error.
      if (isSidecar) error(file, "sidecar name must be Fonte_NN.proposals.json");
      else if (name.startsWith("Fonte_")) error(file, "Markdown name must be Fonte_NN_<title>.md");
      continue;
    }
    if (digits.length !== 2) {
      error(file, `Fonte_${digits}: only two-digit source numbers are supported (IDs S\\d{2})`);
      continue;
    }
    const byNumber = isSidecar ? sidecarByNumber : markdownByNumber;
    byNumber.set(Number(digits), [...(byNumber.get(Number(digits)) ?? []), file]);
  }
  for (const [label, byNumber] of [
    ["Markdown sources", markdownByNumber],
    ["sidecars", sidecarByNumber],
  ] as const) {
    for (const [number, files] of byNumber) {
      if (files.length > 1) {
        for (const file of files) {
          error(
            file,
            `Fonte_${String(number).padStart(2, "0")} is used by ${files.length} ${label}: ${files.join(", ")}`,
          );
        }
      }
    }
  }

  const byCode = new Map<string, string[]>();
  const byFile = new Map<string, string[]>();
  for (const s of archive.sidecars) {
    const { code, file } = s.proposals.source;
    const number = fonteNumber(s.name);
    if (number !== null && code !== `S${String(number).padStart(2, "0")}`) {
      error(s.path, `source.code ${code} does not match the file name ${s.name}`);
    }
    if (!archive.markdown.has(file)) {
      error(s.path, `source.file ${file} is not in ${INCREMENTAL_DIR}/`);
    } else if (fonteNumber(path.basename(file)) !== number) {
      error(s.path, `source.file ${file} has a different Fonte number from ${s.name}`);
    }
    byCode.set(code, [...(byCode.get(code) ?? []), s.path]);
    byFile.set(file, [...(byFile.get(file) ?? []), s.path]);
    const registered = dataset.sources.find((source) => source.id === code);
    if (registered && !registered.files.includes(file)) {
      error(
        s.path,
        `${code} is already registered in data/sources for ${registered.files.join(", ") || "another document"}`,
      );
    }
  }
  for (const [key, paths] of [...byCode, ...byFile]) {
    if (paths.length > 1) {
      for (const p of paths) error(p, `${key} is declared by ${paths.length} sidecars`);
    }
  }

  for (const [number, files] of markdownByNumber) {
    if (number >= SIDECAR_REQUIRED_FROM && !sidecarByNumber.has(number)) {
      for (const file of files) warning(file, "Markdown source without a proposals sidecar");
    }
  }
  const queue = archive.sidecars.filter((s) => !isIngested(s.proposals, dataset));
  queue.forEach((s, index) => {
    warning(
      s.path,
      `${s.proposals.source.code} not yet ingested (position ${index + 1} of ${queue.length} in ingest order)`,
    );
  });
  return issues;
}
