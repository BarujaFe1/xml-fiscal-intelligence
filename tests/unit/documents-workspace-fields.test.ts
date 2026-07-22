import { describe, expect, it } from "vitest";
import { detectDocumentType, extractIdeMod } from "@/lib/parser/detect";
import { XMLParser } from "fast-xml-parser";
import { buildDefaultPreset, DEFAULT_FIELD_SPECS } from "@/lib/export/fields/defaults";
import { buildFieldRegistry, catalogStats } from "@/lib/export/fields/registry";
import { resolveFieldValue } from "@/lib/export/fields/resolve";
import { buildFieldSelectionWorkbook } from "@/lib/export/fields/workbook";
import { buildFacetIndex, filterPartyOptions } from "@/lib/documents/facets";
import { filterWorkspaceDocuments } from "@/lib/documents/workspace-filter";
import { emptyAppliedFacets, selectionId } from "@/lib/documents/workspace-types";
import { moneyAdd, moneyToFixed } from "@/lib/money/decimal";
import type { Batch, BatchStore, DocumentSummary } from "@/types";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: false,
  trimValues: true,
  parseTagValue: false,
  parseAttributeValue: false,
  processEntities: false,
});

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
    totalValue: 10,
    ...partial,
  };
}

function batch(id = "b1", over: Partial<Batch> = {}): Batch {
  return {
    id,
    workspaceId: "w",
    name: `lote-${id}`,
    uploadedFileName: "x.zip",
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
    healthScore: 90,
    progress: 100,
    progressMessage: "ok",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    month: 6,
    year: 2026,
    ...over,
  };
}

function store(docs: DocumentSummary[], id = "b1"): BatchStore {
  return {
    batch: batch(id),
    documents: docs.map((d) => ({ ...d, batchId: id })),
    items: [],
    fields: [],
    errors: [],
    exports: [],
    findings: [],
    relationships: [],
    importLogs: [],
  };
}

describe("detect NFE vs NFCE — ide/mod prevails", () => {
  it("mod=55 is NFE even if raw contains nfce noise", () => {
    const xml = `<?xml version="1.0"?><nfeProc><NFe><infNFe><ide><mod>55</mod><nNF>1</nNF></ide></infNFe></NFe></nfeProc>`;
    const parsed = parser.parse(xml);
    expect(extractIdeMod(parsed)).toBe("55");
    expect(detectDocumentType(parsed, xml + " nfce ")).toBe("NFE");
  });

  it("mod=65 is NFCE", () => {
    const xml = `<?xml version="1.0"?><nfeProc><NFe><infNFe><ide><mod>65</mod></ide></infNFe></NFe></nfeProc>`;
    const parsed = parser.parse(xml);
    expect(detectDocumentType(parsed, xml)).toBe("NFCE");
  });
});

describe("field registry & defaults", () => {
  it("loads inventory seed with 518 fields and 13 defaults", () => {
    const stats = catalogStats();
    expect(stats.seedFieldCount).toBe(518);
    expect(DEFAULT_FIELD_SPECS).toHaveLength(13);
    expect(DEFAULT_FIELD_SPECS[0]?.header).toBe("CHAVE DE ACESSO");
    expect(DEFAULT_FIELD_SPECS[12]?.header).toBe("CCASSTRIB");
    const preset = buildDefaultPreset();
    expect(preset.columns).toHaveLength(13);
    expect(preset.columns[1]?.fieldId).toBe("document_number");
  });

  it("resolves CBS/IBS exact paths and cClassTrib distinct list", () => {
    const d = doc({
      id: "d1",
      accessKey: "35260612345678901234550010000000011000000001",
      number: "100",
      emitterDoc: "12345678000199",
      emitterName: "ACME &amp; CIA",
      receiverDoc: "12345678901",
      receiverName: "Cliente",
      issueDate: "2026-06-10T12:00:00-03:00",
      flattenedJson: {
        "total.IBSCBSTot.gCBS.vCBS": "88.97",
        "total.IBSCBSTot.gIBS.vIBS": "10.50",
        "det[0].imposto.IBSCBS.cClassTrib": "200003",
        "det[1].imposto.IBSCBS.cClassTrib": "200001",
        "det[2].imposto.IBSCBS.cClassTrib": "200003",
        "cobr.dup[0].vDup": "0.1",
        "cobr.dup[1].vDup": "0.2",
        "emit.CNPJ": "12345678000199",
        "dest.CPF": "12345678901",
      },
    });
    const registry = buildFieldRegistry([store([d])]);
    const byId = Object.fromEntries(registry.map((f) => [f.fieldId, f]));
    expect(resolveFieldValue(d, byId.cbs_total!)).toBe("88.97");
    expect(resolveFieldValue(d, byId.ibs_total!)).toBe("10.50");
    expect(resolveFieldValue(d, byId.cclass_trib!)).toBe("200001 | 200003");
    expect(resolveFieldValue(d, byId.invoice_installments_total!)).toBe("0.30");
    expect(resolveFieldValue(d, byId.emitter_name!)).toBe("ACME & CIA");
    expect(resolveFieldValue(d, byId.document_number!)).toBe("100");
  });
});

describe("facets & multilote", () => {
  it("does not merge different docs with same name", () => {
    const s = store([
      doc({ id: "a", receiverName: "João", receiverDoc: "11111111111", totalValue: 10 }),
      doc({ id: "b", receiverName: "João", receiverDoc: "22222222222", totalValue: 20 }),
    ]);
    const idx = buildFacetIndex([s]);
    expect(idx.receivers.length).toBe(2);
  });

  it("party search ignores punctuation without applying filters", () => {
    const opts = [
      {
        id: "CNPJ:12345678000199",
        label: "ACME · 12.345.678/0001-99",
        count: 1,
        docKind: "CNPJ" as const,
        normalizedDoc: "12345678000199",
      },
    ];
    expect(filterPartyOptions(opts, "12.345.678")).toHaveLength(1);
    expect(filterPartyOptions(opts, "999")).toHaveLength(0);
  });

  it("selects across two batches without id collision", () => {
    const s1 = store([doc({ id: "same", number: "1", totalValue: 10 })], "b1");
    const s2 = store([doc({ id: "same", number: "2", totalValue: 20 })], "b2");
    const rows = filterWorkspaceDocuments([s1, s2], emptyAppliedFacets(), {});
    expect(rows).toHaveLength(2);
    expect(selectionId("b1", "same")).not.toBe(selectionId("b2", "same"));
    expect(moneyToFixed(moneyAdd(10, 20), 2)).toBe("30.00");
  });

  it("OR within receivers AND across facets", () => {
    const s = store([
      doc({
        id: "a",
        receiverDoc: "11111111111",
        emitterUf: "SP",
        totalValue: 1,
      }),
      doc({
        id: "b",
        receiverDoc: "22222222222",
        emitterUf: "SP",
        totalValue: 1,
      }),
      doc({
        id: "c",
        receiverDoc: "11111111111",
        emitterUf: "RJ",
        totalValue: 1,
      }),
    ]);
    const facets = emptyAppliedFacets();
    facets.receiverIds = ["CPF:11111111111", "CPF:22222222222"];
    facets.ufOrigin = ["SP"];
    const rows = filterWorkspaceDocuments([s], facets, {});
    expect(rows.map((r) => r.document.id).sort()).toEqual(["a", "b"]);
  });
});

describe("field workbook", () => {
  it("builds Campos Selecionados and Todos os Campos", async () => {
    const d = doc({
      id: "d1",
      accessKey: "35260612345678901234550010000000011000000001",
      number: "9",
      flattenedJson: {
        "ide.nNF": "9",
        "emit.xNome": "A",
        "dest.xNome": "B",
        "total.IBSCBSTot.gCBS.vCBS": "1.00",
      },
    });
    const s = store([d]);
    const registry = buildFieldRegistry([s]);
    const preset = buildDefaultPreset();
    const buf = await buildFieldSelectionWorkbook({
      rows: [
        {
          selectionId: "b1:d1",
          batchId: "b1",
          batchName: "lote",
          competence: "06/2026",
          origin: "local",
          document: d,
        },
      ],
      fieldDefs: preset.columns
        .map((c) => registry.find((f) => f.fieldId === c.fieldId)!)
        .filter(Boolean),
      preset,
      registry,
      generationId: "gen-test",
      privacyNote: "test",
    });
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(buf) as never);
    const names = wb.worksheets.map((w) => w.name);
    expect(names).toEqual(
      expect.arrayContaining(["Resumo", "Campos Selecionados", "Todos os Campos", "Manifesto"]),
    );
    const selected = wb.getWorksheet("Campos Selecionados")!;
    expect(selected.rowCount).toBeGreaterThanOrEqual(2);
    const all = wb.getWorksheet("Todos os Campos")!;
    expect(all.rowCount).toBeGreaterThan(2);
  });
});
