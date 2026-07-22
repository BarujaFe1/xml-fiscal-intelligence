import { describe, expect, it } from "vitest";
import { resolveSelectionAcrossStores } from "@/lib/export/resolve-selection";
import { buildWorkbookFromDataset, verifyWorkbookBuffer } from "@/lib/export/v2/excel";
import { buildExportDataset } from "@/lib/export/v2/dataset";
import { buildFieldSelectionWorkbook } from "@/lib/export/fields/workbook";
import { buildDefaultPreset, defaultFieldDefinitions } from "@/lib/export/fields/defaults";
import type { Batch, BatchStore, DocumentSummary } from "@/types";
import ExcelJS from "exceljs";

function baseBatch(id: string, name: string): Batch {
  const now = new Date().toISOString();
  return {
    id,
    workspaceId: "ws",
    name,
    uploadedFileName: `${id}.zip`,
    status: "completed",
    totalFiles: 1,
    totalXml: 1,
    validXml: 1,
    invalidXml: 0,
    nfeCount: 1,
    cteCount: 0,
    nfseCount: 0,
    unknownCount: 0,
    duplicateCount: 0,
    totalValue: 10,
    healthScore: 80,
    progress: 100,
    progressMessage: "ok",
    createdAt: now,
    updatedAt: now,
  };
}

function doc(partial: Partial<DocumentSummary> & { id: string }): DocumentSummary {
  const { id, ...rest } = partial;
  return {
    id,
    workspaceId: "ws",
    batchId: rest.batchId || "b1",
    documentType: "NFE",
    number: rest.number || "1",
    accessKey: rest.accessKey || "1".repeat(44),
    totalValue: rest.totalValue ?? 10,
    parseStatus: "ok",
    fileName: `${id}.xml`,
    flattenedJson: rest.flattenedJson || {},
    ...rest,
  } as DocumentSummary;
}

function store(id: string, docs: DocumentSummary[]): BatchStore {
  return {
    batch: { ...baseBatch(id, `Lote ${id}`), validXml: docs.length, totalXml: docs.length, nfeCount: docs.length },
    documents: docs,
    items: [],
    findings: [],
    relationships: [],
    fields: [],
    errors: [],
    exports: [],
  };
}

describe("resolveSelectionAcrossStores", () => {
  it("keeps documents from multiple batches", () => {
    const a = store("ba", [doc({ id: "d1", number: "10" }), doc({ id: "d2", number: "11" })]);
    const b = store("bb", [doc({ id: "d3", number: "20" })]);
    const resolved = resolveSelectionAcrossStores([a, b], ["ba:d1", "bb:d3"]);
    expect(resolved.documentIds.sort()).toEqual(["d1", "d3"]);
    expect(resolved.batchCount).toBe(2);
    expect(resolved.store.documents.map((d) => d.number).sort()).toEqual(["10", "20"]);
    expect(resolved.missingCompositeIds).toEqual([]);
  });

  it("reports missing composite ids", () => {
    const a = store("ba", [doc({ id: "d1" })]);
    const resolved = resolveSelectionAcrossStores([a], ["ba:d1", "ba:missing"]);
    expect(resolved.documentIds).toEqual(["d1"]);
    expect(resolved.missingCompositeIds).toEqual(["ba:missing"]);
  });
});

describe("xlsx integrity (no empty-table corruption)", () => {
  it("v2 workbook retains document body cells after write/reload", async () => {
    const s = store("ba", [
      doc({
        id: "d1",
        number: "99",
        totalValue: 1234.56,
        accessKey: "35260612345678000190550010000000011000000010",
      }),
    ]);
    const dataset = buildExportDataset(s, ["d1"], { privacyProfile: "operational_full" });
    const buf = await buildWorkbookFromDataset(dataset);
    const verify = await verifyWorkbookBuffer(buf);
    expect(verify.ok, verify.errors.join("; ")).toBe(true);
    expect(verify.documentRows).toBe(1);
    expect(verify.dataCellSampleOk).toBe(true);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(new Uint8Array(buf) as unknown as ExcelJS.Buffer);
    const docs = wb.getWorksheet("Documentos");
    expect(docs?.getRow(2).getCell(2).value).toBeTruthy();
    expect(typeof docs?.getRow(2).getCell(16).value).toBe("number");
  });

  it("field workbook Campos Selecionados retains rows", async () => {
    const s = store("ba", [doc({ id: "d1", number: "77", accessKey: "1".repeat(44) })]);
    const defs = defaultFieldDefinitions();
    const buf = await buildFieldSelectionWorkbook({
      rows: [
        {
          selectionId: "ba:d1",
          batchId: "ba",
          batchName: "Lote ba",
          origin: "local",
          document: s.documents[0]!,
        },
      ],
      fieldDefs: defs,
      preset: buildDefaultPreset(),
      registry: defs,
      generationId: "gen-test",
      privacyNote: "teste",
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(new Uint8Array(buf) as unknown as ExcelJS.Buffer);
    const sheet = wb.getWorksheet("Campos Selecionados");
    expect(sheet).toBeTruthy();
    expect(sheet!.rowCount).toBeGreaterThanOrEqual(2);
    expect(sheet!.getRow(2).getCell(1).value).toBeTruthy();
  });
});
