/**
 * Governança enterprise — Fase 11.
 * Sem claim SOC2/ISO. Sem production global.
 */

import type { ObligationId } from "@/modules/obligations/core/registry/ids";

export type GovernanceRole =
  | "owner"
  | "preparer"
  | "approver"
  | "auditor"
  /** Fase 14 — contador parceiro: lê/prepara, sem transmit */
  | "partner_auditor";

export type GovernanceAction =
  | "transmit"
  | "nt_activate"
  | "export_section28"
  | "approve_closing"
  | "manage_retention"
  | "export_audit"
  | "manage_campaigns"
  | "view_sla"
  | "partner_prepare"
  | "invite_partner";

export type WorkspaceRoleBinding = {
  workspaceId: string;
  userId: string;
  role: GovernanceRole;
  updatedAt: string;
};

/** Capacidade por papel — SoD continua em ops/sod. */
export const ROLE_PERMISSIONS: Record<GovernanceRole, readonly GovernanceAction[]> = {
  owner: [
    "transmit",
    "nt_activate",
    "export_section28",
    "approve_closing",
    "manage_retention",
    "export_audit",
    "manage_campaigns",
    "view_sla",
    "partner_prepare",
    "invite_partner",
  ],
  preparer: ["export_section28", "view_sla", "partner_prepare"],
  approver: ["transmit", "approve_closing", "export_section28", "view_sla"],
  auditor: ["export_audit", "export_section28", "view_sla", "manage_campaigns"],
  partner_auditor: ["export_section28", "view_sla", "export_audit", "partner_prepare"],
};

export type RetentionClass = "evidence" | "xml_batch" | "generation_meta" | "audit_trail" | "api_keys";

export type RetentionPolicy = {
  id: string;
  workspaceId: string;
  version: number;
  class: RetentionClass;
  /** Dias de retenção; 0 = indefinido (doc only) */
  retainDays: number;
  notes?: string;
  updatedAt: string;
  updatedBy?: string;
};

export type AuditExportSource =
  | "closing_task"
  | "generation"
  | "lab_evidence"
  | "api_key"
  | "nt_inbox"
  | "telemetry";

export type AuditExportRow = {
  source: AuditExportSource;
  at: string;
  actorId?: string;
  action: string;
  /** Já sanitizado — sem CNPJ completo / XML */
  detail: string;
  refId?: string;
};

export type SlaTarget = {
  id: string;
  metric: "generation_success_rate" | "api_availability_synth" | "lab_import_ack" | "quota_429_rate";
  /** Meta percentual 0–100 ou taxa max */
  targetPct: number;
  windowHours: number;
  notes?: string;
};

export type SlaSnapshot = {
  at: string;
  generationErrors: number;
  labImports: number;
  apiDenied: number;
  notifications: number;
  generationSuccessEstimatePct: number | null;
  withinQuotaDeniedRatePct: number | null;
  meetsDraftTargets: boolean;
  gaps: string[];
};

export type ValidatedScopeCampaign = {
  id: string;
  workspaceId: string;
  title: string;
  obligationId: ObligationId;
  targetUf?: string;
  targetRegime?: string;
  status: "planned" | "in_progress" | "blocked" | "completed" | "cancelled";
  scenarioIds: string[];
  revalidationDueAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type GovernanceMaturity = "development" | "internal_beta" | "official_validator_beta";

export type CellDashboardRow = {
  obligationId: string;
  uf: string;
  regime: string;
  scenarioId: string;
  cellMaturity: string;
  status: string;
  reviewedAt?: string;
  rehomologationDue: boolean;
};
