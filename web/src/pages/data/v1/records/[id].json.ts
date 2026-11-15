import { getExports } from "../../../../lib/model.ts";

/** One package per published record (`data/v1/records/<ID>.json`), from the public projection. */
export function getStaticPaths() {
  return getExports()
    .files.filter((file) => file.path.startsWith("records/"))
    .map((file) => ({
      params: { id: file.path.slice("records/".length).replace(/\.json$/, "") },
      props: { text: file.text },
    }));
}

export function GET({ props }: { props: { text: string } }) {
  return new Response(props.text, { headers: { "Content-Type": "application/json" } });
}
