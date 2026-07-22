import type { ExportAggregation, ExportFieldDefinition, ExportFieldPreset } from "@/lib/export/fields/types";

/**
 * Exact mapping of the 13 default export columns (order preserved).
 * DOCUMENTO = ide/nNF (documented product decision).
 * CCASSTRIB label ↔ XML tag cClassTrib.
 * VALOR CBS / IBS use exact total paths only — never auto-sum monophase/retained.
 */
export const DEFAULT_FIELD_SPECS: Array<{
  fieldId: string;
  header: string;
  xmlPaths: string[];
  aggregation: ExportAggregation;
  scope: string;
  note: string;
}> = [
  {
    fieldId: "access_key",
    header: "CHAVE DE ACESSO",
    xmlPaths: ["protNFe.infProt.chNFe", "infProt.chNFe", "chNFe"],
    aggregation: "first_non_empty",
    scope: "documento",
    note: "Prefer chNFe; fallback Id strip NFe prefix",
  },
  {
    fieldId: "document_number",
    header: "DOCUMENTO",
    xmlPaths: ["ide.nNF", "nNF"],
    aggregation: "first",
    scope: "documento",
    note: "DOCUMENTO means nNF (invoice number)",
  },
  {
    fieldId: "emitter_cpf",
    header: "CPF EMITENTE",
    xmlPaths: ["emit.CPF", "CPF"],
    aggregation: "first",
    scope: "emitente",
    note: "Empty when PJ",
  },
  {
    fieldId: "emitter_cnpj",
    header: "CNPJ EMITENTE",
    xmlPaths: ["emit.CNPJ", "CNPJ"],
    aggregation: "first",
    scope: "emitente",
    note: "Text; alphanumeric CNPJ supported",
  },
  {
    fieldId: "issue_datetime",
    header: "DATA DE EMISSÃO",
    xmlPaths: ["ide.dhEmi", "ide.dEmi", "dhEmi", "dEmi"],
    aggregation: "first_non_empty",
    scope: "documento",
    note: "Preserve timezone",
  },
  {
    fieldId: "invoice_installments_total",
    header: "VALOR DUPLIC",
    xmlPaths: ["cobr.dup.vDup", "dup.vDup", "vDup"],
    aggregation: "decimal_sum",
    scope: "cobranca",
    note: "Sum of installment values only",
  },
  {
    fieldId: "emitter_name",
    header: "NOME EMITENTE",
    xmlPaths: ["emit.xNome", "xNome"],
    aggregation: "first",
    scope: "emitente",
    note: "Decode XML entities once",
  },
  {
    fieldId: "receiver_cpf",
    header: "CPF DESTINO",
    xmlPaths: ["dest.CPF"],
    aggregation: "first",
    scope: "destinatario",
    note: "Empty when PJ",
  },
  {
    fieldId: "receiver_cnpj",
    header: "CNPJ DESTINO",
    xmlPaths: ["dest.CNPJ"],
    aggregation: "first",
    scope: "destinatario",
    note: "Text; alphanumeric CNPJ supported",
  },
  {
    fieldId: "receiver_name",
    header: "NOME DESTINO",
    xmlPaths: ["dest.xNome"],
    aggregation: "first",
    scope: "destinatario",
    note: "Decode XML entities once",
  },
  {
    fieldId: "cbs_total",
    header: "VALOR CBS",
    xmlPaths: [
      "total.IBSCBSTot.gCBS.vCBS",
      "IBSCBSTot.gCBS.vCBS",
      "gCBS.vCBS",
    ],
    aggregation: "first_exact_path",
    scope: "totais",
    note: "Exact path total/IBSCBSTot/gCBS/vCBS only",
  },
  {
    fieldId: "ibs_total",
    header: "VALOR IBS",
    xmlPaths: [
      "total.IBSCBSTot.gIBS.vIBS",
      "IBSCBSTot.gIBS.vIBS",
      "gIBS.vIBS",
    ],
    aggregation: "first_exact_path",
    scope: "totais",
    note: "Exact path total/IBSCBSTot/gIBS/vIBS only",
  },
  {
    fieldId: "cclass_trib",
    header: "CCASSTRIB",
    xmlPaths: [
      "det.imposto.IBSCBS.cClassTrib",
      "imposto.IBSCBS.cClassTrib",
      "IBSCBS.cClassTrib",
      "cClassTrib",
    ],
    aggregation: "distinct_list",
    scope: "item",
    note: "Label CCASSTRIB; XML tag cClassTrib; distinct joined list",
  },
];

export function buildDefaultPreset(now = new Date().toISOString()): ExportFieldPreset {
  return {
    schemaVersion: "1.0.0",
    id: "preset_default_13",
    name: "Padrão (13 colunas)",
    createdAt: now,
    updatedAt: now,
    columns: DEFAULT_FIELD_SPECS.map((s, i) => ({
      fieldId: s.fieldId,
      order: i + 1,
      headerMode: "human" as const,
      headerOverride: s.header,
      aggregation: s.aggregation,
    })),
  };
}

export function defaultFieldDefinitions(
  catalogVersion = "inventory-202606-nfe",
): ExportFieldDefinition[] {
  return DEFAULT_FIELD_SPECS.map((s, i) => ({
    fieldId: s.fieldId,
    technicalLabel: s.xmlPaths[0] || s.fieldId,
    humanLabelPtBr: s.header,
    requestedHeader: s.header,
    xmlPaths: s.xmlPaths,
    scope: s.scope,
    dataType: s.fieldId.includes("valor") || s.aggregation === "decimal_sum" ? "decimal" : "text",
    cardinality: s.aggregation === "distinct_list" || s.aggregation === "decimal_sum" ? "many" : "optional",
    defaultAggregation: s.aggregation,
    defaultSelected: true,
    defaultOrder: i + 1,
    officialSource:
      s.fieldId === "cclass_trib" || s.fieldId.startsWith("cbs") || s.fieldId.startsWith("ibs")
        ? "https://www.nfe.fazenda.gov.br/portal/listaConteudo.aspx?tipoConteudo=/NJarYc9nus%3D"
        : undefined,
    catalogVersion,
    translationStatus: "curated",
  }));
}
