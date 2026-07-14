/**
 * EFD-Reinf event engine — types and lifecycle (no transmission by default).
 */

export type ReinfEventStatus =
  | "draft"
  | "ready"
  | "signed"
  | "queued"
  | "submitted"
  | "accepted"
  | "rejected"
  | "processing"
  | "deleted"
  | "replaced";

export type ReinfEnvironment = "restricted" | "production";

export type ReinfEventCode = string;

export type ReinfCanonicalEvent = {
  id: string;
  workspaceId: string;
  companyId: string;
  establishmentId?: string;
  eventCode: ReinfEventCode;
  catalogVersion: string;
  periodKey: string; // YYYY-MM
  status: ReinfEventStatus;
  /** Canonical unsigned XML (or XML-like draft). */
  xmlUnsigned: string;
  xmlSigned?: string;
  contentHash: string;
  signedHash?: string;
  batchId?: string;
  protocolo?: string;
  recibo?: string;
  mensagem?: string;
  environment: ReinfEnvironment;
  idempotencyKey: string;
  sourceRefs?: string[];
  createdAt: string;
  updatedAt: string;
  responsible?: string;
};

export type ReinfBatch = {
  id: string;
  workspaceId: string;
  periodKey: string;
  environment: ReinfEnvironment;
  eventIds: string[];
  status: ReinfEventStatus;
  createdAt: string;
  updatedAt: string;
};

/** Allowed transitions — invalid ones throw. */
const TRANSITIONS: Record<ReinfEventStatus, ReinfEventStatus[]> = {
  draft: ["ready", "deleted"],
  ready: ["signed", "draft", "deleted"],
  signed: ["queued", "ready", "deleted"],
  queued: ["submitted", "ready"],
  submitted: ["processing", "accepted", "rejected"],
  processing: ["accepted", "rejected"],
  accepted: ["replaced", "deleted"],
  rejected: ["draft", "deleted"],
  deleted: [],
  replaced: [],
};

export function canTransition(from: ReinfEventStatus, to: ReinfEventStatus): boolean {
  return (TRANSITIONS[from] || []).includes(to);
}

export function assertTransition(from: ReinfEventStatus, to: ReinfEventStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Reinf transition inválida: ${from} → ${to}`);
  }
}

export const REINF_EVENT_STATUS_LABELS: Record<ReinfEventStatus, string> = {
  draft: "Rascunho",
  ready: "Pronto",
  signed: "Assinado (agente local)",
  queued: "Na fila",
  submitted: "Enviado",
  accepted: "Aceito",
  rejected: "Rejeitado",
  processing: "Processando",
  deleted: "Excluído",
  replaced: "Substituído",
};
