import { z } from "zod";
import {
  CountryCode,
  DateRange,
  EntityId,
  EventId,
  HypothesisId,
  PartialDate,
  RelationshipId,
  SOURCE_ID,
  SourceId,
  Url,
} from "./schemas.ts";
import {
  ENTITY_DOMAINS,
  ENTITY_KINDS,
  EVIDENCE_LEVELS,
  HYPOTHESIS_PRIORITIES,
  RELATION_CLASSES,
  RELATIONSHIP_EVIDENCE_LEVELS,
  RELATIONSHIP_EVIDENCE_STATUSES,
  THEMES,
} from "./vocabularies.ts";

/**
 * Contract of `sources/incremental/Fonte_XX.proposals.json`: the structured
 * sidecar of an incremental Markdown source. The Markdown stays the
 * human-readable, verifiable report; this file lists the explicit operations
 * the deterministic importer (`pnpm ingest`) may turn into candidate records.
 *
 * Unknowns are `null`, never guessed. Separate claims (event, perpetrator,
 * sponsor, motive, impact) are separate fields with their own evidence level
 * and citations. E5 material is only accepted as `create_hypothesis`.
 */

export const PROPOSALS_SCHEMA_VERSION = "1.0";

/** Local reference key of the sidecar's bibliography (`R01`, `R02`, …). */
export const REFERENCE_KEY = /^R\d{2,3}$/;
/** Local operation reference, e.g. `OEM-20261112-001` or `OEM-20261112-001-rel`. */
export const OPERATION_REF = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/** Italian text only: translations are produced later by `pnpm i18n:*`. */
export const ItalianText = z.strictObject({ it: z.string().trim().min(1) });

const DayDate = PartialDate.refine((value) => value.length === 10, "expected YYYY-MM-DD");

const E5_MESSAGE =
  "E5 material is a hypothesis: use a create_hypothesis operation (data/hypotheses/)";

/** E1–E4: an assertion that may enter events or relationships. */
export const FactualEvidenceLevel = z.enum(RELATIONSHIP_EVIDENCE_LEVELS, {
  error: (issue) => (issue.input === "E5" ? E5_MESSAGE : undefined),
});

/**
 * A citation: a local reference key (`R01`), an existing source code
 * (`S09`, `WEB-EXT-045`) or the URL of a declared reference or existing source.
 */
export const Citation = z.union([z.string().regex(REFERENCE_KEY), SourceId, Url]);
const Citations = z.array(Citation).min(1);

/** An existing node ID or `@<operation ref>` of a create_event/create_entity in this file. */
export const NodeRef = z.union([
  EntityId,
  EventId,
  z.string().regex(new RegExp(`^@${OPERATION_REF.source.slice(1)}`)),
]);
export const EventRef = z.union([
  EventId,
  z.string().regex(new RegExp(`^@${OPERATION_REF.source.slice(1)}`)),
]);

/** One separately qualified assertion about an event. */
export const Claim = z.strictObject({
  text: ItalianText,
  evidence_level: FactualEvidenceLevel,
  sources: Citations,
});

export const UPDATE_TYPES = [
  "NEW_EVENT",
  "EVENT_UPDATE",
  "NEW_ATTRIBUTION",
  "NEW_EVIDENCE",
  "NEW_JUDICIAL",
  "NEW_POLICY",
  "CORRECTION",
  "NEW_RELATIONSHIP",
  "HYPOTHESIS_UPDATE",
  "STRATEGIC_UPDATE",
] as const;

const operationBase = {
  /** Stable reference of the operation inside the sidecar (unique). */
  ref: z.string().regex(OPERATION_REF),
  /** Item of the Markdown source this operation comes from (e.g. `OEM-20261112-001`). */
  item: z.string().min(1),
  sources: Citations,
  /** Editorial notes for the reviewer (English or Italian), kept in `review.notes`. */
  notes: z.array(z.string().trim().min(1)),
};

export const CreateEvent = z.strictObject({
  op: z.literal("create_event"),
  ...operationBase,
  update_type: z.enum(UPDATE_TYPES),
  /** Level of the documented conduct described in `description`. */
  evidence_level: FactualEvidenceLevel,
  title: ItalianText,
  /** The documented conduct only: no perpetrator, sponsor, motive or impact. */
  description: ItalianText,
  /** Date of the conduct, not of publication or attribution. */
  date: DateRange,
  /** Date the new evidence was published, when it differs from the conduct. */
  published: PartialDate.nullable(),
  themes: z.array(z.enum(THEMES)).min(1),
  geography: ItalianText.nullable(),
  /** ISO countries of the location; areas without a country stay out. */
  places: z.array(CountryCode),
  evidence_note: ItalianText.nullable(),
  publisher: z.string().min(1).nullable(),
  url: Url.nullable(),
  /** Each claim is separate; `null` means the source does not establish it. */
  claims: z.strictObject({
    perpetrator: Claim.nullable(),
    sponsor: Claim.nullable(),
    motive: Claim.nullable(),
    impact: Claim.nullable(),
  }),
  contrary_evidence: ItalianText.nullable(),
  /** Context links only (never duplicates or causal links). */
  related: z.array(z.union([EventId, EntityId, HypothesisId])),
});

export const CreateEntity = z
  .strictObject({
    op: z.literal("create_entity"),
    ...operationBase,
    evidence_level: FactualEvidenceLevel,
    /** Proposed entity code; checked against existing IDs and names. */
    id: EntityId,
    kind: z.enum(ENTITY_KINDS),
    name: ItalianText,
    aliases: z.array(z.string().trim().min(1)),
    domain: z.enum(ENTITY_DOMAINS),
    country: CountryCode.nullable(),
    /** Why a named person is publicly relevant; required for `person`. */
    public_relevance: ItalianText.nullable(),
  })
  .superRefine((entity, ctx) => {
    if ((entity.kind === "state") !== (entity.country !== null)) {
      ctx.addIssue({
        code: "custom",
        path: ["country"],
        message: "country is set for states and only for states",
      });
    }
    if (entity.kind === "person" && entity.public_relevance === null) {
      ctx.addIssue({
        code: "custom",
        path: ["public_relevance"],
        message: "a person entity needs its public relevance",
      });
    }
  });

/** Exact legal or procedural status of a named person, at a date. */
export const PersonStatus = z.strictObject({
  legal_status: ItalianText,
  status_date: PartialDate,
});

export const CreateRelationship = z.strictObject({
  op: z.literal("create_relationship"),
  ...operationBase,
  evidence_level: FactualEvidenceLevel,
  subject: NodeRef,
  predicate: z.string().regex(/^[A-Z][A-Z0-9_]*$/),
  object: NodeRef,
  relation_class: z.enum(RELATION_CLASSES),
  evidence_status: z.enum(RELATIONSHIP_EVIDENCE_STATUSES),
  events: z.array(EventRef),
  valid_from: PartialDate.nullable(),
  valid_to: PartialDate.nullable(),
  primary_url: Url.nullable(),
  caveat: ItalianText.nullable(),
  /** Required (with `primary_url`) when an endpoint is a `person`. */
  person_status: PersonStatus.nullable(),
});

export const CreateHypothesis = z.strictObject({
  op: z.literal("create_hypothesis"),
  ...operationBase,
  evidence_level: z.literal("E5"),
  subject: NodeRef,
  object: NodeRef,
  hypothesis_type: z.string().regex(/^[A-Z][A-Z0-9_]*$/),
  question: ItalianText,
  current_limit: ItalianText,
  evidence_needed: ItalianText,
  /** `null` when the source gives none (a provisional `medium` is then recorded). */
  priority: z.enum(HYPOTHESIS_PRIORITIES).nullable(),
  events: z.array(EventRef),
  external_url: Url.nullable(),
});

/** Records that carry a `sources` list. */
export const CitableId = z.union([EventId, RelationshipId, HypothesisId]);

export const AddCitation = z.strictObject({
  op: z.literal("add_citation"),
  ...operationBase,
  evidence_level: z.enum(EVIDENCE_LEVELS),
  target: CitableId,
  /** What the new sources add, in Italian. */
  note: ItalianText,
});

export const ProposeCorrection = z.strictObject({
  op: z.literal("propose_correction"),
  ...operationBase,
  evidence_level: z.enum(EVIDENCE_LEVELS),
  target: CitableId,
  /** Dot path of the field, e.g. `description` or `date.start`. */
  field: z.string().regex(/^[a-z_]+(\.[a-z_]+)*$/),
  /** Passage of the current value the correction is about; `null` if the whole field. */
  observed: ItalianText.nullable(),
  proposed: ItalianText,
  rationale: ItalianText,
});

export const Operation = z.discriminatedUnion("op", [
  CreateEvent,
  CreateEntity,
  CreateRelationship,
  CreateHypothesis,
  AddCitation,
  ProposeCorrection,
]);

export const Reference = z.strictObject({
  key: z.string().regex(REFERENCE_KEY),
  title: ItalianText,
  publisher: z.string().min(1).nullable(),
  url: Url,
  /** Publication date of the document, not of the event. */
  published: PartialDate.nullable(),
});

export const ProposalSource = z.strictObject({
  /** Corpus document code of the Markdown source (`S10` for Fonte_10). */
  code: z.string().regex(/^S\d{2}$/),
  file: z.string().regex(/^sources\/incremental\/Fonte_\d{2}[^/]*\.md$/),
  title: ItalianText,
  created_at: DayDate,
  coverage: z
    .strictObject({ start: DayDate, end: DayDate })
    .refine((c) => c.end >= c.start, { message: "end is before start", path: ["end"] }),
  baseline_source: SourceId.nullable(),
  repository_commit: z
    .string()
    .regex(/^[0-9a-f]{40}$/)
    .nullable(),
});

export const ProposalFile = z
  .strictObject({
    schema_version: z.literal(PROPOSALS_SCHEMA_VERSION),
    source: ProposalSource,
    references: z.array(Reference),
    operations: z.array(Operation),
  })
  .superRefine((file, ctx) => {
    const fonte = file.source.file.match(/Fonte_(\d{2})/)?.[1];
    if (fonte !== file.source.code.slice(1)) {
      ctx.addIssue({
        code: "custom",
        path: ["source", "code"],
        message: `code ${file.source.code} does not match Fonte_${fonte}`,
      });
    }
    const keys = new Set<string>();
    const urls = new Set<string>();
    file.references.forEach((reference, index) => {
      if (keys.has(reference.key)) {
        ctx.addIssue({
          code: "custom",
          path: ["references", index, "key"],
          message: `duplicate key ${reference.key}`,
        });
      }
      if (urls.has(reference.url)) {
        ctx.addIssue({
          code: "custom",
          path: ["references", index, "url"],
          message: "duplicate URL",
        });
      }
      keys.add(reference.key);
      urls.add(reference.url);
    });

    const nodeOps = new Map<string, string>();
    const refs = new Set<string>();
    file.operations.forEach((operation, index) => {
      if (refs.has(operation.ref)) {
        ctx.addIssue({
          code: "custom",
          path: ["operations", index, "ref"],
          message: `duplicate ref ${operation.ref}`,
        });
      }
      refs.add(operation.ref);

      const citations = [
        ...operation.sources,
        ...(operation.op === "create_event"
          ? Object.values(operation.claims).flatMap((claim) => claim?.sources ?? [])
          : []),
      ];
      for (const citation of citations) {
        if (REFERENCE_KEY.test(citation) && !keys.has(citation)) {
          ctx.addIssue({
            code: "custom",
            path: ["operations", index, "sources"],
            message: `undeclared reference ${citation}`,
          });
        }
      }

      const locals: [string, string][] = [];
      if (operation.op === "create_relationship" || operation.op === "create_hypothesis") {
        locals.push(["subject", operation.subject], ["object", operation.object]);
        for (const event of operation.events) locals.push(["events", event]);
        if (operation.subject === operation.object) {
          ctx.addIssue({
            code: "custom",
            path: ["operations", index, "object"],
            message: "subject equals object",
          });
        }
      }
      for (const [field, value] of locals) {
        if (!value.startsWith("@")) continue;
        const target = nodeOps.get(value.slice(1));
        const wanted = field === "events" ? ["create_event"] : ["create_event", "create_entity"];
        if (!target || !wanted.includes(target)) {
          ctx.addIssue({
            code: "custom",
            path: ["operations", index, field],
            message: `${value} must name an earlier ${wanted.join(" or ")} operation`,
          });
        }
      }
      if (operation.op === "create_event" || operation.op === "create_entity") {
        nodeOps.set(operation.ref, operation.op);
      }
    });
  });

export type ProposalFile = z.infer<typeof ProposalFile>;
export type Operation = z.infer<typeof Operation>;
export type Reference = z.infer<typeof Reference>;
export type Claim = z.infer<typeof Claim>;

/** True for a citation that is an existing source code rather than a key or URL. */
export function isSourceCode(citation: string): boolean {
  return SOURCE_ID.test(citation) && !REFERENCE_KEY.test(citation);
}
