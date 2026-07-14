/**
 * ECF domain — depende de ledger ECD; nunca inventa IRPJ/CSLL a partir de XML fiscal.
 */

import type { LedgerSnapshot } from "@/modules/accounting/types";

export type EcfMode = "demo" | "official" | "auto";

export type AccountReferentialMap = {
  id: string;
  workspaceId: string;
  companyId: string;
  /** Conta do plano da empresa */
  accountCode: string;
  /** Conta do plano referencial (layout 12 / tabela dinâmica) */
  referentialCode: string;
  confirmedBy?: string;
  confirmedAt?: string;
  /** Sugestão automática NÃO aplicada até confirmedAt */
  suggestedReferentialCode?: string;
  suggestionSource?: "history" | "import" | "manual";
  createdAt: string;
  updatedAt: string;
};

export type ReferentialTableVersion = {
  id: string;
  workspaceId: string;
  /** Código do arquivo oficial / versão catalogada — sem hardcode de lista gigante */
  tableCode: string;
  versionLabel: string;
  effectiveFrom: string;
  effectiveTo?: string;
  /** Índice compacto: código → nome (subset carregado) */
  entries: Array<{ code: string; name: string }>;
  sourceFileName?: string;
  contentHash?: string;
  importedAt: string;
};

export type ElalurPartALine = {
  id: string;
  kind: "addition" | "exclusion" | "compensation";
  accountCode: string;
  amount: string;
  legalDevice?: string;
  history?: string;
  origin: "manual" | "import" | "engine_suggestion";
  approvedBy?: string;
  approvedAt?: string;
};

export type ElalurPartBBalance = {
  id: string;
  accountCode: string;
  balanceKind: "prejuizo" | "base_negativa" | "outro";
  openingBalance: string;
  movements: string;
  closingBalance: string;
  legalDevice?: string;
  approvedBy?: string;
  approvedAt?: string;
};

export type ElalurSnapshot = {
  id: string;
  workspaceId: string;
  companyId: string;
  periodKey: string; // YYYY
  version: number;
  partA: ElalurPartALine[];
  partB: ElalurPartBBalance[];
  contentHash?: string;
  locked: boolean;
  createdAt: string;
  updatedAt: string;
};

export type EcfPriorCanonical = {
  layoutHint?: string;
  year?: string;
  cnpj?: string;
  regime?: string;
  accountHints: Array<{ code: string; name?: string; referentialCode?: string; lineageLine: number }>;
  l030Hints: Array<{ year: string; periodCode: string; fields: string[]; lineageLine: number }>;
  warnings: string[];
};

export type EcfWorkspaceSnapshot = {
  ledger: LedgerSnapshot;
  maps: AccountReferentialMap[];
  referentialTables: ReferentialTableVersion[];
  elalur?: ElalurSnapshot;
  priorEcf?: EcfPriorCanonical;
};

export type IrpjCsllMemoryLine = {
  periodKey: string;
  baseIrpj: string;
  irpj: string;
  baseCsll: string;
  csll: string;
  notes?: string;
};

export type IrpjCsllComputation = {
  enabled: boolean;
  gatedReason?: string;
  lines: IrpjCsllMemoryLine[];
  warnings: string[];
};
