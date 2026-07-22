/**
 * Official source catalog — URLs from RFB/SPED portals.
 * documentHash only when locally verified; never invent hashes.
 */

export type OfficialSourceRecord = {
  id: string;
  title: string;
  url: string;
  obligation?: string;
  versionLabel?: string;
  publishedAt?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  layoutVersion?: string;
  pvaVersion?: string;
  documentHash?: string;
  lastVerifiedAt: string;
  notes?: string;
};

/** Verification date for this catalog revision (repo, not “today of runtime”). */
const VERIFIED = "2026-07-14";

export const OFFICIAL_SOURCE_CATALOG: OfficialSourceRecord[] = [
  {
    id: "official:sped:portal",
    title: "Portal SPED (gov.br)",
    url: "https://www.gov.br/sped/pt-br",
    lastVerifiedAt: VERIFIED,
  },
  {
    id: "official:sped:rfb",
    title: "SPED Receita Federal (sped.rfb.gov.br)",
    url: "https://sped.rfb.gov.br/",
    lastVerifiedAt: VERIFIED,
  },
  {
    id: "official:sped:downloads",
    title: "Central de downloads SPED",
    url: "https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/download/sped",
    lastVerifiedAt: VERIFIED,
  },
  {
    id: "official:sped:efd-icms-ipi:hub",
    title: "EFD ICMS/IPI — assunto SPED",
    url: "https://www.gov.br/sped/pt-br/assuntos/escrituracoes-digitais/efd-icms-ipi",
    obligation: "efd-icms-ipi",
    lastVerifiedAt: VERIFIED,
  },
  {
    id: "official:sped:efd-icms-ipi:item-274",
    title: "EFD ICMS/IPI — item SPED 274",
    url: "https://sped.rfb.gov.br/item/show/274",
    obligation: "efd-icms-ipi",
    lastVerifiedAt: VERIFIED,
  },
  {
    id: "official:sped:efd-icms-ipi:item-1573",
    title: "EFD ICMS/IPI — item SPED 1573",
    url: "https://sped.rfb.gov.br/item/show/1573",
    obligation: "efd-icms-ipi",
    lastVerifiedAt: VERIFIED,
  },
  {
    id: "official:efd-icms-ipi:downloads",
    title: "Downloads EFD ICMS/IPI (RFB)",
    url: "https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/download/sped/efdi",
    obligation: "efd-icms-ipi",
    lastVerifiedAt: VERIFIED,
  },
  {
    id: "official:efd-icms-ipi:guia-3.2.2-local",
    title: "Guia Prático EFD ICMS/IPI 3.2.2 (cópia local verificada)",
    url: "https://www.gov.br/sped/pt-br/assuntos/escrituracoes-digitais/efd-icms-ipi/manuais-e-documentos-tecnicos/guia-pratico-da-efd-icms-ipi-3-2.2/@@display-file/file",
    obligation: "efd-icms-ipi",
    versionLabel: "3.2.2",
    publishedAt: "2026-02-11",
    effectiveFrom: "2026-01-01",
    effectiveTo: "2026-12-31",
    layoutVersion: "020",
    pvaVersion: "6.1.0",
    // SHA-256 do arquivo local docs/official-sources/A_01_guia-pratico-efd-icms-ipi_3.2.2.pdf (verificado 2026-07-18)
    documentHash: "49d940a5f7cb209f0ddc8be094ea2e753ed0e2b1219200f4a3266e9b6972d22f",
    lastVerifiedAt: "2026-07-18",
    notes: "Guia aplicável à competência 06/2026 (leiaute 020). Reconciliação em docs/EFD_LAYOUT_SOURCE_RECONCILIATION.md.",
  },
  {
    id: "official:efd-icms-ipi:guia-3.2.3-local",
    title: "Guia Prático EFD ICMS/IPI 3.2.3 (cópia local verificada)",
    url: "https://www.gov.br/sped/pt-br/assuntos/escrituracoes-digitais/efd-icms-ipi/manuais-e-documentos-tecnicos/guia-pratico-efd-versao-3-2-3.pdf/@@display-file/file",
    obligation: "efd-icms-ipi",
    versionLabel: "3.2.3",
    publishedAt: "2026-05-06",
    effectiveFrom: "2027-01-01",
    layoutVersion: "021",
    // SHA-256 do arquivo local docs/official-sources/A_02_guia-pratico-efd-icms-ipi_3.2.3-vigencia-2027.pdf (verificado 2026-07-18)
    documentHash: "bde603281ce8ad1e9f6f521a3df3ef825e6333497e30dfb9c01de8ecaa81c25b",
    lastVerifiedAt: "2026-07-18",
    notes: "Vigência a partir de 01/2027 — NÃO usar para competências de 2026.",
  },
  {
    id: "official:sped:efd-contribuicoes:hub",
    title: "EFD-Contribuições — assunto SPED",
    url: "https://www.gov.br/sped/pt-br/assuntos/escrituracoes-digitais/efd-contribuicoes",
    obligation: "efd-contribuicoes",
    lastVerifiedAt: VERIFIED,
  },
  {
    id: "official:sped:efd-contribuicoes:item-268",
    title: "EFD-Contribuições — item SPED 268",
    url: "https://sped.rfb.gov.br/item/show/268",
    obligation: "efd-contribuicoes",
    lastVerifiedAt: VERIFIED,
  },
  {
    id: "official:efd-contribuicoes:downloads",
    title: "Downloads EFD-Contribuições",
    url: "https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/download/sped/efdc",
    obligation: "efd-contribuicoes",
    lastVerifiedAt: VERIFIED,
  },
  {
    id: "official:efd-contribuicoes:nt-11-2026",
    title: "NT 11/2026 — descontinuidade EFD-Contribuições",
    url: "https://www.gov.br/sped/pt-br/assuntos/escrituracoes-digitais/efd-contribuicoes/documentos-tecnicos/nota-tecnica-11-2026-descontinuidade-da-efd-contribuicoes-orientacoes-para-os-contribuintes/@@display-file/file",
    obligation: "efd-contribuicoes",
    versionLabel: "NT-11-2026",
    lastVerifiedAt: VERIFIED,
    notes: "Transição 2027 — módulo histórico deve permanecer",
  },
  {
    id: "official:efd-contribuicoes:nt-12-2026",
    title: "NT 12/2026 — redução linear incentivos LC 224",
    url: "https://www.gov.br/sped/pt-br/assuntos/escrituracoes-digitais/efd-contribuicoes/documentos-tecnicos/nota-tecnica-12-2026-reducao-linear-de-incentivos-e-beneficios-lc-224/@@display-file/file",
    obligation: "efd-contribuicoes",
    versionLabel: "NT-12-2026",
    lastVerifiedAt: VERIFIED,
  },
  {
    id: "official:sped:ecd:hub",
    title: "ECD — assunto SPED",
    url: "https://www.gov.br/sped/pt-br/assuntos/escrituracoes-digitais/ecd",
    obligation: "ecd",
    lastVerifiedAt: VERIFIED,
  },
  {
    id: "official:sped:ecd:item-1569",
    title: "ECD — item SPED 1569",
    url: "https://sped.rfb.gov.br/item/show/1569",
    obligation: "ecd",
    lastVerifiedAt: VERIFIED,
  },
  {
    id: "official:ecd:downloads",
    title: "Downloads ECD",
    url: "https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/download/sped/ecd",
    obligation: "ecd",
    lastVerifiedAt: VERIFIED,
  },
  {
    id: "official:ecd:manual-layout-9-2026",
    title: "Manual de orientação ECD — leiaute 9 (jan/2026)",
    url: "https://www.gov.br/sped/pt-br/assuntos/escrituracoes-digitais/ecd/manuais-e-documentos-tecnicos/manual_de_orientacao_da_ecd_leiaute_9_janeiro_2026.pdf/@@display-file/file",
    obligation: "ecd",
    versionLabel: "layout-9-2026",
    lastVerifiedAt: VERIFIED,
  },
  {
    id: "official:sped:ecf:hub",
    title: "ECF — assunto SPED",
    url: "https://www.gov.br/sped/pt-br/assuntos/escrituracoes-digitais/ecf",
    obligation: "ecf",
    lastVerifiedAt: VERIFIED,
  },
  {
    id: "official:sped:ecf:item-1644",
    title: "ECF — item SPED 1644",
    url: "https://sped.rfb.gov.br/item/show/1644",
    obligation: "ecf",
    lastVerifiedAt: VERIFIED,
  },
  {
    id: "official:ecf:downloads",
    title: "Downloads ECF",
    url: "https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/download/sped/ecf",
    obligation: "ecf",
    lastVerifiedAt: VERIFIED,
  },
  {
    id: "official:ecf:manual-layout-12-2026",
    title: "Manual ECF leiaute 12 (20/05/2026)",
    url: "https://www.gov.br/sped/pt-br/assuntos/escrituracoes-digitais/ecf/manuais-e-documentos-tecnicos/manual_ecf_leiaute_12_20_05_2026_ac_2025_sit_esp_2026.pdf/@@display-file/file",
    obligation: "ecf",
    versionLabel: "layout-12-2026",
    lastVerifiedAt: VERIFIED,
  },
  {
    id: "official:ecf:tabelas-dinamicas-2026-05",
    title: "Tabelas dinâmicas e planos referenciais leiaute 12 (28/05/2026)",
    url: "https://www.gov.br/sped/pt-br/assuntos/escrituracoes-digitais/ecf/manuais-e-documentos-tecnicos/tabelas-dinamicas-e-planos-de-contas-referenciais-leiaute-12-atualizacao-28-05-2026",
    obligation: "ecf",
    lastVerifiedAt: VERIFIED,
    notes: "Importar como arquivos versionados — não hardcode listas grandes",
  },
  {
    id: "official:sped:efd-reinf:hub",
    title: "EFD-Reinf — item SPED 1196",
    url: "https://sped.rfb.gov.br/item/show/1196",
    obligation: "reinf",
    lastVerifiedAt: VERIFIED,
  },
  {
    id: "official:gov:efd-reinf:servico",
    title: "Serviço EFD-Reinf (gov.br)",
    url: "https://www.gov.br/pt-br/servicos/efd-reinf",
    obligation: "reinf",
    lastVerifiedAt: VERIFIED,
  },
  {
    id: "official:efd-reinf:manual-2.1.2.1",
    title: "Manual EFD-Reinf v2.1.2.1",
    url: "https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/manuais/sped/manuais-efd-reinf/manual-de-orientacao-do-usuario/manual-da-efd-reinf-versao-2-1-2-1.pdf/view",
    obligation: "reinf",
    versionLabel: "2.1.2.1",
    lastVerifiedAt: VERIFIED,
  },
  {
    id: "official:dctfweb:hub",
    title: "DCTFWeb — orientação RFB",
    url: "https://www.gov.br/receitafederal/pt-br/assuntos/orientacao-tributaria/declaracoes-e-demonstrativos/DCTFWeb",
    lastVerifiedAt: VERIFIED,
  },
  {
    id: "official:reforma:consumo-2026",
    title: "Reforma Tributária do Consumo — orientações 2026",
    url: "https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/programas-e-atividades/reforma-tributaria-do-consumo/orientacoes-2026",
    lastVerifiedAt: VERIFIED,
    notes: "CBS/IBS/IS — módulos RT separados; não misturar em EFD ICMS/IPI",
  },
  {
    id: "official:cnpj-alfanumerico",
    title: "CNPJ alfanumérico",
    url: "https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/programas-e-atividades/cnpj-alfanumerico",
    lastVerifiedAt: VERIFIED,
  },
];

export function getOfficialSource(id: string): OfficialSourceRecord | undefined {
  return OFFICIAL_SOURCE_CATALOG.find((s) => s.id === id);
}

export function listOfficialSourcesByObligation(obligation: string): OfficialSourceRecord[] {
  return OFFICIAL_SOURCE_CATALOG.filter((s) => s.obligation === obligation);
}
