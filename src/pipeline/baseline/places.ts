/**
 * Country-level reading of the free-text geography of events (M3).
 * Geography is split on "/" and every token is mapped explicitly: to ISO
 * 3166-1 alpha-2 codes when it names a country or a place within one, or to
 * nothing when it names a supranational area, a sea, an institution or a
 * platform. The importer fails on an unmapped token. No coordinates are
 * derived: the atlas works at country level only.
 */
export const GEOGRAPHY_TOKEN_PLACES: Record<string, string[]> = {
  Albania: ["AL"],
  Angola: ["AO"],
  Belgio: ["BE"],
  Bielorussia: ["BY"],
  Brasile: ["BR"],
  Cechia: ["CZ"],
  Ceuta: ["ES"],
  Cina: ["CN"],
  Crimea: ["UA"],
  Estonia: ["EE"],
  Finlandia: ["FI"],
  Francia: ["FR"],
  Georgia: ["GE"],
  Germania: ["DE"],
  Iran: ["IR"],
  Irlanda: ["IE"],
  Israele: ["IL"],
  Italia: ["IT"],
  Lituania: ["LT"],
  Marocco: ["MA"],
  Moldavia: ["MD"],
  "Paesi Bassi": ["NL"],
  Polonia: ["PL"],
  Portogallo: ["PT"],
  "Regno Unito": ["GB"],
  "Repubblica Democratica del Congo": ["CD"],
  Romania: ["RO"],
  Russia: ["RU"],
  Spagna: ["ES"],
  "Stati Uniti": ["US"],
  Svalbard: ["NO"],
  Svezia: ["SE"],
  Turchia: ["TR"],
  UK: ["GB"],
  USA: ["US"],
  Ucraina: ["UA"],
  Washington: ["US"],
  // Areas, seas, institutions, platforms and generic scopes: no country.
  Artico: [],
  Baltico: [],
  CPI: [],
  "Corte penale internazionale": [],
  Europa: [],
  Eurozona: [],
  "Golfo di Finlandia": [],
  "Mar Baltico": [],
  "Medio Oriente": [],
  "Mercato petrolifero mondiale": [],
  Meta: [],
  NATO: [],
  "Parlamento europeo": [],
  Progetto: [],
  "Stretto di Hormuz": [],
  "Stretto di Taiwan": [],
  UE: [],
  "Unione europea": [],
  X: [],
  "frontiera UE": [],
  globale: [],
  "investitori globali": [],
  "mercati globali": [],
  "mercato globale": [],
  mondo: [],
  "paesi terzi": [],
  "territori d’oltremare": [],
  web: [],
};

export function placesOf(geography: string | null, id: string): string[] {
  if (!geography) return [];
  const codes = geography.split("/").flatMap((token) => {
    const places = GEOGRAPHY_TOKEN_PLACES[token.trim()];
    if (!places) throw new Error(`${id}: no place mapping for geography token "${token.trim()}"`);
    return places;
  });
  return [...new Set(codes)];
}
