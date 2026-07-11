import { normalizeIcmsTot, normalizeNFeItemTax } from "@/modules/obligations/efd-icms-ipi/tax/normalize-nfe-tax";
import type {
  ObligationContext,
  ObligationDocumentInput,
} from "@/modules/obligations/core/types";
import type { DocumentItem, DocumentSummary } from "@/types";
import { moneyToFixed } from "@/lib/money/decimal";

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
  accountantName?: string;
  accountantCpf?: string;
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
  const docs: ObligationDocumentInput[] = documents
    .filter((d) => d.documentType === "NFE" || d.documentType === "NFCE" || d.model === "55")
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
        emitterUf: d.emitterUf,
        receiverDoc: d.receiverDoc,
        receiverName: d.receiverName,
        receiverUf: d.receiverUf,
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
    purpose: establishment.purpose,
    cnpj: establishment.cnpj,
    ie: establishment.ie,
    companyName: establishment.companyName,
    accountantName: establishment.accountantName,
    accountantCpf: establishment.accountantCpf,
    documents: docs,
  };
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
