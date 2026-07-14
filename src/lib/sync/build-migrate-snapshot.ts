/**
 * Build a cloud-safe snapshot from a local BatchStore (no secrets, capped fields).
 */
import type { BatchStore, DocumentSummary, DocumentItem } from "@/types";

export function buildMigrateSnapshot(store: BatchStore): {
  version: 1;
  batch: BatchStore["batch"];
  documents: Array<Partial<DocumentSummary>>;
  items: Array<Partial<DocumentItem>>;
  counts: { documents: number; items: number };
} {
  const documents: Array<Partial<DocumentSummary>> = store.documents.map((d) => ({
    id: d.id,
    documentType: d.documentType,
    fileName: d.fileName,
    accessKey: d.accessKey,
    protocol: d.protocol,
    xmlHash: d.xmlHash,
    number: d.number,
    series: d.series,
    model: d.model,
    issueDate: d.issueDate,
    emitterDoc: d.emitterDoc,
    emitterName: d.emitterName,
    emitterUf: d.emitterUf,
    emitterIe: d.emitterIe,
    emitterCityCode: d.emitterCityCode,
    emitterAddress: d.emitterAddress,
    emitterAddressNumber: d.emitterAddressNumber,
    emitterNeighborhood: d.emitterNeighborhood,
    emitterCep: d.emitterCep,
    receiverDoc: d.receiverDoc,
    receiverName: d.receiverName,
    totalValue: d.totalValue,
    parseStatus: d.parseStatus,
    flattenedJson: pickFlat(d.flattenedJson),
  }));

  const items: Array<Partial<DocumentItem>> = store.items.slice(0, 50_000).map((it) => ({
    id: it.id,
    documentId: it.documentId,
    itemNumber: it.itemNumber,
    code: it.code,
    description: it.description?.slice(0, 240),
    ncm: it.ncm,
    cfop: it.cfop,
    cst: it.cst,
    quantity: it.quantity,
    unit: it.unit,
    unitValue: it.unitValue,
    totalValue: it.totalValue,
  }));

  return {
    version: 1,
    batch: store.batch,
    documents,
    items,
    counts: { documents: documents.length, items: items.length },
  };
}

function pickFlat(
  flat: Record<string, string | number | boolean | null> | undefined,
): Record<string, string | number | boolean | null> | undefined {
  if (!flat || typeof flat !== "object") return undefined;
  const keys = [
    "vNF",
    "vProd",
    "vICMS",
    "vST",
    "vIPI",
    "vPIS",
    "vCOFINS",
    "natOp",
    "mod",
    "nNF",
    "serie",
  ];
  const out: Record<string, string | number | boolean | null> = {};
  for (const k of keys) {
    if (k in flat) out[k] = flat[k];
  }
  return Object.keys(out).length ? out : undefined;
}
