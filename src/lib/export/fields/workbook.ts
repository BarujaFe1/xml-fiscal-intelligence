import ExcelJS from "exceljs";
import type { ExportFieldDefinition, ExportFieldPreset } from "@/lib/export/fields/types";
import { buildSelectedRow, iterateFieldOccurrences } from "@/lib/export/fields/resolve";
import { sanitizeSpreadsheetCell } from "@/lib/export/sanitize";
import type { WorkspaceDocument } from "@/lib/documents/workspace-types";
import { moneyToFixed, moneyAdd } from "@/lib/money/decimal";

const MONEY_FMT = '"R$"#,##0.00';
const EXCEL_MAX_ROWS = 1_048_576;
const SHEET_DATA_LIMIT = EXCEL_MAX_ROWS - 2;

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true };
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE8EEF6" },
  };
}

/**
 * Build workbook with Resumo, Campos Selecionados, Todos os Campos (+ splits), Manifesto.
 */
export async function buildFieldSelectionWorkbook(input: {
  rows: WorkspaceDocument[];
  fieldDefs: ExportFieldDefinition[];
  preset: ExportFieldPreset;
  registry: ExportFieldDefinition[];
  generationId: string;
  privacyNote: string;
}): Promise<ArrayBuffer> {
  const { rows, fieldDefs, preset, registry, generationId, privacyNote } = input;
  const wb = new ExcelJS.Workbook();
  wb.creator = "XML Fiscal Intelligence";
  wb.created = new Date();

  const ordered = [...preset.columns]
    .sort((a, b) => a.order - b.order)
    .map((c) => {
      const def = fieldDefs.find((f) => f.fieldId === c.fieldId) ||
        registry.find((f) => f.fieldId === c.fieldId);
      return { col: c, def };
    })
    .filter((x): x is { col: (typeof preset.columns)[0]; def: ExportFieldDefinition } => Boolean(x.def));

  // Resumo
  {
    const ws = wb.addWorksheet("Resumo");
    ws.getColumn(1).width = 36;
    ws.getColumn(2).width = 40;
    const batches = new Set(rows.map((r) => r.batchId));
    const total = moneyToFixed(moneyAdd(...rows.map((r) => r.document.totalValue ?? 0)), 2);
    const dates = rows
      .map((r) => r.document.issueDate)
      .filter(Boolean)
      .sort();
    const lines: Array<[string, string | number]> = [
      ["Geração", generationId],
      ["Lotes", batches.size],
      ["Documentos", rows.length],
      ["Valor total", total],
      ["Período mín", dates[0] || "—"],
      ["Período máx", dates[dates.length - 1] || "—"],
      ["Preset", preset.name],
      ["Colunas selecionadas", ordered.length],
      ["Privacidade", privacyNote],
    ];
    ws.addRow(["Indicador", "Valor"]);
    styleHeader(ws.getRow(1));
    for (const [k, v] of lines) ws.addRow([k, v]);
    ws.getCell("B5").numFmt = MONEY_FMT;
  }

  // Campos Selecionados
  {
    const ws = wb.addWorksheet("Campos Selecionados");
    const headers = [
      "LOTE",
      "COMPETÊNCIA",
      ...ordered.map((o) => o.col.headerOverride || o.def.humanLabelPtBr),
    ];
    ws.addRow(headers);
    styleHeader(ws.getRow(1));

    for (const row of rows) {
      const aggs: Record<string, NonNullable<(typeof ordered)[0]["col"]["aggregation"]>> = {};
      for (const o of ordered) {
        if (o.col.aggregation) aggs[o.def.fieldId] = o.col.aggregation;
      }
      const values = buildSelectedRow(
        row.document,
        ordered.map((o) => o.def),
        aggs,
      );
      const line = [
        row.batchName,
        row.competence || "",
        ...ordered.map((o) => sanitizeSpreadsheetCell(values[o.def.fieldId] ?? "")),
      ];
      const excelRow = ws.addRow(line);
      // Try money format for known money fields
      ordered.forEach((o, idx) => {
        if (
          o.def.defaultAggregation === "decimal_sum" ||
          o.def.fieldId.includes("cbs") ||
          o.def.fieldId.includes("ibs") ||
          o.def.fieldId.includes("duplic")
        ) {
          const cell = excelRow.getCell(idx + 3);
          const n = Number(String(values[o.def.fieldId] || "").replace(",", "."));
          if (Number.isFinite(n) && values[o.def.fieldId]) {
            cell.value = n;
            cell.numFmt = MONEY_FMT;
          }
        }
      });
    }

    const last = Math.max(1, rows.length + 1);
    if (rows.length > 0) {
      ws.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: last, column: headers.length },
      };
    }
    ws.views = [{ state: "frozen", xSplit: 2, ySplit: 1 }];
    headers.forEach((_, i) => {
      ws.getColumn(i + 1).width = i < 2 ? 18 : 22;
    });
  }

  // Todos os Campos (long form, possibly split)
  {
    const registryByPath = new Map<string, ExportFieldDefinition>();
    for (const f of registry) {
      for (const p of f.xmlPaths) registryByPath.set(p, f);
    }

    const headers = [
      "Lote",
      "Documento ID",
      "Chave",
      "Número",
      "Escopo",
      "Item/ocorrência",
      "Caminho XML exato",
      "Tag",
      "Nome humano",
      "Tipo",
      "Valor",
    ];

    let sheetIndex = 1;
    let ws = wb.addWorksheet(sheetIndex === 1 ? "Todos os Campos" : `TodosCampos_${String(sheetIndex).padStart(3, "0")}`);
    ws.addRow(headers);
    styleHeader(ws.getRow(1));
    let rowCount = 1;
    let totalOccurrences = 0;

    const openNext = () => {
      sheetIndex += 1;
      ws = wb.addWorksheet(`TodosCampos_${String(sheetIndex).padStart(3, "0")}`);
      ws.addRow(headers);
      styleHeader(ws.getRow(1));
      rowCount = 1;
    };

    for (const row of rows) {
      for (const occ of iterateFieldOccurrences(
        row.document,
        { batchId: row.batchId, batchName: row.batchName },
        registryByPath,
      )) {
        if (rowCount >= SHEET_DATA_LIMIT) openNext();
        ws.addRow([
          occ.batchName || occ.batchId,
          sanitizeSpreadsheetCell(occ.documentId),
          sanitizeSpreadsheetCell(occ.accessKey || ""),
          sanitizeSpreadsheetCell(occ.number || ""),
          occ.scope,
          occ.occurrenceIndex ?? "",
          sanitizeSpreadsheetCell(occ.xmlPath),
          sanitizeSpreadsheetCell(occ.tag),
          sanitizeSpreadsheetCell(occ.humanLabel),
          occ.dataType,
          sanitizeSpreadsheetCell(occ.value),
        ]);
        rowCount += 1;
        totalOccurrences += 1;
      }
    }

    // Manifest extras stored later
    (wb as unknown as { __allFieldsMeta?: { sheets: number; occurrences: number } }).__allFieldsMeta = {
      sheets: sheetIndex,
      occurrences: totalOccurrences,
    };
  }

  // Manifesto
  {
    const meta = (wb as unknown as { __allFieldsMeta?: { sheets: number; occurrences: number } })
      .__allFieldsMeta || { sheets: 1, occurrences: 0 };
    const ws = wb.addWorksheet("Manifesto");
    ws.getColumn(1).width = 28;
    ws.getColumn(2).width = 80;
    ws.addRow(["Campo", "Valor"]);
    styleHeader(ws.getRow(1));
    const lines: Array<[string, string | number]> = [
      ["generationId", generationId],
      ["presetId", preset.id],
      ["presetName", preset.name],
      ["documents", rows.length],
      ["selectedColumns", ordered.length],
      ["allFieldsSheets", meta.sheets],
      ["allFieldsOccurrences", meta.occurrences],
      ["privacy", privacyNote],
      [
        "columns",
        ordered
          .map(
            (o) =>
              `${o.col.order}:${o.def.fieldId}:${o.col.aggregation || o.def.defaultAggregation || "first"}`,
          )
          .join("; "),
      ],
      [
        "note",
        "Todos os Campos usa flattenedJson do documento. Lotes antigos sem flatten completo exigem reimportação.",
      ],
    ];
    for (const [k, v] of lines) ws.addRow([k, v]);
  }

  const buf = await wb.xlsx.writeBuffer();
  return buf as ArrayBuffer;
}

function colLetter(n: number): string {
  let s = "";
  let x = n;
  while (x > 0) {
    const m = (x - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s || "A";
}
