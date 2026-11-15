import { getExports } from "../../../lib/model.ts";

/** Spreadsheet copies of the public collections; same bytes as the manifest entries. */
export function getStaticPaths() {
  return getExports()
    .files.filter((file) => !file.path.includes("/") && file.path.endsWith(".csv"))
    .map((file) => ({
      params: { file: file.path.replace(/\.csv$/, "") },
      props: { text: file.text },
    }));
}

export function GET({ props }: { props: { text: string } }) {
  return new Response(props.text, { headers: { "Content-Type": "text/csv; charset=utf-8" } });
}
