/**
 * Fiscal obligation plugin contract — deterministic builders only.
 * AI must never implement this interface for record creation.
 */

export type ObligationJurisdiction = "federal" | "state" | "municipal";

export interface ObligationContext {
  workspaceId: string;
  companyId: string;
  establishmentId: string;
  periodStart: string; // YYYY-MM-DD
  periodEnd: string;
  layoutVersion: string;
  uf: string;
  profile?: "A" | "B" | "C";
  activityCode?: string; // IND_ATIV — must be provided, never presumed
  /** CNAE principal — 7 dígitos IBGE (usado antes do leiaute 020). */
  cnae?: string;
  /** Descrição da atividade — livre (usado antes do leiaute 020). */
  cnaeDescription?: string;
  /**
   * Classificação do estabelecimento (0002 CLAS_ESTAB_IND, Tabela 4.5.5) —
   * 2 dígitos. Obrigatório no leiaute 020 (NT 2025.001) em vez de CNAE/DESC_ATIV.
   */
  industrialClass?: string;
  purpose?: "0" | "1"; // 0=original 1=substitute — must be provided
  cnpj: string;
  ie?: string;
  companyName: string;
  /** Código IBGE do município (COD_MUN 0000) — 7 dígitos. */
  codMun?: string;
  tradeName?: string;
  cep?: string;
  address?: string;
  addressNumber?: string;
  addressCompl?: string;
  neighborhood?: string;
  phone?: string;
  email?: string;
  accountantName?: string;
  accountantCpf?: string;
  accountantCrc?: string;
  accountantEmail?: string;
  /** Código de receita ICMS (E116 COD_REC) — específico da UF; não inventar. */
  icmsCodRec?: string;
  documents: ObligationDocumentInput[];
  priorCreditBalance?: string; // decimal string; required for E110 when applicable
  extras?: Record<string, unknown>;
  /** NF-e excluídas da geração por status (cancelada/denegada/inutilizada/rejeitada). */
  excludedDocumentCount?: number;
  /** NF-e sem status conhecido (XML sem protocolo de autorização). */
  unknownStatusCount?: number;
}

export interface ObligationDocumentInput {
  id: string;
  documentType: string;
  model?: string;
  series?: string;
  number?: string;
  accessKey?: string;
  issueDate?: string;
  emitterDoc?: string;
  emitterName?: string;
  emitterIe?: string;
  emitterUf?: string;
  emitterCityCode?: string;
  emitterAddress?: string;
  emitterAddressNumber?: string;
  emitterAddressCompl?: string;
  emitterNeighborhood?: string;
  emitterCep?: string;
  receiverDoc?: string;
  receiverName?: string;
  receiverIe?: string;
  receiverUf?: string;
  receiverCityCode?: string;
  receiverAddress?: string;
  receiverAddressNumber?: string;
  receiverAddressCompl?: string;
  receiverNeighborhood?: string;
  receiverCep?: string;
  natureOperation?: string;
  cfopMain?: string;
  totalValue?: string;
  productsValue?: string;
  freightValue?: string;
  discountValue?: string;
  status?: string;
  protocol?: string;
  indOper?: "0" | "1";
  indEmit?: "0" | "1";
  codSit?: string;
  icmsTot?: Record<string, string>;
  items: ObligationItemInput[];
  xmlPathHints?: Record<string, string>;
}

export interface ObligationItemInput {
  itemNumber: number;
  code?: string;
  description?: string;
  ncm?: string;
  cfop?: string;
  unit?: string;
  quantity?: string;
  unitValue?: string;
  totalValue?: string;
  discountValue?: string;
  tax: {
    icms: {
      cst?: string;
      csosn?: string;
      orig?: string;
      vBc: string;
      pIcms: string;
      vIcms: string;
      vBcSt: string;
      vIcmsSt: string;
    };
    ipi: { cst?: string; vBc: string; pIpi: string; vIpi: string };
    pis: { cst?: string; vBc: string; pAliq: string; vValor: string };
    cofins: { cst?: string; vBc: string; pAliq: string; vValor: string };
  };
}

export type ReadinessStatus =
  | "complete"
  | "derived"
  | "manual"
  | "na"
  | "pending"
  | "blocking"
  | "review"
  | "unsupported";

export interface ReadinessItem {
  id: string;
  label: string;
  status: ReadinessStatus;
  message?: string;
  remediation?: string;
  /** Explicação humana: o que é e por que importa (em PT-BR). */
  explanation?: string;
  /** Como resolver, em linguagem clara (em PT-BR). */
  fix?: string;
}

export interface RequiredDataResult {
  items: ReadinessItem[];
  canGenerate: boolean;
  blockingCount: number;
}

export interface LineageEntry {
  record: string;
  field: string;
  value: string;
  sourceType: "xml" | "cadastro" | "derived" | "manual" | "prior_period" | "rule";
  sourceRef?: string;
  xmlPath?: string;
  ruleId?: string;
  transformation?: string;
}

export interface ObligationRecord {
  type: string;
  fields: string[];
  lineage?: LineageEntry[];
  children?: ObligationRecord[];
}

export interface ObligationBuildResult {
  obligationId: string;
  layoutVersion: string;
  records: ObligationRecord[];
  lineage: LineageEntry[];
  warnings: string[];
}

export interface ValidationIssue {
  code: string;
  severity: "error" | "warning" | "info";
  record?: string;
  field?: string;
  message: string;
  remediation?: string;
  officialSourceId?: string;
}

export interface ValidationResult {
  level: 1 | 2;
  ok: boolean;
  issues: ValidationIssue[];
}

export interface SerializedObligation {
  encoding: "utf-8";
  lineEnding: "\r\n";
  content: string;
  contentHash: string;
  recordCount: number;
}

export interface GenerationManifest {
  obligationId: string;
  layoutVersion: string;
  periodStart: string;
  periodEnd: string;
  establishmentId: string;
  contentHash: string;
  generatedAt: string;
  warnings: string[];
  validationLevel: 1 | 2;
  disclaimer: string;
}

export interface FiscalObligationPlugin {
  id: string;
  name: string;
  jurisdiction: ObligationJurisdiction;
  supportedVersions: string[];
  resolveVersion(context: ObligationContext): Promise<{ layoutVersion: string; sourceId: string }>;
  detectRequiredData(context: ObligationContext): Promise<RequiredDataResult>;
  /** Alias preferido (SUPERMEGAPROMPT) — default via detectRequiredData. */
  evaluateReadiness?(context: ObligationContext): Promise<RequiredDataResult>;
  build(context: ObligationContext): Promise<ObligationBuildResult>;
  validate(build: ObligationBuildResult, context: ObligationContext): Promise<ValidationResult>;
  validateInternally?(build: ObligationBuildResult, context: ObligationContext): Promise<ValidationResult>;
  serialize(build: ObligationBuildResult, context: ObligationContext): Promise<SerializedObligation>;
  createManifest(
    build: ObligationBuildResult,
    serialized: SerializedObligation,
    context: ObligationContext,
    validation: ValidationResult,
  ): Promise<GenerationManifest>;
}
