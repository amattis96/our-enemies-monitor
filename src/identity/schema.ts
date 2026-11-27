import { z } from "zod";
import { CountryCode, comparePartialDates, EntityId, PartialDate, Url } from "../model/schemas.ts";
import { ENTITY_DOMAINS, ENTITY_KINDS } from "../model/vocabularies.ts";

// ---------------------------------------------------------------------------
// Qualified External Identifiers (primary match criteria)

export const Lei = z
  .string()
  .regex(/^[0-9A-Z]{18}[0-9]{2}$/)
  .describe("ISO 17442 20-character Legal Entity Identifier (LEI).");

export const WikidataQid = z
  .string()
  .regex(/^Q[1-9]\d*$/)
  .describe("Wikidata item identifier (e.g., Q12345).");

export const RegistryIdentifier = z.strictObject({
  number: z.string().min(1).describe("Official registration number in the national register."),
  jurisdiction: CountryCode.describe(
    "ISO 3166-1 alpha-2 country code of the issuing jurisdiction.",
  ),
  registry: z
    .string()
    .min(1)
    .optional()
    .describe("Name or code of the corporate/public registry (e.g., KVK, Handelsregister, EGRUL)."),
});

export const ExternalIdentifiers = z.strictObject({
  lei: Lei.optional().describe("ISO 17442 Legal Entity Identifier."),
  registry_numbers: z
    .array(RegistryIdentifier)
    .optional()
    .describe("Qualified national/regional registration numbers with jurisdiction."),
  wikidata_qid: WikidataQid.optional().describe("Wikidata QID."),
  official_website: Url.optional().describe("Official primary website URL."),
  sanctions_ids: z
    .array(z.string().min(1))
    .optional()
    .describe("External sanctions list identifiers (e.g., OpenSanctions, EU FSF, OFAC)."),
});

// ---------------------------------------------------------------------------
// Temporal Aliases

export const ALIAS_KINDS = ["rename", "merger", "subsidiary", "transliteration"] as const;
export const AliasKind = z
  .enum(ALIAS_KINDS)
  .describe("Reason for the alias: rename, merger, subsidiary, or transliteration.");

export const SCRIPT_KINDS = ["latin", "cyrillic", "other"] as const;
export const ScriptKind = z.enum(SCRIPT_KINDS).describe("Writing script of the alias string.");

export const TemporalAlias = z
  .strictObject({
    name: z.string().min(1).describe("Alias or historical name string."),
    kind: AliasKind.describe("Kind of alias relationship."),
    valid_from: PartialDate.nullable().describe(
      "Start date of validity (YYYY, YYYY-MM, or YYYY-MM-DD), or null if unknown.",
    ),
    valid_to: PartialDate.nullable().describe(
      "End date of validity (YYYY, YYYY-MM, or YYYY-MM-DD), or null if ongoing or unknown.",
    ),
    script: ScriptKind.optional().describe("Script of the alias (latin, cyrillic, other)."),
    note: z.string().min(1).optional().describe("Optional context or source note for the alias."),
  })
  .refine(
    (alias) =>
      alias.valid_from === null ||
      alias.valid_to === null ||
      comparePartialDates(alias.valid_to, alias.valid_from) >= 0,
    {
      message: "valid_to cannot precede valid_from",
      path: ["valid_to"],
    },
  );

// ---------------------------------------------------------------------------
// Person Data Minimization Guard

export const PERSON_ALLOWED_ATTRIBUTES = [
  "id",
  "kind",
  "name",
  "domain",
  "country",
  "external_ids",
  "aliases",
  "public_roles",
  "sanctions_listed",
  "review",
  "provenance",
] as const;

export const PERSON_FORBIDDEN_ATTRIBUTES = [
  "ssn",
  "tax_id",
  "passport_number",
  "national_id",
  "home_address",
  "private_email",
  "phone_number",
  "date_of_birth",
  "place_of_birth",
  "biometric_data",
  "medical_data",
  "political_opinion",
  "religious_belief",
  "sexual_orientation",
  "family_members",
] as const;

export const PersonMinimizationResult = z.strictObject({
  ok: z.boolean().describe("True when no disallowed personal attributes are present."),
  violations: z
    .array(z.string().min(1))
    .describe("List of disallowed or unpermitted personal attribute keys found."),
});

/**
 * Checks that a person entity record contains only relevant, lawful public-interest
 * attributes and no sensitive or excessive personal data.
 */
export function checkPersonDataMinimization(
  record: Record<string, unknown>,
): z.infer<typeof PersonMinimizationResult> {
  if (record.kind !== "person") {
    return { ok: true, violations: [] };
  }
  const allowed = new Set<string>(PERSON_ALLOWED_ATTRIBUTES);
  const forbidden = new Set<string>(PERSON_FORBIDDEN_ATTRIBUTES);
  const violations: string[] = [];

  for (const key of Object.keys(record)) {
    if (forbidden.has(key) || !allowed.has(key)) {
      violations.push(key);
    }
  }

  return {
    ok: violations.length === 0,
    violations: violations.sort(),
  };
}

// ---------------------------------------------------------------------------
// Identity Entity Profile (non-breaking extension view of Entity)

export const IdentityEntityProfile = z
  .strictObject({
    id: EntityId.describe("Stable local entity ID."),
    kind: z.enum(ENTITY_KINDS).describe("Entity kind."),
    name: z
      .strictObject({
        it: z.string().min(1).describe("Canonical Italian display name."),
        en: z.string().min(1).optional().describe("English display name."),
      })
      .describe("Localized display name."),
    domain: z.enum(ENTITY_DOMAINS).describe("Thematic domain."),
    country: CountryCode.nullable().describe("ISO 3166-1 alpha-2 code for states, else null."),
    external_ids: ExternalIdentifiers.optional().describe(
      "Qualified external identifiers (LEI, registry numbers, Wikidata QID, official website).",
    ),
    aliases: z
      .array(TemporalAlias)
      .optional()
      .describe("Temporal aliases, historical names, and transliterations."),
    public_roles: z
      .array(z.string().min(1))
      .optional()
      .describe("Relevant public/official roles (for person entities)."),
    sanctions_listed: z
      .boolean()
      .optional()
      .describe("Whether the entity appears on an official sanctions list."),
  })
  .superRefine((entity, ctx) => {
    if (entity.kind !== "person") return;
    const check = checkPersonDataMinimization(entity as unknown as Record<string, unknown>);
    if (!check.ok) {
      ctx.addIssue({
        code: "custom",
        message: `Person data minimization violation: disallowed attributes (${check.violations.join(", ")})`,
      });
    }
  });

// ---------------------------------------------------------------------------
// Linkage Decisions

export const LINKAGE_OUTCOMES = ["same", "distinct", "uncertain"] as const;
export const LinkageOutcome = z
  .enum(LINKAGE_OUTCOMES)
  .describe("Linkage decision outcome: same, distinct, or uncertain.");

export const LinkageDecision = z
  .strictObject({
    id: z.string().min(1).describe("Unique decision record identifier."),
    entity_a: EntityId.describe("First entity ID in the pair."),
    entity_b: EntityId.describe("Second entity ID in the pair."),
    outcome: LinkageOutcome.describe("Persisted linkage decision (same, distinct, uncertain)."),
    score: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe("Optional linkage score at the time of decision."),
    decided_by: z.string().min(1).describe("Reviewer or editor identifier."),
    decided_at: z.string().min(1).describe("UTC ISO-8601 timestamp of the decision."),
    rationale: z.string().min(1).describe("Human-readable rationale for the decision."),
    evidence_refs: z
      .array(z.string().min(1))
      .optional()
      .describe("Optional references supporting the decision."),
  })
  .refine((d) => d.entity_a !== d.entity_b, {
    message: "entity_a and entity_b must be distinct IDs",
    path: ["entity_b"],
  });

export const DecisionsStore = z.strictObject({
  version: z.literal("1.0").describe("Schema version for persisted linkage decisions."),
  decisions: z.array(LinkageDecision).describe("Persisted linkage decisions."),
});

// ---------------------------------------------------------------------------
// Entity Merge / Split / Redirect Records

export const REDIRECT_REASONS = ["merge", "alias_promotion", "deprecation", "split"] as const;
export const RedirectReason = z
  .enum(REDIRECT_REASONS)
  .describe("Reason an entity ID redirects to another ID.");

export const RedirectRecord = z
  .strictObject({
    from_id: EntityId.describe("Previous or deprecated entity ID."),
    to_id: EntityId.describe("Target canonical entity ID."),
    reason: RedirectReason.describe("Reason for the redirect."),
    created_at: z.string().min(1).describe("UTC ISO-8601 timestamp when redirect was created."),
    created_by: z.string().min(1).describe("Actor who created the redirect."),
    lifecycle_id: z
      .string()
      .min(1)
      .optional()
      .describe("Optional merge/split event ID that created this redirect."),
  })
  .refine((r) => r.from_id !== r.to_id, {
    message: "from_id and to_id must differ",
    path: ["to_id"],
  });

export const MergeRecord = z.strictObject({
  id: z.string().min(1).describe("Unique merge event ID."),
  kind: z.literal("merge").describe("Lifecycle operation kind: merge."),
  source_ids: z
    .array(EntityId)
    .min(2)
    .describe("All entity IDs consolidated by this merge (including target_id)."),
  target_id: EntityId.describe("Surviving canonical entity ID."),
  snapshot_before: z
    .array(IdentityEntityProfile)
    .min(2)
    .describe("Full pre-merge entity snapshots enabling exact reversal."),
  merged_at: z.string().min(1).describe("UTC ISO-8601 timestamp of the merge."),
  merged_by: z.string().min(1).describe("Human reviewer who approved the merge."),
  rationale: z.string().min(1).describe("Documented rationale for the merge."),
  reverted_at: z
    .string()
    .min(1)
    .nullable()
    .describe("UTC ISO-8601 timestamp if reverted, else null."),
});

export const SplitRecord = z.strictObject({
  id: z.string().min(1).describe("Unique split event ID."),
  kind: z.literal("split").describe("Lifecycle operation kind: split."),
  source_id: EntityId.describe("Original entity ID that was split."),
  resulting_ids: z.array(EntityId).min(2).describe("Resulting entity IDs created from the split."),
  snapshot_before: IdentityEntityProfile.describe(
    "Full pre-split entity snapshot enabling exact reversal.",
  ),
  split_at: z.string().min(1).describe("UTC ISO-8601 timestamp of the split."),
  split_by: z.string().min(1).describe("Human reviewer who approved the split."),
  rationale: z.string().min(1).describe("Documented rationale for the split."),
  reverted_at: z
    .string()
    .min(1)
    .nullable()
    .describe("UTC ISO-8601 timestamp if reverted, else null."),
});

export const LifecycleHistoryEntry = z.union([MergeRecord, SplitRecord]);

export const RedirectsStore = z.strictObject({
  version: z.literal("1.0").describe("Schema version for entity redirects and lifecycle history."),
  redirects: z.array(RedirectRecord).describe("Active entity ID redirects."),
  history: z.array(LifecycleHistoryEntry).describe("Reversible merge and split audit history."),
});

// ---------------------------------------------------------------------------
// Inferred TypeScript Types

export type RegistryIdentifier = z.infer<typeof RegistryIdentifier>;
export type ExternalIdentifiers = z.infer<typeof ExternalIdentifiers>;
export type AliasKind = z.infer<typeof AliasKind>;
export type ScriptKind = z.infer<typeof ScriptKind>;
export type TemporalAlias = z.infer<typeof TemporalAlias>;
export type PersonMinimizationResult = z.infer<typeof PersonMinimizationResult>;
export type IdentityEntityProfile = z.infer<typeof IdentityEntityProfile>;
export type LinkageOutcome = z.infer<typeof LinkageOutcome>;
export type LinkageDecision = z.infer<typeof LinkageDecision>;
export type DecisionsStore = z.infer<typeof DecisionsStore>;
export type RedirectReason = z.infer<typeof RedirectReason>;
export type RedirectRecord = z.infer<typeof RedirectRecord>;
export type MergeRecord = z.infer<typeof MergeRecord>;
export type SplitRecord = z.infer<typeof SplitRecord>;
export type LifecycleHistoryEntry = z.infer<typeof LifecycleHistoryEntry>;
export type RedirectsStore = z.infer<typeof RedirectsStore>;
