import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { parseXmlDocument } from "@/lib/parser";
import {
  buildObligationContextFromBatch,
  efdIcmsIpiPlugin,
  runObligationPlugin,
} from "@/modules/obligations";

/**
 * GOLDEN REGRESSION LOCK for the refactor (plugin.ts → modules).
 * The serialized content MUST stay byte-identical for the synthetic demo
 * sample unless an INTENDED fiscal fix changes it (then update this hash
 * only after reviewing the diff against the PVA-validated behavior).
 */
const GOLDEN_HASH = "fd9d5e99269b2d1d66255f9557f02e292eb4afd7f058b899fcc699754161c922";

function sampleContext(periodStart = "2026-06-01", periodEnd = "2026-06-30") {
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
      periodStart,
      periodEnd,
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

describe("EFD ICMS/IPI golden (synthetic demo)", () => {
  it("serialized content is stable across refactors", async () => {
    const out = await runObligationPlugin(efdIcmsIpiPlugin, sampleContext());
    const content = out.serialized?.content || "";
    const lines = content.split(/\r?\n/).filter(Boolean);
    const types = lines.map((l) => l.replace(/^\|/, "").split("|")[0]);

    // structural invariants the refactor must preserve (golden is industrial: 0002 after 0001)
    expect(types.slice(0, 3)).toEqual(["0000", "0001", "0005"]);
    expect(types).toContain("C100");
    // Amostra demo é NF-e de terceiros (IND_EMIT=1) → C170 (detalhe), sem C190.
    expect(types).toContain("C170");
    expect(types).not.toContain("C190");
    // Bloco E order: E001 < E100 < E110 < E990 (E500/E520 só se houver IPI no período)
    const order = ["E001", "E100", "E110", "E990"].map((t) => types.indexOf(t));
    for (let i = 0; i < order.length - 1; i++) {
      if (order[i] !== -1 && order[i + 1] !== -1) {
        expect(order[i]).toBeLessThan(order[i + 1]);
      }
    }
    // Amostra demo (vIPI=0, não contribuinte do IPI) NÃO emite E500/E520
    expect(types).not.toContain("0002");
    expect(types).not.toContain("E500");
    expect(types).not.toContain("E520");

    expect(out.serialized?.contentHash).toBe(GOLDEN_HASH);
  });
});
