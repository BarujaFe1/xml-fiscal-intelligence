// Status honestos de verificação EFD/PVA (prompt §9).
// Não use "oficial", "homologado", "validado" ou "pronto para transmitir"
// antes da evidência correspondente.

export type EfdVerificationStatus =
  | "draft"
  | "internally_invalid"
  | "internally_valid"
  | "txt_generated"
  | "pva_pending"
  | "pva_rejected"
  | "pva_accepted_with_warnings"
  | "pva_accepted"
  | "business_approved"
  | "transmitted_externally"
  | "receipt_registered";

export const EFD_VERIFICATION_LABELS: Record<EfdVerificationStatus, string> = {
  draft: "Rascunho",
  internally_invalid: "Inválido internamente",
  internally_valid: "Válido internamente",
  txt_generated: "TXT gerado",
  pva_pending: "Aguardando PVA",
  pva_rejected: "Rejeitado pelo PVA",
  pva_accepted_with_warnings: "Aceito com advertências",
  pva_accepted: "Aceito pelo PVA",
  business_approved: "Aprovado pelo contabilista",
  transmitted_externally: "Transmitido",
  receipt_registered: "Recibo registrado",
};

// Resultado do PVA (prompt §5).
export type PvaValidationStatus =
  | "pending"
  | "rejected"
  | "accepted_with_warnings"
  | "accepted";

export const PVA_STATUS_LABELS: Record<PvaValidationStatus, string> = {
  pending: "Pendente",
  rejected: "Rejeitado",
  accepted_with_warnings: "Aceito com advertências",
  accepted: "Aceito",
};

export interface PvaValidationRun {
  id: string;
  workspaceId: string;
  companyId: string;
  establishmentId: string;
  period: string; // YYYY-MM
  generationId: string;
  pvaVersion: string;
  executedAt: string; // ISO
  status: PvaValidationStatus;
  errorCount: number;
  warningCount: number;
  originalEvidencePath?: string;
  originalEvidenceHash?: string;
}

export type PvaMessageSeverity = "error" | "warning";
export type PvaResolutionStatus =
  | "open"
  | "mapped"
  | "corrected"
  | "not_applicable"
  | "requires_manual_review";

export interface PvaValidationMessage {
  id: string;
  validationRunId: string;
  severity: PvaMessageSeverity;
  category?: string;
  block?: string;
  recordCode?: string;
  lineNumber?: number;
  fieldNumber?: number;
  fieldName?: string;
  message: string;
  rawMessage?: string;
  mappedLineageId?: string;
  resolutionStatus: PvaResolutionStatus;
}

// Definição versionada de campo EFD para pré-validação (prompt §7).
export interface EfdFieldDefinition {
  layoutVersion: string;
  recordCode: string;
  fieldNumber: number;
  fieldName: string;
  type: string;
  requiredRule: string;
  maxLength?: number;
  decimalScale?: number;
  effectiveFrom: string; // YYYY-MM
  effectiveTo?: string; // YYYY-MM
  officialSourceId: string;
}
