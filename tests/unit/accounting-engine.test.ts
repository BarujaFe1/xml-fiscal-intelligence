import { describe, expect, it } from "vitest";
import type { ChartAccount, JournalEntry, LedgerSnapshot } from "@/modules/accounting/types";
import {
  entryIsBalanced,
  validateEntry,
  ledgerHasDemoAccounts,
  assertEntryMutable,
} from "@/modules/accounting/rules";
import { buildDiario, buildTrialBalance } from "@/modules/accounting/books";
import { parseChartCsv, parseJournalCsv } from "@/modules/accounting/import/csv";
import { buildEcdFromLedger } from "@/modules/obligations/ecd/from-ledger";
import { runObligationPlugin, ecdPlugin, ECD_LAYOUT_2026 } from "@/modules/obligations";

function fixtureLedger(): LedgerSnapshot {
  const now = new Date().toISOString();
  const accounts: ChartAccount[] = [
    {
      id: "a1",
      workspaceId: "ws",
      companyId: "co",
      code: "1",
      name: "ATIVO",
      level: 1,
      nature: "01",
      kind: "synthetic",
      effectiveFrom: "2026-01-01",
      active: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "a2",
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
      id: "a3",
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
        { id: "l1", accountCode: "1.1.01", side: "D", amount: "1000,00", history: "Abertura" },
        { id: "l2", accountCode: "2.1.01", side: "C", amount: "1000,00", history: "Abertura" },
      ],
      origin: "manual",
      createdAt: now,
      updatedAt: now,
    },
  ];
  return { accounts, entries };
}

describe("accounting engine Fase 4", () => {
  it("validates double-entry balance", () => {
    const snap = fixtureLedger();
    expect(entryIsBalanced(snap.entries[0]!)).toBe(true);
    const bad = {
      ...snap.entries[0]!,
      lines: [{ id: "x", accountCode: "1.1.01", side: "D" as const, amount: "10" }],
    };
    expect(entryIsBalanced(bad)).toBe(false);
    expect(validateEntry(snap.entries[0]!, snap.accounts).some((i) => i.severity === "error")).toBe(
      false,
    );
  });

  it("rejects posting to synthetic accounts", () => {
    const snap = fixtureLedger();
    const e: JournalEntry = {
      ...snap.entries[0]!,
      lines: [
        { id: "l1", accountCode: "1", side: "D", amount: "10" },
        { id: "l2", accountCode: "2.1.01", side: "C", amount: "10" },
      ],
    };
    expect(validateEntry(e, snap.accounts).some((i) => i.code === "LEDGER_SYNTHETIC_POSTING")).toBe(
      true,
    );
  });

  it("locks approved entries from mutation helper", () => {
    const e = { ...fixtureLedger().entries[0]!, status: "locked" as const };
    expect(() => assertEntryMutable(e)).toThrow(/imutável/);
  });

  it("builds diario and trial balance", () => {
    const snap = fixtureLedger();
    const period = { start: "2026-01-01", end: "2026-12-31" };
    expect(buildDiario(snap, period).length).toBe(2);
    expect(buildTrialBalance(snap, period).length).toBeGreaterThan(0);
  });

  it("parses chart/journal CSV", () => {
    const chart = parseChartCsv(
      "code;name;level;nature;kind;parent\n1.1.01;Caixa;3;01;analytic;\n",
      { workspaceId: "ws", companyId: "co" },
    );
    expect(chart[0]?.code).toBe("1.1.01");
    const jes = parseJournalCsv(
      "date;batch;account;side;amount;history\n2026-01-01;A;1.1.01;D;1;x\n2026-01-01;A;2.1.01;C;1;x\n",
      { workspaceId: "ws", companyId: "co" },
    );
    expect(jes[0]?.lines.length).toBe(2);
  });

  it("generates ECD TXT from ledger with I200", () => {
    const snap = fixtureLedger();
    expect(ledgerHasDemoAccounts(snap.accounts)).toBe(false);
    const build = buildEcdFromLedger(
      {
        workspaceId: "ws",
        companyId: "co",
        establishmentId: "est",
        periodStart: "2026-01-01",
        periodEnd: "2026-12-31",
        layoutVersion: ECD_LAYOUT_2026,
        uf: "SP",
        cnpj: "11222333000181",
        companyName: "ACME",
        accountantName: "Contador",
        accountantCpf: "39053344705",
        purpose: "0",
        documents: [],
      },
      snap,
    );
    expect(build.records.some((r) => r.type === "I050")).toBe(true);
    expect(build.records.some((r) => r.type === "I200")).toBe(true);
    expect(build.records.some((r) => r.type === "I250")).toBe(true);
  });

  it("plugin blocks official mode when DEMO accounts present", async () => {
    const snap = fixtureLedger();
    snap.accounts[1]!.name = "Caixa DEMO";
    const out = await runObligationPlugin(ecdPlugin, {
      workspaceId: "ws",
      companyId: "co",
      establishmentId: "est",
      periodStart: "2026-01-01",
      periodEnd: "2026-12-31",
      layoutVersion: ECD_LAYOUT_2026,
      uf: "SP",
      cnpj: "11222333000181",
      companyName: "ACME",
      accountantName: "Contador",
      accountantCpf: "39053344705",
      purpose: "0",
      documents: [],
      extras: { ecdMode: "ledger", ledger: snap },
    });
    expect(out.readiness.canGenerate).toBe(false);
  });

  it("plugin demo mode still works without ledger", async () => {
    const out = await runObligationPlugin(ecdPlugin, {
      workspaceId: "ws",
      companyId: "co",
      establishmentId: "est",
      periodStart: "2026-01-01",
      periodEnd: "2026-12-31",
      layoutVersion: ECD_LAYOUT_2026,
      uf: "SP",
      cnpj: "11222333000181",
      companyName: "ACME",
      accountantName: "Contador",
      accountantCpf: "39053344705",
      purpose: "0",
      documents: [],
      extras: { ecdMode: "demo" },
    });
    expect(out.readiness.canGenerate).toBe(true);
    expect(out.serialized?.content).toMatch(/\|I050\|/);
    expect(out.build?.warnings.some((w) => /DEMO/i.test(w))).toBe(true);
  });
});
