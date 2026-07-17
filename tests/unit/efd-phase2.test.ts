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
 * Trava o comportamento corrigido na Fase 2:
 *  - C170 tem exatamente 38 campos (leiaute oficial 020, incluindo VL_BC_IPI/ALIQ_IPI/ALIQ*_QUANT/COD_CTA/VL_ABAT_NT).
 *  - 0002/E500/E520 (apuração IPI) só para IND_ATIV=1 (industrial), NÃO para 0.
 *  - 0150 emitido apenas para o CONTRAPARTE do C100 (sem o estabelecimento).
 */

function makeContext(activityCode: "0" | "1") {
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
      activityCode,
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
      industrialClass: "02",
    },
    documents: [parsed.document as never],
    items: parsed.items as never,
  });
}

function linesOf(out: Awaited<ReturnType<typeof runObligationPlugin>>): string[] {
  return (out.serialized?.content || "").split(/\r?\n/).filter(Boolean);
}

describe("EFD ICMS/IPI — correções de layout/cadastro (Fase 2)", () => {
  it("C170 tem exatamente 38 campos (leiaute oficial 020)", async () => {
    const out = await runObligationPlugin(efdIcmsIpiPlugin, makeContext("1"));
    const c170 = linesOf(out).filter((l) => l.startsWith("|C170|"));
    expect(c170.length).toBeGreaterThan(0);
    for (const line of c170) {
      const count = line.split("|").length - 2; // descarta "" inicial/final
      expect(count).toBe(38);
    }
    // IND_APUR na posição 19 (1-based), valor 0/1
    const first = c170[0].split("|");
    expect(first[19]).toMatch(/^[01]$/);
  });

  it("0002/E500/E520 só para IND_ATIV=1 (industrial), ausentes p/ 0", async () => {
    const nonInd = await runObligationPlugin(efdIcmsIpiPlugin, makeContext("0"));
    const t0 = linesOf(nonInd).map((l) => l.replace(/^\|/, "").split("|")[0]);
    expect(t0).not.toContain("0002");
    expect(t0).not.toContain("E500");
    expect(t0).not.toContain("E520");

    const ind = await runObligationPlugin(efdIcmsIpiPlugin, makeContext("1"));
    const t1 = linesOf(ind).map((l) => l.replace(/^\|/, "").split("|")[0]);
    expect(t1).toContain("0002");
    expect(t1).toContain("E500");
    expect(t1).toContain("E520");
    // ordem do bloco E
    const order = ["E001", "E100", "E110", "E500", "E520", "E990"].map((t) =>
      t1.indexOf(t),
    );
    for (let i = 0; i < order.length - 1; i++) {
      if (order[i] !== -1 && order[i + 1] !== -1) {
        expect(order[i]).toBeLessThan(order[i + 1]);
      }
    }
  });

  it("0150 contém apenas contrapartes referenciados pelo C100 (sem estabelecimento)", async () => {
    const out = await runObligationPlugin(efdIcmsIpiPlugin, makeContext("1"));
    const lines = linesOf(out);
    const c100Parts = new Set(
      lines
        .filter((l) => l.startsWith("|C100|"))
        .map((l) => l.split("|")[4]), // COD_PART na posição 4 (1-based)
    );
    const c150 = lines.filter((l) => l.startsWith("|0150|"));
    expect(c150.length).toBeGreaterThan(0);
    for (const line of c150) {
      const codPart = line.split("|")[2]; // COD_PART na posição 2
      expect(c100Parts.has(codPart)).toBe(true); // todo 0150 é referenciado
    }
    // o estabelecimento (11222333000181) e o destinatário (98765432000111) NÃO viram 0150
    expect(c150.some((l) => l.includes("P11222333000181"))).toBe(false);
    expect(c150.some((l) => l.includes("P98765432000111"))).toBe(false);
  });
});
