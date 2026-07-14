/**
 * Vincula ledger ECD ao workspace ECF (recuperação ativa).
 */

import type { LedgerSnapshot } from "@/modules/accounting/types";
import { ledgerHasDemoAccounts } from "@/modules/accounting/rules";
import { parseEcdPriorI050 } from "@/modules/accounting/import/ecd-prior";

export type EcdRecoveryResult = {
  ledger: LedgerSnapshot;
  warnings: string[];
  fromDemo: boolean;
};

/** Usa snapshot do motor contábil como ECD ativa. */
export function recoverEcdFromLedger(ledger: LedgerSnapshot): EcdRecoveryResult {
  const warnings: string[] = [];
  if (!ledger.accounts.length) warnings.push("Ledger sem contas");
  if (!ledger.entries.length) warnings.push("Ledger sem lançamentos — ECF estrutural apenas");
  const fromDemo = ledgerHasDemoAccounts(ledger.accounts);
  if (fromDemo) warnings.push("Contas DEMO no ledger — modo oficial ECF bloqueado");
  return { ledger, warnings, fromDemo };
}

/** Importa I050 de TXT ECD e mescla no snapshot (lineage via origin). */
export function mergeEcdTxtIntoLedger(
  txt: string,
  base: LedgerSnapshot,
  meta: { workspaceId: string; companyId: string },
): EcdRecoveryResult {
  const parsed = parseEcdPriorI050(txt, meta);
  const byCode = new Map(base.accounts.map((a) => [a.code, a]));
  for (const a of parsed) {
    if (!byCode.has(a.code)) byCode.set(a.code, a);
  }
  return recoverEcdFromLedger({
    accounts: [...byCode.values()],
    entries: base.entries,
  });
}
