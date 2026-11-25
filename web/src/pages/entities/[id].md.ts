import { entityMarkdown } from "../../../../src/site/markdown.ts";
import { getModel } from "../../lib/model.ts";

/** Deterministic Markdown representation of every published entity (excludes withheld records). */
export function getStaticPaths() {
  const model = getModel();
  return model.dataset.entities.map((entity) => ({
    params: { id: entity.id },
    props: { text: entityMarkdown(entity, model) },
  }));
}

export function GET({ props }: { props: { text: string } }) {
  return new Response(props.text, { headers: { "Content-Type": "text/markdown; charset=utf-8" } });
}
