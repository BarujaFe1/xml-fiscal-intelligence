import { money } from "@/lib/money/decimal";
import type { ChartAccount, JournalEntry, LedgerSnapshot } from "@/modules/accounting/types";

export type DiarioLine = {
  entryId: string;
  entryDate: string;
  accountCode: string;
  side: "D" | "C";
  amount: string;
  history?: string;
  batchLabel: string;
};

export type RazaoLine = DiarioLine & { runningDebit: string; runningCredit: string; balanceSide: "D" | "C" | "Z"; balance: string };

export type TrialBalanceRow = {
  accountCode: string;
  accountName: string;
  debit: string;
  credit: string;
};

/** Diário: linhas de lançamentos posted+ no período. */
export function buildDiario(
  snapshot: LedgerSnapshot,
  period: { start: string; end: string },
): DiarioLine[] {
  const out: DiarioLine[] = [];
  for (const e of snapshot.entries) {
    if (e.status === "draft") continue;
    if (e.entryDate < period.start || e.entryDate > period.end) continue;
    for (const line of e.lines) {
      out.push({
        entryId: e.id,
        entryDate: e.entryDate,
        accountCode: line.accountCode,
        side: line.side,
        amount: line.amount,
        history: line.history,
        batchLabel: e.batchLabel,
      });
    }
  }
  out.sort((a, b) => a.entryDate.localeCompare(b.entryDate) || a.entryId.localeCompare(b.entryId));
  return out;
}

export function buildRazao(
  snapshot: LedgerSnapshot,
  accountCode: string,
  period: { start: string; end: string },
): RazaoLine[] {
  const diario = buildDiario(snapshot, period).filter((l) => l.accountCode === accountCode);
  let d = money("0");
  let c = money("0");
  return diario.map((l) => {
    const a = money(l.amount);
    if (l.side === "D") d = d.plus(a);
    else c = c.plus(a);
    const net = d.scaled - c.scaled;
    const balanceSide: "D" | "C" | "Z" = net === 0n ? "Z" : net > 0n ? "D" : "C";
    const abs = net < 0n ? -net : net;
    const balance = formatScaled(abs);
    return {
      ...l,
      runningDebit: d.toFixed(2).replace(".", ","),
      runningCredit: c.toFixed(2).replace(".", ","),
      balanceSide,
      balance,
    };
  });
}

function formatScaled(scaled: bigint): string {
  const FACTOR = 1_000_000n;
  const intPart = scaled / FACTOR;
  const frac = (scaled % FACTOR).toString().padStart(6, "0").slice(0, 2);
  return `${intPart},${frac}`;
}

export function buildTrialBalance(
  snapshot: LedgerSnapshot,
  period: { start: string; end: string },
): TrialBalanceRow[] {
  const map = new Map<string, { d: ReturnType<typeof money>; c: ReturnType<typeof money> }>();
  for (const line of buildDiario(snapshot, period)) {
    const cur = map.get(line.accountCode) || { d: money("0"), c: money("0") };
    const a = money(line.amount);
    if (line.side === "D") cur.d = cur.d.plus(a);
    else cur.c = cur.c.plus(a);
    map.set(line.accountCode, cur);
  }
  const names = new Map(snapshot.accounts.map((a) => [a.code, a.name]));
  return [...map.entries()]
    .map(([accountCode, v]) => ({
      accountCode,
      accountName: names.get(accountCode) || accountCode,
      debit: v.d.toFixed(2).replace(".", ","),
      credit: v.c.toFixed(2).replace(".", ","),
    }))
    .sort((a, b) => a.accountCode.localeCompare(b.accountCode));
}

/** BP/DRE stub: aggregate by nature — methodology note only. */
export function buildNatureTotals(snapshot: LedgerSnapshot, period: { start: string; end: string }) {
  const byNature: Record<string, { debit: string; credit: string }> = {};
  const natures = new Map(snapshot.accounts.map((a: ChartAccount) => [a.code, a.nature]));
  for (const row of buildTrialBalance(snapshot, period)) {
    const n = natures.get(row.accountCode) || "09";
    const cur = byNature[n] || { debit: "0,00", credit: "0,00" };
    byNature[n] = {
      debit: money(cur.debit).plus(money(row.debit)).toFixed(2).replace(".", ","),
      credit: money(cur.credit).plus(money(row.credit)).toFixed(2).replace(".", ","),
    };
  }
  return byNature;
}
