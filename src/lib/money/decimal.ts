/**
 * Fixed-scale decimal arithmetic for fiscal amounts.
 * Default scale 6 (supports qty + money). Display with toFixed(places).
 * Avoids IEEE float for SPED totals.
 */

const DEFAULT_SCALE = 6;
const FACTOR = BigInt(10) ** BigInt(DEFAULT_SCALE);
const ZERO = BigInt(0);
const ONE = BigInt(1);
const FIVE = BigInt(5);

function parseToScaled(value: string | number | Money | null | undefined): bigint {
  if (value === null || value === undefined || value === "") return ZERO;
  if (value instanceof Money) return value.scaled;
  const raw = String(value).trim().replace(",", ".");
  const neg = raw.startsWith("-");
  const s = neg ? raw.slice(1) : raw;
  if (!/^\d+(\.\d+)?$/.test(s)) return ZERO;
  const [intPart, fracPart = ""] = s.split(".");
  const frac = (fracPart + "000000").slice(0, DEFAULT_SCALE);
  const scaled = BigInt(intPart || "0") * FACTOR + BigInt(frac);
  return neg ? -scaled : scaled;
}

export class Money {
  readonly scaled: bigint;
  constructor(scaled: bigint) {
    this.scaled = scaled;
  }
  plus(other: string | number | Money): Money {
    return new Money(this.scaled + parseToScaled(other));
  }
  toFixed(places = 2): string {
    const neg = this.scaled < ZERO;
    const abs = neg ? -this.scaled : this.scaled;
    const intPart = abs / FACTOR;
    const fracFull = (abs % FACTOR).toString().padStart(DEFAULT_SCALE, "0");
    if (places >= DEFAULT_SCALE) {
      const out = `${intPart}.${fracFull}`;
      return neg ? `-${out}` : out;
    }
    const keep = fracFull.slice(0, places);
    const nextDigit = BigInt(fracFull[places] || "0");
    let fracNum = BigInt(keep || "0");
    let intNum = intPart;
    if (nextDigit >= FIVE) {
      fracNum += ONE;
      const limit = BigInt(10) ** BigInt(places);
      if (fracNum >= limit) {
        fracNum = ZERO;
        intNum += ONE;
      }
    }
    const fracStr = fracNum.toString().padStart(places, "0");
    const out = places === 0 ? `${intNum}` : `${intNum}.${fracStr}`;
    return neg ? `-${out}` : out;
  }
}

export function money(value: string | number | Money | null | undefined): Money {
  return new Money(parseToScaled(value));
}

export function moneyAdd(...values: Array<string | number | Money | null | undefined>): Money {
  return values.reduce<Money>((acc, v) => acc.plus(money(v)), money(0));
}

export function moneyToFixed(value: string | number | Money, places = 2): string {
  return money(value).toFixed(places);
}

export function moneyToEfd(value: string | number | Money, places = 2): string {
  return moneyToFixed(value, places).replace(".", ",");
}

export function assertMoneyEqual(
  a: string | number | Money,
  b: string | number | Money,
  places = 2,
): boolean {
  return money(a).toFixed(places) === money(b).toFixed(places);
}
