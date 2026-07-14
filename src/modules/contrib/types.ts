/**
 * Domínio de apuração EFD-Contribuições — não inventa crédito a partir de XML incompleto.
 */

export type ContribMode =
  | "current_fact_generation"
  | "historical_and_credit_management";

export type ContribRegimeCode =
  | "non_cumulative"
  | "cumulative"
  | "cprb"
  | "mixed";

export type ContribEntryKind =
  | "revenue"
  | "acquisition"
  | "credit"
  | "debit"
  | "retention"
  | "adjustment"
  | "cprb";

export type ContribEntry = {
  id: string;
  workspaceId: string;
  companyId: string;
  periodKey: string; // YYYY-MM
  kind: ContribEntryKind;
  /** Decimal BR string */
  amount: string;
  baseAmount?: string;
  cstPis?: string;
  cstCofins?: string;
  cfop?: string;
  history?: string;
  /** Vínculo opcional a documento fiscal — auditado; nunca inventar se ausente */
  documentRef?: string;
  origin: "manual" | "import_csv" | "import_json" | "xml_linked";
  /** Crédito só explícito — nunca derivado silenciosamente do XML */
  creditExplicit: boolean;
  rateioKey?: string;
  mode: ContribMode;
  createdAt: string;
  updatedAt: string;
};

export type ContribRegimeProfile = {
  code: ContribRegimeCode;
  label: string;
  effectiveFrom: string;
  effectiveTo?: string;
  sourceId: string;
  /** Indicadores 0110 (rascunho tipificado) — documentados, não inventados sem fonte */
  indCodIncTrib: string;
  indAproCred: string;
  indTipoContri: string;
  indRegCum: string;
  notes: string[];
};

export type RateioLine = {
  key: string;
  label: string;
  /** Fração 0–1 documentada; soma deve = 1 no grupo */
  weight: number;
  targetCenter?: string;
};

export type ContribSnapshot = {
  entries: ContribEntry[];
  rateio: RateioLine[];
  regimeCode: ContribRegimeCode;
  mode: ContribMode;
  periodKey: string;
};

export type ContribBookLine = {
  kind: ContribEntryKind;
  amount: number;
  count: number;
  creditExplicitOnly: boolean;
};

export type BlocoMRecordDraft = {
  type: string;
  fields: string[];
  lineageNote: string;
};

export type ContribSimScenario = {
  id: "with_credit" | "without_credit";
  basePis: string;
  creditPis: string;
  debitPis: string;
  toPayPis: string;
  baseCofins: string;
  creditCofins: string;
  debitCofins: string;
  toPayCofins: string;
  notes: string[];
};

export type RuleSetVersion = {
  id: string;
  obligationId: "efd-contribuicoes";
  code: string;
  versionLabel: string;
  sourceId: string;
  effectiveFrom: string;
  effectiveTo?: string;
  /** Impacto declarado — sem auto-ativar regras sem fixture */
  impactManifest: string[];
  activated: boolean;
  notes: string[];
};
