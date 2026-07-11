/**
 * CNPJ (numeric + alphanumeric) helpers per Receita Federal.
 * Sources:
 * - https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/documentos-tecnicos/cnpj/manual-dv-cnpj.pdf
 * - IN RFB 2.229/2024 — alphanumeric from July 2026
 *
 * Rules:
 * - 14 positions; first 12 may be A–Z / 0–9; last 2 DV always numeric
 * - Store as uppercase string; never as number/bigint
 * - Do not strip letters with replace(/\D/g, "")
 */

const CNPJ_BODY_RE = /^[0-9A-Z]{12}[0-9]{2}$/;

/** ASCII code − 48 (official RFB conversion for DV). */
function charValue(ch: string): number {
  return ch.charCodeAt(0) - 48;
}

function mod11Digit(chars: string): number {
  let sum = 0;
  let weight = 2;
  for (let i = chars.length - 1; i >= 0; i -= 1) {
    sum += charValue(chars[i]!) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const rem = sum % 11;
  return rem < 2 ? 0 : 11 - rem;
}

/** Remove mask punctuation only; preserve letters; uppercase. */
export function normalizeCnpj(raw?: string | null): string {
  if (!raw) return "";
  return raw
    .trim()
    .toUpperCase()
    .replace(/[.\-\/\s]/g, "");
}

export function isCnpjShape(normalized: string): boolean {
  return CNPJ_BODY_RE.test(normalized);
}

export function computeCnpjCheckDigits(body12: string): string {
  const base = body12.toUpperCase();
  if (!/^[0-9A-Z]{12}$/.test(base)) {
    throw new Error("CNPJ body must be 12 alphanumeric characters");
  }
  const d1 = mod11Digit(base);
  const d2 = mod11Digit(base + String(d1));
  return `${d1}${d2}`;
}

export function isValidCnpj(raw?: string | null, options?: { requireCheckDigits?: boolean }): boolean {
  const n = normalizeCnpj(raw);
  if (!n) return true;
  if (!isCnpjShape(n)) return false;
  if (options?.requireCheckDigits === false) return true;
  const expected = computeCnpjCheckDigits(n.slice(0, 12));
  return n.slice(12) === expected;
}

export function formatCnpj(raw?: string | null, mask = false): string {
  const n = normalizeCnpj(raw);
  if (!isCnpjShape(n)) return raw?.trim() || "—";
  const formatted = `${n.slice(0, 2)}.${n.slice(2, 5)}.${n.slice(5, 8)}/${n.slice(8, 12)}-${n.slice(12)}`;
  if (!mask) return formatted;
  return `${formatted.slice(0, -2)}XX`;
}

/** CPF remains numeric-only (11 digits). */
export function normalizeCpf(raw?: string | null): string {
  if (!raw) return "";
  return raw.replace(/\D/g, "");
}

export function isValidCpfFormat(raw?: string | null): boolean {
  if (!raw) return true;
  return normalizeCpf(raw).length === 11;
}

export function isValidCnpjOrCpf(raw?: string | null): boolean {
  if (!raw) return true;
  const n = normalizeCnpj(raw);
  if (isCnpjShape(n)) return isValidCnpj(n);
  const cpf = normalizeCpf(raw);
  return cpf.length === 11;
}

/** Search needle: keep alphanumerics; do not destroy letters. */
export function cnpjSearchNeedle(raw: string): string {
  return raw.trim().toUpperCase().replace(/[.\-\/\s]/g, "");
}

export function cnpjIncludes(haystack?: string | null, needle?: string | null): boolean {
  if (!needle) return true;
  if (!haystack) return false;
  return cnpjSearchNeedle(haystack).includes(cnpjSearchNeedle(needle));
}
