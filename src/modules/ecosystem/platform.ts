/**
 * Maturidade ecosystem (Fase 14).
 */

import type { EcosystemMaturity } from "@/modules/ecosystem/types";
import {
  SLO_DEFINITIONS,
  computeSloSnapshot,
  seedStagingApiStatusSamples,
} from "@/modules/ecosystem/slo";
import { runTotvsLivePilotGolden } from "@/modules/ecosystem/totvs-live-pilot";
import { OBLIGATION_SUPPORT_PROFILES } from "@/modules/obligations";
import { assertCatalogSafe } from "@/modules/continuous-ops/erp/registry";

export const ECOSYSTEM_PLATFORM_MATURITY: EcosystemMaturity = "internal_beta";

export const ECOSYSTEM_CAPABILITIES = [
  "SLOs mensuráveis + error budget (liga SLA F11)",
  "hooks OTel + export Prometheus text",
  "alertas SLO sanitizados",
  "parceiros contábeis partner_auditor + convites",
  "white-label preview sem claims falsos",
  "TOTVS live piloto gated + HTTP mínimo flag",
] as const;

export function ecosystemHealth(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): {
  maturity: EcosystemMaturity;
  noProductionClaim: true;
  sloDefinitions: number;
  stagingApiSloMeets: boolean;
  totvsGoldenOk: boolean;
  catalogSafe: boolean;
  anyObligationProduction: boolean;
} {
  const staging = seedStagingApiStatusSamples(100);
  const apiSnap = computeSloSnapshot("api_status_availability", staging);
  const totvs = runTotvsLivePilotGolden(env);
  return {
    maturity: ECOSYSTEM_PLATFORM_MATURITY,
    noProductionClaim: true,
    sloDefinitions: SLO_DEFINITIONS.length,
    stagingApiSloMeets: apiSnap.meetsTarget,
    totvsGoldenOk: totvs.ok,
    catalogSafe: assertCatalogSafe(env),
    anyObligationProduction: Object.values(OBLIGATION_SUPPORT_PROFILES).some(
      (p) => p.maturity === "production",
    ),
  };
}

export function section28Phase14Report(): string {
  const h = ecosystemHealth();
  return [
    "# Relatório §28 — Fase 14 (SLO · parceiros · ERP live+)",
    "",
    `Maturidade plataforma: \`${ECOSYSTEM_PLATFORM_MATURITY}\``,
    "",
    "## Capacidades",
    ...ECOSYSTEM_CAPABILITIES.map((c) => `- ${c}`),
    "",
    "## Checks",
    `- SLO api_status staging meets: ${h.stagingApiSloMeets}`,
    `- TOTVS golden: ${h.totvsGoldenOk}`,
    `- catalogSafe: ${h.catalogSafe}`,
    "",
    "## Não claims",
    "- Sem SOC2/ISO emitido",
    "- Sem marketplace público open",
    "- Sem production global",
    "- SLOs staging ≠ uptime RFB/PVA",
    "- HTTP TOTVS synth mesmo com flag — sem protocolo proprietário no repo",
    "",
  ].join("\n");
}
