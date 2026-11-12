import { beforeAll, describe, expect, it } from "vitest";
import { type M5Audit, readM5Audit, validateM5Audit } from "../src/editorial/m5.ts";
import type { Dataset } from "../src/model/index.ts";
import { readDataFiles } from "../src/pipeline/load.ts";
import { validateDataFiles } from "../src/pipeline/validate.ts";

let dataset: Dataset;
let audit: M5Audit;
beforeAll(() => {
  dataset = validateDataFiles(readDataFiles()).dataset;
  audit = readM5Audit();
});

describe("M5 source audit and Fonte_09 reconciliation", () => {
  it("checks all 36 original person links and 30 proposals", () => {
    expect(audit.relationship_reviews).toHaveLength(36);
    expect(audit.fonte09_decisions).toHaveLength(30);
    expect(validateM5Audit(audit, dataset)).toEqual([]);
    expect(
      audit.relationship_reviews
        .filter((r) => r.assessment === "primary_not_found")
        .map((r) => r.id),
    ).toEqual(["G-0230"]);
  });

  it("distinguishes event types, judicial status and unapproved atomic claims", () => {
    expect(audit.atomic_claims).toHaveLength(20);
    expect(audit.atomic_claims.every((r) => !r.human_approved)).toBe(true);
    expect(audit.fonte09_decisions.every((r) => !r.human_approved)).toBe(true);
    expect(audit.fonte09_decisions.find((r) => r.id === "EXT-007")?.target_id).toBe("EXT-006");
    expect(audit.fonte09_decisions.find((r) => r.id === "EXT-034")?.target_id).toBe("EXT-005");
    expect(audit.fonte09_decisions.find((r) => r.id === "EXT-031")?.action).toBe("split_required");
    expect(audit.atomic_claims.find((r) => r.id === "C-014")?.limitation_it).toContain(
      "non è stato condannato",
    );
    expect(dataset.relationships.find((r) => r.id === "G-0040")?.events).toEqual(["TL-0035"]);
    expect(dataset.relationships.find((r) => r.id === "G-0041")?.events).toEqual(["TL-0035"]);
  });

  it("detects invalid approvals, mismatched evidence and incomplete audits", () => {
    const approval = structuredClone(audit);
    if (approval.atomic_claims[0]) approval.atomic_claims[0].human_approved = true;
    expect(validateM5Audit(approval, dataset).join(" ")).toContain("approved claim");

    const mismatch = structuredClone(audit);
    if (mismatch.relationship_reviews[0]) mismatch.relationship_reviews[0].source_id = "US-RAF";
    expect(validateM5Audit(mismatch, dataset).join(" ")).toContain("primary_url differs");

    const missing = structuredClone(audit);
    missing.fonte09_decisions.pop();
    expect(validateM5Audit(missing, dataset).join(" ")).toContain("missing Fonte_09 decision");
  });
});
