import {
  checkPersonDataMinimization,
  type ExternalIdentifiers,
  type IdentityEntityProfile,
  type RegistryIdentifier,
  type TemporalAlias,
} from "./schema.ts";

// ---------------------------------------------------------------------------
// Offline Enrichment Input Contracts (LEI, OpenSanctions, Corporate Registry)

export type GleifLeiInput = {
  source: "gleif_lei";
  lei: string;
  legal_name: string;
  jurisdiction: string;
  other_names?: string[];
  official_website?: string;
};

export type OpenSanctionsInput = {
  source: "opensanctions";
  id: string;
  schema: "Person" | "Company" | "Organization";
  name: string;
  aliases?: string[];
  countries?: string[];
  lei_code?: string;
  registration_number?: string;
  wikidata_id?: string;
  websites?: string[];
  extra_attributes?: Record<string, unknown>;
};

export type CorporateRegistryInput = {
  source: "corporate_registry";
  registry: string;
  jurisdiction: string;
  registration_number: string;
  legal_name: string;
  previous_names?: { name: string; valid_from?: string | null; valid_to?: string | null }[];
  official_website?: string;
};

export type EnrichmentInput = GleifLeiInput | OpenSanctionsInput | CorporateRegistryInput;

export type EnrichmentCandidate = {
  source_system: EnrichmentInput["source"];
  source_record_id: string;
  external_ids: ExternalIdentifiers;
  aliases: TemporalAlias[];
  country: string | null;
  sanctions_listed: boolean;
  minimization_warnings: string[];
};

function isValidIso2(code: string | undefined): code is string {
  return typeof code === "string" && /^[A-Z]{2}$/.test(code);
}

/** Normalizes an offline GLEIF LEI record into an enrichment candidate. */
export function normalizeLeiRecord(input: GleifLeiInput): EnrichmentCandidate {
  const aliases: TemporalAlias[] = (input.other_names ?? []).map((name) => ({
    name,
    kind: "rename",
    valid_from: null,
    valid_to: null,
    note: `GLEIF LEI ${input.lei}`,
  }));

  const externalIds: ExternalIdentifiers = {
    lei: input.lei,
    ...(input.official_website ? { official_website: input.official_website } : {}),
  };

  return {
    source_system: "gleif_lei",
    source_record_id: input.lei,
    external_ids: externalIds,
    aliases,
    country: isValidIso2(input.jurisdiction) ? input.jurisdiction : null,
    sanctions_listed: false,
    minimization_warnings: [],
  };
}

/**
 * Normalizes an offline OpenSanctions record into an enrichment candidate,
 * enforcing person data minimization on any extra attributes.
 */
export function normalizeOpenSanctionsRecord(input: OpenSanctionsInput): EnrichmentCandidate {
  const warnings: string[] = [];
  if (input.schema === "Person" && input.extra_attributes) {
    const check = checkPersonDataMinimization({
      kind: "person",
      ...input.extra_attributes,
    });
    if (!check.ok) {
      warnings.push(
        `Stripped disallowed person attributes from OpenSanctions ${input.id}: ${check.violations.join(", ")}`,
      );
    }
  }

  const firstCountry = input.countries?.find((c) => isValidIso2(c)) ?? null;
  const registryNumbers: RegistryIdentifier[] =
    input.registration_number && firstCountry
      ? [{ number: input.registration_number, jurisdiction: firstCountry }]
      : [];

  const externalIds: ExternalIdentifiers = {
    ...(input.lei_code ? { lei: input.lei_code } : {}),
    ...(registryNumbers.length > 0 ? { registry_numbers: registryNumbers } : {}),
    ...(input.wikidata_id ? { wikidata_qid: input.wikidata_id } : {}),
    ...(input.websites?.[0] ? { official_website: input.websites[0] } : {}),
    sanctions_ids: [input.id],
  };

  const aliases: TemporalAlias[] = (input.aliases ?? []).map((name) => ({
    name,
    kind: "transliteration",
    valid_from: null,
    valid_to: null,
    note: `OpenSanctions ${input.id}`,
  }));

  return {
    source_system: "opensanctions",
    source_record_id: input.id,
    external_ids: externalIds,
    aliases,
    country: firstCountry,
    sanctions_listed: true,
    minimization_warnings: warnings,
  };
}

/** Normalizes an offline national corporate registry record. */
export function normalizeCorporateRegistryRecord(
  input: CorporateRegistryInput,
): EnrichmentCandidate {
  const registryNumbers: RegistryIdentifier[] = isValidIso2(input.jurisdiction)
    ? [
        {
          number: input.registration_number,
          jurisdiction: input.jurisdiction,
          registry: input.registry,
        },
      ]
    : [];

  const aliases: TemporalAlias[] = (input.previous_names ?? []).map((prev) => ({
    name: prev.name,
    kind: "rename",
    valid_from: prev.valid_from ?? null,
    valid_to: prev.valid_to ?? null,
    note: `${input.registry} (${input.jurisdiction})`,
  }));

  const externalIds: ExternalIdentifiers = {
    ...(registryNumbers.length > 0 ? { registry_numbers: registryNumbers } : {}),
    ...(input.official_website ? { official_website: input.official_website } : {}),
  };

  return {
    source_system: "corporate_registry",
    source_record_id: `${input.jurisdiction}:${input.registry}:${input.registration_number}`,
    external_ids: externalIds,
    aliases,
    country: isValidIso2(input.jurisdiction) ? input.jurisdiction : null,
    sanctions_listed: false,
    minimization_warnings: [],
  };
}

/** Dispatches any supported offline enrichment payload to its normalizer. */
export function normalizeEnrichmentInput(input: EnrichmentInput): EnrichmentCandidate {
  switch (input.source) {
    case "gleif_lei":
      return normalizeLeiRecord(input);
    case "opensanctions":
      return normalizeOpenSanctionsRecord(input);
    case "corporate_registry":
      return normalizeCorporateRegistryRecord(input);
  }
}

export type EnrichmentResult = {
  profile: IdentityEntityProfile;
  added_external_ids: string[];
  added_aliases: string[];
  minimization_warnings: string[];
};

/**
 * Deterministically enriches an entity profile from offline registry candidates
 * without mutating the input profile.
 */
export function enrichEntityProfile(
  entity: IdentityEntityProfile,
  candidates: readonly EnrichmentCandidate[],
): EnrichmentResult {
  const next = structuredClone(entity);
  const addedExternalIds: string[] = [];
  const addedAliases: string[] = [];
  const warnings: string[] = [];

  const ext: ExternalIdentifiers = { ...(next.external_ids ?? {}) };
  const aliases = [...(next.aliases ?? [])];
  const seenAliases = new Set(aliases.map((a) => a.name.toLowerCase()));
  const regNumbers = [...(ext.registry_numbers ?? [])];
  const seenRegs = new Set(regNumbers.map((r) => `${r.jurisdiction}:${r.number}`));
  const sanctionsIds = new Set(ext.sanctions_ids ?? []);

  for (const cand of candidates) {
    warnings.push(...cand.minimization_warnings);

    if (!ext.lei && cand.external_ids.lei) {
      ext.lei = cand.external_ids.lei;
      addedExternalIds.push(`lei:${cand.external_ids.lei}`);
    }
    if (!ext.wikidata_qid && cand.external_ids.wikidata_qid) {
      ext.wikidata_qid = cand.external_ids.wikidata_qid;
      addedExternalIds.push(`wikidata_qid:${cand.external_ids.wikidata_qid}`);
    }
    if (!ext.official_website && cand.external_ids.official_website) {
      ext.official_website = cand.external_ids.official_website;
      addedExternalIds.push(`official_website:${cand.external_ids.official_website}`);
    }
    for (const reg of cand.external_ids.registry_numbers ?? []) {
      const key = `${reg.jurisdiction}:${reg.number}`;
      if (!seenRegs.has(key)) {
        regNumbers.push(reg);
        seenRegs.add(key);
        addedExternalIds.push(`registry:${key}`);
      }
    }
    for (const sid of cand.external_ids.sanctions_ids ?? []) {
      if (!sanctionsIds.has(sid)) {
        sanctionsIds.add(sid);
        addedExternalIds.push(`sanctions:${sid}`);
      }
    }
    for (const alias of cand.aliases) {
      const key = alias.name.toLowerCase();
      if (!seenAliases.has(key)) {
        aliases.push(alias);
        seenAliases.add(key);
        addedAliases.push(alias.name);
      }
    }
    if (cand.sanctions_listed) {
      next.sanctions_listed = true;
    }
  }

  if (regNumbers.length > 0) ext.registry_numbers = regNumbers;
  if (sanctionsIds.size > 0) ext.sanctions_ids = [...sanctionsIds];
  if (Object.keys(ext).length > 0) next.external_ids = ext;
  if (aliases.length > 0) next.aliases = aliases;

  return {
    profile: next,
    added_external_ids: addedExternalIds,
    added_aliases: addedAliases,
    minimization_warnings: warnings,
  };
}
