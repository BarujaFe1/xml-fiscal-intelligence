/**
 * Alertas webhook sem PII — reutiliza sanitização de notifications.
 */

import { sanitizeNotificationBody, buildNotification, defaultPrefs } from "@/modules/ops/notifications";
import type { NotificationPayload } from "@/modules/ops/types";
import { listOpsEvents, type OpsTelemetryEvent } from "@/modules/ops/telemetry";

export function telemetryPanel(limit = 30): OpsTelemetryEvent[] {
  return listOpsEvents(limit);
}

export function buildWebhookAlert(input: {
  workspaceId: string;
  title: string;
  rawBody: string;
  recentCount?: number;
}): NotificationPayload {
  const prefs = {
    ...defaultPrefs(input.workspaceId),
    channels: ["webhook" as const, "internal" as const],
  };
  return buildNotification({
    workspaceId: input.workspaceId,
    channel: "webhook",
    title: input.title,
    body: sanitizeNotificationBody(input.rawBody),
    prefs,
    recentCount: input.recentCount ?? 0,
  });
}

export function summarizeTelemetry(events: OpsTelemetryEvent[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const e of events) {
    counts[e.kind] = (counts[e.kind] || 0) + 1;
  }
  return counts;
}
