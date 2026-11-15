import { beforeAll, describe, expect, it } from "vitest";
import { importBaseline } from "../src/pipeline/baseline/import.ts";
import { diffData, diffMarkdown, type Flag, relaxFlags } from "../src/pipeline/diff.ts";
import { type DataFile, datasetToFiles } from "../src/pipeline/load.ts";
import { serializeRecord } from "../src/pipeline/serialize.ts";

let base: DataFile[];
const persons = new Set(["GILL", "MED", "MUSK"]);
beforeAll(() => {
  base = datasetToFiles(importBaseline());
});

function changed(path: string, change: (record: Record<string, unknown>) => void): DataFile[] {
  return base.map((file) => {
    if (file.path !== path) return file;
    const record = JSON.parse(file.text);
    change(record);
    return { ...file, text: serializeRecord(record) };
  });
}

const errors = (files: DataFile[], relaxed = false) =>
  diffData(base, files, { relaxed, persons })
    .flags.filter((f) => f.severity === "error")
    .map((f) => `${f.id}: ${f.message}`);

const newRelationship = (overrides: Record<string, unknown> = {}): DataFile => ({
  collection: "relationships",
  path: "relationships/G-9001.json",
  text: serializeRecord({
    id: "G-9001",
    subject: "MED",
    predicate: "FINANZIA",
    object: "VOE",
    relation_class: "financial",
    evidence_level: "E2",
    evidence_status: "institutional_attribution",
    events: [],
    valid_from: null,
    valid_to: null,
    primary_url: "https://example.org/act",
    caveat: null,
    sources: ["S01"],
    review: { status: "needs_review", notes: [] },
    provenance: [],
    ...overrides,
  }),
});

describe("evidence diff", () => {
  it("reports nothing when data is unchanged", () => {
    const report = diffData(base, base, { persons });
    expect(report.changes).toEqual([]);
    expect(diffMarkdown(report)).toContain("No changes");
  });

  it("accepts a well-formed agent proposal but flags it for attention", () => {
    const report = diffData(base, [...base, newRelationship()], { persons });
    expect(report.flags.filter((f) => f.severity === "error")).toEqual([]);
    const attention = report.flags.map((f) => f.message);
    expect(attention).toContainEqual(expect.stringContaining("named person MED"));
    expect(attention).toContainEqual(expect.stringContaining("asserts a financial relationship"));
    expect(diffMarkdown(report)).toContain("| `predicate` | — | `FINANZIA` |");
  });

  it("rejects agent relationships without a primary source or review status", () => {
    const found = errors([
      ...base,
      newRelationship({ primary_url: null, review: { status: "reviewed", notes: [] } }),
    ]);
    expect(found).toContainEqual(expect.stringContaining("without primary_url"));
    expect(found).toContainEqual(expect.stringContaining('expected "needs_review"'));
  });

  it("rejects deletions and provenance changes by agents", () => {
    expect(errors(base.filter((f) => f.path !== "entities/RU.json"))).toContainEqual(
      expect.stringContaining("record removed"),
    );
    expect(
      errors(
        changed("entities/RU.json", (r) => {
          (r.provenance as { row: number }[])[0] = {
            ...(r.provenance as { row: number }[])[0],
            row: 2,
          } as never;
        }),
      ),
    ).toContainEqual(expect.stringContaining("provenance changed"));
  });

  it("rejects self-review and hypothesis promotion by agents", () => {
    expect(
      errors(
        changed("events/TL-0001.json", (r) => {
          (r.review as { status: string }).status = "reviewed";
        }),
      ),
    ).toContainEqual(expect.stringContaining("only a human reviewer"));
    expect(
      errors(
        changed("hypotheses/H01.json", (r) => {
          r.status = "promoted";
        }),
      ),
    ).toContainEqual(expect.stringContaining("hypothesis promoted"));
  });

  it("flags a change of evidence level in either direction, without ranking E2/E3 (ADR-04)", () => {
    const report = diffData(
      base,
      changed("relationships/G-0002.json", (r) => {
        r.evidence_level = "E3";
      }),
      { persons },
    );
    expect(report.flags.map((f) => f.message)).toContain("evidence level changed E2 → E3");
  });

  it("flags changed evidence levels", () => {
    const report = diffData(
      base,
      changed("relationships/G-0002.json", (r) => {
        r.evidence_level = "E1";
      }),
      { persons },
    );
    expect(report.flags.map((f) => f.message)).toContain("evidence level changed E2 → E1");
  });

  it("is strict on every branch by default (R3)", () => {
    const files = base.filter((f) => f.path !== "entities/RU.json");
    expect(errors(files)).toHaveLength(1);
    expect(diffData(base, files, { persons }).flags[0]?.severity).toBe("error");
  });

  it("relaxed lowers waivable errors to waived attention, keeping them listed", () => {
    const files = base.filter((f) => f.path !== "entities/RU.json");
    expect(errors(files, true)).toEqual([]);
    const report = diffData(base, files, { persons, relaxed: true });
    expect(report.flags[0]).toMatchObject({ severity: "attention", waived: true });
    expect(diffMarkdown(report)).toContain("Waived by the maintainer");
    expect(diffMarkdown(report)).toContain("record removed");
  });

  it("never waives a provenance change", () => {
    const files = changed("entities/RU.json", (r) => {
      (r.provenance as { row: number }[])[0] = {
        ...(r.provenance as { row: number }[])[0],
        row: 2,
      } as never;
    });
    expect(errors(files, true)).toContainEqual(expect.stringContaining("provenance changed"));
    const relaxed = relaxFlags([
      { severity: "error", id: "x", message: "m", waivable: false },
      { severity: "error", id: "y", message: "n" },
    ]);
    expect(relaxed.map((f) => f.severity)).toEqual(["error", "attention"]);
  });

  it("prints the flags even when data/ is unchanged (the report must explain the failure)", () => {
    const flags: Flag[] = [{ severity: "error", id: "src/x.ts", message: "outside the policy" }];
    const markdown = diffMarkdown({ changes: [], flags });
    expect(markdown).toContain("No changes to `data/`");
    expect(markdown).toContain("outside the policy");
  });
});

describe("S5: changes of meaning on existing records", () => {
  const flagsOf = (path: string, change: (r: Record<string, unknown>) => void) =>
    diffData(base, changed(path, change), { persons: new Set() }).flags;
  const recordOf = (path: string) =>
    JSON.parse(base.find((f) => f.path === path)?.text ?? "{}") as Record<string, unknown>;
  const review = (r: Record<string, unknown>) => (r.review as { status: string }).status;
  const P = "relationships/G-0002.json";

  it("errors on a rewritten predicate of a visible record, attention on a draft", () => {
    expect(review(recordOf(P))).not.toBe("needs_review");
    const flags = flagsOf(P, (r) => {
      r.predicate = r.predicate === "ESEGUE" ? "ATTRIBUITO_A" : "ESEGUE";
    });
    expect(flags).toContainEqual(
      expect.objectContaining({
        severity: "error",
        message: expect.stringContaining("predicate rewritten"),
      }),
    );
    const draft = flagsOf(P, (r) => {
      (r.review as { status: string }).status = "needs_review";
    });
    expect(draft.filter((f) => f.severity === "error")).toEqual([]);
    const both = diffData(
      changed(P, (r) => {
        (r.review as { status: string }).status = "needs_review";
      }),
      changed(P, (r) => {
        (r.review as { status: string }).status = "needs_review";
        r.predicate = "ESEGUE";
      }),
      { persons: new Set() },
    ).flags;
    expect(both.filter((f) => f.message.includes("predicate rewritten"))[0]?.severity).toBe(
      "attention",
    );
  });

  it("errors on a removed caveat and on a changed evidence status at the same level", () => {
    const withCaveat = changed(P, (r) => {
      r.caveat = { it: "Cautela originale piuttosto lunga e articolata." };
    });
    const without = diffData(
      withCaveat,
      changed(P, (r) => {
        r.caveat = null;
      }),
      { persons: new Set() },
    ).flags;
    expect(without).toContainEqual(
      expect.objectContaining({ severity: "error", message: "caveat removed" }),
    );
    const status = flagsOf(P, (r) => {
      r.evidence_status =
        r.evidence_status === "institutional_attribution"
          ? "official_statement"
          : "institutional_attribution";
    });
    expect(status).toContainEqual(
      expect.objectContaining({
        severity: "error",
        message: expect.stringContaining("evidence status"),
      }),
    );
  });

  it("reports replaced sources with the detail, but not added ones", () => {
    const replaced = flagsOf(P, (r) => {
      r.sources = ["S99"];
    });
    expect(replaced.map((f) => f.message)).toContainEqual(
      expect.stringMatching(/sources replaced: -S\d+ \+S99/),
    );
    const added = flagsOf(P, (r) => {
      r.sources = [...(r.sources as string[]), "S99"];
    });
    expect(added.map((f) => f.message).join()).not.toContain("sources replaced");
  });

  it("flags valid_from and primary_url changes as attention", () => {
    const flags = flagsOf(P, (r) => {
      r.valid_from = "2020-01";
      r.primary_url = "https://example.org/other";
    });
    const messages = flags.map((f) => f.message);
    expect(messages).toContainEqual(expect.stringContaining("valid_from changed"));
    expect(messages).toContainEqual(expect.stringContaining("primary_url changed"));
    expect(
      flags.filter((f) => f.message.includes("changed")).every((f) => f.severity === "attention"),
    ).toBe(true);
  });

  it("flags an English-only edit, not a joint Italian and English edit", () => {
    const en = flagsOf("events/TL-0001.json", (r) => {
      (r.title as Record<string, string>).en = "Edited English title only";
    });
    expect(en.map((f) => f.message)).toContainEqual(
      expect.stringContaining("English text of title"),
    );
    const both = flagsOf("events/TL-0001.json", (r) => {
      (r.title as Record<string, string>).en = "Edited English title";
      (r.title as Record<string, string>).it = "Titolo italiano modificato";
    });
    expect(both.map((f) => f.message).join()).not.toContain("English text of title");
  });
});
