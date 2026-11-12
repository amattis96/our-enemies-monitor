import type { EntityKind, EvidenceLevel, Language, RelationGroup, Theme } from "../model/index.ts";

/**
 * Visual vocabulary of the Dossier design system (docs/design/): which icon
 * of the sprite (`docs/design/assets/icons.svg`), which data colour token and
 * which thread pattern each model value uses. Kept here, with tests, so
 * templates and islands never decide evidence styling on their own.
 */

type Labels = { it: string; en: string };

export const THEME_ICON = (theme: Theme): string => `th-${theme}`;

export const KIND_ICON: Record<EntityKind | "event", string> = {
  state: "kind-state",
  institution: "kind-institution",
  person: "kind-person",
  organization: "kind-organization",
  company: "kind-company",
  asset: "kind-asset",
  event: "kind-event",
};

export const RELATION_GROUP_ICON: Record<RelationGroup, string> = {
  participation: "rel-participation",
  control: "rel-control",
  financial: "rel-financial",
  influence_information: "rel-influence",
  security_intelligence: "rel-security",
  economic_dependency: "rel-economic",
  institutional: "rel-institutional",
  context: "rel-context",
};

/** Categorical colour token of each relation group (fixed order, never cycled). */
export const RELATION_GROUP_COLOR: Record<RelationGroup, string> = {
  security_intelligence: "var(--series-1)",
  control: "var(--series-2)",
  economic_dependency: "var(--series-3)",
  financial: "var(--series-4)",
  influence_information: "var(--series-5)",
  institutional: "var(--series-6)",
  participation: "var(--series-neutral)",
  context: "var(--series-neutral)",
};

/** Display order of relation groups in legends and filters. */
export const RELATION_GROUP_ORDER: RelationGroup[] = [
  "security_intelligence",
  "control",
  "economic_dependency",
  "financial",
  "influence_information",
  "institutional",
  "participation",
  "context",
];

export const EVIDENCE_ICON: Record<EvidenceLevel, string> = {
  E1: "ev-e1",
  E2: "ev-e2",
  E3: "ev-e3",
  E4: "ev-e4",
  E5: "ev-e5",
};

/** Short stamp labels; the full definitions stay in EVIDENCE_LEVEL_LABELS. */
export const EVIDENCE_SHORT: Record<EvidenceLevel, Labels> = {
  E1: { it: "Atto primario", en: "Primary act" },
  E2: { it: "Attribuzione", en: "Attribution" },
  E3: { it: "Corroborato", en: "Corroborated" },
  E4: { it: "Accusa", en: "Allegation" },
  E5: { it: "Ipotesi", en: "Hypothesis" },
};

/**
 * Thread style on the board: the evidence level is carried by the pattern,
 * never by colour. `double` draws two parallel strokes.
 */
export const EVIDENCE_THREAD: Record<
  EvidenceLevel,
  { dash: string | null; width: number; double: boolean }
> = {
  E1: { dash: null, width: 1.4, double: true },
  E2: { dash: null, width: 2.6, double: false },
  E3: { dash: "9 5", width: 2.2, double: false },
  E4: { dash: "0.1 6", width: 2.8, double: false },
  E5: { dash: "10 4 1 4", width: 2.2, double: false },
};

export const REVIEW_ICON = {
  reviewed: "st-reviewed",
  needs_review: "st-needs-review",
  imported_unreviewed: "st-unreviewed",
} as const;

export const REVIEW_TONE = {
  reviewed: "ok",
  needs_review: "caution",
  imported_unreviewed: "neutral",
} as const;

/** Every icon ID the site may reference, for the sprite consistency test. */
export function referencedIcons(themes: readonly Theme[]): string[] {
  return [
    ...themes.map(THEME_ICON),
    ...Object.values(KIND_ICON),
    ...Object.values(RELATION_GROUP_ICON),
    ...Object.values(EVIDENCE_ICON),
    ...Object.values(REVIEW_ICON),
  ];
}

export function evidenceShort(level: EvidenceLevel, lang: Language): string {
  return EVIDENCE_SHORT[level][lang];
}
