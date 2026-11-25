import { eventMarkdown } from "../../../../src/site/markdown.ts";
import { getModel } from "../../lib/model.ts";

/** Deterministic Markdown representation of every published event (excludes withheld records). */
export function getStaticPaths() {
  const model = getModel();
  return model.dataset.events.map((event) => ({
    params: { id: event.id },
    props: { text: eventMarkdown(event, model) },
  }));
}

export function GET({ props }: { props: { text: string } }) {
  return new Response(props.text, { headers: { "Content-Type": "text/markdown; charset=utf-8" } });
}
