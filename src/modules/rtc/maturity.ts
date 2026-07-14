/**
 * Maturidade do módulo RTC (não é ObligationId ainda — trilha reforma).
 */

import type { RtcModuleMaturity } from "@/modules/rtc/types";

export const RTC_MODULE_MATURITY: RtcModuleMaturity = "development";

export const RTC_SUPPORT_PROFILE = {
  id: "rtc",
  maturity: RTC_MODULE_MATURITY,
  label: "RTC (CBS / IBS / CRTB)",
  officialProgram: "other" as const,
  supportedBlocksOrEvents: [
    "Domínio de fatos CBS/IBS/CRTB/IS",
    "Split pré/transição/pós com sourceId",
    "Dualidade com EFD-Contribuições (módulo preservado)",
    "Extração XML honesta (FEATURE_RTC_PARSING)",
    "Simulador gated (FEATURE_RTC_SIMULATOR)",
  ],
  limitations: [
    "Sem transmissão oficial",
    "rule_set activated=false",
    "Sem alíquotas default",
  ],
  unsupported: [
    "Substituir PIS/COFINS automaticamente",
    "Inventar vCBS/vIBS/pCBS ausentes",
    "validated_scope / production",
  ],
  sourceIds: ["official:reforma:consumo-2026"],
};
