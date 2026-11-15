import type { Language, LocalizedText } from "../../../src/model/index.ts";
import { pick } from "../../../src/site/i18n.ts";

export function BoardCaveat({
  caveat,
  lang,
}: {
  caveat?: LocalizedText | null | undefined;
  lang: Language;
}) {
  if (!caveat) return null;
  const chosen = pick(caveat, lang);
  return (
    <p className="board-caveat">
      <strong>{lang === "it" ? "Avvertenza" : "Caveat"}:</strong>{" "}
      <span lang={chosen.lang}>{chosen.value}</span>
    </p>
  );
}
