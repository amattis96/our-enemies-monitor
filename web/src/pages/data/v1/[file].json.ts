import { exportFiles } from "../../../../../src/site/exports.ts";
import { getPublication } from "../../../lib/model.ts";

/** Collection and graph exports share this route and the manifest byte source. */
export function getStaticPaths() {
  return exportFiles(getPublication())
    .filter((file) => !file.path.includes("/"))
    .map((file) => ({
      params: { file: file.path.replace(/\.json$/, "") },
      props: { text: file.text },
    }));
}

export function GET({ props }: { props: { text: string } }) {
  return new Response(props.text, { headers: { "Content-Type": "application/json" } });
}
