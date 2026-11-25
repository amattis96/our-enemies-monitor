import type { TargetLanguage, TranslationEntry } from "./multilingual.ts";

export type FallbackResolution = {
  lang: string;
  isStale: boolean;
  isFlagged: boolean;
  showItalianOriginal: boolean;
  notice: string | null;
  includeInHreflang: boolean;
  robots: "index, follow" | "noindex, follow";
  canonicalUrl: string;
  redirectTo: string | null;
};

export type FallbackInput = {
  lang: TargetLanguage | "it";
  pagePath: string;
  italianUrl: string;
  selfUrl: string;
  currentSourceHash: string;
  entry?: TranslationEntry;
};

const STALE_NOTICES: Record<string, string> = {
  en: "This translation is outdated or under verification. Showing the canonical Italian original.",
  fr: "Cette traduction est obsolète ou en cours de vérification. Affichage de l'original italien.",
  de: "Diese Übersetzung ist veraltet oder wird überprüft. Es wird das italienische Original angezeigt.",
  pl: "To tłumaczenie jest nieaktualne lub w trakcie weryfikacji. Wyświetlono oryginał włoski.",
  uk: "Цей переклад застарів або перевіряється. Показано італійський оригінал.",
  es: "Esta traducción está desactualizada o en verificación. Se muestra el original en italiano.",
  ro: "Această traducere este depășită sau în curs de verificare. Se afișează originalul italian.",
  lt: "Šis vertimas yra pasenęs arba tikrinamas. Rodomas originalas italų kalba.",
  lv: "Šis tulkojums ir novecojis vai tiek pārbaudīts. Tiek rādīts oriģināls itāļu valodā.",
  et: "See tõlge on aegunud või kontrollimisel. Kuvatakse itaaliakeelne originaal.",
};

/**
 * Resolves stale/flagged translation fallback policy:
 * - Shows Italian original with an explicit notice.
 * - Excludes stale or `machine_flagged` pages from `hreflang`.
 * - Sets `noindex, follow` and points canonical to the Italian original.
 */
export function resolveTranslationFallback(input: FallbackInput): FallbackResolution {
  if (input.lang === "it") {
    return {
      lang: "it",
      isStale: false,
      isFlagged: false,
      showItalianOriginal: true,
      notice: null,
      includeInHreflang: true,
      robots: "index, follow",
      canonicalUrl: input.italianUrl,
      redirectTo: null,
    };
  }

  const entry = input.entry;
  const isFlagged = entry?.status === "machine_flagged";
  const isStale =
    !entry || entry.status === "stale" || entry.source_hash !== input.currentSourceHash;

  if (isFlagged || isStale) {
    return {
      lang: input.lang,
      isStale,
      isFlagged,
      showItalianOriginal: true,
      notice: STALE_NOTICES[input.lang] ?? STALE_NOTICES.en ?? null,
      includeInHreflang: false,
      robots: "noindex, follow",
      canonicalUrl: input.italianUrl,
      redirectTo: null,
    };
  }

  return {
    lang: input.lang,
    isStale: false,
    isFlagged: false,
    showItalianOriginal: false,
    notice: null,
    includeInHreflang: true,
    robots: "index, follow",
    canonicalUrl: input.selfUrl,
    redirectTo: null,
  };
}

export type HreflangAlternate = {
  hreflang: string;
  href: string;
};

/**
 * Builds `hreflang` alternates excluding any language whose translation is stale
 * or `machine_flagged`. Always includes `it` and `x-default`.
 */
export function buildHreflangAlternates(
  italianUrl: string,
  candidates: readonly FallbackResolution[],
): HreflangAlternate[] {
  const alternates: HreflangAlternate[] = [{ hreflang: "it", href: italianUrl }];
  for (const candidate of candidates) {
    if (candidate.lang === "it") continue;
    if (!candidate.includeInHreflang) continue;
    alternates.push({ hreflang: candidate.lang, href: candidate.canonicalUrl });
  }
  alternates.push({ hreflang: "x-default", href: italianUrl });
  return alternates;
}
