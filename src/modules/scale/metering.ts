/**
 * Metering honesto — gerações, API, storage evidências (MB).
 */

import type { EnterprisePlanId, MeterSample, MeteringSnapshot } from "@/modules/scale/types";
import { PLAN_QUOTAS } from "@/modules/scale/billing-plans";

export function periodKeyFromDate(d = new Date()): string {
  return d.toISOString().slice(0, 7);
}

export function aggregateMeterSamples(
  workspaceId: string,
  planId: EnterprisePlanId,
  samples: MeterSample[],
  periodKey = periodKeyFromDate(),
): MeteringSnapshot {
  const inPeriod = samples.filter(
    (s) => s.workspaceId === workspaceId && s.at.startsWith(periodKey),
  );
  const generations = inPeriod.reduce((a, s) => a + s.generations, 0);
  const apiCalls = inPeriod.reduce((a, s) => a + s.apiCalls, 0);
  const evidenceStorageMb = inPeriod.reduce((a, s) => Math.max(a, s.evidenceStorageMb), 0);
  const limits = PLAN_QUOTAS[planId];
  const breaches: string[] = [];
  // Mensal soft: gerações/API do período vs teto horário * 24 * 30 (ordem de grandeza)
  const softGen = limits.maxGenerationsPerHour * 24 * 30;
  const softApi = limits.maxApiCallsPerHour * 24 * 30;
  if (generations > softGen) breaches.push(`generations>${softGen}`);
  if (apiCalls > softApi) breaches.push(`apiCalls>${softApi}`);
  if (evidenceStorageMb > limits.maxEvidenceStorageMb) {
    breaches.push(`evidenceStorageMb>${limits.maxEvidenceStorageMb}`);
  }
  return {
    workspaceId,
    planId,
    periodKey,
    generations,
    apiCalls,
    evidenceStorageMb,
    withinPlanLimits: breaches.length === 0,
    breaches,
  };
}

export function recordMeterSample(input: {
  workspaceId: string;
  generations?: number;
  apiCalls?: number;
  evidenceStorageMb?: number;
}): MeterSample {
  return {
    workspaceId: input.workspaceId,
    at: new Date().toISOString(),
    generations: input.generations ?? 0,
    apiCalls: input.apiCalls ?? 0,
    evidenceStorageMb: input.evidenceStorageMb ?? 0,
  };
}
