/**
 * Notificações — canais internos/e-mail/webhook; sem PII fiscal no corpo.
 */

import type { NotificationChannel, NotificationPayload, NotificationPrefs } from "@/modules/ops/types";

export function maskCnpj(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.length < 8) return "***";
  return `${d.slice(0, 4)}********${d.slice(-2)}`;
}

/** Remove XML/keys e mascara CNPJ. */
export function sanitizeNotificationBody(text: string): string {
  let out = text
    .replace(/<\?xml[\s\S]*?>/gi, "[xml omitido]")
    .replace(/<[^>]+>/g, " ")
    .replace(/\b\d{14}\b/g, (m) => maskCnpj(m))
    .replace(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, (m) => maskCnpj(m))
    .replace(/\|[A-Z0-9]{44}\|/g, "|[chave omitida]|")
    .replace(/\s+/g, " ")
    .trim();
  if (out.length > 500) out = `${out.slice(0, 497)}...`;
  return out;
}

export function defaultPrefs(workspaceId: string): NotificationPrefs {
  return {
    workspaceId,
    channels: ["internal"],
    maxPerHour: 30,
    updatedAt: new Date().toISOString(),
  };
}

export function assertRateLimit(
  recentCount: number,
  prefs: NotificationPrefs,
): { ok: boolean; reason?: string } {
  if (recentCount >= prefs.maxPerHour) {
    return { ok: false, reason: `rate limit ${prefs.maxPerHour}/h` };
  }
  return { ok: true };
}

export function buildNotification(input: {
  workspaceId: string;
  channel: NotificationChannel;
  title: string;
  body: string;
  prefs: NotificationPrefs;
  recentCount: number;
}): NotificationPayload {
  if (!input.prefs.channels.includes(input.channel)) {
    throw new Error(`canal ${input.channel} desabilitado nas preferências`);
  }
  const rl = assertRateLimit(input.recentCount, input.prefs);
  if (!rl.ok) throw new Error(rl.reason);
  return {
    id: `ntf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    workspaceId: input.workspaceId,
    channel: input.channel,
    title: input.title.slice(0, 120),
    body: sanitizeNotificationBody(input.body),
    createdAt: new Date().toISOString(),
    delivered: false,
  };
}
