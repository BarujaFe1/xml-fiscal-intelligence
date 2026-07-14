/**
 * Maturidade operação contínua.
 */

import type { ContinuousOpsMaturity } from "@/modules/continuous-ops/types";
import { runPilotGoldenPreview } from "@/modules/continuous-ops/erp/pilot";

export const CONTINUOUS_OPS_MATURITY: ContinuousOpsMaturity = "internal_beta";

export const CONTINUOUS_OPS_CAPABILITIES = [
  "adapters ERP nomeados (piloto synth + placeholders)",
  "multi-empresa filtros + quotas geração/API",
  "inbox NT sem auto-ativação",
  "re-homologação / export §28",
  "painel telemetria + alertas webhook sanitizados",
] as const;

export function continuousOpsHealth(): {
  maturity: ContinuousOpsMaturity;
  pilotGoldenOk: boolean;
  noProductionClaim: true;
} {
  const pilot = runPilotGoldenPreview();
  return {
    maturity: CONTINUOUS_OPS_MATURITY,
    pilotGoldenOk: pilot.ok,
    noProductionClaim: true,
  };
}
