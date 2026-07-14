/**
 * Build ECD records from a real LedgerSnapshot (not DEMO, not XML).
 */

import type {
  ObligationBuildResult,
  ObligationContext,
  ObligationRecord,
} from "@/modules/obligations/core/types";
import { appendSpedClosers } from "@/modules/obligations/core/pipe";
import type { LedgerSnapshot } from "@/modules/accounting/types";
import { ledgerHasDemoAccounts } from "@/modules/accounting/rules";
import { buildDiario, buildTrialBalance } from "@/modules/accounting/books";

export const ECD_LAYOUT_2026 = "ECD_2026_DRAFT";

export function buildEcdFromLedger(
  context: ObligationContext,
  snapshot: LedgerSnapshot,
): ObligationBuildResult {
  const warnings: string[] = [
    "ECD gerada a partir do motor contábil (ledger) — não de XML fiscal.",
    "Conferir Programa ECD oficial antes de qualquer entrega.",
  ];
  if (ledgerHasDemoAccounts(snapshot.accounts)) {
    warnings.push("Ledger ainda contém contas DEMO no nome — remover antes de uso oficial.");
  }
  const analytic = snapshot.accounts.filter((a) => a.kind === "analytic" && a.active);
  if (!analytic.length) {
    throw new Error("Ledger sem contas analíticas ativas — importe o plano de contas");
  }

  const dtIni = context.periodStart.replace(/-/g, "");
  const dtFin = context.periodEnd.replace(/-/g, "");
  const period = { start: context.periodStart, end: context.periodEnd };
  const records: ObligationRecord[] = [];

  records.push({
    type: "0000",
    fields: [
      "LECD",
      ECD_LAYOUT_2026,
      "0",
      dtIni,
      dtFin,
      context.companyName.slice(0, 100),
      context.cnpj.replace(/\D/g, "").slice(0, 14),
      context.uf,
      context.ie || "",
      "",
      "0",
      "0",
      context.purpose || "0",
    ],
  });
  records.push({ type: "0001", fields: ["0"] });
  records.push({ type: "0007", fields: [context.uf, context.ie || ""] });
  records.push({ type: "0990", fields: ["4"] });

  records.push({ type: "I001", fields: ["0"] });
  records.push({ type: "I010", fields: ["G", "1.00"] });
  records.push({
    type: "I030",
    fields: [
      "1",
      "0",
      "1",
      context.companyName.slice(0, 100),
      context.cnpj.replace(/\D/g, "").slice(0, 14),
      "LEDGER",
      dtIni,
      "1",
      dtFin,
      "",
      context.uf,
      "",
      context.ie || "",
      "",
      "",
      context.accountantName || "",
      onlyDigits(context.accountantCpf),
      "",
      "0",
    ],
  });

  for (const acc of snapshot.accounts.filter((a) => a.active)) {
    records.push({
      type: "I050",
      fields: [
        (acc.effectiveFrom || context.periodStart).replace(/-/g, ""),
        acc.kind === "synthetic" ? "S" : "A",
        String(acc.level),
        acc.nature,
        acc.code,
        acc.name.slice(0, 100),
        acc.referentialCode || "",
        "",
      ],
      lineage: [
        {
          record: "I050",
          field: "COD_CTA",
          value: acc.code,
          sourceType: "manual",
          sourceRef: acc.id,
          transformation: "ledger_chart",
        },
      ],
    });
  }

  // I200 from posted journal lines in period (not from NF-e)
  const diario = buildDiario(snapshot, period);
  const byEntry = new Map<string, typeof diario>();
  for (const line of diario) {
    const arr = byEntry.get(line.entryId) || [];
    arr.push(line);
    byEntry.set(line.entryId, arr);
  }
  let i200Count = 0;
  for (const [entryId, lines] of byEntry) {
    const entry = snapshot.entries.find((e) => e.id === entryId);
    if (!entry || entry.status === "draft") continue;
    const dt = entry.entryDate.replace(/-/g, "");
    records.push({
      type: "I200",
      fields: [entry.batchLabel.slice(0, 20), dt, "0", "N", ""],
      lineage: [
        {
          record: "I200",
          field: "NUM_LCTO",
          value: entry.batchLabel,
          sourceType: "manual",
          sourceRef: entry.id,
          transformation: "ledger_journal",
        },
      ],
    });
    i200Count += 1;
    for (const line of lines) {
      records.push({
        type: "I250",
        fields: [
          line.accountCode,
          "",
          line.amount.replace(".", ","),
          line.side,
          "",
          "",
          (line.history || "").slice(0, 100),
          "",
          "",
        ],
      });
    }
  }
  if (!i200Count) {
    warnings.push("Nenhum I200 no período — ledger sem lançamentos posted/approved no intervalo.");
  }

  records.push({
    type: "I150",
    fields: [dtIni.slice(0, 6), dtIni, dtFin],
  });
  const trial = buildTrialBalance(snapshot, period);
  for (const row of trial) {
    records.push({
      type: "I155",
      fields: [row.accountCode, "", row.debit, "D", row.credit, "C", "0", "D", "0", "D"],
    });
  }

  const iBlockCount = records.filter((r) => r.type.startsWith("I")).length + 1;
  records.push({ type: "I990", fields: [String(iBlockCount)] });
  records.push({ type: "J001", fields: ["1"] });
  records.push({ type: "J990", fields: ["2"] });

  const closed = appendSpedClosers(records, warnings);
  return {
    obligationId: "ecd",
    layoutVersion: ECD_LAYOUT_2026,
    records: closed,
    lineage: closed.flatMap((r) => r.lineage || []),
    warnings,
  };
}

function onlyDigits(v?: string) {
  return (v || "").replace(/\D/g, "");
}
