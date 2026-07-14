/**
 * Alertas SLO sem PII — reutiliza sanitize de auditoria.
 */

import { sanitizeAuditDetail } from "@/modules/governance/audit-export";
import { buildWebhookAlert } from "@/modules/continuous-ops/observability";
import type { ErrorBudget, SloSnapshot } from "@/modules/ecosystem/types";

export function buildSloAlert(input: {
  workspaceId: string;
  snap: SloSnapshot;
  budget: ErrorBudget;
}): ReturnType<typeof buildWebhookAlert> | null {
  if (input.snap.meetsTarget && !input.budget.exhausted) return null;
  const raw = `SLO ${input.snap.sloId} avail=${input.snap.availabilityPct?.toFixed(1)}% target=${input.snap.targetPct}% budget_remaining=${input.budget.remainingPct.toFixed(0)}% CNPJ 11222333000181`;
  return buildWebhookAlert({
    workspaceId: input.workspaceId,
    title: `SLO breach ${input.snap.sloId}`,
    rawBody: sanitizeAuditDetail(raw),
  });
}
