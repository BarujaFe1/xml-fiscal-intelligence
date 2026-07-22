import ExcelJS from "exceljs";
import type { BatchStore, DocumentItem, DocumentSummary } from "@/types";
import { sanitizeSpreadsheetCell, sanitizeSpreadsheetRow } from "@/lib/export/sanitize";
import {
  buildGenerationManifest,
  emptyReasonForStore,
  wrapExportEnvelope,
} from "@/lib/export/manifest";
import { formatCnpj } from "@/lib/fiscal/cnpj";
import { maskAccessKey } from "@/lib/security/redaction";
import { detectDocumentRtcLabels, RTC_EXPORT_FLAT_KEYS } from "@/lib/documents/rtc-labels";

/** Export policy: mask access keys; format CNPJ safely (alphanumeric-aware). */
function exportDoc(raw?: string | null): string {
  if (!raw) return "";
  const asCnpj = formatCnpj(raw);
  return asCnpj !== "—" ? asCnpj : raw;
}

function exportKey(key?: string | null): string {
  return maskAccessKey(key);
}

function buildItemsByDoc(items: DocumentItem[]): Map<string, DocumentItem[]> {
  const map = new Map<string, DocumentItem[]>();
  for (const item of items) {
    const list = map.get(item.documentId);
    if (list) list.push(item);
    else map.set(item.documentId, [item]);
  }
  return map;
}

function documentExportRow(
  d: DocumentSummary,
  itemsByDoc: Map<string, DocumentItem[]>,
): Record<string, unknown> {
  const rtc = detectDocumentRtcLabels(d, itemsByDoc.get(d.id));
  return {
    id: d.id,
    tipo: d.documentType,
    arquivo: d.fileName,
    chave: exportKey(d.accessKey),
    numero: d.number || "",
    serie: d.series || "",
    modelo: d.model || "",
    emissao: d.issueDate || "",
    autorizacao: d.authorizationDate || "",
    emitente_doc: exportDoc(d.emitterDoc),
    emitente_nome: d.emitterName || "",
    emitente_uf: d.emitterUf || "",
    destinatario_doc: exportDoc(d.receiverDoc),
    destinatario_nome: d.receiverName || "",
    destinatario_uf: d.receiverUf || "",
    valor_total: d.totalValue ?? "",
    valor_produtos: d.productsValue ?? "",
    valor_servicos: d.servicesValue ?? "",
    frete: d.freightValue ?? "",
    desconto: d.discountValue ?? "",
    impostos: d.taxValue ?? "",
    etiqueta_cbs: rtc.hasCbs ? "sim" : "nao",
    soma_cbs: rtc.somaCbs ?? "",
    fonte_soma_cbs: rtc.cbsAmountKey ? rtc.cbsAmountKey.split(".").slice(-3).join(".") : "",
    etiqueta_ibs: rtc.hasIbs ? "sim" : "nao",
    soma_ibs: rtc.somaIbs ?? "",
    fonte_soma_ibs: rtc.ibsAmountKey ? rtc.ibsAmountKey.split(".").slice(-3).join(".") : "",
    status: d.status || "",
    protocolo: d.protocol || "",
    parse_status: d.parseStatus,
    erros: d.parseErrors.join("; "),
  };
}

/** Planilha operacional: emitentes sem CBS para aviso a fornecedores. */
function buildCbsSupplierRows(
  documents: DocumentSummary[],
  itemsByDoc: Map<string, DocumentItem[]>,
): Record<string, unknown>[] {
  type Agg = {
    emitente_doc: string;
    emitente_nome: string;
    total_notas: number;
    com_cbs: number;
    sem_cbs: number;
    soma_cbs: number;
    valor_total_sem_cbs: number;
    numeros_sem_cbs: string[];
  };
  const map = new Map<string, Agg>();
  for (const d of documents) {
    const key = d.emitterDoc || d.emitterName || d.id;
    const rtc = detectDocumentRtcLabels(d, itemsByDoc.get(d.id));
    const cur = map.get(key) || {
      emitente_doc: exportDoc(d.emitterDoc),
      emitente_nome: d.emitterName || "",
      total_notas: 0,
      com_cbs: 0,
      sem_cbs: 0,
      soma_cbs: 0,
      valor_total_sem_cbs: 0,
      numeros_sem_cbs: [],
    };
    cur.total_notas += 1;
    if (rtc.hasCbs) {
      cur.com_cbs += 1;
      cur.soma_cbs += rtc.somaCbs || 0;
    } else {
      cur.sem_cbs += 1;
      cur.valor_total_sem_cbs += d.totalValue || 0;
      if (d.number) cur.numeros_sem_cbs.push(d.number);
    }
    map.set(key, cur);
  }
  return [...map.values()]
    .filter((a) => a.sem_cbs > 0)
    .sort((a, b) => b.sem_cbs - a.sem_cbs)
    .map((a) => ({
      emitente_doc: a.emitente_doc,
      emitente_nome: a.emitente_nome,
      total_notas: a.total_notas,
      com_cbs: a.com_cbs,
      sem_cbs: a.sem_cbs,
      soma_cbs_detectada: a.soma_cbs || "",
      valor_total_sem_cbs: a.valor_total_sem_cbs,
      numeros_sem_cbs: a.numeros_sem_cbs.slice(0, 40).join("; "),
      acao_sugerida: "Avisar fornecedor: notas sem etiqueta CBS no XML",
      disclaimer:
        "Lista operacional com base em tags observadas (SOMA CBS/vCBS/etc.). Não é apuração oficial.",
    }));
}

function addSheet(
  wb: ExcelJS.Workbook,
  name: string,
  rows: Record<string, unknown>[],
  emptyMeta?: Record<string, unknown>,
) {
  const sheet = wb.addWorksheet(name.slice(0, 31));
  if (!rows.length) {
    const meta = {
      titulo: name,
      situacao: "sem_linhas",
      motivo: emptyMeta?.emptyReason || "no_records_in_selection",
      gerado_em: new Date().toISOString(),
      disclaimer:
        "Planilha sem linhas de dados. Isto não é apuração, SPED válido nem conformidade fiscal.",
      ...emptyMeta,
    };
    sheet.columns = Object.keys(meta).map((key) => ({
      header: key,
      key,
      width: Math.min(48, Math.max(14, key.length + 2)),
    }));
    sheet.addRow(sanitizeSpreadsheetRow(meta));
    sheet.getRow(1).font = { bold: true };
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
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  if (safeRows.length) {
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: safeRows.length + 1, column: columns.length },
    };
  }
  return sheet;
}

export async function buildBatchWorkbook(store: BatchStore): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "XML Fiscal Intelligence";
  wb.created = new Date();

  const { batch, documents, items, fields, errors } = store;
  const quality = batch.quality;
  const emptyReason = emptyReasonForStore(store);
  const itemsByDoc = buildItemsByDoc(items);
  const docsById = new Map(documents.map((d) => [d.id, d]));
  const manifest = buildGenerationManifest({
    workspaceId: batch.workspaceId,
    batchIds: [batch.id],
    recordCounts: {
      documents: documents.length,
      items: items.length,
      fields: fields.length,
      errors: errors.length,
    },
    emptyReason,
    fiscalPeriod:
      batch.month && batch.year ? `${String(batch.month).padStart(2, "0")}/${batch.year}` : undefined,
    companyId: batch.cnpjLabel,
  });

  addSheet(wb, "Manifesto", [
    {
      generation_id: manifest.generationId,
      schema_version: manifest.schemaVersion,
      gerado_em: manifest.generatedAt,
      commit: manifest.buildCommit,
      workspace_id: manifest.workspaceId,
      empty_reason: manifest.emptyReason || "",
      disclaimer: manifest.disclaimer,
      evaluation_status: quality?.evaluationStatus || "",
      formula_version: quality?.formulaVersion || "",
    },
  ]);

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
    documents.map((d) => documentExportRow(d, itemsByDoc)),
  );

  addSheet(
    wb,
    "CBS_Fornecedores",
    buildCbsSupplierRows(documents, itemsByDoc),
    { emptyReason: "todas_as_notas_possuem_etiqueta_cbs" },
  );

  addSheet(
    wb,
    "Itens",
    items.map((i) => {
      const doc = docsById.get(i.documentId);
      return {
        document_id: i.documentId,
        tipo: i.documentType,
        chave: exportKey(doc?.accessKey),
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
      const rtc = detectDocumentRtcLabels(d, itemsByDoc.get(d.id));
      const row: Record<string, unknown> = {
        id: d.id,
        tipo: d.documentType,
        arquivo: d.fileName,
        chave: exportKey(d.accessKey),
        etiqueta_cbs: rtc.hasCbs ? "sim" : "nao",
        soma_cbs: rtc.somaCbs ?? "",
        etiqueta_ibs: rtc.hasIbs ? "sim" : "nao",
        soma_ibs: rtc.somaIbs ?? "",
      };
      for (const p of topPaths) {
        const v = d.flattenedJson[p];
        row[p] = v === null || v === undefined ? "" : v;
      }
      // Incluir totais CBS/IBS prioritários do flatten (sem explodir det[n]).
      for (const k of RTC_EXPORT_FLAT_KEYS) {
        if (k in row) continue;
        const v = d.flattenedJson?.[k];
        if (v === null || v === undefined || v === "") continue;
        row[k] = v;
      }
      // Também aceitar alias curto se existir no flatten.
      for (const [k, v] of Object.entries(d.flattenedJson || {})) {
        if (!/(SOMA[\s._-]*CBS|SOMA[\s._-]*IBS|IBSCBSTot\.gCBS\.vCBS|IBSCBSTot\.gIBS\.vIBS)$/i.test(k)) {
          continue;
        }
        if (k in row) continue;
        row[k] = v === null || v === undefined ? "" : v;
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

  addSheet(
    wb,
    "Alertas",
    (store.findings || []).map((f) => ({
      id: f.id,
      severidade: f.severity,
      categoria: f.category,
      codigo: f.code,
      titulo: f.title,
      descricao: f.description,
      document_id: f.documentId || "",
      status: f.status,
    })),
    { emptyReason: "no_findings_in_selection" },
  );

  addSheet(
    wb,
    "Reutilizados",
    (store.reusedDocuments || []).map((r) => ({
      arquivo: r.sourceFileName,
      motivo: r.reason,
      hash_prefix: r.sourceFileHash.slice(0, 12),
      doc_canonico: r.canonicalDocumentId || "",
      lote_canonico: r.canonicalBatchId || "",
      importado_em: r.importedAt,
      parser: r.parserVersion,
    })),
    { emptyReason: "no_reused_documents" },
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

export function buildDocumentsCsv(
  store: BatchStore,
  options?: { separator?: "," | ";" },
): string {
  const sep = options?.separator ?? ",";
  const emptyReason = emptyReasonForStore(store);
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
    "etiqueta_cbs",
    "soma_cbs",
    "etiqueta_ibs",
    "soma_ibs",
    "status",
    "protocolo",
  ];
  const meta = [
    `# generation_manifest`,
    `# empty_reason=${emptyReason || ""}`,
    `# documents=${store.documents.length}`,
    `# disclaimer=Exportacao analitica interna — nao e apuracao oficial`,
  ];
  const lines = [...meta, headers.join(sep)];
  if (!store.documents.length) {
    lines.push(`# empty=${emptyReason || "no_documents_in_batch"}`);
    return `\uFEFF${lines.join("\n")}`;
  }
  const itemsByDoc = buildItemsByDoc(store.items);
  for (const d of store.documents) {
    const rtc = detectDocumentRtcLabels(d, itemsByDoc.get(d.id));
    const row = [
      d.id,
      d.documentType,
      d.fileName,
      exportKey(d.accessKey),
      d.number || "",
      d.series || "",
      d.issueDate || "",
      exportDoc(d.emitterDoc),
      d.emitterName || "",
      exportDoc(d.receiverDoc),
      d.receiverName || "",
      d.totalValue ?? "",
      rtc.hasCbs ? "sim" : "nao",
      rtc.somaCbs ?? "",
      rtc.hasIbs ? "sim" : "nao",
      rtc.somaIbs ?? "",
      d.status || "",
      d.protocol || "",
    ].map((v) => `"${sanitizeSpreadsheetCell(v).replace(/"/g, '""')}"`);
    lines.push(row.join(sep));
  }
  return `\uFEFF${lines.join("\n")}`;
}

export function buildItemsCsv(
  store: BatchStore,
  options?: { separator?: "," | ";" },
): string {
  const sep = options?.separator ?? ",";
  const emptyReason = emptyReasonForStore(store);
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
  const lines = [
    `# empty_reason=${emptyReason || ""}`,
    `# items=${store.items.length}`,
    headers.join(sep),
  ];
  if (!store.items.length) {
    lines.push(`# empty=${emptyReason || "no_items_in_batch"}`);
    return `\uFEFF${lines.join("\n")}`;
  }
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
    lines.push(row.join(sep));
  }
  return `\uFEFF${lines.join("\n")}`;
}

export function buildBatchJsonEnvelope(store: BatchStore) {
  const emptyReason = emptyReasonForStore(store);
  const manifest = buildGenerationManifest({
    workspaceId: store.batch.workspaceId,
    batchIds: [store.batch.id],
    recordCounts: {
      documents: store.documents.length,
      items: store.items.length,
      errors: store.errors.length,
    },
    emptyReason,
  });
  return wrapExportEnvelope(
    {
      batch: store.batch,
      documents: store.documents,
      items: store.items,
      errors: store.errors,
      findings: store.findings,
      relationships: store.relationships,
    },
    manifest,
    emptyReason,
  );
}

export function buildHtmlReport(store: BatchStore): string {
  const { batch, documents } = store;
  const q = batch.quality;
  const emptyReason = emptyReasonForStore(store);
  const manifest = buildGenerationManifest({
    workspaceId: batch.workspaceId,
    batchIds: [batch.id],
    recordCounts: { documents: documents.length },
    emptyReason,
  });
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
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
caption{text-align:left;font-weight:600;margin-bottom:8px}
footer{margin-top:24px;font-size:12px;color:#93a4c3}
@media print{
  body{background:#fff;color:#111;padding:12mm}
  .card,.metric{background:#fff;border-color:#ccc;color:#111}
  .muted,footer{color:#444}
  table{page-break-inside:auto}
  tr{page-break-inside:avoid;page-break-after:auto}
  thead{display:table-header-group}
}
</style>
</head>
<body>
<header>
<h1>XML Fiscal Intelligence</h1>
<p class="muted">Relatório do lote ${batch.name} · Índice ${batch.healthScore ?? "não avaliado"} · ${q?.evaluationStatus || ""}</p>
</header>
<section class="grid" aria-label="Métricas do lote">
<div class="metric"><span class="muted">XMLs</span><b>${batch.totalXml}</b></div>
<div class="metric"><span class="muted">Válidos</span><b>${batch.validXml}</b></div>
<div class="metric"><span class="muted">NF-e</span><b>${batch.nfeCount}</b></div>
<div class="metric"><span class="muted">CT-e</span><b>${batch.cteCount}</b></div>
<div class="metric"><span class="muted">NFS-e</span><b>${batch.nfseCount}</b></div>
<div class="metric"><span class="muted">Valor</span><b>${batch.totalValue.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</b></div>
</section>
<section class="card">
<h2>Manifesto</h2>
<p class="muted">generationId=${manifest.generationId} · ${manifest.generatedAt}</p>
<p>${manifest.disclaimer}</p>
${emptyReason ? `<p><strong>Motivo vazio:</strong> ${emptyReason}</p>` : ""}
</section>
<section class="card">
<h2>Alertas</h2>
<ul>${(q?.warnings || []).map((w) => `<li>${w.message}</li>`).join("") || "<li>Nenhum alerta</li>"}</ul>
</section>
<section class="card">
<table>
<caption>Documentos (até 200)</caption>
<thead><tr><th scope="col">Tipo</th><th scope="col">Número</th><th scope="col">Emitente</th><th scope="col">Valor</th><th scope="col">Status</th></tr></thead>
<tbody>
${
  documents.length
    ? documents
        .slice(0, 200)
        .map(
          (d) =>
            `<tr><td>${d.documentType}</td><td>${d.number || "—"}</td><td>${d.emitterName || "—"}</td><td>${d.totalValue ?? "—"}</td><td>${d.parseStatus}</td></tr>`,
        )
        .join("")
    : `<tr><td colspan="5">Sem documentos — ${emptyReason || "no_documents_in_batch"}</td></tr>`
}
</tbody>
</table>
</section>
<footer>
Versão app ${manifest.appVersion} · commit ${manifest.buildCommit} · geração ${manifest.generationId}
</footer>
</body></html>`;
}
