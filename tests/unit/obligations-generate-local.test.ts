import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { parseXmlDocument } from "@/lib/parser";
import {
  generateObligationLocal,
  readJsonOrTextError,
} from "@/modules/obligations/generate-local";
import type { BatchStore } from "@/types";

function sampleStore(): BatchStore {
  const xml = readFileSync(
    path.join(process.cwd(), "samples", "anonymized", "nfe-example.xml"),
    "utf8",
  );
  const parsed = parseXmlDocument({
    xml,
    fileName: "nfe-example.xml",
    batchId: "batch_local",
    workspaceId: "ws_local",
  });
  const now = new Date().toISOString();
  return {
    batch: {
      id: "batch_local",
      workspaceId: "ws_local",
      name: "sample",
      uploadedFileName: "nfe-example.xml",
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
      totalValue: parsed.document.totalValue || 0,
      healthScore: 100,
      progress: 100,
      progressMessage: "ok",
      createdAt: now,
      updatedAt: now,
    },
    documents: [parsed.document],
    items: parsed.items,
    fields: [],
    errors: [],
    exports: [],
  };
}

describe("generateObligationLocal", () => {
  it("gera EFD ICMS/IPI no cliente sem chamar a API", async () => {
    const store = sampleStore();
    const out = await generateObligationLocal({
      obligationId: "efd-icms-ipi",
      store,
      establishment: {
        cnpj: "11222333000181",
        ie: "123456789012",
        uf: "SP",
        companyName: "EMPRESA DEMO LTDA",
        profile: "A",
        activityCode: "0",
        purpose: "0",
        periodStart: "2026-03-01",
        periodEnd: "2026-03-31",
        accountantName: "Contador",
        accountantCpf: "39053344705",
        accountantCrc: "SP123456/O",
        accountantEmail: "contador@exemplo.com.br",
      },
    });
    expect(out.error).toBeUndefined();
    expect(out.content).toMatch(/^\|0000\|/);
    expect(out.recordCount).toBeGreaterThan(5);
    expect(out.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("readJsonOrTextError explica body limit", async () => {
    const res = new Response("Request Entity Too Large", { status: 413 });
    const { data, parseError } = await readJsonOrTextError(res);
    expect(data).toBeNull();
    expect(parseError).toMatch(/navegador/i);
  });
});
