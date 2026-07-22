import type { ExportCsvProfile, ExportDatasetV2 } from "@/lib/export/v2/types";
import { sanitizeSpreadsheetCell } from "@/lib/export/sanitize";

const DOC_HEADERS = [
  "document_id",
  "tipo",
  "numero",
  "serie",
  "modelo",
  "emissao",
  "autorizacao",
  "chave",
  "emitente_doc",
  "emitente_nome",
  "emitente_uf",
  "destinatario_doc",
  "destinatario_nome",
  "destinatario_uf",
  "natureza_operacao",
  "cfop_principal",
  "valor_total",
  "valor_produtos",
  "valor_servicos",
  "frete",
  "desconto",
  "impostos",
  "status",
  "protocolo",
  "parse_status",
  "indice_qualidade",
  "etiqueta_cbs",
  "soma_cbs",
  "etiqueta_ibs",
  "soma_ibs",
  "arquivo",
] as const;

const ITEM_HEADERS = [
  "item_id",
  "document_id",
  "chave",
  "numero_nota",
  "item_numero",
  "codigo",
  "descricao",
  "ncm",
  "cest",
  "cfop",
  "cst",
  "csosn",
  "unidade",
  "quantidade",
  "valor_unitario",
  "valor_total",
  "desconto",
  "emitente_nome",
] as const;

function escapeCsvField(value: string, separator: string): string {
  const needsQuote =
    value.includes('"') ||
    value.includes("\n") ||
    value.includes("\r") ||
    value.includes(separator);
  const escaped = value.replace(/"/g, '""');
  return needsQuote ? `"${escaped}"` : escaped;
}

function cell(value: unknown, profile: ExportCsvProfile): string {
  if (value === null || value === undefined) return "";
  const raw = String(value);
  // Identifiers / text: neutralize formula injection
  const safe = sanitizeSpreadsheetCell(raw);
  if (profile === "excel_pt_br" && /^-?\d+\.\d+$/.test(raw) && !raw.startsWith("'")) {
    // Document decimal convention for Excel PT-BR: comma decimal
    // Only rewrite canonical money-like decimals (no thousands sep)
    return sanitizeSpreadsheetCell(raw.replace(".", ","));
  }
  return safe;
}

function joinRow(fields: string[], separator: string, eol: string): string {
  return fields.map((f) => escapeCsvField(f, separator)).join(separator) + eol;
}

export function buildDocumentsCsvFromDataset(
  dataset: ExportDatasetV2,
  profile: ExportCsvProfile = "excel_pt_br",
): string {
  const separator = profile === "excel_pt_br" ? ";" : ",";
  const eol = profile === "excel_pt_br" ? "\r\n" : "\n";
  const bom = profile === "excel_pt_br" ? "\uFEFF" : "";
  const lines: string[] = [joinRow([...DOC_HEADERS], separator, eol)];

  for (const d of dataset.documents) {
    const row = [
      d.id,
      d.documentType,
      d.number || "",
      d.series || "",
      d.model || "",
      d.issueDate || "",
      d.authorizationDate || "",
      d.accessKey || "",
      d.emitterDoc || "",
      d.emitterName || "",
      d.emitterUf || "",
      d.receiverDoc || "",
      d.receiverName || "",
      d.receiverUf || "",
      d.natureOperation || "",
      d.cfopMain || "",
      d.totalValue,
      d.productsValue,
      d.servicesValue,
      d.freightValue,
      d.discountValue,
      d.taxValue,
      d.status || "",
      d.protocol || "",
      d.parseStatus,
      d.qualityScore ?? "",
      d.etiquetaCbs,
      d.somaCbs,
      d.etiquetaIbs,
      d.somaIbs,
      d.fileName,
    ].map((v) => cell(v, profile));
    lines.push(joinRow(row, separator, eol));
  }
  return bom + lines.join("");
}

export function buildItemsCsvFromDataset(
  dataset: ExportDatasetV2,
  profile: ExportCsvProfile = "excel_pt_br",
): string {
  const separator = profile === "excel_pt_br" ? ";" : ",";
  const eol = profile === "excel_pt_br" ? "\r\n" : "\n";
  const bom = profile === "excel_pt_br" ? "\uFEFF" : "";
  const lines: string[] = [joinRow([...ITEM_HEADERS], separator, eol)];

  for (const i of dataset.items) {
    const row = [
      i.id,
      i.documentId,
      i.accessKey || "",
      i.noteNumber || "",
      i.itemNumber,
      i.code || "",
      i.description || "",
      i.ncm || "",
      i.cest || "",
      i.cfop || "",
      i.cst || "",
      i.csosn || "",
      i.unit || "",
      i.quantity || "",
      i.unitValue,
      i.totalValue,
      i.discountValue,
      i.emitterName || "",
    ].map((v) => cell(v, profile));
    lines.push(joinRow(row, separator, eol));
  }
  return bom + lines.join("");
}
