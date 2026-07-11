import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { parseXmlDocument } from "@/lib/parser";
import {
  buildObligationContextFromBatch,
  efdIcmsIpiCodVer,
  efdIcmsIpiPlugin,
  EFD_ICMS_IPI_LAYOUT_2026,
  runObligationPlugin,
} from "@/modules/obligations";
import { periodBoundsFromYearMonth } from "@/modules/obligations/period";

describe("EFD ICMS/IPI registro 0000", () => {
  it("usa COD_VER 020 e COD_FIN para período 2026", async () => {
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
    const context = buildObligationContextFromBatch({
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
        periodStart: "2026-06-01",
        periodEnd: "2026-06-30",
        accountantName: "Contador",
        accountantCpf: "39053344705",
        layoutVersion: EFD_ICMS_IPI_LAYOUT_2026,
      },
      documents: [parsed.document],
      items: parsed.items,
    });
    const out = await runObligationPlugin(efdIcmsIpiPlugin, context);
    const line0 = out.serialized?.content.split(/\r?\n/)[0] || "";
    // |0000|020|0|01062026|30062026|NOME|CNPJ|...
    expect(line0).toMatch(/^\|0000\|020\|0\|01062026\|30062026\|/);
    expect(efdIcmsIpiCodVer("2025-12-31")).toBe("019");
    expect(efdIcmsIpiCodVer("2026-01-01")).toBe("020");
  });

  it("periodBoundsFromYearMonth usa último dia do mês", () => {
    expect(periodBoundsFromYearMonth(2026, 6)).toEqual({
      periodStart: "2026-06-01",
      periodEnd: "2026-06-30",
    });
    expect(periodBoundsFromYearMonth(2026, 2)).toEqual({
      periodStart: "2026-02-01",
      periodEnd: "2026-02-28",
    });
  });
});
