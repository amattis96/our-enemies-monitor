import { articleLanguages, articleMarkdown } from "../../../../src/site/articles.ts";
import { href } from "../../lib/links.ts";
import { getArticles, getModel } from "../../lib/model.ts";

/** Language-neutral Markdown download of each public article: `articles/<ID>.<lang>.md`. */
export function getStaticPaths() {
  const site = import.meta.env.SITE;
  return getArticles().flatMap((article) =>
    articleLanguages(article).map((lang) => ({
      params: { file: `${article.id}.${lang}` },
      props: {
        text: articleMarkdown(
          article,
          lang,
          getModel(),
          (path, l) => new URL(href(path, l), site).href,
        ),
      },
    })),
  );
}

export function GET({ props }: { props: { text: string } }) {
  return new Response(props.text, { headers: { "Content-Type": "text/markdown; charset=utf-8" } });
}
