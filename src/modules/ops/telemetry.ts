/**
 * Observabilidade mínima — erros de geração / lab (in-memory + contadores).
 */

export type OpsTelemetryEvent = {
  id: string;
  kind: "generation_error" | "lab_import" | "api_denied" | "notification";
  at: string;
  detail: string;
};

const MAX = 200;
const buffer: OpsTelemetryEvent[] = [];

export function recordOpsEvent(
  kind: OpsTelemetryEvent["kind"],
  detail: string,
): OpsTelemetryEvent {
  const ev: OpsTelemetryEvent = {
    id: `tel_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    kind,
    at: new Date().toISOString(),
    detail: detail.slice(0, 500),
  };
  buffer.unshift(ev);
  if (buffer.length > MAX) buffer.pop();
  return ev;
}

export function listOpsEvents(limit = 50): OpsTelemetryEvent[] {
  return buffer.slice(0, limit);
}

export function clearOpsEventsForTests(): void {
  buffer.length = 0;
}
