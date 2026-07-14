/**
 * Matriz comercial — espelha ObligationMaturity real (nunca força production).
 */

import {
  OBLIGATION_SUPPORT_PROFILES,
  type ObligationId,
} from "@/modules/obligations/registry";
import type { ObligationMaturity } from "@/modules/obligations/core/maturity";
import { OBLIGATION_MATURITY_LABELS } from "@/modules/obligations/core/maturity";

export type CommercialPlanHint = "free" | "starter" | "pro" | "enterprise_beta" | "future";

export type CommercialRow = {
  resource: string;
  obligationId?: ObligationId;
  planHint: CommercialPlanHint;
  maturity: ObligationMaturity | "n/a";
  maturityLabel: string;
  productionClaimAllowed: false;
  bannerNonProduction: boolean;
};

const PLAN_BY_MATURITY: Record<ObligationMaturity, CommercialPlanHint> = {
  planned: "future",
  foundation: "starter",
  development: "enterprise_beta",
  internal_beta: "pro",
  official_validator_beta: "enterprise_beta",
  validated_scope: "pro",
  production: "pro",
};

export function buildCommercialSupportMatrix(): CommercialRow[] {
  const rows: CommercialRow[] = [
    {
      resource: "Import XML + lotes locais",
      planHint: "free",
      maturity: "n/a",
      maturityLabel: "—",
      productionClaimAllowed: false,
      bannerNonProduction: false,
    },
    {
      resource: "Cadastro empresas / mestres",
      planHint: "starter",
      maturity: "foundation",
      maturityLabel: OBLIGATION_MATURITY_LABELS.foundation,
      productionClaimAllowed: false,
      bannerNonProduction: true,
    },
    {
      resource: "Cockpit fechamento / ops",
      planHint: "starter",
      maturity: "foundation",
      maturityLabel: OBLIGATION_MATURITY_LABELS.foundation,
      productionClaimAllowed: false,
      bannerNonProduction: true,
    },
  ];

  for (const [id, profile] of Object.entries(OBLIGATION_SUPPORT_PROFILES) as [
    ObligationId,
    (typeof OBLIGATION_SUPPORT_PROFILES)[ObligationId],
  ][]) {
    const m = profile.maturity;
    rows.push({
      resource: profile.id,
      obligationId: id,
      planHint: PLAN_BY_MATURITY[m],
      maturity: m,
      maturityLabel: OBLIGATION_MATURITY_LABELS[m],
      productionClaimAllowed: false,
      bannerNonProduction: m !== "validated_scope" && m !== "production",
    });
  }

  rows.push({
    resource: "RTC (CBS/IBS/CRTB)",
    planHint: "enterprise_beta",
    maturity: "development",
    maturityLabel: OBLIGATION_MATURITY_LABELS.development,
    productionClaimAllowed: false,
    bannerNonProduction: true,
  });

  rows.push({
    resource: "Marketplace cenários (tenant)",
    planHint: "enterprise_beta",
    maturity: "official_validator_beta",
    maturityLabel: OBLIGATION_MATURITY_LABELS.official_validator_beta,
    productionClaimAllowed: false,
    bannerNonProduction: true,
  });

  rows.push({
    resource: "Omie live piloto (gated)",
    planHint: "enterprise_beta",
    maturity: "development",
    maturityLabel: OBLIGATION_MATURITY_LABELS.development,
    productionClaimAllowed: false,
    bannerNonProduction: true,
  });

  rows.push({
    resource: "Scale DR / multi-região (draft)",
    planHint: "enterprise_beta",
    maturity: "internal_beta",
    maturityLabel: OBLIGATION_MATURITY_LABELS.internal_beta,
    productionClaimAllowed: false,
    bannerNonProduction: true,
  });

  rows.push({
    resource: "Billing enterprise metering",
    planHint: "enterprise_beta",
    maturity: "internal_beta",
    maturityLabel: OBLIGATION_MATURITY_LABELS.internal_beta,
    productionClaimAllowed: false,
    bannerNonProduction: true,
  });

  rows.push({
    resource: "Campanhas massivas validated_scope",
    planHint: "enterprise_beta",
    maturity: "official_validator_beta",
    maturityLabel: OBLIGATION_MATURITY_LABELS.official_validator_beta,
    productionClaimAllowed: false,
    bannerNonProduction: true,
  });

  rows.push({
    resource: "SLO / observabilidade (staging)",
    planHint: "enterprise_beta",
    maturity: "internal_beta",
    maturityLabel: OBLIGATION_MATURITY_LABELS.internal_beta,
    productionClaimAllowed: false,
    bannerNonProduction: true,
  });

  rows.push({
    resource: "Parceiros contábeis (partner_auditor)",
    planHint: "enterprise_beta",
    maturity: "internal_beta",
    maturityLabel: OBLIGATION_MATURITY_LABELS.internal_beta,
    productionClaimAllowed: false,
    bannerNonProduction: true,
  });

  rows.push({
    resource: "TOTVS live piloto (gated)",
    planHint: "enterprise_beta",
    maturity: "development",
    maturityLabel: OBLIGATION_MATURITY_LABELS.development,
    productionClaimAllowed: false,
    bannerNonProduction: true,
  });

  rows.push({
    resource: "White-label preview (parceiro)",
    planHint: "enterprise_beta",
    maturity: "development",
    maturityLabel: OBLIGATION_MATURITY_LABELS.development,
    productionClaimAllowed: false,
    bannerNonProduction: true,
  });

  rows.push({
    resource: "Compliance pack / LGPD workflow",
    planHint: "enterprise_beta",
    maturity: "official_validator_beta",
    maturityLabel: OBLIGATION_MATURITY_LABELS.official_validator_beta,
    productionClaimAllowed: false,
    bannerNonProduction: true,
  });

  rows.push({
    resource: "i18n scaffold (pt-BR/en)",
    planHint: "starter",
    maturity: "internal_beta",
    maturityLabel: OBLIGATION_MATURITY_LABELS.internal_beta,
    productionClaimAllowed: false,
    bannerNonProduction: true,
  });

  rows.push({
    resource: "Marketplace público (moderado)",
    planHint: "enterprise_beta",
    maturity: "internal_beta",
    maturityLabel: OBLIGATION_MATURITY_LABELS.internal_beta,
    productionClaimAllowed: false,
    bannerNonProduction: true,
  });

  rows.push({
    resource: "Guided assist (flag)",
    planHint: "enterprise_beta",
    maturity: "development",
    maturityLabel: OBLIGATION_MATURITY_LABELS.development,
    productionClaimAllowed: false,
    bannerNonProduction: true,
  });

  rows.push({
    resource: "Mobile read-only",
    planHint: "pro",
    maturity: "internal_beta",
    maturityLabel: OBLIGATION_MATURITY_LABELS.internal_beta,
    productionClaimAllowed: false,
    bannerNonProduction: true,
  });

  rows.push({
    resource: "SOC2 Type I prep (readiness)",
    planHint: "enterprise_beta",
    maturity: "official_validator_beta",
    maturityLabel: OBLIGATION_MATURITY_LABELS.official_validator_beta,
    productionClaimAllowed: false,
    bannerNonProduction: true,
  });

  rows.push({
    resource: "Assist grounded (sourceIds)",
    planHint: "enterprise_beta",
    maturity: "internal_beta",
    maturityLabel: OBLIGATION_MATURITY_LABELS.internal_beta,
    productionClaimAllowed: false,
    bannerNonProduction: true,
  });

  rows.push({
    resource: "SAP live piloto (gated)",
    planHint: "enterprise_beta",
    maturity: "development",
    maturityLabel: OBLIGATION_MATURITY_LABELS.development,
    productionClaimAllowed: false,
    bannerNonProduction: true,
  });

  rows.push({
    resource: "Transmissão / certificado",
    planHint: "future",
    maturity: "validated_scope",
    maturityLabel: OBLIGATION_MATURITY_LABELS.validated_scope,
    productionClaimAllowed: false,
    bannerNonProduction: true,
  });

  // Hard guarantee: no production claim cells
  for (const r of rows) {
    if (r.maturity === "production") {
      // still never allow commercial production claim without explicit matrix gate
      r.productionClaimAllowed = false;
      r.bannerNonProduction = true;
    }
  }
  return rows;
}

export function assertNoFalseProduction(rows: CommercialRow[]): boolean {
  return rows.every((r) => r.productionClaimAllowed === false);
}
