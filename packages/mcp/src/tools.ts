import { z } from "zod";
import {
  ENTITY_DOMAINS,
  EVIDENCE_LEVELS,
  RELATION_CLASSES,
  RELATION_GROUPS,
  THEMES,
} from "../../../src/model/vocabularies.ts";
import {
  EvidenceDepthSchema,
  QUERY_COMPLEXITY_LIMITS,
  QueryCollectionSchema,
  type QueryEngine,
} from "../../../src/query/index.ts";

const LangSchema = z.enum(["it", "en"]).describe("Response language code (it or en).");
const OffsetSchema = z
  .number()
  .int()
  .min(0)
  .max(QUERY_COMPLEXITY_LIMITS.maxOffset)
  .describe("Pagination offset (non-negative integer).");
const LimitSchema = z
  .number()
  .int()
  .min(1)
  .max(QUERY_COMPLEXITY_LIMITS.maxLimit)
  .describe(`Maximum number of items per page (1-${QUERY_COMPLEXITY_LIMITS.maxLimit}).`);

export const SearchRecordsInputSchema = z.strictObject({
  query: z
    .string()
    .max(QUERY_COMPLEXITY_LIMITS.maxQueryLength)
    .optional()
    .describe("Free-text search query across IDs, titles, descriptions, and caveats."),
  collections: z
    .array(QueryCollectionSchema)
    .optional()
    .describe("Restrict search to specific public collections."),
  domain: z.enum(ENTITY_DOMAINS).optional().describe("Filter entities by thematic domain."),
  relation_class: z
    .enum(RELATION_CLASSES)
    .optional()
    .describe("Filter relationships by canonical relation_class."),
  relation_group: z
    .enum(RELATION_GROUPS)
    .optional()
    .describe("Filter relationships by UI display relation_group."),
  from: z
    .union([z.string(), z.number()])
    .optional()
    .describe("Period start bound (YYYY, YYYY-MM, YYYY-MM-DD, or year number)."),
  to: z
    .union([z.string(), z.number()])
    .optional()
    .describe("Period end bound (YYYY, YYYY-MM, YYYY-MM-DD, or year number)."),
  evidence_level: z.enum(EVIDENCE_LEVELS).optional().describe("Filter by evidence level (E1-E5)."),
  theme: z.enum(THEMES).optional().describe("Filter events by thematic tag."),
  place: z.string().min(2).max(2).optional().describe("Filter by ISO 3166-1 alpha-2 country code."),
  lang: LangSchema.optional(),
  offset: OffsetSchema.optional(),
  limit: LimitSchema.optional(),
});

export const GetEntityInputSchema = z.strictObject({
  id: z.string().min(1).describe("Canonical entity ID."),
  lang: LangSchema.optional(),
});

export const GetEventInputSchema = z.strictObject({
  id: z.string().min(1).describe("Canonical event ID (e.g. TL-0001)."),
});

export const GetCaseInputSchema = z.strictObject({
  id: z.string().min(1).describe("Canonical case ID (e.g. CASE-0001)."),
});

export const GetRelationsInputSchema = z.strictObject({
  node_id: z
    .string()
    .min(1)
    .optional()
    .describe("Optional entity or event ID to filter relations."),
  relation_class: z
    .enum(RELATION_CLASSES)
    .optional()
    .describe("Filter by canonical relation_class."),
  relation_group: z
    .enum(RELATION_GROUPS)
    .optional()
    .describe("Filter by UI display relation_group."),
  evidence_level: z.enum(EVIDENCE_LEVELS).optional().describe("Filter by evidence level (E1-E4)."),
  from: z
    .union([z.string(), z.number()])
    .optional()
    .describe("Period start bound (YYYY, YYYY-MM, YYYY-MM-DD, or year number)."),
  to: z
    .union([z.string(), z.number()])
    .optional()
    .describe("Period end bound (YYYY, YYYY-MM, YYYY-MM-DD, or year number)."),
  include_participation: z
    .boolean()
    .optional()
    .describe("Whether to include event_participation relationships (default true)."),
  lang: LangSchema.optional(),
  offset: OffsetSchema.optional(),
  limit: LimitSchema.optional(),
});

export const GetEvidenceInputSchema = z.strictObject({
  id: z
    .string()
    .min(1)
    .describe("Canonical record ID (event, entity, relationship, hypothesis, or exposure)."),
  depth: EvidenceDepthSchema.optional(),
});

export const FindPathsInputSchema = z.strictObject({
  from: z.string().min(1).describe("Source entity or event ID."),
  to: z.string().min(1).describe("Target entity or event ID."),
  max_steps: z
    .number()
    .int()
    .min(1)
    .max(QUERY_COMPLEXITY_LIMITS.maxPathDepth)
    .optional()
    .describe(`Maximum number of relationship steps (1-${QUERY_COMPLEXITY_LIMITS.maxPathDepth}).`),
  max_paths: z
    .number()
    .int()
    .min(1)
    .max(QUERY_COMPLEXITY_LIMITS.maxPaths)
    .optional()
    .describe(`Maximum number of paths returned (1-${QUERY_COMPLEXITY_LIMITS.maxPaths}).`),
  max_visited_nodes: z
    .number()
    .int()
    .min(1)
    .max(QUERY_COMPLEXITY_LIMITS.maxVisitedNodes)
    .optional()
    .describe(
      `Maximum graph nodes visited during search (1-${QUERY_COMPLEXITY_LIMITS.maxVisitedNodes}).`,
    ),
  include_participation: z
    .boolean()
    .optional()
    .describe("Whether event_participation edges may be traversed (default true)."),
  apply_grammar: z
    .boolean()
    .optional()
    .describe("Apply PK-11 path grammar rules and B15 forbidden-pair enforcement (default false)."),
  lang: LangSchema.optional(),
});

export const GetTimelineInputSchema = z.strictObject({
  theme: z.enum(THEMES).optional().describe("Filter timeline by theme."),
  from: z.number().int().optional().describe("Start year filter (YYYY)."),
  to: z.number().int().optional().describe("End year filter (YYYY)."),
  query: z
    .string()
    .max(QUERY_COMPLEXITY_LIMITS.maxQueryLength)
    .optional()
    .describe("Free-text filter matching timeline ID, title, or geography."),
  pending: z.boolean().optional().describe("Include pending_integration items (default true)."),
  metadata: z.boolean().optional().describe("Include dataset_metadata items (default false)."),
  order: z
    .enum(["newest", "oldest"])
    .optional()
    .describe("Chronological sort order (default newest)."),
  place: z.string().min(2).max(2).optional().describe("Filter by ISO 3166-1 alpha-2 country code."),
  evidence_level: z.enum(EVIDENCE_LEVELS).optional().describe("Filter by evidence level."),
  lang: LangSchema.optional(),
  offset: OffsetSchema.optional(),
  limit: LimitSchema.optional(),
});

export const PaginationOnlyInputSchema = z.strictObject({
  offset: OffsetSchema.optional(),
  limit: LimitSchema.optional(),
});

export const EmptyInputSchema = z.strictObject({});

export type McpToolDefinition = {
  name: string;
  description: string;
  schema: z.ZodTypeAny;
  execute: (engine: QueryEngine, args: unknown) => unknown;
};

export const MCP_TOOLS: readonly McpToolDefinition[] = [
  {
    name: "search_records",
    description:
      "Search public OEM records (events, entities, relationships, hypotheses, sources, exposures) with filters, pagination, sources, and caveats.",
    schema: SearchRecordsInputSchema,
    execute: (engine, args) => engine.searchRecords(SearchRecordsInputSchema.parse(args)),
  },
  {
    name: "get_entity",
    description:
      "Retrieve a public entity by canonical ID with its unrestricted relationships and hypotheses.",
    schema: GetEntityInputSchema,
    execute: (engine, args) => {
      const parsed = GetEntityInputSchema.parse(args);
      return engine.getEntity(parsed.id, parsed.lang);
    },
  },
  {
    name: "get_event",
    description:
      "Retrieve a public event by canonical ID with its citing unrestricted relationships.",
    schema: GetEventInputSchema,
    execute: (engine, args) => engine.getEvent(GetEventInputSchema.parse(args).id),
  },
  {
    name: "get_case",
    description: "Retrieve a public editorial case and its public claims by case ID.",
    schema: GetCaseInputSchema,
    execute: (engine, args) => engine.getCase(GetCaseInputSchema.parse(args).id),
  },
  {
    name: "get_relations",
    description:
      "Query unrestricted public relationships with optional node, class, group, evidence level, and period filters.",
    schema: GetRelationsInputSchema,
    execute: (engine, args) => engine.getRelations(GetRelationsInputSchema.parse(args)),
  },
  {
    name: "get_evidence",
    description:
      "Progressively retrieve evidence for a public record at summary, standard, or full depth.",
    schema: GetEvidenceInputSchema,
    execute: (engine, args) => {
      const parsed = GetEvidenceInputSchema.parse(args);
      return engine.getEvidence(parsed.id, parsed.depth);
    },
  },
  {
    name: "find_paths",
    description:
      "Find documented relationship paths between two public nodes with full step details, sources, B15 caveat interruptions, step limits, and optional PK-11 path grammar.",
    schema: FindPathsInputSchema,
    execute: (engine, args) => engine.findPaths(FindPathsInputSchema.parse(args)),
  },
  {
    name: "get_timeline",
    description:
      "Query the public chronological timeline using the same filter semantics as the OEM site.",
    schema: GetTimelineInputSchema,
    execute: (engine, args) => engine.getTimeline(GetTimelineInputSchema.parse(args)),
  },
  {
    name: "get_changes",
    description: "Retrieve paginated Git change history filtered strictly to public record IDs.",
    schema: PaginationOnlyInputSchema,
    execute: (engine, args) => {
      const parsed = PaginationOnlyInputSchema.parse(args);
      return engine.getChanges(parsed.offset, parsed.limit);
    },
  },
  {
    name: "get_methodology",
    description:
      "Retrieve OEM methodology: E1-E5 evidence level definitions, B15 counter-inference rules, and glossary.",
    schema: EmptyInputSchema,
    execute: (engine, args) => {
      EmptyInputSchema.parse(args);
      return engine.getMethodology();
    },
  },
  {
    name: "get_open_questions",
    description:
      "Extension tool: retrieve public open investigative questions (E5 hypotheses and public discovery items, excluding natural persons by default).",
    schema: PaginationOnlyInputSchema,
    execute: (engine, args) => {
      const parsed = PaginationOnlyInputSchema.parse(args);
      return engine.getOpenQuestions(parsed.offset, parsed.limit);
    },
  },
  {
    name: "get_coverage",
    description:
      "Extension tool: retrieve public corpus coverage counts by collection, domain, theme, place, and evidence level.",
    schema: EmptyInputSchema,
    execute: (engine, args) => {
      EmptyInputSchema.parse(args);
      return engine.getCoverage();
    },
  },
];

export function listMcpTools() {
  return MCP_TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: z.toJSONSchema(t.schema),
  }));
}

export function callMcpTool(engine: QueryEngine, name: string, args: unknown = {}) {
  const tool = MCP_TOOLS.find((t) => t.name === name);
  if (!tool) {
    return {
      isError: true,
      content: [
        { type: "text" as const, text: JSON.stringify({ error: `Unknown tool: ${name}` }) },
      ],
    };
  }
  try {
    const result = tool.execute(engine, args ?? {});
    if (result === null) {
      return {
        isError: false,
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              found: false,
              message: "Record not found in the public OEM projection.",
              snapshot: engine.snapshot,
              staleness: engine.checkStaleness(),
            }),
          },
        ],
      };
    }
    return {
      isError: false,
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      isError: true,
      content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }],
    };
  }
}
