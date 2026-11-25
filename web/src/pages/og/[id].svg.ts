import { ogCardInputFromModel, renderOgSvg } from "../../../../src/site/og-image.ts";
import { getModel } from "../../lib/model.ts";

export function getStaticPaths() {
  const model = getModel();
  const ids = [
    ...model.events.map((e) => e.id),
    ...model.dataset.entities.map((e) => e.id),
    ...model.dataset.hypotheses.map((h) => h.id),
  ];
  return ids.map((id) => ({ params: { id } }));
}

export function GET({ params }: { params: { id: string } }): Response {
  const model = getModel();
  const input = ogCardInputFromModel(model, params.id, "it");
  if (!input) {
    return new Response("Not found", { status: 404 });
  }
  return new Response(renderOgSvg(input), {
    headers: { "Content-Type": "image/svg+xml; charset=utf-8" },
  });
}
