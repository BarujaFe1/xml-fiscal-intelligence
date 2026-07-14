/**
 * Scale platform — Fase 13.
 * Multi-região/DR · billing enterprise · campanhas massivas.
 * Sem selo SOC2 inventado · sem production global.
 */

import type { ObligationId } from "@/modules/obligations/core/registry/ids";
import type { CommercialPlanHint } from "@/modules/ops/commercial-matrix";

export type PersistenceLayer =
  | "indexeddb_browser"
  | "supabase_postgres"
  | "vercel_blob"
  | "process_memory"
  | "local_filesystem";

export type PersistenceInventoryItem = {
  id: string;
  layer: PersistenceLayer;
  description: string;
  containsFiscalPayload: boolean;
  backupOwner: "customer" | "platform" | "shared";
  notes: string[];
};

export type DrTargets = {
  /** Recovery Point Objective em horas (draft) */
  rpoHours: number;
  /** Recovery Time Objective em horas (draft) */
  rtoHours: number;
  /** Explicitamente fora do SLA plataforma */
  outOfScope: string[];
  updatedAt: string;
};

export type DrDrillStatus = "planned" | "executed" | "failed" | "waived";

export type DrDrillRecord = {
  id: string;
  regionId: string;
  environment: "staging" | "production_claimed";
  status: DrDrillStatus;
  executedAt?: string;
  notes: string;
  /** Sempre false se environment production_claimed sem autorização explícita */
  countsAsEvidence: boolean;
};

export type RegionId = "gru" | "iad" | "local";

export type RegionHealth = {
  regionId: RegionId;
  label: string;
  reachable: boolean;
  latencyMsEstimate: number | null;
  notes: string[];
  checkedAt: string;
};

export type EnterprisePlanId = "free" | "starter" | "pro" | "enterprise";

export type PlanQuotaLimits = {
  planId: EnterprisePlanId;
  maxGenerationsPerHour: number;
  maxApiCallsPerHour: number;
  maxEvidenceStorageMb: number;
  commercialHint: CommercialPlanHint;
};

export type MeterSample = {
  workspaceId: string;
  at: string;
  generations: number;
  apiCalls: number;
  evidenceStorageMb: number;
};

export type MeteringSnapshot = {
  workspaceId: string;
  planId: EnterprisePlanId;
  periodKey: string; // YYYY-MM
  generations: number;
  apiCalls: number;
  evidenceStorageMb: number;
  withinPlanLimits: boolean;
  breaches: string[];
};

export type MassCampaign = {
  id: string;
  tenantId: string;
  workspaceId: string;
  title: string;
  obligationId: ObligationId;
  targetUfs: string[];
  targetRegime?: string;
  listingIds: string[];
  scenarioIds: string[];
  status: "planned" | "queued_relab" | "in_progress" | "blocked" | "completed" | "cancelled";
  relabQueue: string[];
  createdAt: string;
  updatedAt: string;
  notes?: string;
};

export type CoverageCell = {
  obligationId: string;
  uf: string;
  regime: string;
  validatedScopeCount: number;
  pendingRelab: number;
  rehomologationDue: number;
};

export type PenTestFinding = {
  id: string;
  title: string;
  severity: "info" | "low" | "medium" | "high" | "critical";
  status: "open" | "triaged" | "mitigated" | "accepted" | "false_positive";
  residualRisk?: string;
  updatedAt: string;
};

export type SecretsManagerMode = "env_only" | "external_planned" | "external_configured";

export type ScaleMaturity = "development" | "internal_beta" | "official_validator_beta";
