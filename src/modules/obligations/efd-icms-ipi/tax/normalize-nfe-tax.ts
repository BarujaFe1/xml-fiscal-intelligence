import { money, moneyToFixed } from "@/lib/money/decimal";

export interface NormalizedIcms {
  orig?: string;
  cst?: string;
  csosn?: string;
  modBc?: string;
  vBc: string;
  pIcms: string;
  vIcms: string;
  vBcSt: string;
  pIcmsSt: string;
  vIcmsSt: string;
  group?: string;
}

export interface NormalizedPisCofins {
  cst?: string;
  vBc: string;
  pAliq: string;
  vValor: string;
}

export interface NormalizedIpi {
  cst?: string;
  vBc: string;
  pIpi: string;
  vIpi: string;
}

export interface NormalizedItemTax {
  icms: NormalizedIcms;
  ipi: NormalizedIpi;
  pis: NormalizedPisCofins;
  cofins: NormalizedPisCofins;
}

function asRec(v: unknown): Record<string, unknown> | undefined {
  if (!v || typeof v !== "object" || Array.isArray(v)) return undefined;
  return v as Record<string, unknown>;
}

function dig(obj: unknown, keys: string[]): unknown {
  let cur: unknown = obj;
  for (const k of keys) {
    const r = asRec(cur);
    if (!r) return undefined;
    const found = Object.entries(r).find(([key]) => {
      const clean = key.includes(":") ? key.split(":").pop()! : key;
      return clean.toLowerCase() === k.toLowerCase();
    });
    cur = found?.[1];
  }
  return cur;
}

function str(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined;
  const s = String(v).trim();
  return s || undefined;
}

function firstIcmsGroup(imposto: unknown): { name: string; node: Record<string, unknown> } | null {
  const icms = asRec(dig(imposto, ["ICMS"])) || asRec(imposto);
  if (!icms) return null;
  for (const [k, v] of Object.entries(icms)) {
    const clean = (k.includes(":") ? k.split(":").pop()! : k).toUpperCase();
    if (clean.startsWith("ICMS") && clean !== "ICMS") {
      const node = asRec(v);
      if (node) return { name: clean, node };
    }
  }
  return null;
}

/**
 * Deterministic NF-e tax normalizer.
 * Does not invent CST/alíquotas — only reads present XML structures.
 */
export function normalizeNFeItemTax(imposto: unknown): NormalizedItemTax {
  const emptyLine = { vBc: "0.00", pAliq: "0.00", vValor: "0.00" as string };
  const icmsGroup = firstIcmsGroup(imposto);
  const icmsNode = icmsGroup?.node;

  const icms: NormalizedIcms = {
    orig: str(dig(icmsNode, ["orig"])),
    cst: str(dig(icmsNode, ["CST"])),
    csosn: str(dig(icmsNode, ["CSOSN"])),
    modBc: str(dig(icmsNode, ["modBC"])),
    vBc: moneyToFixed(money(str(dig(icmsNode, ["vBC"])) || 0)),
    pIcms: moneyToFixed(money(str(dig(icmsNode, ["pICMS"])) || 0)),
    vIcms: moneyToFixed(money(str(dig(icmsNode, ["vICMS"])) || 0)),
    vBcSt: moneyToFixed(money(str(dig(icmsNode, ["vBCST"])) || 0)),
    pIcmsSt: moneyToFixed(money(str(dig(icmsNode, ["pICMSST"])) || 0)),
    vIcmsSt: moneyToFixed(money(str(dig(icmsNode, ["vICMSST"])) || 0)),
    group: icmsGroup?.name,
  };

  const ipiNode =
    asRec(dig(imposto, ["IPI", "IPITrib"])) ||
    asRec(dig(dig(imposto, ["IPI"]), ["IPITrib"]));
  const ipi: NormalizedIpi = {
    cst: str(dig(ipiNode, ["CST"])) || str(dig(dig(imposto, ["IPI"]), ["CST"])),
    vBc: moneyToFixed(money(str(dig(ipiNode, ["vBC"])) || 0)),
    pIpi: moneyToFixed(money(str(dig(ipiNode, ["pIPI"])) || 0)),
    vIpi: moneyToFixed(money(str(dig(ipiNode, ["vIPI"])) || 0)),
  };

  const pisNode =
    asRec(dig(imposto, ["PIS", "PISAliq"])) ||
    asRec(dig(dig(imposto, ["PIS"]), ["PISAliq"])) ||
    asRec(dig(dig(imposto, ["PIS"]), ["PISOutr"]));
  const pis: NormalizedPisCofins = {
    cst: str(dig(pisNode, ["CST"])),
    vBc: moneyToFixed(money(str(dig(pisNode, ["vBC"])) || 0)),
    pAliq: moneyToFixed(money(str(dig(pisNode, ["pPIS"])) || 0)),
    vValor: moneyToFixed(money(str(dig(pisNode, ["vPIS"])) || 0)),
  };

  const cofinsNode =
    asRec(dig(imposto, ["COFINS", "COFINSAliq"])) ||
    asRec(dig(dig(imposto, ["COFINS"]), ["COFINSAliq"])) ||
    asRec(dig(dig(imposto, ["COFINS"]), ["COFINSOutr"]));
  const cofins: NormalizedPisCofins = {
    cst: str(dig(cofinsNode, ["CST"])),
    vBc: moneyToFixed(money(str(dig(cofinsNode, ["vBC"])) || 0)),
    pAliq: moneyToFixed(money(str(dig(cofinsNode, ["pCOFINS"])) || 0)),
    vValor: moneyToFixed(money(str(dig(cofinsNode, ["vCOFINS"])) || 0)),
  };

  void emptyLine;
  return { icms, ipi, pis, cofins };
}

export function normalizeIcmsTot(icmsTot: unknown): Record<string, string> {
  const keys = [
    "vBC",
    "vICMS",
    "vICMSDeson",
    "vBCST",
    "vST",
    "vProd",
    "vFrete",
    "vSeg",
    "vDesc",
    "vII",
    "vIPI",
    "vPIS",
    "vCOFINS",
    "vOutro",
    "vNF",
    "vTotTrib",
  ];
  const out: Record<string, string> = {};
  for (const k of keys) {
    const v = dig(icmsTot, [k]);
    if (v !== undefined && v !== null && String(v) !== "") {
      out[k] = moneyToFixed(money(String(v)));
    }
  }
  return out;
}
