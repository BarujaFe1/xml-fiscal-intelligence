/**
 * Maturidade do processo de homologação (plataforma) + banners comerciais.
 */

import type { HomologationPlatformMaturity } from "@/modules/homologation/types";
import type { ObligationMaturity } from "@/modules/obligations/core/maturity";
import { OBLIGATION_SUPPORT_PROFILES } from "@/modules/obligations/core/registry/maturity-profiles";
import type { ObligationId } from "@/modules/obligations/core/registry/ids";

export const HOMOLOGATION_PLATFORM_MATURITY: HomologationPlatformMaturity = "internal_beta";

export const SUPPORT_RUNBOOK_DONT_PROMISE = [
  "Não prometemos substituição do PVA/PGE/Programas da RFB",
  "Não prometemos production global — só células validated_scope com pacote §28",
  "Não transmitimos Reinf sem FEATURE_REINF_SUBMIT + checklist + SoD",
  "Não inventamos alíquotas CBS/IBS nem créditos PIS/COFINS",
  "Não distribuímos binários oficiais RFB",
] as const;

export function mustShowNonProductionBanner(maturity: ObligationMaturity): boolean {
  return maturity !== "validated_scope" && maturity !== "production";
}

export function obligationBanners(): Array<{
  obligationId: ObligationId;
  maturity: ObligationMaturity;
  bannerNonProduction: boolean;
}> {
  return (Object.keys(OBLIGATION_SUPPORT_PROFILES) as ObligationId[]).map((id) => {
    const maturity = OBLIGATION_SUPPORT_PROFILES[id].maturity;
    return {
      obligationId: id,
      maturity,
      bannerNonProduction: mustShowNonProductionBanner(maturity),
    };
  });
}

/** Comercial: validated_scope só se existir cenário ready — hoje none no repo. */
export function commercialValidatedScopeClaims(scenarioReadyCount: number): {
  claimValidatedScope: boolean;
  reason: string;
} {
  if (scenarioReadyCount <= 0) {
    return {
      claimValidatedScope: false,
      reason: "Nenhum ValidatedScenario em validated_scope_ready no workspace",
    };
  }
  return {
    claimValidatedScope: true,
    reason: `${scenarioReadyCount} cenário(s) com pacote §28 — claim limitado a esses cenários`,
  };
}
