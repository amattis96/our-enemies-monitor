import { evidenceGraph } from "../../../../../src/site/read-model.ts";
import { getModel } from "../../../lib/model.ts";

/** Evidence graph (unrestricted relationships), consumed by the network view. */
export function GET() {
  return new Response(JSON.stringify(evidenceGraph(getModel())), {
    headers: { "Content-Type": "application/json" },
  });
}
