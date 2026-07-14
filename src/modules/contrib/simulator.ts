/**
 * Simulador com/sem crédito — determinístico; claims comerciais atrás da flag.
 */

import { isFeatureEnabled } from "@/lib/feature-flags";
import type { ContribSimScenario, ContribSnapshot } from "@/modules/contrib/types";
import { sumByKind } from "@/modules/contrib/books";

function fmt(n: number): string {
  return n.toFixed(2).replace(".", ",");
}

export function isContribSimulatorEnabled(): boolean {
  return isFeatureEnabled("contribSimulator");
}

/**
 * Cenários A (com crédito explícito) e B (sem crédito).
 * Não aplica alíquota sobre receita — usa débitos/créditos do domínio.
 */
export function simulateWithWithoutCredit(
  snap: ContribSnapshot,
  opts?: { forceEnable?: boolean },
): { enabled: boolean; gatedReason?: string; scenarios: ContribSimScenario[] } {
  const enabled = opts?.forceEnable === true || isContribSimulatorEnabled();
  if (!enabled) {
    return {
      enabled: false,
      gatedReason:
        "FEATURE_CONTRIB_SIMULATOR off — simulador disponível só para lab interno até evidência PGE",
      scenarios: [],
    };
  }

  const entries = snap.entries.filter((e) => e.periodKey === snap.periodKey);
  const debit = sumByKind(entries, "debit");
  const credit = sumByKind(
    entries.filter((e) => e.kind !== "credit" || e.creditExplicit),
    "credit",
  );
  const base = sumByKind(entries, "revenue") || debit;

  const withCredit: ContribSimScenario = {
    id: "with_credit",
    basePis: fmt(base),
    creditPis: fmt(credit),
    debitPis: fmt(debit),
    toPayPis: fmt(Math.max(0, debit - credit)),
    baseCofins: fmt(base),
    creditCofins: fmt(credit),
    debitCofins: fmt(debit),
    toPayCofins: fmt(Math.max(0, debit - credit)),
    notes: [
      "Cenário A: aproveita créditos creditExplicit do domínio",
      "PIS/COFINS espelhados estruturalmente (sem alíquota inventada)",
    ],
  };

  const without: ContribSimScenario = {
    id: "without_credit",
    basePis: fmt(base),
    creditPis: "0,00",
    debitPis: fmt(debit),
    toPayPis: fmt(Math.max(0, debit)),
    baseCofins: fmt(base),
    creditCofins: "0,00",
    debitCofins: fmt(debit),
    toPayCofins: fmt(Math.max(0, debit)),
    notes: ["Cenário B: ignora créditos", `delta a recolher vs A: ${fmt(credit)}`],
  };

  return { enabled: true, scenarios: [withCredit, without] };
}
