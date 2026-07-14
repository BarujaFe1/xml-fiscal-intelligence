import type { ObligationId } from "@/modules/obligations/core/registry/ids";
import type { ObligationSupportProfile } from "@/modules/obligations/core/maturity";

/**
 * Honest maturity — none are production. Never claim validated_scope without PVA evidence.
 */
export const OBLIGATION_SUPPORT_PROFILES: Record<ObligationId, ObligationSupportProfile> = {
  "efd-icms-ipi": {
    id: "efd-icms-ipi",
    maturity: "internal_beta",
    supportedCompetencies: ["mensal (perfil A/B/C assistido)"],
    supportedRegimes: ["contribuinte ICMS com XML NF-e/NFC-e no lote"],
    supportedEstablishments: ["único por geração (form + cadastro local)"],
    supportedBlocksOrEvents: [
      "0 (0000/0001/0005/0100/0150/0190/0200/0400)",
      "C (C100/C190; C170 omitido eletrônico; COD_SIT cancel)",
      "E (E100/E110 com saldo anterior manual; E116)",
      "9 (fechamento)",
      "UF plugins (esqueleto; SP sem seed de COD_REC)",
      "auditoria XML×EFD (chaves/totais)",
    ],
    officialProgram: "pva_efd_icms_ipi",
    officialProgramVersion: "PVA 6.0.9+ (registro manual; homologationGrade exige contentHash)",
    limitations: [
      "Rascunho assistido — não é arquivo oficial da RFB",
      "Bloco G/H/K e tabelas estaduais incompletos (Fase 2b)",
      "Homologação PVA por cenário ainda vazia — sem validated_scope",
      "CBS/IBS/IS fora do escopo desta obrigação",
      "Pronto para official_validator_beta quando houver 1ª evidência PVA com hash",
    ],
    unsupported: [
      "transmissão",
      "assinatura digital no produto",
      "CIAP completo",
      "inventário H completo",
      "produção/estoque K completo",
      "energia/comunicação específicos sem XML correspondente",
      "validated_scope sem evidência PVA",
    ],
    sourceIds: [
      "official:sped:portal",
      "official:sped:efd-icms-ipi:hub",
      "official:efd-icms-ipi:guia-3.2.3-local",
    ],
  },
  "efd-contribuicoes": {
    id: "efd-contribuicoes",
    maturity: "internal_beta",
    supportedCompetencies: ["mensal (domínio + XML opcional)"],
    supportedRegimes: [
      "non_cumulative",
      "cumulative",
      "cprb",
      "mixed — com sourceId",
    ],
    supportedEstablishments: ["único por geração"],
    supportedBlocksOrEvents: [
      "Domínio: receita/aquisição/crédito/débito/retenção/ajuste/CPRB",
      "0110 tipificado por regime",
      "A100/A170 opcional a partir de XML",
      "Bloco M (M100/M200/M500/…) a partir do domínio + rateio",
      "Modos current_fact_generation | historical_and_credit_management",
      "NTs 11/12/2026 catalogadas (activated=false)",
      "Conciliação DCTFWeb/MIT (CSV import)",
      "Simulador com/sem crédito (FEATURE_CONTRIB_SIMULATOR)",
    ],
    officialProgram: "pge_efd_contribuicoes",
    limitations: [
      "COD_CRED e alíquotas não inventados — conferir PGE",
      "rule_set_versions não auto-ativadas",
      "Sem evidência PGE ainda → sem validated_scope",
    ],
    unsupported: [
      "Soma silenciosa A170→M100",
      "crédito sem creditExplicit",
      "apagar módulo histórico pós-NT 11/2026",
      "claim substitui PGE",
      "validated_scope / production sem matriz por cenário",
    ],
    sourceIds: [
      "official:sped:efd-contribuicoes:hub",
      "official:efd-contribuicoes:nt-11-2026",
      "official:efd-contribuicoes:nt-12-2026",
    ],
  },
  ecd: {
    id: "ecd",
    maturity: "development",
    supportedCompetencies: ["anual (ledger ou DEMO explícito)"],
    supportedRegimes: ["n/a — exige ledger real no modo oficial"],
    supportedEstablishments: ["único"],
    supportedBlocksOrEvents: [
      "I050/I200/I250/I155 a partir do motor contábil",
      "Modo DEMO só com extras.ecdMode=demo",
      "Import CSV plano/lançamentos · ECD prior I050",
      "Diário / balancete / razão",
    ],
    officialProgram: "programa_ecd",
    limitations: [
      "XSD/layout draft — conferir Programa ECD",
      "BP/DRE apenas agregados por natureza (metodologia documentada)",
      "Sem assinatura digital no produto",
    ],
    unsupported: [
      "I200 derivado de NF-e",
      "modo oficial com contas DEMO",
      "validated_scope sem evidência Programa ECD",
    ],
    sourceIds: ["official:sped:ecd:hub", "official:ecd:manual-layout-9-2026"],
  },
  ecf: {
    id: "ecf",
    maturity: "development",
    supportedCompetencies: ["anual (ledger + mapper)"],
    supportedRegimes: ["lucro real estrutural — IRPJ gated"],
    supportedEstablishments: ["único"],
    supportedBlocksOrEvents: [
      "Recuperação ECD ledger + prior ECF canônico",
      "Mapper conta×referencial (confirmação humana)",
      "Tabelas dinâmicas versionadas (CSV import)",
      "e-Lalur Parte A/B + diff",
      "J050/L030 assistidos; IRPJ só com FEATURE_ECF_IRPJ_ENGINE",
    ],
    officialProgram: "programa_ecf",
    limitations: [
      "XSD/layout draft — conferir Programa ECF",
      "Sem assinatura digital no produto",
      "IRPJ/CSLL default off",
    ],
    unsupported: [
      "IRPJ/CSLL a partir de NF-e",
      "modo oficial sem ledger / com contas DEMO",
      "mapas órfãos em geração oficial",
      "validated_scope sem evidência Programa ECF",
    ],
    sourceIds: [
      "official:sped:ecf:hub",
      "official:ecf:manual-layout-12-2026",
      "official:ecf:tabelas-dinamicas-2026-05",
    ],
  },
  reinf: {
    id: "reinf",
    maturity: "development",
    supportedCompetencies: ["mensal (eventos draft)"],
    supportedRegimes: ["não tipificado"],
    supportedEstablishments: ["único"],
    supportedBlocksOrEvents: [
      "Catálogo 2026.1-draft (R-1000, R-2010 candidato, R-2099, R-9000)",
      "Lifecycle local draft→…→accepted",
      "XML canônico draft + hash",
      "Assinatura stub agente local",
      "WS submit dry-run (FEATURE_REINF_SUBMIT off)",
      "DCTFWeb reconciliação por CSV import",
    ],
    officialProgram: "efd_reinf_ambiente",
    officialProgramVersion: "ambiente restrição (sem envio real nesta fase)",
    limitations: [
      "Namespace/XSD draft — não transmitir sem schema oficial",
      "Submit HTTP oficial não acoplado",
      "PFX nunca no browser",
      "R-2020/R-4010 não implemented",
    ],
    unsupported: [
      "transmissão produção",
      "login DCTFWeb",
      "paridade eSocial",
      "validated_scope sem evidência ambiente restrito",
    ],
    sourceIds: [
      "official:sped:efd-reinf:hub",
      "official:efd-reinf:manual-2.1.2.1",
      "official:gov:efd-reinf:servico",
    ],
  },
};

export function getSupportProfile(id: ObligationId): ObligationSupportProfile {
  return OBLIGATION_SUPPORT_PROFILES[id];
}
