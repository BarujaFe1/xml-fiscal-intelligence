/**
 * Auditoria de API keys — rotação lógica + log de uso.
 */

import type { ApiKeyAuditEvent } from "@/modules/homologation/types";

const MAX = 500;
const auditLog: ApiKeyAuditEvent[] = [];

export function recordApiKeyUse(input: {
  keyId: string;
  path: string;
  ok: boolean;
  note?: string;
}): ApiKeyAuditEvent {
  const ev: ApiKeyAuditEvent = {
    id: `aka_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    keyId: input.keyId,
    path: input.path,
    at: new Date().toISOString(),
    ok: input.ok,
    note: input.note,
  };
  auditLog.unshift(ev);
  if (auditLog.length > MAX) auditLog.pop();
  return ev;
}

export function listApiKeyAudit(limit = 50): ApiKeyAuditEvent[] {
  return auditLog.slice(0, limit);
}

export function clearApiKeyAuditForTests(): void {
  auditLog.length = 0;
}

/** Rotação: gera novo id lógico; keys reais ficam só em OPS_API_KEYS (env). */
export function proposeApiKeyRotation(prefix = "xfi"): {
  suggestedEnvValuePlaceholder: string;
  note: string;
} {
  const token = `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  return {
    suggestedEnvValuePlaceholder: token,
    note: "Atualize OPS_API_KEYS no ambiente; não gravar segredo no git/IDB",
  };
}
