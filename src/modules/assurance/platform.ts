/**
 * Maturidade assurance (Fase 17).
 */

import type { AssuranceMaturity } from "@/modules/assurance/types";
import {
  readinessSummary,
  soc2ReadinessChecklist,
} from "@/modules/assurance/soc2-readiness";
import { runSapLivePilotGolden } from "@/modules/assurance/sap-live-pilot";
import { listApprovedOfficialSnippets } from "@/modules/assurance/official-snippets";
import { OBLIGATION_SUPPORT_PROFILES } from "@/modules/obligations";
import { assertCatalogSafe } from "@/modules/continuous-ops/erp/registry";
import { defaultLegalStatus } from "@/modules/enterprise/legal-status";

/** Prep official_validator_beta — readiness + grounding; sem relatório SOC2. */
export const ASSURANCE_PLATFORM_MATURITY: AssuranceMaturity = "official_validator_beta";

export const ASSURANCE_CAPABILITIES = [
  "SOC2 Type I readiness checklist + waivers documentados",
  "Statement of Applicability draft (não é relatório)",
  "Evidence binder export CI",
  "Assist grounded com sourceIds do OFFICIAL_SOURCE_CATALOG",
  "SAP live piloto gated (3º vendor)",
] as const;

export function assuranceHealth(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
  opts?: { hasStagingDrDrillEvidence?: boolean },
): {
  maturity: AssuranceMaturity;
  noProductionClaim: true;
  soc2Certified: false;
  readinessCompleteOrWaived: boolean;
  readinessOpen: number;
  officialSnippetCount: number;
  sapGoldenOk: boolean;
  catalogSafe: boolean;
  anyObligationProduction: boolean;
} {
  const items = soc2ReadinessChecklist({
    hasStagingDrDrillEvidence: opts?.hasStagingDrDrillEvidence,
  });
  const summary = readinessSummary(items);
  const sap = runSapLivePilotGolden(env);
  const legal = defaultLegalStatus();
  return {
    maturity: ASSURANCE_PLATFORM_MATURITY,
    noProductionClaim: true,
    soc2Certified: legal.soc2Certified,
    readinessCompleteOrWaived: summary.completeOrWaived,
    readinessOpen: summary.open,
    officialSnippetCount: listApprovedOfficialSnippets().length,
    sapGoldenOk: sap.ok,
    catalogSafe: assertCatalogSafe(env),
    anyObligationProduction: Object.values(OBLIGATION_SUPPORT_PROFILES).some(
      (p) => p.maturity === "production",
    ),
  };
}

export async function section28Phase17Report(
  opts?: { hasStagingDrDrillEvidence?: boolean },
): Promise<string> {
  const h = assuranceHealth(process.env, opts);
  return [
    "# Relatório §28 — Fase 17 (SOC2 prep · grounding · ERP #3)",
    "",
    `Maturidade plataforma: \`${ASSURANCE_PLATFORM_MATURITY}\``,
    "",
    "## Capacidades",
    ...ASSURANCE_CAPABILITIES.map((c) => `- ${c}`),
    "",
    "## Checks",
    `- readiness completeOrWaived: ${h.readinessCompleteOrWaived} (open=${h.readinessOpen})`,
    `- snippets oficiais: ${h.officialSnippetCount}`,
    `- SAP golden: ${h.sapGoldenOk}`,
    `- catalogSafe: ${h.catalogSafe}`,
    `- soc2Certified: ${h.soc2Certified}`,
    "",
    "## Não claims",
    "- Produto **não** emite relatório SOC2 Type I",
    "- Sem inventar alíquotas/vencimentos",
    "- Sem production global",
    "- SAP HTTP synth mesmo com flag — sem protocolo proprietário no repo",
    "- FEATURE_GUIDED_ASSIST permanece default-off até review",
    "",
  ].join("\n");
}
