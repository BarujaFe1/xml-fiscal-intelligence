/**
 * Maturidade growth (Fase 16).
 */

import type { GrowthMaturity } from "@/modules/growth/types";
import { isGuidedAssistEnabled } from "@/modules/growth/guided-assist";
import { OBLIGATION_SUPPORT_PROFILES } from "@/modules/obligations";

export const GROWTH_PLATFORM_MATURITY: GrowthMaturity = "internal_beta";

export const GROWTH_CAPABILITIES = [
  "marketplace público com moderação + rate limits",
  "import público força re-lab",
  "guided assist (flag off default) sem inventar tributos",
  "mobile /app/m read-only",
  "compliance pack hash anexável a listagens públicas",
] as const;

export function growthHealth(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): {
  maturity: GrowthMaturity;
  noProductionClaim: true;
  guidedAssistEnabled: boolean;
  mobileReadOnly: true;
  anyObligationProduction: boolean;
} {
  return {
    maturity: GROWTH_PLATFORM_MATURITY,
    noProductionClaim: true,
    guidedAssistEnabled: isGuidedAssistEnabled(env),
    mobileReadOnly: true,
    anyObligationProduction: Object.values(OBLIGATION_SUPPORT_PROFILES).some(
      (p) => p.maturity === "production",
    ),
  };
}

export function section28Phase16Report(): string {
  const h = growthHealth();
  return [
    "# Relatório §28 — Fase 16 (Marketplace público · assist · mobile)",
    "",
    `Maturidade plataforma: \`${GROWTH_PLATFORM_MATURITY}\``,
    "",
    "## Capacidades",
    ...GROWTH_CAPABILITIES.map((c) => `- ${c}`),
    "",
    "## Flags",
    `- FEATURE_GUIDED_ASSIST: ${h.guidedAssistEnabled}`,
    `- mobile read-only: ${h.mobileReadOnly}`,
    "",
    "## Não claims",
    "- Sem marketplace open irrestrito",
    "- Sem inventar alíquotas/vencimentos",
    "- Sem production global",
    "- Mobile v1 sem geração/transmissão",
    "",
  ].join("\n");
}
