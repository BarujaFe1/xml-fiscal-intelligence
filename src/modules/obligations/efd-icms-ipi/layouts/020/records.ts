import { inferFieldType, type SpedFieldDefinition, type SpedRecordDefinition } from "./field-definition";

/**
 * Definições de registros do leiaute 020 (Guia Prático 3.2.2 / NT 2025.001).
 * Contagens de campo conferidas contra a saída validada do gerador.
 * Nomes omitidos usam `f{n}`; a contagem (length) é o que o validador rigoroso confere.
 */

function build(
  code: string,
  level: number,
  names: string[],
  opts?: {
    parent?: string;
    allowed?: Record<number, readonly string[]>;
  },
): SpedRecordDefinition {
  const fields: SpedFieldDefinition[] = names.map((name, i) => {
    const pos = i + 1;
    const def: SpedFieldDefinition = {
      position: pos,
      name,
      type: inferFieldType(name),
      required: pos === 1, // REG obrigatório
    };
    const allowed = opts?.allowed?.[pos];
    if (allowed) def.allowedValues = allowed;
    return def;
  });
  return { code, level, parent: opts?.parent, fields };
}

const IND_MOV = ["0", "1"];
const IND_01 = ["0", "1"];

export const RECORDS: Record<string, SpedRecordDefinition> = {
  "0000": build("0000", 0, [
    "REG", "COD_VER", "COD_FIN", "DT_INI", "DT_FIM", "NOME", "CNPJ", "CPF", "UF", "IE",
    "COD_MUN", "IM", "SUFRAMA", "IND_PERFIL", "IND_ATIV",
  ], { allowed: { 2: ["020"], 3: ["0", "1"], 14: ["A", "B", "C"], 15: ["0", "1"] } }),
  "0001": build("0001", 1, ["REG", "IND_MOV"], { allowed: { 2: IND_MOV } }),
  "0002": build("0002", 1, ["REG", "CLAS_ESTAB_IND"]),
  "0005": build("0005", 1, [
    "REG", "NOME", "CEP", "END", "NUM", "COMPL", "BAIRRO", "FONE", "FAX", "EMAIL",
  ]),
  "0100": build("0100", 1, [
    "REG", "NOME", "CPF", "CRC", "CNPJ", "CEP", "END", "NUM", "COMPL", "BAIRRO",
    "FONE", "FAX", "EMAIL", "COD_MUN",
  ]),
  "0150": build("0150", 2, [
    "REG", "COD_PART", "NOME", "COD_PAIS", "CNPJ", "CPF", "IE", "COD_MUN",
    "SUFRAMA", "END", "NUM", "COMPL", "BAIRRO",
  ]),
  "0190": build("0190", 2, ["REG", "IDENT_CTA", "COD_CTA"]),
  "0200": build("0200", 2, [
    "REG", "COD_ITEM", "DESCR_ITEM", "COD_BARRA", "COD_ANT_ITEM", "UNID",
    "TIPO_ITEM", "COD_NCM", "EX_IPI", "COD_GEN", "COD_LST", "ALIQ_ICMS", "CEST",
  ]),
  "0400": build("0400", 2, ["REG", "COD_NAT", "DESCR_NAT"]),
  "0990": build("0990", 1, ["REG", "QTD_LIN"]),

  B001: build("B001", 1, ["REG", "IND_MOV"], { allowed: { 2: IND_MOV } }),
  B990: build("B990", 1, ["REG", "QTD_LIN"]),

  C001: build("C001", 1, ["REG", "IND_MOV"], { allowed: { 2: IND_MOV } }),
  C100: build("C100", 2, [
    "REG", "IND_OPER", "IND_EMIT", "COD_PART", "COD_MOD", "COD_SIT", "SER", "NUM_DOC",
    "CHV_NFE", "DT_DOC", "DT_E_S", "VL_DOC", "IND_PGTO", "VL_DESC", "VL_ABAT_NT",
    "VL_MERC", "IND_FRT", "VL_SEG", "VL_OUT_DA", "VL_BC_ICMS", "VL_ICMS",
    "VL_BC_ICMS_ST", "VL_ICMS_ST", "VL_IPI", "VL_PIS", "VL_COFINS", "VL_PIS_ST",
    "VL_COFINS_ST", "FRETE_OUTRAS",
  ], { allowed: { 2: IND_01, 3: IND_01, 13: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"] } }),
  C170: build("C170", 3, [
    "REG", "NUM_ITEM", "COD_ITEM", "DESCR_COMPL", "QTD", "UNID", "VL_ITEM", "VL_DESC",
    "IND_MOV", "CST_ICMS", "CFOP", "COD_NAT", "VL_BC_ICMS", "ALIQ_ICMS", "VL_ICMS",
    "VL_BC_ICMS_ST", "ALIQ_ST", "VL_ICMS_ST", "IND_APUR", "CST_IPI", "COD_ENQ",
    "VL_BC_IPI", "ALIQ_IPI", "VL_IPI", "CST_PIS", "VL_BC_PIS", "ALIQ_PIS",
    "QUANT_BC_PIS", "ALIQ_PIS_QUANT", "VL_PIS", "CST_COFINS", "VL_BC_COFINS", "ALIQ_COFINS",
    "QUANT_BC_COFINS", "ALIQ_COFINS_QUANT", "VL_COFINS", "COD_CTA", "VL_ABAT_NT",
  ], { allowed: { 9: IND_MOV, 19: IND_01 } }),
  C190: build("C190", 3, [
    "REG", "CST_ICMS", "CFOP", "ALIQ_ICMS", "VL_OPR", "VL_BC_ICMS",
    "VL_ICMS", "VL_BC_ICMS_ST", "VL_ICMS_ST", "VL_RED_BC", "VL_IPI", "COD_OBS",
  ]),
  C990: build("C990", 1, ["REG", "QTD_LIN"]),

  D001: build("D001", 1, ["REG", "IND_MOV"], { allowed: { 2: IND_MOV } }),
  D990: build("D990", 1, ["REG", "QTD_LIN"]),

  E001: build("E001", 1, ["REG", "IND_MOV"], { allowed: { 2: IND_MOV } }),
  E100: build("E100", 2, ["REG", "DT_INI", "DT_FIM"]),
  E110: build("E110", 2, [
    "REG", "VL_TOT_DEBITOS", "VL_AJ_DEBITOS", "VL_TOT_AJ_DEBITOS", "VL_ESTORNOS_CRED",
    "VL_TOT_CREDITOS", "VL_AJ_CREDITOS", "VL_TOT_AJ_CREDITOS", "VL_ESTORNOS_DEB",
    "VL_SLD_CREDOR_ANT", "VL_SLD_APURADO", "VL_TOT_DED", "VL_ICMS_RECOLHER",
    "VL_SLD_CREDOR_TRANSPORTAR", "DEB_ESP", "VL_SLD_CREDOR_ANT_FUT",
  ]),
  E116: build("E116", 2, [
    "REG", "COD_OR", "VL_OR", "DT_VCTO", "COD_REC", "NUM_PROC", "IND_PROC", "PROC",
    "TXT_COMPL", "MES_REF",
  ], { allowed: { 8: ["0", "1", "2", "3"] } }),
  E500: build("E500", 2, ["REG", "IND_APUR", "DT_INI", "DT_FIM"], {
    allowed: { 2: IND_01 },
  }),
  E520: build("E520", 2, [
    "REG", "VL_IPI_DEBITOS", "VL_IPI", "VL_IPI_CREDITOS", "VL_IPI_ESTORNOS",
    "VL_IPI_RES", "VL_IPI_OUTRAS", "VL_IPI_COMPLEMENTAR",
  ]),
  E990: build("E990", 1, ["REG", "QTD_LIN"]),

  G001: build("G001", 1, ["REG", "IND_MOV"], { allowed: { 2: IND_MOV } }),
  G990: build("G990", 1, ["REG", "QTD_LIN"]),

  H001: build("H001", 1, ["REG", "IND_MOV"], { allowed: { 2: IND_MOV } }),
  H990: build("H990", 1, ["REG", "QTD_LIN"]),

  K001: build("K001", 1, ["REG", "IND_MOV"], { allowed: { 2: IND_MOV } }),
  K990: build("K990", 1, ["REG", "QTD_LIN"]),

  "1001": build("1001", 1, ["REG", "IND_MOV"], { allowed: { 2: IND_MOV } }),
  "1010": build("1010", 2, [
    "REG", "IND_APUR_ICMS", "IND_APUR_IPI", "IND_APUR_PIS", "IND_APUR_COFINS",
    "f6", "f7", "f8", "f9", "f10", "f11", "f12", "f13", "f14",
  ]),
  "1990": build("1990", 1, ["REG", "QTD_LIN"]),

  "9001": build("9001", 1, ["REG", "QTD_LIN"]),
  "9900": build("9900", 1, ["REG", "REG_BLC", "QTD_REG_BLC"]),
  "9990": build("9990", 1, ["REG", "QTD_LIN"]),
  "9999": build("9999", 1, ["REG", "QTD_LIN"]),
};

export function getRecordDef(code: string): SpedRecordDefinition | undefined {
  return RECORDS[code];
}

/** Ordem canônica dos abridores de bloco (usada para checar hierarquia). */
export const BLOCK_ORDER = [
  "0000", "B001", "C001", "D001", "E001", "G001", "H001", "K001", "1001", "9001",
] as const;

/** Letra do bloco ao qual um registro pertence (para contadores de fechamento). */
export function blockOf(code: string): string {
  if (code === "0000" || code === "0001" || code === "0002" || code === "0005" ||
      code === "0100" || code === "0150" || code === "0190" || code === "0200" ||
      code === "0400" || code === "0990" || code === "0980") return "0";
  if (code.startsWith("1")) return "1";
  return code[0] ?? "0";
}
