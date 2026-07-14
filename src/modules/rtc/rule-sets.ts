/**
 * rule_set_versions RTC — catalogadas; activated=false até fixture + revisão.
 */

import type { RtcRuleSetVersion } from "@/modules/rtc/types";

export const RTC_RULE_SET_VERSIONS: RtcRuleSetVersion[] = [
  {
    id: "rs_rtc_reforma_consumo_2026",
    code: "REFORMA_CONSUMO_2026",
    versionLabel: "orientacoes-portal",
    sourceId: "official:reforma:consumo-2026",
    effectiveFrom: "2026-01-01",
    impactManifest: [
      "Introdução gradual CBS/IBS — não substituir EFD-Contribuições automaticamente",
      "Preservar modo historical_and_credit_management nas Contribuições",
      "Não misturar valores RTC em Bloco M PIS/COFINS sem NT específica",
    ],
    activated: false,
    notes: ["Ativar só com fixture + evidência + revisor"],
  },
  {
    id: "rs_rtc_nfe_schema_observed",
    code: "NFE_RTC_TAGS_OBSERVED",
    versionLabel: "observation-only",
    sourceId: "official:reforma:consumo-2026",
    effectiveFrom: "2026-01-01",
    impactManifest: [
      "Tags CBS/IBS/IS no XML são observadas (FEATURE_RTC_PARSING)",
      "Ausência de alíquota/valor ⇒ fato sem rateExplicit/taxAmountExplicit",
    ],
    activated: false,
    notes: ["Parsing honesto — zero invenção"],
  },
];

export function listRtcRuleSets(asOf?: string): RtcRuleSetVersion[] {
  if (!asOf) return RTC_RULE_SET_VERSIONS;
  const day = asOf.slice(0, 10);
  return RTC_RULE_SET_VERSIONS.filter(
    (r) => r.effectiveFrom <= day && (!r.effectiveTo || r.effectiveTo >= day),
  );
}

export function cataloguedRtcImpacts(asOf: string): string[] {
  return listRtcRuleSets(asOf).flatMap((r) =>
    r.impactManifest.map((m) => `[${r.code}${r.activated ? "" : " catalog"}] ${m}`),
  );
}
