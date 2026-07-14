/**
 * Guard for read-only SQL previews / diagnostics. Not an AI feature.
 */
export function assertSafeSelectSql(sql: string): { ok: boolean; reason?: string } {
  const normalized = sql.trim().replace(/\s+/g, " ");
  if (!/^select\b/i.test(normalized)) {
    return { ok: false, reason: "Apenas SELECT é permitido" };
  }
  if (/\b(insert|update|delete|drop|alter|truncate|grant|revoke|create)\b/i.test(normalized)) {
    return { ok: false, reason: "SQL destrutivo bloqueado" };
  }
  return { ok: true };
}
