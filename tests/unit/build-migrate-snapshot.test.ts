import { describe, expect, it } from "vitest";
import { buildMigrateSnapshot } from "@/lib/sync/build-migrate-snapshot";
import type { BatchStore } from "@/types";

function minimalStore(): BatchStore {
  return {
    batch: {
      id: "batch_local_1",
      workspaceId: "ws_1",
      name: "Teste",
      year: 2026,
      month: 7,
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
      healthScore: 100,
      progress: 100,
      progressMessage: "ok",
      syncStatus: "local",
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z",
    },
    documents: [
      {
        id: "doc1",
        workspaceId: "ws_1",
        batchId: "batch_local_1",
        documentType: "NFE",
        fileName: "nfe.xml",
        accessKey: "35" + "0".repeat(42),
        number: "1",
        series: "1",
        model: "55",
        issueDate: "2026-07-01",
        emitterDoc: "12345678000199",
        emitterName: "ACME",
        totalValue: 10,
        rawJson: {},
        flattenedJson: { vNF: 10, vICMS: 1.2 },
        parseStatus: "ok",
        parseErrors: [],
        createdAt: "2026-07-01T00:00:00.000Z",
      },
    ],
    items: [
      {
        id: "item1",
        workspaceId: "ws_1",
        batchId: "batch_local_1",
        documentId: "doc1",
        documentType: "NFE",
        itemNumber: 1,
        code: "SKU1",
        description: "Produto",
        ncm: "12345678",
        cfop: "5102",
        quantity: 1,
        unit: "UN",
        unitValue: 10,
        totalValue: 10,
        taxJson: {},
        rawJson: {},
        flattenedJson: {},
      },
    ],
    fields: [],
    errors: [],
    exports: [],
  };
}

describe("buildMigrateSnapshot", () => {
  it("caps fields and maps DocumentItem correctly", () => {
    const snap = buildMigrateSnapshot(minimalStore());
    expect(snap.version).toBe(1);
    expect(snap.counts).toEqual({ documents: 1, items: 1 });
    expect(snap.documents[0]?.flattenedJson).toEqual({ vNF: 10, vICMS: 1.2 });
    expect(snap.items[0]).toMatchObject({
      itemNumber: 1,
      code: "SKU1",
      unitValue: 10,
    });
    expect(snap.items[0]).not.toHaveProperty("lineNumber");
    expect(snap.items[0]).not.toHaveProperty("rawJson");
  });
});
