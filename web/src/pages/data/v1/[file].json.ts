import { getExports } from "../../../lib/model.ts";

/** Collection, graph and catalog exports share this route and the manifest byte source. */
export function getStaticPaths() {
  return getExports()
    .files.filter((file) => !file.path.includes("/") && file.path.endsWith(".json"))
    .map((file) => ({
      params: { file: file.path.replace(/\.json$/, "") },
      props: { text: file.text },
    }));
}

export function GET({ props }: { props: { text: string } }) {
  return new Response(props.text, { headers: { "Content-Type": "application/json" } });
}
