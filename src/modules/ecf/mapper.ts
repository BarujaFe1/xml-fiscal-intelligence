/**
 * Conta contábil ↔ referencial. Sugestões nunca auto-aplicam.
 */

import type { ChartAccount } from "@/modules/accounting/types";
import type { AccountReferentialMap } from "@/modules/ecf/types";

export type OrphanAccount = {
  accountCode: string;
  name: string;
  reason: "unmapped" | "unconfirmed";
};

export function listOrphanAccounts(
  accounts: ChartAccount[],
  maps: AccountReferentialMap[],
): OrphanAccount[] {
  const byCode = new Map(maps.map((m) => [m.accountCode, m]));
  const orphans: OrphanAccount[] = [];
  for (const a of accounts) {
    if (a.kind !== "analytic" || !a.active) continue;
    if (a.referentialCode?.trim()) continue; // already on chart
    const map = byCode.get(a.code);
    if (!map) {
      orphans.push({ accountCode: a.code, name: a.name, reason: "unmapped" });
      continue;
    }
    if (!map.confirmedAt || !map.referentialCode.trim()) {
      orphans.push({ accountCode: a.code, name: a.name, reason: "unconfirmed" });
    }
  }
  return orphans;
}

/** Sugere referencial do histórico / campo da conta — NÃO grava confirmação. */
export function suggestReferentialForAccount(
  account: ChartAccount,
  maps: AccountReferentialMap[],
  historical?: AccountReferentialMap[],
): { suggested?: string; source?: AccountReferentialMap["suggestionSource"] } {
  if (account.referentialCode?.trim()) {
    return { suggested: account.referentialCode.trim(), source: "manual" };
  }
  const existing = maps.find((m) => m.accountCode === account.code);
  if (existing?.referentialCode?.trim()) {
    return { suggested: existing.referentialCode, source: "manual" };
  }
  if (existing?.suggestedReferentialCode?.trim()) {
    return { suggested: existing.suggestedReferentialCode, source: existing.suggestionSource || "history" };
  }
  const hist = historical?.find((m) => m.accountCode === account.code && m.referentialCode);
  if (hist?.referentialCode) {
    return { suggested: hist.referentialCode, source: "history" };
  }
  return {};
}

export function confirmMap(
  draft: Omit<AccountReferentialMap, "confirmedAt" | "confirmedBy" | "updatedAt"> & {
    confirmedBy: string;
  },
): AccountReferentialMap {
  const now = new Date().toISOString();
  return {
    ...draft,
    suggestedReferentialCode: undefined,
    confirmedAt: now,
    updatedAt: now,
  };
}
