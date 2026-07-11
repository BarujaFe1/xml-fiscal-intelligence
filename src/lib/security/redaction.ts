/**
 * Central redaction for logs, AI previews, and SQL-ish strings.
 * Never log full access keys, CPF/CNPJ, tokens, or XML bodies.
 */

const ACCESS_KEY = /\b\d{44}\b/g;
const CNPJ_ALNUM = /\b[0-9A-Z]{14}\b/gi;
const CPF = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;
const BEARER = /Bearer\s+\S+/gi;
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;

export function redactSensitiveText(input: string, opts?: { keepShortIds?: boolean }): string {
  let out = input
    .replace(ACCESS_KEY, "[CHAVE]")
    .replace(BEARER, "Bearer [REDACTED]")
    .replace(EMAIL, "[EMAIL]")
    .replace(CPF, "[CPF]")
    .replace(CNPJ_ALNUM, "[DOC]");
  if (!opts?.keepShortIds) {
    out = out.replace(UUID, "[ID]");
  }
  // Strip XML-ish blobs
  if (out.includes("<") && out.includes(">")) {
    out = out.replace(/<[^>]+>/g, "[XML]");
  }
  return out.slice(0, 800);
}

export function redactMetadata(
  meta: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!meta) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    const key = k.toLowerCase();
    if (key.includes("xml") || key.includes("token") || key.includes("password") || key.includes("secret")) {
      out[k] = "[REDACTED]";
      continue;
    }
    if (typeof v === "string") out[k] = redactSensitiveText(v, { keepShortIds: true });
    else if (typeof v === "number" || typeof v === "boolean" || v == null) out[k] = v;
    else out[k] = "[OBJECT]";
  }
  return out;
}

export function maskAccessKey(key?: string | null): string {
  if (!key) return "";
  if (key.length < 8) return "[CHAVE]";
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}
