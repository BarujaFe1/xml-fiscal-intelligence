/**
 * Accounting engine domain — never invent balances from fiscal XML.
 */

export type AccountNature = "01" | "02" | "03" | "04" | "05" | "09";

export type ChartAccount = {
  id: string;
  workspaceId: string;
  companyId: string;
  code: string;
  name: string;
  level: number;
  nature: AccountNature;
  kind: "synthetic" | "analytic";
  parentCode?: string;
  referentialCode?: string;
  costCenter?: string;
  effectiveFrom: string; // YYYY-MM-DD
  effectiveTo?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type JournalEntryStatus = "draft" | "posted" | "approved" | "locked";

export type JournalLine = {
  id: string;
  accountCode: string;
  /** D = débito, C = crédito */
  side: "D" | "C";
  /** Decimal string, Brazilian or plain */
  amount: string;
  history?: string;
  documentRef?: string;
  participantDoc?: string;
  costCenter?: string;
};

export type JournalEntry = {
  id: string;
  workspaceId: string;
  companyId: string;
  batchLabel: string;
  entryDate: string; // YYYY-MM-DD
  status: JournalEntryStatus;
  lines: JournalLine[];
  origin: "manual" | "import_csv" | "import_json" | "ecd_prior";
  originRef?: string;
  idempotencyKey?: string;
  approvedBy?: string;
  approvedAt?: string;
  contentHash?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
};

export type LedgerSnapshot = {
  accounts: ChartAccount[];
  entries: JournalEntry[];
};

export const JOURNAL_STATUS_LABELS: Record<JournalEntryStatus, string> = {
  draft: "Rascunho",
  posted: "Lançado",
  approved: "Aprovado",
  locked: "Bloqueado (imutável)",
};
