/**
 * Planos enterprise + quotas → continuous-ops QuotaPolicy.
 */

import type { EnterprisePlanId, PlanQuotaLimits } from "@/modules/scale/types";
import type { QuotaPolicy } from "@/modules/continuous-ops/types";
import { isFeatureEnabled } from "@/lib/feature-flags";

export const PLAN_QUOTAS: Record<EnterprisePlanId, PlanQuotaLimits> = {
  free: {
    planId: "free",
    maxGenerationsPerHour: 10,
    maxApiCallsPerHour: 60,
    maxEvidenceStorageMb: 50,
    commercialHint: "free",
  },
  starter: {
    planId: "starter",
    maxGenerationsPerHour: 30,
    maxApiCallsPerHour: 150,
    maxEvidenceStorageMb: 200,
    commercialHint: "starter",
  },
  pro: {
    planId: "pro",
    maxGenerationsPerHour: 60,
    maxApiCallsPerHour: 300,
    maxEvidenceStorageMb: 1024,
    commercialHint: "pro",
  },
  enterprise: {
    planId: "enterprise",
    maxGenerationsPerHour: 200,
    maxApiCallsPerHour: 2000,
    maxEvidenceStorageMb: 10240,
    commercialHint: "enterprise_beta",
  },
};

export function resolvePlanId(raw?: string | null): EnterprisePlanId {
  if (raw === "starter" || raw === "pro" || raw === "enterprise" || raw === "free") return raw;
  return "free";
}

/** FEATURE_BILLING gate honesto — sem stripe live, planos são preview/metering local. */
export function billingEnterpriseEnabled(): boolean {
  return isFeatureEnabled("billing");
}

export function quotaPolicyForPlan(workspaceId: string, planId: EnterprisePlanId): QuotaPolicy {
  const q = PLAN_QUOTAS[planId];
  return {
    workspaceId,
    maxGenerationsPerHour: q.maxGenerationsPerHour,
    maxApiCallsPerHour: q.maxApiCallsPerHour,
    updatedAt: new Date().toISOString(),
  };
}

export function listPlanCatalog(): PlanQuotaLimits[] {
  return Object.values(PLAN_QUOTAS);
}
