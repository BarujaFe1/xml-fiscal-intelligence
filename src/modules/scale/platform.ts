/**
 * Maturidade plataforma scale (Fase 13).
 */

import type { ScaleMaturity } from "@/modules/scale/types";
import { defaultDrTargets } from "@/modules/scale/dr";
import { regionalHealthReport } from "@/modules/scale/regions";
import { billingEnterpriseEnabled, listPlanCatalog } from "@/modules/scale/billing-plans";
import { resolveSecretsManagerMode } from "@/modules/scale/hardening";
import { PERSISTENCE_INVENTORY } from "@/modules/scale/persistence";
import { OBLIGATION_SUPPORT_PROFILES } from "@/modules/obligations";

/** Comercial/metering em internal_beta; DR docs em official_validator_beta continuity. */
export const SCALE_PLATFORM_MATURITY: ScaleMaturity = "internal_beta";

export const SCALE_CAPABILITIES = [
  "inventário persistência + RPO/RTO draft",
  "DR drill staging + procedure",
  "health checks regionais (síntese) em /api/v1/status",
  "billing enterprise planos + metering + quotas",
  "campanhas massivas validated_scope multi-UF",
  "secrets manager mode + pen-test triage",
] as const;

export function scaleHealth(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): {
  maturity: ScaleMaturity;
  noProductionClaim: true;
  persistenceItems: number;
  regionsReachable: number;
  billingLiveFlag: boolean;
  plans: number;
  secretsMode: ReturnType<typeof resolveSecretsManagerMode>;
  dr: ReturnType<typeof defaultDrTargets>;
  anyObligationProduction: boolean;
} {
  const regions = regionalHealthReport(env);
  return {
    maturity: SCALE_PLATFORM_MATURITY,
    noProductionClaim: true,
    persistenceItems: PERSISTENCE_INVENTORY.length,
    regionsReachable: regions.filter((r) => r.reachable).length,
    billingLiveFlag: billingEnterpriseEnabled(),
    plans: listPlanCatalog().length,
    secretsMode: resolveSecretsManagerMode(env),
    dr: defaultDrTargets(),
    anyObligationProduction: Object.values(OBLIGATION_SUPPORT_PROFILES).some(
      (p) => p.maturity === "production",
    ),
  };
}

export function section28Phase13Report(): string {
  const h = scaleHealth();
  return [
    "# Relatório §28 — Fase 13 (Multi-região · DR · billing · campanhas)",
    "",
    `Maturidade plataforma: \`${SCALE_PLATFORM_MATURITY}\``,
    "",
    "## Capacidades",
    ...SCALE_CAPABILITIES.map((c) => `- ${c}`),
    "",
    "## DR draft",
    `- RPO ${h.dr.rpoHours}h / RTO ${h.dr.rtoHours}h`,
    `- persistência inventariada: ${h.persistenceItems}`,
    `- regiões reachable (synth): ${h.regionsReachable}`,
    "",
    "## Billing",
    `- FEATURE billing live: ${h.billingLiveFlag}`,
    `- planos catalogados: ${h.plans}`,
    `- secrets mode: ${h.secretsMode}`,
    "",
    "## Não claims",
    "- Sem SOC2/ISO emitido",
    "- Sem cobertura PVA/RFB no DR",
    "- Sem production global automático",
    "- Metering local ≠ cobrança Stripe sem webhook",
    "",
  ].join("\n");
}
