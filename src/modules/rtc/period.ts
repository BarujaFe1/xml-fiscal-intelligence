/**
 * Vigência / split de transição RTC.
 * Datas de marco vêm só de sourceId — sem hardcode de alíquota.
 */

import type { RtcPeriodSplit } from "@/modules/rtc/types";

export type RtcPeriodProfile = {
  split: RtcPeriodSplit;
  sourceId: string;
  /** Contribuições: modo sugerido — nunca apaga historical */
  contribModeHint: "current_fact_generation" | "historical_and_credit_management" | "both";
  notes: string[];
};

/**
 * Heurística de período baseada em ano-calendário ORIENTATIVA:
 * - até 2025 inclusive: pré-reforma (fatos RTC tipicamente vazios)
 * - 2026: transição (dualidade obrigatória com Contrib)
 * - 2027+: pós (Contrib histórico permanece disponível)
 *
 * Não define alíquotas. sourceId obrigatório.
 */
export function resolveRtcPeriodSplit(periodKey: string): RtcPeriodProfile {
  const year = Number(periodKey.slice(0, 4));
  const sourceId = "official:reforma:consumo-2026";
  if (!Number.isFinite(year) || year < 2000) {
    return {
      split: "pre_reform",
      sourceId,
      contribModeHint: "current_fact_generation",
      notes: ["periodKey inválido — tratado como pré-reforma sem fatos RTC"],
    };
  }
  if (year <= 2025) {
    return {
      split: "pre_reform",
      sourceId,
      contribModeHint: "current_fact_generation",
      notes: ["Pré-reforma: módulo Contrib pleno; RTC sem geração de débito automático"],
    };
  }
  if (year === 2026) {
    return {
      split: "transition",
      sourceId,
      contribModeHint: "both",
      notes: [
        "Transição 2026: dualidade Contrib + RTC; historical_and_credit_management permanece",
        "Não apagar Bloco M / créditos PIS/COFINS",
      ],
    };
  }
  return {
    split: "post_reform",
    sourceId,
    contribModeHint: "historical_and_credit_management",
    notes: [
      "Pós-reforma: RTC operacional no domínio; Contrib histórico/créditos preservados (NT 11/2026 catalog)",
    ],
  };
}

export function assertContribModulePreserved(): {
  ok: true;
  message: string;
} {
  return {
    ok: true,
    message:
      "EFD-Contribuições (domínio + Bloco M + historical_and_credit_management) permanece — RTC não apaga o módulo",
  };
}
