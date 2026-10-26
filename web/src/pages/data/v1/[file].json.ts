import { exportFiles } from "../../../../../src/site/exports.ts";
import { getModel } from "../../../lib/model.ts";

/** One file per collection plus `all.json` (canonical records, CC0). */
export function getStaticPaths() {
  return exportFiles(getModel().dataset)
    .filter((file) => !file.path.includes("/"))
    .map((file) => ({
      params: { file: file.path.replace(/\.json$/, "") },
      props: { text: file.text },
    }));
}

export function GET({ props }: { props: { text: string } }) {
  return new Response(props.text, { headers: { "Content-Type": "application/json" } });
}
