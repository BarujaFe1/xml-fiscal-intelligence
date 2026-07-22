import { describe, expect, it } from "vitest";
import {
  emptyDocFilters,
  filterDocuments,
  filtersFromSearchParams,
  filtersToSearchParams,
  sumDocumentValues,
} from "@/lib/analytics";
import {
  clearSelection,
  countSelectedOutsideFilter,
  deselectFiltered,
  invertFilteredSelection,
  resolveSelectedDocuments,
  selectAllFiltered,
  selectionHeaderState,
  toggleDocumentSelection,
} from "@/lib/documents/selection";
import { buildSelectedBatchStore } from "@/lib/export/selected-store";
import { buildAccessKeysTxt } from "@/lib/export/access-keys";
import { buildDocumentsCsv, buildItemsCsv, buildBatchWorkbook } from "@/lib/export/excel";
import { sanitizeSpreadsheetCell } from "@/lib/export/sanitize";
import { uniqueZipEntryName, sanitizeExportFileName } from "@/lib/export/filenames";
import { buildSelectedXmlZip } from "@/lib/export/xml-zip";
import type { Batch, BatchStore, DocumentItem, DocumentSummary } from "@/types";
import type { RawXmlRecord } from "@/lib/store/raw-xml-store";

function doc(partial: Partial<DocumentSummary> & { id: string }): DocumentSummary {
  return {
    workspaceId: "w",
    batchId: "b1",
    documentType: "NFE",
    fileName: `${partial.id}.xml`,
    rawJson: {},
    flattenedJson: {},
    parseStatus: "ok",
    parseErrors: [],
    createdAt: new Date().toISOString(),
    ...partial,
  };
}

function item(partial: Partial<DocumentItem> & { id: string; documentId: string }): DocumentItem {
  return {
    workspaceId: "w",
    batchId: "b1",
    documentType: "NFE",
    itemNumber: 1,
    taxJson: {},
    rawJson: {},
    flattenedJson: {},
    ...partial,
  };
}

function batch(): Batch {
  return {
    id: "b1",
    workspaceId: "w",
    name: "lote-teste",
    uploadedFileName: "lote.zip",
    status: "completed",
    totalFiles: 3,
    totalXml: 3,
    validXml: 3,
    invalidXml: 0,
    nfeCount: 3,
    cteCount: 0,
    nfseCount: 0,
    unknownCount: 0,
    duplicateCount: 0,
    totalValue: 300,
    healthScore: 90,
    progress: 100,
    progressMessage: "ok",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    month: 6,
    year: 2026,
  };
}

function sampleStore(): BatchStore {
  return {
    batch: batch(),
    documents: [
      doc({
        id: "d1",
        number: "100",
        series: "1",
        model: "55",
        issueDate: "2026-06-10T12:00:00.000Z",
        emitterName: "Alpha",
        emitterDoc: "11222333000181",
        receiverName: "Beta",
        receiverDoc: "12345678901",
        emitterUf: "SP",
        receiverUf: "RJ",
        totalValue: 100,
        protocol: "p1",
        accessKey: "35260600000000000000550010000001001234567890",
        natureOperation: "Venda",
        operationClassification: "venda",
        cfopMain: "5102",
        qualityScore: 90,
      }),
      doc({
        id: "d2",
        number: "200",
        series: "1",
        issueDate: "2026-06-20T12:00:00.000Z",
        emitterName: "Gamma",
        emitterDoc: "99888777000166",
        receiverName: "Delta",
        emitterUf: "MG",
        receiverUf: "SP",
        totalValue: 200,
        isDuplicate: true,
        parseStatus: "partial",
        qualityScore: 40,
      }),
      doc({
        id: "d3",
        number: "300",
        issueDate: "2026-05-01T12:00:00.000Z",
        emitterName: "Alpha",
        emitterDoc: "11222333000181",
        emitterUf: "SP",
        receiverUf: "SP",
        totalValue: 50,
        accessKey: "35260500000000000000550010000003001234567890",
      }),
    ],
    items: [
      item({ id: "i1", documentId: "d1", cfop: "5102", ncm: "12345678", totalValue: 100 }),
      item({ id: "i2", documentId: "d2", cfop: "6102", ncm: "87654321", totalValue: 200 }),
      item({ id: "i3", documentId: "d3", cfop: "5102", totalValue: 50 }),
    ],
    fields: [],
    errors: [],
    exports: [],
    findings: [
      {
        id: "f1",
        workspaceId: "w",
        batchId: "b1",
        documentId: "d2",
        severity: "warning",
        category: "dup",
        code: "DUP",
        title: "Duplicata",
        description: "possivel",
        status: "open",
        createdAt: new Date().toISOString(),
      },
    ],
    relationships: [
      {
        id: "r1",
        workspaceId: "w",
        sourceDocumentId: "d1",
        targetDocumentId: "d2",
        relationshipType: "possible_duplicate",
        confidenceScore: 0.5,
        createdAt: new Date().toISOString(),
      },
      {
        id: "r2",
        workspaceId: "w",
        sourceDocumentId: "d1",
        targetDocumentId: "d3",
        relationshipType: "nfe_to_event",
        confidenceScore: 0.9,
        createdAt: new Date().toISOString(),
      },
    ],
  };
}

describe("extended document filters", () => {
  it("filters by inclusive emission period", () => {
    const store = sampleStore();
    const f = { ...emptyDocFilters(), dateFrom: "2026-06-10", dateTo: "2026-06-20" };
    expect(filterDocuments(store, f).map((d) => d.id)).toEqual(["d1", "d2"]);
  });

  it("filters by number, series, model and access key", () => {
    const store = sampleStore();
    expect(filterDocuments(store, { ...emptyDocFilters(), number: "100" }).map((d) => d.id)).toEqual([
      "d1",
    ]);
    expect(filterDocuments(store, { ...emptyDocFilters(), series: "1" }).map((d) => d.id)).toEqual([
      "d1",
      "d2",
    ]);
    expect(filterDocuments(store, { ...emptyDocFilters(), model: "55" }).map((d) => d.id)).toEqual([
      "d1",
    ]);
    expect(
      filterDocuments(store, { ...emptyDocFilters(), accessKey: "000000300" }).map((d) => d.id),
    ).toEqual(["d3"]);
  });

  it("filters by UF origin/dest, protocol, duplicate and quality range", () => {
    const store = sampleStore();
    expect(filterDocuments(store, { ...emptyDocFilters(), ufOrigin: "MG" }).map((d) => d.id)).toEqual([
      "d2",
    ]);
    expect(filterDocuments(store, { ...emptyDocFilters(), ufDest: "RJ" }).map((d) => d.id)).toEqual([
      "d1",
    ]);
    expect(filterDocuments(store, { ...emptyDocFilters(), protocol: "with" }).map((d) => d.id)).toEqual([
      "d1",
    ]);
    expect(
      filterDocuments(store, { ...emptyDocFilters(), duplicate: "duplicate" }).map((d) => d.id),
    ).toEqual(["d2"]);
    expect(
      filterDocuments(store, { ...emptyDocFilters(), qualityMin: "80" }).map((d) => d.id),
    ).toEqual(["d1"]);
  });

  it("combines multiple filters and value bounds", () => {
    const store = sampleStore();
    const rows = filterDocuments(store, {
      ...emptyDocFilters(),
      emitter: "Alpha",
      minValue: "40",
      maxValue: "120",
      ufOrigin: "SP",
    });
    expect(rows.map((d) => d.id).sort()).toEqual(["d1", "d3"]);
    expect(sumDocumentValues(rows)).toBe(150);
  });

  it("round-trips new URL params while keeping legacy ones", () => {
    const f = {
      ...emptyDocFilters(),
      q: "alpha",
      type: "NFE",
      minValue: "10",
      dateFrom: "2026-01-01",
      ufOrigin: "SP",
      protocol: "without",
    };
    const sp = filtersToSearchParams(f);
    expect(sp.get("q")).toBe("alpha");
    expect(sp.get("min")).toBe("10");
    expect(sp.get("from")).toBe("2026-01-01");
    expect(sp.get("ufOrigin")).toBe("SP");
    const back = filtersFromSearchParams(sp);
    expect(back.dateFrom).toBe("2026-01-01");
    expect(back.protocol).toBe("without");
    // legacy alert param still works
    expect(filtersFromSearchParams(new URLSearchParams("alert=NO_KEY")).alert).toBe("NO_KEY");
  });
});

describe("document selection", () => {
  it("toggles individual ids and computes tri-state", () => {
    let sel = new Set<string>();
    sel = toggleDocumentSelection(sel, "d1");
    expect(selectionHeaderState(["d1", "d2"], sel)).toBe("some");
    sel = toggleDocumentSelection(sel, "d2");
    expect(selectionHeaderState(["d1", "d2"], sel)).toBe("all");
    sel = toggleDocumentSelection(sel, "d1");
    expect(selectionHeaderState(["d1", "d2"], sel)).toBe("some");
  });

  it("selects all filtered without clearing outside selection", () => {
    let sel = new Set(["outside"]);
    sel = selectAllFiltered(sel, ["d1", "d2"]);
    expect([...sel].sort()).toEqual(["d1", "d2", "outside"]);
    expect(countSelectedOutsideFilter(sel, ["d1", "d2"])).toBe(1);
    sel = deselectFiltered(sel, ["d1", "d2"]);
    expect([...sel]).toEqual(["outside"]);
    sel = invertFilteredSelection(sel, ["d1"]);
    expect(sel.has("d1")).toBe(true);
    sel = clearSelection();
    expect(sel.size).toBe(0);
  });

  it("resolves missing ids without corrupting totals", () => {
    const store = sampleStore();
    const res = resolveSelectedDocuments(store.documents, new Set(["d1", "missing", "d2"]));
    expect(res.found.map((d) => d.id).sort()).toEqual(["d1", "d2"]);
    expect(res.missingIds).toEqual(["missing"]);
    expect(res.totalValue).toBe(300);
  });
});

describe("buildSelectedBatchStore", () => {
  it("keeps only selected docs/items and drops orphan relationships", () => {
    const store = sampleStore();
    const { store: selected, missingIds } = buildSelectedBatchStore(store, ["d1", "ghost"]);
    expect(missingIds).toEqual(["ghost"]);
    expect(selected.documents.map((d) => d.id)).toEqual(["d1"]);
    expect(selected.items.every((i) => i.documentId === "d1")).toBe(true);
    expect(selected.items).toHaveLength(1);
    expect(selected.relationships).toEqual([]);
    expect(selected.batch.totalValue).toBe(100);
    expect(selected.findings).toEqual([]);
  });

  it("keeps relationship only when both sides selected", () => {
    const store = sampleStore();
    const { store: selected } = buildSelectedBatchStore(store, ["d1", "d3"]);
    expect(selected.relationships?.map((r) => r.id)).toEqual(["r2"]);
    expect(selected.items.map((i) => i.id).sort()).toEqual(["i1", "i3"]);
  });
});

describe("selection exports", () => {
  it("CSV/XLSX/JSON only include selected documents and sanitize formulas", async () => {
    expect(sanitizeSpreadsheetCell("=1+1")).toBe("'=1+1");
    const store = sampleStore();
    store.documents[0].emitterName = "=CMD()";
    const { store: selected } = buildSelectedBatchStore(store, ["d1"]);
    const csv = buildDocumentsCsv(selected, { separator: ";" });
    expect(csv).toContain("d1");
    expect(csv).not.toContain("d2");
    expect(csv).toContain("'=CMD()");
    expect(csv.split("\n").some((l) => l.includes(";") && l.includes("d1"))).toBe(true);

    const itemsCsv = buildItemsCsv(selected, { separator: ";" });
    expect(itemsCsv).toContain("d1");
    expect(itemsCsv).toContain("5102");
    expect(itemsCsv).not.toContain("i2");
    expect(itemsCsv).not.toContain("6102");

    const buf = await buildBatchWorkbook(selected);
    expect(buf.byteLength).toBeGreaterThan(1000);
    // Excel must include CBS etiqueta columns for supplier outreach.
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    const docs = wb.getWorksheet("Documentos");
    const headers: string[] = [];
    docs?.getRow(1).eachCell((c) => headers.push(String(c.value)));
    expect(headers).toEqual(
      expect.arrayContaining([
        "etiqueta_cbs",
        "soma_cbs",
        "fonte_soma_cbs",
        "etiqueta_ibs",
        "soma_ibs",
        "fonte_soma_ibs",
      ]),
    );
    expect(wb.getWorksheet("CBS_Fornecedores")).toBeTruthy();

    const keys = buildAccessKeysTxt(selected.documents);
    expect(keys.exportedKeys).toBe(1);
    expect(keys.text.trim().split("\n")).toHaveLength(1);
    expect(keys.withoutKey).toBe(0);
  });

  it("TXT skips empty keys and dedupes", () => {
    const docs = [
      doc({ id: "a", accessKey: "AAA" }),
      doc({ id: "b", accessKey: "" }),
      doc({ id: "c", accessKey: "AAA" }),
      doc({ id: "d" }),
    ];
    const keys = buildAccessKeysTxt(docs);
    expect(keys.exportedKeys).toBe(1);
    expect(keys.withoutKey).toBe(2);
    expect(keys.duplicatesSkipped).toBe(1);
  });

  it("ZIP contains exactly selected original XMLs and resists path tricks", async () => {
    const store = sampleStore();
    const raw = new Map<string, RawXmlRecord>([
      [
        "d1",
        {
          id: "b1:d1",
          batchId: "b1",
          documentId: "d1",
          fileName: "../evil.xml",
          xmlHash: "hash1",
          content: "<nfe>one</nfe>",
          byteLength: 14,
          createdAt: new Date().toISOString(),
        },
      ],
      [
        "d2",
        {
          id: "b1:d2",
          batchId: "b1",
          documentId: "d2",
          fileName: "same.xml",
          xmlHash: "hash2",
          content: "<nfe>two</nfe>",
          byteLength: 14,
          createdAt: new Date().toISOString(),
        },
      ],
    ]);

    expect(sanitizeExportFileName("../evil.xml")).toBe("evil.xml");
    const used = new Set<string>();
    expect(uniqueZipEntryName("same.xml", used)).toBe("same.xml");
    expect(uniqueZipEntryName("same.xml", used)).toBe("same__2.xml");

    const zip = await buildSelectedXmlZip({
      store,
      selectedDocuments: store.documents.filter((d) => d.id === "d1" || d.id === "d2"),
      rawByDocumentId: raw,
      allowPartial: true,
      organizeByType: true,
    });
    expect(zip.ok).toBe(true);
    if (!zip.ok) return;
    expect(zip.exported).toHaveLength(2);
    expect(zip.manifest.counts).toMatchObject({ requested: 2, exported: 2 });
    expect((zip.manifest.files as Array<{ xmlHash: string }>).map((f) => f.xmlHash).sort()).toEqual([
      "hash1",
      "hash2",
    ]);

    const oldBatch = await buildSelectedXmlZip({
      store,
      selectedDocuments: [store.documents[2]],
      rawByDocumentId: new Map(),
      allowPartial: true,
    });
    expect(oldBatch.ok).toBe(false);
    if (!oldBatch.ok) {
      expect(oldBatch.reason).toBe("no_xml_available");
    }
  });
});
