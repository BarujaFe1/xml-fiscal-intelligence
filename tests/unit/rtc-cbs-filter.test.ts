import { describe, expect, it } from "vitest";
import { emptyDocFilters, filterDocuments } from "@/lib/analytics";
import { detectDocumentRtcLabels } from "@/lib/documents/rtc-labels";
import type { Batch, BatchStore, DocumentSummary } from "@/types";

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

function batch(): Batch {
  return {
    id: "b1",
    workspaceId: "w",
    name: "lote",
    uploadedFileName: "lote.zip",
    status: "completed",
    totalFiles: 2,
    totalXml: 2,
    validXml: 2,
    invalidXml: 0,
    nfeCount: 2,
    cteCount: 0,
    nfseCount: 0,
    unknownCount: 0,
    duplicateCount: 0,
    totalValue: 100,
    healthScore: 80,
    progress: 100,
    progressMessage: "ok",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe("detectDocumentRtcLabels", () => {
  it("detects SOMA CBS / SOMA IBS and vCBS keys", () => {
    const withCbs = detectDocumentRtcLabels(
      doc({
        id: "1",
        flattenedJson: {
          "total.SOMA CBS": 12.5,
          "total.SOMA IBS": "3,40",
        },
      }),
    );
    expect(withCbs.hasCbs).toBe(true);
    expect(withCbs.hasIbs).toBe(true);
    expect(withCbs.somaCbs).toBe(12.5);
    expect(withCbs.somaIbs).toBe(3.4);

    const withVCbs = detectDocumentRtcLabels(
      doc({
        id: "2",
        flattenedJson: { "IBSCBS.vCBS": "10.00", "gIBS.vIBS": 1 },
      }),
    );
    expect(withVCbs.hasCbs).toBe(true);
    expect(withVCbs.hasIbs).toBe(true);
    expect(withVCbs.somaCbs).toBe(10);
    expect(withVCbs.somaIbs).toBe(1);

    const none = detectDocumentRtcLabels(doc({ id: "3", flattenedJson: { "ICMS.vICMS": 5 } }));
    expect(none.hasCbs).toBe(false);
    expect(none.hasIbs).toBe(false);
  });

  it("prefers IBSCBSTot.gCBS.vCBS over gCBS.vDif zeros", () => {
    const rtc = detectDocumentRtcLabels(
      doc({
        id: "tot",
        flattenedJson: {
          "nfeProc.NFe.infNFe.total.IBSCBSTot.gCBS.vDif": "0.00",
          "nfeProc.NFe.infNFe.total.IBSCBSTot.gCBS.vCBS": "88.97",
          "nfeProc.NFe.infNFe.total.IBSCBSTot.gIBS.vIBS": "9.89",
          "nfeProc.NFe.infNFe.det.imposto.IBSCBS.gIBSCBS.gCBS.vCBS": "88.97",
        },
      }),
    );
    expect(rtc.hasCbs).toBe(true);
    expect(rtc.somaCbs).toBe(88.97);
    expect(rtc.somaIbs).toBe(9.89);
    expect(rtc.cbsAmountKey).toMatch(/IBSCBSTot\.gCBS\.vCBS$/i);
  });
});

describe("CBS/IBS document filters", () => {
  const store: BatchStore = {
    batch: batch(),
    documents: [
      doc({
        id: "with",
        emitterName: "Fornecedor A",
        flattenedJson: { "SOMA CBS": 8, vCBS: 8 },
      }),
      doc({
        id: "without",
        emitterName: "Fornecedor B",
        flattenedJson: { "ICMS.vICMS": 2 },
      }),
    ],
    items: [],
    fields: [],
    errors: [],
    exports: [],
  };

  it("filters documents with and without CBS etiqueta", () => {
    expect(filterDocuments(store, { ...emptyDocFilters(), cbs: "with" }).map((d) => d.id)).toEqual([
      "with",
    ]);
    expect(filterDocuments(store, { ...emptyDocFilters(), cbs: "without" }).map((d) => d.id)).toEqual([
      "without",
    ]);
    expect(filterDocuments(store, { ...emptyDocFilters(), alert: "NO_CBS" }).map((d) => d.id)).toEqual([
      "without",
    ]);
  });
});
