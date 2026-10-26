import { hypothesisGraph } from "../../../../../src/site/read-model.ts";
import { getModel } from "../../../lib/model.ts";

/** Exploratory graph of open hypotheses, published separately from the evidence graph. */
export function GET() {
  return new Response(JSON.stringify(hypothesisGraph(getModel())), {
    headers: { "Content-Type": "application/json" },
  });
}
