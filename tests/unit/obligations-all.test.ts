import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { parseXmlDocument } from "@/lib/parser";
import {
  buildObligationContextFromBatch,
  efdContribuicoesPlugin,
  ecdPlugin,
  ecfPlugin,
  reinfPlugin,
  efdIcmsIpiPlugin,
  runObligationPlugin,
  obligationRegistry,
  EFD_ICMS_IPI_LAYOUT_2026,
} from "@/modules/obligations";

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
      activityCode: "0",
      purpose: "0",
      periodStart: "2026-03-01",
      periodEnd: "2026-03-31",
      accountantName: "Contador Demo",
      accountantCpf: "39053344705",
      layoutVersion: EFD_ICMS_IPI_LAYOUT_2026,
    },
    documents: [parsed.document],
    items: parsed.items,
  });
}

describe("all obligation plugins (assisted)", () => {
  it("marks all five as active in registry", () => {
    expect(Object.values(obligationRegistry).every((s) => s === "active")).toBe(true);
  });

  it("generates EFD ICMS/IPI from sample NF-e", async () => {
    const out = await runObligationPlugin(efdIcmsIpiPlugin, sampleContext());
    expect(out.readiness.canGenerate).toBe(true);
    expect(out.serialized?.content).toContain("|0000|");
    expect(out.validation?.ok).toBe(true);
  });

  it("generates EFD-Contribuições draft with A100", async () => {
    const out = await runObligationPlugin(efdContribuicoesPlugin, sampleContext());
    expect(out.readiness.canGenerate).toBe(true);
    expect(out.serialized?.content).toMatch(/\|A100\|/);
    expect(out.manifest?.disclaimer).toMatch(/PVA/i);
  });

  it("generates ECD skeleton with DEMO chart and accountant", async () => {
    const out = await runObligationPlugin(ecdPlugin, sampleContext());
    expect(out.readiness.canGenerate).toBe(true);
    expect(out.serialized?.content).toMatch(/\|I050\|/);
    expect(out.build?.warnings.some((w) => /DEMO/i.test(w))).toBe(true);
  });

  it("blocks ECD without accountant", async () => {
    const ctx = sampleContext();
    ctx.accountantName = undefined;
    ctx.accountantCpf = undefined;
    const out = await runObligationPlugin(ecdPlugin, ctx);
    expect(out.readiness.canGenerate).toBe(false);
  });

  it("generates ECF structural skeleton without inventing IRPJ", async () => {
    const out = await runObligationPlugin(ecfPlugin, sampleContext());
    expect(out.readiness.canGenerate).toBe(true);
    expect(out.serialized?.content).toMatch(/\|0000\|/);
    expect(out.manifest?.disclaimer).toMatch(/IRPJ/i);
  });

  it("generates Reinf R-1000 package JSON", async () => {
    const out = await runObligationPlugin(reinfPlugin, sampleContext());
    expect(out.readiness.canGenerate).toBe(true);
    const parsed = JSON.parse(out.serialized!.content);
    expect(parsed.events[0].evento).toBe("R-1000");
    expect(out.manifest?.disclaimer).toMatch(/certificado/i);
  });
});
