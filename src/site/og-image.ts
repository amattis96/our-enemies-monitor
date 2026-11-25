import type { Language } from "../model/index.ts";
import { textOf } from "./i18n.ts";
import type { ReadModel } from "./read-model.ts";

export type OgRecordKind = "event" | "entity" | "hypothesis";

export type OgCardInput = {
  id: string;
  kind: OgRecordKind;
  title: string;
  subtitle?: string;
  badge: string;
  caveat?: string;
  lang: Language;
};

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function wrapLines(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
      if (lines.length === maxLines) break;
    }
  }
  if (current && lines.length < maxLines) {
    lines.push(current);
  }
  if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length) {
    const last = lines[maxLines - 1] ?? "";
    lines[maxLines - 1] = `${last.slice(0, Math.max(0, maxChars - 1))}…`;
  }
  return lines;
}

const ACCENT_BY_KIND: Record<OgRecordKind, string> = {
  event: "#8b2635",
  entity: "#1f4e79",
  hypothesis: "#7a5c12",
};

/**
 * Render a deterministic 1200x630 SVG Open Graph preview card for a public record.
 */
export function renderOgSvg(input: OgCardInput): string {
  const accent = ACCENT_BY_KIND[input.kind];
  const titleLines = wrapLines(input.title, 42, 3);
  const subtitleLines = input.subtitle ? wrapLines(input.subtitle, 68, 2) : [];
  const caveatText = input.caveat
    ? input.caveat
    : input.kind === "hypothesis"
      ? input.lang === "it"
        ? "E5 · Domanda di verifica aperta — non è un fatto accertato"
        : "E5 · Open verification question — not an established fact"
      : input.lang === "it"
        ? "Proiezione pubblica · Evidenza tracciata su fonti"
        : "Public projection · Source-traced evidence";

  const titleSvg = titleLines
    .map(
      (line, idx) =>
        `<text x="72" y="${220 + idx * 54}" font-family="system-ui, -apple-system, sans-serif" font-size="42" font-weight="700" fill="#14181f">${escapeXml(line)}</text>`,
    )
    .join("\n  ");

  const subtitleY = 220 + titleLines.length * 54 + 24;
  const subtitleSvg = subtitleLines
    .map(
      (line, idx) =>
        `<text x="72" y="${subtitleY + idx * 32}" font-family="system-ui, -apple-system, sans-serif" font-size="24" fill="#3a4250">${escapeXml(line)}</text>`,
    )
    .join("\n  ");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="${escapeXml(`${input.id}: ${input.title}`)}">
  <rect width="1200" height="630" fill="#f7f4ee" />
  <rect x="0" y="0" width="1200" height="12" fill="${accent}" />
  <rect x="48" y="48" width="1104" height="534" fill="none" stroke="#d8d1c5" stroke-width="2" />
  <rect x="72" y="84" width="220" height="40" rx="4" fill="${accent}" />
  <text x="88" y="111" font-family="ui-monospace, SFMono-Regular, monospace" font-size="22" font-weight="600" fill="#f7f4ee">${escapeXml(input.id)}</text>
  <text x="312" y="111" font-family="ui-monospace, SFMono-Regular, monospace" font-size="20" font-weight="600" fill="${accent}">${escapeXml(input.badge)}</text>
  ${titleSvg}
  ${subtitleSvg}
  <line x1="72" y1="504" x2="1128" y2="504" stroke="#d8d1c5" stroke-width="2" />
  <text x="72" y="544" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="600" fill="#14181f">Our Enemies Monitor</text>
  <text x="1128" y="544" text-anchor="end" font-family="system-ui, -apple-system, sans-serif" font-size="18" fill="#525b6a">${escapeXml(caveatText)}</text>
</svg>
`;
}

/**
 * Build an `OgCardInput` from the public `ReadModel` for an event, entity, or hypothesis ID.
 */
export function ogCardInputFromModel(
  model: ReadModel,
  id: string,
  lang: Language = "it",
): OgCardInput | null {
  const event = model.event(id);
  if (event) {
    return {
      id: event.id,
      kind: "event",
      title: textOf(event.title, lang),
      subtitle: textOf(event.description, lang),
      badge: event.evidence_level ? `EVENT · ${event.evidence_level}` : "EVENT",
      lang,
    };
  }
  const entity = model.entity(id);
  if (entity) {
    return {
      id: entity.id,
      kind: "entity",
      title: textOf(entity.name, lang),
      subtitle: `${entity.kind}${entity.country ? ` · ${entity.country}` : ""}`,
      badge: `ENTITY · ${entity.kind.toUpperCase()}`,
      lang,
    };
  }
  const hypothesis = model.hypothesis(id);
  if (hypothesis) {
    return {
      id: hypothesis.id,
      kind: "hypothesis",
      title: textOf(hypothesis.question, lang),
      subtitle: textOf(hypothesis.current_limit, lang),
      badge: `HYPOTHESIS · E5 · ${hypothesis.status.toUpperCase()}`,
      lang,
    };
  }
  return null;
}
