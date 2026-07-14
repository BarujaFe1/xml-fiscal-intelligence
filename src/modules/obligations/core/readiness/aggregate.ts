import type { RequiredDataResult, ReadinessItem } from "@/modules/obligations/core/types";

export function countByStatus(items: ReadinessItem[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const i of items) {
    out[i.status] = (out[i.status] || 0) + 1;
  }
  return out;
}

/** Rough readiness % for cockpit — blocking items weigh zero credit. */
export function readinessPercent(result: RequiredDataResult): number {
  if (!result.items.length) return 0;
  const weight: Record<string, number> = {
    complete: 1,
    derived: 0.85,
    manual: 0.7,
    na: 1,
    pending: 0.25,
    review: 0.4,
    blocking: 0,
    unsupported: 0,
  };
  let sum = 0;
  for (const i of result.items) {
    sum += weight[i.status] ?? 0.3;
  }
  return Math.round((sum / result.items.length) * 100);
}

export function aggregateReadiness(results: RequiredDataResult[]): {
  canGenerateAll: boolean;
  blockingTotal: number;
  averagePercent: number;
} {
  if (!results.length) {
    return { canGenerateAll: false, blockingTotal: 0, averagePercent: 0 };
  }
  const blockingTotal = results.reduce((a, r) => a + r.blockingCount, 0);
  const averagePercent = Math.round(
    results.reduce((a, r) => a + readinessPercent(r), 0) / results.length,
  );
  return {
    canGenerateAll: results.every((r) => r.canGenerate),
    blockingTotal,
    averagePercent,
  };
}
