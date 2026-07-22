/**
 * Pré-validador de campos obrigatórios da EFD ICMS/IPI.
 *
 * Verifica as definições versionadas de campo (EfdFieldDefinition) contra um
 * contexto de geração genérico, ANTES de produzir o TXT. O objetivo é evitar
 * rejeições repetidas no PVA por ausência de campos cadastrais obrigatórios
 * (ex.: COD_MUN, IE, CEP, END, BAIRRO).
 *
 * O verificador é deliberadamente leve: aceita um objeto de contexto simples
 * (não exige o BatchStore completo). Para registros derivados de documentos
 * (0150/0200/C100/C170/C190/E110/E116), o valor é lido do saco `raw` quando
 * fornecido; se o dado não está disponível no contexto, o campo é ignorado
 * (não reportado como ausente) — assim importações futuras não são rejeitadas
 * pela mesma classe de erro quando o dado simplesmente não foi inspecionado.
 *
 * Não executa nem redistribui o PVA oficial.
 */

import type { EfdFieldDefinition } from "@/modules/obligations/efd-icms-ipi/verification-types";

export const GP_EFD_322_SOURCE_ID = "GP_EFD_322";
export const EFD_LAYOUT_322 = "3.2.2";
export const EFD_SEED_PERIOD = "2026-06";
export const EFD_SEED_PROFILE = "A";

export interface EfdPrevalidationContext {
  // Cadastro do estabelecimento (Bloco 0 / Registro 0000-0005)
  companyName?: string;
  cnpj?: string;
  cpf?: string;
  uf?: string;
  ie?: string;
  codMun?: string;
  tradeName?: string;
  cep?: string;
  address?: string;
  addressNumber?: string;
  addressCompl?: string;
  neighborhood?: string;
  phone?: string;
  email?: string;
  // Período / parâmetros
  periodStart?: string; // YYYY-MM-DD
  periodEnd?: string; // YYYY-MM-DD
  profile?: "A" | "B" | "C";
  activityCode?: string; // IND_ATIV
  purpose?: "0" | "1"; // COD_FIN
  // Sinalizadores de presença de blocos (gating de registros derivados)
  hasParticipants?: boolean;
  hasItems?: boolean;
  hasDocuments?: boolean;
  hasNonElectronicDocuments?: boolean;
  icmsDue?: boolean;
  // Saco genérico para campos derivados de documentos/impostos (chave "REG.CAMPO")
  raw?: Record<string, string | undefined>;
}

export interface EfdMissingField {
  recordCode: string;
  fieldName: string;
  fieldNumber: number;
  reason: string;
}

export interface EfdPrevalidationOptions {
  layoutVersion?: string;
  period?: string; // YYYY-MM
  profile?: "A" | "B" | "C";
  uf?: string;
}

// ---- Construção das definições ------------------------------------------------

type DefSeed = {
  recordCode: string;
  fieldNumber: number;
  fieldName: string;
  type: string;
  requiredRule: string;
  maxLength?: number;
  decimalScale?: number;
};

function seed(defs: DefSeed[]): EfdFieldDefinition[] {
  return defs.map((d) => ({
    layoutVersion: EFD_LAYOUT_322,
    officialSourceId: GP_EFD_322_SOURCE_ID,
    effectiveFrom: EFD_SEED_PERIOD,
    ...d,
  }));
}

export const EFD_FIELD_DEFINITIONS: EfdFieldDefinition[] = [
  // Registro 0000 — abertura do arquivo (Guia Prático 3.2.2)
  ...seed([
    { recordCode: "0000", fieldNumber: 2, fieldName: "COD_VER", type: "string", requiredRule: "required_always", maxLength: 3 },
    { recordCode: "0000", fieldNumber: 3, fieldName: "COD_FIN", type: "string", requiredRule: "required_always", maxLength: 1 },
    { recordCode: "0000", fieldNumber: 4, fieldName: "DT_INI", type: "date", requiredRule: "required_always" },
    { recordCode: "0000", fieldNumber: 5, fieldName: "DT_FIN", type: "date", requiredRule: "required_always" },
    { recordCode: "0000", fieldNumber: 6, fieldName: "NOME", type: "string", requiredRule: "required_always", maxLength: 100 },
    { recordCode: "0000", fieldNumber: 7, fieldName: "CNPJ", type: "string", requiredRule: "required_always", maxLength: 14 },
    { recordCode: "0000", fieldNumber: 8, fieldName: "CPF", type: "string", requiredRule: "required_when:CNPJ_ABSENT", maxLength: 11 },
    { recordCode: "0000", fieldNumber: 9, fieldName: "UF", type: "string", requiredRule: "required_always", maxLength: 2 },
    { recordCode: "0000", fieldNumber: 10, fieldName: "IE", type: "string", requiredRule: "required_always", maxLength: 14 },
    { recordCode: "0000", fieldNumber: 11, fieldName: "COD_MUN", type: "string", requiredRule: "required_always", maxLength: 7 },
    { recordCode: "0000", fieldNumber: 14, fieldName: "IND_PERFIL", type: "string", requiredRule: "required_for_profile:A", maxLength: 1 },
    { recordCode: "0000", fieldNumber: 15, fieldName: "IND_ATIV", type: "string", requiredRule: "required_always", maxLength: 1 },
  ]),
  // Registro 0005 — dados complementares do contribuinte
  ...seed([
    { recordCode: "0005", fieldNumber: 4, fieldName: "CEP", type: "string", requiredRule: "required_always", maxLength: 8 },
    { recordCode: "0005", fieldNumber: 5, fieldName: "END", type: "string", requiredRule: "required_always", maxLength: 60 },
    { recordCode: "0005", fieldNumber: 6, fieldName: "NUM", type: "string", requiredRule: "required_always", maxLength: 10 },
    { recordCode: "0005", fieldNumber: 7, fieldName: "COMPL", type: "string", requiredRule: "required_when:COMPL_PRESENT", maxLength: 60 },
    { recordCode: "0005", fieldNumber: 8, fieldName: "BAIRRO", type: "string", requiredRule: "required_always", maxLength: 60 },
    { recordCode: "0005", fieldNumber: 9, fieldName: "FONE", type: "string", requiredRule: "required_always", maxLength: 11 },
    { recordCode: "0005", fieldNumber: 11, fieldName: "EMAIL", type: "string", requiredRule: "required_always", maxLength: 255 },
  ]),
  // Registro 0150 — tabela de participantes (derivado dos documentos)
  ...seed([
    { recordCode: "0150", fieldNumber: 3, fieldName: "COD_PART", type: "string", requiredRule: "required_when:HAS_PARTICIPANTS", maxLength: 60 },
    { recordCode: "0150", fieldNumber: 4, fieldName: "NOME", type: "string", requiredRule: "required_when:HAS_PARTICIPANTS", maxLength: 100 },
    { recordCode: "0150", fieldNumber: 5, fieldName: "COD_PAIS", type: "string", requiredRule: "required_when:HAS_PARTICIPANTS", maxLength: 4 },
    { recordCode: "0150", fieldNumber: 6, fieldName: "CNPJ", type: "string", requiredRule: "required_when:CNPJ_PARTICIPANT", maxLength: 14 },
    { recordCode: "0150", fieldNumber: 7, fieldName: "CPF", type: "string", requiredRule: "required_when:CPF_PARTICIPANT", maxLength: 11 },
    { recordCode: "0150", fieldNumber: 9, fieldName: "COD_MUN", type: "string", requiredRule: "required_when:HAS_PARTICIPANTS", maxLength: 7 },
  ]),
  // Registro 0200 — tabela de itens (derivado dos documentos)
  ...seed([
    { recordCode: "0200", fieldNumber: 2, fieldName: "COD_ITEM", type: "string", requiredRule: "required_when:HAS_ITEMS", maxLength: 60 },
    { recordCode: "0200", fieldNumber: 3, fieldName: "DESCR_ITEM", type: "string", requiredRule: "required_when:HAS_ITEMS", maxLength: 255 },
    { recordCode: "0200", fieldNumber: 6, fieldName: "UNID_INV", type: "string", requiredRule: "required_when:HAS_ITEMS", maxLength: 6 },
  ]),
  // Registro C100 — documento fiscal (derivado dos documentos)
  ...seed([
    { recordCode: "C100", fieldNumber: 2, fieldName: "IND_OPER", type: "string", requiredRule: "required_when:HAS_DOCUMENTS", maxLength: 1 },
    { recordCode: "C100", fieldNumber: 3, fieldName: "IND_EMIT", type: "string", requiredRule: "required_when:HAS_DOCUMENTS", maxLength: 1 },
    { recordCode: "C100", fieldNumber: 4, fieldName: "COD_PART", type: "string", requiredRule: "required_when:HAS_DOCUMENTS", maxLength: 60 },
    { recordCode: "C100", fieldNumber: 5, fieldName: "COD_MOD", type: "string", requiredRule: "required_when:HAS_DOCUMENTS", maxLength: 2 },
    { recordCode: "C100", fieldNumber: 6, fieldName: "COD_SIT", type: "string", requiredRule: "required_when:HAS_DOCUMENTS", maxLength: 2 },
  ]),
  // Registro C170 — apenas NF modelo não eletrônico (facultativo p/ eletrônico)
  ...seed([
    { recordCode: "C170", fieldNumber: 2, fieldName: "NUM_ITEM", type: "string", requiredRule: "required_when:NON_ELECTRONIC", maxLength: 3 },
    { recordCode: "C170", fieldNumber: 3, fieldName: "COD_ITEM", type: "string", requiredRule: "required_when:NON_ELECTRONIC", maxLength: 60 },
    { recordCode: "C170", fieldNumber: 4, fieldName: "DESCR_COMPL", type: "string", requiredRule: "required_when:NON_ELECTRONIC", maxLength: 255 },
    { recordCode: "C170", fieldNumber: 11, fieldName: "CST_ICMS", type: "string", requiredRule: "required_when:NON_ELECTRONIC", maxLength: 3 },
    { recordCode: "C170", fieldNumber: 12, fieldName: "CFOP", type: "string", requiredRule: "required_when:NON_ELECTRONIC", maxLength: 4 },
  ]),
  // Registro C190 — consolidação por CST/CFOP (derivado dos documentos)
  ...seed([
    { recordCode: "C190", fieldNumber: 2, fieldName: "CST_ICMS", type: "string", requiredRule: "required_when:HAS_DOCUMENTS", maxLength: 3 },
    { recordCode: "C190", fieldNumber: 3, fieldName: "CFOP", type: "string", requiredRule: "required_when:HAS_DOCUMENTS", maxLength: 4 },
  ]),
  // Bloco E — obrigatório
  ...seed([
    { recordCode: "E100", fieldNumber: 2, fieldName: "DT_INI", type: "date", requiredRule: "required_always" },
    { recordCode: "E100", fieldNumber: 3, fieldName: "DT_FIN", type: "date", requiredRule: "required_always" },
    { recordCode: "E110", fieldNumber: 2, fieldName: "VL_TOT_DEBITOS", type: "numeric", requiredRule: "required_always", decimalScale: 2 },
    { recordCode: "E110", fieldNumber: 6, fieldName: "VL_TOT_CREDITOS", type: "numeric", requiredRule: "required_always", decimalScale: 2 },
    { recordCode: "E110", fieldNumber: 11, fieldName: "VL_SLD_CREDOR_ANT", type: "numeric", requiredRule: "required_always", decimalScale: 2 },
    { recordCode: "E116", fieldNumber: 2, fieldName: "COD_OR", type: "string", requiredRule: "required_when:ICMS_DUE", maxLength: 3 },
    { recordCode: "E116", fieldNumber: 3, fieldName: "VL_OR", type: "numeric", requiredRule: "required_when:ICMS_DUE", decimalScale: 2 },
    { recordCode: "E116", fieldNumber: 5, fieldName: "COD_REC", type: "string", requiredRule: "required_when:ICMS_DUE", maxLength: 60 },
  ]),
  // Registro 9999 — encerramento
  ...seed([
    { recordCode: "9999", fieldNumber: 2, fieldName: "QTD_LIN", type: "numeric", requiredRule: "required_always" },
  ]),
];

// ---- Avaliação de regras ------------------------------------------------------

function ruleApplies(rule: string, ctx: EfdPrevalidationContext): boolean {
  if (rule === "required_always") return true;
  if (rule.startsWith("required_for_profile:")) {
    const p = rule.split(":")[1];
    return ctx.profile === p;
  }
  if (rule.startsWith("required_when:")) {
    const cond = rule.split(":")[1];
    switch (cond) {
      case "ICMS_DUE":
        return Boolean(ctx.icmsDue);
      case "NON_ELECTRONIC":
        return Boolean(ctx.hasNonElectronicDocuments);
      case "HAS_PARTICIPANTS":
        return Boolean(ctx.hasParticipants);
      case "HAS_ITEMS":
        return Boolean(ctx.hasItems);
      case "HAS_DOCUMENTS":
        return Boolean(ctx.hasDocuments);
      case "CNPJ_PARTICIPANT":
        return Boolean(ctx.hasParticipants);
      case "CPF_PARTICIPANT":
        return Boolean(ctx.hasParticipants);
      case "CNPJ_ABSENT":
        return !ctx.cnpj;
      case "COMPL_PRESENT":
        return ctx.addressCompl != null;
      default:
        return false;
    }
  }
  return false;
}

interface Resolved {
  present: boolean;
  value?: string;
}

function resolveValue(def: EfdFieldDefinition, ctx: EfdPrevalidationContext): Resolved {
  const r = def.recordCode;
  const f = def.fieldName;

  // Campos diretos do cadastro (sempre passíveis de avaliação)
  if (r === "0000") {
    const map: Record<string, string | undefined> = {
      COD_FIN: ctx.purpose,
      DT_INI: ctx.periodStart,
      DT_FIN: ctx.periodEnd,
      NOME: ctx.companyName,
      CNPJ: ctx.cnpj,
      CPF: ctx.cpf,
      UF: ctx.uf,
      IE: ctx.ie,
      COD_MUN: ctx.codMun,
      IND_PERFIL: ctx.profile,
      IND_ATIV: ctx.activityCode,
    };
    const v = map[f];
    return { present: true, value: v };
  }
  if (r === "0005") {
    const map: Record<string, string | undefined> = {
      CEP: ctx.cep,
      END: ctx.address,
      NUM: ctx.addressNumber,
      COMPL: ctx.addressCompl ?? undefined,
      BAIRRO: ctx.neighborhood,
      FONE: ctx.phone,
      EMAIL: ctx.email,
    };
    const v = map[f];
    return { present: true, value: v };
  }
  if (r === "E100" && (f === "DT_INI" || f === "DT_FIN")) {
    return {
      present: true,
      value: f === "DT_INI" ? ctx.periodStart : ctx.periodEnd,
    };
  }

  // Campos derivados de documentos/impostos: lidos do saco raw quando fornecido.
  const key = `${r}.${f}`;
  if (ctx.raw && key in ctx.raw) {
    return { present: true, value: ctx.raw[key] };
  }
  return { present: false };
}

function withinPeriod(def: EfdFieldDefinition, period?: string): boolean {
  if (!period) return true;
  if (def.effectiveFrom > period) return false;
  if (def.effectiveTo && def.effectiveTo < period) return false;
  return true;
}

/**
 * Verifica as definições de campo obrigatório contra o contexto de geração.
 * Retorna a lista de campos obrigatórios AUSENTES (não preenchidos).
 */
export function validateRequiredEfdFields(
  ctx: EfdPrevalidationContext,
  opts: EfdPrevalidationOptions = {},
): EfdMissingField[] {
  const missing: EfdMissingField[] = [];
  for (const def of EFD_FIELD_DEFINITIONS) {
    if (opts.layoutVersion && def.layoutVersion !== opts.layoutVersion) continue;
    if (!withinPeriod(def, opts.period)) continue;
    if (opts.profile && def.requiredRule.startsWith("required_for_profile:") &&
      def.requiredRule !== `required_for_profile:${opts.profile}`) {
      continue;
    }
    if (!ruleApplies(def.requiredRule, ctx)) continue;
    const { present, value } = resolveValue(def, ctx);
    if (!present) continue; // dado não inspecionado neste contexto — não rejeitar
    if (value == null || value.toString().trim() === "") {
      missing.push({
        recordCode: def.recordCode,
        fieldName: def.fieldName,
        fieldNumber: def.fieldNumber,
        reason: def.requiredRule,
      });
    }
  }
  return missing;
}

// ---- Registro de fonte oficial (stub) ----------------------------------------

export interface OfficialSourceRegistryEntry {
  id: string;
  code: string;
  title: string;
  version: string;
  publishedDate: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  sourceUrl: string;
  pdfHash: string | null;
  queriedAt: string | null;
}

const GP_EFD_322_REGISTRY: OfficialSourceRegistryEntry = {
  id: GP_EFD_322_SOURCE_ID,
  code: "GP_EFD_322",
  title: "Guia Prático da EFD ICMS/IPI — Versão 3.2.2",
  version: EFD_LAYOUT_322,
  publishedDate: null,
  effectiveFrom: EFD_SEED_PERIOD,
  effectiveTo: null,
  sourceUrl: "https://www.gov.br/receitafederal/pt-br/assuntos/auditoria-e-fiscalizacao/auditoria/estudos-e-manuais/guia-pratico-efd-icms-ipi",
  pdfHash: null,
  queriedAt: null,
};

/**
 * Retorna os metadados da fonte oficial GP_EFD_322.
 * Stub: a consulta à fonte oficial (URL/hash) ainda não está implementada —
 * os metadados são mantidos localmente até a fonte ser registrada.
 */
export function getOfficialSourceRegistry(): OfficialSourceRegistryEntry {
  return { ...GP_EFD_322_REGISTRY, queriedAt: new Date().toISOString() };
}
