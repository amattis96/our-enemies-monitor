import { z } from "zod";
import type { Relationship } from "../model/schemas.ts";
import type { REVIEW_STATUSES } from "../model/vocabularies.ts";

/**
 * PK-06D: Progressive migration across three orthogonal dimensions:
 * 1. Structural migration: `legacy` | `migrated`
 * 2. Evidentiary verification: `pending` | `verified` | `disputed` (reusing M5 editorial states)
 * 3. Lifecycle: `active` | `superseded` | `withdrawn`
 *
 * Hard rules:
 * - A script can advance structural migration at most to `migrated` and can NEVER assign `verified`.
 * - Assertions are created only from editorial review or new sidecars, never by unreviewed scripts.
 */

export const STRUCTURAL_MIGRATION_STATES = ["legacy", "migrated"] as const;
export type StructuralMigrationState = (typeof STRUCTURAL_MIGRATION_STATES)[number];

export const EVIDENTIARY_VERIFICATION_STATES = ["pending", "verified", "disputed"] as const;
export type EvidentiaryVerificationState = (typeof EVIDENTIARY_VERIFICATION_STATES)[number];

export const LIFECYCLE_STATES = ["active", "superseded", "withdrawn"] as const;
export type LifecycleState = (typeof LIFECYCLE_STATES)[number];

export const MIGRATION_ACTORS = ["script", "editorial_sidecar", "human_reviewer"] as const;
export type MigrationActor = (typeof MIGRATION_ACTORS)[number];

export const ASSERTION_CREATION_ORIGINS = [
  "baseline_import",
  "editorial_review",
  "new_sidecar",
] as const;
export type AssertionCreationOrigin = (typeof ASSERTION_CREATION_ORIGINS)[number];

export const MigrationState = z.strictObject({
  structural: z
    .enum(STRUCTURAL_MIGRATION_STATES)
    .describe("Structural migration dimension: legacy or migrated."),
  evidentiary_verification: z
    .enum(EVIDENTIARY_VERIFICATION_STATES)
    .describe("Evidentiary verification dimension: pending, verified, or disputed."),
  lifecycle: z
    .enum(LIFECYCLE_STATES)
    .describe("Lifecycle dimension: active, superseded, or withdrawn."),
  updated_by: z.enum(MIGRATION_ACTORS).describe("Actor that produced the current migration state."),
  source_origin: z
    .enum(ASSERTION_CREATION_ORIGINS)
    .describe("Origin of the record (baseline_import, editorial_review, or new_sidecar)."),
  superseded_by: z
    .string()
    .nullable()
    .describe("ID of the superseding record when lifecycle is superseded, else null."),
  note: z.string().nullable().describe("Optional migration or verification note."),
});
export type MigrationState = z.infer<typeof MigrationState>;

export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

/**
 * Maps existing M5 editorial states to PK-06D `evidentiary_verification` without
 * creating a competing system to the M5 gate.
 *
 * `verified` is returned ONLY when `humanApproved === true` and `reviewStatus === "reviewed"`.
 */
export function mapM5ToEvidentiaryVerification(input: {
  reviewStatus: ReviewStatus;
  humanApproved?: boolean;
  assessment?: "matched_with_scope_limits" | "primary_not_found";
  hasContraryEvidence?: boolean;
}): EvidentiaryVerificationState {
  if (input.assessment === "primary_not_found" || input.hasContraryEvidence) {
    return "disputed";
  }
  if (input.humanApproved === true && input.reviewStatus === "reviewed") {
    return "verified";
  }
  return "pending";
}

/**
 * Returns whether an assertion may be created from the given origin.
 * Assertions are created only from editorial review or new sidecars, never from baseline scripts.
 */
export function canCreateAssertion(origin: AssertionCreationOrigin): boolean {
  return origin === "editorial_review" || origin === "new_sidecar";
}

export function createInitialMigrationState(origin: AssertionCreationOrigin): MigrationState {
  return {
    structural: origin === "new_sidecar" ? "migrated" : "legacy",
    evidentiary_verification: "pending",
    lifecycle: "active",
    updated_by: origin === "new_sidecar" ? "editorial_sidecar" : "script",
    source_origin: origin,
    superseded_by: null,
    note: null,
  };
}

export type MigrationTransition = {
  structural?: StructuralMigrationState;
  evidentiary_verification?: EvidentiaryVerificationState;
  lifecycle?: LifecycleState;
  superseded_by?: string | null;
  note?: string | null;
};

/**
 * Applies a transition across the 3 orthogonal dimensions while enforcing PK-06D invariants:
 * - A `script` actor can advance structural migration at most to `migrated` and NEVER assign `verified`.
 * - `superseded` requires a non-null `superseded_by` target ID.
 * - `withdrawn` records cannot be reactivated by a script.
 */
export function applyMigrationTransition(
  current: MigrationState,
  transition: MigrationTransition,
  actor: MigrationActor,
): MigrationState {
  if (actor === "script" && transition.evidentiary_verification === "verified") {
    throw new Error("Scripted migration can never assign evidentiary_verification = 'verified'");
  }
  if (
    actor === "script" &&
    current.lifecycle === "withdrawn" &&
    transition.lifecycle === "active"
  ) {
    throw new Error("Scripted migration cannot reactivate a withdrawn record");
  }

  const nextLifecycle = transition.lifecycle ?? current.lifecycle;
  const nextSupersededBy =
    transition.superseded_by !== undefined ? transition.superseded_by : current.superseded_by;

  if (nextLifecycle === "superseded" && (!nextSupersededBy || nextSupersededBy.trim() === "")) {
    throw new Error("Lifecycle 'superseded' requires a non-empty superseded_by target ID");
  }

  return {
    structural: transition.structural ?? current.structural,
    evidentiary_verification:
      transition.evidentiary_verification ?? current.evidentiary_verification,
    lifecycle: nextLifecycle,
    updated_by: actor,
    source_origin: current.source_origin,
    superseded_by: nextSupersededBy,
    note: transition.note !== undefined ? transition.note : current.note,
  };
}

/**
 * Migrates a legacy relationship structurally to `migrated` using a script.
 * Evidentiary verification remains `pending` (or `disputed` if flagged), NEVER `verified`.
 */
export function migrateLegacyRelationship(
  relationship: Pick<Relationship, "id" | "review">,
  actor: MigrationActor = "script",
): MigrationState {
  const initial = createInitialMigrationState("baseline_import");
  if (actor === "script") {
    return applyMigrationTransition(
      initial,
      {
        structural: "migrated",
        evidentiary_verification: "pending",
        note: `Structurally migrated from legacy relationship ${relationship.id}`,
      },
      "script",
    );
  }
  return applyMigrationTransition(
    initial,
    {
      structural: "migrated",
      evidentiary_verification: mapM5ToEvidentiaryVerification({
        reviewStatus: relationship.review.status,
        humanApproved: false,
      }),
      note: `Migrated from relationship ${relationship.id}`,
    },
    actor,
  );
}
