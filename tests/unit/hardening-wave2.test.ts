import { describe, expect, it } from "vitest";
import { isProtocolRequired } from "@/modules/audit/protocol-eligibility";
import { PARSER_CAPABILITIES, getParserCapabilityForType } from "@/lib/parser/capability-registry";
import { redactSensitiveText, maskAccessKey, redactMetadata } from "@/lib/security/redaction";
import { reprocessAnalysis } from "@/lib/analysis/reprocess";
import type { BatchStore, DocumentSummary } from "@/types";

describe("protocol eligibility", () => {
  it("requires protocol for NFE/NFCE/CTE", () => {
    expect(isProtocolRequired({ documentType: "NFE", rawJson: {} }).required).toBe(true);
    expect(isProtocolRequired({ documentType: "NFCE", rawJson: {} }).required).toBe(true);
    expect(isProtocolRequired({ documentType: "CTE", rawJson: {} }).required).toBe(true);
  });

  it("marks NFS-e as not applicable", () => {
    expect(isProtocolRequired({ documentType: "NFSE", rawJson: {} }).required).toBe(false);
    expect(isProtocolRequired({ documentType: "NFSE", rawJson: {} }).classification).toBe(
      "not_applicable",
    );
  });
});

describe("parser capability registry", () => {
  it("declares NF-e supported and NFS-e best_effort", () => {
    expect(PARSER_CAPABILITIES.length).toBeGreaterThanOrEqual(3);
    expect(getParserCapabilityForType("NFE")?.status).toBe("supported");
    expect(getParserCapabilityForType("NFSE")?.status).toBe("best_effort");
  });
});

describe("redaction", () => {
  it("masks access keys and docs", () => {
    const key = "35260112345678901234550010000000011123456789";
    expect(redactSensitiveText(`chave ${key}`)).toContain("[CHAVE]");
    expect(maskAccessKey(key)).toMatch(/…/);
    expect(redactMetadata({ xmlHash: "abc", token: "secret", count: 1 })).toEqual({
      xmlHash: "[REDACTED]",
      token: "[REDACTED]",
      count: 1,
    });
  });
});

describe("reprocessAnalysis", () => {
  it("appends immutable generation", () => {
    const doc = {
      id: "d1",
      workspaceId: "w1",
      batchId: "b1",
      documentType: "NFE",
      fileName: "a.xml",
      parseStatus: "ok",
      accessKey: "1".repeat(44),
      number: "1",
      emitterDoc: "12345678000195",
      totalValue: 10,
      protocol: "123",
      rawJson: { nfeProc: { protNFe: { infProt: { nProt: "123" } } } },
      flattenedJson: {},
      parseErrors: [],
      createdAt: new Date().toISOString(),
    } as DocumentSummary;

    const store: BatchStore = {
      batch: {
        id: "b1",
        workspaceId: "w1",
        name: "t",
        uploadedFileName: "t.zip",
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
      },
      documents: [doc],
      items: [],
      fields: [],
      errors: [],
      exports: [],
      findings: [],
      analysisGenerations: [],
    };

    const next = reprocessAnalysis(store);
    expect(next.analysisGenerations?.length).toBe(1);
    const again = reprocessAnalysis(next);
    expect(again.analysisGenerations?.length).toBe(2);
    expect(again.analysisGenerations![1].parentGenerationId).toBe(
      again.analysisGenerations![0].id,
    );
  });
});
