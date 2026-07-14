/**
 * Maturidade da plataforma de governança (Fase 11).
 */

import type { GovernanceMaturity } from "@/modules/governance/types";
import { OBLIGATION_SUPPORT_PROFILES } from "@/modules/obligations";
import { envAllowsLiveErp } from "@/modules/governance/secrets-guard";

/** Ops/governança sobe para official_validator_beta — obrigações permanece honestas. */
export const GOVERNANCE_PLATFORM_MATURITY: GovernanceMaturity = "official_validator_beta";

export const GOVERNANCE_CAPABILITIES = [
  "RBAC owner/preparer/approver/auditor",
  "export trilha auditoria sanitizada",
  "retenção versionada + DPA template",
  "SLA draft + métricas síntese",
  "campanhas validated_scope por célula",
  "deny live ERP sem env",
] as const;

export function governanceHealth(): {
  maturity: GovernanceMaturity;
  noProductionClaim: true;
  /** Catálogo live completo: ver enterpriseHealth / assertCatalogSafe */
  liveErpGateDocumented: true;
  liveErpEnvOn: boolean;
  anyObligationProduction: boolean;
} {
  const anyObligationProduction = Object.values(OBLIGATION_SUPPORT_PROFILES).some(
    (p) => p.maturity === "production",
  );
  return {
    maturity: GOVERNANCE_PLATFORM_MATURITY,
    noProductionClaim: true,
    liveErpGateDocumented: true,
    liveErpEnvOn: envAllowsLiveErp(),
    anyObligationProduction,
  };
}

export function section28Phase11Report(): string {
  return [
    "# Relatório §28 — Fase 11 (Governança enterprise)",
    "",
    `Maturidade plataforma: \`${GOVERNANCE_PLATFORM_MATURITY}\``,
    "",
    "## Capacidades",
    ...GOVERNANCE_CAPABILITIES.map((c) => `- ${c}`),
    "",
    "## Não claims",
    "- Sem SOC2/ISO sem auditoria externa",
    "- Sem production global de obrigações",
    "- Células validated_scope só com pacote §28 + revisão",
    "- SLA draft ≠ garantia contractual até legal review",
    "",
  ].join("\n");
}
