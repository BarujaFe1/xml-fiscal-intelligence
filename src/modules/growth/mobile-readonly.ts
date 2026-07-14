/**
 * Mobile read-only — resumo de fechamento + alertas sanitizados.
 * Sem geração / transmit na v1.
 */

import type { ClosingPeriodCard } from "@/modules/obligations/core/workflows/closing";
import { cardReadiness } from "@/modules/obligations/core/workflows/closing";
import { sanitizeAuditDetail } from "@/modules/governance/audit-export";
import type { MobileClosingSummary } from "@/modules/growth/types";
import type { OpsTelemetryEvent } from "@/modules/ops/telemetry";

export function buildMobileClosingSummary(input: {
  workspaceId: string;
  cards: ClosingPeriodCard[];
  telemetry?: OpsTelemetryEvent[];
}): MobileClosingSummary {
  const cards = input.cards.filter((c) => c.workspaceId === input.workspaceId);
  const ready =
    cards.length === 0
      ? 0
      : cards.reduce((a, c) => a + cardReadiness(c), 0) / cards.length;
  const alerts = (input.telemetry || [])
    .filter((e) => e.kind === "generation_error" || e.kind === "api_denied")
    .slice(0, 5)
    .map((e) => sanitizeAuditDetail(`${e.kind}: ${e.detail}`));

  return {
    workspaceId: input.workspaceId,
    cards: cards.length,
    readyPctEstimate: Math.round(ready),
    alerts,
    readOnly: true,
    canGenerate: false,
    canTransmit: false,
  };
}

export function assertMobileReadOnly(summary: MobileClosingSummary): void {
  if (!summary.readOnly || summary.canGenerate || summary.canTransmit) {
    throw new Error("mobile v1 deve ser read-only sem generate/transmit");
  }
}
