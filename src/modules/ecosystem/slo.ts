/**
 * SLOs mensuráveis + error budget (liga SLA F11).
 */

import type { ErrorBudget, SloDefinition, SloSample, SloSnapshot } from "@/modules/ecosystem/types";
import { DRAFT_SLA_TARGETS } from "@/modules/governance/sla";

export const SLO_DEFINITIONS: SloDefinition[] = [
  {
    id: "api_status_availability",
    title: "Disponibilidade API /status (amostras staging)",
    targetPct: 99,
    windowDays: 30,
    notes: "Medido por samples locais/staging — não promete uptime RFB",
  },
  {
    id: "generation_success",
    title: "Taxa de sucesso de geração assistida",
    targetPct: 95,
    windowDays: 7,
    notes: "Alinha DRAFT_SLA generation_success_rate",
  },
  {
    id: "lab_import_ack",
    title: "Ack de import lab",
    targetPct: 99,
    windowDays: 7,
    notes: "lab_import eventos vs falhas",
  },
  {
    id: "api_latency_p95",
    title: "Latência p95 API /status (ms budget via success flag)",
    targetPct: 95,
    windowDays: 7,
    notes: "success=true se latencyMs <= 500",
  },
];

export function getSloDefinition(id: SloDefinition["id"]): SloDefinition {
  const d = SLO_DEFINITIONS.find((s) => s.id === id);
  if (!d) throw new Error(`SLO desconhecido ${id}`);
  return d;
}

export function recordSloSample(input: {
  sloId: SloDefinition["id"];
  success: boolean;
  latencyMs?: number;
  detail?: string;
}): SloSample {
  return {
    id: `slo_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    sloId: input.sloId,
    at: new Date().toISOString(),
    success: input.success,
    latencyMs: input.latencyMs,
    detail: input.detail?.slice(0, 200),
  };
}

function percentile95(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);
  return sorted[Math.max(0, idx)]!;
}

export function computeSloSnapshot(sloId: SloDefinition["id"], samples: SloSample[]): SloSnapshot {
  const def = getSloDefinition(sloId);
  const mine = samples.filter((s) => s.sloId === sloId);
  const successCount = mine.filter((s) => s.success).length;
  const availabilityPct =
    mine.length > 0 ? (successCount / mine.length) * 100 : null;
  const latencyP95Ms = percentile95(
    mine.map((s) => s.latencyMs).filter((n): n is number => typeof n === "number"),
  );
  const meetsTarget =
    availabilityPct !== null ? availabilityPct >= def.targetPct : false;
  return {
    sloId,
    sampleCount: mine.length,
    successCount,
    availabilityPct,
    latencyP95Ms,
    meetsTarget,
    targetPct: def.targetPct,
  };
}

/** Error budget = 100 - target; consumed = max(0, target - availability). */
export function computeErrorBudget(snap: SloSnapshot): ErrorBudget {
  const budgetPct = Math.max(0, 100 - snap.targetPct);
  const gap =
    snap.availabilityPct === null ? 0 : Math.max(0, snap.targetPct - snap.availabilityPct);
  const consumedPct = budgetPct > 0 ? Math.min(100, (gap / budgetPct) * 100) : gap > 0 ? 100 : 0;
  return {
    sloId: snap.sloId,
    budgetPct,
    consumedPct,
    remainingPct: Math.max(0, 100 - consumedPct),
    exhausted: consumedPct >= 100,
  };
}

export function slaLinkageNotes(): string {
  return DRAFT_SLA_TARGETS.map((t) => `${t.metric}@${t.targetPct}%`).join(", ");
}

/** Seed staging: pelo menos 1 SLO “medido” com amostras sintéticas saudáveis (≥99%). */
export function seedStagingApiStatusSamples(count = 100): SloSample[] {
  const out: SloSample[] = [];
  for (let i = 0; i < count; i++) {
    out.push(
      recordSloSample({
        sloId: "api_status_availability",
        // 1 falha em 100 → 99% (cumpre target)
        success: i !== 0,
        latencyMs: 40 + (i % 5) * 10,
        detail: "staging synth",
      }),
    );
  }
  return out;
}
