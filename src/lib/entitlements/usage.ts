/**
 * Usage counters with optional Postgres durability.
 * Stripe/billing provider wiring is deferred — this only persists metric counters
 * when Supabase service role + UUID workspace are available.
 */

import { assertWithinLimit, type EntitlementKey, type EntitlementMap } from "@/lib/entitlements";
import { isSupabaseConfigured } from "@/lib/auth/config";
import { createServiceClient, hasServiceRole } from "@/lib/auth/supabase-service";

type CounterKey = string;

const counters = new Map<CounterKey, number>();
const locks = new Map<CounterKey, Promise<void>>();

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function key(workspaceId: string, metric: string, period: string): CounterKey {
  return `${workspaceId}:${metric}:${period}`;
}

export function currentPeriodYm(d = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function canUseDurable(workspaceId: string): boolean {
  return isSupabaseConfigured() && hasServiceRole() && UUID_RE.test(workspaceId);
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

async function getDurableUsage(
  workspaceId: string,
  metric: string,
  period: string,
): Promise<number | null> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("usage_counters")
      .select("value")
      .eq("workspace_id", workspaceId)
      .eq("period_yyyymm", period)
      .eq("metric", metric)
      .maybeSingle();
    if (error) return null;
    return data?.value != null ? Number(data.value) : 0;
  } catch {
    return null;
  }
}

async function setDurableUsage(
  workspaceId: string,
  metric: string,
  period: string,
  value: number,
): Promise<boolean> {
  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from("usage_counters").upsert(
      {
        workspace_id: workspaceId,
        period_yyyymm: period,
        metric,
        value,
      },
      { onConflict: "workspace_id,period_yyyymm,metric" },
    );
    return !error;
  } catch {
    return false;
  }
}

export async function getUsage(
  workspaceId: string,
  metric: string,
  period = currentPeriodYm(),
): Promise<number> {
  if (canUseDurable(workspaceId)) {
    const durable = await getDurableUsage(workspaceId, metric, period);
    if (durable != null) {
      counters.set(key(workspaceId, metric, period), durable);
      return durable;
    }
  }
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
    let current = counters.get(k) || 0;
    if (canUseDurable(input.workspaceId)) {
      const durable = await getDurableUsage(input.workspaceId, input.metric, period);
      if (durable != null) current = durable;
    }
    if (input.entitlements && input.entitlementKey) {
      assertWithinLimit(input.entitlements, input.entitlementKey, current, amount);
    }
    const next = current + amount;
    counters.set(k, next);
    if (canUseDurable(input.workspaceId)) {
      await setDurableUsage(input.workspaceId, input.metric, period, next);
    }
    return next;
  });
}

/** Test helper — clears process counters. */
export function resetUsageCountersForTests(): void {
  counters.clear();
  locks.clear();
}
