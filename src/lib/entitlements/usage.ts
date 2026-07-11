/**
 * In-memory usage counters — replace with Postgres advisory locks / row updates when DB is live.
 * Concurrent increments are serialized per key in this process.
 */

import { assertWithinLimit, type EntitlementKey, type EntitlementMap } from "@/lib/entitlements";

type CounterKey = string;

const counters = new Map<CounterKey, number>();
const locks = new Map<CounterKey, Promise<void>>();

function key(workspaceId: string, metric: string, period: string): CounterKey {
  return `${workspaceId}:${metric}:${period}`;
}

export function currentPeriodYm(d = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function withLock<T>(k: CounterKey, fn: () => T | Promise<T>): Promise<T> {
  const prev = locks.get(k) || Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  locks.set(
    k,
    prev.then(() => gate),
  );
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (locks.get(k) === gate) locks.delete(k);
  }
}

export async function getUsage(
  workspaceId: string,
  metric: string,
  period = currentPeriodYm(),
): Promise<number> {
  return counters.get(key(workspaceId, metric, period)) || 0;
}

export async function incrementUsage(input: {
  workspaceId: string;
  metric: string;
  amount?: number;
  period?: string;
  entitlements?: EntitlementMap;
  entitlementKey?: EntitlementKey;
}): Promise<number> {
  const period = input.period || currentPeriodYm();
  const k = key(input.workspaceId, input.metric, period);
  const amount = input.amount ?? 1;

  return withLock(k, async () => {
    const current = counters.get(k) || 0;
    if (input.entitlements && input.entitlementKey) {
      assertWithinLimit(input.entitlements, input.entitlementKey, current, amount);
    }
    const next = current + amount;
    counters.set(k, next);
    return next;
  });
}

/** Test helper — clears process counters. */
export function resetUsageCountersForTests(): void {
  counters.clear();
  locks.clear();
}
