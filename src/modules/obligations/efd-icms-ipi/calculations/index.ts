import type { ObligationContext, ObligationRecord } from "@/modules/obligations/core/types";
import { money, moneyToEfd, Money } from "@/lib/money/decimal";
import { dateEfd, efdSanitize, onlyDigits } from "@/modules/obligations/efd-icms-ipi/common";

/**
 * E110 (15 campos). Débitos/créditos = soma VL_ICMS dos C190 conforme CFOP
 * (entrada 1/2/3/5605 = crédito; saída 5/6/7 = débito). PVA valida por CFOP,
 * não por IND_OPER. Saldo anterior só se `priorCreditBalance` informado.
 */
export function buildE110FromC190(
  cFlat: ObligationRecord[],
  priorCreditBalance?: string,
): ObligationRecord {
  let debits = money("0");
  let credits = money("0");
  for (const r of cFlat) {
    let cfop = "";
    let vlIcms = "0";
    if (r.type === "C190") {
      cfop = r.fields[2] || ""; // C190: REG, CST_ICMS, CFOP, ...
      vlIcms = r.fields[6] || "0"; // VL_ICMS
    } else if (r.type === "C170") {
      cfop = r.fields[10] || ""; // C170: ..., CST_ICMS, CFOP, ...
      vlIcms = r.fields[14] || "0"; // VL_ICMS
    } else {
      continue;
    }
    const isCredito =
      (cfop.startsWith("1") && cfop !== "1605") ||
      cfop.startsWith("2") ||
      cfop.startsWith("3") ||
      cfop === "5605";
    if (isCredito) credits = credits.plus(money(vlIcms));
    else debits = debits.plus(money(vlIcms));
  }
  const z = "0,00";
  const prior = money(priorCreditBalance || "0");
  const vlDeb = moneyToEfd(debits);
  const vlCred = moneyToEfd(credits);
  const vlPrior = priorCreditBalance ? moneyToEfd(prior) : z;
  const net = debits.scaled - credits.scaled - prior.scaled;
  const sldApurado = net > 0n ? moneyToEfd(new Money(net)) : z;
  const sldTransp = net < 0n ? moneyToEfd(new Money(-net)) : z;
  return {
    type: "E110",
    fields: [
      "E110",
      vlDeb,
      z,
      z,
      z,
      vlCred,
      z,
      z,
      z,
      vlPrior,
      sldApurado,
      z,
      sldApurado,
      sldTransp,
      z, // DEB_ESP — débitos especiais (extemporâneos/ajustes); 0
    ],
  };
}

/** E116 obrigatório quando VL_ICMS_RECOLHER + DEB_ESP > 0 (Guia). */
export function buildE116IfNeeded(
  e110: ObligationRecord,
  ctx: ObligationContext,
  codRec: string,
): ObligationRecord | null {
  const vlRecolher = e110.fields[12] || "0,00";
  const debEsp = e110.fields[14] || "0,00";
  const total = money(vlRecolher).plus(money(debEsp));
  if (total.scaled <= 0n) return null;
  const mesRef = (ctx.periodEnd || "").slice(5, 7) + (ctx.periodEnd || "").slice(0, 4);
  return {
    type: "E116",
    fields: [
      "E116",
      "000",
      moneyToEfd(total),
      dateEfd(ctx.periodEnd),
      efdSanitize(codRec, 60),
      "",
      "",
      "",
      "",
      mesRef,
    ],
  };
}
