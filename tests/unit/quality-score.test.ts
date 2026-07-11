import { describe, expect, it } from "vitest";
import { calculateBatchQuality, QUALITY_FORMULA_VERSION } from "@/lib/quality";
import type { Batch, DocumentItem, DocumentSummary } from "@/types";

function baseBatch(over: Partial<Batch> = {}): Batch {
  return {
    id: "b1",
    workspaceId: "w1",
    name: "teste",
    uploadedFileName: "x.zip",
    status: "completed",
    totalFiles: 0,
    totalXml: 0,
    validXml: 0,
    invalidXml: 0,
    nfeCount: 0,
    cteCount: 0,
    nfseCount: 0,
    unknownCount: 0,
    duplicateCount: 0,
    totalValue: 0,
    healthScore: null,
    progress: 100,
    progressMessage: "ok",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...over,
  };
}

function doc(over: Partial<DocumentSummary> = {}): DocumentSummary {
  return {
    id: "d1",
    workspaceId: "w1",
    batchId: "b1",
    documentType: "NFE",
    fileName: "a.xml",
    parseStatus: "ok",
    accessKey: "35260112345678901234550010000000011123456789",
    number: "1",
    emitterDoc: "12.345.678/0001-95",
    receiverDoc: "98.765.432/0001-10",
    totalValue: 100,
    protocol: "135260000000001",
    ...over,
  } as DocumentSummary;
}

describe("calculateBatchQuality v2", () => {
  it("does not invent score for empty / all-reused batch", () => {
    const q = calculateBatchQuality(
      baseBatch({ incremental: true, newDocumentCount: 0, totalXml: 1147 }),
      [],
      [],
      [],
      [],
      { reusedDocumentCount: 1147 },
    );
    expect(q.score).toBeNull();
    expect(q.evaluationStatus).toBe("duplicates_only");
    expect(q.formulaVersion).toBe(QUALITY_FORMULA_VERSION);
    expect(q.recommendations.join(" ")).toMatch(/não se aplica|não foi avaliado/i);
    expect(q.recommendations.join(" ")).not.toMatch(/saudável/i);
    expect(q.breakdown.xmlValidity).toBeNull();
    expect(q.dimensions.xmlValidity.status).toBe("not_evaluated");
    expect(q.dimensions.xmlValidity.denominator).toBe(0);
  });

  it("marks empty non-incremental as not_evaluated", () => {
    const q = calculateBatchQuality(baseBatch(), [], [], [], []);
    expect(q.score).toBeNull();
    expect(q.evaluationStatus).toBe("not_evaluated");
  });

  it("scores a fully valid single document", () => {
    const documents = [doc()];
    const items: DocumentItem[] = [
      {
        id: "i1",
        workspaceId: "w1",
        batchId: "b1",
        documentId: "d1",
        documentType: "NFE",
        itemNumber: 1,
        ncm: "22030000",
        cfop: "5102",
        totalValue: 100,
      } as DocumentItem,
    ];
    const q = calculateBatchQuality(baseBatch({ month: 1, year: 2026 }), documents, items, [], []);
    expect(q.score).not.toBeNull();
    expect(q.score!).toBeGreaterThanOrEqual(80);
    expect(q.evaluationStatus).toMatch(/^analyzed/);
    expect(q.metrics.evaluatedDocumentCount).toBe(1);
  });

  it("scores invalid parse without pretending perfect dimensions", () => {
    const documents = [doc({ parseStatus: "error", accessKey: undefined, protocol: undefined })];
    const q = calculateBatchQuality(baseBatch(), documents, [], [], [
      {
        id: "e1",
        workspaceId: "w1",
        batchId: "b1",
        fileName: "bad.xml",
        errorType: "parse",
        errorMessage: "fail",
        createdAt: new Date().toISOString(),
      },
    ]);
    expect(q.score).not.toBeNull();
    expect(q.dimensions.xmlValidity.score).toBe(0);
    expect(q.evaluationStatus).toBe("processing_failed");
  });

  it("marks item completeness N/A without NFe items", () => {
    const documents = [doc({ documentType: "CTE", accessKey: "1".repeat(44) })];
    const q = calculateBatchQuality(baseBatch(), documents, [], [], []);
    expect(q.dimensions.itemCompleteness.status).toBe("not_applicable");
    expect(q.dimensions.itemCompleteness.score).toBeNull();
  });

  it("handles mixed valid and invalid", () => {
    const documents = [
      doc({ id: "ok", parseStatus: "ok" }),
      doc({
        id: "bad",
        parseStatus: "error",
        accessKey: undefined,
        number: undefined,
        totalValue: undefined,
      }),
    ];
    const q = calculateBatchQuality(baseBatch(), documents, [], [], []);
    expect(q.metrics.evaluatedDocumentCount).toBe(2);
    expect(q.dimensions.xmlValidity.numerator).toBe(1);
    expect(q.dimensions.xmlValidity.denominator).toBe(2);
    expect(q.score).not.toBeNull();
  });
});
