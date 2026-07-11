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

/** Contagem oficial de campos (incluindo REG) — Guia Prático EFD ICMS/IPI. */
const EXPECTED_FIELD_COUNTS: Record<string, number> = {
  "0000": 15,
  "0001": 2,
  "0100": 14,
  "0150": 13,
  "0190": 3,
  "0200": 13,
  "0990": 2,
  C001: 2,
  C100: 29,
  C170: 38,
  C190: 11,
  C990: 2,
  "9001": 2,
  "9900": 3,
  "9990": 2,
  "9999": 2,
};

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
      activityCode: "0",
      purpose: "0",
      periodStart,
      periodEnd,
      accountantName: "Contador",
      accountantCpf: "39053344705",
      layoutVersion: EFD_ICMS_IPI_LAYOUT_2026,
    },
    documents: [parsed.document],
    items: parsed.items,
  });
}

describe("EFD ICMS/IPI registro 0000", () => {
  it("usa COD_VER 020 e COD_FIN para período 2026", async () => {
    const out = await runObligationPlugin(efdIcmsIpiPlugin, sampleContext());
    const line0 = out.serialized?.content.split(/\r?\n/)[0] || "";
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

describe("EFD ICMS/IPI field counts vs Guia Prático", () => {
  it("cada registro gerado tem a quantidade oficial de campos", async () => {
    const out = await runObligationPlugin(efdIcmsIpiPlugin, sampleContext());
    expect(out.serialized?.content).toBeTruthy();
    const lines = (out.serialized!.content || "").split(/\r?\n/).filter(Boolean);
    const mismatches: string[] = [];
    for (const line of lines) {
      const fields = line.replace(/^\|/, "").replace(/\|$/, "").split("|");
      const reg = fields[0] || "";
      const expected = EXPECTED_FIELD_COUNTS[reg];
      if (expected == null) continue;
      if (fields.length !== expected) {
        mismatches.push(`${reg}: got ${fields.length} expected ${expected} :: ${line.slice(0, 100)}`);
      }
    }
    expect(mismatches).toEqual([]);
  });

  it("usa vírgula decimal nos valores monetários", async () => {
    const out = await runObligationPlugin(efdIcmsIpiPlugin, sampleContext());
    const c100 = (out.serialized?.content || "").split(/\r?\n/).find((l) => l.startsWith("|C100|"));
    expect(c100).toBeTruthy();
    expect(c100).toMatch(/,\d{2}/);
    expect(c100).not.toMatch(/\d\.\d{2}\|/);
  });

  it("sanitiza pipe em descrições para não quebrar o leiaute", async () => {
    const { efdSanitize } = await import("@/modules/obligations/efd-icms-ipi/plugin");
    expect(efdSanitize("ACTIVE 1:100 | 50 LITROS")).toBe("ACTIVE 1:100 / 50 LITROS");
    expect(efdSanitize("a|b|c", 5)).toBe("a/b/c");
  });

  it("omite C170 para NF-e com chave (facultativo)", async () => {
    const out = await runObligationPlugin(efdIcmsIpiPlugin, sampleContext());
    const lines = (out.serialized?.content || "").split(/\r?\n/).filter(Boolean);
    expect(lines.some((l) => l.startsWith("|C170|"))).toBe(false);
    expect(lines.some((l) => l.startsWith("|C190|"))).toBe(true);
  });
});
