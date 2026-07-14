/**
 * Modos dual — nunca apagar historical_and_credit_management.
 */

import type { ContribMode } from "@/modules/contrib/types";

export const CONTRIB_MODE_LABELS: Record<ContribMode, string> = {
  current_fact_generation: "Geração do fato corrente (período vigente)",
  historical_and_credit_management:
    "Histórico e gestão de créditos (pré-reforma / retenção de saldos)",
};

export function parseContribMode(raw: unknown): ContribMode {
  if (raw === "historical_and_credit_management") return "historical_and_credit_management";
  return "current_fact_generation";
}

/** Ambos modos permanecem suportados até 2027+ — NT 11/2026 não apaga o módulo. */
export function listSupportedModes(): ContribMode[] {
  return ["current_fact_generation", "historical_and_credit_management"];
}

export function modeDisclaimer(mode: ContribMode): string {
  if (mode === "historical_and_credit_management") {
    return "Modo histórico ativo — créditos/saldos pré-reforma preservados; não apagar após NT 11/2026.";
  }
  return "Modo fato corrente — geração assistida do período; histórico permanece disponível em paralelo.";
}
