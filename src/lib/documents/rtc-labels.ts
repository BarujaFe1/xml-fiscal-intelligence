import type { DocumentItem, DocumentSummary } from "@/types";

/**
 * Detecção observacional de etiquetas CBS/IBS na nota.
 * Não inventa valores fiscais — só lê chaves/tags já presentes no flatten ou rtcObservation.
 */

const CBS_KEY_RE =
  /(soma[\s._-]*cbs|\bvcbs\b|\bpcbs\b|\bgcbs\b|\bibscbs\b|(^|[.\s_\[-])cbs([.\s_\-\]]|$))/i;
const IBS_KEY_RE =
  /(soma[\s._-]*ibs|\bvibs\b|\bpibs\b|\bgibs\b|\bibscbs\b|(^|[.\s_\[-])ibs([.\s_\-\]]|$)|ibs_?uf|ibs_?mun)/i;

/** Campos que indicam etiqueta, mas NÃO devem ser usados como “soma”. */
const AMOUNT_EXCLUDE_RE =
  /(pCBS|pIBS|pIBSUF|pIBSMun|vDif|vDevTrib|vCredPres|CST|cClassTrib|cMunFGIBS|gRed|pRedAliq|pAliqEfet)/i;

export type DocumentRtcLabels = {
  hasCbs: boolean;
  hasIbs: boolean;
  /** Soma/valor CBS explícito quando a chave existe e é numérica; senão undefined. */
  somaCbs?: number;
  somaIbs?: number;
  cbsKeys: string[];
  ibsKeys: string[];
  cbsAmountKey?: string;
  ibsAmountKey?: string;
};

function parseLooseNumber(raw: unknown): number | undefined {
  if (raw === null || raw === undefined || raw === "") return undefined;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : undefined;
  const s = String(raw).trim();
  if (!s) return undefined;
  // pt-BR: 1.234,56 ou 1234.56
  const normalized =
    s.includes(",") && s.includes(".")
      ? s.replace(/\./g, "").replace(",", ".")
      : s.includes(",")
        ? s.replace(",", ".")
        : s;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : undefined;
}

function collectFlatEntries(doc: DocumentSummary): Array<[string, unknown]> {
  const entries: Array<[string, unknown]> = [];
  for (const [k, v] of Object.entries(doc.flattenedJson || {})) entries.push([k, v]);
  for (const k of doc.rtcObservation?.matchedKeys || []) entries.push([k, undefined]);
  return entries;
}

/**
 * Prioridade do valor monetário:
 * 100 = SOMA CBS/IBS
 * 90  = total da NF (IBSCBSTot…vCBS / vIBS)
 * 70  = vCBS/vIBS fora de det[] (nível documento)
 * 40  = vCBS/vIBS em item (det)
 * 0   = não usar (alíquota, dif, crédito, etc.)
 */
function amountRank(key: string, kind: "cbs" | "ibs"): number {
  if (AMOUNT_EXCLUDE_RE.test(key)) return 0;
  if (new RegExp(`soma[\\s._-]*${kind}`, "i").test(key)) return 100;
  if (kind === "cbs") {
    if (/IBSCBSTot\.gCBS\.vCBS$/i.test(key) || /total\.[^.]+\.gCBS\.vCBS$/i.test(key)) return 90;
    if (/\.vCBS$/i.test(key) || /^vCBS$/i.test(key)) {
      return /det(\[|\.|$)/i.test(key) ? 40 : 70;
    }
  } else {
    if (/IBSCBSTot\.gIBS\.vIBS$/i.test(key) || /total\.[^.]+\.gIBS\.vIBS$/i.test(key)) return 90;
    if (/\.vIBS$/i.test(key) || /^vIBS$/i.test(key)) {
      return /det(\[|\.|$)/i.test(key) ? 40 : 70;
    }
    // total IBS UF/Mun (só se ainda não houver vIBS)
    if (/IBSCBSTot\.gIBS\.gIBSUF\.vIBSUF$/i.test(key)) return 60;
    if (/IBSCBSTot\.gIBS\.gIBSMun\.vIBSMun$/i.test(key)) return 55;
  }
  return 0;
}

type AmountPick = { value: number; rank: number; key: string };

function considerAmount(
  current: AmountPick | undefined,
  key: string,
  value: unknown,
  kind: "cbs" | "ibs",
): AmountPick | undefined {
  const n = parseLooseNumber(value);
  if (n === undefined) return current;
  const rank = amountRank(key, kind);
  if (rank <= 0) return current;
  if (!current || rank > current.rank) return { value: n, rank, key };
  return current;
}

/**
 * Indica se o documento traz etiquetas/campos CBS e/ou IBS (inclui SOMA CBS / SOMA IBS).
 */
export function detectDocumentRtcLabels(
  doc: DocumentSummary,
  items?: DocumentItem[],
): DocumentRtcLabels {
  const cbsKeys = new Set<string>();
  const ibsKeys = new Set<string>();
  let cbsAmount: AmountPick | undefined;
  let ibsAmount: AmountPick | undefined;

  for (const [key, value] of collectFlatEntries(doc)) {
    if (CBS_KEY_RE.test(key)) {
      cbsKeys.add(key);
      cbsAmount = considerAmount(cbsAmount, key, value, "cbs");
    }
    if (IBS_KEY_RE.test(key)) {
      ibsKeys.add(key);
      ibsAmount = considerAmount(ibsAmount, key, value, "ibs");
    }
  }

  if (items) {
    for (const item of items) {
      for (const [key, value] of Object.entries(item.taxJson || {})) {
        const path = String(key);
        if (CBS_KEY_RE.test(path)) {
          cbsKeys.add(`item.${item.itemNumber}.${path}`);
          cbsAmount = considerAmount(cbsAmount, path, value, "cbs");
        }
        if (IBS_KEY_RE.test(path)) {
          ibsKeys.add(`item.${item.itemNumber}.${path}`);
          ibsAmount = considerAmount(ibsAmount, path, value, "ibs");
        }
      }
      for (const [key, value] of Object.entries(item.flattenedJson || {})) {
        if (CBS_KEY_RE.test(key)) {
          cbsKeys.add(key);
          cbsAmount = considerAmount(cbsAmount, key, value, "cbs");
        }
        if (IBS_KEY_RE.test(key)) {
          ibsKeys.add(key);
          ibsAmount = considerAmount(ibsAmount, key, value, "ibs");
        }
      }
    }
  }

  // rtcObservation genérico: se só há hint "CBS"/"IBS" sem flatten, respeitar
  if (doc.rtcObservation?.hasRtcHints) {
    for (const k of doc.rtcObservation.matchedKeys) {
      if (CBS_KEY_RE.test(k) || /\bcbs\b/i.test(k)) cbsKeys.add(k);
      if (IBS_KEY_RE.test(k) || /\bibs\b/i.test(k)) ibsKeys.add(k);
    }
  }

  return {
    hasCbs: cbsKeys.size > 0,
    hasIbs: ibsKeys.size > 0,
    somaCbs: cbsAmount?.value,
    somaIbs: ibsAmount?.value,
    cbsKeys: [...cbsKeys].slice(0, 20),
    ibsKeys: [...ibsKeys].slice(0, 20),
    cbsAmountKey: cbsAmount?.key,
    ibsAmountKey: ibsAmount?.key,
  };
}

/** Chaves flatten prioritárias para export wide (evita milhares de colunas det[n]). */
export const RTC_EXPORT_FLAT_KEYS = [
  "nfeProc.NFe.infNFe.total.IBSCBSTot.gCBS.vCBS",
  "nfeProc.NFe.infNFe.total.IBSCBSTot.gIBS.vIBS",
  "nfeProc.NFe.infNFe.total.IBSCBSTot.vBCIBSCBS",
  "nfeProc.NFe.infNFe.total.IBSCBSTot.gIBS.gIBSUF.vIBSUF",
  "nfeProc.NFe.infNFe.total.IBSCBSTot.gIBS.gIBSMun.vIBSMun",
] as const;
