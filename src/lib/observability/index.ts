/**
 * Safe observability facade — no XML, secrets, or full tax IDs in events.
 * Swap sink for Sentry/OTel later without changing call sites.
 */

import { redactSensitiveText } from "@/lib/security/redaction";

export type LogLevel = "debug" | "info" | "warn" | "error";

export type SafeLogEvent = {
  level: LogLevel;
  message: string;
  requestId?: string;
  correlationId?: string;
  jobId?: string;
  batchId?: string;
  workspaceId?: string;
  parserVersion?: string;
  ruleVersion?: string;
  durationMs?: number;
  status?: string;
  code?: string;
};

type Sink = (event: SafeLogEvent) => void;

let sink: Sink = (event) => {
  if (process.env.NODE_ENV === "test") return;
  const line = JSON.stringify({
    ...event,
    ts: new Date().toISOString(),
  });
  if (event.level === "error") console.error(line);
  else if (event.level === "warn") console.warn(line);
  else console.info(line);
};

export function setObservabilitySink(next: Sink): void {
  sink = next;
}

export function createRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Redact common sensitive patterns from free-text messages. */
export function sanitizeLogMessage(message: string): string {
  return redactSensitiveText(message);
}

export function logSafe(event: SafeLogEvent): void {
  sink({
    ...event,
    message: sanitizeLogMessage(event.message),
    workspaceId: event.workspaceId
      ? `ws_${event.workspaceId.replace(/^ws_/, "").slice(0, 8)}…`
      : undefined,
  });
}
