import { money, type Money } from "@/lib/money/decimal";
import type { ChartAccount, JournalEntry, JournalEntryStatus } from "@/modules/accounting/types";
import { sha256Hex } from "@/lib/security/hash";

export type LedgerIssue = {
  code: string;
  severity: "error" | "warning";
  message: string;
  entryId?: string;
};

function lineAmount(raw: string): Money {
  return money(raw);
}

/** Double-entry: sum(D) === sum(C). */
export function entryIsBalanced(entry: JournalEntry): boolean {
  let d = money("0");
  let c = money("0");
  for (const line of entry.lines) {
    const a = lineAmount(line.amount);
    if (line.side === "D") d = d.plus(a);
    else c = c.plus(a);
  }
  return d.scaled === c.scaled && entry.lines.length >= 2;
}

export function validateEntry(
  entry: JournalEntry,
  accounts: ChartAccount[],
  period?: { start: string; end: string },
): LedgerIssue[] {
  const issues: LedgerIssue[] = [];
  if (entry.lines.length < 2) {
    issues.push({
      code: "LEDGER_MIN_LINES",
      severity: "error",
      message: "Lançamento exige ao menos 2 linhas",
      entryId: entry.id,
    });
  }
  if (!entryIsBalanced(entry)) {
    issues.push({
      code: "LEDGER_UNBALANCED",
      severity: "error",
      message: "Partidas desequilibradas (débito ≠ crédito)",
      entryId: entry.id,
    });
  }
  const byCode = new Map(accounts.map((a) => [a.code, a]));
  for (const line of entry.lines) {
    const acc = byCode.get(line.accountCode);
    if (!acc) {
      issues.push({
        code: "LEDGER_UNKNOWN_ACCOUNT",
        severity: "error",
        message: `Conta inexistente: ${line.accountCode}`,
        entryId: entry.id,
      });
      continue;
    }
    if (!acc.active) {
      issues.push({
        code: "LEDGER_INACTIVE_ACCOUNT",
        severity: "error",
        message: `Conta inativa: ${line.accountCode}`,
        entryId: entry.id,
      });
    }
    if (acc.kind === "synthetic") {
      issues.push({
        code: "LEDGER_SYNTHETIC_POSTING",
        severity: "error",
        message: `Lançamento em conta sintética: ${line.accountCode}`,
        entryId: entry.id,
      });
    }
  }
  if (period) {
    if (entry.entryDate < period.start || entry.entryDate > period.end) {
      issues.push({
        code: "LEDGER_OUT_OF_PERIOD",
        severity: "warning",
        message: `Data ${entry.entryDate} fora do período ${period.start}…${period.end}`,
        entryId: entry.id,
      });
    }
  }
  return issues;
}

const STATUS_FLOW: Record<JournalEntryStatus, JournalEntryStatus[]> = {
  draft: ["posted", "draft"],
  posted: ["approved", "draft"],
  approved: ["locked"],
  locked: [],
};

export function canChangeStatus(from: JournalEntryStatus, to: JournalEntryStatus): boolean {
  return (STATUS_FLOW[from] || []).includes(to);
}

export function assertEntryMutable(entry: JournalEntry): void {
  if (entry.status === "locked" || entry.status === "approved") {
    throw new Error(`Lançamento ${entry.id} imutável (status=${entry.status})`);
  }
}

export async function hashEntry(entry: JournalEntry): Promise<string> {
  const payload = JSON.stringify({
    id: entry.id,
    date: entry.entryDate,
    lines: entry.lines.map((l) => ({
      a: l.accountCode,
      s: l.side,
      v: l.amount,
    })),
  });
  return sha256Hex(payload);
}

/** Account codes that look like built-in DEMO chart. */
export function isDemoAccountName(name: string): boolean {
  return /\bDEMO\b/i.test(name);
}

export function ledgerHasDemoAccounts(accounts: ChartAccount[]): boolean {
  return accounts.some((a) => isDemoAccountName(a.name) || a.code.startsWith("DEMO"));
}
