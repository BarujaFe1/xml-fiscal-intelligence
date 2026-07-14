/**
 * Decimal fiscal como string — evita floating point em tributos.
 * Escala padrão 2 casas (moeda BR); use scale explícita quando necessário.
 */
export type FiscalDecimal = string;

const SCALE_RE = /^-?\d+(\.\d+)?$/;

export function parseFiscalDecimal(raw: string | number | null | undefined): FiscalDecimal {
  if (raw === null || raw === undefined || raw === "") return "0";
  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) throw new Error("Valor fiscal não finito");
    return normalizeFiscalDecimal(String(raw));
  }
  const cleaned = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (!SCALE_RE.test(cleaned)) throw new Error(`Decimal fiscal inválido: ${raw}`);
  return normalizeFiscalDecimal(cleaned);
}

export function normalizeFiscalDecimal(v: FiscalDecimal, scale = 2): FiscalDecimal {
  const neg = v.startsWith("-");
  const abs = neg ? v.slice(1) : v;
  const [intPart, frac = ""] = abs.split(".");
  const padded = (frac + "0".repeat(scale)).slice(0, scale);
  const body = `${intPart || "0"}.${padded}`;
  return neg && body !== `0.${"0".repeat(scale)}` ? `-${body}` : body;
}

function toScaledInt(v: FiscalDecimal, scale: number): bigint {
  const n = normalizeFiscalDecimal(v, scale);
  const neg = n.startsWith("-");
  const abs = neg ? n.slice(1) : n;
  const [i, f = ""] = abs.split(".");
  const digits = `${i}${f.padEnd(scale, "0").slice(0, scale)}`;
  const bi = BigInt(digits || "0");
  return neg ? -bi : bi;
}

function fromScaledInt(v: bigint, scale: number): FiscalDecimal {
  const neg = v < 0n;
  const abs = neg ? -v : v;
  const s = abs.toString().padStart(scale + 1, "0");
  const intPart = s.slice(0, -scale) || "0";
  const frac = s.slice(-scale);
  const body = `${intPart}.${frac}`;
  return neg ? `-${body}` : body;
}

export function addFiscal(a: FiscalDecimal, b: FiscalDecimal, scale = 2): FiscalDecimal {
  return fromScaledInt(toScaledInt(a, scale) + toScaledInt(b, scale), scale);
}

export function subFiscal(a: FiscalDecimal, b: FiscalDecimal, scale = 2): FiscalDecimal {
  return fromScaledInt(toScaledInt(a, scale) - toScaledInt(b, scale), scale);
}

export function mulFiscal(
  a: FiscalDecimal,
  b: FiscalDecimal,
  scale = 2,
): FiscalDecimal {
  // (a * 10^s) * (b * 10^s) / 10^s = result * 10^s
  const sa = toScaledInt(a, scale);
  const sb = toScaledInt(b, scale);
  const prod = sa * sb;
  const div = 10n ** BigInt(scale);
  const half = div / 2n;
  const q = prod >= 0n ? (prod + half) / div : (prod - half) / div;
  return fromScaledInt(q, scale);
}

export function compareFiscal(a: FiscalDecimal, b: FiscalDecimal, scale = 2): number {
  const d = toScaledInt(a, scale) - toScaledInt(b, scale);
  return d === 0n ? 0 : d > 0n ? 1 : -1;
}

/** Serialização TXT SPED: vírgula decimal, sem milhar. */
export function formatFiscalForEfd(v: FiscalDecimal, scale = 2): string {
  const n = normalizeFiscalDecimal(v, scale);
  return n.replace(".", ",");
}
