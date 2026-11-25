import { loadDiscoveryQueue } from "../discovery/queue/store.ts";

// pnpm validate:discovery: the discovery queue stored in docs/discovery/ is
// schema-valid, one file per item named by id, without duplicate dedup keys.
const { queue, issues } = loadDiscoveryQueue();
for (const issue of issues) console.error(`error  docs/discovery/${issue.file}: ${issue.message}`);
console.log(
  `${queue.items.length} queue item(s), ${queue.negative_memory.length} negative record(s), ${issues.length} error(s)`,
);
if (issues.length > 0) process.exitCode = 1;
