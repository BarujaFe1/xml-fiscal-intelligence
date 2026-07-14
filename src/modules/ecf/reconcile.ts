/**
 * Conciliação ECD × ECF / ECF × prior.
 */

import type { LedgerSnapshot } from "@/modules/accounting/types";
import type { AccountReferentialMap, EcfPriorCanonical, ElalurSnapshot } from "@/modules/ecf/types";
import { listOrphanAccounts } from "@/modules/ecf/mapper";

export type ReconcileFinding = {
  code: string;
  severity: "error" | "warning" | "info";
  message: string;
};

export function reconcileEcdVsEcf(input: {
  ledger: LedgerSnapshot;
  maps: AccountReferentialMap[];
  elalur?: ElalurSnapshot;
}): ReconcileFinding[] {
  const findings: ReconcileFinding[] = [];
  const orphans = listOrphanAccounts(input.ledger.accounts, input.maps);
  for (const o of orphans) {
    findings.push({
      code: "MAP_ORPHAN",
      severity: "error",
      message: `Conta ${o.accountCode} (${o.name}) ${o.reason === "unmapped" ? "sem mapa referencial" : "mapa não confirmado"}`,
    });
  }
  if (!input.ledger.entries.length) {
    findings.push({
      code: "ECD_NO_ENTRIES",
      severity: "warning",
      message: "Ledger sem lançamentos — saldos ECF podem ficar vazios",
    });
  }
  if (input.elalur) {
    const unapproved = input.elalur.partA.filter((l) => !l.approvedAt);
    if (unapproved.length) {
      findings.push({
        code: "ELALUR_PENDING",
        severity: "warning",
        message: `${unapproved.length} linha(s) Parte A sem aprovação`,
      });
    }
  }
  return findings;
}

export function reconcileEcfVsPrior(
  prior: EcfPriorCanonical,
  maps: AccountReferentialMap[],
): ReconcileFinding[] {
  const findings: ReconcileFinding[] = [];
  for (const w of prior.warnings) {
    findings.push({ code: "PRIOR_WARN", severity: "warning", message: w });
  }
  for (const h of prior.accountHints) {
    if (!h.referentialCode) continue;
    const map = maps.find((m) => m.accountCode === h.code && m.confirmedAt);
    if (!map) {
      findings.push({
        code: "PRIOR_UNMAPPED",
        severity: "info",
        message: `Prior sugeriu referencial ${h.referentialCode} p/ ${h.code} (linha ${h.lineageLine}) — confirme no mapper`,
      });
    } else if (map.referentialCode !== h.referentialCode) {
      findings.push({
        code: "PRIOR_DIFF",
        severity: "warning",
        message: `Conta ${h.code}: prior ${h.referentialCode} ≠ mapa ${map.referentialCode}`,
      });
    }
  }
  return findings;
}
