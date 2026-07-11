import ExcelJS from "exceljs";
import type { BatchStore } from "@/types";
import { sanitizeSpreadsheetCell, sanitizeSpreadsheetRow } from "@/lib/export/sanitize";

function addSheet(wb: ExcelJS.Workbook, name: string, rows: Record<string, unknown>[]) {
  const sheet = wb.addWorksheet(name.slice(0, 31));
  if (!rows.length) {
    sheet.addRow(["Sem dados"]);
    return sheet;
  }
  const safeRows = rows.map((r) => sanitizeSpreadsheetRow(r));
  const columns = Array.from(
    safeRows.reduce((set, row) => {
      Object.keys(row).forEach((k) => set.add(k));
      return set;
    }, new Set<string>()),
  );
  sheet.columns = columns.map((key) => ({ header: key, key, width: Math.min(40, Math.max(12, key.length + 2)) }));
  for (const row of safeRows) sheet.addRow(row);
  sheet.getRow(1).font = { bold: true };
  return sheet;
}

export async function buildBatchWorkbook(store: BatchStore): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "XML Fiscal Intelligence";
  wb.created = new Date();

  const { batch, documents, items, fields, errors } = store;
  const quality = batch.quality;

  addSheet(wb, "Resumo", [
    {
      lote: batch.name,
      arquivo: batch.uploadedFileName,
      status: batch.status,
      health_score: batch.healthScore,
      total_arquivos: batch.totalFiles,
      total_xml: batch.totalXml,
      validos: batch.validXml,
      invalidos: batch.invalidXml,
      nfe: batch.nfeCount,
      cte: batch.cteCount,
      nfse: batch.nfseCount,
      desconhecidos: batch.unknownCount,
      duplicados: batch.duplicateCount,
      valor_total: batch.totalValue,
      cnpj: batch.cnpjLabel || "",
      mes: batch.month || "",
      ano: batch.year || "",
      criado_em: batch.createdAt,
    },
  ]);

  addSheet(
    wb,
    "Documentos",
    documents.map((d) => ({
      id: d.id,
      tipo: d.documentType,
      arquivo: d.fileName,
      chave: d.accessKey || "",
      numero: d.number || "",
      serie: d.series || "",
      modelo: d.model || "",
      emissao: d.issueDate || "",
      autorizacao: d.authorizationDate || "",
      emitente_doc: d.emitterDoc || "",
      emitente_nome: d.emitterName || "",
      emitente_uf: d.emitterUf || "",
      destinatario_doc: d.receiverDoc || "",
      destinatario_nome: d.receiverName || "",
      destinatario_uf: d.receiverUf || "",
      valor_total: d.totalValue ?? "",
      valor_produtos: d.productsValue ?? "",
      valor_servicos: d.servicesValue ?? "",
      frete: d.freightValue ?? "",
      desconto: d.discountValue ?? "",
      impostos: d.taxValue ?? "",
      status: d.status || "",
      protocolo: d.protocol || "",
      parse_status: d.parseStatus,
      erros: d.parseErrors.join("; "),
    })),
  );

  addSheet(
    wb,
    "Itens",
    items.map((i) => {
      const doc = documents.find((d) => d.id === i.documentId);
      return {
        document_id: i.documentId,
        tipo: i.documentType,
        chave: doc?.accessKey || "",
        numero_nota: doc?.number || "",
        emitente: doc?.emitterName || "",
        item: i.itemNumber,
        codigo: i.code || "",
        descricao: i.description || "",
        ncm: i.ncm || "",
        cfop: i.cfop || "",
        unidade: i.unit || "",
        quantidade: i.quantity ?? "",
        valor_unitario: i.unitValue ?? "",
        valor_total: i.totalValue ?? "",
        desconto: i.discountValue ?? "",
      };
    }),
  );

  // Dynamic wide export sample: top normalized paths as columns (cap for Excel practicality)
  const pathFreq = new Map<string, number>();
  for (const f of fields) {
    if (f.isEmpty) continue;
    pathFreq.set(f.pathNormalized, (pathFreq.get(f.pathNormalized) || 0) + 1);
  }
  const topPaths = [...pathFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 80)
    .map(([p]) => p);

  addSheet(
    wb,
    "Campos",
    fields.slice(0, 20000).map((f) => ({
      document_id: f.documentId,
      tipo: f.documentType,
      path_original: f.pathOriginal,
      path_normalizado: f.pathNormalized,
      campo: f.fieldName,
      valor: f.valueText || "",
      tipo_inferido: f.inferredType,
      vazio: f.isEmpty,
    })),
  );

  addSheet(
    wb,
    "CamposCompletos",
    documents.map((d) => {
      const row: Record<string, unknown> = {
        id: d.id,
        tipo: d.documentType,
        arquivo: d.fileName,
        chave: d.accessKey || "",
      };
      for (const p of topPaths) {
        const v = d.flattenedJson[p];
        row[p] = v === null || v === undefined ? "" : v;
      }
      return row;
    }),
  );

  addSheet(
    wb,
    "Erros",
    errors.map((e) => ({
      arquivo: e.fileName,
      tipo: e.errorType,
      mensagem: e.errorMessage,
      snippet: e.rawSnippet || "",
      criado_em: e.createdAt,
    })),
  );

  addSheet(wb, "Insights", [
    {
      health_score: quality?.score ?? batch.healthScore,
      xml_validity: quality?.breakdown.xmlValidity ?? "",
      essential_fields: quality?.breakdown.essentialFields ?? "",
      duplicates: quality?.breakdown.duplicates ?? "",
      date_consistency: quality?.breakdown.dateConsistency ?? "",
      value_consistency: quality?.breakdown.valueConsistency ?? "",
      item_completeness: quality?.breakdown.itemCompleteness ?? "",
      fiscal_identification: quality?.breakdown.fiscalIdentification ?? "",
      warnings: quality?.warnings.map((w) => w.message).join(" | ") || "",
      recommendations: quality?.recommendations.join(" | ") || "",
    },
  ]);

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

export function buildDocumentsCsv(store: BatchStore): string {
  const headers = [
    "id",
    "tipo",
    "arquivo",
    "chave",
    "numero",
    "serie",
    "emissao",
    "emitente_doc",
    "emitente_nome",
    "destinatario_doc",
    "destinatario_nome",
    "valor_total",
    "status",
    "protocolo",
  ];
  const lines = [headers.join(",")];
  for (const d of store.documents) {
    const row = [
      d.id,
      d.documentType,
      d.fileName,
      d.accessKey || "",
      d.number || "",
      d.series || "",
      d.issueDate || "",
      d.emitterDoc || "",
      d.emitterName || "",
      d.receiverDoc || "",
      d.receiverName || "",
      d.totalValue ?? "",
      d.status || "",
      d.protocol || "",
    ].map((v) => `"${sanitizeSpreadsheetCell(v).replace(/"/g, '""')}"`);
    lines.push(row.join(","));
  }
  return lines.join("\n");
}

export function buildItemsCsv(store: BatchStore): string {
  const headers = [
    "document_id",
    "tipo",
    "item",
    "codigo",
    "descricao",
    "ncm",
    "cfop",
    "qtd",
    "unidade",
    "valor_unit",
    "valor_total",
  ];
  const lines = [headers.join(",")];
  for (const i of store.items) {
    const row = [
      i.documentId,
      i.documentType,
      i.itemNumber,
      i.code || "",
      i.description || "",
      i.ncm || "",
      i.cfop || "",
      i.quantity ?? "",
      i.unit || "",
      i.unitValue ?? "",
      i.totalValue ?? "",
    ].map((v) => `"${sanitizeSpreadsheetCell(v).replace(/"/g, '""')}"`);
    lines.push(row.join(","));
  }
  return lines.join("\n");
}

export function buildHtmlReport(store: BatchStore): string {
  const { batch, documents } = store;
  const q = batch.quality;
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/>
<title>Relatório — ${batch.name}</title>
<style>
body{font-family:ui-sans-serif,system-ui,sans-serif;background:#0b1220;color:#e8eefc;padding:32px;line-height:1.5}
h1{font-size:28px;margin:0 0 8px}
.muted{color:#93a4c3}
.card{background:#121a2b;border:1px solid #24314d;border-radius:16px;padding:20px;margin:16px 0}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px}
.metric{background:#0f172a;border-radius:12px;padding:12px}
.metric b{display:block;font-size:22px}
table{width:100%;border-collapse:collapse;font-size:13px}
th,td{border-bottom:1px solid #24314d;padding:8px;text-align:left}
</style>
</head>
<body>
<h1>XML Fiscal Intelligence</h1>
<p class="muted">Relatório do lote ${batch.name} · Score ${batch.healthScore}</p>
<div class="grid">
<div class="metric"><span class="muted">XMLs</span><b>${batch.totalXml}</b></div>
<div class="metric"><span class="muted">Válidos</span><b>${batch.validXml}</b></div>
<div class="metric"><span class="muted">NF-e</span><b>${batch.nfeCount}</b></div>
<div class="metric"><span class="muted">CT-e</span><b>${batch.cteCount}</b></div>
<div class="metric"><span class="muted">NFS-e</span><b>${batch.nfseCount}</b></div>
<div class="metric"><span class="muted">Valor</span><b>${batch.totalValue.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</b></div>
</div>
<div class="card">
<h2>Alertas</h2>
<ul>${(q?.warnings || []).map((w) => `<li>${w.message}</li>`).join("") || "<li>Nenhum alerta</li>"}</ul>
</div>
<div class="card">
<h2>Documentos</h2>
<table>
<thead><tr><th>Tipo</th><th>Número</th><th>Emitente</th><th>Valor</th><th>Status</th></tr></thead>
<tbody>
${documents
  .slice(0, 200)
  .map(
    (d) =>
      `<tr><td>${d.documentType}</td><td>${d.number || "—"}</td><td>${d.emitterName || "—"}</td><td>${d.totalValue ?? "—"}</td><td>${d.parseStatus}</td></tr>`,
  )
  .join("")}
</tbody>
</table>
</div>
</body></html>`;
}
