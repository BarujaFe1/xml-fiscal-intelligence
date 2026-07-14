/**
 * Ecosystem Fase 14 — SLO · parceiros · ERP live+.
 */

export type SloId = "api_status_availability" | "generation_success" | "lab_import_ack" | "api_latency_p95";

export type SloDefinition = {
  id: SloId;
  title: string;
  /** Target mensal 0–100 */
  targetPct: number;
  windowDays: number;
  notes: string;
};

export type SloSample = {
  id: string;
  sloId: SloId;
  at: string;
  success: boolean;
  latencyMs?: number;
  detail?: string;
};

export type SloSnapshot = {
  sloId: SloId;
  sampleCount: number;
  successCount: number;
  availabilityPct: number | null;
  latencyP95Ms: number | null;
  meetsTarget: boolean;
  targetPct: number;
};

export type ErrorBudget = {
  sloId: SloId;
  budgetPct: number;
  consumedPct: number;
  remainingPct: number;
  exhausted: boolean;
};

export type OtelSpanHook = {
  name: string;
  kind: "internal" | "server" | "client";
  attributes: Record<string, string | number | boolean>;
  startMs: number;
  endMs?: number;
};

export type PartnerInviteStatus = "pending" | "accepted" | "revoked" | "expired";

export type PartnerInvite = {
  id: string;
  tenantId: string;
  hostWorkspaceId: string;
  partnerEmail: string;
  /** Sempre partner_auditor no accept */
  role: "partner_auditor";
  status: PartnerInviteStatus;
  whiteLabelPreview: boolean;
  createdAt: string;
  updatedAt: string;
  acceptedUserId?: string;
};

export type PartnerWorkspaceLink = {
  id: string;
  tenantId: string;
  hostWorkspaceId: string;
  partnerWorkspaceId: string;
  partnerUserId: string;
  /** read/prepare only — transmit bloqueado via RBAC */
  mode: "read_prepare";
  createdAt: string;
};

export type EcosystemMaturity = "development" | "internal_beta" | "official_validator_beta";
