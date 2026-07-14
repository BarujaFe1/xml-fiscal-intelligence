/**
 * Server-evaluated feature flags. Never put secrets in public flags.
 * AI flags removed — produto sem assistente de IA nesta versão.
 */
export type FeatureFlag =
  | "cloudProcessing"
  | "localProcessing"
  | "billing"
  | "efdGeneration"
  | "pvaImport"
  | "advancedAudit"
  | "newNavigation"
  | "cnpjAlphanumericStrict"
  | "rtcParsing"
  | "reinfSubmit"
  | "ecfIrpjEngine"
  | "contribSimulator"
  | "rtcSimulator"
  /** Orientação assistida — default off até review (Fase 16) */
  | "guidedAssist";

function envBool(name: string, fallback: boolean): boolean {
  const v = process.env[name];
  if (v === undefined || v === "") return fallback;
  return v === "1" || v.toLowerCase() === "true" || v === "yes";
}

export function getFeatureFlags(): Record<FeatureFlag, boolean> {
  return {
    cloudProcessing: envBool("FEATURE_CLOUD_PROCESSING", false),
    localProcessing: envBool("FEATURE_LOCAL_PROCESSING", true),
    billing: envBool("NEXT_PUBLIC_BILLING_READY", false) && process.env.BILLING_PROVIDER === "stripe",
    efdGeneration: envBool("FEATURE_EFD_GENERATION", true),
    pvaImport: envBool("FEATURE_PVA_IMPORT", false),
    advancedAudit: envBool("FEATURE_ADVANCED_AUDIT", true),
    newNavigation: envBool("FEATURE_NEW_NAVIGATION", true),
    cnpjAlphanumericStrict: envBool("FEATURE_CNPJ_ALPHANUMERIC_STRICT", true),
    rtcParsing: envBool("FEATURE_RTC_PARSING", true),
    reinfSubmit: envBool("FEATURE_REINF_SUBMIT", false),
    /** IRPJ/CSLL ECF — default off até evidência Programa ECF + revisor */
    ecfIrpjEngine: envBool("FEATURE_ECF_IRPJ_ENGINE", false),
    /** Simulador PIS/COFINS com/sem crédito — default off para claims comerciais */
    contribSimulator: envBool("FEATURE_CONTRIB_SIMULATOR", false),
    /** Simulador RTC CBS/IBS — default off até evidência oficial */
    rtcSimulator: envBool("FEATURE_RTC_SIMULATOR", false),
    /** Guided assist / playbooks — default off; sem motor tributário */
    guidedAssist: envBool("FEATURE_GUIDED_ASSIST", false),
  };
}

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return getFeatureFlags()[flag];
}
