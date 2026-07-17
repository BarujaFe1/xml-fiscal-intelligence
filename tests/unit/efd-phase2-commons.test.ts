import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { parseXmlDocument } from "@/lib/parser";
import {
  buildObligationContextFromBatch,
  efdIcmsIpiPlugin,
  EFD_ICMS_IPI_LAYOUT_2026,
  runObligationPlugin,
  auditXmlVsEfdTxt,
  getEfdUfPlugin,
  isHomologationGradePvaRun,
} from "@/modules/obligations";
import { validateBlockOpenerOrder } from "@/modules/obligations/efd-icms-ipi/validate-structure";

function sampleContext() {
  const xml = readFileSync(
    path.join(process.cwd(), "samples", "anonymized", "nfe-example.xml"),
    "utf8",
  );
  const parsed = parseXmlDocument({
    xml,
    fileName: "nfe-example.xml",
    batchId: "t",
    workspaceId: "ws",
  });
  return buildObligationContextFromBatch({
    establishment: {
      workspaceId: "ws",
      companyId: "co",
      establishmentId: "est",
      cnpj: "11222333000181",
      ie: "123456789012",
      uf: "SP",
      companyName: "EMPRESA DEMO LTDA",
      profile: "A",
      activityCode: "1",
      purpose: "0",
      periodStart: "2026-06-01",
      periodEnd: "2026-06-30",
      codMun: "3550308",
      cep: "01310100",
      address: "RUA DEMO",
      neighborhood: "BELA VISTA",
      accountantName: "Contador Demo",
      accountantCpf: "39053344705",
      accountantCrc: "SP-123456/O-0",
      accountantEmail: "contador@exemplo.com.br",
      layoutVersion: EFD_ICMS_IPI_LAYOUT_2026,
    },
    documents: [parsed.document],
    items: parsed.items,
  });
}

describe("EFD Phase 2 commons", () => {
  it("keeps block openers in Guia order", async () => {
    const out = await runObligationPlugin(efdIcmsIpiPlugin, sampleContext());
    expect(out.serialized?.content).toBeTruthy();
    const types = (out.build?.records || []).map((r) => r.type);
    expect(validateBlockOpenerOrder(types).filter((i) => i.severity === "error")).toEqual([]);
  });

  it("applies priorCreditBalance to E110 when provided", async () => {
    const ctx = sampleContext();
    ctx.priorCreditBalance = "100,00";
    const out = await runObligationPlugin(efdIcmsIpiPlugin, ctx);
    const e110 = out.build?.records.find((r) => r.type === "E110");
    expect(e110?.fields[9]).toMatch(/100/);
  });

  it("COD_SIT=02 when document status is cancelled", async () => {
    const ctx = sampleContext();
    if (ctx.documents[0]) ctx.documents[0].status = "cancelled";
    const out = await runObligationPlugin(efdIcmsIpiPlugin, ctx);
    const c100 = out.build?.records.find((r) => r.type === "C100");
    expect(c100?.fields[5]).toBe("02");
  });

  it("audits XML keys against generated TXT", async () => {
    const ctx = sampleContext();
    const out = await runObligationPlugin(efdIcmsIpiPlugin, ctx);
    const audit = auditXmlVsEfdTxt(ctx, out.serialized!.content);
    expect(audit.missingInEfd).toEqual([]);
    expect(audit.ok).toBe(true);
  });

  it("SP UF plugin suggests official RPA COD_REC (046-2) from Portaria CAT 147/2009", () => {
    expect(getEfdUfPlugin("SP").suggestIcmsCodRec?.({ periodEnd: "2026-06-30" })).toBe("046-2");
    expect(getEfdUfPlugin("SP").icmsCodRecTable.some((e) => e.code === "046-2")).toBe(true);
  });

  it("homologation grade requires contentHash", () => {
    expect(
      isHomologationGradePvaRun({
        contentHash: "",
        pvaVersion: "6.0.9",
        resultStatus: "ok",
      }),
    ).toBe(false);
    expect(
      isHomologationGradePvaRun({
        contentHash: "abc",
        pvaVersion: "6.0.9",
        resultStatus: "ok",
      }),
    ).toBe(true);
  });
});
