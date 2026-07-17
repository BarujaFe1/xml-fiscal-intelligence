import { normalizeIcmsTot, normalizeNFeItemTax } from "@/modules/obligations/efd-icms-ipi/tax/normalize-nfe-tax";
import type {
  ObligationContext,
  ObligationDocumentInput,
} from "@/modules/obligations/core/types";
import type { DocumentItem, DocumentSummary } from "@/types";
import { moneyToFixed } from "@/lib/money/decimal";

/**
 * Conforme o Guia Prático do SPED, NF-e cancelada, denegada, inutilizada ou
 * rejeitada NÃO devem entrar no EFD. O `status` vem do protocolo de autorização
 * (cStat/xMotivo) quando o XML é um nfeProc completo.
 * Retorna `true` (usável), `false` (excluir) ou `null` (status desconhecido).
 */
export function nfeEfdStatus(doc: DocumentSummary): boolean | null {
  const s = (doc.status || "").toString().trim();
  if (!s) return null;
  const low = s.toLowerCase();
  const excluded = /(cancel|deneg|inut|rejeit|n[ãa]o autoriz|nao autoriz|negad|uso denegado)/.test(low);
  if (excluded) return false;
  const authorized = /(^100$|^135$|^136$|^150$|^151$|^154$|^155$|autoriz|aprov|homolog)/.test(low);
  if (authorized) return true;
  // cStat puro fora do conjunto autorizado → rejeição/denegação na maioria dos casos
  if (/^\d{2,3}$/.test(s)) return false;
  return true;
}

export interface EstablishmentFiscalInput {
  workspaceId: string;
  companyId: string;
  establishmentId: string;
  cnpj: string;
  ie?: string;
  uf: string;
  companyName: string;
  profile: "A" | "B" | "C";
  activityCode: string;
  purpose: "0" | "1";
  periodStart: string;
  periodEnd: string;
  codMun?: string;
  tradeName?: string;
  cep?: string;
  address?: string;
  addressNumber?: string;
  addressCompl?: string;
  neighborhood?: string;
  phone?: string;
  email?: string;
  accountantName?: string;
  accountantCpf?: string;
  accountantCrc?: string;
  accountantEmail?: string;
  cnae?: string;
  cnaeDescription?: string;
  industrialClass?: string;
  icmsCodRec?: string;
  /** Saldo credor anterior informado manualmente (EFD E110). */
  priorCreditBalance?: string;
  layoutVersion: string;
}

/**
 * Maps BatchStore documents into ObligationContext.
 * Uses taxJson normalization — does not invent missing CST.
 */
export function buildObligationContextFromBatch(input: {
  establishment: EstablishmentFiscalInput;
  documents: DocumentSummary[];
  items: DocumentItem[];
}): ObligationContext {
  const { establishment, documents, items } = input;
  let excludedCount = 0;
  let unknownStatusCount = 0;
  const docs: ObligationDocumentInput[] = documents
    .filter((d) => {
      if (d.documentType !== "NFE" && d.documentType !== "NFCE" && d.model !== "55") return false;
      const usable = nfeEfdStatus(d);
      if (usable === false) {
        excludedCount += 1;
        return false;
      }
      if (usable === null) unknownStatusCount += 1;
      return true;
    })
    .map((d) => {
      const docItems = items.filter((i) => i.documentId === d.id);
      const icmsTot = normalizeIcmsTot(
        (d.rawJson && findIcmsTot(d.rawJson)) ||
          guessTotFromFlat(d.flattenedJson) ||
          {},
      );
      return {
        id: d.id,
        documentType: d.documentType,
        model: d.model || "55",
        series: d.series,
        number: d.number,
        accessKey: d.accessKey,
        issueDate: d.issueDate,
        emitterDoc: d.emitterDoc,
        emitterName: d.emitterName,
        emitterIe: d.emitterIe || flatStr(d.flattenedJson, ["emit.IE", "emit/IE"]),
        emitterUf: d.emitterUf,
        emitterCityCode:
          d.emitterCityCode || flatStr(d.flattenedJson, ["enderEmit.cMun", "enderEmit/cMun"]),
        emitterAddress:
          d.emitterAddress || flatStr(d.flattenedJson, ["enderEmit.xLgr", "enderEmit/xLgr"]),
        emitterAddressNumber:
          d.emitterAddressNumber || flatStr(d.flattenedJson, ["enderEmit.nro", "enderEmit/nro"]),
        emitterAddressCompl:
          d.emitterAddressCompl || flatStr(d.flattenedJson, ["enderEmit.xCpl", "enderEmit/xCpl"]),
        emitterNeighborhood:
          d.emitterNeighborhood ||
          flatStr(d.flattenedJson, ["enderEmit.xBairro", "enderEmit/xBairro"]),
        emitterCep: d.emitterCep || flatStr(d.flattenedJson, ["enderEmit.CEP", "enderEmit/CEP"]),
        receiverDoc: d.receiverDoc,
        receiverName: d.receiverName,
        receiverIe: d.receiverIe || flatStr(d.flattenedJson, ["dest.IE", "dest/IE"]),
        receiverUf: d.receiverUf,
        receiverCityCode:
          d.receiverCityCode || flatStr(d.flattenedJson, ["enderDest.cMun", "enderDest/cMun"]),
        receiverAddress:
          d.receiverAddress || flatStr(d.flattenedJson, ["enderDest.xLgr", "enderDest/xLgr"]),
        receiverAddressNumber:
          d.receiverAddressNumber || flatStr(d.flattenedJson, ["enderDest.nro", "enderDest/nro"]),
        receiverAddressCompl:
          d.receiverAddressCompl || flatStr(d.flattenedJson, ["enderDest.xCpl", "enderDest/xCpl"]),
        receiverNeighborhood:
          d.receiverNeighborhood ||
          flatStr(d.flattenedJson, ["enderDest.xBairro", "enderDest/xBairro"]),
        receiverCep: d.receiverCep || flatStr(d.flattenedJson, ["enderDest.CEP", "enderDest/CEP"]),
        natureOperation: d.natureOperation,
        cfopMain: d.cfopMain,
        totalValue: moneyToFixed(d.totalValue || 0),
        productsValue: moneyToFixed(d.productsValue || 0),
        freightValue: moneyToFixed(d.freightValue || 0),
        discountValue: moneyToFixed(d.discountValue || 0),
        status: d.status,
        protocol: d.protocol,
        icmsTot,
        items: docItems.map((item) => {
          const tax = normalizeNFeItemTax(item.taxJson);
          return {
            itemNumber: item.itemNumber,
            code: item.code,
            description: item.description,
            ncm: item.ncm,
            cfop: item.cfop,
            unit: item.unit,
            quantity: moneyToFixed(item.quantity || 0, 4),
            unitValue: moneyToFixed(item.unitValue || 0, 6),
            totalValue: moneyToFixed(item.totalValue || 0),
            discountValue: moneyToFixed(item.discountValue || 0),
            tax: {
              icms: {
                cst: tax.icms.cst,
                csosn: tax.icms.csosn,
                orig: tax.icms.orig,
                vBc: tax.icms.vBc,
                pIcms: tax.icms.pIcms,
                vIcms: tax.icms.vIcms,
                vBcSt: tax.icms.vBcSt,
                vIcmsSt: tax.icms.vIcmsSt,
              },
              ipi: tax.ipi,
              pis: tax.pis,
              cofins: tax.cofins,
            },
          };
        }),
        xmlPathHints: { vNF: "nfeProc/NFe/infNFe/total/ICMSTot/vNF" },
      };
    });

  return {
    workspaceId: establishment.workspaceId,
    companyId: establishment.companyId,
    establishmentId: establishment.establishmentId,
    periodStart: establishment.periodStart,
    periodEnd: establishment.periodEnd,
    layoutVersion: establishment.layoutVersion,
    uf: establishment.uf,
    profile: establishment.profile,
    activityCode: establishment.activityCode,
    cnae: establishment.cnae,
    cnaeDescription: establishment.cnaeDescription,
    industrialClass: establishment.industrialClass,
    purpose: establishment.purpose,
    cnpj: establishment.cnpj,
    ie: establishment.ie,
    companyName: establishment.companyName,
    codMun: establishment.codMun,
    tradeName: establishment.tradeName,
    cep: establishment.cep,
    address: establishment.address,
    addressNumber: establishment.addressNumber,
    addressCompl: establishment.addressCompl,
    neighborhood: establishment.neighborhood,
    phone: establishment.phone,
    email: establishment.email,
    accountantName: establishment.accountantName,
    accountantCpf: establishment.accountantCpf,
    accountantCrc: establishment.accountantCrc,
    accountantEmail: establishment.accountantEmail,
    icmsCodRec: establishment.icmsCodRec,
    priorCreditBalance: establishment.priorCreditBalance,
    documents: docs,
    excludedDocumentCount: excludedCount,
    unknownStatusCount: unknownStatusCount,
  };
}

/**
 * Recorta os documentos cuja data de emissão está DENTRO do período
 * (periodStart..periodEnd, inclusivo). Usado na geração para que um único
 * lote importado (ex.: ZIP mensal) possa gerar EFDs de uma semana, dia,
 * mês, semestre ou intervalo arbitrário. Documentos sem data não são filtrados.
 */
export function filterDocumentsByPeriod(
  documents: DocumentSummary[],
  periodStart?: string,
  periodEnd?: string,
): { inPeriod: DocumentSummary[]; outOfPeriodCount: number } {
  if (!periodStart || !periodEnd) return { inPeriod: documents, outOfPeriodCount: 0 };
  let outOfPeriodCount = 0;
  const inPeriod = documents.filter((d) => {
    const issue = (d.issueDate || "").slice(0, 10);
    if (issue && (issue < periodStart || issue > periodEnd)) {
      outOfPeriodCount += 1;
      return false;
    }
    return true;
  });
  return { inPeriod, outOfPeriodCount };
}

function flatStr(
  flat: Record<string, string | number | boolean | null> | undefined,
  suffixes: string[],
): string | undefined {
  if (!flat) return undefined;
  for (const [k, v] of Object.entries(flat)) {
    if (v === null || v === undefined || v === "") continue;
    const norm = k.replace(/\//g, ".");
    for (const s of suffixes) {
      const sn = s.replace(/\//g, ".");
      if (norm.endsWith(sn) || norm.includes(`.${sn}`)) return String(v);
    }
  }
  return undefined;
}

function findIcmsTot(obj: unknown): unknown {
  if (!obj || typeof obj !== "object") return undefined;
  if (Array.isArray(obj)) {
    for (const i of obj) {
      const f = findIcmsTot(i);
      if (f) return f;
    }
    return undefined;
  }
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const clean = (k.includes(":") ? k.split(":").pop()! : k).toLowerCase();
    if (clean === "icmstot") return v;
    const nested = findIcmsTot(v);
    if (nested) return nested;
  }
  return undefined;
}

function guessTotFromFlat(
  flat: Record<string, string | number | boolean | null>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(flat)) {
    if (/icmstot\.v/i.test(k) && v !== null && v !== undefined) {
      const field = k.split(".").pop()!;
      out[field] = String(v);
    }
  }
  return out;
}
