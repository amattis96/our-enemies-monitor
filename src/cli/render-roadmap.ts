import { computeEligibility, loadProgressMap, loadRoadmapPlan } from "../roadmap/index.ts";
import { renderRoadmapSummary } from "../roadmap/render.ts";

const plan = loadRoadmapPlan();
const progressMap = loadProgressMap();
const { computedStatuses } = computeEligibility(plan, progressMap);

process.stdout.write(renderRoadmapSummary(plan, progressMap, computedStatuses));
