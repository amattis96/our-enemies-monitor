import { z } from "zod";

/**
 * PK-02 Test Families and CI Cadence Frequencies.
 * Defines the five canonical quality families and when each runs.
 */

export const TEST_FAMILY_IDS = [
  "data_integrity",
  "evidence_integrity",
  "discovery_quality",
  "agent_quality",
  "publication_integrity",
] as const;

export const TEST_FREQUENCIES = [
  "per_pr",
  "per_deploy",
  "prompt_change",
  "release",
  "design_change",
] as const;

export const TestFamilyIdSchema = z
  .enum(TEST_FAMILY_IDS)
  .describe("Canonical PK-02 test family identifier.");

export const TestFrequencySchema = z
  .enum(TEST_FREQUENCIES)
  .describe("Trigger cadence at which a test family is executed.");

export const TestFamilySpecSchema = z.strictObject({
  id: TestFamilyIdSchema.describe("Unique identifier of the test family."),
  title: z.string().min(1).describe("Human-readable name of the test family."),
  description: z.string().min(1).describe("What invariants and failure modes this family guards."),
  frequencies: z
    .array(TestFrequencySchema)
    .min(1)
    .describe("Execution cadences that trigger this family."),
  blocking_in_ci: z
    .boolean()
    .describe("Whether failures in this family block merge or deployment."),
  checks: z
    .array(z.string().min(1))
    .min(1)
    .describe("Concrete scripts, suites, or evaluators belonging to this family."),
  owner_scope: z
    .string()
    .min(1)
    .describe("Primary repository area or operational boundary covered."),
});

export type TestFamilyId = z.infer<typeof TestFamilyIdSchema>;
export type TestFrequency = z.infer<typeof TestFrequencySchema>;
export type TestFamilySpec = z.infer<typeof TestFamilySpecSchema>;

export const TEST_FAMILIES: readonly TestFamilySpec[] = [
  {
    id: "data_integrity",
    title: "Data Integrity",
    description:
      "Schema conformance, canonical ID uniqueness, referential integrity, date precision, and translation hash parity.",
    frequencies: ["per_pr", "release"],
    blocking_in_ci: true,
    checks: [
      "pnpm validate",
      "pnpm validate:sidecars",
      "pnpm validate:articles",
      "pnpm schemas --check",
    ],
    owner_scope: "data/, schemas/, content/",
  },
  {
    id: "evidence_integrity",
    title: "Evidence Integrity",
    description:
      "Source chain completeness, evidence level separation (E1/E2/E3), caveat preservation, and counter-inference guards.",
    frequencies: ["per_pr", "prompt_change", "release"],
    blocking_in_ci: true,
    checks: [
      "pnpm audit:m5",
      "npx vitest run test/evidence-policy.test.ts test/inferences.test.ts",
    ],
    owner_scope: "data/relationships/, data/events/, src/audit/",
  },
  {
    id: "discovery_quality",
    title: "Discovery Quality",
    description:
      "Two-plane evaluation of OSINT/research proposals: ex-ante pertinence, novelty, verifiability, justification and ex-post yield.",
    frequencies: ["prompt_change", "release"],
    blocking_in_ci: false,
    checks: ["node src/cli/quality-report.ts", "npx vitest run test/quality.test.ts"],
    owner_scope: "src/quality/discovery-eval.ts, docs/audit/",
  },
  {
    id: "agent_quality",
    title: "Agent Quality",
    description:
      "Benchmark accuracy, abstention discipline, zero invented canonical IDs, inter-model Cohen's kappa, and holdout evaluation.",
    frequencies: ["prompt_change", "release"],
    blocking_in_ci: true,
    checks: ["pnpm benchmark:score", "npx vitest run test/benchmark.test.ts test/quality.test.ts"],
    owner_scope: "src/quality/reference-sets.ts, src/quality/metrics.ts",
  },
  {
    id: "publication_integrity",
    title: "Publication Integrity",
    description:
      "Withheld-record isolation, public export contract stability, link checks, and multi-viewport light/dark accessibility budgets.",
    frequencies: ["per_pr", "per_deploy", "design_change", "release"],
    blocking_in_ci: true,
    checks: [
      "pnpm audit:publication",
      "pnpm check:links",
      "pnpm check:contrast",
      "src/quality/visual-audit.ts",
    ],
    owner_scope: "web/dist/, src/site/, docs/design/",
  },
] as const;

for (const family of TEST_FAMILIES) {
  TestFamilySpecSchema.parse(family);
}

export function getTestFamily(id: TestFamilyId): TestFamilySpec {
  const found = TEST_FAMILIES.find((f) => f.id === id);
  if (!found) {
    throw new Error(`Unknown test family: ${id}`);
  }
  return found;
}

export function familiesForFrequency(frequency: TestFrequency): TestFamilySpec[] {
  return TEST_FAMILIES.filter((f) => f.frequencies.includes(frequency));
}

export function blockingFamilies(): TestFamilySpec[] {
  return TEST_FAMILIES.filter((f) => f.blocking_in_ci);
}
