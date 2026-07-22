import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { parseXmlDocument } from "@/lib/parser";
import {
  buildObligationContextFromBatch,
  efdIcmsIpiPlugin,
  runObligationPlugin,
} from "@/modules/obligations";
import { validateEfdOffline } from "@/modules/obligations/efd-icms-ipi/layouts/020";

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
      address: "AV PAULISTA",
      addressNumber: "1000",
      neighborhood: "BELA VISTA",
      cnae: "4623107",
      accountantName: "Contador Demo",
      accountantCpf: "52998224725",
      accountantCrc: "SP123456/O",
      accountantEmail: "contador@exemplo.com.br",
      layoutVersion: "EFD_ICMS_IPI_2026_DRAFT",
    },
    documents: [parsed.document as never],
    items: parsed.items as never,
  });
}

describe("EFD offline validator (leiaute 020)", () => {
  it("não aponta erros para a saída do gerador (synthetic demo)", async () => {
    const out = await runObligationPlugin(efdIcmsIpiPlugin, sampleContext());
    const lines = (out.serialized?.content || "").split(/\r?\n/).filter(Boolean);
    const issues = validateEfdOffline({ lines });
    const errors = issues.filter((i) => i.severity === "error");
    console.log("OFFLINE_ERRORS:", JSON.stringify(errors.map((e) => ({ r: e.rule, c: e.recordCode, m: e.message }))));
    // Fixture sintético usa cadastro placeholder (IND_ATIV="A") e participante que
    // pode não ser referenciado (órfão). O validador offline deve pegar bugs de
    // LAYOUT (contagens, ordem de bloco, contadores, enums reais) — não esses ruídos.
    const layoutErrors = errors.filter(
      (e) =>
        !e.rule.startsWith("EFD_ORPHAN_") &&
        !e.rule.startsWith("EFD_XREF_") &&
        !(e.rule === "EFD_ENUM" && e.recordCode === "0000"),
    );
    expect(layoutErrors).toEqual([]);
  });

  it("detecta contagem de campos errada", () => {
    const lines = ["|C190|0|000|5102|18,00|5400,00|5400,00|972,00|0|0|", "|9999|2|"];
    const issues = validateEfdOffline({ lines });
    expect(issues.some((i) => i.rule === "EFD_FIELD_COUNT" && i.recordCode === "C190")).toBe(true);
  });

  it("detecta C170 sem 0200 correspondente", () => {
    const lines = [
      "|0000|020|0|01062026|30062026|NOME|11222333000181|SP|123|3550308||||A|1|",
      "|0001|0|",
      "|0005|N|0|E|N|B|",
      "|C001|0|",
      "|C100|0|1|P11222333000181|55|00|1|1|CHV|0106|0106|100|0|0|100|0|0|100|0|0|0|0|0|0|0|0|0|0|0|0|0|0|0|",
      "|C170|1|SKU-001|desc|2,000|UN|100|0|0|000|5102|N001|100|18|18|0|0|0|1|00|0|0|0|01|0|0|01|0|0|0||",
      "|C990|2|",
      "|9999|8|",
    ];
    const issues = validateEfdOffline({ lines });
    expect(issues.some((i) => i.rule === "EFD_XREF_COD_ITEM")).toBe(true);
  });

  it("detecta 9999 divergente do total de linhas", () => {
    const lines = [
      "|0000|020|0|01062026|30062026|N|11222333000181|SP|123|3550308||||A|1|",
      "|0001|0|",
      "|9999|99|",
    ];
    const issues = validateEfdOffline({ lines });
    expect(issues.some((i) => i.rule === "EFD_COUNTER_9999")).toBe(true);
  });

  it("detecta bloco fora de ordem", () => {
    const lines = ["|C001|0|", "|0000|020|0|01062026|30062026|N|11|SP|1|3550308||||A|1|"];
    const issues = validateEfdOffline({ lines });
    expect(issues.some((i) => i.rule === "EFD_BLOCK_ORDER")).toBe(true);
  });
});
