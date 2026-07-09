import { describe, expect, it } from "vitest";
import { compareBatches, filterDocuments, emptyDocFilters } from "@/lib/analytics";
import type { Batch, BatchStore, DocumentSummary } from "@/types";

function doc(partial: Partial<DocumentSummary> & { id: string }): DocumentSummary {
  return {
    workspaceId: "w",
    batchId: "b",
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

function batch(id: string, name: string): Batch {
  return {
    id,
    workspaceId: "w",
    name,
    uploadedFileName: `${name}.zip`,
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
    totalValue: 100,
    healthScore: 90,
    progress: 100,
    progressMessage: "ok",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    month: 6,
    year: 2026,
  };
}

describe("analytics filters", () => {
  it("filters by emitter and alert NO_PROTOCOL", () => {
    const store: BatchStore = {
      batch: batch("b1", "jun"),
      documents: [
        doc({ id: "1", emitterDoc: "123", emitterName: "A", protocol: "1", totalValue: 10 }),
        doc({ id: "2", emitterDoc: "999", emitterName: "B", protocol: undefined, totalValue: 20 }),
      ],
      items: [],
      fields: [],
      errors: [],
      exports: [],
    };
    const f = { ...emptyDocFilters(), alert: "NO_PROTOCOL" };
    expect(filterDocuments(store, f).map((d) => d.id)).toEqual(["2"]);
    expect(filterDocuments(store, { ...emptyDocFilters(), emitter: "123" }).map((d) => d.id)).toEqual([
      "1",
    ]);
  });
});

describe("compareBatches", () => {
  it("detects new emitters", () => {
    const a: BatchStore = {
      batch: { ...batch("a", "mai"), totalValue: 50, validXml: 1, healthScore: 80 },
      documents: [doc({ id: "1", emitterDoc: "111", emitterName: "Old", totalValue: 50 })],
      items: [],
      fields: [],
      errors: [],
      exports: [],
    };
    const b: BatchStore = {
      batch: { ...batch("b", "jun"), totalValue: 150, validXml: 2, healthScore: 90 },
      documents: [
        doc({ id: "1", emitterDoc: "111", emitterName: "Old", totalValue: 50 }),
        doc({ id: "2", emitterDoc: "222", emitterName: "New Co", totalValue: 100 }),
      ],
      items: [],
      fields: [],
      errors: [],
      exports: [],
    };
    const r = compareBatches(a, b);
    expect(r.deltaDocs).toBe(1);
    expect(r.newEmitters.some((p) => p.doc === "222")).toBe(true);
  });
});
