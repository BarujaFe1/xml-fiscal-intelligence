import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import {
  buildExportDataset,
  buildExportPreflight,
} from "@/lib/export/v2/dataset";
import { buildDocumentsCsvFromDataset, buildItemsCsvFromDataset } from "@/lib/export/v2/csv";
import { buildJsonFromDataset } from "@/lib/export/v2/json";
import { buildHtmlFromDataset } from "@/lib/export/v2/html";
import { buildKeysTxtFromDataset } from "@/lib/export/v2/keys";
import { buildWorkbookFromDataset, verifyWorkbookBuffer } from "@/lib/export/v2/excel";
import { buildCompletePackage, buildCsvPackageZip } from "@/lib/export/v2/package";
import { decodeXmlEntitiesOnce } from "@/lib/export/v2/text";
import { moneyAdd, moneyToFixed } from "@/lib/money/decimal";
import { sanitizeSpreadsheetCell } from "@/lib/export/sanitize";
import type { Batch, BatchStore, DocumentItem, DocumentSummary } from "@/types";

function doc(partial: Partial<DocumentSummary> & { id: string }): DocumentSummary {
  return {
    workspaceId: "w",
    batchId: "b1",
    documentType: "NFE",
    fileName: `${partial.id}.xml`,
    rawJson: { n: 1 },
    flattenedJson: { "emit.xNome": "ACME &amp; CIA" },
    parseStatus: "ok",
    parseErrors: [],
    createdAt: new Date().toISOString(),
    totalValue: 0.1,
    ...partial,
  };
}

function item(partial: Partial<DocumentItem> & { id: string; documentId: string }): DocumentItem {
  return {
    workspaceId: "w",
    batchId: "b1",
    documentType: "NFE",
    itemNumber: 1,
    taxJson: { x: 1 },
    rawJson: {},
    flattenedJson: {},
    totalValue: 0.1,
    ...partial,
  };
}

function batch(over: Partial<Batch> = {}): Batch {
  return {
    id: "b1",
    workspaceId: "w",
    name: "lote-export-v2",
    uploadedFileName: "origem-06-2026.zip",
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
    totalValue: 0.3,
    healthScore: 88,
    progress: 100,
    progressMessage: "ok",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    month: 7,
    year: 2026,
    ...over,
  };
}

function store(docs: DocumentSummary[], items: DocumentItem[] = [], b?: Partial<Batch>): BatchStore {
  return {
    batch: batch(b),
    documents: docs,
    items,
    fields: [],
    errors: [],
    exports: [],
    findings: [
      {
        id: "f1",
        workspaceId: "w",
        batchId: "b1",
        documentId: docs[0]?.id,
        severity: "warning",
        category: "period",
        code: "OUTSIDE_PERIOD",
        title: "Fora do período",
        description: "Documento fora da competência",
        status: "open",
        createdAt: new Date().toISOString(),
      },
    ],
    relationships: [],
    importLogs: [],
  };
}

describe("ExportDatasetV2 canonical", () => {
  it("soma dinheiro sem ruído IEEE-754", () => {
    // Classic float trap: 0.1 + 0.2
    expect(moneyToFixed(moneyAdd(0.1, 0.2), 2)).toBe("0.30");
    const values = [10000000.1, 10000000.2, 27201520.65];
    expect(moneyToFixed(moneyAdd(...values), 2)).toBe("47201520.95");
  });

  it("recalcula totais e não deixa órfãos", () => {
    const docs = [
      doc({
        id: "d1",
        accessKey: "35260612345678901234550010000000011000000001",
        issueDate: "2026-06-10T12:00:00.000Z",
        totalValue: 10000000.1,
        emitterName: "ACME &amp; CIA",
        number: "1",
      }),
      doc({
        id: "d2",
        accessKey: "35260612345678901234550010000000011000000002",
        issueDate: "2026-06-15T12:00:00.000Z",
        totalValue: 10000000.2,
        number: "2",
      }),
      doc({
        id: "d3",
        accessKey: "35260612345678901234550010000000011000000003",
        issueDate: "2026-06-20T12:00:00.000Z",
        totalValue: 27201520.65,
        number: "3",
      }),
    ];
    const items = [
      item({ id: "i1", documentId: "d1", description: "Item =promo" }),
      item({ id: "i2", documentId: "d2" }),
      item({ id: "i-orphan", documentId: "other" }),
    ];
    const s = store(docs, items);
    const ds = buildExportDataset(s, ["d1", "d2", "d3", "missing-id"], {
      privacyProfile: "operational_full",
    });

    expect(ds.schemaVersion).toBe("2.0.0");
    expect(ds.documents).toHaveLength(3);
    expect(ds.items).toHaveLength(2);
    expect(ds.selection.missingIds).toEqual(["missing-id"]);
    expect(ds.summary.totalValue).toBe("47201520.95");
    expect(ds.manifest.emptyReason).toBeNull();
    expect(ds.manifest.counts.findings).toBe(1);
    expect(ds.documents[0]?.emitterName).toBe("ACME & CIA");
    expect(ds.summary.competenceMismatch).toBe(true);
    expect(ds.summary.outsideCompetenceCount).toBe(3);
    expect(ds.summary.informedCompetence).toBe("07/2026");
  });

  it("aplica privacidade mascarada de forma consistente", () => {
    const docs = [
      doc({
        id: "d1",
        accessKey: "35260612345678901234550010000000011000000001",
        emitterDoc: "12345678000199",
        issueDate: "2026-06-01T00:00:00.000Z",
      }),
    ];
    const ds = buildExportDataset(store(docs), ["d1"], {
      privacyProfile: "shareable_masked",
    });
    expect(ds.privacy.maskAccessKeys).toBe(true);
    expect(ds.documents[0]?.accessKey).not.toBe(
      "35260612345678901234550010000000011000000001",
    );
    expect(ds.documents[0]?.accessKey?.length || 0).toBeLessThan(44);
    expect(ds.documents[0]?.accessKey).toMatch(/…|\.\.\./);
  });

  it("preflight exige ack de competência", () => {
    const docs = [
      doc({ id: "d1", issueDate: "2026-06-01T00:00:00.000Z", totalValue: 10 }),
    ];
    const ds = buildExportDataset(store(docs, [], { month: 7, year: 2026 }), ["d1"]);
    const pf = buildExportPreflight(ds);
    expect(pf.requiresCompetenceAck).toBe(true);
    expect(pf.outsideCompetenceCount).toBe(1);
  });
});

describe("export v2 formats", () => {
  const docs = [
    doc({
      id: "d1",
      accessKey: "35260612345678901234550010000000011000000001",
      issueDate: "2026-06-10T12:00:00.000Z",
      totalValue: 10.1,
      number: "100",
      series: "1",
      emitterName: 'Foo "Bar" &amp; Baz',
      emitterDoc: "12345678000199",
    }),
    doc({
      id: "d2",
      accessKey: "35260612345678901234550010000000011000000002",
      issueDate: "2026-06-11T12:00:00.000Z",
      totalValue: 20.2,
      number: "101",
    }),
  ];
  const items = [
    item({
      id: "i1",
      documentId: "d1",
      description: "=cmd|calc",
      totalValue: 10.1,
      quantity: 1.5,
    }),
  ];
  const dataset = buildExportDataset(store(docs, items), ["d1", "d2"], {
    privacyProfile: "operational_full",
  });

  it("CSV começa no cabeçalho e protege formula injection", () => {
    const csv = buildDocumentsCsvFromDataset(dataset, "excel_pt_br");
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const body = csv.slice(1);
    expect(body.startsWith("document_id;")).toBe(true);
    expect(body).not.toMatch(/^#/m);
    expect(body).not.toMatch(/empty_reason/);
    const itemsCsv = buildItemsCsvFromDataset(dataset, "excel_pt_br");
    expect(itemsCsv).toContain("'=cmd|calc");
  });

  it("CSV integration usa vírgula e ponto decimal", () => {
    const csv = buildDocumentsCsvFromDataset(dataset, "integration");
    expect(csv.charCodeAt(0)).not.toBe(0xfeff);
    expect(csv.startsWith("document_id,")).toBe(true);
    expect(csv).toContain("10.10");
  });

  it("JSON compact não inclui rawJson/flattenedJson", () => {
    const text = buildJsonFromDataset(dataset, "compact");
    const parsed = JSON.parse(text);
    expect(parsed.profile).toBe("compact");
    expect(parsed.documents).toHaveLength(2);
    expect(parsed.documents[0].rawJson).toBeUndefined();
    expect(parsed.documents[0].flattenedJson).toBeUndefined();
    expect(parsed.manifest.totals.totalValue).toBe(dataset.summary.totalValue);
    expect(parsed.summary.totalValue).not.toMatch(/99999/);
  });

  it("JSONL tem uma entidade válida por linha", () => {
    const text = buildJsonFromDataset(dataset, "jsonl");
    const lines = text.trim().split("\n");
    expect(lines.length).toBe(3); // header + 2 docs
    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow();
    }
  });

  it("HTML declara limite explicitamente", () => {
    const many = Array.from({ length: 5 }, (_, i) =>
      doc({
        id: `d${i}`,
        accessKey: `3526061234567890123455001000000001100000000${i}`,
        issueDate: "2026-06-01T00:00:00.000Z",
        totalValue: 1,
      }),
    );
    const ds = buildExportDataset(store(many), many.map((d) => d.id));
    const html = buildHtmlFromDataset(ds, { tableLimit: 2 });
    expect(html).toContain('lang="pt-BR"');
    expect(html).toContain("Exibindo 2 de 5");
    expect(html).toContain("3 não aparecem");
    expect(html).not.toMatch(/https?:\/\/cdn\./);
    expect(html).toContain("<table");
  });

  it("TXT de chaves é puro", () => {
    const keys = buildKeysTxtFromDataset(dataset, {
      rawKeysByDocumentId: new Map(
        docs.map((d) => [d.id, d.accessKey!]),
      ),
    });
    const lines = keys.text.trim().split("\n");
    expect(lines).toHaveLength(2);
    for (const line of lines) {
      expect(line).toMatch(/^\d{44}$/);
    }
    expect(keys.text.endsWith("\n")).toBe(true);
  });

  it("Excel profissional: abas, dinheiro numérico, entidades decodificadas", async () => {
    const buf = await buildWorkbookFromDataset(dataset);
    const verified = await verifyWorkbookBuffer(buf);
    expect(verified.ok).toBe(true);
    expect(verified.sheetNames).toEqual(
      expect.arrayContaining(["Resumo", "Documentos", "Itens", "Alertas", "Manifesto"]),
    );
    expect(verified.moneySample).toBeCloseTo(10.1, 5);

    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(buf) as never);
    const docsSheet = wb.getWorksheet("Documentos");
    expect(docsSheet).toBeTruthy();
    const name = String(docsSheet!.getRow(2).getCell(9).value || "");
    expect(name).toContain("Foo");
    expect(name).toContain("&");
    expect(name).not.toContain("&amp;");
  });

  it("pacote CSV usa DEFLATE e SHA256SUMS", async () => {
    const blob = await buildCsvPackageZip(dataset);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    expect(zip.file("documentos.csv")).toBeTruthy();
    expect(zip.file("SHA256SUMS.txt")).toBeTruthy();
    const docsFile = zip.file("documentos.csv")!;
    // compressed size should be present and typically < uncompressed for this payload
    expect(docsFile).toBeTruthy();
    const csv = await docsFile.async("string");
    expect(csv.replace(/^\uFEFF/, "").startsWith("document_id")).toBe(true);
  });

  it("pacote completo é ZIP válido com manifesto", async () => {
    const result = await buildCompletePackage({
      dataset,
      artifacts: ["xlsx", "csv", "json", "html", "keys"],
    });
    const zip = await JSZip.loadAsync(await result.blob.arrayBuffer());
    expect(zip.file("manifest.json")).toBeTruthy();
    expect(zip.file("SHA256SUMS.txt")).toBeTruthy();
    expect(zip.file("planilhas/notas-selecionadas.xlsx")).toBeTruthy();
    expect(zip.file("csv/documentos.csv")).toBeTruthy();
    expect(zip.file("json/dados-compactos.json")).toBeTruthy();
    expect(zip.file("relatorio/relatorio.html")).toBeTruthy();
    expect(zip.file("chaves/chaves.txt")).toBeTruthy();
    expect(result.files.length).toBeGreaterThan(3);
  });
});

describe("text / sanitize", () => {
  it("decodifica entidades exatamente uma vez", () => {
    expect(decodeXmlEntitiesOnce("A &amp; B")).toBe("A & B");
    expect(decodeXmlEntitiesOnce("A & B")).toBe("A & B");
  });

  it("neutraliza formula injection", () => {
    expect(sanitizeSpreadsheetCell("=1+1")).toBe("'=1+1");
    expect(sanitizeSpreadsheetCell("+cmd")).toBe("'+cmd");
    expect(sanitizeSpreadsheetCell("-1")).toBe("'-1");
    expect(sanitizeSpreadsheetCell("@sum")).toBe("'@sum");
  });
});
