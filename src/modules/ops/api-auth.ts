/**
 * API key auth for /api/v1 — env OPS_API_KEYS comma-separated.
 * Sem keys configuradas: modo lab aceita X-Api-Key=local-dev apenas se NODE_ENV≠production.
 */

import { NextRequest } from "next/server";
import { recordApiKeyUse } from "@/modules/homologation/api-key-audit";

export type ApiKeyAuthResult =
  | { ok: true; keyId: string }
  | { ok: false; status: number; error: string };

export function authenticateApiKey(req: NextRequest): ApiKeyAuthResult {
  const path = req.nextUrl?.pathname || "/api/v1";
  const header =
    req.headers.get("x-api-key") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!header) {
    recordApiKeyUse({ keyId: "missing", path, ok: false, note: "missing key" });
    return { ok: false, status: 401, error: "missing X-Api-Key" };
  }
  const configured = (process.env.OPS_API_KEYS || "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
  if (configured.length) {
    if (!configured.includes(header)) {
      recordApiKeyUse({ keyId: `bad_${header.slice(0, 4)}`, path, ok: false });
      return { ok: false, status: 403, error: "invalid API key" };
    }
    const keyId = `key_${header.slice(0, 4)}`;
    recordApiKeyUse({ keyId, path, ok: true });
    return { ok: true, keyId };
  }
  if (process.env.NODE_ENV === "production") {
    recordApiKeyUse({ keyId: "unconfigured", path, ok: false });
    return { ok: false, status: 503, error: "OPS_API_KEYS not configured" };
  }
  if (header === "local-dev") {
    recordApiKeyUse({ keyId: "local-dev", path, ok: true });
    return { ok: true, keyId: "local-dev" };
  }
  recordApiKeyUse({ keyId: "rejected", path, ok: false });
  return { ok: false, status: 403, error: "use X-Api-Key: local-dev in development" };
}

export function idempotencyKey(req: NextRequest): string | null {
  return req.headers.get("idempotency-key");
}
