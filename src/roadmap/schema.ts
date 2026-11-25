import { z } from "zod";

/**
 * Zod schemas for the executable roadmap (PK-00):
 * 1. `docs/roadmap/plan.v1.json` — protected plan (packages, subpackages,
 *    4 dependency types, decisions D1-D14, acceptance criteria, items 1-140).
 * 2. `docs/roadmap/progress/<id>.json` — operational status per package/subpackage.
 * 3. `docs/roadmap/progress/active-work.json` — active work areas and base commits
 *    for overlap warning detection.
 */

export const PACKAGE_STATUSES = [
  "eligible",
  "scheduled",
  "in_progress",
  "blocked",
  "awaiting_acceptance",
  "completed",
  "deferred",
  "not_applicable",
] as const;

export const PackageStatusSchema = z
  .enum(PACKAGE_STATUSES)
  .describe("Operational status of a roadmap package or subpackage");

export type PackageStatus = z.infer<typeof PackageStatusSchema>;

export const MILESTONE_IDS = ["M8", "M9", "M10", "M11", "M12", "M13"] as const;

export const MilestoneIdSchema = z
  .enum(MILESTONE_IDS)
  .describe("Roadmap milestone identifier (M8 through M13)");

export type MilestoneId = z.infer<typeof MilestoneIdSchema>;

export const EFFORT_LEVELS = ["S", "M", "L", "research"] as const;

export const EffortLevelSchema = z
  .enum(EFFORT_LEVELS)
  .describe("Estimated implementation effort (S, M, L, or research)");

export type EffortLevel = z.infer<typeof EffortLevelSchema>;

export const RECURRING_COSTS = ["low", "medium", "high"] as const;

export const RecurringCostSchema = z
  .enum(RECURRING_COSTS)
  .describe("Ongoing operational and maintenance cost (low, medium, high)");

export type RecurringCost = z.infer<typeof RecurringCostSchema>;

export const IMPACT_LEVELS = ["medium", "medium_high", "high", "critical"] as const;

export const ImpactLevelSchema = z
  .enum(IMPACT_LEVELS)
  .describe("Strategic impact of the package (medium, medium_high, high, critical)");

export type ImpactLevel = z.infer<typeof IMPACT_LEVELS>;

export const DECISION_STATUSES = ["open", "resolved"] as const;

export const DecisionStatusSchema = z
  .enum(DECISION_STATUSES)
  .describe("Whether an owner decision is still open or resolved");

export type DecisionStatus = z.infer<typeof DecisionStatusSchema>;

export const PackageIdSchema = z
  .string()
  .regex(/^PK-(0[0-9]|[12][0-9]|3[0-8])([A-D]|-CAL)?$/)
  .describe("Package or subpackage identifier (e.g., PK-00, PK-06B, PK-15A, PK-25-CAL)");

export const DecisionIdSchema = z
  .string()
  .regex(/^D([1-9]|1[0-4])$/)
  .describe("Owner decision identifier (D1 through D14)");

export const DependencyRefSchema = z
  .union([PackageIdSchema, DecisionIdSchema])
  .describe("Reference to a package, subpackage, or owner decision");

export const ItemNumberSchema = z
  .number()
  .int()
  .min(1)
  .max(140)
  .describe("Traceability item number from 1 to 140");

export const DependenciesSchema = z
  .strictObject({
    requires: z
      .array(DependencyRefSchema)
      .describe("Blocking dependencies required before starting the package"),
    to_complete: z
      .array(DependencyRefSchema)
      .describe("Dependencies required to close/complete the package (may start without them)"),
    to_activate: z
      .array(DependencyRefSchema)
      .describe("Dependencies required before activating in production or publishing"),
    extensions: z
      .array(DependencyRefSchema)
      .describe("Optional future capabilities that do not block the base version"),
  })
  .describe("Four-category dependency specification for a package or subpackage");

export type Dependencies = z.infer<typeof DependenciesSchema>;

export const SubpackageSchema = z
  .strictObject({
    id: PackageIdSchema.describe("Subpackage identifier (e.g., PK-06A, PK-15A, PK-25-CAL)"),
    title: z.string().min(1).describe("Human-readable subpackage title"),
    milestone: MilestoneIdSchema.describe("Target milestone"),
    items: z.array(ItemNumberSchema).describe("Roadmap items (1-140) covered by this subpackage"),
    effort: EffortLevelSchema.describe("Estimated implementation effort"),
    recurring_cost: RecurringCostSchema.describe("Ongoing operational cost"),
    impact: ImpactLevelSchema.describe("Expected impact"),
    dependencies: DependenciesSchema.describe("Subpackage dependencies across the four types"),
    deliverables: z
      .array(z.string().min(1))
      .min(1)
      .describe("Key deliverables for this subpackage"),
    acceptance_criteria: z
      .array(z.string().min(1))
      .min(1)
      .describe("Verifiable acceptance criteria required to complete the subpackage"),
    human_review_required: z
      .boolean()
      .describe("Whether owner/human review or approval is required"),
    execution_role: z
      .string()
      .min(1)
      .describe("Expected execution role(s), e.g. implementation_agent, investigative_agent"),
    initial_disposition: z
      .enum(["active", "deferred", "conditional"])
      .optional()
      .describe("Optional initial disposition if deferred or conditional"),
  })
  .describe("Subpackage definition with independent operational state");

export type Subpackage = z.infer<typeof SubpackageSchema>;

export const PackageSchema = z
  .strictObject({
    id: PackageIdSchema.describe("Package identifier (PK-00 through PK-38)"),
    title: z.string().min(1).describe("Human-readable package title"),
    milestone: MilestoneIdSchema.describe("Target milestone"),
    items: z
      .array(ItemNumberSchema)
      .describe("Roadmap items (1-140) covered directly by this package"),
    effort: EffortLevelSchema.describe("Estimated implementation effort"),
    recurring_cost: RecurringCostSchema.describe("Ongoing operational cost"),
    impact: ImpactLevelSchema.describe("Expected impact"),
    dependencies: DependenciesSchema.describe("Package dependencies across the four types"),
    deliverables: z.array(z.string().min(1)).min(1).describe("Key deliverables for this package"),
    acceptance_criteria: z
      .array(z.string().min(1))
      .min(1)
      .describe("Verifiable acceptance criteria required to complete the package"),
    human_review_required: z
      .boolean()
      .describe("Whether owner/human review or approval is required"),
    execution_role: z.string().min(1).describe("Expected execution role(s)"),
    data_readiness_gate_required: z
      .boolean()
      .optional()
      .describe("Whether the M13 Data Readiness Gate must pass before activation"),
    initial_disposition: z
      .enum(["active", "deferred", "conditional"])
      .optional()
      .describe(
        "Optional initial disposition (e.g., deferred for PK-32, conditional for PK-34..36)",
      ),
    subpackages_only: z
      .boolean()
      .optional()
      .describe("True when execution is split entirely into subpackages (e.g., PK-06, PK-15)"),
    subpackages: z
      .array(SubpackageSchema)
      .optional()
      .describe("Optional subpackages with independent operational state"),
  })
  .describe("Roadmap package definition (PK-00 through PK-38)");

export type RoadmapPackage = z.infer<typeof PackageSchema>;

export const DecisionSchema = z
  .strictObject({
    id: DecisionIdSchema.describe("Decision identifier (D1 through D14)"),
    title: z.string().min(1).describe("Short decision title"),
    recommendation: z.string().min(1).describe("Recommended resolution from ENGINE_PLAN.md"),
    status: DecisionStatusSchema.describe("Current decision status (open or resolved)"),
    resolution: z
      .string()
      .min(1)
      .nullable()
      .describe("Recorded resolution when status is resolved"),
    blocks_description: z.string().min(1).describe("Summary of what this decision blocks"),
  })
  .describe("Owner decision entry (D1-D14)");

export type Decision = z.infer<typeof DecisionSchema>;

export const ParkedItemSchema = z
  .strictObject({
    item: ItemNumberSchema.describe("Parked item number (e.g., 86-90, 106, 32)"),
    title: z.string().min(1).describe("Short item title"),
    reason: z.string().min(1).describe("Reason the item is parked"),
    reconsider_when: z.string().min(1).describe("Condition or milestone to reconsider this item"),
  })
  .describe("Parked item entry explicitly accounted for outside active packages");

export type ParkedItem = z.infer<typeof ParkedItemSchema>;

export const MilestoneSchema = z
  .strictObject({
    id: MilestoneIdSchema.describe("Milestone identifier (M8-M13)"),
    title: z.string().min(1).describe("Milestone title"),
    exit_criteria: z.string().min(1).describe("Criteria required to close the milestone"),
  })
  .describe("Milestone definition and exit criteria");

export type Milestone = z.infer<typeof MilestoneSchema>;

export const RoadmapPlanSchema = z
  .strictObject({
    version: z.literal("1.0").describe("Schema version of the roadmap plan"),
    title: z.string().min(1).describe("Document title"),
    updated_at: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .describe("Plan date in YYYY-MM-DD format"),
    frozen_scope: z
      .strictObject({
        items_count: z.literal(140).describe("Total number of tracked items (1-140)"),
        packages_count: z.literal(39).describe("Total number of top-level packages (PK-00..PK-38)"),
        milestones: z.array(MilestoneIdSchema).min(1).describe("Ordered milestone IDs"),
      })
      .describe("Frozen scope metadata"),
    milestones: z.array(MilestoneSchema).length(6).describe("Milestones M8 through M13"),
    decisions: z.array(DecisionSchema).length(14).describe("Owner decisions D1 through D14"),
    packages: z.array(PackageSchema).length(39).describe("Packages PK-00 through PK-38"),
    parked_items: z.array(ParkedItemSchema).describe("Explicitly parked items (86-90, 106, 32)"),
  })
  .describe("Protected executable roadmap plan (docs/roadmap/plan.v1.json)");

export type RoadmapPlan = z.infer<typeof RoadmapPlanSchema>;

export const PackageProgressSchema = z
  .strictObject({
    id: PackageIdSchema.describe("Package or subpackage identifier"),
    status: PackageStatusSchema.describe("Current operational status"),
    linked_prs: z
      .array(
        z
          .strictObject({
            number: z.number().int().positive().describe("Pull request number"),
            title: z.string().min(1).describe("Pull request title"),
            merged_at: z.string().nullable().describe("ISO timestamp when merged, or null if open"),
          })
          .describe("Linked pull request metadata"),
      )
      .describe("Pull requests associated with this package"),
    runs: z
      .array(
        z
          .strictObject({
            run_id: z.string().min(1).describe("Execution or workflow run identifier"),
            recorded_at: z.string().min(1).describe("ISO timestamp of the run"),
            outcome: z.string().min(1).describe("Outcome summary of the run"),
          })
          .describe("Recorded CI or agent run"),
      )
      .describe("Execution runs related to this package"),
    test_results: z
      .array(
        z
          .strictObject({
            command: z.string().min(1).describe("Verification command executed"),
            passed: z.boolean().describe("Whether the check passed"),
            recorded_at: z.string().min(1).describe("ISO timestamp of the test result"),
          })
          .describe("Recorded test or verification result"),
      )
      .describe("Test results supporting completion"),
    completion_evidence: z
      .array(z.string().min(1))
      .describe("Recorded evidence items satisfying acceptance criteria"),
    notes: z.string().optional().describe("Optional operational notes"),
    updated_at: z.string().min(1).describe("ISO timestamp or date of last operational update"),
  })
  .describe(
    "Operational progress file for a package or subpackage (docs/roadmap/progress/<id>.json)",
  );

export type PackageProgress = z.infer<typeof PackageProgressSchema>;

export const ActiveWorkEntrySchema = z
  .strictObject({
    package_id: PackageIdSchema.describe("Package or subpackage currently being worked on"),
    agent_id: z.string().min(1).describe("Identifier of the agent or contributor"),
    work_areas: z
      .array(z.string().min(1))
      .min(1)
      .describe("Repository paths, globs, or modules touched by this work"),
    base_commit: z
      .string()
      .regex(/^[0-9a-f]{7,40}$/)
      .describe("Git commit SHA the work is based on"),
    started_at: z.string().min(1).describe("ISO timestamp when work started"),
  })
  .describe("Active work declaration for overlap detection");

export type ActiveWorkEntry = z.infer<typeof ActiveWorkEntrySchema>;

export const ActiveWorkFileSchema = z
  .strictObject({
    updated_at: z.string().min(1).describe("ISO timestamp or date of last update"),
    entries: z
      .array(ActiveWorkEntrySchema)
      .describe("List of currently active package work declarations"),
  })
  .describe("Active work registry (docs/roadmap/progress/active-work.json)");

export type ActiveWorkFile = z.infer<typeof ActiveWorkFileSchema>;
