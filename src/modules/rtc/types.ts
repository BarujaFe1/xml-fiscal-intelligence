/**
 * Domínio RTC (Reforma Tributária do Consumo) — CBS / IBS / CRTB.
 * Nunca inventa alíquotas ou valores ausentes no XML/fonte.
 */

export type RtcTaxKind = "CBS" | "IBS_UF" | "IBS_MUN" | "CRTB" | "IS";

export type RtcPeriodSplit = "pre_reform" | "transition" | "post_reform";

export type RtcFact = {
  id: string;
  workspaceId: string;
  companyId: string;
  periodKey: string; // YYYY-MM
  split: RtcPeriodSplit;
  /** Operação / documento de origem (opcional) */
  documentRef?: string;
  operationLabel?: string;
  /** Base informada — string decimal BR; obrigatória se houver débito */
  baseAmount?: string;
  /** Alíquota só se explícita (XML/fonte) — nunca default inventado */
  rateExplicit?: string;
  taxKind: RtcTaxKind;
  /** Valor do imposto só se explícito */
  taxAmountExplicit?: string;
  uf?: string;
  municipalityCode?: string;
  creditExplicit: boolean;
  creditAmount?: string;
  origin: "manual" | "xml_observed" | "import_csv";
  sourceId: string;
  lineageNote?: string;
  createdAt: string;
  updatedAt: string;
};

export type RtcSnapshot = {
  facts: RtcFact[];
  periodKey: string;
  split: RtcPeriodSplit;
};

export type RtcRuleSetVersion = {
  id: string;
  code: string;
  versionLabel: string;
  sourceId: string;
  effectiveFrom: string;
  effectiveTo?: string;
  impactManifest: string[];
  activated: boolean;
  notes: string[];
};

export type RtcSimScenario = {
  id: "legacy_credit_on" | "legacy_credit_off";
  cbsDebit: string;
  ibsDebit: string;
  crtbDebit: string;
  legacyCreditApplied: string;
  netEstimate: string;
  notes: string[];
};

export type RtcModuleMaturity =
  | "foundation"
  | "development"
  | "internal_beta"
  | "official_validator_beta";
