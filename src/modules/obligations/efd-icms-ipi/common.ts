import type { ObligationContext } from "@/modules/obligations/core/types";
import { isCnpjShape, normalizeCnpj, normalizeCpf } from "@/lib/fiscal/cnpj";
import { cnpjFromAccessKey } from "@/modules/obligations/efd-icms-ipi/suggest-informant";

export function onlyDigits(v?: string) {
  return (v || "").replace(/\D/g, "");
}

/** CNPJ for EFD: preserve alphanumeric; strip only mask punctuation. */
export function efdCnpj(v?: string) {
  return normalizeCnpj(v);
}

/**
 * Text fields in pipe-delimited SPED cannot contain `|` or line breaks —
 * otherwise PVA reports "número de campos difere do layout".
 */
export function efdSanitize(v: string | undefined | null, maxLen?: number): string {
  let s = String(v ?? "")
    .replace(/\|/g, "/")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (maxLen != null && maxLen > 0 && s.length > maxLen) s = s.slice(0, maxLen);
  return s;
}

export function pipe(fields: Array<string | undefined | null>): string {
  return `|${fields.map((f) => efdSanitize(f === undefined || f === null ? "" : String(f))).join("|")}|`;
}

export function efdUnid(v?: string): string {
  const u = efdSanitize(v || "UN", 6);
  return u || "UN";
}

export function efdNcm(v?: string): string {
  const d = onlyDigits(v);
  return d.length === 8 ? d : "";
}

export function dateEfd(iso?: string): string {
  if (!iso) return "";
  const d = iso.slice(0, 10);
  const [y, m, day] = d.split("-");
  if (!y || !m || !day) return "";
  return `${day}${m}${y}`;
}

/** Split party document into EFD CNPJ vs CPF fields without destroying letters. */
export function partyDocFields(doc?: string): { cnpj: string; cpf: string } {
  const cnpj = efdCnpj(doc);
  if (isCnpjShape(cnpj)) return { cnpj, cpf: "" };
  const cpf = normalizeCpf(doc);
  if (cpf.length === 11) return { cnpj: "", cpf };
  return { cnpj: "", cpf: "" };
}

export function participantCode(doc?: string) {
  const { cnpj, cpf } = partyDocFields(doc);
  const d = cnpj || cpf;
  return d ? `P${d}` : "";
}

export function resolveIndEmit(
  ctx: ObligationContext,
  d: ObligationContext["documents"][0],
): "0" | "1" {
  if (d.indEmit === "0" || d.indEmit === "1") return d.indEmit;
  const informante = efdCnpj(ctx.cnpj);
  const emit = efdCnpj(d.emitterDoc) || cnpjFromAccessKey(d.accessKey);
  if (informante && emit) return informante === emit ? "0" : "1";
  return "0";
}

export function resolveCodSit(d: ObligationContext["documents"][0]): string {
  if (d.codSit) return efdSanitize(d.codSit, 2).padStart(2, "0").slice(-2);
  const st = (d.status || "").toLowerCase();
  if (st.includes("cancel")) return "02";
  return "00";
}

/**
 * CST/CSOSN do ICMS para C170/C190.
 * Regime Normal (CRT=3): CST de 2 dígitos (00,10,20,30,40,41,50,51,60,70,90).
 * Simples Nacional (CRT=1/2): CSOSN de 3 dígitos (101,102,103,201,202,203,300,400,500,900).
 * O NFe traz CST (2 díg.) quando normal e CSOSN (3 díg.) quando SN — infere-se pelo tamanho.
 */
const CSOSN_VALUES = ["101", "102", "103", "201", "202", "203", "300", "400", "500", "900"];
export function cstIcms(item: ObligationContext["documents"][0]["items"][0]): string {
  const raw = onlyDigits(item.tax.icms.cst || item.tax.icms.csosn || "");
  if (!raw) return "";
  if (CSOSN_VALUES.includes(raw)) return raw; // SN: 3 dígitos
  return raw.padStart(2, "0").slice(-2); // Normal: 2 dígitos
}
