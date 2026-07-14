import { describe, expect, it } from "vitest";
import {
  buildComplementaryCsv,
  parseComplementaryCsv,
  validateComplementaryPreview,
} from "@/modules/obligations/efd-icms-ipi/complementary";
import { reconcileBatchDocuments, explainConfidence } from "@/modules/reconciliation";
import { maskFiscalText } from "@/lib/security/mask-fiscal";
import type { DocumentSummary } from "@/types";

describe("EFD complementary CSV", () => {
  it("builds and validates accountant template", () => {
    const csv = buildComplementaryCsv("accountant");
    const parsed = parseComplementaryCsv(csv);
    const v = validateComplementaryPreview("accountant", parsed.headers);
    expect(v.ok).toBe(true);
    expect(parsed.rows.length).toBeGreaterThan(0);
  });
});

describe("reconciliation", () => {
  it("flags missing NF-e key referenced by CT-e", () => {
    const docs = [
      {
        id: "1",
        workspaceId: "w",
        batchId: "b",
        documentType: "CTE",
        fileName: "cte.xml",
        rawJson: {},
        flattenedJson: {},
        parseStatus: "ok",
        parseErrors: [],
        createdAt: new Date().toISOString(),
      },
    ] as DocumentSummary[];
    const issues = reconcileBatchDocuments({
      documents: docs,
      linkedNfeKeysFromCte: new Set(["35260312345678901234567890123456789012345678"]),
    });
    expect(issues.some((i) => i.kind === "unmatched_nfe_key")).toBe(true);
  });

  it("explains confidence factors", () => {
    expect(explainConfidence({ accessKey: "x", via: "infDoc" }).join(" ")).toMatch(/chave/i);
  });
});

describe("fiscal masking", () => {
  it("masks access keys in free text", () => {
    expect(maskFiscalText("chave 35260312345678901234567890123456789012345678")).toContain(
      "[CHAVE]",
    );
  });
});
