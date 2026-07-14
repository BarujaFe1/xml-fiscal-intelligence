/**
 * Honest product maturity — never use active/stub alone.
 * A cell may only reach validated_scope|production with fixture + tests + official validator evidence.
 */

export type ObligationMaturity =
  | "planned"
  | "foundation"
  | "development"
  | "internal_beta"
  | "official_validator_beta"
  | "validated_scope"
  | "production";

export const OBLIGATION_MATURITY_LABELS: Record<ObligationMaturity, string> = {
  planned: "Planejado",
  foundation: "Fundação",
  development: "Em desenvolvimento",
  internal_beta: "Beta interno",
  official_validator_beta: "Beta no programa oficial",
  validated_scope: "Escopo validado",
  production: "Produção (escopo documentado)",
};

/** Workflow status for closing cockpit cells (per obligation × period). */
export type ClosingCellStatus =
  | "not_started"
  | "data_pending"
  | "import_in_progress"
  | "reconciliation_pending"
  | "review_pending"
  | "blocked"
  | "internally_validated"
  | "official_rejected"
  | "official_validated"
  | "signed"
  | "transmitted"
  | "receipt_registered"
  | "rectification_needed";

export const CLOSING_CELL_STATUS_LABELS: Record<ClosingCellStatus, string> = {
  not_started: "Não iniciada",
  data_pending: "Dados pendentes",
  import_in_progress: "Importação em andamento",
  reconciliation_pending: "Conciliação pendente",
  review_pending: "Revisão pendente",
  blocked: "Bloqueada",
  internally_validated: "Validada internamente",
  official_rejected: "Rejeitada no programa oficial",
  official_validated: "Validada no programa oficial",
  signed: "Assinada",
  transmitted: "Transmitida",
  receipt_registered: "Recibo registrado",
  rectification_needed: "Retificação necessária",
};

export type OfficialProgramId =
  | "pva_efd_icms_ipi"
  | "pge_efd_contribuicoes"
  | "programa_ecd"
  | "programa_ecf"
  | "efd_reinf_ambiente"
  | "dctfweb"
  | "other";

export interface ObligationSupportProfile {
  id: string;
  maturity: ObligationMaturity;
  supportedCompetencies: string[];
  supportedRegimes: string[];
  supportedEstablishments: string[];
  supportedBlocksOrEvents: string[];
  officialProgram?: OfficialProgramId;
  officialProgramVersion?: string;
  lastHomologationDate?: string; // YYYY-MM-DD — only when real evidence exists
  limitations: string[];
  unsupported: string[];
  sourceIds: string[];
}
