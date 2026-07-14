/**
 * Hardening — deny live ERP sem env; secrets scan helper CI-friendly.
 * Não importa o registry (evita ciclo).
 */

/** Env explícito exigido para qualquer adapter live. */
export const LIVE_ERP_ENV_FLAG = "XFI_ALLOW_LIVE_ERP";

export function envAllowsLiveErp(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  const v = env[LIVE_ERP_ENV_FLAG];
  return v === "1" || v === "true";
}

export function assertNoLiveErpWithoutEnv(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
  adapters: Array<{ vendorId: string; liveConnectionEnabled: boolean }> = [],
): { ok: true } | { ok: false; reason: string } {
  const live = adapters.filter((a) => a.liveConnectionEnabled);
  if (live.length === 0) return { ok: true };
  if (envAllowsLiveErp(env)) return { ok: true };
  return {
    ok: false,
    reason: `Adapters live (${live.map((l) => l.vendorId).join(",")}) exigem ${LIVE_ERP_ENV_FLAG}=1`,
  };
}

export function denyLiveErpWithoutEnv(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
  adapters: Array<{ vendorId: string; liveConnectionEnabled: boolean }> = [],
): void {
  const r = assertNoLiveErpWithoutEnv(env, adapters);
  if (!r.ok) throw new Error(r.reason);
}

/** Lista padrões de path suspeitos — uso em CI/local, não escreve secrets. */
export const SECRET_SCAN_GLOBS = [
  "**/.env",
  "**/.env.*",
  "**/credentials.json",
  "**/*secret*",
  "**/*private*key*",
] as const;

export function isLikelySecretPath(path: string): boolean {
  const p = path.replace(/\\/g, "/").toLowerCase();
  if (p.includes("/.env") || p.endsWith(".env")) return true;
  if (p.includes("credentials.json")) return true;
  if (p.includes("private") && p.includes("key")) return true;
  return false;
}
