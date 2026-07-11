import { describe, expect, it } from "vitest";
import {
  buildGenerationManifest,
  emptyReasonForStore,
  wrapExportEnvelope,
} from "@/lib/export/manifest";
import { buildBatchJsonEnvelope, buildDocumentsCsv } from "@/lib/export/excel";
import type { BatchStore } from "@/types";

function emptyStore(): BatchStore {
  return {
    batch: {
      id: "b1",
      workspaceId: "w1",
      name: "vazio",
      uploadedFileName: "x.zip",
      status: "completed",
      totalFiles: 10,
      totalXml: 10,
      validXml: 0,
      invalidXml: 0,
      nfeCount: 0,
      cteCount: 0,
      nfseCount: 0,
      unknownCount: 0,
      duplicateCount: 0,
      newDocumentCount: 0,
      skippedDuplicateCount: 10,
      incremental: true,
      totalValue: 0,
      healthScore: null,
      progress: 100,
      progressMessage: "ok",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    documents: [],
    items: [],
    fields: [],
    errors: [],
    exports: [],
    findings: [],
    relationships: [],
    importLogs: [],
  };
}

describe("export manifests", () => {
  it("marks reused empty batches", () => {
    expect(emptyReasonForStore(emptyStore())).toBe("all_documents_reused");
  });

  it("wraps JSON envelope instead of bare array", () => {
    const env = buildBatchJsonEnvelope(emptyStore());
    expect(env.schemaVersion).toBeTruthy();
    expect(env.manifest.generationId).toBeTruthy();
    expect(env.emptyReason).toBe("all_documents_reused");
    expect(Array.isArray(env.data.documents)).toBe(true);
    expect(env.data.documents).toHaveLength(0);
  });

  it("CSV empty state includes reason comments and BOM", () => {
    const csv = buildDocumentsCsv(emptyStore());
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toMatch(/empty_reason=all_documents_reused/);
    expect(csv).toMatch(/id,tipo,arquivo/);
  });

  it("buildGenerationManifest sets disclaimer", () => {
    const m = buildGenerationManifest({
      workspaceId: "w1",
      batchIds: ["b1"],
      recordCounts: { documents: 0 },
    });
    expect(m.disclaimer).toMatch(/não constitui/i);
    const wrapped = wrapExportEnvelope([], m);
    expect(wrapped.emptyReason).toBe("no_records_in_selection");
  });
});
