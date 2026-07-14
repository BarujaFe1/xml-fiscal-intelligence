/**
 * Maturidade plataforma enterprise (Fase 12).
 */

import type { EnterpriseMaturity } from "@/modules/enterprise/types";
import { controlMatrixSummary } from "@/modules/enterprise/controls";
import { runOmieLivePilotGolden, liveErpEnvAllowed } from "@/modules/enterprise/erp-live-pilot";
import { defaultLegalStatus, assertNoFakeCertification } from "@/modules/enterprise/legal-status";
import { OBLIGATION_SUPPORT_PROFILES } from "@/modules/obligations";
import { assertNoLiveErpWithoutEnv } from "@/modules/governance/secrets-guard";
import { listRegisteredAdapters } from "@/modules/continuous-ops/erp/registry";

export const ENTERPRISE_PLATFORM_MATURITY: EnterpriseMaturity = "official_validator_beta";

export const ENTERPRISE_CAPABILITIES = [
  "control matrix SOC2-hint + evidence binder",
  "marketplace cenários tenant + re-lab",
  "golden packs versionados por obrigação/UF",
  "Omie live piloto gated por env",
  "legal status honesto (DPA template / SLA draft)",
] as const;

export function enterpriseHealth(env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env): {
  maturity: EnterpriseMaturity;
  noProductionClaim: true;
  controls: ReturnType<typeof controlMatrixSummary>;
  omieGoldenOk: boolean;
  liveErpAllowed: boolean;
  liveErpSafe: boolean;
  anyObligationProduction: boolean;
  legal: ReturnType<typeof defaultLegalStatus>;
} {
  const legal = defaultLegalStatus();
  assertNoFakeCertification(legal);
  const omie = runOmieLivePilotGolden(env);
  const liveSafe = assertNoLiveErpWithoutEnv(env, listRegisteredAdapters(env));
  return {
    maturity: ENTERPRISE_PLATFORM_MATURITY,
    noProductionClaim: true,
    controls: controlMatrixSummary(),
    omieGoldenOk: omie.ok,
    liveErpAllowed: liveErpEnvAllowed(env),
    liveErpSafe: liveSafe.ok,
    anyObligationProduction: Object.values(OBLIGATION_SUPPORT_PROFILES).some(
      (p) => p.maturity === "production",
    ),
    legal,
  };
}

export function section28Phase12Report(): string {
  const h = enterpriseHealth();
  return [
    "# Relatório §28 — Fase 12 (Certificação · marketplace · ERP live)",
    "",
    `Maturidade plataforma: \`${ENTERPRISE_PLATFORM_MATURITY}\``,
    "",
    "## Capacidades",
    ...ENTERPRISE_CAPABILITIES.map((c) => `- ${c}`),
    "",
    "## Controles",
    `- implemented: ${h.controls.implemented}`,
    `- partial: ${h.controls.partial}`,
    `- planned: ${h.controls.planned}`,
    `- out_of_scope: ${h.controls.outOfScope}`,
    "",
    "## Não claims",
    "- Sem SOC2/ISO emitido",
    "- Sem marketplace público multi-tenant open",
    "- Sem production global automático",
    "- Omie live HTTP ainda não ligado — flag só libera caminho + golden",
    "",
  ].join("\n");
}
