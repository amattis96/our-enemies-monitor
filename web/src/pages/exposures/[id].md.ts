import { exposureMarkdown } from "../../../../src/site/markdown.ts";
import { getModel } from "../../lib/model.ts";

/** Deterministic Markdown representation of every published exposure (excludes withheld records). */
export function getStaticPaths() {
  const model = getModel();
  return model.dataset.exposures.map((exposure) => ({
    params: { id: exposure.id },
    props: { text: exposureMarkdown(exposure, model) },
  }));
}

export function GET({ props }: { props: { text: string } }) {
  return new Response(props.text, { headers: { "Content-Type": "text/markdown; charset=utf-8" } });
}
