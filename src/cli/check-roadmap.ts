import {
  loadActiveWork,
  loadProgressMap,
  loadRoadmapPlan,
  validateRoadmap,
} from "../roadmap/index.ts";

const plan = loadRoadmapPlan();
const progressMap = loadProgressMap();
const activeWork = loadActiveWork();
const result = validateRoadmap(plan, progressMap, activeWork);

for (const warning of result.warnings) {
  console.warn(`warning  [${warning.code}] ${warning.target}: ${warning.message}`);
}

for (const error of result.errors) {
  console.error(`error    [${error.code}] ${error.target}: ${error.message}`);
}

console.log(`Eligible packages (${result.eligible.length}): ${result.eligible.join(", ")}`);
console.log(`${result.errors.length} error(s), ${result.warnings.length} warning(s)`);

process.exit(result.errors.length > 0 ? 1 : 0);
