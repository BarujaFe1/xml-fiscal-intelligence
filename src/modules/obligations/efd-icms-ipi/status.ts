/**
 * Estados de geração EFD ICMS/IPI — nunca confundir TXT gerado com transmissão oficial.
 * Ver docs/EFD_ICMS_IPI_GENERATION.md e docs/PVA_VALIDATION_PROTOCOL.md.
 */
export type EfdGenerationStatus =
  | "draft"
  | "readiness_blocked"
  | "internally_validated"
  | "txt_generated"
  | "pva_validation_pending"
  | "pva_rejected"
  | "pva_validated"
  | "signed_externally"
  | "transmitted_externally"
  | "receipt_registered";

export const EFD_GENERATION_STATUS_LABELS: Record<EfdGenerationStatus, string> = {
  draft: "Rascunho",
  readiness_blocked: "Prontidão bloqueada",
  internally_validated: "Validado internamente",
  txt_generated: "TXT gerado",
  pva_validation_pending: "Aguardando PVA",
  pva_rejected: "Rejeitado pelo PVA",
  pva_validated: "Aceito pelo PVA",
  signed_externally: "Assinado externamente",
  transmitted_externally: "Transmitido externamente",
  receipt_registered: "Recibo registrado",
};

/** Status that must never be marketed as “arquivo oficial da Receita”. */
export function isOfficialTransmissionClaim(status: EfdGenerationStatus): boolean {
  return status === "transmitted_externally" || status === "receipt_registered";
}

export type ReadinessStatus =
  | "complete"
  | "derived"
  | "manually_provided"
  | "not_applicable"
  | "pending"
  | "blocking"
  | "requires_review"
  | "unsupported";

export type CloudMigrationStatus =
  | "discovered"
  | "prepared"
  | "uploading"
  | "importing"
  | "verifying"
  | "synchronized"
  | "conflict"
  | "failed"
  | "rolled_back";
