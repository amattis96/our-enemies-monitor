import { hypothesisMarkdown } from "../../../../src/site/markdown.ts";
import { getModel } from "../../lib/model.ts";

/** Deterministic Markdown representation of every published hypothesis (excludes withheld records). */
export function getStaticPaths() {
  const model = getModel();
  return model.dataset.hypotheses.map((hypothesis) => ({
    params: { id: hypothesis.id },
    props: { text: hypothesisMarkdown(hypothesis, model) },
  }));
}

export function GET({ props }: { props: { text: string } }) {
  return new Response(props.text, { headers: { "Content-Type": "text/markdown; charset=utf-8" } });
}
