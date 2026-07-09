import { describe, expect, it } from "vitest";
import { classifyOperation, explainCFOP } from "@/lib/fiscal/cfop";
import { sha256Hex, isValidCnpjOrCpfFormat } from "@/lib/security/hash";
import { runFiscalAudit } from "@/modules/audit/fiscal-audit-engine";
import { buildDocumentRelationships } from "@/modules/relationships";
import { validateAgainstXsd } from "@/modules/validation/xsd-validator";
import { validateXmlSignature } from "@/modules/validation/xml-signature-validator";
import { assertSafeSelectSql } from "@/modules/ai";
import { buildSpedPreviewTree } from "@/modules/sped/preview";
import type { Batch, DocumentItem, DocumentSummary } from "@/types";

describe("CFOP", () => {
  it("explains known CFOP", () => {
    const e = explainCFOP("5102");
    expect(e.known).toBe(true);
    expect(e.category).toBe("venda");
  });

  it("classifies venda from CFOP", () => {
    const c = classifyOperation({ documentType: "NFE", cfopMain: "5102" });
    expect(c.classification).toBe("venda");
    expect(c.confidence).toBeGreaterThan(0.5);
  });

  it("classifies transporte for CTE", () => {
    const c = classifyOperation({ documentType: "CTE" });
    expect(c.classification).toBe("transporte");
  });
});

describe("hash & docs", () => {
  it("sha256 is stable", async () => {
    const a = await sha256Hex("<nfe>1</nfe>");
    const b = await sha256Hex("<nfe>1</nfe>");
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });

  it("validates cnpj/cpf length", () => {
    expect(isValidCnpjOrCpfFormat("12345678901")).toBe(true);
    expect(isValidCnpjOrCpfFormat("123")).toBe(false);
  });
});

describe("audit engine", () => {
  it("flags empty NCM and duplicate keys", () => {
    const batch = {
      id: "b1",
      workspaceId: "ws",
      name: "t",
      uploadedFileName: "t.zip",
      status: "completed",
      totalFiles: 2,
      totalXml: 2,
      validXml: 2,
      invalidXml: 0,
      nfeCount: 2,
      cteCount: 0,
      nfseCount: 0,
      unknownCount: 0,
      duplicateCount: 1,
      totalValue: 100,
      healthScore: 80,
      progress: 100,
      progressMessage: "ok",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as Batch;

    const docs: DocumentSummary[] = [
      {
        id: "d1",
        workspaceId: "ws",
        batchId: "b1",
        documentType: "NFE",
        fileName: "a.xml",
        accessKey: "35260300000000000000000000000000000000000000",
        totalValue: 50,
        rawJson: {},
        flattenedJson: {},
        parseStatus: "ok",
        parseErrors: [],
        createdAt: new Date().toISOString(),
      },
      {
        id: "d2",
        workspaceId: "ws",
        batchId: "b1",
        documentType: "NFE",
        fileName: "b.xml",
        accessKey: "35260300000000000000000000000000000000000000",
        totalValue: 50,
        rawJson: {},
        flattenedJson: {},
        parseStatus: "ok",
        parseErrors: [],
        createdAt: new Date().toISOString(),
      },
    ];

    const items: DocumentItem[] = [
      {
        id: "i1",
        workspaceId: "ws",
        batchId: "b1",
        documentId: "d1",
        documentType: "NFE",
        itemNumber: 1,
        description: "Produto",
        totalValue: 50,
        taxJson: {},
        rawJson: {},
        flattenedJson: {},
      },
    ];

    const findings = runFiscalAudit({ batch, documents: docs, items });
    expect(findings.some((f) => f.code === "DUP_ACCESS_KEY")).toBe(true);
    expect(findings.some((f) => f.code === "ITEM_NO_NCM" || f.code.includes("NCM"))).toBe(true);
  });
});

describe("relationships", () => {
  it("links CTE to NFE by key in item", () => {
    const key = "35260311111111111111111111111111111111111111";
    const docs: DocumentSummary[] = [
      {
        id: "nfe1",
        workspaceId: "ws",
        batchId: "b1",
        documentType: "NFE",
        fileName: "n.xml",
        accessKey: key,
        rawJson: {},
        flattenedJson: {},
        parseStatus: "ok",
        parseErrors: [],
        createdAt: new Date().toISOString(),
      },
      {
        id: "cte1",
        workspaceId: "ws",
        batchId: "b1",
        documentType: "CTE",
        fileName: "c.xml",
        rawJson: {},
        flattenedJson: {},
        parseStatus: "ok",
        parseErrors: [],
        createdAt: new Date().toISOString(),
      },
    ];
    const items: DocumentItem[] = [
      {
        id: "i1",
        workspaceId: "ws",
        batchId: "b1",
        documentId: "cte1",
        documentType: "CTE",
        itemNumber: 1,
        code: key,
        taxJson: {},
        rawJson: {},
        flattenedJson: {},
      },
    ];
    const rels = buildDocumentRelationships({ workspaceId: "ws", documents: docs, items });
    expect(rels.some((r) => r.relationshipType === "cte_to_nfe")).toBe(true);
    expect(rels.some((r) => r.relationshipType === "nfe_to_cte")).toBe(true);
  });
});

describe("validation stubs", () => {
  it("xsd not configured", () => {
    expect(validateAgainstXsd({ xml: "<xml/>", documentType: "NFE" }).status).toBe(
      "not_configured",
    );
  });

  it("signature missing", () => {
    expect(validateXmlSignature("<nfe></nfe>").status).toBe("missing");
  });
});

describe("AI SQL guard", () => {
  it("allows select", () => {
    expect(assertSafeSelectSql("SELECT 1").ok).toBe(true);
  });
  it("blocks drop", () => {
    expect(assertSafeSelectSql("DROP TABLE x").ok).toBe(false);
  });
  it("blocks select with delete", () => {
    expect(assertSafeSelectSql("SELECT * FROM t; DELETE FROM t").ok).toBe(false);
  });
});

describe("SPED preview", () => {
  it("builds tree with warnings", () => {
    const tree = buildSpedPreviewTree({
      hasNfe: true,
      hasItems: true,
      hasCfop: true,
      hasNcm: false,
      companyConfigured: false,
    });
    expect(tree.children?.length).toBeGreaterThan(0);
    expect(tree.status).toBe("warning");
  });
});
