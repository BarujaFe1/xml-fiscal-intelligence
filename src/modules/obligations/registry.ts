import type { FiscalObligationPlugin } from "@/modules/obligations/core/types";
import { efdIcmsIpiPlugin } from "@/modules/obligations/efd-icms-ipi/plugin";
import { efdContribuicoesPlugin } from "@/modules/obligations/efd-contribuicoes/plugin";
import { ecdPlugin } from "@/modules/obligations/ecd/plugin";
import { ecfPlugin } from "@/modules/obligations/ecf/plugin";
import { reinfPlugin } from "@/modules/obligations/reinf/plugin";
import {
  type ObligationId,
  OBLIGATION_LABELS,
  OBLIGATION_BLURBS,
  isObligationId,
} from "@/modules/obligations/core/registry/ids";
import { OBLIGATION_SUPPORT_PROFILES, getSupportProfile } from "@/modules/obligations/core/registry/maturity-profiles";
import type { ObligationMaturity } from "@/modules/obligations/core/maturity";

export type {
  ObligationId,
} from "@/modules/obligations/core/registry/ids";
export {
  OBLIGATION_LABELS,
  OBLIGATION_BLURBS,
  OBLIGATION_IDS,
  isObligationId,
} from "@/modules/obligations/core/registry/ids";
export { OBLIGATION_SUPPORT_PROFILES, getSupportProfile } from "@/modules/obligations/core/registry/maturity-profiles";

export const obligationPlugins: Record<ObligationId, FiscalObligationPlugin> = {
  "efd-icms-ipi": efdIcmsIpiPlugin,
  "efd-contribuicoes": efdContribuicoesPlugin,
  ecd: ecdPlugin,
  ecf: ecfPlugin,
  reinf: reinfPlugin,
};

/** @deprecated use OBLIGATION_SUPPORT_PROFILES[id].maturity — kept for gradual migration */
export const obligationRegistry: Record<ObligationId, ObligationMaturity> = {
  "efd-icms-ipi": OBLIGATION_SUPPORT_PROFILES["efd-icms-ipi"].maturity,
  "efd-contribuicoes": OBLIGATION_SUPPORT_PROFILES["efd-contribuicoes"].maturity,
  ecd: OBLIGATION_SUPPORT_PROFILES.ecd.maturity,
  ecf: OBLIGATION_SUPPORT_PROFILES.ecf.maturity,
  reinf: OBLIGATION_SUPPORT_PROFILES.reinf.maturity,
};

export function getObligationPlugin(id: string): FiscalObligationPlugin | null {
  if (isObligationId(id)) return obligationPlugins[id];
  return null;
}

export function canOpenAssistant(id: ObligationId): boolean {
  const m = getSupportProfile(id).maturity;
  return m !== "planned";
}
