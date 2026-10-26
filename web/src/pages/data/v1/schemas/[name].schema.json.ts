import { exportFiles } from "../../../../../../src/site/exports.ts";
import { getModel } from "../../../../lib/model.ts";

/** JSON Schema of each collection, generated from the Zod model. */
export function getStaticPaths() {
  return exportFiles(getModel().dataset)
    .filter((file) => file.path.startsWith("schemas/"))
    .map((file) => ({
      params: { name: file.path.slice("schemas/".length).replace(/\.schema\.json$/, "") },
      props: { text: file.text },
    }));
}

export function GET({ props }: { props: { text: string } }) {
  return new Response(props.text, { headers: { "Content-Type": "application/schema+json" } });
}
