import { describe, expect, it } from "vitest";
import type { ChartAccount, JournalEntry, LedgerSnapshot } from "@/modules/accounting/types";
import type { AccountReferentialMap, ElalurSnapshot } from "@/modules/ecf/types";
import { listOrphanAccounts, confirmMap, suggestReferentialForAccount } from "@/modules/ecf/mapper";
import { parseEcfPriorTxt, mapsFromPriorHints } from "@/modules/ecf/recovery/ecf-prior";
import { recoverEcdFromLedger } from "@/modules/ecf/recovery/ecd";
import { diffElalur, emptyElalur, sumPartA } from "@/modules/ecf/elalur/model";
import { parseReferentialCsv } from "@/modules/ecf/referential/catalog";
import { computeIrpjCsll } from "@/modules/ecf/irpj/engine";
import { reconcileEcdVsEcf } from "@/modules/ecf/reconcile";
import { isHomologationGradeEcfRun } from "@/modules/obligations/ecf/homologation";
import { runObligationPlugin, ecfPlugin, ECF_LAYOUT_2026 } from "@/modules/obligations";

function fixtureLedger(): LedgerSnapshot {
  const now = new Date().toISOString();
  const accounts: ChartAccount[] = [
    {
      id: "a1",
      workspaceId: "ws",
      companyId: "co",
      code: "1.1.01",
      name: "Caixa",
      level: 3,
      nature: "01",
      kind: "analytic",
      effectiveFrom: "2026-01-01",
      active: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "a2",
      workspaceId: "ws",
      companyId: "co",
      code: "2.1.01",
      name: "Fornecedores",
      level: 3,
      nature: "02",
      kind: "analytic",
      effectiveFrom: "2026-01-01",
      active: true,
      createdAt: now,
      updatedAt: now,
    },
  ];
  const entries: JournalEntry[] = [
    {
      id: "e1",
      workspaceId: "ws",
      companyId: "co",
      batchLabel: "L1",
      entryDate: "2026-03-10",
      status: "posted",
      lines: [
        { id: "l1", accountCode: "1.1.01", side: "D", amount: "1000,00" },
        { id: "l2", accountCode: "2.1.01", side: "C", amount: "1000,00" },
      ],
      origin: "manual",
      createdAt: now,
      updatedAt: now,
    },
  ];
  return { accounts, entries };
}

function confirmedMaps(companyId = "co"): AccountReferentialMap[] {
  const now = new Date().toISOString();
  return [
    confirmMap({
      id: "m1",
      workspaceId: "ws",
      companyId,
      accountCode: "1.1.01",
      referentialCode: "1.01.01",
      confirmedBy: "tester",
      createdAt: now,
    }),
    confirmMap({
      id: "m2",
      workspaceId: "ws",
      companyId,
      accountCode: "2.1.01",
      referentialCode: "2.01.01",
      confirmedBy: "tester",
      createdAt: now,
    }),
  ];
}

describe("ECF engine Fase 5", () => {
  it("lista órfãs e não auto-aplica sugestão", () => {
    const ledger = fixtureLedger();
    const orphans = listOrphanAccounts(ledger.accounts, []);
    expect(orphans).toHaveLength(2);
    const sug = suggestReferentialForAccount(ledger.accounts[0]!, [], [
      {
        id: "h",
        workspaceId: "ws",
        companyId: "co",
        accountCode: "1.1.01",
        referentialCode: "1.01.01",
        confirmedAt: new Date().toISOString(),
        createdAt: "",
        updatedAt: "",
      },
    ]);
    expect(sug.suggested).toBe("1.01.01");
    expect(sug.source).toBe("history");
  });

  it("parse ECF prior preserva lineage", () => {
    const txt = [
      "|0000|LECF|X|0|EMP|11222333000181|2026|0|0|0|1|0|0|N|N|",
      "|J050|20260101|1.1.01|Caixa|1.01.01|",
    ].join("\n");
    const prior = parseEcfPriorTxt(txt);
    expect(prior.cnpj).toBe("11222333000181");
    expect(prior.accountHints[0]?.lineageLine).toBe(2);
    expect(mapsFromPriorHints(prior, { workspaceId: "ws", companyId: "co" })[0]?.suggestedReferentialCode).toBe(
      "1.01.01",
    );
  });

  it("e-Lalur diff e soma Parte A", () => {
    const before = emptyElalur({ workspaceId: "ws", companyId: "co", periodKey: "2026", version: 1 });
    const after: ElalurSnapshot = {
      ...before,
      version: 2,
      partA: [
        {
          id: "x1",
          kind: "addition",
          accountCode: "1.1.01",
          amount: "200,00",
          origin: "manual",
        },
      ],
    };
    const d = diffElalur(before, after);
    expect(d.partAAdded).toHaveLength(1);
    expect(sumPartA(after.partA).additions).toBe(200);
  });

  it("IRPJ gated off por padrão", () => {
    const out = computeIrpjCsll({ periodKey: "2026", accountingProfit: "1000,00" });
    expect(out.enabled).toBe(false);
    expect(out.lines).toHaveLength(0);
  });

  it("IRPJ forceEnable usa lucro ± Parte A sem inventar alíquota", () => {
    const elalur = emptyElalur({ workspaceId: "ws", companyId: "co", periodKey: "2026" });
    elalur.partA.push({
      id: "a",
      kind: "addition",
      accountCode: "1.1.01",
      amount: "100,00",
      origin: "manual",
    });
    const out = computeIrpjCsll(
      { periodKey: "2026", accountingProfit: "1000,00", elalur },
      { forceEnable: true },
    );
    expect(out.enabled).toBe(true);
    expect(out.lines[0]?.baseIrpj).toBe("1100,00");
    expect(out.lines[0]?.irpj).toBe("0,00");
    expect(out.warnings.some((w) => /Alíquotas/i.test(w))).toBe(true);
  });

  it("import referencial CSV versionado", () => {
    const t = parseReferentialCsv("code;name\n1.01.01;Caixa\n", {
      workspaceId: "ws",
      tableCode: "plano",
      versionLabel: "v1",
      effectiveFrom: "2026-01-01",
    });
    expect(t.entries).toHaveLength(1);
  });

  it("homologationGrade exige hash + versão + status conhecido", () => {
    expect(
      isHomologationGradeEcfRun({
        contentHash: "abcd".repeat(8),
        programVersion: "1.0",
        resultStatus: "ok",
      }),
    ).toBe(true);
    expect(
      isHomologationGradeEcfRun({
        contentHash: "abcd".repeat(8),
        programVersion: "1.0",
        resultStatus: "unknown",
      }),
    ).toBe(false);
  });

  it("plugin oficial com mapas gera J050 e bloqueia órfãs", async () => {
    const ledger = fixtureLedger();
    const blocked = await runObligationPlugin(ecfPlugin, {
      workspaceId: "ws",
      companyId: "co",
      establishmentId: "e",
      periodStart: "2026-01-01",
      periodEnd: "2026-12-31",
      layoutVersion: ECF_LAYOUT_2026,
      uf: "SP",
      cnpj: "11222333000181",
      companyName: "TESTE",
      purpose: "0",
      documents: [],
      extras: { ecfMode: "official", ecdLedger: ledger, accountMaps: [] },
    });
    expect(blocked.readiness.canGenerate).toBe(false);

    const maps = confirmedMaps();
    expect(listOrphanAccounts(ledger.accounts, maps)).toHaveLength(0);
    expect(recoverEcdFromLedger(ledger).fromDemo).toBe(false);
    expect(reconcileEcdVsEcf({ ledger, maps }).some((f) => f.code === "MAP_ORPHAN")).toBe(false);

    const ok = await runObligationPlugin(ecfPlugin, {
      workspaceId: "ws",
      companyId: "co",
      establishmentId: "e",
      periodStart: "2026-01-01",
      periodEnd: "2026-12-31",
      layoutVersion: ECF_LAYOUT_2026,
      uf: "SP",
      cnpj: "11222333000181",
      companyName: "TESTE",
      purpose: "0",
      documents: [],
      extras: { ecfMode: "official", taxRegime: "1", ecdLedger: ledger, accountMaps: maps },
    });
    expect(ok.readiness.canGenerate).toBe(true);
    expect(ok.serialized?.content).toMatch(/\|J050\|/);
    expect(ok.serialized?.content).toMatch(/\|L030\|/);
    expect(ok.manifest?.disclaimer).toMatch(/IRPJ/i);
  });
});
