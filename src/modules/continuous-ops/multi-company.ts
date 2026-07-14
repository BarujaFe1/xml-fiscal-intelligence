/**
 * Multi-empresa — filtros + quotas de geração/API.
 */

import type { CompanyScopeFilter, QuotaPolicy, QuotaUsage } from "@/modules/continuous-ops/types";

export function filterByCompanyScope<T extends { companyId?: string; establishmentId?: string }>(
  rows: T[],
  filter: CompanyScopeFilter,
): T[] {
  return rows.filter((r) => {
    if (filter.companyId && r.companyId && r.companyId !== filter.companyId) return false;
    if (
      filter.establishmentId &&
      r.establishmentId &&
      r.establishmentId !== filter.establishmentId
    ) {
      return false;
    }
    return true;
  });
}

export function defaultQuotaPolicy(workspaceId: string): QuotaPolicy {
  return {
    workspaceId,
    maxGenerationsPerHour: 60,
    maxApiCallsPerHour: 300,
    updatedAt: new Date().toISOString(),
  };
}

export function hourBucket(d = new Date()): string {
  return d.toISOString().slice(0, 13);
}

export function assertWithinQuota(
  policy: QuotaPolicy,
  usage: QuotaUsage,
  kind: "generation" | "api",
): { ok: boolean; reason?: string } {
  if (usage.hourBucket !== hourBucket()) {
    return { ok: true };
  }
  if (kind === "generation" && usage.generationsThisHour >= policy.maxGenerationsPerHour) {
    return { ok: false, reason: `quota gerações ${policy.maxGenerationsPerHour}/h` };
  }
  if (kind === "api" && usage.apiCallsThisHour >= policy.maxApiCallsPerHour) {
    return { ok: false, reason: `quota API ${policy.maxApiCallsPerHour}/h` };
  }
  return { ok: true };
}

export function bumpUsage(usage: QuotaUsage, kind: "generation" | "api"): QuotaUsage {
  const bucket = hourBucket();
  const base =
    usage.hourBucket === bucket
      ? usage
      : { generationsThisHour: 0, apiCallsThisHour: 0, hourBucket: bucket };
  if (kind === "generation") {
    return { ...base, generationsThisHour: base.generationsThisHour + 1 };
  }
  return { ...base, apiCallsThisHour: base.apiCallsThisHour + 1 };
}
