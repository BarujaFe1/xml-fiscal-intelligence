import ExcelJS from "exceljs";
import type { ExportDatasetV2 } from "@/lib/export/v2/types";
import { sanitizeSpreadsheetCell } from "@/lib/export/sanitize";

const MONEY_FMT = '"R$"#,##0.00';
const DATE_FMT = "dd/mm/yyyy";
const INT_FMT = "0";

function parseIsoDate(iso?: string): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function moneyNumber(canonical: string): number {
  const n = Number(canonical);
  return Number.isFinite(n) ? n : 0;
}

function textCell(v: unknown): string {
  return sanitizeSpreadsheetCell(v ?? "");
}

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: "FF1A2332" } };
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE8EEF6" },
  };
  row.alignment = { vertical: "middle", wrapText: true };
}

function addTable(
  sheet: ExcelJS.Worksheet,
  name: string,
  ref: string,
  columns: Array<{ name: string }>,
) {
  // exceljs TableProperties requires `rows` (can be empty when data already on sheet)
  sheet.addTable({
    name,
    ref,
    headerRow: true,
    totalsRow: false,
    style: {
      theme: "TableStyleMedium2",
      showRowStripes: true,
    },
    columns,
    rows: [],
  });
}

function setupPrint(sheet: ExcelJS.Worksheet, landscape = true) {
  sheet.pageSetup = {
    orientation: landscape ? "landscape" : "portrait",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    printTitlesRow: "1:1",
    margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
  };
  sheet.views = [{ state: "frozen", xSplit: 2, ySplit: 1, activeCell: "A2" }];
  sheet.autoFilter = undefined; // table provides filters
}

/**
 * Professional workbook from ExportDatasetV2.
 * Default sheets: Resumo, Documentos, Itens, Alertas, Manifesto.
 */
export async function buildWorkbookFromDataset(
  dataset: ExportDatasetV2,
): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "XML Fiscal Intelligence";
  wb.created = new Date(dataset.manifest.generatedAt);
  wb.modified = new Date();

  buildResumo(wb, dataset);
  buildDocumentos(wb, dataset);
  buildItens(wb, dataset);
  buildAlertas(wb, dataset);
  buildManifesto(wb, dataset);

  const buf = await wb.xlsx.writeBuffer();
  return buf as ArrayBuffer;
}

function buildResumo(wb: ExcelJS.Workbook, dataset: ExportDatasetV2) {
  const ws = wb.addWorksheet("Resumo", {
    properties: { defaultRowHeight: 18 },
    views: [{ showGridLines: false }],
  });
  const { summary, privacy, manifest } = dataset;

  ws.getColumn(1).width = 36;
  ws.getColumn(2).width = 28;
  ws.getColumn(3).width = 22;
  ws.getColumn(4).width = 22;

  ws.mergeCells("A1:D1");
  ws.getCell("A1").value = summary.batchName;
  ws.getCell("A1").font = { size: 18, bold: true, color: { argb: "FF1A2332" } };

  ws.mergeCells("A2:D2");
  ws.getCell("A2").value = `Gerado em ${manifest.generatedAt} · ${privacy.note}`;
  ws.getCell("A2").font = { size: 10, color: { argb: "FF5A6577" } };

  const kpis: Array<[string, string | number]> = [
    ["Documentos", summary.documentCount],
    ["Itens", summary.itemCount],
    ["XMLs disponíveis", summary.xmlAvailableCount],
    ["Valor total", moneyNumber(summary.totalValue)],
    ["Índice de qualidade", summary.healthScore ?? "—"],
    ["Alertas", summary.findingCount],
  ];
  let r = 4;
  ws.getCell(`A${r}`).value = "Indicadores";
  ws.getCell(`A${r}`).font = { bold: true, size: 12 };
  r = 5;
  for (const [label, value] of kpis) {
    ws.getCell(`A${r}`).value = label;
    ws.getCell(`B${r}`).value = value;
    if (label === "Valor total") {
      ws.getCell(`B${r}`).numFmt = MONEY_FMT;
    }
    r += 1;
  }

  r += 1;
  ws.getCell(`A${r}`).value = "Competência informada";
  ws.getCell(`B${r}`).value = summary.informedCompetence || "não informada";
  r += 1;
  ws.getCell(`A${r}`).value = "Período real (mín)";
  ws.getCell(`B${r}`).value = summary.realPeriodMin || "—";
  r += 1;
  ws.getCell(`A${r}`).value = "Período real (máx)";
  ws.getCell(`B${r}`).value = summary.realPeriodMax || "—";
  r += 1;
  ws.getCell(`A${r}`).value = "Fora da competência";
  ws.getCell(`B${r}`).value = summary.outsideCompetenceCount;
  if (summary.competenceMismatch) {
    ws.getCell(`A${r}`).font = { bold: true, color: { argb: "FF7A4A00" } };
    ws.getCell(`B${r}`).font = { bold: true, color: { argb: "FF7A4A00" } };
    r += 1;
    ws.mergeCells(`A${r}:D${r}`);
    ws.getCell(`A${r}`).value =
      "AVISO: a competência informada no lote diverge do período real dos documentos. A competência NÃO foi alterada automaticamente.";
    ws.getCell(`A${r}`).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFFF4E0" },
    };
  }

  r += 2;
  ws.getCell(`A${r}`).value = "Por tipo documental";
  ws.getCell(`A${r}`).font = { bold: true };
  r += 1;
  const typeStart = r;
  ws.getCell(`A${r}`).value = "Tipo";
  ws.getCell(`B${r}`).value = "Quantidade";
  styleHeader(ws.getRow(r));
  r += 1;
  for (const [tipo, qtd] of Object.entries(summary.byType)) {
    ws.getCell(`A${r}`).value = tipo;
    ws.getCell(`B${r}`).value = qtd;
    r += 1;
  }
  const typeEnd = r - 1;
  if (typeEnd >= typeStart + 1) {
    try {
      addTable(ws, "tblResumoTipos", `A${typeStart}:B${typeEnd}`, [
        { name: "Tipo" },
        { name: "Quantidade" },
      ]);
    } catch {
      /* table optional if single header */
    }
  }

  r += 1;
  ws.getCell(`A${r}`).value = "Por severidade de alerta";
  ws.getCell(`A${r}`).font = { bold: true };
  r += 1;
  ws.getCell(`A${r}`).value = "Severidade";
  ws.getCell(`B${r}`).value = "Quantidade";
  styleHeader(ws.getRow(r));
  r += 1;
  const sevEntries = Object.entries(summary.bySeverity);
  if (!sevEntries.length) {
    ws.getCell(`A${r}`).value = "Nenhum alerta encontrado nesta seleção";
  } else {
    for (const [sev, qtd] of sevEntries) {
      ws.getCell(`A${r}`).value = sev;
      ws.getCell(`B${r}`).value = qtd;
      r += 1;
    }
  }

  r += 2;
  ws.mergeCells(`A${r}:D${r}`);
  ws.getCell(`A${r}`).value = manifest.disclaimer;
  ws.getCell(`A${r}`).font = { size: 9, italic: true, color: { argb: "FF5A6577" } };

  setupPrint(ws, false);
  ws.views = [{ showGridLines: false }];
}

function buildDocumentos(wb: ExcelJS.Workbook, dataset: ExportDatasetV2) {
  const ws = wb.addWorksheet("Documentos");
  const headers = [
    "Tipo",
    "Número",
    "Série",
    "Modelo",
    "Emissão",
    "Autorização",
    "Chave",
    "Emitente doc",
    "Emitente nome",
    "Emitente UF",
    "Destinatário doc",
    "Destinatário nome",
    "Destinatário UF",
    "Natureza da operação",
    "CFOP principal",
    "Valor total",
    "Produtos",
    "Serviços",
    "Frete",
    "Desconto",
    "Impostos",
    "Status",
    "Protocolo",
    "Parse",
    "Índice de qualidade",
    "Arquivo",
    "ID técnico",
  ];
  ws.addRow(headers);
  styleHeader(ws.getRow(1));

  for (const d of dataset.documents) {
    const issue = parseIsoDate(d.issueDate);
    const auth = parseIsoDate(d.authorizationDate);
    const row = ws.addRow([
      d.documentType,
      textCell(d.number),
      textCell(d.series),
      textCell(d.model),
      issue,
      auth,
      textCell(d.accessKey),
      textCell(d.emitterDoc),
      textCell(d.emitterName),
      textCell(d.emitterUf),
      textCell(d.receiverDoc),
      textCell(d.receiverName),
      textCell(d.receiverUf),
      textCell(d.natureOperation),
      textCell(d.cfopMain),
      moneyNumber(d.totalValue),
      moneyNumber(d.productsValue),
      moneyNumber(d.servicesValue),
      moneyNumber(d.freightValue),
      moneyNumber(d.discountValue),
      moneyNumber(d.taxValue),
      textCell(d.status),
      textCell(d.protocol),
      d.parseStatus,
      d.qualityScore ?? null,
      textCell(d.fileName),
      textCell(d.id),
    ]);
    row.getCell(5).numFmt = DATE_FMT;
    row.getCell(6).numFmt = DATE_FMT;
    for (const c of [16, 17, 18, 19, 20, 21]) row.getCell(c).numFmt = MONEY_FMT;
    row.getCell(25).numFmt = INT_FMT;

    if (d.parseStatus === "error") {
      row.getCell(24).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFD6D6" },
      };
    }
    if (d.isDuplicate) {
      row.getCell(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFF0C8" },
      };
    }
  }

  const last = Math.max(1, dataset.documents.length + 1);
  addTable(
    ws,
    "tblDocumentos",
    `A1:AA${last}`,
    headers.map((name) => ({ name })),
  );

  const widths = [8, 12, 8, 8, 12, 12, 28, 18, 28, 6, 18, 28, 6, 24, 10, 14, 12, 12, 10, 10, 12, 10, 16, 10, 10, 28, 36];
  widths.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });
  // Force text columns (chave, docs, serie, numero)
  for (const col of [2, 3, 7, 8, 11, 23, 27]) {
    ws.getColumn(col).numFmt = "@";
  }

  if (dataset.summary.competenceMismatch && dataset.summary.informedCompetence) {
    const [mm, yyyy] = dataset.summary.informedCompetence.split("/");
    const month = Number(mm);
    const year = Number(yyyy);
    if (month && year) {
      ws.addConditionalFormatting({
        ref: `E2:E${last}`,
        rules: [
          {
            type: "expression",
            priority: 1,
            formulae: [
              `OR(MONTH(E2)<>${month},YEAR(E2)<>${year})`,
            ],
            style: {
              fill: {
                type: "pattern",
                pattern: "solid",
                bgColor: { argb: "FFFFE0B2" },
              },
            },
          },
        ],
      });
    }
  }

  setupPrint(ws, true);
}

function buildItens(wb: ExcelJS.Workbook, dataset: ExportDatasetV2) {
  const ws = wb.addWorksheet("Itens");
  const headers = [
    "Chave",
    "Número da nota",
    "Item",
    "Código",
    "Descrição",
    "NCM",
    "CEST",
    "CFOP",
    "CST",
    "CSOSN",
    "Unidade",
    "Quantidade",
    "Valor unitário",
    "Valor total",
    "Desconto",
    "Emitente",
    "document_id",
    "item_id",
  ];
  ws.addRow(headers);
  styleHeader(ws.getRow(1));

  if (!dataset.items.length) {
    ws.addRow(["Nenhum item encontrado nesta seleção"]);
    ws.mergeCells("A2:R2");
    ws.getCell("A2").font = { italic: true, color: { argb: "FF5A6577" } };
    setupPrint(ws, true);
    return;
  }

  for (const i of dataset.items) {
    const row = ws.addRow([
      textCell(i.accessKey),
      textCell(i.noteNumber),
      i.itemNumber,
      textCell(i.code),
      textCell(i.description),
      textCell(i.ncm),
      textCell(i.cest),
      textCell(i.cfop),
      textCell(i.cst),
      textCell(i.csosn),
      textCell(i.unit),
      i.quantity ? Number(i.quantity) : null,
      moneyNumber(i.unitValue),
      moneyNumber(i.totalValue),
      moneyNumber(i.discountValue),
      textCell(i.emitterName),
      textCell(i.documentId),
      textCell(i.id),
    ]);
    row.getCell(13).numFmt = MONEY_FMT;
    row.getCell(14).numFmt = MONEY_FMT;
    row.getCell(15).numFmt = MONEY_FMT;
    row.getCell(12).numFmt = "0.0000";
  }

  const last = dataset.items.length + 1;
  addTable(
    ws,
    "tblItens",
    `A1:R${last}`,
    headers.map((name) => ({ name })),
  );
  const widths = [28, 12, 6, 12, 36, 10, 10, 8, 8, 8, 8, 12, 12, 12, 10, 24, 22, 22];
  widths.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });
  for (const col of [1, 2, 4, 6, 7, 8, 9, 10, 17, 18]) {
    ws.getColumn(col).numFmt = "@";
  }
  setupPrint(ws, true);
}

function buildAlertas(wb: ExcelJS.Workbook, dataset: ExportDatasetV2) {
  const ws = wb.addWorksheet("Alertas");
  const headers = ["Severidade", "Código", "Categoria", "Título", "Descrição", "Status", "document_id", "id"];
  ws.addRow(headers);
  styleHeader(ws.getRow(1));

  if (!dataset.findings.length) {
    ws.addRow(["Nenhum alerta encontrado nesta seleção"]);
    ws.mergeCells("A2:H2");
    ws.getCell("A2").font = { italic: true, color: { argb: "FF5A6577" } };
    setupPrint(ws, true);
    return;
  }

  for (const f of dataset.findings) {
    const row = ws.addRow([
      f.severity,
      textCell(f.code),
      textCell(f.category),
      textCell(f.title),
      textCell(f.description),
      textCell(f.status),
      textCell(f.documentId),
      textCell(f.id),
    ]);
    if (f.severity === "error" || f.severity === "critical") {
      row.getCell(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFD6D6" },
      };
    } else if (f.severity === "warning") {
      row.getCell(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFF0C8" },
      };
    }
  }

  const last = dataset.findings.length + 1;
  addTable(
    ws,
    "tblAlertas",
    `A1:H${last}`,
    headers.map((name) => ({ name })),
  );
  [12, 14, 14, 28, 40, 12, 24, 24].forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });
  setupPrint(ws, true);
}

function buildManifesto(wb: ExcelJS.Workbook, dataset: ExportDatasetV2) {
  const ws = wb.addWorksheet("Manifesto");
  ws.views = [{ showGridLines: false }];
  ws.getColumn(1).width = 32;
  ws.getColumn(2).width = 72;

  const rows: Array<[string, string | number | null]> = [
    ["schemaVersion", dataset.manifest.schemaVersion],
    ["generationId", dataset.manifest.generationId],
    ["generatedAt", dataset.manifest.generatedAt],
    ["timezone", dataset.manifest.timezone],
    ["appVersion", dataset.manifest.appVersion],
    ["buildCommit", dataset.manifest.buildCommit],
    ["batchId", dataset.manifest.batchId],
    ["batchName", dataset.manifest.batchName],
    ["privacy", dataset.manifest.privacy.profile],
    ["informedCompetence", dataset.manifest.informedCompetence || ""],
    ["realPeriodMin", dataset.manifest.realPeriodMin || ""],
    ["realPeriodMax", dataset.manifest.realPeriodMax || ""],
    ["documents", dataset.manifest.counts.documents],
    ["items", dataset.manifest.counts.items],
    ["findings", dataset.manifest.counts.findings],
    ["relationships", dataset.manifest.counts.relationships],
    ["xmlAvailable", dataset.manifest.counts.xmlAvailable],
    ["xmlMissing", dataset.manifest.counts.xmlMissing],
    ["totalValue", dataset.manifest.totals.totalValue],
    ["emptyReason", dataset.manifest.emptyReason ?? ""],
    ["disclaimer", dataset.manifest.disclaimer],
  ];

  ws.addRow(["Campo", "Valor"]);
  styleHeader(ws.getRow(1));
  for (const [k, v] of rows) {
    ws.addRow([k, v]);
  }
  let r = rows.length + 3;
  ws.getCell(`A${r}`).value = "Avisos do preflight";
  ws.getCell(`A${r}`).font = { bold: true };
  r += 1;
  if (!dataset.manifest.preflightWarnings.length) {
    ws.getCell(`A${r}`).value = "Nenhum aviso";
  } else {
    for (const w of dataset.manifest.preflightWarnings) {
      ws.getCell(`A${r}`).value = w;
      ws.mergeCells(`A${r}:B${r}`);
      r += 1;
    }
  }
  setupPrint(ws, false);
}

/** Reopen and validate a generated workbook buffer. */
export async function verifyWorkbookBuffer(buffer: ArrayBuffer | Uint8Array): Promise<{
  ok: boolean;
  sheetNames: string[];
  errors: string[];
  documentRows: number;
  moneySample?: number;
}> {
  const errors: string[] = [];
  const wb = new ExcelJS.Workbook();
  // exceljs accepts Buffer / Uint8Array
  await wb.xlsx.load(buffer as ExcelJS.Buffer);
  const expected = ["Resumo", "Documentos", "Itens", "Alertas", "Manifesto"];
  const sheetNames = wb.worksheets.map((s) => s.name);
  for (const name of expected) {
    if (!sheetNames.includes(name)) errors.push(`Aba ausente: ${name}`);
  }
  const docs = wb.getWorksheet("Documentos");
  const documentRows = docs ? Math.max(0, docs.rowCount - 1) : 0;
  let moneySample: number | undefined;
  if (docs && docs.rowCount >= 2) {
    const cell = docs.getRow(2).getCell(16);
    moneySample = typeof cell.value === "number" ? cell.value : undefined;
    if (typeof cell.value !== "number") {
      errors.push("Valor total da linha 2 de Documentos não é número");
    }
  }
  const tables = docs?.getTables?.() || [];
  if (docs && !Object.keys(tables).length && documentRows > 0) {
    // exceljs may not expose tables the same way after load — soft check
  }
  return { ok: errors.length === 0, sheetNames, errors, documentRows, moneySample };
}
