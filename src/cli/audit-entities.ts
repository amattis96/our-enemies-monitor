import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  DecisionsStore,
  findCandidatePairs,
  type IdentityEntityProfile,
  RedirectsStore,
} from "../identity/index.ts";
import { DATA_DIR, repoPath } from "../pipeline/paths.ts";

function parseNumberArg(args: string[], flag: string): number | undefined {
  const idx = args.indexOf(flag);
  if (idx === -1) return undefined;
  const val = Number(args[idx + 1]);
  return Number.isFinite(val) ? val : undefined;
}

function loadEntityProfiles(dataDir: string): IdentityEntityProfile[] {
  const entitiesDir = path.join(dataDir, "entities");
  if (!existsSync(entitiesDir)) return [];
  const files = readdirSync(entitiesDir)
    .filter((name) => name.endsWith(".json"))
    .sort();
  return files.map((file) => {
    const raw = JSON.parse(readFileSync(path.join(entitiesDir, file), "utf8")) as Record<
      string,
      unknown
    >;
    return {
      id: raw.id as string,
      kind: raw.kind as IdentityEntityProfile["kind"],
      name: raw.name as IdentityEntityProfile["name"],
      domain: raw.domain as IdentityEntityProfile["domain"],
      country: (raw.country as string | null) ?? null,
    };
  });
}

function loadDecisions(): DecisionsStore {
  const filePath = repoPath("docs/identity/decisions.v1.json");
  if (!existsSync(filePath)) return { version: "1.0", decisions: [] };
  return DecisionsStore.parse(JSON.parse(readFileSync(filePath, "utf8")));
}

function loadRedirects(): RedirectsStore {
  const filePath = repoPath("docs/identity/redirects.v1.json");
  if (!existsSync(filePath)) return { version: "1.0", redirects: [], history: [] };
  return RedirectsStore.parse(JSON.parse(readFileSync(filePath, "utf8")));
}

const args = process.argv.slice(2);
const minScore = parseNumberArg(args, "--min-score");
const limit = parseNumberArg(args, "--limit");

const entities = loadEntityProfiles(DATA_DIR);
const decisionsStore = loadDecisions();
const redirectsStore = loadRedirects();

const candidates = findCandidatePairs(
  entities,
  decisionsStore.decisions,
  minScore !== undefined ? { minScore } : {},
);

const outputCandidates = limit !== undefined ? candidates.slice(0, limit) : candidates;

const report = {
  entity_count: entities.length,
  persisted_decisions: decisionsStore.decisions.length,
  active_redirects: redirectsStore.redirects.length,
  auto_merge_enabled: false,
  summary: {
    total_candidates: candidates.length,
    same_candidates: candidates.filter((c) => c.outcome === "same").length,
    uncertain_candidates: candidates.filter((c) => c.outcome === "uncertain").length,
    persisted_distinct_count: decisionsStore.decisions.filter((d) => d.outcome === "distinct")
      .length,
  },
  candidates: outputCandidates,
};

console.log(JSON.stringify(report, null, 2));
