import { exportMetadataFiles } from "../../../../../src/site/exports.ts";
import { getExports } from "../../../lib/model.ts";

/** Sidecar `<file>.metadata.json` for every top-level exported file in `data/v1/`. */
export function getStaticPaths() {
  const { files, manifest } = getExports();
  const topLevel = files.filter((file) => !file.path.includes("/"));
  return exportMetadataFiles(topLevel, manifest).map((meta) => ({
    params: { file: meta.path.replace(/\.metadata\.json$/, "") },
    props: { text: meta.text },
  }));
}

export function GET({ props }: { props: { text: string } }) {
  return new Response(props.text, { headers: { "Content-Type": "application/json" } });
}
