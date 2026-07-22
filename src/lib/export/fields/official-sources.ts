/**
 * Official RTC / NF-e sources versioned for curated IBS/CBS / cClassTrib fields.
 * Do not invent semantics — refresh when NT/tables change.
 */
export const OFFICIAL_NFE_SOURCES = {
  catalogVersion: "inventory-202606-nfe + NT-2025.002-ref",
  documentsPortal: "https://dfe-portal.svrs.rs.gov.br/NFe/Documentos",
  rtcValidator: "https://dfe-portal.svrs.rs.gov.br/Cff/ValidadorRtcNfe",
  classificationTables:
    "https://www.nfe.fazenda.gov.br/portal/listaConteudo.aspx?tipoConteudo=/NJarYc9nus%3D",
  notes: [
    "NT 2025.002 adapts NF-e/NFC-e layouts for Reforma Tributária (IBS/CBS).",
    "Validador RTC uses exact tag cClassTrib.",
    "Classification table is versioned — do not freeze descriptions without vigência.",
  ],
} as const;
