/**
 * SLA draft metrics — síntese local, não uptime real de cloud.
 */

import type { OpsTelemetryEvent } from "@/modules/ops/telemetry";
import type { SlaSnapshot, SlaTarget } from "@/modules/governance/types";

export const DRAFT_SLA_TARGETS: SlaTarget[] = [
  {
    id: "gen_success",
    metric: "generation_success_rate",
    targetPct: 95,
    windowHours: 24,
    notes: "Estimativa a partir de telemetry generation_error vs baseline sintética",
  },
  {
    id: "api_synth",
    metric: "api_availability_synth",
    targetPct: 99,
    windowHours: 24,
    notes: "Síntese: 100 - (api_denied / max(1, total_api-ish))",
  },
  {
    id: "lab_ack",
    metric: "lab_import_ack",
    targetPct: 100,
    windowHours: 168,
    notes: "Imports lab registrados; não implica PVA/RFB uptime",
  },
  {
    id: "quota_429",
    metric: "quota_429_rate",
    targetPct: 5,
    windowHours: 1,
    notes: "Meta: taxa de negações por quota ≤ 5% das chamadas monitoradas",
  },
];

export function computeSlaSnapshot(
  events: OpsTelemetryEvent[],
  opts?: { syntheticGenerations?: number },
): SlaSnapshot {
  const generationErrors = events.filter((e) => e.kind === "generation_error").length;
  const labImports = events.filter((e) => e.kind === "lab_import").length;
  const apiDenied = events.filter((e) => e.kind === "api_denied").length;
  const notifications = events.filter((e) => e.kind === "notification").length;

  const synthGens = opts?.syntheticGenerations ?? Math.max(generationErrors + 20, 20);
  const generationSuccessEstimatePct =
    synthGens > 0 ? Math.max(0, Math.min(100, ((synthGens - generationErrors) / synthGens) * 100)) : null;

  const apiish = Math.max(apiDenied + 50, 50);
  const withinQuotaDeniedRatePct = (apiDenied / apiish) * 100;

  const gaps: string[] = [];
  if (generationSuccessEstimatePct !== null && generationSuccessEstimatePct < 95) {
    gaps.push(`generation_success_rate ${generationSuccessEstimatePct.toFixed(1)}% < 95%`);
  }
  if (withinQuotaDeniedRatePct > 5) {
    gaps.push(`quota/api_denied rate ${withinQuotaDeniedRatePct.toFixed(1)}% > 5%`);
  }
  // lab_import_ack: se há erros de geração sem lab recente, sinalizar
  if (generationErrors > 0 && labImports === 0) {
    gaps.push("lab_import_ack: erros de geração sem lab_import na janela");
  }

  return {
    at: new Date().toISOString(),
    generationErrors,
    labImports,
    apiDenied,
    notifications,
    generationSuccessEstimatePct,
    withinQuotaDeniedRatePct,
    meetsDraftTargets: gaps.length === 0,
    gaps,
  };
}
