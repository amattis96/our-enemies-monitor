import { sourceMarkdown } from "../../../../src/site/markdown.ts";
import { getModel } from "../../lib/model.ts";

/** Deterministic Markdown representation of every published source (excludes withheld records). */
export function getStaticPaths() {
  const model = getModel();
  return model.dataset.sources.map((source) => ({
    params: { id: source.id },
    props: { text: sourceMarkdown(source, model) },
  }));
}

export function GET({ props }: { props: { text: string } }) {
  return new Response(props.text, { headers: { "Content-Type": "text/markdown; charset=utf-8" } });
}
