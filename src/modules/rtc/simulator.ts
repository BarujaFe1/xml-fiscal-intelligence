/**
 * Simulador RTC — gated; não inventa alíquotas.
 * Usa apenas taxAmountExplicit / creditAmount do domínio.
 */

import { isFeatureEnabled } from "@/lib/feature-flags";
import type { RtcFact, RtcSimScenario, RtcSnapshot } from "@/modules/rtc/types";

function parseAmt(s?: string): number {
  if (!s) return 0;
  return Number(String(s).replace(/\./g, "").replace(",", ".")) || 0;
}

function fmt(n: number): string {
  return n.toFixed(2).replace(".", ",");
}

function sumKind(facts: RtcFact[], kind: RtcFact["taxKind"]): number {
  return facts
    .filter((f) => f.taxKind === kind)
    .reduce((a, f) => a + parseAmt(f.taxAmountExplicit), 0);
}

function sumCredits(facts: RtcFact[]): number {
  return facts
    .filter((f) => f.creditExplicit)
    .reduce((a, f) => a + parseAmt(f.creditAmount), 0);
}

export function isRtcSimulatorEnabled(): boolean {
  return isFeatureEnabled("rtcSimulator");
}

/**
 * @param legacyCreditAmount crédito Contrib histórico INFORMADO (não inventado)
 */
export function simulateRtcImpact(
  snap: RtcSnapshot,
  opts?: { forceEnable?: boolean; legacyCreditAmount?: string },
): { enabled: boolean; gatedReason?: string; scenarios: RtcSimScenario[]; warnings: string[] } {
  const enabled = opts?.forceEnable === true || isRtcSimulatorEnabled();
  const warnings: string[] = [];
  if (!enabled) {
    return {
      enabled: false,
      gatedReason: "FEATURE_RTC_SIMULATOR off — lab interno até evidência oficial",
      scenarios: [],
      warnings: ["Simulador RTC bloqueado por feature flag"],
    };
  }

  const facts = snap.facts.filter((f) => f.periodKey === snap.periodKey);
  const missingTax = facts.filter((f) => f.baseAmount && !f.taxAmountExplicit && !f.rateExplicit);
  if (missingTax.length) {
    warnings.push(
      `${missingTax.length} fato(s) com base sem imposto/alíquota explícitos — excluídos do débito simulado`,
    );
  }

  const cbs = sumKind(facts, "CBS");
  const ibs = sumKind(facts, "IBS_UF") + sumKind(facts, "IBS_MUN");
  const crtb = sumKind(facts, "CRTB");
  const rtcCredit = sumCredits(facts);
  const legacy = parseAmt(opts?.legacyCreditAmount);

  const gross = cbs + ibs + crtb;

  const withLegacy: RtcSimScenario = {
    id: "legacy_credit_on",
    cbsDebit: fmt(cbs),
    ibsDebit: fmt(ibs),
    crtbDebit: fmt(crtb),
    legacyCreditApplied: fmt(legacy + rtcCredit),
    netEstimate: fmt(Math.max(0, gross - legacy - rtcCredit)),
    notes: [
      "Cenário A: aplica créditos RTC creditExplicit + crédito Contrib INFORMADO",
      "Sem aplicar alíquota sobre base — só taxAmountExplicit",
    ],
  };

  const without: RtcSimScenario = {
    id: "legacy_credit_off",
    cbsDebit: fmt(cbs),
    ibsDebit: fmt(ibs),
    crtbDebit: fmt(crtb),
    legacyCreditApplied: "0,00",
    netEstimate: fmt(Math.max(0, gross)),
    notes: ["Cenário B: ignora créditos", `delta vs A: ${fmt(legacy + rtcCredit)}`],
  };

  return { enabled: true, scenarios: [withLegacy, without], warnings };
}
